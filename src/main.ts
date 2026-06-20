// 앱 진입점: 씬 전환, 게임 루프, 패널 렌더, 단축키, 자동 저장, 오디오 오케스트레이션

import { Game, DT, replay } from "./core/engine";
import { posAtDist } from "./core/path";
import { randomSeed } from "./core/rng";
import { stateChecksum } from "./core/checksum";
import { BoardRenderer } from "./ui/board";
import type { AppCtx } from "./ui/ctx";
import { renderTopbar, renderLeftPanel, renderRightPanel, renderActionbar, renderUnitDetail } from "./ui/panels";
import { renderMenubar } from "./ui/menu";
import { toast, anyModalOpen, closeTopModal, confirmModal } from "./ui/widgets";
import {
  manualPlaylogCommand,
  manualPlaylogDryRunCommand,
  manualPlaylogFinishCommand,
  manualPlaylogFinishDryRunCommand,
  manualPlaylogFinishLatestCommand,
  manualPlaylogFinishLatestDryRunCommand,
  manualPlaylogFinishLatestThenNextCommand,
  manualPlaylogThenNextCommand,
  currentManualProofSummary,
  maybeShowResult,
  openSelectorModal,
  resetResultShown,
} from "./ui/modals";
import { loadSlot, makeSaveRecord, saveSlot } from "./save/saveApi";
import { loadProfile, loadSettings, maxSelectableStageId, playableStageId, profileMarkSeen, profileRecordRun } from "./ui/settings";
import { GameAudio } from "./ui/audio";
import { showGame, showTitle, openPauseMenu } from "./ui/scenes";
import { openDevSpawnModal } from "./ui/devTools"; // ⚠ DEV전용 (출시 전 제거)
import { UNIT_BY_ID } from "./data/units";
import { analyzeRecipes } from "./core/advisor";
import { stageById } from "./data/stages";
import { FINAL_ROUND, waveForRound } from "./data/waves";
import { UPGRADES, upgradeCost } from "./data/upgrades";
import { GRADE_ORDER, type DifficultyId, type Grade } from "./core/types";
import { MANUAL_PROOF_TARGET_SECONDS, manualProofReadyAt, manualProofRemainingSeconds, manualProofTargetFor } from "./core/manualProof";
import { manualProofResultChecklist, manualProofResultTarget } from "./core/manualProofResult";
import {
  manualDryRunCommand,
  manualNextCommand,
  manualNextJsonCommand,
  manualPendingIdCommand as buildManualPendingIdCommand,
  manualPlanCommand,
  manualPlanJsonCommand,
  manualPreflightCommand,
  manualPreflightJsonCommand,
  manualSheetCommand,
  manualStartCommand as buildManualStartCommand,
  manualStartNextCommand as buildManualStartNextCommand,
  manualSummaryCommand,
  manualSummaryJsonCommand,
} from "./core/manualProofCommands";

const settings = loadSettings();
const audio = new GameAudio(settings);

const canvas = document.getElementById("board") as HTMLCanvasElement;
const renderer = new BoardRenderer(canvas);
renderer.showLabels = settings.highContrast;
renderer.showDamage = settings.showDamage;

/** 직전 시점에 "지금 제작 가능"하던 조합 id들 (신규 가능 알림용) */
let craftableIds = new Set<string>();
function craftableSet(): Set<string> {
  return new Set(
    analyzeRecipes(game.state)
      .filter((st) => st.tier === "ok" && st.goldShort === 0)
      .map((st) => st.recipe.id),
  );
}
/** 새로 제작 가능해진 조합을 토스트로 알린다(과밀 방지: edge에서 1회). */
function notifyNewlyCraftable() {
  const statuses = analyzeRecipes(game.state);
  const nowOk = new Set<string>();
  for (const st of statuses) {
    if (st.tier === "ok" && st.goldShort === 0) {
      nowOk.add(st.recipe.id);
      if (!craftableIds.has(st.recipe.id)) {
        audio.sfx("click");
        toast(`🔧 조합 가능: ${st.resultName}`, "ok", 2200);
      }
    }
  }
  craftableIds = nowOk;
}

let game = new Game(randomSeed(), "novice", 1); // 타이틀 뒤에서 대기하는 플레이스홀더 런
let panelsDirty = true;
let lastPhase = game.state.phase;
let lastRound = game.state.round;
let lastSelectorCount = game.state.pendingSelectors.length;
let autosaveTimer: number | null = null;
let endedHandled = false;
let manualProofReadyNotified = false;

function markRunStarted() {
  ctx.runStartedAt = new Date().toISOString();
  ctx.runStartedAtMs = performance.now();
  ctx.runEndedAt = null;
  ctx.runEndedAtMs = null;
  manualProofReadyNotified = false;
}

function markRunEnded() {
  if (ctx.runEndedAt) return;
  ctx.runEndedAt = new Date().toISOString();
  ctx.runEndedAtMs = performance.now();
}

function currentLegendOrBetterCount(): number {
  return game.state.units.filter((u) => (
    GRADE_ORDER.indexOf(UNIT_BY_ID[u.defId].grade) >= GRADE_ORDER.indexOf("legend")
  )).length;
}

function maybeNotifyManualProofReady(now: number) {
  if (manualProofReadyNotified || ctx.scene !== "game" || game.state.phase === "ended") return;
  const proofSeconds = Math.max(0, Math.floor((now - ctx.runStartedAtMs) / 1000));
  if (proofSeconds < MANUAL_PROOF_TARGET_SECONDS) return;
  manualProofReadyNotified = true;
  const target = manualProofTargetFor(game.state.difficulty, currentLegendOrBetterCount());
  toast(`수동증거 12분 충족 · ${target.status} · 결과 후 로그 기록`, target.state === "warn" ? "warn" : "ok", 5200);
  panelsDirty = true;
}

const ctx: AppCtx = {
  game,
  renderer,
  audio,
  settings,
  scene: "title",
  paused: false,
  activeTab: "recipe",
  gradeFilter: "all",
  saveStatus: "idle",
  runStartedAt: new Date().toISOString(),
  runStartedAtMs: performance.now(),
  runEndedAt: null,
  runEndedAtMs: null,
  lastRunUnlockedNext: false,
  refresh: () => { panelsDirty = true; },
  newRun: (seed, difficulty, stageId = 1) => {
    const requestedStage = stageId;
    const allowedStage = playableStageId(requestedStage, loadProfile().unlockedStage);
    const resolvedSeed = typeof seed === "string" ? seed : String(seed ?? "");
    game = new Game(resolvedSeed || randomSeed(), difficulty, allowedStage);
    ctx.game = game;
    markRunStarted();
    game.onEvent = onGameEvent;
    renderer.selectedUids.clear();
    renderer.resetFx();
    craftableIds = craftableSet();
    ctx.paused = false;
    ctx.lastRunUnlockedNext = false;
    resetResultShown();
    endedHandled = false;
    lastPhase = game.state.phase;
    lastRound = game.state.round;
    lastSelectorCount = game.state.pendingSelectors.length;
    if (settings.defaultSpeed !== 1) game.dispatch("setSpeed", { speed: settings.defaultSpeed });
    panelsDirty = true;
    showGame(ctx);
    audio.sfx("waveStart");
    const stage = stageById(game.state.stageId);
    const lockNote = allowedStage !== requestedStage ? " · 잠긴 맵 요청은 현재 선택 가능 맵으로 조정됨" : "";
    toast(`새 게임: ${stage.id}. ${stage.name} · 이번 판 1~40R 맵 고정 · 시드 ${game.state.seed}${lockNote}`, "ok");
  },
  adoptGame: (g) => {
    game = g;
    ctx.game = game;
    markRunStarted();
    game.onEvent = onGameEvent;
    renderer.selectedUids.clear();
    renderer.resetFx();
    craftableIds = craftableSet();
    ctx.paused = true;
    ctx.lastRunUnlockedNext = false;
    resetResultShown();
    endedHandled = game.state.phase === "ended";
    if (endedHandled) markRunEnded();
    lastPhase = game.state.phase;
    lastRound = game.state.round;
    lastSelectorCount = game.state.pendingSelectors.length;
    panelsDirty = true;
    showGame(ctx);
  },
  act: (type, payload) => {
    const res = game.dispatch(type as never, payload);
    if (res.ok) {
      playActionSfx(type);
    } else {
      audio.sfx("deny");
      if (res.reason) toast(res.reason, "warn");
    }
    panelsDirty = true;
    return res.ok;
  },
  autosave: () => void doAutosave(),
  advanceWave: () => { ctx.act("startWave"); }, // 휴식 건너뛰고 다음 라운드 즉시 시작
  goTitle: () => {
    ctx.paused = true;
    showTitle(ctx);
  },
  continueAutosave: async () => {
    try {
      const rec = await loadSlot("autosave");
      if (!rec) { toast("자동 저장이 없습니다", "warn"); return false; }
      if (rec.dataVersion !== game.state.dataVersion) {
        toast("현재 데이터 버전과 달라 불러올 수 없습니다.", "warn", 4000);
        return false;
      }
      const replayed = replay(rec.seed, rec.difficulty, rec.stageId ?? 1, rec.inputHistory, rec.tick);
      if (stateChecksum(replayed.state) !== rec.stateChecksum) {
        toast("체크섬 불일치: 손상된 자동 저장입니다.", "danger", 4000);
        return false;
      }
      ctx.adoptGame(replayed);
      ctx.paused = false;
      toast(`${rec.round}R부터 이어합니다`, "ok");
      return true;
    } catch {
      toast("복구 실패", "danger");
      return false;
    }
  },
};

function playActionSfx(type: string) {
  switch (type) {
    case "summon": {
      const last = game.state.units[game.state.units.length - 1];
      const rare = last && UNIT_BY_ID[last.defId].grade !== "common";
      audio.sfx(rare ? "summonRare" : "summon");
      break;
    }
    case "merge3": audio.sfx("merge"); break;
    case "craft": audio.sfx("craft"); break;
    case "sell": audio.sfx("sell"); break;
    case "upgrade": audio.sfx("upgrade"); break;
    case "pickSelector": audio.sfx("summonRare"); break;
    case "startWave": {
      const isBoss = game.state.round % 10 === 0;
      audio.sfx(isBoss ? "bossWarn" : "waveStart");
      break;
    }
    default: audio.sfx("click");
  }
}

function onGameEvent(kind: string, text: string) {
  if (kind === "mission") { audio.sfx("mission"); toast(text, "ok"); }
  else if (kind === "boss") {
    if (text.includes("처치")) audio.sfx("bossDown");
    toast(text, "danger", 3200);
  }
  else if (kind === "system" && text.includes("보정")) toast(text, "ok");
  else if (kind === "craft" && text.includes("발견")) { audio.sfx("summonRare"); toast(`✨ ${text}`, "ok", 3200); }
  panelsDirty = true;
}
game.onEvent = onGameEvent;

// ---------- 자동 저장 (phase 전환 기준, 디바운스) ----------

async function doAutosave() {
  const s = game.state;
  if (s.phase === "ended") return;
  ctx.saveStatus = "saving";
  panelsDirty = true;
  try {
    await saveSlot("autosave", makeSaveRecord({
      seed: s.seed, difficulty: s.difficulty, stageId: s.stageId,
      stateChecksum: stateChecksum(s),
      tick: s.tick, round: s.round, life: s.life,
      maxGrade: game.maxOwnedGrade(),
      inputHistory: s.inputHistory,
    }));
    ctx.saveStatus = "saved";
  } catch {
    ctx.saveStatus = "failed";
    toast("저장 실패: 권한 또는 디스크 상태를 확인하세요.", "danger");
  }
  panelsDirty = true;
}

function scheduleAutosave() {
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => void doAutosave(), 400);
}

// ---------- 게임 루프 ----------

let acc = 0;
let lastTime = performance.now();
let lastTopbarAt = 0;

function loop(now: number) {
  if (ctx.scene === "game") {
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);

    if (!ctx.paused && game.state.phase === "wave") {
      acc += elapsed * game.state.speed;
      let steps = 0;
      while (acc >= DT && steps++ < 200) {
        game.advanceTick();
        acc -= DT;
        if (game.state.phase !== "wave") { acc = 0; break; }
      }
    }

    // 라운드 변화 감지 → 자동 저장 + 도감 기록
    if (game.state.round !== lastRound) {
      lastRound = game.state.round;
      panelsDirty = true;
      scheduleAutosave();
      profileMarkSeen(game.state.units.map((u) => u.defId), game.state.discoveredRecipeIds);
    }

    // 선택권(영웅 보정/보스 보상)이 새로 생기면 모달
    if (game.state.pendingSelectors.length > lastSelectorCount && !anyModalOpen()) {
      openSelectorModal(ctx);
    }
    lastSelectorCount = game.state.pendingSelectors.length;

    if (game.state.phase !== lastPhase) { lastPhase = game.state.phase; panelsDirty = true; }
    maybeNotifyManualProofReady(now);

    // 종료 처리 (1회)
    if (game.state.phase === "ended" && !endedHandled) {
      endedHandled = true;
      markRunEnded();
      profileMarkSeen(game.state.units.map((u) => u.defId), game.state.discoveredRecipeIds);
      const finalBossCleared = game.state.cleared && game.state.bossKillSeconds[FINAL_ROUND] !== undefined;
      const unlockedNext = profileRecordRun(
        game.state.cleared,
        game.state.difficulty,
        game.state.round,
        game.state.stageId,
        finalBossCleared,
      );
      ctx.lastRunUnlockedNext = unlockedNext;
      if (unlockedNext) {
        const nextStage = stageById(maxSelectableStageId(game.state.stageId + 1));
        toast(`맵 선택권 해금: 다음 새 게임부터 ${nextStage.id}. ${nextStage.name} 선택 가능`, "ok", 3200);
      }
    }

    // 라운드 사이 휴식 카운트다운 표시 (엔진 breakTicks 기반)
    renderer.autoStartIn = game.state.breakTicks > 0 ? game.state.breakTicks * DT : null;

    renderer.draw(game.state);
    maybeShowResult(ctx);

    if (panelsDirty) {
      panelsDirty = false;
      notifyNewlyCraftable();
      renderTopbar(ctx);
      renderLeftPanel(ctx);
      renderRightPanel(ctx);
      renderUnitDetail(ctx);
      renderActionbar(ctx);
    } else if (game.state.phase === "wave" && now - lastTopbarAt > 250) {
      lastTopbarAt = now;
      renderTopbar(ctx);
      renderUnitDetail(ctx); // 전투 중 누적피해 갱신
    }
  }
  lastTime = now;
  requestAnimationFrame(loop);
}

// ---------- 캔버스: RTS 컨트롤 (좌클릭 선택/드래그 박스선택, 우클릭 이동/공격) ----------

const BOX_THRESHOLD = 6; // px (화면) 이상 끌면 박스 선택으로 간주
const groups: Record<string, number[]> = {}; // 부대 지정 (UI 전용, 리플레이 미기록)
let leftDown: { x: number; y: number } | null = null;
let boxing = false;

/** 현재 선택 유닛 uid 배열 (정렬 고정) */
function selectedArr(): number[] {
  return [...renderer.selectedUids].sort((a, b) => a - b);
}

/** 선택 유닛들에 명령 디스패치 */
function commandSelected(type: string, payload: Record<string, unknown>) {
  const ids = selectedArr();
  if (ids.length === 0) return;
  ctx.act(type, { unitIds: ids, ...payload });
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  if (ctx.scene !== "game" || anyModalOpen()) return;
  const board = renderer.toBoard(e.clientX, e.clientY);

  if (e.button === 2) {
    // 우클릭: 적이면 공격, 아니면 이동 (공격이동 모드는 좌클릭 사용이라 여기선 일반 이동/공격)
    renderer.attackMoveMode = false;
    const eid = renderer.enemyAt(game.state, e.clientX, e.clientY);
    if (eid !== -1) commandSelected("cmdAttack", { targetEid: eid });
    else commandSelected("cmdMove", { x: board.x, y: board.y });
    return;
  }
  if (e.button !== 0) return;

  // 좌클릭: 공격 이동 모드면 그 지점으로 공격이동 명령
  if (renderer.attackMoveMode) {
    renderer.attackMoveMode = false;
    commandSelected("cmdAttackMove", { x: board.x, y: board.y });
    return;
  }

  leftDown = { x: e.clientX, y: e.clientY };
  boxing = false;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!leftDown) return;
  if (!boxing && Math.hypot(e.clientX - leftDown.x, e.clientY - leftDown.y) > BOX_THRESHOLD) {
    boxing = true;
    const start = renderer.toBoard(leftDown.x, leftDown.y);
    renderer.selectBox = { x0: start.x, y0: start.y, x1: start.x, y1: start.y };
  }
  if (boxing && renderer.selectBox) {
    const cur = renderer.toBoard(e.clientX, e.clientY);
    renderer.selectBox.x1 = cur.x;
    renderer.selectBox.y1 = cur.y;
  }
});

canvas.addEventListener("pointerup", (e) => {
  if (!leftDown) return;
  try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }

  if (boxing && renderer.selectBox) {
    // 박스 선택: 박스 안 유닛 전체 선택
    const ids = renderer.unitsInBox(game.state, renderer.selectBox);
    renderer.selectedUids = new Set(ids);
    audio.sfx("click");
  } else {
    // 단일 클릭: 유닛이면 단독 선택, 빈 곳이면 선택 해제
    const uid = renderer.unitAt(game.state, e.clientX, e.clientY);
    if (uid === -1) {
      renderer.selectedUids.clear();
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+클릭: 필드의 동일 캐릭터(같은 defId) 일괄 선택
      const clicked = game.state.units.find((u) => u.uid === uid);
      const ids = clicked
        ? game.state.units.filter((u) => u.defId === clicked.defId).map((u) => u.uid)
        : [uid];
      renderer.selectedUids = new Set(ids);
      audio.sfx("click");
    } else {
      renderer.selectedUids = new Set([uid]);
      audio.sfx("click");
    }
  }
  renderer.selectBox = null;
  leftDown = null;
  boxing = false;
  panelsDirty = true;
});

// ---------- 단축키 ----------

document.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT") return;

  if (e.key === "Escape") {
    if (renderer.attackMoveMode) { renderer.attackMoveMode = false; return; }
    if (anyModalOpen()) { closeTopModal(); return; }
    if (ctx.scene === "game") { openPauseMenu(ctx); return; }
    return;
  }
  if (ctx.scene !== "game" || anyModalOpen()) return;

  // ⚠ DEV전용: 백틱(`)으로 유닛 즉시 생성 팝업 (출시 전 제거)
  if (e.key === "`") { e.preventDefault(); openDevSpawnModal(ctx); return; }

  const s = game.state;

  // 부대 지정: Ctrl+숫자 저장 / 숫자 선택
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      groups[e.key] = selectedArr();
      toast(`${e.key}번 부대 지정 (${groups[e.key].length}기)`, "ok", 1200);
    } else {
      const alive = (groups[e.key] ?? []).filter((uid) => s.units.some((u) => u.uid === uid));
      groups[e.key] = alive; // 사망 유닛 정리
      renderer.selectedUids = new Set(alive);
      audio.sfx("click");
      panelsDirty = true;
    }
    return;
  }

  switch (e.key) {
    case " ": {
      e.preventDefault();
      if (s.breakTicks > 0) {
        // 라운드 사이 휴식 → 바로 다음 라운드 시작
        ctx.act("startWave");
      } else {
        ctx.paused = !ctx.paused; // 라운드 진행 중 → 일시정지 토글
        audio.sfx("click");
        panelsDirty = true;
      }
      break;
    }
    // ----- RTS 명령 -----
    case "a": case "A": // 공격 이동 모드 (다음 좌클릭이 목표 지점)
      if (renderer.selectedUids.size > 0) { renderer.attackMoveMode = true; audio.sfx("click"); }
      break;
    case "s": case "S": // 정지(Hold)
      commandSelected("cmdStop", {});
      break;
    // ----- 게임 액션 (RTS 우선 배치로 재배치된 키) -----
    case "z": case "Z": ctx.act("summon"); break; // 소환
    case "x": case "X": {                          // 3합성
      const sel = [...renderer.selectedUids];
      if (sel.length === 3) { ctx.act("merge3", { unitIds: sel }); renderer.selectedUids.clear(); }
      else toast("같은 등급 3기를 선택하세요", "warn");
      break;
    }
    case "Delete": case "Backspace": {             // 판매 (상시 가능)
      const sel = [...renderer.selectedUids];
      if (sel.length === 0) { toast("판매할 유닛을 선택하세요", "warn"); break; }
      confirmModal("판매 확인", `선택한 ${sel.length}기를 판매합니다.`, "판매", () => {
        ctx.act("sell", { unitIds: sel });
        renderer.selectedUids.clear();
      }, true);
      break;
    }
    case "q": case "Q": ctx.act("setSpeed", { speed: 1 }); break;
    case "w": case "W": ctx.act("setSpeed", { speed: 2 }); break;
    case "e": case "E": ctx.act("setSpeed", { speed: 3 }); break;
    case "l": case "L":
      for (const uid of renderer.selectedUids) ctx.act("toggleLock", { unitId: uid });
      break;
  }
});

// ---------- 오디오 unlock (브라우저 정책: 첫 제스처 필요) ----------

const unlockAudio = () => {
  audio.unlock();
  document.removeEventListener("pointerdown", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
};
document.addEventListener("pointerdown", unlockAudio);
document.addEventListener("keydown", unlockAudio);

// ---------- 창 비활성 시 자동 일시정지 ----------

window.addEventListener("blur", () => {
  if (settings.autoPause && ctx.scene === "game" && game.state.phase === "wave" && !ctx.paused) {
    ctx.paused = true;
    panelsDirty = true;
    toast("창이 비활성화되어 일시정지했습니다", "info" as never);
  }
});

// ---------- 부팅 ----------

renderMenubar(ctx);
showTitle(ctx);
requestAnimationFrame(loop);

function renderGameToText(): string {
  const s = game.state;
  const stage = stageById(s.stageId);
  const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
  const manualProofSeconds = Math.max(0, Math.floor((performance.now() - ctx.runStartedAtMs) / 1000));
  const manualProofRemaining = manualProofRemainingSeconds(manualProofSeconds);
  const manualProofTargetReadyAt = ctx.scene === "game" ? manualProofReadyAt(ctx.runStartedAt) : null;
  const gradeCounts: Record<Grade, number> = { common: 0, rare: 0, hero: 0, legend: 0, hidden: 0 };
  let maxGrade: Grade | null = null;
  for (const unit of s.units) {
    const grade = UNIT_BY_ID[unit.defId].grade;
    gradeCounts[grade]++;
    if (!maxGrade || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(maxGrade)) maxGrade = grade;
  }
  const legendOrBetter = gradeCounts.legend + gradeCounts.hidden;
  const manualProofTarget = manualProofTargetFor(s.difficulty, legendOrBetter);
  const currentStateChecksum = stateChecksum(s);
  const manualStartInput = {
    difficultyId: s.difficulty,
    stageId: s.stageId,
    seed: s.seed,
    startedAt: ctx.runStartedAt,
    notes: manualProofTarget.label,
  };
  const manualStartCommand = buildManualStartCommand(manualStartInput);
  const manualStartNextCommand = buildManualStartNextCommand(manualStartInput);
  const manualPendingIdCommand = buildManualPendingIdCommand(manualStartInput);
  let manualResultTarget: string | null = null;
  let manualResultChecks: ReturnType<typeof manualProofResultChecklist> | null = null;
  let manualResultPassed: boolean | null = null;
  const manualProofCommands = ctx.scene === "game"
    ? {
        start: manualStartCommand,
        startDryRun: manualDryRunCommand(manualStartCommand),
        startNext: manualStartNextCommand,
        startNextDryRun: manualDryRunCommand(manualStartNextCommand),
        pendingId: manualPendingIdCommand,
        pendingIdJson: `${manualPendingIdCommand} --json`,
        preflight: manualPreflightCommand(),
        preflightJson: manualPreflightJsonCommand(),
        next: manualNextCommand(),
        nextJson: manualNextJsonCommand(),
        summary: manualSummaryCommand(),
        summaryJson: manualSummaryJsonCommand(),
        plan: manualPlanCommand(),
        planJson: manualPlanJsonCommand(),
        sheet: manualSheetCommand(),
        result: null as string | null,
        resultDryRun: null as string | null,
        resultThenNext: null as string | null,
        finish: null as string | null,
        finishDryRun: null as string | null,
        finishLatest: null as string | null,
        finishLatestDryRun: null as string | null,
        finishLatestThenNext: null as string | null,
        currentFinish: null as string | null,
        currentFinishDryRun: null as string | null,
        currentFinishLatest: null as string | null,
        currentFinishLatestDryRun: null as string | null,
      }
    : null;
  if (manualProofCommands && s.phase !== "ended") {
    const currentSummary = currentManualProofSummary(ctx);
    manualProofCommands.currentFinish = manualPlaylogFinishCommand(currentSummary);
    manualProofCommands.currentFinishDryRun = manualPlaylogFinishDryRunCommand(currentSummary);
    manualProofCommands.currentFinishLatest = manualPlaylogFinishLatestCommand(currentSummary);
    manualProofCommands.currentFinishLatestDryRun = manualPlaylogFinishLatestDryRunCommand(currentSummary);
  }
  if (manualProofCommands && s.phase === "ended") {
    const endedAt = ctx.runEndedAt ?? new Date().toISOString();
    const endedAtMs = ctx.runEndedAtMs ?? performance.now();
    const summary = game.resultSummary();
    summary.playedAt = endedAt;
    summary.manualStartedAt = ctx.runStartedAt;
    summary.unlockedNextStage = ctx.lastRunUnlockedNext;
    summary.wallSeconds = Math.max(1, Math.round((endedAtMs - ctx.runStartedAtMs) / 1000));
    manualProofCommands.result = manualPlaylogCommand(summary);
    manualProofCommands.resultDryRun = manualPlaylogDryRunCommand(summary);
    manualProofCommands.resultThenNext = manualPlaylogThenNextCommand(summary);
    manualProofCommands.finish = manualPlaylogFinishCommand(summary);
    manualProofCommands.finishDryRun = manualPlaylogFinishDryRunCommand(summary);
    manualProofCommands.finishLatest = manualPlaylogFinishLatestCommand(summary);
    manualProofCommands.finishLatestDryRun = manualPlaylogFinishLatestDryRunCommand(summary);
    manualProofCommands.finishLatestThenNext = manualPlaylogFinishLatestThenNextCommand(summary);
    manualResultTarget = manualProofResultTarget(summary);
    manualResultChecks = manualProofResultChecklist(summary);
    manualResultPassed = manualResultChecks.every((check) => check.ok);
  }
  return JSON.stringify({
    coordinateSystem: "board origin top-left, x right, y down, logical size 960x560",
    scene: ctx.scene,
    paused: ctx.paused,
    mode: s.phase,
    dataVersion: s.dataVersion,
    seed: s.seed,
    stateChecksum: currentStateChecksum,
    difficulty: { id: s.difficulty, name: game.diff.name },
    stage: {
      current: s.stageId,
      name: stage.name,
      ground: stage.ground,
      progressionModel: "choose_one_map_at_new_game_start_then_unlock_next_map_permission_after_round_40_boss",
      fixedForRun: true,
      currentRunMapLocked: true,
      runGoal: "selected_map_round_1_to_40_final_boss",
      unlockRule: "clear_round_40_boss_on_current_unlocked_map",
      nextMapStartsInCurrentRun: false,
      autoChangesAfterRoundOrBoss: false,
      unlockAddsSelectionPermissionOnly: true,
      waypointCount: stage.waypoints.length,
      decorationCount: stage.decorations.length,
    },
    map: {
      progressionContract: "choose map once at new game start; play same map through 40R boss; clearing final boss unlocks next map selection permission for a later new game",
      selectedAtNewGameStart: true,
      fixedUntilFinalBossRound: 40,
      fixedForRounds: "1-40",
      changesBetweenRounds: false,
      changesAfterFinalBossClear: false,
      nextMapPermissionOnly: true,
      nextMapPermissionAppliesToNextNewGame: true,
      clearRound40BossOnlyUnlocksPermission: true,
    },
    manualProof: {
      elapsedSeconds: manualProofSeconds,
      targetSeconds: MANUAL_PROOF_TARGET_SECONDS,
      targetReadyAt: manualProofTargetReadyAt,
      remainingSeconds: manualProofRemaining,
      targetMet: manualProofRemaining === 0,
      targetLabel: manualProofTarget.label,
      conditionStatus: manualProofTarget.status,
      conditionState: manualProofTarget.state,
      resultTarget: manualResultTarget,
      resultChecks: manualResultChecks,
      resultPassed: manualResultPassed,
      readyNotified: manualProofReadyNotified,
      startedAt: ctx.scene === "game" ? ctx.runStartedAt : null,
      commands: manualProofCommands,
      evidenceFields: ctx.scene === "game"
        ? {
            difficulty: s.difficulty,
            stage: s.stageId,
            seed: s.seed,
            dataVersion: s.dataVersion,
            currentStateChecksum,
            startedAt: ctx.runStartedAt,
          }
        : null,
    },
    round: s.round,
    wave: { type: wave.type, enemyName: wave.enemyName, count: wave.count, spawned: s.waveSpawned, killed: s.waveKilled },
    resources: {
      life: s.life, gold: s.gold,
      enemyPressure: s.enemies.length,
      enemyLimit: game.enemyLimit(),
      breakTicks: s.breakTicks,
    },
    unitSummary: {
      total: s.units.length,
      gradeCounts,
      legendOrBetter,
      legendCommandAttackBonusPct: Math.round((game.legendCommandAttackMult() - 1) * 100),
      legendCommandEnemyLimitBonus: game.legendCommandEnemyLimitBonus(),
      maxGrade,
    },
    boss: {
      kills: s.bossKillSeconds,
      failedRounds: s.bossFailedRounds,
    },
    units: s.units.slice(0, 12).map((u) => {
      const def = UNIT_BY_ID[u.defId];
      return { uid: u.uid, name: def.name, grade: def.grade, family: def.family, x: Math.round(u.x), y: Math.round(u.y), state: u.state };
    }),
    enemies: s.enemies.slice(0, 16).map((e) => {
      const p = posAtDist(e.dist, s.stageId);
      return { eid: e.eid, hp: Math.round(e.hp), maxHp: Math.round(e.maxHp), x: Math.round(p.x), y: Math.round(p.y), boss: e.isBoss };
    }),
    selected: [...renderer.selectedUids].sort((a, b) => a - b),
    cleared: s.cleared,
    logTail: s.log.slice(-5).map((l) => `[${l.round}] ${l.text}`),
  });
}

function advanceTimeForTest(ms: number) {
  const steps = Math.max(1, Math.round((ms / 1000) / DT));
  for (let i = 0; i < steps; i++) {
    if (ctx.scene === "game" && game.state.phase === "wave") game.advanceTick();
  }
  if (ctx.scene === "game" && game.state.phase === "ended") markRunEnded();
  renderer.autoStartIn = game.state.breakTicks > 0 ? game.state.breakTicks * DT : null;
  renderer.draw(game.state);
  maybeNotifyManualProofReady(performance.now());
  renderTopbar(ctx);
  renderLeftPanel(ctx);
  renderRightPanel(ctx);
  renderUnitDetail(ctx);
  renderActionbar(ctx);
}

Object.assign(window, {
  render_game_to_text: renderGameToText,
  advanceTime: advanceTimeForTest,
});

if (import.meta.env.DEV) {
  Object.assign(window, {
    __randi_dev: {
      newRun: (seed = "PLAYTEST", difficultyOrStage: DifficultyId | number = "novice", stageId = 1) => {
        const difficulty = typeof difficultyOrStage === "number" ? "novice" : difficultyOrStage;
        const resolvedStageId = typeof difficultyOrStage === "number" ? difficultyOrStage : stageId;
        ctx.newRun(seed, difficulty, resolvedStageId);
      },
      ageRunForManualProof: (seconds: number) => {
        ctx.runStartedAtMs = performance.now() - Math.max(0, seconds) * 1000;
        maybeNotifyManualProofReady(performance.now());
        renderTopbar(ctx);
      },
      act: (type: string, payload?: Record<string, unknown>) => ctx.act(type, payload),
      state: () => game.state,
      balanceSnapshot: () => {
        const familyCounts = new Map<string, number>();
        for (const u of game.state.units) {
          const def = UNIT_BY_ID[u.defId];
          familyCounts.set(def.family, (familyCounts.get(def.family) ?? 0) + 1);
        }
        const unitInfo = (defId: string) => {
          const def = UNIT_BY_ID[defId];
          return {
            id: def.id,
            name: def.name,
            grade: def.grade,
            family: def.family,
            roles: def.roles,
            score: def.attack * def.attackSpeed * (1 + (def.bossDamageBonus ?? 0)) * (1 + (def.splashRadius ? 0.25 : 0)),
          };
        };
        return {
          round: game.state.round,
          phase: game.state.phase,
          cleared: game.state.cleared,
          breakTicks: game.state.breakTicks,
          gold: game.state.gold,
          unitCap: game.diff.unitCap,
          enemyPressure: game.state.enemies.length,
          enemyLimit: game.enemyLimit(),
          units: game.state.units.map((u) => ({ uid: u.uid, locked: u.locked, ...unitInfo(u.defId) })),
          selectors: game.state.pendingSelectors.map((s) => ({
            id: s.id,
            grade: s.grade,
            candidates: s.candidateIds.map(unitInfo),
          })),
          craftable: analyzeRecipes(game.state)
            .filter((s) => s.tier === "ok" && s.goldShort === 0)
            .map((s) => ({ id: s.recipe.id, result: unitInfo(s.recipe.resultUnitId), reasonTag: s.reasonTag ?? "" })),
          upgrades: UPGRADES.map((u) => ({
            id: u.id,
            family: u.family,
            level: game.state.upgrades[u.id] ?? 0,
            maxLevel: u.maxLevel,
            cost: upgradeCost(u, game.state.upgrades[u.id] ?? 0),
            ownedFamily: familyCounts.get(u.family) ?? 0,
          })),
        };
      },
    },
  });
}
