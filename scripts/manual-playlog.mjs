// Append one human playtest session to the manual balance play log.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const DEFAULT_MANUAL_LOG_PATH = "output/manual-balance-playlog.json";
const outPath = String(args.out ?? DEFAULT_MANUAL_LOG_PATH);
const difficulties = ["novice", "normal", "intermediate", "expert", "master"];
const results = ["clear", "loss", "quit"];
const grades = ["common", "rare", "hero", "legend", "hidden"];
const sessionSources = ["human-playtest", "codex-direct-playtest"];
const FINAL_ROUND = 40;
const PENDING_TARGET_MINUTES = 12;
const CURRENT_DATA_VERSION = readCurrentDataVersion();
const VALID_STAGE_IDS = readValidStageIds();

function usage() {
  return [
    "사용법:",
    "  yarn manual-playlog --difficulty=normal --minutes=24 --result=loss --stage=1 --round=39 --seed=RUN123 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --notes=\"2전설, 후반 누적 압박\"",
    "",
    "필수:",
    "  --difficulty=novice|normal|intermediate|expert|master",
    "  --minutes=분 또는 --seconds=초",
    "  --result=clear|loss|quit",
    "  --stage=1 --round=40 --seed=...",
    "  --legends=2        # 전설 이상 보유 수",
    "  --maxGrade=legend",
    "  --dataVersion=...  # 결과 리포트의 데이터 버전",
    "  --stateChecksum=... # 결과 리포트의 상태 체크섬",
    "",
    "선택:",
    "  --out=output/manual-balance-playlog.json",
    "  --start --id=RUN1 --difficulty=normal --stage=1 --seed=RUN123 --startedAt=ISO",
    "                          # 수동 플레이 시작 마커를 pendingSessions에 저장",
    "  --start-next --difficulty=normal --seed=RUN123",
    "                          # 다음 필요 수동 세션의 목표와 지정 난이도로 시작 마커를 저장",
    "  --start-next --difficulty=normal --seed=RUN123 --dry-run",
    "                          # 다음 필요 시작 마커를 저장하지 않고 검증/마감 템플릿만 출력",
    "  --pending                # 아직 finish되지 않은 시작 마커 목록 출력",
    "  --pending-id=RUN1         # 특정 시작 마커가 저장되어 있는지 확인",
    "  --pending-id-json          # --pending-id 결과를 JSON으로 출력",
    "  --preflight              # 새 수동 세션 시작 전 무효/미완료 마커 점검",
    "  --preflight-json         # --preflight 결과를 JSON으로 출력",
    "  --finish=RUN1 --result=loss --round=40 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --endedAt=RESULT_ENDED_AT",
    "                          # 시작 마커의 startedAt/difficulty/stage/seed를 사용해 결과 세션 저장",
    "  --finish-latest --result=loss --round=40 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --endedAt=RESULT_ENDED_AT",
    "                          # 가장 최근 시작 마커를 자동 선택해 결과 세션 저장",
    "  --finish                 # --finish-latest와 동일",
    "  --dry-run                # 시작/결과 세션을 검증하고 미리보기만 출력, 로그 파일은 쓰지 않음",
    "  --summary             # 현재 수동 로그 충족/미충족 항목만 출력",
    "  --summary --json      # 현재 수동 로그 상태를 JSON으로 출력",
    "  --summary-json        # --summary --json과 동일",
    "  --plan                # 남은 120분 수동 플레이 증거 수집 순서 출력",
    "  --plan --json         # 남은 수동 플레이 계획을 JSON으로 출력",
    "  --plan-json           # --plan --json과 동일",
    "  --next                # 바로 다음에 필요한 수동 플레이 세션 1개만 출력",
    "  --next --json         # 다음 필요 세션을 JSON으로 출력",
    "  --next-json           # --next --json과 동일",
    "  --pending-json        # --pending --json과 동일",
    "                        # --next/--plan 출력에는 다음 세션 시작 마커 명령 템플릿도 포함",
    "  --assert              # 수동 증거가 모두 충족되지 않으면 실패 코드로 종료",
    "  --notes=...",
    "  --source=human-playtest|codex-direct-playtest",
    "                          # 사람이 직접 플레이한 증거와 Codex 브라우저 직접 조작 증거를 구분",
    "  --startedAt=ISO --endedAt=ISO",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  console.error("");
  console.error(usage());
  process.exit(1);
}

if (args.help === "true" || args.h === "true") {
  console.log(usage());
  process.exit(0);
}

function readJson(path) {
  if (!existsSync(path)) return { sessions: [] };
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return { sessions: [] };
  const data = JSON.parse(raw);
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.pendingSessions)) data.pendingSessions = [];
  return data;
}

function readCurrentDataVersion() {
  try {
    const source = readFileSync("src/data/version.ts", "utf8");
    return source.match(/export const DATA_VERSION = "([^"]+)"/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function readValidStageIds() {
  try {
    const source = readFileSync("src/data/stages.ts", "utf8");
    return Array.from(source.matchAll(/\bid:\s*(\d+)/g), (match) => Number(match[1]))
      .filter((stageId) => Number.isInteger(stageId) && stageId > 0);
  } catch {
    return [];
  }
}

function isValidStageId(stage) {
  return Number.isInteger(stage) &&
    stage >= 1 &&
    (VALID_STAGE_IDS.length === 0 || VALID_STAGE_IDS.includes(stage));
}

function validStageLabel() {
  if (VALID_STAGE_IDS.length === 0) return "정수 맵 번호";
  const sorted = [...VALID_STAGE_IDS].sort((a, b) => a - b);
  return sorted.length > 5
    ? `${sorted[0]}~${sorted[sorted.length - 1]}`
    : sorted.join("|");
}

function asNumber(name) {
  if (args[name] === undefined) return undefined;
  const value = Number(args[name]);
  if (!Number.isFinite(value)) fail(`--${name} 값이 숫자가 아닙니다: ${args[name]}`);
  return value;
}

function requireNumber(name) {
  if (args[name] === undefined) fail(`--${name} 값이 필요합니다.`);
  return asNumber(name);
}

function optionalNumber(name, fallback) {
  const raw = args[name] ?? fallback;
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`--${name} 값이 숫자가 아닙니다: ${raw}`);
  return value;
}

function durationSeconds() {
  if (computedSeconds !== undefined) return computedSeconds;
  return minutes * 60;
}

function parseDate(name, value) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) fail(`--${name} 값이 ISO 날짜가 아닙니다: ${value}`);
  return date;
}

function sessionsTotalMinutes(log) {
  return log.sessions.reduce((sum, session) => {
    if (typeof session.minutes === "number") return sum + session.minutes;
    if (typeof session.seconds === "number") return sum + (session.seconds / 60);
    return sum;
  }, 0);
}

function coveredDifficulties(log) {
  return new Set(log.sessions.map((s) => s.difficulty).filter(Boolean));
}

function isLegendMetadataConsistent(maxGrade, legends) {
  const maxGradeIsLegendOrHidden = maxGrade === "legend" || maxGrade === "hidden";
  return maxGradeIsLegendOrHidden ? legends > 0 : legends === 0;
}

function isExampleManualLog(log) {
  return log?.example === true || log?.fixture === true;
}

function isExampleManualSession(session) {
  return session?.example === true || session?.fixture === true || session?.source === "example";
}

function sessionResult(session) {
  if (typeof session.result === "string") return session.result.toLowerCase();
  if (typeof session.cleared === "boolean") return session.cleared ? "clear" : "loss";
  return "";
}

function isClear(session) {
  return ["clear", "cleared", "win", "won", "victory"].includes(sessionResult(session));
}

function isLoss(session) {
  return ["loss", "lose", "lost", "fail", "failed", "defeat"].includes(sessionResult(session));
}

function sessionMinutes(session) {
  if (typeof session.minutes === "number") return session.minutes;
  if (typeof session.seconds === "number") return session.seconds / 60;
  return 0;
}

function reportedSessionSeconds(session) {
  if (typeof session.seconds === "number") return session.seconds;
  if (typeof session.minutes === "number") return session.minutes * 60;
  return 0;
}

function sessionTimeSpanSeconds(session) {
  if (!session.startedAt || !session.endedAt) return 0;
  const startedAt = new Date(String(session.startedAt)).getTime();
  const endedAt = new Date(String(session.endedAt)).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return (endedAt - startedAt) / 1000;
}

function hasValidManualTiming(session) {
  const reported = reportedSessionSeconds(session);
  const actual = sessionTimeSpanSeconds(session);
  if (reported <= 0 || actual <= 0) return false;
  const tolerance = Math.max(2, reported * 0.05);
  return Math.abs(actual - reported) <= tolerance;
}

function legendCount(session) {
  const value = Number(session.legends ?? session.legendOrBetter ?? session.legendOrBetterCount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function hasCompleteManualMetadata(session) {
  const difficulty = String(session.difficulty ?? "");
  const result = sessionResult(session);
  const stageValue = Number(session.stage);
  const roundValue = Number(session.round);
  const legendsValue = legendCount(session);
  const maxGradeValue = String(session.maxGrade ?? "");
  const seedValue = String(session.seed ?? "");
  const dataVersionValue = String(session.dataVersion ?? "");
  const checksumValue = String(session.stateChecksum ?? "");
  return difficulties.includes(difficulty) &&
    ["clear", "cleared", "win", "won", "victory", "loss", "lose", "lost", "fail", "failed", "defeat", "quit"].includes(result) &&
    isValidStageId(stageValue) &&
    Number.isFinite(roundValue) && roundValue >= 1 && roundValue <= FINAL_ROUND &&
    (!isClear(session) || roundValue >= FINAL_ROUND) &&
    Number.isFinite(legendsValue) && legendsValue >= 0 &&
    grades.includes(maxGradeValue) &&
    isLegendMetadataConsistent(maxGradeValue, legendsValue) &&
    seedValue.length > 0 &&
    dataVersionValue.length > 0 &&
    /^[0-9a-f]{8}$/i.test(checksumValue);
}

function sessionValidationEntries(log) {
  if (!log || isExampleManualLog(log)) return [];
  const seenChecksums = new Set();
  return (log.sessions ?? [])
    .filter((session) => !isExampleManualSession(session))
    .map((session, index) => {
      const issues = [];
      const dataVersion = String(session.dataVersion ?? "");
      if (!hasValidManualTiming(session)) {
        issues.push("startedAt/endedAt와 기록 시간이 맞지 않음");
      }
      if (!hasCompleteManualMetadata(session)) {
        issues.push("필수 결과 메타데이터 누락 또는 모순");
      }
      if (dataVersion && CURRENT_DATA_VERSION && dataVersion !== CURRENT_DATA_VERSION) {
        issues.push(`dataVersion ${dataVersion}이 현재 ${CURRENT_DATA_VERSION}와 다름`);
      }
      const checksum = String(session.stateChecksum ?? "").toLowerCase();
      if (issues.length === 0) {
        if (seenChecksums.has(checksum)) {
          issues.push("stateChecksum 중복");
        } else {
          seenChecksums.add(checksum);
        }
      }
      return { index, session, issues };
    });
}

function realManualSessions(log) {
  return sessionValidationEntries(log)
    .filter((entry) => entry.issues.length === 0)
    .map((entry) => entry.session);
}

function isHumanPlaytestSession(session) {
  const source = String(session.source ?? "human-playtest");
  return source === "human-playtest";
}

function humanManualSessions(log) {
  return realManualSessions(log).filter(isHumanPlaytestSession);
}

function invalidManualSessions(log) {
  return sessionValidationEntries(log)
    .filter((entry) => entry.issues.length > 0)
    .map(({ index, session, issues }) => {
      const checksum = String(session.stateChecksum ?? "").slice(0, 8);
      return {
        index,
        difficulty: String(session.difficulty ?? ""),
        result: sessionResult(session) || "",
        round: Number(session.round ?? 0),
        seed: String(session.seed ?? ""),
        checksum,
        dataVersion: String(session.dataVersion ?? ""),
        minutes: sessionMinutes(session),
        issues,
      };
    });
}

function reachedFinalRound(session) {
  return Number(session.round ?? 0) >= 40;
}

function isTargetLength(session) {
  return sessionMinutes(session) >= 12;
}

function hasTargetSession(sessions, difficulty, predicate) {
  return sessions.some((session) => session.difficulty === difficulty && predicate(session));
}

function targetEvidence(sessions, difficulty, predicate) {
  const matched = sessions.filter((session) => session.difficulty === difficulty && predicate(session));
  if (matched.length === 0) return "증거 없음";
  return matched.map((session) => {
    const checksumText = String(session.stateChecksum ?? "").slice(0, 8);
    const source = String(session.source ?? "source?");
    return `${sessionResult(session)} ${session.round}R ${legendCount(session)}전설+ ${sessionMinutes(session).toFixed(1)}분 ${source} #${checksumText}`;
  }).join("; ");
}

function shellArg(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function outPathArg() {
  return outPath === DEFAULT_MANUAL_LOG_PATH ? "" : ` --out=${shellArg(outPath)}`;
}

function normalizeSessionSource(value) {
  const source = String(value ?? "human-playtest");
  if (!sessionSources.includes(source)) {
    fail(`--source 값은 ${sessionSources.join("|")} 중 하나여야 합니다.`);
  }
  return source;
}

function startSourceForSession(source) {
  return `${source}-start`;
}

function sessionSourceForPending(session) {
  const pendingSource = String(session?.source ?? "");
  if (pendingSource === "codex-direct-playtest-start") return "codex-direct-playtest";
  return "human-playtest";
}

function startCommandTemplate(step) {
  if (!step || step.kind === "total-minutes") return "";
  const difficulty = step.difficulty === "any" ? "novice" : step.difficulty;
  return [
    "yarn manual-playlog --start",
    `--difficulty=${difficulty}`,
    "--stage=1",
    "--seed=GAME_SEED_HERE",
    `--notes=${shellArg(step.label)}`,
  ].join(" ") + outPathArg();
}

function dryRunCommandTemplate(command) {
  return command ? `${command} --dry-run` : "";
}

const targetPlans = [
  {
    label: "입문자 무전설 40R 클리어",
    difficulty: "novice",
    minutes: 12,
    goal: "전설 없이 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=0 maxGrade=hero 이하",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0,
  },
  {
    label: "일반 1~2전설 40R 클리어",
    difficulty: "normal",
    minutes: 12,
    goal: "전설 1~2개로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=1~2 maxGrade=legend",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2,
  },
  {
    label: "중급자 5전설 이상 40R 클리어",
    difficulty: "intermediate",
    minutes: 12,
    goal: "전설 5개 이상으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=5 maxGrade=legend|hidden",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5,
  },
  {
    label: "고수 5전설 이하 40R 실패",
    difficulty: "expert",
    minutes: 12,
    goal: "전설 5개 이하 조건으로 40R까지 버틴 뒤 실패",
    logHint: "result=loss round=40 legends<=5",
    predicate: (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5,
  },
  {
    label: "고수 6전설 이상 40R 클리어",
    difficulty: "expert",
    minutes: 12,
    goal: "전설 6개 이상 성장 조건으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=6 maxGrade=legend|hidden",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6,
  },
  {
    label: "초고수 실패 기록",
    difficulty: "master",
    minutes: 12,
    goal: "제한 없이 플레이하되 실패 결과 기록",
    logHint: "result=loss legends=최종값",
    predicate: (session) => isTargetLength(session) && isLoss(session),
  },
];

function buildSummary() {
  const log = existsSync(outPath) ? readJson(outPath) : { sessions: [] };
  const allSessions = isExampleManualLog(log) ? [] : (log.sessions ?? []).filter((session) => !isExampleManualSession(session));
  const pending = isExampleManualLog(log) ? [] : pendingSessions(log).map(pendingSessionWithCommands);
  const validSessions = realManualSessions(log);
  const validHumanSessions = validSessions.filter(isHumanPlaytestSession);
  const invalidSessions = invalidManualSessions(log);
  const totalMinutes = validHumanSessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const directSessionCount = validSessions.length - validHumanSessions.length;
  const directMinutes = validSessions
    .filter((session) => !isHumanPlaytestSession(session))
    .reduce((sum, session) => sum + sessionMinutes(session), 0);
  const minutesByDifficulty = new Map();
  for (const session of validHumanSessions) {
    minutesByDifficulty.set(session.difficulty, (minutesByDifficulty.get(session.difficulty) ?? 0) + sessionMinutes(session));
  }

  const rows = [
    {
      label: "수동 로그 무효 세션 없음",
      pass: invalidSessions.length === 0,
      evidence: invalidSessions.length === 0 ? "무효 세션 없음" : `${invalidSessions.length}개 무효 세션`,
      next: "INVALID 목록의 시간/메타데이터/checksum을 고치거나 해당 세션을 제거하세요.",
    },
    {
      label: "사람이 직접 2시간 플레이",
      pass: totalMinutes >= 120 && difficulties.every((id) => (minutesByDifficulty.get(id) ?? 0) >= 12),
      evidence: `human ${validHumanSessions.length}/${allSessions.length}세션, ${totalMinutes.toFixed(1)}/120.0분, codex-direct ${directSessionCount}세션 ${directMinutes.toFixed(1)}분, ${difficulties.map((id) => `${id} ${(minutesByDifficulty.get(id) ?? 0).toFixed(1)}분`).join(", ")}`,
      next: "총 120분 이상과 각 난이도 12분 이상을 채우세요.",
    },
    {
      label: "입문자 무전설 40R 클리어",
      pass: hasTargetSession(validHumanSessions, "novice", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0),
      evidence: targetEvidence(validHumanSessions, "novice", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0),
      next: "novice clear 40R legends=0 maxGrade=hero 이하 세션 12분 이상",
    },
    {
      label: "일반 1~2전설 40R 클리어",
      pass: hasTargetSession(validHumanSessions, "normal", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2),
      evidence: targetEvidence(validHumanSessions, "normal", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2),
      next: "normal clear 40R legends=1~2 세션 12분 이상",
    },
    {
      label: "중급자 5전설 이상 40R 클리어",
      pass: hasTargetSession(validHumanSessions, "intermediate", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5),
      evidence: targetEvidence(validHumanSessions, "intermediate", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5),
      next: "intermediate clear 40R legends>=5 세션 12분 이상",
    },
    {
      label: "고수 5전설 이하 40R 실패",
      pass: hasTargetSession(validHumanSessions, "expert", (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5),
      evidence: targetEvidence(validHumanSessions, "expert", (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5),
      next: "expert loss 40R legends<=5 세션 12분 이상",
    },
    {
      label: "고수 6전설 이상 40R 클리어",
      pass: hasTargetSession(validHumanSessions, "expert", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6),
      evidence: targetEvidence(validHumanSessions, "expert", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6),
      next: "expert clear 40R legends>=6 세션 12분 이상",
    },
    {
      label: "초고수 실패 기록",
      pass: hasTargetSession(validHumanSessions, "master", (session) => isTargetLength(session) && isLoss(session)),
      evidence: targetEvidence(validHumanSessions, "master", (session) => isTargetLength(session) && isLoss(session)),
      next: "master loss 세션 12분 이상",
    },
  ];
  const targetRows = rows.filter((row) => targetPlans.some((target) => target.label === row.label));
  const targetRowsPassed = targetRows.filter((row) => row.pass).length;

  const summary = {
    schemaVersion: 1,
    logPath: outPath,
    currentDataVersion: CURRENT_DATA_VERSION,
    logExists: existsSync(outPath),
    exampleExcluded: isExampleManualLog(log),
    nonExampleSessionCount: allSessions.length,
    validSessionCount: validSessions.length,
    validHumanSessionCount: validHumanSessions.length,
    codexDirectSessionCount: directSessionCount,
    codexDirectMinutes: directMinutes,
    invalidSessionCount: invalidSessions.length,
    invalidSessions,
    pendingCount: pending.length,
    pending,
    totalMinutes,
    requiredMinutes: 120,
    remainingMinutes: Math.max(0, 120 - totalMinutes),
    minutesByDifficulty: Object.fromEntries(difficulties.map((id) => [id, minutesByDifficulty.get(id) ?? 0])),
    targetRowsPassed,
    targetRowsTotal: targetRows.length,
    targetRowsRemaining: targetRows.length - targetRowsPassed,
    rows,
    passed: rows.every((row) => row.pass),
  };
  summary.next = buildNextFromSummary(summary).next;
  summary.commandTemplates = manualProofCommandTemplates(summary.next);
  summary.resultFieldChecklist = manualResultFieldChecklist(summary.next);
  return summary;
}

function manualProofCommandTemplates(next) {
  return {
    preflight: manualPreflightCommandTemplate(),
    preflightJson: `yarn --silent manual-playlog --preflight-json${outPathArg()}`,
    plan: manualPlanCommandTemplate(),
    planJson: `yarn --silent manual-playlog --plan-json${outPathArg()}`,
    summary: `yarn manual-playlog --summary${outPathArg()}`,
    summaryJson: `yarn --silent manual-playlog --summary-json${outPathArg()}`,
    next: `yarn manual-playlog --next${outPathArg()}`,
    nextJson: `yarn --silent manual-playlog --next-json${outPathArg()}`,
    startNext: next?.startNextCommandTemplate ?? "",
    startNextDryRun: next?.startNextDryRunCommandTemplate ?? "",
  };
}

function manualResultFieldChecklist(next) {
  const finish = next?.finishTemplate ?? null;
  return [
    { field: "seed", source: "새 게임 시작 후 상단 시드 또는 결과 화면", required: true, expected: "실제 게임 시드" },
    { field: "startedAt", source: "시작 마커 저장 명령 또는 pending 시작 마커", required: true, expected: "실제 시작 시각" },
    { field: "endedAt", source: "결과 화면 RESULT_ENDED_AT", required: true, expected: "실제 종료 시각" },
    { field: "dataVersion", source: "결과 화면 RESULT_DATA_VERSION", required: true, expected: CURRENT_DATA_VERSION },
    { field: "stateChecksum", source: "결과 화면 RESULT_CHECKSUM", required: true, expected: "8자리 checksum" },
    { field: "result", source: "결과 화면 클리어/실패 상태", required: true, expected: finish?.result ?? "clear 또는 loss" },
    { field: "round", source: "결과 화면 도달 라운드", required: true, expected: finish?.round ?? "ROUND_REACHED" },
    { field: "legends", source: "결과 화면 전설 이상 수", required: true, expected: finish?.legends ?? "FINAL_LEGENDS" },
    { field: "maxGrade", source: "결과 화면 최고 등급", required: true, expected: finish?.maxGrade ?? "MAX_GRADE" },
    { field: "minutes", source: "시작/종료 시각으로 계산된 실제 플레이 시간", required: true, expected: "12분 이상" },
  ];
}

function buildPlan() {
  return buildPlanFromSummary(buildSummary());
}

function buildPlanFromSummary(summary) {
  const missingTargets = targetPlans.filter((target) => {
    const row = summary.rows.find((item) => item.label === target.label);
    return !row?.pass;
  });
  const projectedMinutesByDifficulty = new Map(Object.entries(summary.minutesByDifficulty));
  let projectedTotalMinutes = summary.totalMinutes;
  for (const target of missingTargets) {
    projectedMinutesByDifficulty.set(
      target.difficulty,
      Number(projectedMinutesByDifficulty.get(target.difficulty) ?? 0) + target.minutes,
    );
    projectedTotalMinutes += target.minutes;
  }

  const difficultyTopUps = difficulties
    .map((difficulty) => ({
      difficulty,
      minutes: Math.max(0, 12 - Number(projectedMinutesByDifficulty.get(difficulty) ?? 0)),
    }))
    .filter((item) => item.minutes > 0);
  const projectedAfterDifficultyTopUps = projectedTotalMinutes +
    difficultyTopUps.reduce((sum, item) => sum + item.minutes, 0);
  const flexibleMinutes = Math.max(0, summary.requiredMinutes - projectedAfterDifficultyTopUps);

  return {
    schemaVersion: 1,
    logPath: summary.logPath,
    currentDataVersion: summary.currentDataVersion,
    passed: summary.passed,
    current: {
      totalMinutes: summary.totalMinutes,
      requiredMinutes: summary.requiredMinutes,
      remainingMinutes: summary.remainingMinutes,
      minutesByDifficulty: summary.minutesByDifficulty,
      validSessionCount: summary.validSessionCount,
      invalidSessionCount: summary.invalidSessionCount,
      pendingCount: summary.pendingCount,
      targetRowsPassed: summary.targetRowsPassed,
      targetRowsTotal: summary.targetRowsTotal,
      targetRowsRemaining: summary.targetRowsRemaining,
    },
    steps: [
      ...missingTargets.map((target) => ({
        kind: "target-session",
        difficulty: target.difficulty,
        minutes: target.minutes,
        label: target.label,
        goal: target.goal,
        logHint: target.logHint,
        startCommandTemplate: startCommandTemplate(target),
        startCommandDryRunTemplate: dryRunCommandTemplate(startCommandTemplate(target)),
        startNextCommandTemplate: startNextCommandTemplate(target),
        startNextDryRunCommandTemplate: dryRunCommandTemplate(startNextCommandTemplate(target)),
        finishTemplate: finishTemplateForNext(target),
      })),
      ...difficultyTopUps.map((item) => ({
        kind: "difficulty-minimum",
        difficulty: item.difficulty,
        minutes: item.minutes,
        label: `${item.difficulty} 최소 시간 보충`,
        goal: `${item.difficulty} 난이도 유효 수동 플레이 ${item.minutes.toFixed(1)}분 추가`,
        logHint: "결과 화면의 yarn manual-playlog 명령 사용",
        startCommandTemplate: startCommandTemplate({
          difficulty: item.difficulty,
          label: `${item.difficulty} 최소 시간 보충`,
        }),
        startCommandDryRunTemplate: dryRunCommandTemplate(startCommandTemplate({
          difficulty: item.difficulty,
          label: `${item.difficulty} 최소 시간 보충`,
        })),
        startNextCommandTemplate: startNextCommandTemplate(item),
        startNextDryRunCommandTemplate: dryRunCommandTemplate(startNextCommandTemplate(item)),
        finishTemplate: finishTemplateForNext(item),
      })),
      ...(flexibleMinutes > 0
        ? [{
          kind: "total-minutes",
          difficulty: "any",
          minutes: flexibleMinutes,
          label: "총 120분 보충",
          goal: `목표 세션 이후 남는 ${flexibleMinutes.toFixed(1)}분을 실제 플레이로 추가`,
          logHint: "요약 명령의 다음 필요 항목을 보며 어떤 난이도든 실제 결과 기록",
          startCommandTemplate: "",
          startCommandDryRunTemplate: "",
          startNextCommandTemplate: startNextCommandTemplate({ difficulty: "any" }),
          startNextDryRunCommandTemplate: dryRunCommandTemplate(startNextCommandTemplate({ difficulty: "any" })),
          finishTemplate: finishTemplateForNext(null),
        }]
        : []),
    ],
  };
}

function printSummary() {
  const summary = buildSummary();
  console.log("# 수동 플레이 로그 상태");
  console.log(`- 로그: ${summary.logPath}${summary.logExists ? "" : " (아직 없음)"}`);
  console.log(`- 예시 로그 제외: ${summary.exampleExcluded ? "예" : "아니오"}`);
  console.log(`- 무효 세션: ${summary.invalidSessionCount}개`);
  console.log(`- 시작 마커 대기: ${summary.pendingCount}개`);
  console.log(`- 유효 플레이 시간: ${summary.totalMinutes.toFixed(1)}/${summary.requiredMinutes.toFixed(1)}분, 남은 ${summary.remainingMinutes.toFixed(1)}분`);
  console.log(`- 목표 세션: ${summary.targetRowsPassed}/${summary.targetRowsTotal}개 완료, 남은 ${summary.targetRowsRemaining}개`);
  console.log("");
  if (summary.invalidSessionCount > 0) {
    console.log("INVALID 증거로 인정되지 않은 세션:");
    for (const session of summary.invalidSessions) {
      const label = [
        `#${session.index + 1}`,
        session.difficulty || "difficulty?",
        session.result || "result?",
        `${session.round || "?"}R`,
        session.seed ? `seed=${session.seed}` : "",
        session.checksum ? `#${session.checksum}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  - ${label}: ${session.issues.join(", ")}`);
    }
    console.log("");
  }
  if (summary.pendingCount > 0) {
    console.log("PENDING 아직 finish되지 않은 시작 마커:");
    for (const session of summary.pending) {
      console.log(`  - ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
      console.log(`    경과: ${pendingTimingLabel(session)}`);
      if (session.finishDryRunCommandTemplate) {
        console.log(`    저장 전 검증 템플릿: ${session.finishDryRunCommandTemplate}`);
      }
      if (session.finishCommandTemplate) {
        console.log(`    마무리 템플릿: ${session.finishCommandTemplate}`);
      }
    }
    console.log("  새 시작 마커 추천은 pending 시작 마커를 finish한 뒤 다시 표시됩니다.");
    console.log("");
  }
  for (const row of summary.rows) {
    console.log(`${row.pass ? "PASS" : "MISSING"} ${row.label}: ${row.evidence}`);
    if (!row.pass) console.log(`  다음 필요: ${row.next}`);
  }
  const next = buildNext();
  if (next.next?.startNextCommandTemplate) {
    console.log("");
    console.log("시작 전 점검:");
    console.log(manualPreflightCommandTemplate());
    console.log("전체 수집 계획:");
    console.log(manualPlanCommandTemplate());
    if (next.next.startNextDryRunCommandTemplate) {
      console.log("추천 시작 검증:");
      console.log(next.next.startNextDryRunCommandTemplate);
    }
    console.log("추천 시작 마커:");
    console.log(next.next.startNextCommandTemplate);
    console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
  }
  console.log("");
  console.log(`판정: ${summary.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printSummaryJson() {
  console.log(`${JSON.stringify(buildSummary(), null, 2)}`);
}

function printPlan() {
  const plan = buildPlan();
  console.log("# 수동 플레이 증거 수집 계획");
  console.log(`- 로그: ${plan.logPath}`);
  console.log(`- 현재: ${plan.current.validSessionCount}세션, ${plan.current.totalMinutes.toFixed(1)}/${plan.current.requiredMinutes.toFixed(1)}분`);
  console.log(`- 남은 유효 플레이 시간: ${plan.current.remainingMinutes.toFixed(1)}분`);
  console.log(`- 목표 세션: ${plan.current.targetRowsPassed}/${plan.current.targetRowsTotal}개 완료, 남은 ${plan.current.targetRowsRemaining}개`);
  console.log(`- 무효 세션: ${plan.current.invalidSessionCount}개`);
  console.log(`- 시작 마커 대기: ${plan.current.pendingCount}개`);
  console.log(`- 난이도별: ${difficulties.map((id) => `${id} ${Number(plan.current.minutesByDifficulty[id] ?? 0).toFixed(1)}분`).join(", ")}`);
  console.log("");
  if (plan.steps.length === 0) {
    console.log("PASS 수동 플레이 증거 계획상 남은 항목이 없습니다.");
  } else {
    plan.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.label} (${step.minutes.toFixed(1)}분 이상)`);
      console.log(`   목표: ${step.goal}`);
      console.log(`   기록 힌트: ${step.logHint}`);
      if (step.finishTemplate) {
        console.log(`   마무리 조건: result=${step.finishTemplate.result} round=${step.finishTemplate.round} legends=${step.finishTemplate.legends} maxGrade=${step.finishTemplate.maxGrade}`);
      }
      if (step.startNextDryRunCommandTemplate) {
        console.log(`   추천 시작 검증: ${step.startNextDryRunCommandTemplate}`);
      }
      if (step.startNextCommandTemplate) {
        console.log(`   추천 시작 마커: ${step.startNextCommandTemplate}`);
      }
      if (step.startCommandDryRunTemplate) {
        console.log(`   직접 시작 검증: ${step.startCommandDryRunTemplate}`);
      }
      if (step.startCommandTemplate) {
        console.log(`   직접 시작 마커: ${step.startCommandTemplate}`);
      }
    });
  }
  console.log("");
  console.log(`판정: ${plan.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printPlanJson() {
  console.log(`${JSON.stringify(buildPlan(), null, 2)}`);
}

function buildNext() {
  return buildNextFromSummary(buildSummary());
}

function buildNextFromSummary(summary) {
  const plan = buildPlanFromSummary(summary);
  const blockedByPendingStartMarkers = summary.pendingCount > 0;
  const nextStep = plan.steps[0] ?? null;
  return {
    schemaVersion: 1,
    logPath: plan.logPath,
    passed: plan.passed,
    current: plan.current,
    blockedByPendingStartMarkers,
    pending: summary.pending,
    next: blockedByPendingStartMarkers ? null : nextStep
      ? {
        ...nextStep,
        startNextCommandTemplate: startNextCommandTemplate(nextStep),
        startNextDryRunCommandTemplate: dryRunCommandTemplate(startNextCommandTemplate(nextStep)),
      }
      : null,
  };
}

function printNext() {
  const next = buildNext();
  console.log("# 다음 수동 플레이 세션");
  console.log(`- 로그: ${next.logPath}`);
  console.log(`- 현재: ${next.current.validSessionCount}세션, ${next.current.totalMinutes.toFixed(1)}/${next.current.requiredMinutes.toFixed(1)}분`);
  console.log("");
  if (next.blockedByPendingStartMarkers) {
    console.log("PENDING 먼저 finish해야 하는 시작 마커가 있습니다. 새 시작 마커는 pending 정리 후 만드세요.");
    for (const session of next.pending) {
      console.log(`  - ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
      console.log(`    경과: ${pendingTimingLabel(session)}`);
      if (session.finishDryRunCommandTemplate) {
        console.log(`    저장 전 검증 템플릿: ${session.finishDryRunCommandTemplate}`);
      }
      if (session.finishCommandTemplate) {
        console.log(`    마무리 템플릿: ${session.finishCommandTemplate}`);
      }
    }
  } else if (!next.next) {
    console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
  } else {
    console.log(`${next.next.label} (${next.next.minutes.toFixed(1)}분 이상)`);
    console.log(`목표: ${next.next.goal}`);
    console.log(`기록 힌트: ${next.next.logHint}`);
    if (next.next.finishTemplate) {
      console.log(`마무리 조건: result=${next.next.finishTemplate.result} round=${next.next.finishTemplate.round} legends=${next.next.finishTemplate.legends} maxGrade=${next.next.finishTemplate.maxGrade}`);
    }
    if (next.next.startNextCommandTemplate) {
      if (next.next.startNextDryRunCommandTemplate) {
        console.log("추천 시작 검증:");
        console.log(next.next.startNextDryRunCommandTemplate);
      }
      console.log("추천 시작 마커:");
      console.log(next.next.startNextCommandTemplate);
      console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    }
    if (next.next.startCommandTemplate) {
      if (next.next.startCommandDryRunTemplate) {
        console.log("직접 시작 검증:");
        console.log(next.next.startCommandDryRunTemplate);
      }
      console.log("직접 시작 마커:");
      console.log(next.next.startCommandTemplate);
      console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    }
  }
  console.log("");
  console.log(`판정: ${next.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printNextJson() {
  console.log(`${JSON.stringify(buildNext(), null, 2)}`);
}

function manualStartWorkflow() {
  return [
    "게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인",
    "추천 시작 검증 명령의 GAME_SEED_HERE를 실제 시드로 바꿔 --dry-run 실행",
    "검증이 통과하면 같은 명령에서 --dry-run을 빼고 시작 마커 저장",
    "12분 이상 실제로 플레이하고 목표 결과 조건 확인",
    "결과 화면의 dataVersion/stateChecksum/endedAt 값으로 finish --dry-run 실행 후 실제 finish 저장",
  ];
}

function manualPreflightCommandTemplate() {
  return `yarn manual-playlog --preflight${outPathArg()}`;
}

function manualPlanCommandTemplate() {
  return `yarn manual-playlog --plan${outPathArg()}`;
}

function printPreflight() {
  const preflight = buildPreflight();
  const { summary, blocking } = preflight;
  console.log("# 수동 플레이 시작 전 점검");
  console.log(`- 로그: ${summary.logPath}${summary.logExists ? "" : " (아직 없음)"}`);
  console.log(`- 무효 세션: ${summary.invalidSessionCount}개`);
  console.log(`- 시작 마커 대기: ${summary.pendingCount}개`);
  console.log(`- 유효 사람 플레이 시간: ${summary.totalMinutes.toFixed(1)}/${summary.requiredMinutes.toFixed(1)}분, 남은 ${summary.remainingMinutes.toFixed(1)}분`);
  if (summary.codexDirectSessionCount > 0 || summary.codexDirectMinutes > 0) {
    console.log(`- Codex 직접 조작 보조 시간: ${summary.codexDirectSessionCount}세션, ${summary.codexDirectMinutes.toFixed(1)}분 (사람 120분 증거에는 미포함)`);
  }
  console.log(`- 목표 세션: ${summary.targetRowsPassed}/${summary.targetRowsTotal}개 완료, 남은 ${summary.targetRowsRemaining}개`);
  console.log(`- 남은 수집 계획: ${preflight.remainingPlanStepCount}단계`);
  console.log("");
  if (summary.invalidSessionCount > 0) {
    console.log("INVALID 먼저 고쳐야 하는 세션:");
    for (const session of summary.invalidSessions) {
      const label = [
        `#${session.index + 1}`,
        session.difficulty || "difficulty?",
        session.result || "result?",
        `${session.round || "?"}R`,
        session.seed ? `seed=${session.seed}` : "",
        session.checksum ? `#${session.checksum}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  - ${label}: ${session.issues.join(", ")}`);
    }
    console.log("");
  }
  if (summary.pendingCount > 0) {
    console.log("PENDING 새 시작 전에 먼저 finish해야 하는 시작 마커:");
    for (const session of summary.pending) {
      console.log(`  - ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
      console.log(`    경과: ${pendingTimingLabel(session)}`);
      if (session.finishDryRunCommandTemplate) {
        console.log(`    저장 전 검증 템플릿: ${session.finishDryRunCommandTemplate}`);
      }
      if (session.finishCommandTemplate) {
        console.log(`    마무리 템플릿: ${session.finishCommandTemplate}`);
      }
    }
    console.log("");
  }
  if (blocking) {
    console.log("FAIL 새 수동 플레이 시작 전 정리 필요");
  } else {
    console.log("PASS 새 수동 플레이 시작 가능");
    if (preflight.nextStartCommandTemplate) {
      if (preflight.nextStartDryRunCommandTemplate) {
        console.log("추천 시작 검증:");
        console.log(preflight.nextStartDryRunCommandTemplate);
      }
      console.log("추천 시작 마커:");
      console.log(preflight.nextStartCommandTemplate);
      console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    }
    console.log("");
    console.log("실행 순서:");
    manualStartWorkflow().forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    console.log("");
    console.log("전체 수집 계획:");
    console.log(preflight.planCommandTemplate);
    console.log("");
    console.log("결과 기록 필드:");
    for (const item of preflight.resultFieldChecklist) {
      console.log(`- ${item.field}: ${item.source} (기대값: ${item.expected})`);
    }
    if (preflight.remainingPlanPreview.length > 0) {
      console.log("남은 계획 첫 항목:");
      const first = preflight.remainingPlanPreview[0];
      console.log(`- ${first.label} (${first.minutes.toFixed(1)}분 이상)`);
      console.log(`  목표: ${first.goal}`);
    }
  }
  console.log("");
  console.log(`판정: ${blocking ? "정리 필요" : "시작 가능"}`);
  if (blocking) process.exitCode = 1;
}

function buildPreflight() {
  const summary = buildSummary();
  const plan = buildPlanFromSummary(summary);
  const blockingReasons = [
    ...(summary.invalidSessionCount > 0 ? ["invalidSessions"] : []),
    ...(summary.pendingCount > 0 ? ["pendingStartMarkers"] : []),
  ];
  const blocking = blockingReasons.length > 0;
  return {
    schemaVersion: 1,
    logPath: summary.logPath,
    currentDataVersion: summary.currentDataVersion,
    logExists: summary.logExists,
    canStart: !blocking,
    blocking,
    blockingReasons,
    invalidSessionCount: summary.invalidSessionCount,
    invalidSessions: summary.invalidSessions,
    pendingCount: summary.pendingCount,
    pending: summary.pending,
    totalMinutes: summary.totalMinutes,
    requiredMinutes: summary.requiredMinutes,
    remainingMinutes: summary.remainingMinutes,
    targetRowsPassed: summary.targetRowsPassed,
    targetRowsTotal: summary.targetRowsTotal,
    targetRowsRemaining: summary.targetRowsRemaining,
    next: summary.next,
    nextStartCommandTemplate: summary.next?.startNextCommandTemplate ?? "",
    nextStartDryRunCommandTemplate: summary.next?.startNextDryRunCommandTemplate ?? "",
    planCommandTemplate: manualPlanCommandTemplate(),
    remainingPlanStepCount: plan.steps.length,
    remainingPlanPreview: plan.steps.slice(0, 3),
    resultFieldChecklist: summary.resultFieldChecklist,
    startWorkflow: manualStartWorkflow(),
    summary,
  };
}

function printPreflightJson() {
  const preflight = buildPreflight();
  console.log(`${JSON.stringify(preflight, null, 2)}`);
  if (preflight.blocking) process.exitCode = 1;
}

function pendingSessions(log) {
  return (log.pendingSessions ?? []).filter((session) => !isExampleManualSession(session));
}

function targetPlanForPendingSession(session) {
  const notes = String(session?.notes ?? "");
  return targetPlans.find((target) => target.label === notes) ?? null;
}

function targetPlanForNotes(notes) {
  return targetPlans.find((target) => target.label === String(notes ?? "")) ?? null;
}

function pendingTiming(startedAt) {
  const startedAtMs = new Date(String(startedAt ?? "")).getTime();
  const nowMs = Date.now();
  const elapsedSeconds = Number.isFinite(startedAtMs)
    ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
    : 0;
  const elapsedMinutes = elapsedSeconds / 60;
  const remainingTargetMinutes = Math.max(0, PENDING_TARGET_MINUTES - elapsedMinutes);
  return {
    elapsedSeconds,
    elapsedMinutes: Number(elapsedMinutes.toFixed(1)),
    targetMinutes: PENDING_TARGET_MINUTES,
    remainingTargetMinutes: Number(remainingTargetMinutes.toFixed(1)),
    targetReady: elapsedMinutes >= PENDING_TARGET_MINUTES,
  };
}

function pendingTimingLabel(session) {
  if (session.targetReady) {
    return `12분 목표 충족 (${session.elapsedMinutes.toFixed(1)}분 경과)`;
  }
  return `12분까지 ${session.remainingTargetMinutes.toFixed(1)}분 남음 (${session.elapsedMinutes.toFixed(1)}분 경과)`;
}

function pendingSessionWithCommands(session) {
  const id = String(session.id ?? "");
  const timing = pendingTiming(session.startedAt);
  const next = targetPlanForPendingSession(session);
  return {
    ...session,
    ...timing,
    finishCommandTemplate: id
      ? finishCommandTemplate({ id, next })
      : "",
    finishDryRunCommandTemplate: id
      ? finishDryRunCommandTemplate({ id, next })
      : "",
  };
}

function latestPendingSession(log) {
  const pending = pendingSessions(log);
  return pending
    .slice()
    .sort((a, b) => {
      const aTime = new Date(String(a.startedAt ?? "")).getTime();
      const bTime = new Date(String(b.startedAt ?? "")).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })[0] ?? null;
}

function findMatchingPendingSession(log, { difficulty, stage, seed, startedAt }) {
  if (!startedAt) return null;
  const startedAtMs = startedAt.getTime();
  const matches = pendingSessions(log).filter((session) => {
    const pendingStartedAtMs = new Date(String(session.startedAt ?? "")).getTime();
    return String(session.difficulty ?? "") === difficulty &&
      Number(session.stage) === Number(stage) &&
      String(session.seed ?? "") === seed &&
      Number.isFinite(pendingStartedAtMs) &&
      pendingStartedAtMs === startedAtMs;
  });
  return matches.length === 1 ? matches[0] : null;
}

function buildPending() {
  const log = readJson(outPath);
  const pendingId = args["pending-id"] !== undefined ? String(args["pending-id"]) : "";
  const pending = pendingSessions(log)
    .filter((session) => !pendingId || String(session.id ?? "") === pendingId)
    .map(pendingSessionWithCommands);
  return {
    schemaVersion: 1,
    logPath: outPath,
    ...(pendingId ? { pendingId } : {}),
    pendingCount: pending.length,
    pending,
  };
}

function printPending() {
  const pending = buildPending();
  console.log(pending.pendingId ? "# 수동 플레이 시작 마커 확인" : "# 수동 플레이 시작 마커");
  console.log(`- 로그: ${pending.logPath}`);
  if (pending.pendingId) console.log(`- 확인 id: ${pending.pendingId}`);
  console.log(`- 대기 중: ${pending.pendingCount}개`);
  console.log("");
  if (pending.pending.length === 0) {
    console.log(pending.pendingId
      ? "해당 id의 시작 마커가 없습니다. 실제 시작 마커 저장 명령을 먼저 실행하세요."
      : "대기 중인 시작 마커가 없습니다.");
    if (pending.pendingId) process.exitCode = 1;
    return;
  }
  for (const session of pending.pending) {
    console.log(`- ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
    console.log(`  경과: ${pendingTimingLabel(session)}`);
    if (session.finishDryRunCommandTemplate) {
      console.log(`  저장 전 검증 템플릿: ${session.finishDryRunCommandTemplate}`);
    }
    if (session.finishCommandTemplate) {
      console.log(`  마무리 템플릿: ${session.finishCommandTemplate}`);
    }
  }
}

function printPendingJson() {
  const pending = buildPending();
  console.log(`${JSON.stringify(pending, null, 2)}`);
  if (pending.pendingId && pending.pendingCount === 0) process.exitCode = 1;
}

function assertManualProof() {
  const summary = buildSummary();
  if (summary.passed) {
    console.log("PASS 수동 플레이 증거 충족");
    return;
  }
  printSummary();
  const next = buildNext();
  if (next.blockedByPendingStartMarkers) {
    console.error("");
    console.error("대기 중인 수동 시작 마커를 먼저 finish하세요. 새 시작 마커 추천은 pending 정리 후 표시됩니다.");
  } else if (next.next) {
    console.error("");
    console.error(`다음 필요 세션: ${next.next.label} (${next.next.minutes.toFixed(1)}분 이상)`);
    console.error(`목표: ${next.next.goal}`);
    console.error(`시작 전 점검: ${manualPreflightCommandTemplate()}`);
    console.error(`전체 수집 계획: ${manualPlanCommandTemplate()}`);
    if (next.next.startNextDryRunCommandTemplate) {
      console.error(`추천 시작 검증: ${next.next.startNextDryRunCommandTemplate}`);
    }
    if (next.next.startNextCommandTemplate) {
      console.error(`추천 시작 마커: ${next.next.startNextCommandTemplate}`);
    }
  }
  process.exit(1);
}

function makePendingId({ difficulty, stage, seed, startedAt }) {
  const suffix = String(startedAt).replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
  return `${difficulty}-${stage}-${String(seed).replace(/[^0-9A-Za-z_-]/g, "")}-${suffix}`;
}

function finishTemplateForNext(step) {
  const base = {
    result: "loss",
    round: "ROUND_REACHED",
    legends: "FINAL_LEGENDS",
    maxGrade: "MAX_GRADE",
  };
  if (!step) return base;
  switch (step.label) {
    case "입문자 무전설 40R 클리어":
      return { result: "clear", round: "40", legends: "0", maxGrade: "hero" };
    case "일반 1~2전설 40R 클리어":
      return { result: "clear", round: "40", legends: "1", maxGrade: "legend" };
    case "중급자 5전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "5", maxGrade: "legend" };
    case "고수 5전설 이하 40R 실패":
      return { result: "loss", round: "40", legends: "5", maxGrade: "legend" };
    case "고수 6전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "6", maxGrade: "legend" };
    case "초고수 실패 기록":
      return { result: "loss", round: "ROUND_REACHED", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
    default:
      return base;
  }
}

function startNextCommandTemplate(step) {
  if (!step) return "";
  const difficultyArg = ` --difficulty=${step.difficulty === "any" ? "DIFFICULTY" : step.difficulty}`;
  return `yarn manual-playlog --start-next${difficultyArg} --seed=GAME_SEED_HERE${outPathArg()}`;
}

function finishCommandTemplate({ id, next }) {
  const template = finishTemplateForNext(next);
  return [
    `yarn manual-playlog --finish=${shellArg(id)}`,
    `--result=${template.result}`,
    `--round=${template.round}`,
    `--legends=${template.legends}`,
    `--maxGrade=${template.maxGrade}`,
    "--dataVersion=RESULT_DATA_VERSION",
    "--stateChecksum=RESULT_CHECKSUM",
    "--endedAt=RESULT_ENDED_AT",
  ].join(" ") + outPathArg();
}

function finishDryRunCommandTemplate({ id, next }) {
  return `${finishCommandTemplate({ id, next })} --dry-run`;
}

function isDryRun() {
  return args["dry-run"] === "true";
}

function savePendingSession({ difficulty, stage, seed, startedAt, id, notes, source }) {
  const log = readJson(outPath);
  log.schemaVersion = 1;
  log.source = "manual-playlog";
  if ((log.pendingSessions ?? []).some((session) => String(session.id) === id)) {
    fail(`이미 같은 시작 마커가 있습니다: ${id}`);
  }
  log.pendingSessions = log.pendingSessions ?? [];
  log.pendingSessions.push({
    id,
    source: startSourceForSession(source),
    difficulty,
    stage,
    seed,
    startedAt: startedAt.toISOString(),
    ...(notes ? { notes } : {}),
  });

  const dir = dirname(outPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
}

function printStartSaved({ id, startedAt, source, next, dryRun = false }) {
  console.log(dryRun
    ? `DRY-RUN 수동 플레이 시작 마커 검증 통과: ${outPath}`
    : `수동 플레이 시작 마커 저장: ${outPath}`);
  if (next?.label) {
    console.log(`- 목표: ${next.label}`);
    if (next.goal) console.log(`- 플레이 조건: ${next.goal}`);
    if (next.logHint) console.log(`- 기록 조건: ${next.logHint}`);
  }
  console.log(`- id: ${id}`);
  if (source) console.log(`- 출처: ${source}`);
  console.log(`- 시작: ${startedAt.toISOString()}`);
  if (dryRun) {
    console.log("- 로그 쓰기: 안 함");
  }
  console.log("");
  if (dryRun) {
    console.log("아래 finish 명령은 dry-run 검증용 임시 id 예시입니다. 실제 플레이를 기록하려면 먼저 --dry-run을 뺀 시작 마커 저장 명령을 실행하고, 그 출력 또는 yarn manual-playlog --pending의 id를 사용하세요.");
    console.log("");
  }
  console.log("결과가 나오면 먼저 아래 형식으로 저장 전 검증을 실행하세요:");
  console.log(finishDryRunCommandTemplate({ id, next }));
  console.log("");
  console.log("검증이 통과하면 아래 형식으로 실제 저장하세요. RESULT_ENDED_AT은 결과 화면의 종료 시각을 사용하세요:");
  console.log(finishCommandTemplate({ id, next }));
  if (dryRun) {
    console.log("");
    console.log("시작 마커를 실제로 저장하려면 같은 명령에서 --dry-run을 빼고 실행하세요.");
  }
}

function failIfPendingStartExists() {
  const pending = buildPending().pending;
  if (pending.length === 0) return;
  const first = pending[0];
  const lines = [
    `이미 finish되지 않은 수동 시작 마커가 ${pending.length}개 있습니다.`,
    "새 start-next를 만들기 전에 기존 시작 마커를 먼저 마무리하세요.",
  ];
  if (first?.finishCommandTemplate) {
    lines.push(`마무리 템플릿: ${first.finishCommandTemplate}`);
  }
  fail(lines.join("\n"));
}

function failIfInvalidManualSessionsExist() {
  const summary = buildSummary();
  if (summary.invalidSessionCount === 0) return;
  const first = summary.invalidSessions[0];
  const label = first
    ? [
      `#${first.index + 1}`,
      first.difficulty || "difficulty?",
      first.result || "result?",
      `${first.round || "?"}R`,
      first.seed ? `seed=${first.seed}` : "",
      first.checksum ? `#${first.checksum}` : "",
    ].filter(Boolean).join(" ")
    : "";
  const lines = [
    `수동 로그에 무효 세션이 ${summary.invalidSessionCount}개 있습니다.`,
    "새 수동 시작 마커를 만들기 전에 기존 INVALID 세션을 고치거나 제거하세요.",
  ];
  if (label) lines.push(`첫 무효 세션: ${label}: ${first.issues.join(", ")}`);
  lines.push(`확인 명령: yarn manual-playlog --summary${outPathArg()}`);
  fail(lines.join("\n"));
}

function requireStartSeed() {
  const seed = String(args.seed ?? "").trim();
  if (!seed) fail("--seed 값이 필요합니다.");
  if (seed === "GAME_SEED_HERE") {
    fail("--seed=GAME_SEED_HERE는 템플릿 placeholder입니다. 게임 화면의 실제 시드로 바꿔 실행하세요.");
  }
  return seed;
}

function failIfPlaceholderValue(name, value, placeholder, replacement) {
  if (String(value ?? "") === placeholder) {
    fail(`--${name}=${placeholder}는 템플릿 placeholder입니다. ${replacement} 값을 사용하세요.`);
  }
}

function startManualSession() {
  failIfInvalidManualSessionsExist();
  const difficulty = String(args.difficulty ?? "");
  if (!difficulties.includes(difficulty)) {
    fail(`지원하지 않는 난이도입니다: ${difficulty || "(없음)"}`);
  }
  const stage = requireNumber("stage");
  if (!isValidStageId(stage)) {
    fail(`--stage는 실제 맵 번호 ${validStageLabel()} 중 하나여야 합니다. 결과 화면의 실제 맵 번호를 입력하세요.`);
  }
  const seed = requireStartSeed();
  const startedAt = parseDate("startedAt", args.startedAt) ?? new Date();
  const id = String(args.id ?? makePendingId({ difficulty, stage, seed, startedAt: startedAt.toISOString() }));
  const source = normalizeSessionSource(args.source);
  const notes = args.notes ? String(args.notes) : "";
  const next = targetPlanForNotes(notes);
  if (!id.trim()) fail("--id 값이 비어 있습니다.");
  if (next && next.difficulty !== difficulty) {
    fail(`--notes 목표는 ${next.difficulty} 난이도입니다. --difficulty=${difficulty}와 함께 시작할 수 없습니다.`);
  }

  if (!isDryRun()) {
    savePendingSession({
      id,
      difficulty,
      stage,
      seed,
      startedAt,
      notes,
      source,
    });
  }

  printStartSaved({ id, startedAt, source, next, dryRun: isDryRun() });
}

function startNextManualSession() {
  failIfInvalidManualSessionsExist();
  failIfPendingStartExists();
  const next = buildNext().next;
  if (!next) {
    console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
    return;
  }
  const requestedDifficulty = args.difficulty === undefined ? "" : String(args.difficulty);
  const difficulty = next.difficulty === "any"
    ? (requestedDifficulty || "novice")
    : (requestedDifficulty || next.difficulty);
  if (!difficulties.includes(difficulty)) {
    fail(`지원하지 않는 난이도입니다: ${difficulty || "(없음)"}`);
  }
  if (next.difficulty !== "any" && requestedDifficulty && requestedDifficulty !== next.difficulty) {
    fail(`다음 필요 세션은 ${next.difficulty} 난이도입니다. --difficulty=${requestedDifficulty}로 시작할 수 없습니다.`);
  }
  const stage = optionalNumber("stage", 1);
  if (!isValidStageId(stage)) {
    fail(`--stage는 실제 맵 번호 ${validStageLabel()} 중 하나여야 합니다. 결과 화면의 실제 맵 번호를 입력하세요.`);
  }
  const seed = requireStartSeed();
  const startedAt = parseDate("startedAt", args.startedAt) ?? new Date();
  const id = String(args.id ?? makePendingId({ difficulty, stage, seed, startedAt: startedAt.toISOString() }));
  const source = normalizeSessionSource(args.source);
  if (!id.trim()) fail("--id 값이 비어 있습니다.");
  if (!isDryRun()) {
    savePendingSession({
      id,
      difficulty,
      stage,
      seed,
      startedAt,
      notes: args.notes ? String(args.notes) : String(next.label),
      source,
    });
  }
  printStartSaved({ id, startedAt, source, next, dryRun: isDryRun() });
}

if (args.summary === "true" || args.status === "true") {
  if (args.json === "true" || args["summary-json"] === "true") printSummaryJson();
  else printSummary();
  process.exit(0);
}

if (args.plan === "true") {
  if (args.json === "true" || args["plan-json"] === "true") printPlanJson();
  else printPlan();
  process.exit(0);
}

if (args.next === "true") {
  if (args.json === "true" || args["next-json"] === "true") printNextJson();
  else printNext();
  process.exit(0);
}

if (args.pending === "true") {
  if (args.json === "true" || args["pending-json"] === "true") printPendingJson();
  else printPending();
  process.exit(0);
}

if (args["pending-id"] !== undefined) {
  if (args.json === "true" || args["pending-id-json"] === "true") printPendingJson();
  else printPending();
  process.exit(process.exitCode ?? 0);
}

if (args.preflight === "true") {
  if (args.json === "true" || args["preflight-json"] === "true") printPreflightJson();
  else printPreflight();
  process.exit(process.exitCode ?? 0);
}

if (args.assert === "true") {
  assertManualProof();
  process.exit(0);
}

if (args["summary-json"] === "true") {
  printSummaryJson();
  process.exit(0);
}

if (args["plan-json"] === "true") {
  printPlanJson();
  process.exit(0);
}

if (args["next-json"] === "true") {
  printNextJson();
  process.exit(0);
}

if (args["pending-json"] === "true") {
  printPendingJson();
  process.exit(0);
}

if (args["pending-id-json"] === "true") {
  if (args["pending-id"] === undefined) fail("--pending-id-json에는 --pending-id=RUN1이 필요합니다.");
  printPendingJson();
  process.exit(process.exitCode ?? 0);
}

if (args["preflight-json"] === "true") {
  printPreflightJson();
  process.exit(process.exitCode ?? 0);
}

if (args["start-next"] === "true") {
  startNextManualSession();
  process.exit(0);
}

if (args.start === "true") {
  startManualSession();
  process.exit(0);
}

const explicitFinishId = typeof args.finish === "string" && args.finish !== "true" ? args.finish : "";
const finishLatest = args["finish-latest"] === "true" || args.finish === "true";
const dryRun = args["dry-run"] === "true";
const finishLog = explicitFinishId || finishLatest ? readJson(outPath) : null;
const latestPending = finishLatest ? latestPendingSession(finishLog) : null;
const requestedFinishId = explicitFinishId || (latestPending ? String(latestPending.id) : "");
const requestedPendingFinish = requestedFinishId
  ? pendingSessions(finishLog).find((session) => String(session.id) === requestedFinishId)
  : null;
if (finishLatest && !latestPending) {
  fail("--finish-latest에 사용할 시작 마커가 없습니다.");
}
if (requestedFinishId && !requestedPendingFinish) {
  fail(`--finish 시작 마커를 찾을 수 없습니다: ${requestedFinishId}`);
}

const difficulty = args.difficulty ?? requestedPendingFinish?.difficulty;
if (!difficulties.includes(difficulty)) {
  fail(`지원하지 않는 난이도입니다: ${difficulty ?? "(없음)"}`);
}

const result = String(args.result ?? "").toLowerCase();
if (!results.includes(result)) {
  fail(`--result 값은 ${results.join("|")} 중 하나여야 합니다.`);
}

const stage = optionalNumber("stage", requestedPendingFinish?.stage);
if (stage === undefined) fail("--stage 값이 필요합니다.");
const round = requireNumber("round");
const legends = requireNumber("legends");
const seed = String(args.seed ?? requestedPendingFinish?.seed ?? "");
if (!seed) fail("--seed 값이 필요합니다.");
failIfPlaceholderValue("seed", seed, "GAME_SEED_HERE", "게임 화면의 실제 시드");

const maxGrade = String(args.maxGrade ?? "");
if (!grades.includes(maxGrade)) {
  fail(`--maxGrade 값은 ${grades.join("|")} 중 하나여야 합니다.`);
}
const dataVersion = String(args.dataVersion ?? "");
if (!dataVersion) fail("--dataVersion 값이 필요합니다.");
failIfPlaceholderValue("dataVersion", dataVersion, "RESULT_DATA_VERSION", "결과 화면의 실제 데이터 버전");
if (CURRENT_DATA_VERSION && dataVersion !== CURRENT_DATA_VERSION) {
  fail(`--dataVersion ${dataVersion}은 현재 DATA_VERSION ${CURRENT_DATA_VERSION}와 다릅니다. 결과 화면의 실제 데이터 버전을 사용하세요.`);
}
const stateChecksum = String(args.stateChecksum ?? "");
failIfPlaceholderValue("stateChecksum", stateChecksum, "RESULT_CHECKSUM", "결과 화면의 실제 상태 체크섬");
if (!/^[0-9a-f]{8}$/i.test(stateChecksum)) {
  fail("--stateChecksum 값은 결과 리포트의 8자리 16진 체크섬이어야 합니다.");
}
if (!isValidStageId(stage)) {
  fail(`--stage는 실제 맵 번호 ${validStageLabel()} 중 하나여야 합니다. 결과 화면의 실제 맵 번호를 입력하세요.`);
}
if (round < 1 || legends < 0) {
  fail("--round는 1 이상, --legends는 0 이상이어야 합니다.");
}
if (round > FINAL_ROUND) {
  fail(`--round는 최종 라운드 ${FINAL_ROUND}을 넘을 수 없습니다. 결과 화면의 실제 라운드를 입력하세요.`);
}
if (result === "clear" && round < FINAL_ROUND) {
  fail(`--result=clear는 ${FINAL_ROUND}R 최종 보스 클리어 결과에서만 사용할 수 있습니다. 결과 화면의 실제 result/round 값을 입력하세요.`);
}
if (!isLegendMetadataConsistent(maxGrade, legends)) {
  fail("--legends와 --maxGrade가 모순됩니다. 전설 이상 보유 수와 최고 등급을 결과 리포트 그대로 입력하세요.");
}

const minutes = asNumber("minutes");
const seconds = asNumber("seconds");
const now = new Date();
failIfPlaceholderValue("endedAt", args.endedAt, "RESULT_ENDED_AT", "결과 화면의 실제 종료 시각");
let endedAt = parseDate("endedAt", args.endedAt) ?? now;
let startedAt = parseDate("startedAt", args.startedAt ?? requestedPendingFinish?.startedAt);
let computedSeconds = seconds;
if (minutes === undefined && seconds === undefined && startedAt) {
  computedSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
}
if (minutes === undefined && computedSeconds === undefined) {
  fail("--minutes 또는 --seconds 중 하나가 필요합니다.");
}
if ((minutes ?? 0) <= 0 && (computedSeconds ?? 0) <= 0) {
  fail("플레이 시간은 0보다 커야 합니다.");
}

const duration = durationSeconds();
if (!startedAt) {
  startedAt = new Date(endedAt.getTime() - (duration * 1000));
}
const actualDuration = (endedAt.getTime() - startedAt.getTime()) / 1000;
const tolerance = Math.max(2, duration * 0.05);
if (actualDuration <= 0) {
  fail("--endedAt은 --startedAt보다 늦어야 합니다.");
}
if (Math.abs(actualDuration - duration) > tolerance) {
  fail(`입력한 플레이 시간(${duration.toFixed(0)}초)과 startedAt/endedAt 차이(${actualDuration.toFixed(0)}초)가 맞지 않습니다.`);
}

const log = finishLog ?? readJson(outPath);
const autoPendingFinish = requestedFinishId
  ? null
  : findMatchingPendingSession(log, { difficulty, stage, seed, startedAt });
const finishId = requestedFinishId || (autoPendingFinish ? String(autoPendingFinish.id) : "");
const linkedPendingSession = requestedPendingFinish ?? autoPendingFinish;
const linkedTargetPlan = targetPlanForPendingSession(linkedPendingSession);
const sessionSource = args.source === undefined
  ? sessionSourceForPending(linkedPendingSession)
  : normalizeSessionSource(args.source);

const session = {
  source: sessionSource,
  difficulty,
  ...(minutes !== undefined ? { minutes } : { seconds: computedSeconds }),
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  ...(finishId ? { pendingSessionId: finishId } : {}),
  result,
  stage,
  round,
  seed,
  legends,
  maxGrade,
  dataVersion,
  stateChecksum: stateChecksum.toLowerCase(),
  ...(args.notes ? { notes: String(args.notes) } : {}),
};

log.schemaVersion = 1;
log.source = "manual-playlog";
if (log.sessions.some((s) => String(s.stateChecksum ?? "").toLowerCase() === stateChecksum.toLowerCase())) {
  fail(`이미 같은 결과 체크섬이 기록되어 있습니다: ${stateChecksum.toLowerCase()}`);
}
if (dryRun) {
  const previewLog = {
    ...log,
    schemaVersion: 1,
    source: "manual-playlog",
    sessions: [...log.sessions, session],
    pendingSessions: finishId
      ? pendingSessions(log).filter((pending) => String(pending.id) !== finishId)
      : log.pendingSessions,
  };
  previewLog.totalMinutes = sessionsTotalMinutes(previewLog);
  console.log(`DRY RUN 수동 플레이 로그 검증 통과: ${outPath}`);
  console.log("- 저장하지 않음: --dry-run");
  console.log(`- 추가 예정 세션: ${difficulty}, ${(minutes ?? computedSeconds / 60).toFixed(1)}분`);
  if (finishId) console.log(`- 연결 예정 시작 마커: ${finishId}`);
  if (linkedTargetPlan) {
    const targetMet = linkedTargetPlan.predicate(session);
    console.log(`- 시작 마커 목표: ${linkedTargetPlan.label} ${targetMet ? "충족" : "미충족"}`);
  }
  console.log(`- 미리보기 누적 시간: ${previewLog.totalMinutes.toFixed(1)}분 / 120.0분`);
  console.log(`- 상태 체크섬: ${stateChecksum.toLowerCase()}`);
  console.log("- 세션 JSON:");
  console.log(JSON.stringify(session, null, 2));
  process.exit(0);
}
log.sessions.push(session);
if (finishId) {
  log.pendingSessions = pendingSessions(log).filter((pending) => String(pending.id) !== finishId);
}
log.totalMinutes = sessionsTotalMinutes(log);

const dir = dirname(outPath);
if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");

const total = log.totalMinutes;
const covered = coveredDifficulties(log);
const missing = difficulties.filter((d) => !covered.has(d));
const summaryAfterSave = buildSummary();

console.log(`수동 플레이 로그 저장: ${outPath}`);
console.log(`- 추가 세션: ${difficulty}, ${(minutes ?? computedSeconds / 60).toFixed(1)}분`);
if (autoPendingFinish) console.log(`- 연결된 시작 마커: ${finishId}`);
if (linkedTargetPlan) {
  const targetMet = linkedTargetPlan.predicate(session);
  console.log(`- 시작 마커 목표: ${linkedTargetPlan.label} ${targetMet ? "충족" : "미충족"}`);
  if (!targetMet) console.log("- 이 세션은 실제 플레이 시간으로 저장됐지만 목표 증거 행은 아직 남아 있습니다.");
}
console.log(`- 누적 시간: ${total.toFixed(1)}분 / 120.0분`);
console.log(`- 남은 유효 플레이 시간: ${summaryAfterSave.remainingMinutes.toFixed(1)}분`);
console.log(`- 목표 세션: ${summaryAfterSave.targetRowsPassed}/${summaryAfterSave.targetRowsTotal}개 완료, 남은 ${summaryAfterSave.targetRowsRemaining}개`);
console.log(`- 난이도 커버: ${[...covered].join(", ") || "없음"}`);
console.log(`- 남은 난이도: ${missing.join(", ") || "없음"}`);
console.log(`- 감사 통과 조건: ${summaryAfterSave.passed ? "충족" : "미충족"}`);

const nextAfterSave = buildNextFromSummary(summaryAfterSave).next;
console.log("");
if (nextAfterSave) {
  console.log(`다음 필요 세션: ${nextAfterSave.label} (${nextAfterSave.minutes.toFixed(1)}분 이상)`);
  console.log(`- 목표: ${nextAfterSave.goal}`);
  console.log(`- 추천 시작 마커: ${nextAfterSave.startNextCommandTemplate}`);
} else {
  console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
}
