// 선택권 / 결과 / 새 게임 / 저장 슬롯 / 시뮬레이션 모달

import type { AppCtx } from "./ctx";
import { el, openModal, toast } from "./widgets";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, type DifficultyId, type ResultSummary } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { DIFFICULTIES } from "../data/difficulty";
import { STAGES, stageById } from "../data/stages";
import { DATA_VERSION } from "../data/version";
import { randomSeed } from "../core/rng";
import { stateChecksum } from "../core/checksum";
import {
  deleteSlot, listSlots, loadSlot, makeSaveRecord, recordResult,
  saveSlot, writeReport, isTauri, openAppDataDir, type SlotMeta,
} from "../save/saveApi";
import { replay } from "../core/engine";
import { runSimulation, reportToMarkdown } from "../sim/runner";
import {
  BALANCE_GATE_DEFAULT_SEEDS,
  BALANCE_SCENARIOS,
  balanceGateToJson,
  balanceGateToMarkdown,
  evaluateBalanceGate,
  type BalanceGateResult,
  type BalanceScenarioResult,
} from "../sim/balanceGate";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";
import { initialNewRunStageId, loadProfile, maxSelectableStageId } from "./settings";
import { FINAL_ROUND } from "../data/waves";
import { manualProofTargetFor, type ManualProofTargetStatus } from "../core/manualProof";
import { manualProofResultChecklist, manualProofResultLogNote, manualProofResultTarget } from "../core/manualProofResult";
import {
  manualStartCommand as buildManualStartCommand,
  manualDryRunCommand,
  manualPendingIdCommand as buildManualPendingIdCommand,
  manualStartId,
  manualStartNextCommand as buildManualStartNextCommand,
  shellArg,
} from "../core/manualProofCommands";

// ---------- 선택권 ----------

let selectorOpen = false;

export function openSelectorModal(ctx: AppCtx) {
  const s = ctx.game.state;
  if (selectorOpen || s.pendingSelectors.length === 0) return;
  if (s.phase === "ended") return; // 게임은 항상 "wave"로 진행 — 종료 시에만 차단
  selectorOpen = true;
  ctx.audio.sfx("selector");
  const sel = s.pendingSelectors[0];

  openModal((body, close) => {
    body.appendChild(el("h2", "", `🎁 ${GRADE_LABEL[sel.grade]} 선택권`));
    body.appendChild(el("h3", "", `출처: ${sel.source} — 1기를 선택하세요`));
    const grid = el("div", "choice-grid");
    for (const id of sel.candidateIds) {
      const d = UNIT_BY_ID[id];
      const btn = el("button", "choice-btn");
      const shape = el("span");
      shape.style.cssText = `width:26px;height:26px;background:${FAMILY_COLOR[d.family]};border:3px solid ${GRADE_COLOR[d.grade]};border-radius:6px;display:inline-block`;
      btn.appendChild(shape);
      btn.appendChild(el("span", "cname", d.name));
      btn.appendChild(el("span", "cdesc",
        `${FAMILY_LABEL[d.family]} · ${d.roles.map((r) => ROLE_LABEL[r]).join("/")}\n공격 ${d.attack} · 속도 ${d.attackSpeed}`));
      if (d.desc) btn.appendChild(el("span", "cdesc", d.desc));
      btn.onclick = () => {
        const res = ctx.act("pickSelector", { selectorId: sel.id, unitId: id });
        selectorOpen = false;
        close();
        if (res && ctx.game.state.pendingSelectors.length > 0) {
          openSelectorModal(ctx);
        }
      };
      grid.appendChild(btn);
    }
    body.appendChild(grid);
    const row = el("div", "row-btns");
    const later = el("button", "", "나중에 선택");
    later.onclick = () => { selectorOpen = false; close(); };
    row.appendChild(later);
    body.appendChild(row);
  }, false);
}

// ---------- 결과 ----------

function legendOrBetterCount(ctx: AppCtx): number {
  return ctx.game.state.units.filter((unit) => {
    const grade = UNIT_BY_ID[unit.defId].grade;
    return grade === "legend" || grade === "hidden";
  }).length;
}

function manualStartCommand(ctx: AppCtx): string {
  const s = ctx.game.state;
  const target = manualProofTargetFor(s.difficulty, legendOrBetterCount(ctx));
  return buildManualStartCommand({
    difficultyId: s.difficulty,
    stageId: s.stageId,
    seed: s.seed,
    startedAt: ctx.runStartedAt,
    notes: target.label,
  });
}

function manualPendingIdCommand(ctx: AppCtx): string {
  const s = ctx.game.state;
  const target = manualProofTargetFor(s.difficulty, legendOrBetterCount(ctx));
  return buildManualPendingIdCommand({
    difficultyId: s.difficulty,
    stageId: s.stageId,
    seed: s.seed,
    startedAt: ctx.runStartedAt,
    notes: target.label,
  });
}

function manualStartNextCommand(ctx: AppCtx): string {
  const s = ctx.game.state;
  return buildManualStartNextCommand({
    difficultyId: s.difficulty,
    stageId: s.stageId,
    seed: s.seed,
    startedAt: ctx.runStartedAt,
  });
}

function currentRunManualProofNote(target: ManualProofTargetStatus): string {
  if (target.state === "ok") {
    return "현재 보유 조건은 목표에 맞습니다. 12분 이상 실제 플레이 후 결과 화면의 기록 명령으로 저장하세요.";
  }
  if (target.state === "warn") {
    return "현재 보유 조건은 이 목표 증거로 인정되기 어렵습니다. 결과는 실제 플레이 시간으로 남길 수 있지만 목표 세션은 다시 필요할 수 있습니다.";
  }
  return "아직 목표 결과까지 확인해야 합니다. 12분 이상 플레이한 뒤 결과 화면 체크리스트에서 최종 충족 여부를 확인하세요.";
}

export function manualPlaylogCommand(r: ResultSummary): string {
  const seconds = Math.max(1, Math.round(r.wallSeconds ?? 0));
  const result = r.cleared ? "clear" : "loss";
  const args = [
    "yarn manual-playlog",
    `--difficulty=${r.difficultyId}`,
    `--seconds=${seconds}`,
    `--result=${result}`,
    `--stage=${r.stageId}`,
    `--round=${r.reachedRound}`,
    `--seed=${shellArg(r.seed)}`,
    `--legends=${r.legendOrBetterCount}`,
    `--maxGrade=${r.maxGrade}`,
    `--dataVersion=${shellArg(r.dataVersion)}`,
    `--stateChecksum=${shellArg(r.stateChecksum)}`,
  ];
  if (r.manualStartedAt) args.push(`--startedAt=${shellArg(r.manualStartedAt)}`);
  if (r.playedAt) args.push(`--endedAt=${shellArg(r.playedAt)}`);
  args.push(`--notes=${shellArg(manualProofResultLogNote(r))}`);
  return args.join(" ");
}

export function manualPlaylogDryRunCommand(r: ResultSummary): string {
  return manualDryRunCommand(manualPlaylogCommand(r));
}

export function manualPlaylogFinishCommand(r: ResultSummary): string {
  const startedAt = r.manualStartedAt ?? r.playedAt;
  const id = manualStartId(r.difficultyId, r.stageId, r.seed, startedAt);
  const result = r.cleared ? "clear" : "loss";
  const args = [
    "yarn manual-playlog",
    `--finish=${shellArg(id)}`,
    `--result=${result}`,
    `--round=${r.reachedRound}`,
    `--legends=${r.legendOrBetterCount}`,
    `--maxGrade=${r.maxGrade}`,
    `--dataVersion=${shellArg(r.dataVersion)}`,
    `--stateChecksum=${shellArg(r.stateChecksum)}`,
  ];
  if (r.playedAt) args.push(`--endedAt=${shellArg(r.playedAt)}`);
  args.push(`--notes=${shellArg(manualProofResultLogNote(r))}`);
  return args.join(" ");
}

export function manualPlaylogFinishDryRunCommand(r: ResultSummary): string {
  return manualDryRunCommand(manualPlaylogFinishCommand(r));
}

export function manualPlaylogFinishLatestCommand(r: ResultSummary): string {
  const result = r.cleared ? "clear" : "loss";
  const args = [
    "yarn manual-playlog",
    "--finish-latest",
    `--result=${result}`,
    `--round=${r.reachedRound}`,
    `--legends=${r.legendOrBetterCount}`,
    `--maxGrade=${r.maxGrade}`,
    `--dataVersion=${shellArg(r.dataVersion)}`,
    `--stateChecksum=${shellArg(r.stateChecksum)}`,
  ];
  if (r.playedAt) args.push(`--endedAt=${shellArg(r.playedAt)}`);
  args.push(`--notes=${shellArg(manualProofResultLogNote(r))}`);
  return args.join(" ");
}

export function manualPlaylogFinishLatestDryRunCommand(r: ResultSummary): string {
  return manualDryRunCommand(manualPlaylogFinishLatestCommand(r));
}

export function manualPlaylogThenNextCommand(r: ResultSummary): string {
  return `${manualPlaylogCommand(r)} && yarn manual-playlog --next`;
}

export function manualPlaylogFinishLatestThenNextCommand(r: ResultSummary): string {
  return `${manualPlaylogFinishLatestCommand(r)} && yarn manual-playlog --next`;
}

function mapPermissionMessage(r: ResultSummary): string {
  const finalBossCleared = r.cleared &&
    r.reachedRound >= FINAL_ROUND &&
    r.bossKills.some((boss) => boss.round === FINAL_ROUND);
  if (r.unlockedNextStage && r.stageId < STAGES.length) {
    const next = stageById(r.stageId + 1);
    return `이번 판은 선택한 맵에서 종료됩니다. 맵은 자동으로 바뀌지 않고, 다음 새 게임에서 ${next.id}. ${next.name} 맵을 고를 수 있는 권한만 추가됩니다.`;
  }
  if (finalBossCleared && r.stageId >= STAGES.length) {
    return "최종 맵 40R 보스를 클리어했습니다. 더 추가될 맵 선택 권한은 없습니다.";
  }
  if (finalBossCleared) {
    return "이미 선택 권한이 있던 맵입니다. 다음 맵 권한은 현재 최전선 맵을 새 게임에서 골라 40R 보스를 클리어해야 열립니다.";
  }
  return `이 판에서는 맵이 바뀌지 않습니다. 다음 맵 선택 권한은 ${FINAL_ROUND}R 최종 보스 클리어 후 다음 새 게임에만 적용됩니다.`;
}

export function buildReportMarkdown(r: ResultSummary): string {
  const proofTarget = manualProofResultTarget(r);
  const proofChecks = manualProofResultChecklist(r);
  const lines = [
    `# 차원 균열 랜덤 디펜스 결과`,
    ``,
    `- 결과: ${r.cleared ? "클리어" : "패배"}`,
    `- 맵: ${r.stageId}. ${r.stageName}`,
    `- 맵 진행 방식: 새 게임 시작 때 고른 맵으로 1~40R 최종 보스까지 고정`,
    `- 선택 가능 맵: ${mapPermissionMessage(r)}`,
    `- 도달 라운드: ${r.reachedRound}`,
    `- 시드: \`${r.seed}\` / 난이도: ${r.difficulty} / 데이터 버전: ${r.dataVersion}`,
    `- 상태 체크섬: \`${r.stateChecksum}\``,
    `- 남은 라이프: ${r.life}`,
    `- 최고 등급: ${GRADE_LABEL[r.maxGrade]}`,
    `- 전설/히든: ${r.legendCount}/${r.hiddenCount}`,
    `- 미션: ${r.missionsDone}/${r.missionsTotal}`,
    `- 조합 ${r.craftCount}회 · 3합성 ${r.merge3Count}회 · 보정 발동 ${r.pityTriggered}회`,
    ...(r.wallSeconds ? [`- 실제 플레이 시간: ${(r.wallSeconds / 60).toFixed(1)}분`] : []),
    ...(r.wallSeconds ? [`- 수동 증거 판정: ${proofTarget}`] : []),
    ``,
    `## 수동 증거 체크리스트`,
    ``,
    ...proofChecks.map((check) => `- ${check.ok ? "충족" : "부족"}: ${check.label} (${check.detail})`),
    ``,
    `## 주요 딜러`,
    ``,
    ...r.topDealers.map((d, i) => `${i + 1}. ${d.name} (${GRADE_LABEL[d.grade]}) — 누적 피해 ${d.damage.toLocaleString()}`),
    ``,
    `## 보스`,
    ``,
    ...(r.bossKills.length > 0
      ? r.bossKills.map((b) => `- ${b.round}R 처치 (${b.seconds}초)`)
      : ["- 처치 기록 없음"]),
    ...(r.bossFails.length > 0 ? r.bossFails.map((b) => `- ${b}R 실패`) : []),
  ];
  if (r.failHint) {
    lines.push("", "## 개선 힌트", "", `- ${r.failHint}`);
  }
  if (r.wallSeconds) {
    lines.push(
      "",
      "## 수동 플레이 로그",
      "",
      `- 판정: ${proofTarget}`,
      "",
      "## 저장 전 검증",
      "",
      "```bash",
      manualPlaylogDryRunCommand(r),
      "```",
      "",
      "## 실제 저장",
      "",
      "```bash",
      manualPlaylogCommand(r),
      "```",
      "",
      "## 기록 후 다음 확인",
      "",
      "```bash",
      manualPlaylogThenNextCommand(r),
      "```",
      "",
      "## 시작 마커 저장 전 검증",
      "",
      "```bash",
      manualPlaylogFinishDryRunCommand(r),
      "```",
      "",
      "## 시작 마커로 기록",
      "",
      "```bash",
      manualPlaylogFinishCommand(r),
      "```",
      "",
      "## 최근 시작 마커 저장 전 검증",
      "",
      "```bash",
      manualPlaylogFinishLatestDryRunCommand(r),
      "```",
      "",
      "## 가장 최근 시작 마커로 기록",
      "",
      "```bash",
      manualPlaylogFinishLatestCommand(r),
      "```",
      "",
      "## 최근 시작 마커 기록 후 다음 확인",
      "",
      "```bash",
      manualPlaylogFinishLatestThenNextCommand(r),
      "```",
    );
  }
  lines.push("", `played at ${r.playedAt}`);
  return lines.join("\n");
}

let resultShown = false;

export function maybeShowResult(ctx: AppCtx) {
  const s = ctx.game.state;
  if (s.phase !== "ended" || resultShown) return;
  resultShown = true;

  const summary = ctx.game.resultSummary();
  summary.playedAt = ctx.runEndedAt ?? new Date().toISOString();
  summary.manualStartedAt = ctx.runStartedAt;
  summary.unlockedNextStage = ctx.lastRunUnlockedNext;
  const endedAtMs = ctx.runEndedAtMs ?? performance.now();
  const wallSeconds = Math.max(1, Math.round((endedAtMs - ctx.runStartedAtMs) / 1000));
  summary.wallSeconds = wallSeconds;
  ctx.audio.sfx(summary.cleared ? "victory" : "defeat");
  void recordResult(summary).catch(() => toast("결과 저장 실패", "danger"));

  openModal((body, close) => {
    const proofTarget = manualProofResultTarget(summary);
    const proofChecks = manualProofResultChecklist(summary);
    const proofPassed = proofChecks.every((check) => check.ok);
    body.appendChild(el("h2", "", summary.cleared ? `선택한 맵 40라운드 보스 클리어!` : `${summary.reachedRound}라운드에서 패배`));
    body.appendChild(el(
      "div",
      proofPassed ? "result-proof-ok" : "result-hint",
      proofPassed
        ? `수동 목표 증거 충족: ${proofTarget}. 아래 로그 명령으로 저장하세요.`
        : `수동 목표 증거 미충족: ${proofTarget}. 아래 체크리스트의 부족 항목을 확인하세요.`,
    ));

    const grid = el("div", "result-stats");
    const kv = (k: string, v: string) => {
      grid.appendChild(el("span", "k", k));
      grid.appendChild(el("span", "", v));
    };
    kv("시드", summary.seed);
    kv("맵", `${summary.stageId}. ${summary.stageName}`);
    kv("맵 진행", "새 게임에서 고른 맵으로 1~40R 보스까지 고정");
    kv("맵 권한", mapPermissionMessage(summary));
    kv("난이도", summary.difficulty);
    kv("최고 등급", GRADE_LABEL[summary.maxGrade]);
    kv("전설/히든", `${summary.legendCount} / ${summary.hiddenCount}`);
    kv("실제 플레이", `${(wallSeconds / 60).toFixed(1)}분`);
    kv("수동 증거", proofTarget);
    kv("미션", `${summary.missionsDone}/${summary.missionsTotal}`);
    kv("조합/3합성", `${summary.craftCount} / ${summary.merge3Count}`);
    kv("보정 발동", `${summary.pityTriggered}회`);
    body.appendChild(grid);

    if (summary.topDealers.length > 0) {
      body.appendChild(el("h3", "", "주요 딜러"));
      const table = el("table", "kv-table");
      for (const d of summary.topDealers) {
        const tr = el("tr");
        tr.appendChild(el("td", "", `${d.name} (${GRADE_LABEL[d.grade]})`));
        tr.appendChild(el("td", "", d.damage.toLocaleString()));
        table.appendChild(tr);
      }
      body.appendChild(table);
    }

    body.appendChild(el("h3", "", "수동 증거 체크리스트"));
    const proofTable = el("table", "kv-table");
    for (const check of proofChecks) {
      const tr = el("tr");
      tr.appendChild(el("td", "", check.ok ? "충족" : "부족"));
      tr.appendChild(el("td", "", check.label));
      tr.appendChild(el("td", "", check.detail));
      proofTable.appendChild(tr);
    }
    body.appendChild(proofTable);

    if (summary.failHint) {
      body.appendChild(el("div", "result-hint", `💡 ${summary.failHint}`));
    }

    const row = el("div", "row-btns");
    const manualCommand = manualPlaylogCommand(summary);
    const manualDryRunSaveCommand = manualPlaylogDryRunCommand(summary);
    const manualFinishCommand = manualPlaylogFinishCommand(summary);
    const manualFinishDryRunCommand = manualPlaylogFinishDryRunCommand(summary);
    const manualFinishLatestCommand = manualPlaylogFinishLatestCommand(summary);
    const manualFinishLatestDryRunCommand = manualPlaylogFinishLatestDryRunCommand(summary);
    const manualThenNextCommand = manualPlaylogThenNextCommand(summary);
    const manualFinishLatestThenNextCommand = manualPlaylogFinishLatestThenNextCommand(summary);

    body.appendChild(el("h3", "", "수동 플레이 로그"));
    body.appendChild(el("h3", "", "저장 전 검증"));
    body.appendChild(el("pre", "report", manualDryRunSaveCommand));
    body.appendChild(el("h3", "", "실제 저장"));
    body.appendChild(el("pre", "report", manualCommand));
    body.appendChild(el("h3", "", "기록 후 다음 확인"));
    body.appendChild(el("pre", "report", manualThenNextCommand));
    body.appendChild(el("h3", "", "시작 마커 저장 전 검증"));
    body.appendChild(el("pre", "report", manualFinishDryRunCommand));
    body.appendChild(el("h3", "", "시작 마커로 기록"));
    body.appendChild(el("pre", "report", manualFinishCommand));
    body.appendChild(el("h3", "", "최근 시작 마커 저장 전 검증"));
    body.appendChild(el("pre", "report", manualFinishLatestDryRunCommand));
    body.appendChild(el("h3", "", "가장 최근 시작 마커로 기록"));
    body.appendChild(el("pre", "report", manualFinishLatestCommand));
    body.appendChild(el("h3", "", "최근 시작 마커 기록 후 다음 확인"));
    body.appendChild(el("pre", "report", manualFinishLatestThenNextCommand));

    const exportBtn = el("button", "", "리포트 내보내기 (.md)");
    exportBtn.onclick = async () => {
      try {
        const path = await writeReport(
          `randi-result-${summary.seed}-${Date.now()}.md`,
          buildReportMarkdown(summary),
        );
        toast(`리포트 저장: ${path}`, "ok", 4000);
      } catch {
        toast("리포트 저장 실패", "danger");
      }
    };
    row.appendChild(exportBtn);

    const copyDryRun = el("button", "", "검증 명령 복사");
    copyDryRun.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualDryRunSaveCommand);
        toast("저장 전 dry-run 검증 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyDryRun);

    const copyLog = el("button", "", "로그 명령 복사");
    copyLog.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualCommand);
        toast("수동 플레이 로그 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyLog);

    const copyLogNext = el("button", "", "기록+다음 복사");
    copyLogNext.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualThenNextCommand);
        toast("기록 후 다음 세션 확인 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyLogNext);

    const copyFinish = el("button", "", "마커기록 복사");
    copyFinish.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualFinishCommand);
        toast("시작 마커 기반 기록 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyFinish);

    const copyFinishLatest = el("button", "", "최근마커 기록 복사");
    copyFinishLatest.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualFinishLatestCommand);
        toast("가장 최근 시작 마커 기록 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyFinishLatest);

    const copyFinishLatestNext = el("button", "", "최근기록+다음 복사");
    copyFinishLatestNext.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualFinishLatestThenNextCommand);
        toast("최근 시작 마커 기록 후 다음 확인 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyFinishLatestNext);

    const titleBtn = el("button", "", "타이틀로");
    titleBtn.onclick = () => { resetResultShown(); close(); ctx.goTitle(); };
    row.appendChild(titleBtn);

    const sameSeed = el("button", "", "같은 시드 재시작");
    sameSeed.onclick = () => { resultShown = false; close(); ctx.newRun(summary.seed, ctx.game.state.difficulty, ctx.game.state.stageId); };
    row.appendChild(sameSeed);

    const newBtn = el("button", "primary", "새 게임");
    newBtn.onclick = () => { close(); openNewRunModal(ctx); };
    row.appendChild(newBtn);

    body.appendChild(row);
  }, false);
}

export function resetResultShown() { resultShown = false; }

// ---------- 새 게임 ----------

const MANUAL_BALANCE_TARGETS: Array<{
  difficultyId: DifficultyId;
  difficulty: string;
  target: string;
  length: string;
}> = [
  { difficultyId: "novice", difficulty: "입문자", target: "무전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "normal", difficulty: "일반", target: "1~2전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "intermediate", difficulty: "중급자", target: "5전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "5전설 이하 40R 실패", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "6전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "master", difficulty: "초고수", target: "실패 기록", length: "12분 이상" },
];

const MANUAL_START_WORKFLOW = [
  "다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인",
  "시작 검증 명령의 GAME_SEED_HERE를 실제 시드로 바꿔 --dry-run 실행",
  "검증이 통과하면 같은 명령에서 --dry-run을 빼고 시작 마커 저장",
  "12분 이상 실제로 플레이하고 목표 결과 조건 확인",
  "결과 화면의 dataVersion/stateChecksum/endedAt 값으로 finish --dry-run 실행 후 실제 finish 저장",
];

function manualTargetHint(difficultyId: DifficultyId): string {
  return MANUAL_BALANCE_TARGETS
    .filter((target) => target.difficultyId === difficultyId)
    .map((target) => target.target)
    .join(" / ");
}

export function openNewRunModal(ctx: AppCtx, dismissable = true) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "새 게임"));

    const profile = loadProfile();
    const unlockedStage = maxSelectableStageId(profile.unlockedStage);
    body.appendChild(el("h3", "", "난이도"));
    let chosen: DifficultyId = "novice";
    let chosenStage = initialNewRunStageId(ctx.game.state.stageId, unlockedStage);
    const diffRow = el("div", "choice-grid difficulty-choice-grid");
    const diffBtns: HTMLButtonElement[] = [];
    for (const d of DIFFICULTIES) {
      const b = el("button", "choice-btn") as HTMLButtonElement;
      b.appendChild(el("span", "cname", d.name));
      b.appendChild(el("span", "cdesc", `수동 목표: ${manualTargetHint(d.id)}`));
      b.appendChild(el("span", "cdesc", `보유 ${d.unitCap}기 · 적 체력 x${d.enemyHpMult} · 누적 ${d.enemyLimit} · 시작 ${d.startGold}골드`));
      if (d.id === chosen) b.style.borderColor = "var(--accent)";
      b.onclick = () => {
        chosen = d.id;
        diffBtns.forEach((x) => (x.style.borderColor = "var(--line)"));
        b.style.borderColor = "var(--accent)";
      };
      diffBtns.push(b);
      diffRow.appendChild(b);
    }
    body.appendChild(diffRow);

    body.appendChild(el("h3", "", "이번 판 맵 선택"));
    body.appendChild(el("div", "modal-note map-rule-note", `맵 선택권: 1~${unlockedStage}번 맵. 새 게임을 시작할 때 이번 판의 맵을 직접 고르고, 그 맵에서 1R부터 40R 최종 보스까지 진행합니다. 40R 보스 클리어는 다음 맵을 자동 시작하거나 현재 판 맵을 바꾸지 않고, 다음 새 게임에서 고를 수 있는 권한만 하나 추가합니다.`));
    const stageRow = el("div", "choice-grid stage-choice-grid");
    const stageBtns: HTMLButtonElement[] = [];
    for (const stage of STAGES) {
      const b = el("button", "choice-btn stage-choice") as HTMLButtonElement;
      b.appendChild(el("span", "cname", `${stage.id}. ${stage.name}`));
      b.appendChild(el("span", "cdesc", `${stage.subtitle} · 시작하면 40R 보스까지 이 맵 고정`));
      b.disabled = stage.id > unlockedStage;
      if (b.disabled) b.appendChild(el("span", "cdesc", `권한 없음: ${stage.id - 1}번 맵을 새 게임에서 골라 40R 보스 클리어 후 선택 가능`));
      if (stage.id === chosenStage) b.style.borderColor = "var(--accent)";
      b.onclick = () => {
        chosenStage = stage.id;
        stageBtns.forEach((x) => (x.style.borderColor = "var(--line)"));
        b.style.borderColor = "var(--accent)";
      };
      stageBtns.push(b);
      stageRow.appendChild(b);
    }
    body.appendChild(stageRow);

    const row = el("div", "row-btns");
    if (dismissable) {
      const cancel = el("button", "", "취소");
      cancel.onclick = close;
      row.appendChild(cancel);
    }
    const start = el("button", "primary", "시작");
    start.onclick = () => {
      const seed = randomSeed(); // 시드는 내부 RNG/재현성용으로 항상 무작위 생성
      close();
      resetResultShown();
      ctx.newRun(seed, chosen, chosenStage);
    };
    row.appendChild(start);
    body.appendChild(row);
  }, dismissable);
}

// ---------- 수동 밸런스 증거 ----------

export function openManualProofGuideModal(ctx?: AppCtx) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "수동 밸런스 증거"));
    body.appendChild(el("div", "modal-note", "결과 화면의 로그 명령을 실행한 뒤, 아래 요약 명령으로 남은 증거를 확인합니다."));

    const dataVersion = ctx?.game.state.dataVersion ?? DATA_VERSION;
    const currentStartCommand = ctx?.scene === "game" ? manualStartCommand(ctx) : "";
    const currentStartNextCommand = ctx?.scene === "game" ? manualStartNextCommand(ctx) : "";
    const currentPendingIdCommand = ctx?.scene === "game" ? manualPendingIdCommand(ctx) : "";
    const currentPendingIdJsonCommand = currentPendingIdCommand ? `${currentPendingIdCommand} --json` : "";
    const currentStartDryRunCommand = currentStartCommand ? manualDryRunCommand(currentStartCommand) : "";
    const currentStartNextDryRunCommand = currentStartNextCommand ? manualDryRunCommand(currentStartNextCommand) : "";
    const summaryCommand = "yarn manual-playlog --summary";
    const planCommand = "yarn manual-playlog --plan";
    const nextCommand = "yarn manual-playlog --next";
    const startNextCommand = currentStartNextCommand || "yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE";
    const startNextDryRunCommand = manualDryRunCommand(startNextCommand);
    const pendingCommand = "yarn manual-playlog --pending";
    const preflightCommand = "yarn manual-playlog --preflight";
    const preflightJsonCommand = "yarn --silent manual-playlog --preflight-json";
    const summaryJsonCommand = "yarn --silent manual-playlog --summary-json";
    const primaryStartCheckCommand = currentStartNextDryRunCommand || preflightCommand;
    const primaryStartMarkerCommand = currentStartNextCommand || startNextCommand;
    body.appendChild(el("h3", "", "먼저 할 일"));
    body.appendChild(el(
      "div",
      currentStartNextCommand ? "result-proof-ok" : "result-hint",
      currentStartNextCommand
        ? "현재 판의 실제 시드로 다음 필요 수동 세션 시작 검증과 시작 마커를 바로 실행할 수 있습니다."
        : "새 게임을 시작하기 전에 시작 전 점검을 먼저 실행하고, 출력된 다음 목표 난이도로 새 게임을 시작하세요.",
    ));
    body.appendChild(el("h3", "", "1. 시작 전 검증"));
    body.appendChild(el("pre", "report", primaryStartCheckCommand));
    body.appendChild(el("h3", "", "2. 시작 마커 저장"));
    body.appendChild(el("pre", "report", primaryStartMarkerCommand));
    if (currentPendingIdCommand) {
      body.appendChild(el("h3", "", "3. 시작 마커 저장 확인"));
      body.appendChild(el("pre", "report", currentPendingIdCommand));
      body.appendChild(el("div", "modal-note", "시작 마커 저장 명령을 실행한 직후 이 확인 명령이 PASS 상태로 끝나는지 보고 12분 이상 플레이를 시작하세요."));
    }
    body.appendChild(el("h3", "", "현재 증거 버전"));
    body.appendChild(el("pre", "report", `DATA_VERSION ${dataVersion}`));
    body.appendChild(el("div", "modal-note", "결과 기록이나 --finish 명령의 --dataVersion, --stateChecksum, --endedAt은 결과 화면에 표시된 실제 값을 그대로 사용하세요."));
    if (ctx?.scene === "game") {
      const s = ctx.game.state;
      const legends = legendOrBetterCount(ctx);
      const currentTarget = manualProofTargetFor(s.difficulty, legends);
      body.appendChild(el("h3", "", "현재 판 목표 상태"));
      const statusTable = el("table", "kv-table");
      const rows = [
        ["난이도", DIFFICULTIES.find((d) => d.id === s.difficulty)?.name ?? s.difficulty],
        ["전설/히든", String(legends)],
        ["목표", currentTarget.label],
        ["조건", currentTarget.status],
      ];
      for (const [k, v] of rows) {
        const tr = el("tr");
        tr.appendChild(el("td", "", k));
        tr.appendChild(el("td", "", v));
        statusTable.appendChild(tr);
      }
      body.appendChild(statusTable);
      body.appendChild(el("div", currentTarget.state === "warn" ? "result-hint" : "modal-note", currentRunManualProofNote(currentTarget)));
    }
    if (currentStartCommand) {
      body.appendChild(el("h3", "", "현재 판 시작 마커"));
      if (currentStartNextCommand) {
        body.appendChild(el("pre", "report", currentStartNextDryRunCommand));
        body.appendChild(el("div", "modal-note", "먼저 위 검증 명령으로 현재 판이 다음 필요 세션에 맞는지 확인한 뒤, 아래 실제 시작 마커를 저장하세요."));
        body.appendChild(el("pre", "report", currentStartNextCommand));
        body.appendChild(el("div", "modal-note", "현재 판이 다음 필요 세션과 같은 난이도라면 위 단축 명령을 쓰세요. 아니면 아래 직접 시작 마커를 사용하세요."));
      }
      body.appendChild(el("pre", "report", currentStartDryRunCommand));
      body.appendChild(el("pre", "report", currentStartCommand));
      body.appendChild(el("pre", "report", currentPendingIdCommand));
      body.appendChild(el("div", "modal-note", "직접 시작 마커에는 현재 목표 라벨이 함께 저장됩니다. 검증 출력의 finish 템플릿이 목표 조건과 맞는지 확인한 뒤 저장하세요."));
      body.appendChild(el("div", "modal-note", "플레이 시작 직후 한 번 실행해두면 결과 화면을 놓쳐도 --finish 명령으로 같은 시작 시각을 재사용할 수 있습니다."));
    }
    body.appendChild(el("h3", "", "실제 세션 기록 순서"));
    const workflow = el("ol", "modal-note");
    for (const step of MANUAL_START_WORKFLOW) {
      workflow.appendChild(el("li", "", step));
    }
    body.appendChild(workflow);
    body.appendChild(el("h3", "", "상태 확인"));
    body.appendChild(el("pre", "report", preflightCommand));
    body.appendChild(el("pre", "report", preflightJsonCommand));
    body.appendChild(el("pre", "report", pendingCommand));
    body.appendChild(el("pre", "report", nextCommand));
    body.appendChild(el("pre", "report", startNextDryRunCommand));
    body.appendChild(el("pre", "report", startNextCommand));
    body.appendChild(el("pre", "report", summaryCommand));
    body.appendChild(el("pre", "report", planCommand));
    body.appendChild(el("pre", "report", summaryJsonCommand));

    body.appendChild(el("h3", "", "필수 목표 세션"));
    const table = el("table", "kv-table");
    for (const { difficulty, target, length } of MANUAL_BALANCE_TARGETS) {
      const tr = el("tr");
      tr.appendChild(el("td", "", difficulty));
      tr.appendChild(el("td", "", target));
      tr.appendChild(el("td", "", length));
      table.appendChild(tr);
    }
    body.appendChild(table);
    body.appendChild(el("div", "result-hint", "총 120분 이상, 각 난이도 최소 12분 이상이 함께 필요합니다."));
    body.appendChild(el("h3", "", "권장 플레이 순서"));
    body.appendChild(el(
      "div",
      "modal-note",
      "위 6개 목표 세션을 먼저 12분 이상씩 채우면 72분입니다. 이후 부족한 48분은 요약 명령의 다음 필요 항목을 보며 난이도별 최소 12분 조건과 총 120분 조건을 채웁니다.",
    ));

    const row = el("div", "row-btns");
    if (currentStartCommand) {
      if (currentStartNextCommand) {
        const copyCurrentStartNextDryRun = el("button", "", "현재 다음검증 복사");
        copyCurrentStartNextDryRun.onclick = async () => {
          try {
            await navigator.clipboard.writeText(currentStartNextDryRunCommand);
            toast("현재 판 시드의 다음 필요 세션 검증 명령을 복사했습니다", "ok");
          } catch {
            toast("복사 실패: 명령을 직접 선택하세요", "warn");
          }
        };
        row.appendChild(copyCurrentStartNextDryRun);
        const copyCurrentStartNext = el("button", "", "현재 다음마커 복사");
        copyCurrentStartNext.onclick = async () => {
          try {
            await navigator.clipboard.writeText(currentStartNextCommand);
            toast("현재 판 시드의 다음 필요 세션 시작 명령을 복사했습니다", "ok");
          } catch {
            toast("복사 실패: 명령을 직접 선택하세요", "warn");
          }
        };
        row.appendChild(copyCurrentStartNext);
      }
      const copyStartDryRun = el("button", "", "시작검증 복사");
      copyStartDryRun.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentStartDryRunCommand);
          toast("현재 판 시작 마커 검증 명령을 복사했습니다", "ok");
        } catch {
          toast("복사 실패: 명령을 직접 선택하세요", "warn");
        }
      };
      row.appendChild(copyStartDryRun);
      const copyStart = el("button", "", "시작마커 복사");
      copyStart.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentStartCommand);
          toast("현재 판 시작 마커 명령을 복사했습니다", "ok");
        } catch {
          toast("복사 실패: 명령을 직접 선택하세요", "warn");
        }
      };
      row.appendChild(copyStart);
      const copyPendingId = el("button", "", "현재마커 확인 복사");
      copyPendingId.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentPendingIdCommand);
          toast("현재 판 시작 마커 저장 확인 명령을 복사했습니다", "ok");
        } catch {
          toast("복사 실패: 명령을 직접 선택하세요", "warn");
        }
      };
      row.appendChild(copyPendingId);
      const copyPendingIdJson = el("button", "", "현재마커 JSON 복사");
      copyPendingIdJson.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentPendingIdJsonCommand);
          toast("현재 판 시작 마커 JSON 확인 명령을 복사했습니다", "ok");
        } catch {
          toast("복사 실패: 명령을 직접 선택하세요", "warn");
        }
      };
      row.appendChild(copyPendingIdJson);
    }
    const copyPending = el("button", "", "대기목록 복사");
    copyPending.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pendingCommand);
        toast("시작 마커 대기목록 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyPending);
    const copyPreflight = el("button", "", "시작점검 복사");
    copyPreflight.onclick = async () => {
      try {
        await navigator.clipboard.writeText(preflightCommand);
        toast("수동 플레이 시작 전 점검 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyPreflight);
    const copyPreflightJson = el("button", "", "점검JSON 복사");
    copyPreflightJson.onclick = async () => {
      try {
        await navigator.clipboard.writeText(preflightJsonCommand);
        toast("수동 플레이 시작 전 점검 JSON 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyPreflightJson);
    const copyNext = el("button", "", "다음 세션 복사");
    copyNext.onclick = async () => {
      try {
        await navigator.clipboard.writeText(nextCommand);
        toast("다음 수동 세션 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyNext);
    const copyStartNextDryRun = el("button", "", "다음 시작검증 복사");
    copyStartNextDryRun.onclick = async () => {
      try {
        await navigator.clipboard.writeText(startNextDryRunCommand);
        toast("다음 필요 세션 시작 검증 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyStartNextDryRun);
    const copyStartNext = el("button", "", "다음 시작마커 복사");
    copyStartNext.onclick = async () => {
      try {
        await navigator.clipboard.writeText(startNextCommand);
        toast("다음 필요 세션 시작 마커 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyStartNext);
    const copySummary = el("button", "", "요약 명령 복사");
    copySummary.onclick = async () => {
      try {
        await navigator.clipboard.writeText(summaryCommand);
        toast("수동 증거 요약 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copySummary);
    const copyPlan = el("button", "", "계획 명령 복사");
    copyPlan.onclick = async () => {
      try {
        await navigator.clipboard.writeText(planCommand);
        toast("수동 증거 계획 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyPlan);
    const copyJsonSummary = el("button", "", "JSON 명령 복사");
    copyJsonSummary.onclick = async () => {
      try {
        await navigator.clipboard.writeText(summaryJsonCommand);
        toast("수동 증거 JSON 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyJsonSummary);
    const closeBtn = el("button", "primary", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

// ---------- 저장/불러오기 슬롯 ----------

export function openSaveModal(ctx: AppCtx) {
  openModal(async (body, close) => {
    body.appendChild(el("h2", "", "수동 저장"));
    const slots = await listSlots();
    for (const slotId of ["slot1", "slot2", "slot3"]) {
      const meta = slots.find((m) => m.slotId === slotId);
      const card = el("div", "slot-card");
      const left = el("div");
      left.appendChild(el("div", "", `슬롯 ${slotId.slice(-1)}`));
      left.appendChild(el("div", "meta", meta
        ? `${stageById(meta.stageId ?? 1).name} · ${meta.round}R · ${meta.difficulty} · 시드 ${meta.seed} · ${new Date(meta.savedAt).toLocaleString()}`
        : "비어 있음"));
      card.appendChild(left);
      card.onclick = async () => {
        try {
          const s = ctx.game.state;
          await saveSlot(slotId, makeSaveRecord({
            seed: s.seed, difficulty: s.difficulty, stageId: s.stageId,
            stateChecksum: stateChecksum(s),
            tick: s.tick, round: s.round, life: s.life,
            maxGrade: ctx.game.maxOwnedGrade(),
            inputHistory: s.inputHistory,
          }));
          toast(`슬롯에 저장했습니다`, "ok");
          close();
        } catch {
          toast("저장 실패: 권한 또는 디스크 상태를 확인하세요.", "danger");
        }
      };
      body.appendChild(card);
    }
    const row = el("div", "row-btns");
    const cancel = el("button", "", "닫기");
    cancel.onclick = close;
    row.appendChild(cancel);
    body.appendChild(row);
  });
}

export function openLoadModal(ctx: AppCtx) {
  openModal(async (body, close) => {
    body.appendChild(el("h2", "", "불러오기"));
    const slots = await listSlots();
    if (slots.length === 0) body.appendChild(el("div", "", "저장된 슬롯이 없습니다."));

    const renderSlot = (meta: SlotMeta) => {
      const card = el("div", "slot-card");
      const left = el("div");
      left.appendChild(el("div", "", meta.slotId === "autosave" ? "자동 저장" : `슬롯 ${meta.slotId.slice(-1)}`));
      left.appendChild(el("div", "meta",
        `${stageById(meta.stageId ?? 1).name} · ${meta.round}R · 라이프 ${meta.life} · ${meta.difficulty} · 시드 ${meta.seed} · v${meta.dataVersion} · ${new Date(meta.savedAt).toLocaleString()}`));
      card.appendChild(left);

      const delBtn = el("button", "del", "삭제");
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteSlot(meta.slotId);
        close();
        openLoadModal(ctx);
      };
      card.appendChild(delBtn);

      card.onclick = async () => {
        try {
          const rec = await loadSlot(meta.slotId);
          if (!rec) { toast("슬롯을 읽을 수 없습니다", "danger"); return; }
          if (rec.dataVersion !== ctx.game.state.dataVersion) {
            toast("현재 데이터 버전과 달라 불러올 수 없습니다.", "warn", 4000);
            return;
          }
          const replayed = replay(rec.seed, rec.difficulty, rec.stageId ?? 1, rec.inputHistory, rec.tick);
          if (stateChecksum(replayed.state) !== rec.stateChecksum) {
            toast("체크섬 불일치: 손상된 저장입니다.", "danger", 4000);
            return;
          }
          resetResultShown();
          ctx.adoptGame(replayed);
          toast(`${rec.round}R 저장을 불러왔습니다`, "ok");
          close();
        } catch {
          toast("불러오기 실패", "danger");
        }
      };
      return card;
    };

    const auto = slots.find((m) => m.slotId === "autosave");
    if (auto) {
      body.appendChild(el("h3", "", "자동 저장"));
      body.appendChild(renderSlot(auto));
    }
    const manual = slots.filter((m) => m.slotId !== "autosave");
    if (manual.length > 0) {
      body.appendChild(el("h3", "", "수동 슬롯"));
      for (const m of manual) body.appendChild(renderSlot(m));
    }

    const row = el("div", "row-btns");
    const cancel = el("button", "", "닫기");
    cancel.onclick = close;
    row.appendChild(cancel);
    body.appendChild(row);
  });
}

// ---------- 시뮬레이션 ----------

export function openSimModal(ctx: AppCtx) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "자동 시뮬레이션 (100시드)"));
    body.appendChild(el("div", "", "현재 데이터 버전 기준으로 자동 플레이 100판을 실행합니다. 수 초가 걸릴 수 있습니다."));
    const out = el("pre", "report", "대기 중…");
    body.appendChild(out);

    const row = el("div", "row-btns");
    const run = el("button", "primary", "실행") as HTMLButtonElement;
    run.onclick = () => {
      run.disabled = true;
      out.textContent = "실행 중…";
      // UI 멈춤 최소화를 위해 다음 프레임에 실행
      setTimeout(() => {
        const report = runSimulation(100, ctx.game.state.difficulty, "balanced");
        out.textContent = reportToMarkdown(report);
        run.disabled = false;
      }, 50);
    };
    row.appendChild(run);

    const exportBtn = el("button", "", "리포트 저장");
    exportBtn.onclick = async () => {
      if (!out.textContent || out.textContent.startsWith("대기")) return;
      try {
        const p = await writeReport(`randi-sim-${Date.now()}.md`, out.textContent);
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(exportBtn);

    const closeBtn = el("button", "", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

export function openBalanceGateModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "5난이도 밸런스 게이트"));
    body.appendChild(el("div", "", "현재 기준으로 30시드 자동 플레이 게이트를 실행합니다. 전체 난이도 조건을 확인하므로 시간이 걸릴 수 있습니다."));
    const out = el("pre", "report", "대기 중…");
    body.appendChild(out);
    let lastResult: BalanceGateResult | null = null;

    const row = el("div", "row-btns");
    const run = el("button", "primary", "실행") as HTMLButtonElement;
    run.onclick = () => {
      run.disabled = true;
      out.textContent = "실행 중…";
      const progress: string[] = [];
      const results: BalanceScenarioResult[] = [];
      const runNext = (index: number) => {
        if (index >= BALANCE_SCENARIOS.length) {
          lastResult = evaluateBalanceGate(BALANCE_GATE_DEFAULT_SEEDS, results);
          out.textContent = balanceGateToMarkdown(lastResult);
          run.disabled = false;
          return;
        }
        const scenario = BALANCE_SCENARIOS[index];
        out.textContent = `실행 중…\n${progress.join("\n")}\n${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label} 계산 중`;
        setTimeout(() => {
          const report = runSimulation(BALANCE_GATE_DEFAULT_SEEDS, scenario.difficulty, scenario.options);
          results.push({ scenario, report });
          progress.push(`${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label}: ${(report.clearRate * 100).toFixed(1)}% · 평균 ${report.avgReachedRound.toFixed(1)}R · 전설 ${report.avgLegendCount.toFixed(1)}`);
          out.textContent = `실행 중…\n${progress.join("\n")}`;
          runNext(index + 1);
        }, 20);
      };
      runNext(0);
    };
    row.appendChild(run);

    const saveMd = el("button", "", "Markdown 저장");
    saveMd.onclick = async () => {
      if (!lastResult) return;
      try {
        const p = await writeReport(`randi-balance-${Date.now()}.md`, balanceGateToMarkdown(lastResult));
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(saveMd);

    const saveJson = el("button", "", "JSON 저장");
    saveJson.onclick = async () => {
      if (!lastResult) return;
      try {
        const p = await writeReport(`randi-balance-${Date.now()}.json`, balanceGateToJson(lastResult));
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(saveJson);

    const closeBtn = el("button", "", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

// ---------- 도움말 ----------

export function openHelpModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "단축키"));
    const table = el("table", "kv-table");
    const rows: Array<[string, string]> = [
      ["Space", "다음 라운드 시작 / 진행 중 일시정지"],
      ["Z", "소환"],
      ["X", "선택한 3기 합성"],
      ["Delete / Backspace", "선택 유닛 판매"],
      ["A → 좌클릭", "공격 이동"],
      ["S", "정지(Hold) — 제자리 대기"],
      ["L", "선택 유닛 잠금 토글"],
      ["Q / W / E", "속도 x1 / x2 / x3"],
      ["Ctrl + 1~9", "선택을 부대로 저장"],
      ["1~9", "저장된 부대 선택"],
      ["Esc", "공격이동 취소 / 모달 닫기 / 일시정지 메뉴"],
    ];
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("td", "", k));
      tr.appendChild(el("td", "", v));
      table.appendChild(tr);
    }
    body.appendChild(table);
    body.appendChild(el("h3", "", "규칙 요약"));
    body.appendChild(el("div", "",
      "소환·3합성·지정 조합·판매·업그레이드는 전투 중을 포함해 상시 가능합니다(게임 종료 후 제외). 잠금(🔒) 유닛은 판매와 조합 재료에서 보호됩니다. 조합/미션/보스 탭은 우측 패널의 탭을 클릭해 전환합니다."));
    const row = el("div", "row-btns");
    const ok = el("button", "primary", "닫기");
    ok.onclick = close;
    row.appendChild(ok);
    body.appendChild(row);
  });
}

export function openAboutModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "차원 균열 랜덤 디펜스"));
    body.appendChild(el("div", "", "오리지널 IP 기반 2D 랜덤 디펜스 MVP 프로토타입. 에셋 없이 도형과 색으로만 표현합니다."));
    body.appendChild(el("div", "", `실행 환경: ${isTauri() ? "Tauri 데스크탑" : "브라우저 (저장은 localStorage)"}`));
    const row = el("div", "row-btns");
    if (isTauri()) {
      const dir = el("button", "", "앱 데이터 폴더 열기");
      dir.onclick = () => void openAppDataDir();
      row.appendChild(dir);
    }
    const ok = el("button", "primary", "닫기");
    ok.onclick = close;
    row.appendChild(ok);
    body.appendChild(row);
  });
}
