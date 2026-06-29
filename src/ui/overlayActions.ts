// 선택권 / 결과 / 새 게임 / 저장 슬롯 / 시뮬레이션 모달

import type { AppCtx } from "../runtimeContext";
import { toast } from "./uiFeedback";
import { GRADE_LABEL, type DifficultyId, type ResultSummary } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { RELIC_BY_ID } from "../data/relics";
import { DIFFICULTIES } from "../data/difficulty";
import { STAGES } from "../data/stages";
import { DATA_VERSION } from "../data/version";
import { randomSeed } from "../core/rng";
import { stateChecksum } from "../core/checksum";
import {
  deleteSlot, listSlots, loadSlot, makeSaveRecord, recordResult,
  saveSlot, writeReport,
} from "../save/saveApi";
import { replay } from "../core/engine";
import { initialNewRunStageId } from "../profile/settings";
import { FINAL_ROUND } from "../data/waves";
import { manualProofFinishReadiness, manualProofTargetFor, type ManualProofTargetStatus } from "../core/manualProof";
import { manualProofResultChecklist, manualProofResultLogNote, manualProofResultTarget } from "../core/manualProofResult";
import {
  manualStartCommand as buildManualStartCommand,
  manualDryRunCommand,
  manualNextCommand,
  manualNextJsonCommand,
  manualPendingIdCommand as buildManualPendingIdCommand,
  manualPlanCommand,
  manualPreflightCommand,
  manualPreflightJsonCommand,
  manualSheetCommand,
  manualStartId,
  manualStartNextCommand as buildManualStartNextCommand,
  manualStartValidateSaveCommand,
  manualSummaryCommand,
  manualSummaryJsonCommand,
  shellArg,
} from "../core/manualProofCommands";
import { openReactOverlay } from "./reactOverlayBridge";

// ---------- 선택권 ----------

let selectorOpen = false;
let relicChoiceOpen = false;

// COMPONENT: SelectorModal - reward chooser for pending unit selector tickets.
export function openSelectorModal(ctx: AppCtx) {
  const s = ctx.game.state;
  if (selectorOpen || s.pendingSelectors.length === 0) return;
  if (s.phase === "ended") return; // 게임은 항상 "wave"로 진행 — 종료 시에만 차단
  selectorOpen = true;
  ctx.audio.sfx("selector");
  const sel = s.pendingSelectors[0];

    openReactOverlay({
      kind: "selector",
      grade: sel.grade,
      source: sel.source,
      candidates: sel.candidateIds.map((id) => UNIT_BY_ID[id]).filter((unit): unit is NonNullable<typeof unit> => Boolean(unit)),
      onClose: () => { selectorOpen = false; },
      actions: {
        pick: (unitId) => {
          const res = ctx.act("pickSelector", { selectorId: sel.id, unitId });
          if (res && ctx.game.state.pendingSelectors.length > 0) {
            openSelectorModal(ctx);
          }
        },
      },
    });
    return;

}
// ---------- 유물 선택 ----------


// COMPONENT: RelicChoiceModal - boss reward relic picker for run-wide bonuses.
export function openRelicChoiceModal(ctx: AppCtx) {
  const s = ctx.game.state;
  if (relicChoiceOpen || s.pendingRelicChoices.length === 0) return;
  if (s.phase === "ended") return;
  relicChoiceOpen = true;
  ctx.audio.sfx("mission");
  const choice = s.pendingRelicChoices[0];

    openReactOverlay({
      kind: "relicChoice",
      source: choice.source,
      candidates: choice.candidateIds
        .map((id) => RELIC_BY_ID[id])
        .filter((relic): relic is NonNullable<typeof relic> => Boolean(relic)),
      onClose: () => { relicChoiceOpen = false; },
      actions: {
        pick: (relicId) => {
          const res = ctx.act("pickRelic", { choiceId: choice.id, relicId });
          if (res && ctx.game.state.pendingRelicChoices.length > 0) {
            openRelicChoiceModal(ctx);
          }
        },
      },
    });
    return;

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

export function currentManualProofSummary(ctx: AppCtx, nowIso = new Date().toISOString(), nowMs = performance.now()): ResultSummary {
  const summary = ctx.game.resultSummary();
  summary.playedAt = nowIso;
  summary.manualStartedAt = ctx.runStartedAt;
  summary.unlockedNextStage = ctx.lastRunUnlockedNext;
  summary.wallSeconds = Math.max(1, Math.round((nowMs - ctx.runStartedAtMs) / 1000));
  return summary;
}


function manualInputTypes(r: ResultSummary): string {
  return Object.keys(r.inputCounts).sort().join(",");
}

function manualInputCounts(r: ResultSummary): string {
  return Object.entries(r.inputCounts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}:${count}`)
    .join(",");
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
    `--inputCount=${r.inputCount}`,
  ];
  const inputTypes = manualInputTypes(r);
  const inputCounts = manualInputCounts(r);
  if (inputTypes) args.push(`--inputTypes=${shellArg(inputTypes)}`);
  if (inputCounts) args.push(`--inputCounts=${shellArg(inputCounts)}`);
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
    `--inputCount=${r.inputCount}`,
  ];
  const inputTypes = manualInputTypes(r);
  const inputCounts = manualInputCounts(r);
  if (inputTypes) args.push(`--inputTypes=${shellArg(inputTypes)}`);
  if (inputCounts) args.push(`--inputCounts=${shellArg(inputCounts)}`);
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
    `--inputCount=${r.inputCount}`,
  ];
  const inputTypes = manualInputTypes(r);
  const inputCounts = manualInputCounts(r);
  if (inputTypes) args.push(`--inputTypes=${shellArg(inputTypes)}`);
  if (inputCounts) args.push(`--inputCounts=${shellArg(inputCounts)}`);
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

export function manualPlaylogResultExportJson(r: ResultSummary): string {
  return JSON.stringify({
    schemaVersion: 1,
    kind: "manual-playlog-result",
    exportedAt: new Date().toISOString(),
    notes: manualProofResultLogNote(r),
    summary: r,
  }, null, 2);
}

function manualPlaylogResultEmbeddedJsonCommand(json: string, dryRun: boolean, thenNext = false): string {
  const marker = "BORANDI_MANUAL_RESULT_JSON";
  const afterCommand = thenNext ? " && yarn manual-playlog --next" : "";
  return [
    `cat <<'${marker}' | yarn manual-playlog --from-result=-${dryRun ? " --dry-run" : ""}${afterCommand}`,
    json,
    marker,
  ].join("\n");
}

function manualPlaylogResultValidateSaveNextCommand(json: string): string {
  const marker = "BORANDI_MANUAL_RESULT_JSON";
  return [
    `tmpfile=$(mktemp "\${TMPDIR:-/tmp}/borandi-manual-result.XXXXXX") && {`,
    `cat > "$tmpfile" <<'${marker}'`,
    json,
    marker,
    `yarn manual-playlog --from-result="$tmpfile" --dry-run && yarn manual-playlog --from-result="$tmpfile" && yarn manual-playlog --next`,
    `status=$?`,
    `rm -f "$tmpfile"`,
    `test $status -eq 0`,
    `}`,
  ].join("\n");
}

function mapPermissionMessage(r: ResultSummary): string {
  const finalBossCleared = r.cleared &&
    r.reachedRound >= FINAL_ROUND &&
    r.bossKills.some((boss) => boss.round === FINAL_ROUND);
  if (finalBossCleared) {
    return "40R 최종 보스를 클리어했습니다. 다음 새 게임에서도 전체 맵을 자유롭게 선택할 수 있습니다.";
  }
  return "이 판에서는 맵이 바뀌지 않습니다. 다음 새 게임에서는 전체 맵 중 원하는 맵을 바로 선택할 수 있습니다.";
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
    `- 플레이 입력: ${r.inputCount}회${Object.keys(r.inputCounts).length > 0 ? ` (${Object.entries(r.inputCounts).map(([type, count]) => `${type} ${count}`).join(", ")})` : ""}`,
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

// COMPONENT: ResultModal - opens the end-of-run summary and report/export actions.
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

  const proofTargetForReact = manualProofResultTarget(summary);
  const proofChecksForReact = manualProofResultChecklist(summary);
  const manualResultJsonForReact = manualPlaylogResultExportJson(summary);
  const embeddedDryRunForReact = manualPlaylogResultEmbeddedJsonCommand(manualResultJsonForReact, true);
  const embeddedSaveForReact = manualPlaylogResultEmbeddedJsonCommand(manualResultJsonForReact, false);
  const embeddedSaveNextForReact = manualPlaylogResultEmbeddedJsonCommand(manualResultJsonForReact, false, true);
  const embeddedValidateSaveNextForReact = manualPlaylogResultValidateSaveNextCommand(manualResultJsonForReact);
  openReactOverlay({
    kind: "result",
    summary,
    proofTarget: proofTargetForReact,
    proofChecks: proofChecksForReact,
    manualResultJson: manualResultJsonForReact,
    exportJsonLabel: "증거 JSON 내보내기",
    copyJsonLabel: "증거 JSON 복사",
    copyJsonOkMessage: "증거 JSON을 복사했습니다.",
    commandGroups: [
      {
        label: "JSON 포함 명령",
        commands: [
          { label: "JSON포함 검증 복사", text: embeddedDryRunForReact, okMessage: "JSON 포함 검증 명령을 복사했습니다." },
          { label: "JSON포함 저장 복사", text: embeddedSaveForReact, okMessage: "JSON 포함 저장 명령을 복사했습니다." },
          { label: "JSON포함 저장+다음 복사", text: embeddedSaveNextForReact, okMessage: "JSON 포함 저장 후 다음 확인 명령을 복사했습니다." },
          { label: "JSON검증+저장+다음 복사", text: embeddedValidateSaveNextForReact, okMessage: "JSON 검증 후 저장 및 다음 확인 명령을 복사했습니다." },
        ],
      },
      {
        label: "Manual playlog commands",
        commands: [
          { label: "Dry run", text: manualPlaylogDryRunCommand(summary), okMessage: "Dry-run command copied." },
          { label: "Save result", text: manualPlaylogCommand(summary), okMessage: "Save result command copied." },
          { label: "Save and next", text: manualPlaylogThenNextCommand(summary), okMessage: "Save and next command copied." },
          { label: "Finish marker dry run", text: manualPlaylogFinishDryRunCommand(summary), okMessage: "Finish marker dry-run command copied." },
          { label: "Finish marker", text: manualPlaylogFinishCommand(summary), okMessage: "Finish marker command copied." },
          { label: "Latest marker dry run", text: manualPlaylogFinishLatestDryRunCommand(summary), okMessage: "Latest marker dry-run command copied." },
          { label: "Latest marker", text: manualPlaylogFinishLatestCommand(summary), okMessage: "Latest marker command copied." },
          { label: "Latest marker and next", text: manualPlaylogFinishLatestThenNextCommand(summary), okMessage: "Latest marker and next command copied." },
        ],
      },
      {
        label: "증거 JSON 가져오기",
        commands: [
          { label: "내보낸 JSON 검증", text: "yarn manual-playlog --from-result=PATH_TO_EXPORTED_JSON --dry-run", okMessage: "내보낸 JSON 검증 명령을 복사했습니다." },
          { label: "클립보드 JSON 검증", text: "yarn manual-playlog --from-clipboard --dry-run", okMessage: "터미널에서 --from-clipboard --dry-run을 실행하세요." },
          { label: "클립보드 JSON 실제 저장", text: "yarn manual-playlog --from-clipboard", okMessage: "클립보드 JSON 실제 저장 명령을 복사했습니다." },
        ],
      },
    ],
    actions: {
      exportReport: () => writeReport(`randi-result-${summary.seed}-${Date.now()}.md`, buildReportMarkdown(summary)),
      exportJson: () => writeReport(`randi-manual-result-${summary.seed}-${Date.now()}.json`, manualResultJsonForReact),
      toTitle: () => {
        resetResultShown();
        ctx.goTitle();
      },
      restartSeed: () => {
        resultShown = false;
        ctx.newRun(summary.seed, ctx.game.state.difficulty, ctx.game.state.stageId);
      },
      newRun: () => openNewRunModal(ctx),
    },
  });
  return;

}

export function resetResultShown() { resultShown = false; }

// ---------- 새 게임 ----------

// COMPONENT: NewRunModal - difficulty chooser and random seed launcher.
const MANUAL_BALANCE_TARGETS: Array<{
  difficultyId: DifficultyId;
  difficulty: string;
  target: string;
  length: string;
}> = [
  { difficultyId: "novice", difficulty: "입문자", target: "무전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "normal", difficulty: "일반", target: "1~2전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "intermediate", difficulty: "중급자", target: "5전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "5전설 이하 실패", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "6전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "master", difficulty: "초고수", target: "실패 기록", length: "12분 이상" },
];

const MANUAL_BALANCE_OBSERVATIONS: Array<{
  difficultyId: DifficultyId;
  difficulty: string;
  target: string;
  length: string;
}> = [
  { difficultyId: "normal", difficulty: "일반", target: "무전설 경계 확인", length: "12분 이상" },
  { difficultyId: "intermediate", difficulty: "중급자", target: "2전설 경계 확인", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "제한 없음 성장 확인", length: "12분 이상" },
  { difficultyId: "master", difficulty: "초고수", target: "추가 실패 확인", length: "12분 이상" },
];


function manualResultExpected(target?: ManualProofTargetStatus): Record<string, string> {
  switch (target?.label) {
    case "입문자 무전설 40R 클리어":
      return { result: "clear", round: "40", legends: "0", maxGrade: "hero" };
    case "일반 1~2전설 40R 클리어":
      return { result: "clear", round: "40", legends: "1~2", maxGrade: "legend" };
    case "중급자 5전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "5+", maxGrade: "legend|hidden" };
    case "고수 5전설 이하 실패":
      return { result: "loss", round: "RESULT_ROUND", legends: "0~5", maxGrade: "hero|legend" };
    case "고수 6전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "6+", maxGrade: "legend|hidden" };
    case "초고수 실패 기록":
      return { result: "loss", round: "RESULT_ROUND", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
    default:
      return { result: "clear|loss", round: "RESULT_ROUND", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
  }
}

function manualResultFieldRows(target?: ManualProofTargetStatus): Array<{ field: string; source: string; value: string }> {
  const expected = manualResultExpected(target);
  return [
    { field: "seed", source: "Run seed shown at game start or result screen", value: "actual game seed" },
    { field: "startedAt", source: "start marker or pending start marker", value: "actual start timestamp" },
    { field: "endedAt", source: "result screen RESULT_ENDED_AT", value: "actual end timestamp" },
    { field: "dataVersion", source: "result screen RESULT_DATA_VERSION", value: DATA_VERSION },
    { field: "stateChecksum", source: "result screen RESULT_CHECKSUM", value: "8-character checksum" },
    { field: "inputCount", source: "result screen player input count", value: "12 or more" },
    { field: "inputTypes", source: "result screen player input types", value: "at least one meaningful type except setSpeed" },
    { field: "inputCounts", source: "result screen per-input counts", value: "sum must equal inputCount" },
    { field: "result", source: "result screen clear/loss state", value: expected.result },
    { field: "round", source: "result screen reached round", value: expected.round },
    { field: "legends", source: "result screen legend or hidden count", value: expected.legends },
    { field: "maxGrade", source: "result screen max grade", value: expected.maxGrade },
    { field: "minutes", source: "actual play time from start/end timestamps", value: "12 minutes or more" },
  ];
}


export function openNewRunModal(ctx: AppCtx, dismissable = true) {
    openReactOverlay({
      kind: "newRun",
      dismissable,
      initialStageId: initialNewRunStageId(ctx.game.state.stageId, STAGES.length),
      actions: {
        start: (difficultyId, stageId) => {
          resetResultShown();
          ctx.newRun(randomSeed(), difficultyId, stageId);
        },
      },
    });
    return;

}

// ---------- 수동 밸런스 증거 ----------

export function openManualProofGuideModal(ctx?: AppCtx) {
    const dataVersion = ctx?.game.state.dataVersion ?? DATA_VERSION;
    const currentStartCommand = ctx?.scene === "game" ? manualStartCommand(ctx) : "";
    const currentStartNextCommand = ctx?.scene === "game" ? manualStartNextCommand(ctx) : "";
    const currentPendingIdCommand = ctx?.scene === "game" ? manualPendingIdCommand(ctx) : "";
    const currentPendingIdJsonCommand = currentPendingIdCommand ? `${currentPendingIdCommand} --json` : "";
    const currentStartDryRunCommand = currentStartCommand ? manualDryRunCommand(currentStartCommand) : "";
    const currentStartNextDryRunCommand = currentStartNextCommand ? manualDryRunCommand(currentStartNextCommand) : "";
    const currentStartValidateSaveCommand = currentStartCommand
      ? manualStartValidateSaveCommand(currentStartCommand, currentPendingIdCommand)
      : "";
    const currentStartNextValidateSaveCommand = currentStartNextCommand
      ? manualStartValidateSaveCommand(currentStartNextCommand, currentPendingIdCommand)
      : "";
    const currentCheckpointSummary = ctx?.scene === "game" ? currentManualProofSummary(ctx) : null;
    const currentFinishReadiness = currentCheckpointSummary
      ? manualProofFinishReadiness({
        elapsedSeconds: currentCheckpointSummary.wallSeconds ?? 0,
        inputCount: currentCheckpointSummary.inputCount,
        inputCounts: currentCheckpointSummary.inputCounts,
      })
      : undefined;
    const currentFinishCheckpointCommand = currentCheckpointSummary && currentFinishReadiness?.ready ? manualPlaylogFinishCommand(currentCheckpointSummary) : "";
    const currentFinishCheckpointDryRunCommand = currentCheckpointSummary ? manualPlaylogFinishDryRunCommand(currentCheckpointSummary) : "";
    const currentFinishLatestCheckpointCommand = currentCheckpointSummary && currentFinishReadiness?.ready ? manualPlaylogFinishLatestCommand(currentCheckpointSummary) : "";
    const currentFinishLatestCheckpointDryRunCommand = currentCheckpointSummary ? manualPlaylogFinishLatestDryRunCommand(currentCheckpointSummary) : "";
    const summaryCommand = manualSummaryCommand();
    const planCommand = manualPlanCommand();
    const sheetCommand = manualSheetCommand();
    const nextCommand = manualNextCommand();
    const nextJsonCommand = manualNextJsonCommand();
    const startNextCommand = currentStartNextCommand || "yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE";
    const startNextDryRunCommand = manualDryRunCommand(startNextCommand);
    const pendingCommand = "yarn manual-playlog --pending";
    const preflightCommand = manualPreflightCommand();
    const preflightJsonCommand = manualPreflightJsonCommand();
    const summaryJsonCommand = manualSummaryJsonCommand();
    const primaryStartCheckCommand = currentStartNextDryRunCommand || preflightCommand;
    const primaryStartMarkerCommand = currentStartNextCommand || startNextCommand;
    const currentTarget = ctx?.scene === "game"
      ? manualProofTargetFor(ctx.game.state.difficulty, legendOrBetterCount(ctx))
      : undefined;
    const currentLegendCount = ctx?.scene === "game" ? legendOrBetterCount(ctx) : 0;
    const startValidationCommand = currentStartNextValidateSaveCommand || currentStartValidateSaveCommand;
    const currentTargetNote = currentTarget?.state === "ok"
      ? "Current holdings match this proof target. Play for at least 12 minutes before saving the final proof."
      : currentTarget?.state === "warn"
        ? "Current holdings exceed or mismatch the target. This run may need a different proof target."
        : "Target result is not ready yet. Confirm the final result checklist after at least 12 minutes of play.";
    const copyCommand = (label: string, text: string, okMessage: string) => (
      text ? { label, text, okMessage } : null
    );
    const commandGroup = (
      label: string,
      commands: Array<ReturnType<typeof copyCommand>>,
    ) => ({
      label,
      commands: commands.filter((command): command is NonNullable<typeof command> => Boolean(command)),
    });

    openReactOverlay({
      kind: "manualProof",
      dataVersion,
      intro: {
        className: currentStartNextCommand ? "result-proof-ok" : "result-hint",
        text: currentStartNextCommand
          ? "현재 판의 실제 시드로 다음 필요 수동 세션 dry-run 검증을 먼저 실행하세요. 검증이 PASS일 때만 시작 마커를 저장합니다."
          : "게임 시작 전 preflight를 실행한 뒤, 생성된 명령으로 다음 필요 수동 세션을 시작하세요.",
      },
      currentTarget: ctx?.scene === "game" && currentTarget
        ? {
          difficulty: DIFFICULTIES.find((difficulty) => difficulty.id === ctx.game.state.difficulty)?.name ?? ctx.game.state.difficulty,
          legends: String(currentLegendCount),
          label: currentTarget.label,
          status: currentTarget.status,
          state: currentTarget.state,
          note: currentTargetNote,
        }
        : undefined,
      sections: [
        {
          title: "1. Start validation",
          commands: [primaryStartCheckCommand],
        },
        {
          title: "2. Save start marker",
          commands: [primaryStartMarkerCommand],
        },
        ...(currentPendingIdCommand ? [{
          title: "3. Confirm pending start marker",
          note: {
            className: "modal-note",
            text: "Immediately after saving the start marker, confirm it is pending before playing for 12 minutes or more.",
          },
          commands: [currentPendingIdCommand],
        }] : []),
        ...(startValidationCommand ? [{
          title: "한 번에 검증+저장+확인",
          note: {
            className: "modal-note",
            text: "dry-run 검증이 통과할 때만 시작 마커를 저장하고, 곧바로 pending id를 확인합니다.",
          },
          commands: [startValidationCommand],
        }] : []),
        ...(currentStartCommand ? [{
          title: "Current run start marker",
          note: {
            className: "modal-note",
            text: "Use the command generated from the current run when you are validating this exact seed and target.",
          },
          commands: [
            currentStartNextDryRunCommand,
            currentStartNextCommand,
            currentStartDryRunCommand,
            currentStartCommand,
            currentPendingIdCommand,
          ].filter(Boolean) as string[],
        }] : []),
        ...(currentFinishCheckpointDryRunCommand ? [{
          title: "Current state finish check",
          note: {
            className: currentFinishReadiness?.ready ? "result-proof-ok" : "result-hint",
            text: currentFinishReadiness?.ready
              ? "The current state meets the minimum finish-save requirements. Recheck with final result values before saving."
              : `Not ready yet: ${currentFinishReadiness?.blockers.join(", ") ?? ""}`,
          },
          commands: [
            currentFinishCheckpointDryRunCommand,
            currentFinishLatestCheckpointDryRunCommand,
            currentFinishCheckpointCommand,
            currentFinishLatestCheckpointCommand,
          ].filter(Boolean) as string[],
        }] : []),
        {
          title: "Status and planning commands",
          commands: [
            preflightCommand,
            preflightJsonCommand,
            pendingCommand,
            nextCommand,
            nextJsonCommand,
            startNextDryRunCommand,
            startNextCommand,
            summaryCommand,
            planCommand,
            sheetCommand,
            summaryJsonCommand,
          ],
        },
      ],
      workflow: [
        "Start a game for the next required target and confirm the actual seed.",
        "Replace GAME_SEED_HERE with the actual seed and run the start dry-run.",
        "If validation passes, save the start marker without --dry-run.",
        "Play for at least 12 minutes and verify the target result condition.",
        "Use the result screen dataVersion, stateChecksum, and endedAt values for finish dry-run before saving the proof.",
      ],
      resultFields: manualResultFieldRows(currentTarget),
      balanceTargets: MANUAL_BALANCE_TARGETS.map(({ difficulty, target, length }) => ({ difficulty, target, length })),
      balanceObservations: MANUAL_BALANCE_OBSERVATIONS.map(({ difficulty, target, length }) => ({ difficulty, target, length })),
      finishReadiness: currentFinishReadiness,
      commandGroups: [
        commandGroup("Current run", [
          copyCommand("현재 다음검증+마커 복사", currentStartNextValidateSaveCommand, "현재 다음 검증+저장+확인 명령을 복사했습니다."),
          copyCommand("Copy next dry-run", currentStartNextDryRunCommand, "Current next dry-run command copied."),
          copyCommand("Copy next marker", currentStartNextCommand, "Current next start marker copied."),
          copyCommand("시작검증+마커 복사", currentStartValidateSaveCommand, "시작 검증+저장+확인 명령을 복사했습니다."),
          copyCommand("Copy start dry-run", currentStartDryRunCommand, "Current start dry-run command copied."),
          copyCommand("Copy start marker", currentStartCommand, "Current start marker copied."),
          copyCommand("Copy pending id", currentPendingIdCommand, "Pending id command copied."),
          copyCommand("Copy pending JSON", currentPendingIdJsonCommand, "Pending JSON command copied."),
          copyCommand("Copy finish dry-run", currentFinishCheckpointDryRunCommand, "Current finish dry-run command copied."),
          copyCommand("Copy finish", currentFinishCheckpointCommand, "Current finish command copied."),
        ]),
        commandGroup("General", [
          copyCommand("Copy pending list", pendingCommand, "Pending command copied."),
          copyCommand("Copy preflight", preflightCommand, "Preflight command copied."),
          copyCommand("Copy preflight JSON", preflightJsonCommand, "Preflight JSON command copied."),
          copyCommand("Copy next", nextCommand, "Next command copied."),
          copyCommand("Copy next start dry-run", startNextDryRunCommand, "Next start dry-run command copied."),
          copyCommand("Copy next start marker", startNextCommand, "Next start marker copied."),
          copyCommand("Copy summary", summaryCommand, "Summary command copied."),
          copyCommand("Copy plan", planCommand, "Plan command copied."),
          copyCommand("Copy sheet", sheetCommand, "Sheet command copied."),
          copyCommand("Copy summary JSON", summaryJsonCommand, "Summary JSON command copied."),
        ]),
      ].filter((group) => group.commands.length > 0),
    });
    return;

}

// ---------- 저장/불러오기 슬롯 ----------

// COMPONENT: SaveModal - manual save slot picker.
export function openSaveModal(ctx: AppCtx) {
    openReactOverlay({
      kind: "save",
      actions: {
        listSlots,
        save: async (slotId) => {
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
            return true;
          } catch {
            toast("저장 실패: 권한 또는 디스크 상태를 확인하세요.", "danger");
            return false;
          }
        },
      },
    });
    return;

}

// COMPONENT: LoadModal - autosave/manual slot loader and delete controls.
export function openLoadModal(ctx: AppCtx) {
    openReactOverlay({
      kind: "load",
      actions: {
        listSlots,
        delete: async (slotId) => {
          await deleteSlot(slotId);
        },
        load: async (slotId) => {
          try {
            const rec = await loadSlot(slotId);
            if (!rec) { toast("슬롯을 읽을 수 없습니다", "danger"); return false; }
            if (rec.dataVersion !== ctx.game.state.dataVersion) {
              toast("현재 데이터 버전과 달라 불러올 수 없습니다.", "warn", 4000);
              return false;
            }
            const replayed = replay(rec.seed, rec.difficulty, rec.stageId ?? 1, rec.inputHistory, rec.tick);
            if (stateChecksum(replayed.state) !== rec.stateChecksum) {
              toast("체크섬 불일치. 손상된 저장입니다.", "danger", 4000);
              return false;
            }
            resetResultShown();
            ctx.adoptGame(replayed);
            toast(`${rec.round}R 저장을 불러왔습니다`, "ok");
            return true;
          } catch {
            toast("불러오기 실패", "danger");
            return false;
          }
        },
      },
    });
    return;

}
