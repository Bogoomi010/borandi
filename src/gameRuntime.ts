// ???ÍøîÍ∫Ç?????? ?????? ??•‚ñ≤Íµ???????∑Îß§???? ???????? ????? ???????? ?????????????????

import { Game, DT, replay } from "./core/engine";
import { posAtDist } from "./core/path";
import { randomSeed } from "./core/rng";
import { stateChecksum } from "./core/checksum";
import type { AppCtx, BoardUiState } from "./runtimeContext";
import { toast, anyModalOpen, closeTopModal, confirmModal } from "./ui/uiFeedback";
import {
  openLoadModal,
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
  openNewRunModal,
  openManualProofGuideModal,
  openRelicChoiceModal,
  openSaveModal,
  openSelectorModal,
  buildReportMarkdown,
  resetResultShown,
} from "./ui/overlayActions";
import { canOpenAppDataDir, isTauri, loadSlot, makeSaveRecord, openAppDataDir, saveSlot, writeReport } from "./save/saveApi";
import { loadSettings, playableStageId, profileMarkSeen, profileRecordRun } from "./profile/settings";
import { setLocale, onLocaleChange, t } from "./i18n";
import { GameAudio } from "./audio/gameAudio";
import { openPauseMenu, openCollection, openOptionsOverlay, quitApp, toggleFullscreen } from "./ui/appActions";
import { clearReactOverlays, openReactOverlay } from "./ui/reactOverlayBridge";
import {
  publishRuntimeSnapshot,
  registerRuntimeControls,
  type BoardPointerInput,
  type RuntimeKeyInput,
} from "./runtimeBridge";
import { UNIT_BY_ID } from "./data/units";
import { analyzeRecipes } from "./core/advisor";
import { stageById } from "./data/stages";
import { FINAL_ROUND, waveForRound } from "./data/waves";
import { UPGRADES, upgradeCost } from "./data/upgrades";
import { APP_VERSION, DATA_VERSION } from "./data/version";
import { runSimulation, reportToMarkdown } from "./sim/runner";
import {
  BALANCE_GATE_DEFAULT_SEEDS,
  BALANCE_SCENARIOS,
  balanceGateToJson,
  balanceGateToMarkdown,
  evaluateBalanceGate,
  type BalanceScenarioResult,
} from "./sim/balanceGate";
import { GRADE_ORDER, type DifficultyId, type Grade } from "./core/types";
import { enemyAtBoardPoint, unitAtBoardPoint, unitsInBoardBox } from "./board/boardHitTest";
import {
  MANUAL_PROOF_TARGET_SECONDS,
  manualProofFinishReadiness,
  manualProofReadyAt,
  manualProofRemainingSeconds,
  manualProofTargetFor,
} from "./core/manualProof";
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
  manualStartValidateSaveCommand,
  manualSummaryCommand,
  manualSummaryJsonCommand,
} from "./core/manualProofCommands";

const settings = loadSettings();
setLocale(settings.lang); // ??????UI ????????
const audio = new GameAudio(settings);

const boardUi: BoardUiState = {
  selectedUids: new Set<number>(),
  selectBox: null,
  attackMoveMode: false,
  autoStartIn: null,
  showLabels: settings.highContrast,
  showDamage: settings.showDamage,
};

/** ?ÍøîÍ∫Ç??????????"?ÍøîÍ∫Ç????????????´ÎîÜ???????????∞Ïä¶????? id??(???????´ÎîÜ????????? */
let craftableIds = new Set<string>();
function craftableSet(): Set<string> {
  return new Set(
    analyzeRecipes(game.state)
      .filter((st) => st.tier === "ok" && st.goldShort === 0)
      .map((st) => st.recipe.id),
  );
}
/** ???????????´ÎîÜ??????????∞Ïä¶?????????????????????? ???: edge????1??. */
function notifyNewlyCraftable() {
  const statuses = analyzeRecipes(game.state);
  const nowOk = new Set<string>();
  for (const st of statuses) {
    if (st.tier === "ok" && st.goldShort === 0) {
      nowOk.add(st.recipe.id);
      if (!craftableIds.has(st.recipe.id)) {
        audio.sfx("click");
        toast(`??? ???∞Ïä¶????? ???´ÎîÜ???? ${st.resultName}`, "ok", 2200);
      }
    }
  }
  craftableIds = nowOk;
}

let game = new Game(randomSeed(), "novice", 1); // ?????? ?????????????????????????????
let snapshotDirty = true;
let rightPanelCollapsed = false;
let lastPhase = game.state.phase;
let lastRound = game.state.round;
let lastSelectorCount = game.state.pendingSelectors.length;
let lastRelicChoiceCount = game.state.pendingRelicChoices.length;
let autosaveTimer: number | null = null;
let endedHandled = false;
let manualProofTimeReachedNotified = false;
let manualProofReadyNotified = false;
let dpsMeterVisible = false;

function resetDpsMeter() {
  dpsMeterVisible = false;
}

function toggleDpsMeter() {
  dpsMeterVisible = !dpsMeterVisible;
  ctx.refresh();
}

function markRunStarted() {
  ctx.runStartedAt = new Date().toISOString();
  ctx.runStartedAtMs = performance.now();
  ctx.runEndedAt = null;
  ctx.runEndedAtMs = null;
  manualProofTimeReachedNotified = false;
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

function currentInputCounts(): Record<string, number> {
  return game.state.inputHistory.reduce<Record<string, number>>((counts, input) => {
    counts[input.type] = (counts[input.type] ?? 0) + 1;
    return counts;
  }, {});
}

function maybeNotifyManualProofReady(now: number) {
  if (manualProofReadyNotified || ctx.scene !== "game" || game.state.phase === "ended") return;
  const proofSeconds = Math.max(0, Math.floor((now - ctx.runStartedAtMs) / 1000));
  if (proofSeconds < MANUAL_PROOF_TARGET_SECONDS) return;
  const readiness = manualProofFinishReadiness({
    elapsedSeconds: proofSeconds,
    inputCount: game.state.inputHistory.length,
    inputCounts: currentInputCounts(),
  });
  if (!readiness.ready) {
    if (!manualProofTimeReachedNotified) {
      manualProofTimeReachedNotified = true;
      toast(`Manual proof time reached: ${readiness.blockers.join(", ")}`, "warn", 5200);
      snapshotDirty = true;
    }
    return;
  }
  const target = manualProofTargetFor(game.state.difficulty, currentLegendOrBetterCount());
  manualProofReadyNotified = true;
  toast(`Manual proof save ready: ${target.status}`, target.state === "warn" ? "warn" : "ok", 5200);
  snapshotDirty = true;
}

function setRuntimeScene(scene: AppCtx["scene"]): void {
  ctx.scene = scene;
  ctx.refresh();
}

const ctx: AppCtx = {
  game,
  boardUi,
  audio,
  settings,
  scene: "title",
  paused: false,
  activeTab: "mission",
  saveStatus: "idle",
  runStartedAt: new Date().toISOString(),
  runStartedAtMs: performance.now(),
  runEndedAt: null,
  runEndedAtMs: null,
  lastRunUnlockedNext: false,
  refresh: () => { snapshotDirty = true; },
  newRun: (seed, difficulty, stageId = 1) => {
    const requestedStage = stageId;
    const allowedStage = playableStageId(requestedStage, 1);
    const resolvedSeed = typeof seed === "string" ? seed : String(seed ?? "");
    game = new Game(resolvedSeed || randomSeed(), difficulty, allowedStage);
    ctx.game = game;
    markRunStarted();
    game.onEvent = onGameEvent;
    boardUi.selectedUids.clear();
    resetDpsMeter();
    craftableIds = craftableSet();
    ctx.paused = false;
    ctx.lastRunUnlockedNext = false;
    resetResultShown();
    endedHandled = false;
    lastPhase = game.state.phase;
    lastRound = game.state.round;
    lastSelectorCount = game.state.pendingSelectors.length;
    lastRelicChoiceCount = game.state.pendingRelicChoices.length;
    if (settings.defaultSpeed !== 1) game.dispatch("setSpeed", { speed: settings.defaultSpeed });
    snapshotDirty = true;
    setRuntimeScene("game");
    audio.sfx("waveStart");
    const stage = stageById(game.state.stageId);
    const lockNote = allowedStage !== requestedStage ? " - stage adjusted" : "";
    toast(`New run: ${stage.id}. ${stage.name} - seed ${game.state.seed}${lockNote}`, "ok");
  },
  adoptGame: (g) => {
    game = g;
    ctx.game = game;
    markRunStarted();
    game.onEvent = onGameEvent;
    boardUi.selectedUids.clear();
    resetDpsMeter();
    craftableIds = craftableSet();
    ctx.paused = true;
    ctx.lastRunUnlockedNext = false;
    resetResultShown();
    endedHandled = game.state.phase === "ended";
    if (endedHandled) markRunEnded();
    lastPhase = game.state.phase;
    lastRound = game.state.round;
    lastSelectorCount = game.state.pendingSelectors.length;
    lastRelicChoiceCount = game.state.pendingRelicChoices.length;
    snapshotDirty = true;
    setRuntimeScene("game");
  },
  act: (type, payload) => {
    const res = game.dispatch(type as never, payload);
    if (res.ok) {
      playActionSfx(type);
    } else {
      audio.sfx("deny");
      if (res.reason) toast(res.reason, "warn");
    }
    snapshotDirty = true;
    return res.ok;
  },
  autosave: () => void doAutosave(),
  advanceWave: () => { ctx.act("startWave"); }, // ?????Íø∏Ïë®??????????????????ÍøîÍ∫Ç?ÔΩâÎúÆÔßíÎÖπÏ∂??????
  goTitle: () => {
    ctx.paused = true;
    setRuntimeScene("title");
    publishSnapshot();
  },
  continueAutosave: async () => {
    try {
      const rec = await loadSlot("autosave");
      if (!rec) { toast("No autosave found.", "warn"); return false; }
      if (rec.dataVersion !== game.state.dataVersion) {
        toast("Autosave data version does not match.", "warn", 4000);
        return false;
      }
      const replayed = replay(rec.seed, rec.difficulty, rec.stageId ?? 1, rec.inputHistory, rec.tick);
      if (stateChecksum(replayed.state) !== rec.stateChecksum) {
        toast("Autosave checksum mismatch.", "danger", 4000);
        return false;
      }
      ctx.adoptGame(replayed);
      ctx.paused = false;
      toast(`Autosave loaded from round ${rec.round}.`, "ok");
      return true;
    } catch {
      toast("Restore failed.", "danger");
      return false;
    }
  },
};

registerRuntimeControls({
  act: (type, payload) => {
    const ok = ctx.act(type, payload);
    publishSnapshot();
    return ok;
  },
  autosave: () => ctx.autosave(),
  togglePause: () => {
    ctx.paused = !ctx.paused;
    ctx.refresh();
    publishSnapshot();
  },
  clearSelection: () => {
    boardUi.selectedUids.clear();
    ctx.refresh();
    publishSnapshot();
  },
  confirmSell: (unitIds, refund) => {
    confirmModal("Confirm sell", `Sell ${unitIds.length} units for ${refund} gold.`, "Sell", () => {
      ctx.act("sell", { unitIds });
      boardUi.selectedUids.clear();
      publishSnapshot();
    }, true);
  },
  toggleDps: () => {
    toggleDpsMeter();
    publishSnapshot();
  },
  advanceWave: () => {
    ctx.advanceWave();
    publishSnapshot();
  },
  openUpgrade: () => {
    openReactOverlay({
      kind: "upgrade",
      actions: {
        buy: (upgradeId) => {
          const ok = ctx.act("upgrade", { upgradeId });
          publishSnapshot();
          return ok;
        },
      },
    });
  },
  openManualProofGuide: () => openManualProofGuideModal(ctx),
  openSelector: () => openSelectorModal(ctx),
  openRelicChoice: () => openRelicChoiceModal(ctx),
  setActiveTab: (tab) => {
    ctx.activeTab = tab;
    ctx.refresh();
    publishSnapshot();
  },
  menuCommand: (command) => {
    switch (command) {
      case "newRun":
        openNewRunModal(ctx);
        break;
      case "restartSeed":
        ctx.newRun(ctx.game.state.seed, ctx.game.state.difficulty, ctx.game.state.stageId);
        break;
      case "save":
        openSaveModal(ctx);
        break;
      case "load":
        openLoadModal(ctx);
        break;
      case "exportReport":
        void exportReport();
        break;
      case "toTitle":
        ctx.autosave();
        ctx.goTitle();
        break;
      case "quit":
        quitApp();
        break;
      case "toggleRightPanel":
        rightPanelCollapsed = !rightPanelCollapsed;
        break;
      case "fullscreen":
        void toggleFullscreen();
        break;
      case "sim100":
        openReactOverlay({
          kind: "simulation",
          actions: {
            run: async () => reportToMarkdown(runSimulation(100, ctx.game.state.difficulty, "balanced")),
            save: (content) => writeReport(`randi-sim-${Date.now()}.md`, content),
          },
        });
        break;
      case "balanceGate":
        openReactOverlay({
          kind: "balanceGate",
          actions: {
            run: (onProgress) => new Promise((resolve) => {
              const progress: string[] = [];
              const results: BalanceScenarioResult[] = [];
              const runNext = (index: number) => {
                if (index >= BALANCE_SCENARIOS.length) {
                  const result = evaluateBalanceGate(BALANCE_GATE_DEFAULT_SEEDS, results);
                  resolve({
                    markdown: balanceGateToMarkdown(result),
                    json: balanceGateToJson(result),
                  });
                  return;
                }
                const scenario = BALANCE_SCENARIOS[index];
                onProgress(`Running...\n${progress.join("\n")}\n${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label}`);
                window.setTimeout(() => {
                  const report = runSimulation(BALANCE_GATE_DEFAULT_SEEDS, scenario.difficulty, scenario.options);
                  results.push({ scenario, report });
                  progress.push(`${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label}: ${(report.clearRate * 100).toFixed(1)}% / ${report.avgReachedRound.toFixed(1)}R / ${report.avgLegendCount.toFixed(1)} legends`);
                  onProgress(`Running...\n${progress.join("\n")}`);
                  runNext(index + 1);
                }, 20);
              };
              runNext(0);
            }),
            saveMarkdown: (markdown) => writeReport(`randi-balance-${Date.now()}.md`, markdown),
            saveJson: (json) => writeReport(`randi-balance-${Date.now()}.json`, json),
          },
        });
        break;
      case "manualProof":
        openManualProofGuideModal(ctx);
        break;
      case "openDataDir":
        if (canOpenAppDataDir()) void openAppDataDir();
        break;
      case "shortcuts":
        openReactOverlay({ kind: "help" });
        break;
      case "collection":
        openCollection(ctx);
        break;
      case "options":
        openOptionsOverlay(ctx);
        break;
      case "about":
        openReactOverlay({
          kind: "about",
          version: APP_VERSION,
          dataVersion: DATA_VERSION,
          runtimeLabel: isTauri() ? "Tauri desktop" : "Browser localStorage",
          canOpenDataDir: canOpenAppDataDir(),
          actions: {
            openDataDir: () => {
              if (canOpenAppDataDir()) void openAppDataDir();
            },
          },
        });
        break;
    }
    publishSnapshot();
  },
  continueAutosave: () => ctx.continueAutosave(),
  boardPointerDown: handleBoardPointerDown,
  boardPointerMove: handleBoardPointerMove,
  boardPointerUp: handleBoardPointerUp,
  boardPointerCancel: cancelBoardPointer,
  handleGlobalKeyDown,
  unlockAudio,
  handleWindowBlur,
});

async function exportReport() {
  const summary = ctx.game.resultSummary();
  summary.playedAt = new Date().toISOString();
  summary.manualStartedAt = ctx.runStartedAt;
  summary.wallSeconds = Math.max(1, Math.round((performance.now() - ctx.runStartedAtMs) / 1000));
  try {
    const p = await writeReport(`randi-run-${summary.seed}-${Date.now()}.md`, buildReportMarkdown(summary));
    toast(t("toast.reportSaved", { path: p }), "ok", 4000);
  } catch {
    toast(t("toast.reportFailed"), "danger");
  }
}

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
    case "pickRelic": audio.sfx("mission"); break;
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
    if (text.includes("boss")) audio.sfx("bossDown");
    toast(text, "danger", 3200);
  }
  else if (kind === "system") toast(text, "ok");
  else if (kind === "craft") { audio.sfx("summonRare"); toast(text, "ok", 3200); }
  snapshotDirty = true;
}
game.onEvent = onGameEvent;

function publishSnapshot() {
  publishRuntimeSnapshot({
    scene: ctx.scene,
    paused: ctx.paused,
    saveStatus: ctx.saveStatus,
    enemyLimit: game.enemyLimit(),
    ownedUnitCount: game.ownedUnitCount(),
    unitCap: game.diff.unitCap,
    dpsVisible: dpsMeterVisible,
    rightPanelCollapsed,
    activeTab: ctx.activeTab,
    missionProgress: Object.fromEntries(
      game.state.missions.map((mission) => [mission.defId, game.missionProgress(mission.defId)]),
    ),
    state: game.state,
    selectedUids: boardUi.selectedUids,
    selectBox: boardUi.selectBox,
    attackMoveMode: boardUi.attackMoveMode,
    showLabels: boardUi.showLabels,
    showDamage: boardUi.showDamage,
  });
}

// ---------- ????????(phase ???????, ??????? ----------

async function doAutosave() {
  const s = game.state;
  if (s.phase === "ended") return;
  ctx.saveStatus = "saving";
  snapshotDirty = true;
  publishSnapshot();
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
    toast("???????? ?????????????????????????????", "danger");
  }
  snapshotDirty = true;
  publishSnapshot();
}

function scheduleAutosave() {
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => void doAutosave(), 400);
}

// ---------- ??•‚ñ≤Íµ???????∑Îß§????----------

let acc = 0;
let lastTime = performance.now();
let lastTopbarAt = 0;
let lastCastBorn = 0; // ??????¨Í≥£Î´ñÔßù?†ÎúèÔßêÔΩãÍ±????????????ôÍ∞≠?????high-water mark

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

    // ????????§Ïä¢??????? ??????????+ ?????????????àÏ∂£?
    if (game.state.round !== lastRound) {
      lastRound = game.state.round;
      snapshotDirty = true;
      scheduleAutosave();
      profileMarkSeen(game.state.units.map((u) => u.defId), game.state.discoveredRecipeIds);
    }

    // ????????????§Ïä¢???????§Ïä¢???????§Ïä¢???Ë≤´Á≥æ?????????????ÍøîÍ∫Ç??Ë¢Å„ÖªÎ∏???
    if (game.state.pendingSelectors.length > lastSelectorCount && !anyModalOpen()) {
      openSelectorModal(ctx);
    }
    lastSelectorCount = game.state.pendingSelectors.length;

    if (game.state.pendingRelicChoices.length > lastRelicChoiceCount && !anyModalOpen()) {
      openRelicChoiceModal(ctx);
    }
    lastRelicChoiceCount = game.state.pendingRelicChoices.length;

    if (game.state.phase !== lastPhase) { lastPhase = game.state.phase; snapshotDirty = true; }
    maybeNotifyManualProofReady(now);

    // ?????ªÏÉ¥???ÍøîÍ∫Ç??ÁØÄ?ñ„Åç??(1??
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
    }

    // ????????????????§„àá????????????(????breakTicks ???????Á∂?óà??
    boardUi.autoStartIn = game.state.breakTicks > 0 ? game.state.breakTicks * DT : null;
    publishSnapshot();

    // ??????¨Í≥£Î´ñÔßù?†ÎúèÔßêÔΩãÍ±???????(castFx???????? ???; born?? ??•‚ñ≤Íµ??????????????????)
    if (game.state.time + 0.001 < lastCastBorn) lastCastBorn = 0; // ???????ôÍ∞≠????
    let newestCast = lastCastBorn;
    for (const f of game.state.castFx) if (f.born > newestCast) newestCast = f.born;
    if (newestCast > lastCastBorn) {
      if (!ctx.paused) audio.sfx("skill");
      lastCastBorn = newestCast;
    }

    maybeShowResult(ctx);

    if (snapshotDirty) {
      snapshotDirty = false;
      notifyNewlyCraftable();
    } else if (game.state.phase === "wave" && now - lastTopbarAt > 250) {
      lastTopbarAt = now;
    }
  }
  lastTime = now;
  requestAnimationFrame(loop);
}

// ---------- ??????? RTS ???????(????Ë£??????????????¨Í≥£Î´ñÔßù?πÎµì????? ??????????????? ----------

const BOX_THRESHOLD = 6; // px (???? ??????????¨Í≥£Î´ñÔßù?πÎµì????????????´ÎîÜ???Ë´?Ä??
const groups: Record<string, number[]> = {}; // ????áÎÄ??? ?ÍøîÍ∫Ç?????(UI ???? ???ôÍ∞≠??????????Î∂∫Î™≠??Ë™ò‚ë∏???
let leftDown: { x: number; y: number } | null = null;
let boxing = false;

/** ????????????uid ??¨Í≥£Î´ñÔßù?ÂΩ±¬Ä??ñÎú¶?(????????ôÏ??? */
function selectedArr(): number[] {
  return [...boardUi.selectedUids].sort((a, b) => a - b);
}

/** ????????????ÍøîÍ∫Ç??ÔßåÎ™ÉÏ®??????????*/
function commandSelected(type: string, payload: Record<string, unknown>) {
  const ids = selectedArr();
  if (ids.length === 0) return;
  ctx.act(type, { unitIds: ids, ...payload });
}

function boardInputChanged() {
  snapshotDirty = true;
  publishSnapshot();
}

function handleBoardPointerDown(input: BoardPointerInput) {
  if (ctx.scene !== "game" || anyModalOpen()) return;

  if (input.button === 2) {
    boardUi.attackMoveMode = false;
    const eid = enemyAtBoardPoint(game.state, input.x, input.y);
    if (eid !== -1) commandSelected("cmdAttack", { targetEid: eid });
    else commandSelected("cmdMove", { x: input.x, y: input.y });
    boardInputChanged();
    return;
  }
  if (input.button !== 0) return;

  if (boardUi.attackMoveMode) {
    boardUi.attackMoveMode = false;
    commandSelected("cmdAttackMove", { x: input.x, y: input.y });
    boardInputChanged();
    return;
  }

  leftDown = { x: input.x, y: input.y };
  boxing = false;
}

function handleBoardPointerMove(input: BoardPointerInput) {
  if (!leftDown) return;
  if (!boxing && Math.hypot(input.x - leftDown.x, input.y - leftDown.y) > BOX_THRESHOLD) {
    boxing = true;
    boardUi.selectBox = { x0: leftDown.x, y0: leftDown.y, x1: leftDown.x, y1: leftDown.y };
  }
  if (boxing && boardUi.selectBox) {
    boardUi.selectBox.x1 = input.x;
    boardUi.selectBox.y1 = input.y;
  }
  boardInputChanged();
}

function handleBoardPointerUp(input: BoardPointerInput) {
  if (!leftDown) return;

  if (boxing && boardUi.selectBox) {
    const ids = unitsInBoardBox(game.state, boardUi.selectBox);
    boardUi.selectedUids = new Set(ids);
    audio.sfx("click");
  } else {
    const uid = unitAtBoardPoint(game.state, input.x, input.y);
    if (uid === -1) {
      boardUi.selectedUids.clear();
    } else if (input.ctrlKey || input.metaKey) {
      const clicked = game.state.units.find((u) => u.uid === uid);
      const ids = clicked
        ? game.state.units.filter((u) => u.defId === clicked.defId).map((u) => u.uid)
        : [uid];
      boardUi.selectedUids = new Set(ids);
      audio.sfx("click");
    } else {
      boardUi.selectedUids = new Set([uid]);
      audio.sfx("click");
    }
  }
  boardUi.selectBox = null;
  leftDown = null;
  boxing = false;
  boardInputChanged();
}

function cancelBoardPointer() {
  boardUi.selectBox = null;
  leftDown = null;
  boxing = false;
  boardInputChanged();
}

// ---------- ?????----------

function handleGlobalKeyDown(e: RuntimeKeyInput) {
  if (e.targetTagName === "INPUT") return;

  if (e.key === "Escape") {
    if (boardUi.attackMoveMode) { boardUi.attackMoveMode = false; return; }
    if (anyModalOpen()) { closeTopModal(); return; }
    if (ctx.scene === "game") { openPauseMenu(ctx); return; }
    return;
  }
  if (ctx.scene !== "game" || anyModalOpen()) return;

  const s = game.state;

  // ????áÎÄ??? ?ÍøîÍ∫Ç????? Ctrl+????????/ ????????
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      groups[e.key] = selectedArr();
      toast(`Group ${e.key} saved (${groups[e.key].length})`, "ok", 1200);
    } else {
      const alive = (groups[e.key] ?? []).filter((uid) => s.units.some((u) => u.uid === uid));
      groups[e.key] = alive; // ????????????
      boardUi.selectedUids = new Set(alive);
      audio.sfx("click");
      snapshotDirty = true;
    }
    return;
  }

  switch (e.key) {
    case " ": {
      e.preventDefault();
      if (s.breakTicks > 0) {
        // ?????????????????¨Í≥£Î´ñÔßù??Êø??????????????
        ctx.act("startWave");
      } else {
        ctx.paused = !ctx.paused; // ??????ÍøîÍ∫Ç????ÔßèÍæ©????????????? ????
        audio.sfx("click");
        snapshotDirty = true;
      }
      break;
    }
    // ----- RTS ?ÍøîÍ∫Ç??ÔßåÎ™ÉÏ®???-----
    case "a": case "A": // ???????????ÍøîÍ∫Ç??Ë¢Å„ÖªÎ∏???(????????Ë£????? ?ÍøîÍ∫Ç??Ë¢Å„ÖªÎ∏??∑Î????ÍøîÍ∫Ç?????
      if (boardUi.selectedUids.size > 0) { boardUi.attackMoveMode = true; audio.sfx("click"); }
      break;
    case "s": case "S": // ????(Hold)
      commandSelected("cmdStop", {});
      break;
    // ----- ??•‚ñ≤Íµ????????(RTS ??????¨Í≥£Î´ñÔßù????????¨Í≥£Î´ñÔßù?????? -----
    case "z": case "Z": ctx.act("summon"); break; // ????
    case "x": case "X": {                          // 3????
      const sel = [...boardUi.selectedUids];
      if (sel.length === 3) { ctx.act("merge3", { unitIds: sel }); boardUi.selectedUids.clear(); }
      else toast("Select three same-grade units.", "warn");
      break;
    }
    case "Delete": case "Backspace": {             // ????(???????´ÎîÜ????
      const sel = [...boardUi.selectedUids];
      if (sel.length === 0) { toast("Select units to sell.", "warn"); break; }
      confirmModal("Confirm sell", `Sell ${sel.length} units?`, "Sell", () => {
        ctx.act("sell", { unitIds: sel });
        boardUi.selectedUids.clear();
      }, true);
      break;
    }
    case "q": case "Q": ctx.act("setSpeed", { speed: 1 }); break;
    case "w": case "W": ctx.act("setSpeed", { speed: 2 }); break;
    case "e": case "E": ctx.act("setSpeed", { speed: 3 }); break;
    case "l": case "L":
      for (const uid of boardUi.selectedUids) ctx.act("toggleLock", { unitId: uid });
      break;
    case "v": case "V": // DPS ???Î∂∫Î™≠?Í≤πÎü∑Á≠åÎ°™??çÆ?????
      toggleDpsMeter();
      publishSnapshot();
      audio.sfx("click");
      break;
  }
}

// ---------- ?????unlock (????•¬Ä?´Ï∏•????? ???? ??????????? ----------

function unlockAudio() {
  audio.unlock();
}

// ---------- ????????????????????? ----------

function handleWindowBlur() {
  if (settings.autoPause && ctx.scene === "game" && game.state.phase === "wave" && !ctx.paused) {
    ctx.paused = true;
    snapshotDirty = true;
    toast("Window inactive; paused.", "info" as never);
  }
}

// ---------- ????áÎÄ???----------

// ???????§Ïä¢???????ÍøîÍ∫Ç????????????????????ÍøîÍ∫Ç?ÔΩâÎúÆÔßíÎÖπÏ∂??????????æÏªØÔ¶???
onLocaleChange(() => {
  publishSnapshot();
  snapshotDirty = true;
  if (ctx.scene === "title") setRuntimeScene("title");
});

setRuntimeScene("title");
publishSnapshot();
requestAnimationFrame(loop);

function renderGameToText(): string {
  const s = game.state;
  const stage = stageById(s.stageId);
  const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
  const manualProofSeconds = Math.max(0, Math.floor((performance.now() - ctx.runStartedAtMs) / 1000));
  const manualProofRemaining = manualProofRemainingSeconds(manualProofSeconds);
  const manualProofTargetReadyAt = ctx.scene === "game" ? manualProofReadyAt(ctx.runStartedAt) : null;
  const inputCounts = currentInputCounts();
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
  let manualCurrentFinishReadiness: ReturnType<typeof manualProofFinishReadiness> | null = null;
  const manualProofCommands = ctx.scene === "game"
    ? {
        start: manualStartCommand,
        startDryRun: manualDryRunCommand(manualStartCommand),
        startValidateSave: manualStartValidateSaveCommand(manualStartCommand, manualPendingIdCommand),
        startNext: manualStartNextCommand,
        startNextDryRun: manualDryRunCommand(manualStartNextCommand),
        startNextValidateSave: manualStartValidateSaveCommand(manualStartNextCommand, manualPendingIdCommand),
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
    manualCurrentFinishReadiness = manualProofFinishReadiness({
      elapsedSeconds: currentSummary.wallSeconds ?? 0,
      inputCount: currentSummary.inputCount,
      inputCounts: currentSummary.inputCounts,
    });
    manualProofCommands.currentFinishDryRun = manualPlaylogFinishDryRunCommand(currentSummary);
    manualProofCommands.currentFinishLatestDryRun = manualPlaylogFinishLatestDryRunCommand(currentSummary);
    if (manualCurrentFinishReadiness.ready) {
      manualProofCommands.currentFinish = manualPlaylogFinishCommand(currentSummary);
      manualProofCommands.currentFinishLatest = manualPlaylogFinishLatestCommand(currentSummary);
    }
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
    inputCount: s.inputHistory.length,
    inputCounts,
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
      targetMet: manualCurrentFinishReadiness?.ready ?? manualProofRemaining === 0,
      targetLabel: manualProofTarget.label,
      conditionStatus: manualProofTarget.status,
      conditionState: manualProofTarget.state,
      resultTarget: manualResultTarget,
      resultChecks: manualResultChecks,
      resultPassed: manualResultPassed,
      currentFinishReadiness: manualCurrentFinishReadiness,
      timeReachedNotified: manualProofTimeReachedNotified,
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
            inputCount: s.inputHistory.length,
            inputCounts,
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
    selected: [...boardUi.selectedUids].sort((a, b) => a - b),
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
  boardUi.autoStartIn = game.state.breakTicks > 0 ? game.state.breakTicks * DT : null;
  publishSnapshot();
  maybeNotifyManualProofReady(performance.now());
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
        publishSnapshot();
      },
      act: (type: string, payload?: Record<string, unknown>) => ctx.act(type, payload),
      clearOverlays: () => clearReactOverlays(),
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
