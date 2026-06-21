// Balance evidence audit.
// Reads JSON reports from yarn balance, browser-balance, and browser-direct.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const balancePath = String(args.balance ?? "output/current-balance.json");
const browserPath = String(args.browser ?? "output/browser-balance.json");
const directPath = String(args.direct ?? "output/browser-direct.json");
const DEFAULT_MANUAL_LOG_PATH = "output/manual-balance-playlog.json";
const manualPath = String(args.manual ?? DEFAULT_MANUAL_LOG_PATH);
const codexPath = String(args.codex ?? (manualPath === DEFAULT_MANUAL_LOG_PATH ? "output/codex-direct-playlog.json" : ""));
const outPath = typeof args.out === "string" && args.out !== "true" ? args.out : "";
const MIN_MANUAL_MINUTES_PER_DIFFICULTY = 12;
const MIN_MANUAL_TARGET_SESSION_MINUTES = 12;
const MIN_MANUAL_TOTAL_MINUTES = 120;
const MIN_BROWSER_DIRECT_SEEDS = 6;
const REQUIRED_DIFFICULTIES = ["novice", "normal", "intermediate", "expert", "master"];
const FINAL_ROUND = 40;
const CURRENT_DATA_VERSION = readCurrentDataVersion();
const MIN_HUMAN_PLAYTEST_INPUT_COUNT = 12;
const NON_PLAY_EVIDENCE_INPUT_TYPES = new Set(["setSpeed", "devSpawn"]);
const VALID_STAGE_IDS = readValidStageIds();

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function splitPaths(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readCodexJson(pathValue) {
  const paths = splitPaths(pathValue);
  if (paths.length === 0) return null;
  if (paths.length === 1) return readJson(paths[0]);
  const loaded = paths
    .filter((path) => existsSync(path))
    .map((path) => ({ path, json: JSON.parse(readFileSync(path, "utf8")) }));
  if (loaded.length === 0) return null;
  return {
    schemaVersion: 1,
    kind: "combined-codex-direct-playlog",
    combinedFrom: loaded.map((entry) => entry.path),
    sessions: loaded.flatMap((entry) => entry.json.sessions ?? []),
  };
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

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function minutesText(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${(value / 60).toFixed(2)} wall-clock minutes`;
}

function status(ok, missing = false) {
  if (missing) return "MISSING";
  return ok ? "PASS" : "FAIL";
}

function dataVersionEvidence(report) {
  if (!report) return "missing JSON";
  const value = String(report.dataVersion ?? "");
  if (!value) return `dataVersion 없음, 현재 ${CURRENT_DATA_VERSION}`;
  return `dataVersion ${value}, 현재 ${CURRENT_DATA_VERSION}`;
}

function dataVersionMatches(report) {
  return !!report?.dataVersion && (!CURRENT_DATA_VERSION || report.dataVersion === CURRENT_DATA_VERSION);
}

function scenario(balance, id) {
  return balance?.scenarios?.find((s) => s.id === id) ?? null;
}

function clearRate(balance, id) {
  return scenario(balance, id)?.report?.clearRate;
}

function rateText(balance, id) {
  const rate = clearRate(balance, id);
  return typeof rate === "number" ? pct(rate) : "n/a";
}

function reportNumber(balance, id, key) {
  const value = scenario(balance, id)?.report?.[key];
  return typeof value === "number" ? value : null;
}

function balanceText(balance, id) {
  const item = scenario(balance, id);
  if (!item) return "n/a";
  const report = item.report ?? {};
  const clear = typeof report.clearRate === "number" ? pct(report.clearRate) : "n/a";
  const round = typeof report.avgReachedRound === "number" ? `${report.avgReachedRound.toFixed(1)}R` : "n/a";
  const legends = typeof report.avgLegendCount === "number" ? `${report.avgLegendCount.toFixed(1)}전설` : "n/a";
  return `${clear}, 평균 ${round}, 평균 ${legends}`;
}

function directScenario(direct, id) {
  return direct?.scenarios?.find((s) => s.id === id) ?? null;
}

function directObservation(direct, labelPrefix) {
  return direct?.observations?.find((g) => g.label?.startsWith(labelPrefix)) ?? null;
}

function directText(scenario) {
  if (!scenario) return "n/a";
  return `${pct(Number(scenario.clearRate ?? 0))}, 평균 ${Number(scenario.avgRound ?? 0).toFixed(1)}R, 평균 전설 ${Number(scenario.avgLegendOrBetter ?? 0).toFixed(1)}, 클리어런 평균 전설 ${Number(scenario.avgClearedLegendOrBetter ?? scenario.avgLegendOrBetter ?? 0).toFixed(1)}, 압박 ${pct(Number(scenario.avgPressureRatio ?? 0))}`;
}

function directBetterThan(base, improved) {
  if (!base || !improved) return false;
  return Number(improved.clearRate ?? 0) > Number(base.clearRate ?? 0) ||
    Number(improved.avgRound ?? 0) >= Number(base.avgRound ?? 0) + 1 ||
    Number(improved.avgPressureRatio ?? 1) < Number(base.avgPressureRatio ?? 1);
}

function directClearAccess(scenario, { minClearRate = 0.5, minAvgRound = 39.5, maxPressureRatio = 1 } = {}) {
  return !!scenario && (
    Number(scenario.clearRate ?? 0) >= minClearRate ||
    (Number(scenario.avgRound ?? 0) >= minAvgRound && Number(scenario.avgPressureRatio ?? 1) < maxPressureRatio)
  );
}

function directClearedLegendAverage(scenario) {
  return Number(scenario?.avgClearedLegendOrBetter ?? scenario?.avgLegendOrBetter ?? 0);
}

function manualMinutes(manual) {
  if (!manual) return 0;
  if (isExampleManualLog(manual)) return 0;
  if (Array.isArray(manual.sessions)) {
    return humanManualSessions(manual).reduce((sum, s) => {
      if (typeof s.minutes === "number") return sum + s.minutes;
      if (typeof s.seconds === "number") return sum + (s.seconds / 60);
      return sum;
    }, 0);
  }
  if (typeof manual.totalMinutes === "number") return manual.totalMinutes;
  if (typeof manual.totalSeconds === "number") return manual.totalSeconds / 60;
  return 0;
}

function manualDifficulties(manual) {
  return new Set(humanManualSessions(manual).map((s) => s.difficulty).filter(Boolean));
}

function manualMinutesByDifficulty(manual) {
  const result = new Map();
  for (const session of humanManualSessions(manual)) {
    result.set(session.difficulty, (result.get(session.difficulty) ?? 0) + sessionMinutes(session));
  }
  return result;
}

function manualSessions(manual, difficulty) {
  return humanManualSessions(manual).filter((s) => s.difficulty === difficulty);
}

function isExampleManualLog(manual) {
  return manual?.example === true || manual?.fixture === true;
}

function isExampleManualSession(session) {
  return session?.example === true || session?.fixture === true || session?.source === "example";
}

function realManualSessions(manual) {
  return sessionValidationEntries(manual)
    .filter((entry) => entry.issues.length === 0)
    .map((entry) => entry.session);
}

function isHumanPlaytestSession(session) {
  const source = String(session.source ?? "human-playtest");
  return source === "human-playtest";
}

function humanManualSessions(manual) {
  return realManualSessions(manual).filter(isHumanPlaytestSession);
}

function codexDirectManualSessions(manual) {
  return realManualSessions(manual).filter((session) => !isHumanPlaytestSession(session));
}

function sessionValidationEntries(manual) {
  if (!manual || isExampleManualLog(manual)) return [];
  const seenChecksums = new Set();
  return (manual.sessions ?? [])
    .filter((s) => !isExampleManualSession(s))
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

function invalidManualSessions(manual) {
  return sessionValidationEntries(manual)
    .filter((entry) => entry.issues.length > 0)
    .map(({ index, session, issues }) => ({
      index,
      difficulty: String(session.difficulty ?? ""),
      result: sessionResult(session) || "",
      round: Number(session.round ?? 0),
      seed: String(session.seed ?? ""),
      checksum: String(session.stateChecksum ?? "").slice(0, 8),
      issues,
    }));
}

function countNonExampleManualSessions(manual) {
  if (!manual || isExampleManualLog(manual)) return 0;
  return (manual.sessions ?? []).filter((s) => !isExampleManualSession(s)).length;
}

function pendingManualSessions(manual) {
  if (!manual || isExampleManualLog(manual)) return [];
  return (manual.pendingSessions ?? []).filter((s) => !isExampleManualSession(s));
}

function pendingManualEvidence(pendingSessions) {
  if (pendingSessions.length === 0) return "pending 시작 마커 없음";
  return pendingSessions
    .map((s) => {
      const id = s.id ?? "id없음";
      const difficulty = s.difficulty ?? "난이도없음";
      const stage = s.stage ?? "?";
      const seed = s.seed ?? "?";
      const startedAt = s.startedAt ?? "시작없음";
      const finish = s.finishCommandTemplate ?? pendingFinishCommandTemplate(s);
      const dryRunFinish = s.finishDryRunCommandTemplate ?? `${finish} --dry-run`;
      return `${id} ${difficulty} stage=${stage} seed=${seed} startedAt=${startedAt} dryRunFinish=${dryRunFinish} finish=${finish}`;
    })
    .join("; ");
}

function invalidManualEvidence(invalidSessions) {
  if (invalidSessions.length === 0) return "무효 세션 없음";
  return invalidSessions
    .map((session) => {
      const label = [
        `#${session.index + 1}`,
        session.difficulty || "difficulty?",
        session.result || "result?",
        `${session.round || "?"}R`,
        session.seed ? `seed=${session.seed}` : "",
        session.checksum ? `#${session.checksum}` : "",
      ].filter(Boolean).join(" ");
      return `${label}: ${session.issues.join(", ")}`;
    })
    .join("; ");
}

function pendingFinishCommandTemplate(session) {
  const template = finishTemplateForPending(session);
  return [
    `yarn manual-playlog --finish=${shellArg(session.id ?? "PENDING_ID")}`,
    `--result=${template.result}`,
    `--round=${template.round}`,
    `--legends=${template.legends}`,
    `--maxGrade=${template.maxGrade}`,
    "--dataVersion=RESULT_DATA_VERSION",
    "--stateChecksum=RESULT_CHECKSUM",
    "--endedAt=RESULT_ENDED_AT",
  ].join(" ");
}

function finishTemplateForPending(session) {
  const base = {
    result: "loss",
    round: "ROUND_REACHED",
    legends: "FINAL_LEGENDS",
    maxGrade: "MAX_GRADE",
  };
  switch (session?.notes) {
    case "입문자 무전설 40R 클리어":
      return { result: "clear", round: "40", legends: "0", maxGrade: "hero" };
    case "일반 1~2전설 40R 클리어":
      return { result: "clear", round: "40", legends: "1", maxGrade: "legend" };
    case "중급자 5전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "5", maxGrade: "legend" };
    case "고수 5전설 이하 실패":
      return { result: "loss", round: "ROUND_REACHED", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
    case "고수 6전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "6", maxGrade: "legend" };
    case "초고수 실패 기록":
      return { result: "loss", round: "ROUND_REACHED", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
    default:
      return base;
  }
}

function shellArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
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

function hasCompleteManualMetadata(session) {
  const source = String(session.source ?? "human-playtest");
  const difficulty = String(session.difficulty ?? "");
  const result = sessionResult(session);
  const stage = Number(session.stage);
  const round = Number(session.round);
  const legends = legendCount(session);
  const maxGrade = String(session.maxGrade ?? "");
  const seed = String(session.seed ?? "");
  const dataVersion = String(session.dataVersion ?? "");
  const stateChecksum = String(session.stateChecksum ?? "");
  const inputCount = Number(session.inputCount ?? 0);
  const inputTypes = inputTypesForSession(session);
  const inputCounts = inputCountsForSession(session);
  const inputCountsTotal = inputCountTotal(inputCounts);
  const meaningfulTypes = meaningfulInputTypes(inputCounts);
  return ["novice", "normal", "intermediate", "expert", "master"].includes(difficulty) &&
    ["clear", "cleared", "win", "won", "victory", "loss", "lose", "lost", "fail", "failed", "defeat", "quit"].includes(result) &&
    isValidStageId(stage) &&
    Number.isFinite(round) && round >= 1 && round <= FINAL_ROUND &&
    (!isClear(session) || round >= FINAL_ROUND) &&
    Number.isFinite(legends) && legends >= 0 &&
    isLegendMetadataConsistent(maxGrade, legends) &&
    ["common", "rare", "hero", "legend", "hidden"].includes(maxGrade) &&
    seed.length > 0 &&
    dataVersion.length > 0 &&
    /^[0-9a-f]{8}$/i.test(stateChecksum) &&
    (source !== "human-playtest" || (
      Number.isFinite(inputCount) &&
      inputCount >= MIN_HUMAN_PLAYTEST_INPUT_COUNT &&
      inputTypes.length > 0 &&
      Object.keys(inputCounts).length > 0 &&
      meaningfulTypes.length > 0 &&
      inputCountsTotal === inputCount
    ));
}

function isLegendMetadataConsistent(maxGrade, legends) {
  const maxGradeIsLegendOrHidden = maxGrade === "legend" || maxGrade === "hidden";
  return maxGradeIsLegendOrHidden ? legends > 0 : legends === 0;
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

function legendCount(session) {
  const value = Number(session.legends ?? session.legendOrBetter ?? session.legendOrBetterCount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function inputTypesForSession(session) {
  const value = session.inputTypes ?? session.inputCounts;
  if (Array.isArray(value)) {
    return [...new Set(value.map((type) => String(type).trim()).filter(Boolean))].sort();
  }
  if (value && typeof value === "object") {
    return Object.keys(value).filter((type) => Number(value[type]) > 0).sort();
  }
  return String(value ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean)
    .filter((type, index, arr) => arr.indexOf(type) === index)
    .sort();
}

function inputCountsForSession(session) {
  const value = session.inputCounts;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const counts = {};
    for (const [type, count] of Object.entries(value)) {
      const normalizedType = String(type).trim();
      const normalizedCount = Number(count);
      if (normalizedType && Number.isInteger(normalizedCount) && normalizedCount > 0) {
        counts[normalizedType] = normalizedCount;
      }
    }
    return counts;
  }
  const counts = {};
  for (const part of String(value ?? "").split(",")) {
    const [rawType, rawCount] = part.split(":");
    const type = String(rawType ?? "").trim();
    const count = Number(String(rawCount ?? "").trim());
    if (type && Number.isInteger(count) && count > 0) counts[type] = count;
  }
  return counts;
}

function inputCountTotal(inputCounts) {
  return Object.values(inputCounts).reduce((sum, count) => sum + Number(count), 0);
}

function meaningfulInputTypes(inputCounts) {
  return Object.entries(inputCounts)
    .filter(([type, count]) => Number(count) > 0 && !NON_PLAY_EVIDENCE_INPUT_TYPES.has(type))
    .map(([type]) => type)
    .sort();
}

function reachedFinalRound(session) {
  return Number(session.round ?? 0) >= 40;
}

function isMeaningfulManualTargetSession(session) {
  return sessionMinutes(session) >= MIN_MANUAL_TARGET_SESSION_MINUTES;
}

function noteHasLabel(session, label) {
  return String(session.notes ?? "").includes(label);
}

function manualEvidence(sessions) {
  if (sessions.length === 0) return "증거 없음";
  return sessions
    .map((s) => {
      const result = sessionResult(s) || "결과 없음";
      const round = s.round !== undefined ? `${s.round}R` : "라운드 없음";
      const legends = `${legendCount(s)}전설 이상`;
      const minutes = `${sessionMinutes(s).toFixed(1)}분`;
      const source = String(s.source ?? "source?");
      const checksum = s.stateChecksum ? `#${s.stateChecksum}` : "체크섬 없음";
      return `${s.difficulty} ${result} ${round} ${legends} ${minutes} ${source} ${checksum}`;
    })
    .join("; ");
}

function codexDirectCoverage(sessions) {
  const totalMinutes = sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const noviceClear = sessions.some((s) => s.difficulty === "novice" && isClear(s) && reachedFinalRound(s) && legendCount(s) === 0);
  const normalClear = sessions.some((s) => s.difficulty === "normal" && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 1 && legendCount(s) <= 2);
  const intermediateClear = sessions.some((s) => s.difficulty === "intermediate" && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 5);
  const expertWeakFail = sessions.some((s) => s.difficulty === "expert" && isLoss(s) && legendCount(s) <= 5);
  const expertStrongClear = sessions.some((s) => s.difficulty === "expert" && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 6);
  const masterFail = sessions.some((s) => s.difficulty === "master" && isLoss(s));
  const checks = {
    totalMinutes: totalMinutes >= MIN_MANUAL_TOTAL_MINUTES,
    noviceClear,
    normalClear,
    intermediateClear,
    expertWeakFail,
    expertStrongClear,
    masterFail,
  };
  const missing = [
    checks.totalMinutes ? "" : `2시간 직접 플레이형 세션 ${Math.max(0, MIN_MANUAL_TOTAL_MINUTES - totalMinutes).toFixed(1)}분 부족`,
    noviceClear ? "" : "입문자 무전설 40R 클리어 없음",
    normalClear ? "" : "일반 1~2전설 40R 클리어 없음",
    intermediateClear ? "" : "중급자 5전설 이상 40R 클리어 없음",
    expertWeakFail ? "" : "고수 5전설 이하 실패 없음",
    expertStrongClear ? "" : "고수 6전설 이상 40R 클리어 없음",
    masterFail ? "" : "초고수 실패 없음",
  ].filter(Boolean);
  return {
    pass: missing.length === 0,
    evidence: sessions.length > 0
      ? `codex-direct ${sessions.length}세션 ${totalMinutes.toFixed(1)}분, ${missing.length === 0 ? "핵심 6조건 충족" : `부족: ${missing.join(", ")}`}`
      : "codex-direct 세션 없음",
  };
}

function hasManual(manual, difficulty, predicate) {
  return manualSessions(manual, difficulty).some(predicate);
}

const MANUAL_TARGETS = [
  {
    label: "입문자 무전설 40R 클리어",
    difficulty: "novice",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 없이 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=0 maxGrade=hero 이하",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) === 0,
  },
  {
    label: "일반 1~2전설 40R 클리어",
    difficulty: "normal",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 1~2개로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=1~2 maxGrade=legend",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 1 && legendCount(s) <= 2,
  },
  {
    label: "중급자 5전설 이상 40R 클리어",
    difficulty: "intermediate",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 5개 이상으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=5 maxGrade=legend|hidden",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 5,
  },
  {
    label: "고수 5전설 이하 실패",
    difficulty: "expert",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 5개 이하 성장 조건으로 실패",
    logHint: "result=loss round=RESULT_ROUND legends<=5",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isLoss(s) && legendCount(s) <= 5,
  },
  {
    label: "고수 6전설 이상 40R 클리어",
    difficulty: "expert",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 6개 이상 성장 조건으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=6 maxGrade=legend|hidden",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 6,
  },
  {
    label: "초고수 실패 기록",
    difficulty: "master",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "초고수 난이도 실패 기록",
    logHint: "result=loss",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isLoss(s),
  },
];

const MANUAL_OBSERVATIONS = [
  {
    label: "일반 무전설 경계 확인",
    difficulty: "normal",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 없이 일반 난이도 클리어 접근이 어려운지 확인",
    logHint: "result=clear|loss round=RESULT_ROUND legends=0 maxGrade=hero 이하",
    predicate: (s) => isMeaningfulManualTargetSession(s) && noteHasLabel(s, "일반 무전설 경계 확인") && legendCount(s) === 0,
  },
  {
    label: "중급자 2전설 경계 확인",
    difficulty: "intermediate",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "중급자 2전설 이하가 5전설 조건보다 어려운지 확인",
    logHint: "result=clear|loss round=RESULT_ROUND legends<=2 maxGrade=legend",
    predicate: (s) => isMeaningfulManualTargetSession(s) && noteHasLabel(s, "중급자 2전설 경계 확인") && legendCount(s) <= 2,
  },
  {
    label: "고수 제한 없음 성장 확인",
    difficulty: "expert",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "고수에서 중급자 5전설보다 높은 성장량이 필요한지 확인",
    logHint: "result=clear|loss round=RESULT_ROUND legends=FINAL_LEGENDS maxGrade=MAX_GRADE",
    predicate: (s) => isMeaningfulManualTargetSession(s) && noteHasLabel(s, "고수 제한 없음 성장 확인") && legendCount(s) >= 6,
  },
  {
    label: "초고수 추가 실패 확인",
    difficulty: "master",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "초고수가 제한 없이도 매우 어렵게 유지되는지 추가 확인",
    logHint: "result=loss 권장, clear이면 밸런스 재검토",
    predicate: (s) => isMeaningfulManualTargetSession(s) && noteHasLabel(s, "초고수 추가 실패 확인") && isLoss(s),
  },
];

function manualNextEvidence(manual) {
  const totalMinutes = manualMinutes(manual);
  const minutesByDifficulty = manualMinutesByDifficulty(manual);
  for (const target of MANUAL_TARGETS) {
    if (!hasManual(manual, target.difficulty, target.predicate)) {
      return `${target.label} (${target.minutes.toFixed(1)}분 이상) - ${target.goal}; 기록 힌트: ${target.logHint}; ${manualProofWorkflowEvidence(target)}`;
    }
  }
  for (const target of MANUAL_OBSERVATIONS) {
    if (!hasManual(manual, target.difficulty, target.predicate)) {
      return `${target.label} (${target.minutes.toFixed(1)}분 이상) - ${target.goal}; 기록 힌트: ${target.logHint}; ${manualProofWorkflowEvidence(target)}`;
    }
  }
  for (const difficulty of REQUIRED_DIFFICULTIES) {
    const current = minutesByDifficulty.get(difficulty) ?? 0;
    if (current < MIN_MANUAL_MINUTES_PER_DIFFICULTY) {
      return `${difficulty} 추가 ${(MIN_MANUAL_MINUTES_PER_DIFFICULTY - current).toFixed(1)}분 이상 - 난이도별 최소 ${MIN_MANUAL_MINUTES_PER_DIFFICULTY}분 보충; ${manualProofWorkflowEvidence({ difficulty })}`;
    }
  }
  if (totalMinutes < MIN_MANUAL_TOTAL_MINUTES) {
    return `자유 난이도 추가 ${(MIN_MANUAL_TOTAL_MINUTES - totalMinutes).toFixed(1)}분 이상 - 총 ${MIN_MANUAL_TOTAL_MINUTES}분 보충; ${manualProofWorkflowEvidence({ difficulty: "any" })}`;
  }
  return "필요 없음 - 수동 플레이 증거 목표 충족";
}

function manualNextMissing(manual) {
  return manualNextEvidence(manual) !== "필요 없음 - 수동 플레이 증거 목표 충족";
}

function startNextCommandTemplate(step, idValue = "") {
  if (!step) return "";
  const idArg = idValue ? ` --id=${idValue}` : "";
  const difficultyArg = ` --difficulty=${step.difficulty === "any" ? "DIFFICULTY" : step.difficulty}`;
  return `yarn manual-playlog --start-next${idArg}${difficultyArg} --seed=GAME_SEED_HERE${manualOutArg()}`;
}

function startNextDryRunCommandTemplate(step) {
  const command = startNextCommandTemplate(step);
  return command ? `${command} --dry-run` : "";
}

function startNextValidateSaveCommandTemplate(step) {
  if (!step) return "";
  const idVar = "manual_run_id";
  const idRef = `"$${idVar}"`;
  const start = startNextCommandTemplate(step, idRef);
  return [
    `${idVar}="manual-$(date +%Y%m%d%H%M%S)-$$"`,
    `${start} --dry-run`,
    start,
    `yarn manual-playlog --pending-id=${idRef}${manualOutArg()}`,
  ].join(" && ");
}

function manualOutArg() {
  return manualPath === DEFAULT_MANUAL_LOG_PATH ? "" : ` --out=${shellArg(manualPath)}`;
}

function manualPreflightCommandTemplate() {
  return `yarn manual-playlog --preflight${manualOutArg()}`;
}

function manualPlanCommandTemplate() {
  return `yarn manual-playlog --plan${manualOutArg()}`;
}

function manualNextCommandTemplate() {
  return `yarn manual-playlog --next${manualOutArg()}`;
}

function manualNextJsonCommandTemplate() {
  return `yarn --silent manual-playlog --next-json${manualOutArg()}`;
}

function manualFromResultDryRunCommandTemplate() {
  return `yarn manual-playlog --from-result=PATH_TO_EXPORTED_JSON${manualOutArg()} --dry-run`;
}

function manualFromResultCommandTemplate() {
  return `yarn manual-playlog --from-result=PATH_TO_EXPORTED_JSON${manualOutArg()}`;
}

function manualFromResultStdinDryRunCommandTemplate() {
  return `pbpaste | yarn manual-playlog --from-result=-${manualOutArg()} --dry-run`;
}

function manualFromResultStdinCommandTemplate() {
  return `pbpaste | yarn manual-playlog --from-result=-${manualOutArg()}`;
}

function manualFromClipboardDryRunCommandTemplate() {
  return `yarn manual-playlog --from-clipboard${manualOutArg()} --dry-run`;
}

function manualFromClipboardCommandTemplate() {
  return `yarn manual-playlog --from-clipboard${manualOutArg()}`;
}

function manualProofWorkflowEvidence(step) {
  return [
    `시작 전 점검: ${manualPreflightCommandTemplate()}`,
    `다음 세션 상세: ${manualNextCommandTemplate()}`,
    `다음 세션 JSON: ${manualNextJsonCommandTemplate()}`,
    `전체 계획: ${manualPlanCommandTemplate()}`,
    `추천 검증+마커+확인: ${startNextValidateSaveCommandTemplate(step)}`,
    `추천 시작 검증: ${startNextDryRunCommandTemplate(step)}`,
    `추천 시작 마커: ${startNextCommandTemplate(step)}`,
    `결과 JSON 검증: ${manualFromResultDryRunCommandTemplate()}`,
    `결과 JSON 저장: ${manualFromResultCommandTemplate()}`,
    `복사 JSON 표준입력 검증: ${manualFromResultStdinDryRunCommandTemplate()}`,
    `복사 JSON 표준입력 저장: ${manualFromResultStdinCommandTemplate()}`,
    `복사 JSON 클립보드 검증: ${manualFromClipboardDryRunCommandTemplate()}`,
    `복사 JSON 클립보드 저장: ${manualFromClipboardCommandTemplate()}`,
  ].join("; ");
}

function buildRows(balance, browser, direct, manual, codex) {
  const rows = [];
  const balanceSeedText = `${balance?.seeds ?? "?"}시드`;
  const difficulties = new Set((balance?.scenarios ?? []).map((s) => s.difficulty));
  rows.push({
    req: "난이도 5종",
    evidence: [...difficulties].join(", ") || "missing",
    pass: REQUIRED_DIFFICULTIES.every((d) => difficulties.has(d)),
  });
  rows.push({
    req: "자동 밸런스 데이터 버전",
    evidence: dataVersionEvidence(balance),
    pass: dataVersionMatches(balance),
    missing: !balance,
  });
  rows.push({
    req: "브라우저 10R 데이터 버전",
    evidence: dataVersionEvidence(browser),
    pass: dataVersionMatches(browser),
    missing: !browser,
  });
  rows.push({
    req: "브라우저 직접 데이터 버전",
    evidence: dataVersionEvidence(direct),
    pass: dataVersionMatches(direct),
    missing: !direct,
  });

  const novice = clearRate(balance, "noviceHero");
  rows.push({
    req: "입문자: 전설 없이 클리어 가능",
    evidence: `${balanceSeedText} 전설 없음 ${rateText(balance, "noviceHero")}`,
    pass: typeof novice === "number" && novice >= 0.9,
  });

  const normalNo = clearRate(balance, "normalNoLegend");
  const normalOne = clearRate(balance, "normalOneLegend");
  const normalTwo = clearRate(balance, "normalTwoLegend");
  rows.push({
    req: "일반: 전설 1~2개부터 클리어권",
    evidence: `0전설 ${rateText(balance, "normalNoLegend")}, 1전설 ${rateText(balance, "normalOneLegend")}, 2전설 ${rateText(balance, "normalTwoLegend")}`,
    pass: typeof normalNo === "number" && typeof normalOne === "number" && typeof normalTwo === "number" &&
      normalNo <= 0.25 && normalOne >= 0.2 && normalOne >= normalNo &&
      normalTwo >= 0.45 && normalTwo >= normalNo + 0.3,
  });

  const intermediateTwo = clearRate(balance, "intermediateTwoLegend");
  const intermediateFive = clearRate(balance, "intermediateFiveLegend");
  const intermediateOpen = clearRate(balance, "intermediateOpen");
  rows.push({
    req: "중급자: 전설 5개 이상부터 클리어권",
    evidence: `2전설 ${rateText(balance, "intermediateTwoLegend")}, 5전설 ${rateText(balance, "intermediateFiveLegend")}, 제한 없음 ${rateText(balance, "intermediateOpen")}`,
    pass: typeof intermediateTwo === "number" && typeof intermediateFive === "number" && typeof intermediateOpen === "number" &&
      intermediateTwo <= 0.15 && intermediateFive >= 0.4 &&
      intermediateFive >= intermediateTwo + 0.3 && intermediateOpen >= 0.85,
  });

  const expertFive = clearRate(balance, "expertFiveLegend");
  const expertOpen = clearRate(balance, "expertOpen");
  const intermediateFiveAvgLegend = reportNumber(balance, "intermediateFiveLegend", "avgLegendCount");
  const expertOpenAvgLegend = reportNumber(balance, "expertOpen", "avgLegendCount");
  const expertAutoGrowthPass = typeof intermediateFiveAvgLegend === "number" &&
    typeof expertOpenAvgLegend === "number" &&
    expertOpenAvgLegend >= Math.max(6, intermediateFiveAvgLegend + 1);
  rows.push({
    req: "고수: 중급 예산보다 더 높은 성장 필요",
    evidence: `중급 5전설 ${balanceText(balance, "intermediateFiveLegend")}, 고수 5전설 ${balanceText(balance, "expertFiveLegend")}, 고수 제한 없음 ${balanceText(balance, "expertOpen")}`,
    pass: typeof expertFive === "number" && typeof expertOpen === "number" &&
      expertFive <= 0.1 && expertOpen >= 0.4 && expertOpen >= expertFive + 0.3 &&
      expertAutoGrowthPass,
  });

  const masterOpen = clearRate(balance, "masterOpen");
  rows.push({
    req: "초고수: 클리어 접근 차단",
    evidence: `제한 없음 ${rateText(balance, "masterOpen")}`,
    pass: typeof masterOpen === "number" && masterOpen === 0,
  });

  rows.push({
    req: "브라우저 10R 체감 게이트",
    evidence: browser ? `${browser.gates?.filter((g) => g.pass).length ?? 0}/${browser.gates?.length ?? 0} gates` : "missing browser-balance JSON",
    pass: !!browser?.passed,
    missing: !browser,
  });

  const directSeconds = Number(direct?.totalSimulatedSeconds ?? 0);
  const directWallClockText = minutesText(direct?.wallClockSeconds ?? direct?.totalWallClockSeconds);
  const directScenarioIds = [
    "noviceHero",
    "normalNoLegend",
    "normalOneLegend",
    "normalTwoLegend",
    "intermediateTwoLegend",
    "intermediateFiveLegend",
    "intermediateOpen",
    "expertFiveLegend",
    "expertOpen",
    "masterOpen",
  ];
  const directCoversTargets = directScenarioIds.every((id) => !!directScenario(direct, id));
  rows.push({
    req: "브라우저 직접 플레이형 자동 표본 범위",
    evidence: direct ? `${direct.scenarios?.length ?? 0}/${directScenarioIds.length} target scenarios, ${direct.seeds ?? "?"}/${MIN_BROWSER_DIRECT_SEEDS} seeds, ${(directSeconds / 3600).toFixed(2)} simulated hours${directWallClockText ? `, ${directWallClockText}` : ""}` : "missing browser-direct JSON",
    pass: !!direct && Number(direct.seeds ?? 0) >= MIN_BROWSER_DIRECT_SEEDS && directSeconds > 0 && directCoversTargets,
    missing: !direct || !directCoversTargets,
  });
  const directObservations = direct?.observations ?? [];
  rows.push({
    req: "브라우저 직접 플레이형 관찰 게이트",
    evidence: direct
      ? `${directObservations.filter((g) => g.pass).length}/${directObservations.length} observations, passed=${direct.passed === true}`
      : "missing browser-direct JSON",
    pass: !!direct && direct.passed === true && directObservations.length >= 5 && directObservations.every((g) => g.pass),
    missing: !direct,
  });

  const directNovice = directScenario(direct, "noviceHero");
  const directNormalNo = directScenario(direct, "normalNoLegend");
  const directNormalOne = directScenario(direct, "normalOneLegend");
  const directNormalTwo = directScenario(direct, "normalTwoLegend");
  const directIntermediateTwo = directScenario(direct, "intermediateTwoLegend");
  const directIntermediateFive = directScenario(direct, "intermediateFiveLegend");
  const directIntermediateOpen = directScenario(direct, "intermediateOpen");
  const directExpertFive = directScenario(direct, "expertFiveLegend");
  const directExpertOpen = directScenario(direct, "expertOpen");
  const directMaster = directScenario(direct, "masterOpen");
  const directNovicePass = directObservation(direct, "입문자 직접 플레이 표본")?.pass ??
    directClearAccess(directNovice, { minClearRate: 0.5, minAvgRound: 39 });
  const directNormalPass = directObservation(direct, "일반 직접 플레이 표본")?.pass ??
    (!!directNormalNo && Number(directNormalNo.clearRate ?? 1) <= 0.5 &&
      (directClearAccess(directNormalOne) || directClearAccess(directNormalTwo)) &&
      directBetterThan(directNormalNo, directNormalTwo));
  const directIntermediatePass = directObservation(direct, "중급자 직접 플레이 표본")?.pass ??
    (!!directIntermediateTwo && Number(directIntermediateTwo.clearRate ?? 1) <= 0.1 &&
      directClearAccess(directIntermediateFive) && directBetterThan(directIntermediateTwo, directIntermediateFive));
  const directIntermediateOpenObservation = directObservation(direct, "중급자 직접 플레이 표본은 제한 없음")?.pass;
  const directIntermediateOpenPass = !!directIntermediateFive && !!directIntermediateOpen &&
    directClearAccess(directIntermediateOpen, { minClearRate: 0.7, minAvgRound: 39.5 }) &&
    Number(directIntermediateOpen.clearRate ?? 0) >= Number(directIntermediateFive.clearRate ?? 1) &&
    Number(directIntermediateOpen.avgPressureRatio ?? 1) <= Number(directIntermediateFive.avgPressureRatio ?? 0) &&
    (directIntermediateOpenObservation ?? true);
  const directExpertObservation = directObservation(direct, "고수 직접 플레이 표본")?.pass;
  const directExpertGrowthPass = !!directIntermediateFive && !!directExpertOpen &&
    directClearedLegendAverage(directExpertOpen) >= Math.max(6, directClearedLegendAverage(directIntermediateFive) + 1);
  const directExpertPass = !!directExpertFive && Number(directExpertFive.clearRate ?? 1) <= 0.1 &&
    directClearAccess(directExpertOpen) &&
    directBetterThan(directExpertFive, directExpertOpen) &&
    directExpertGrowthPass &&
    (directExpertObservation ?? true);
  const directMasterObservation = directObservation(direct, "초고수 직접 플레이 표본");
  const directMasterPass = !!directMaster &&
    Number(directMaster.clearRate ?? 1) === 0 &&
    (directMasterObservation?.pass ?? true);
  rows.push({
    req: "브라우저 직접: 입문자 무전설 클리어권",
    evidence: directText(directNovice),
    pass: directNovicePass,
    missing: !direct || !directNovice,
  });
  rows.push({
    req: "브라우저 직접: 일반 1~2전설 개선",
    evidence: `0전설 ${directText(directNormalNo)}; 1전설 ${directText(directNormalOne)}; 2전설 ${directText(directNormalTwo)}`,
    pass: directNormalPass,
    missing: !direct || !directNormalNo || !directNormalOne || !directNormalTwo,
  });
  rows.push({
    req: "브라우저 직접: 중급자 5전설 개선",
    evidence: `2전설 ${directText(directIntermediateTwo)}; 5전설 ${directText(directIntermediateFive)}`,
    pass: directIntermediatePass,
    missing: !direct || !directIntermediateTwo || !directIntermediateFive,
  });
  rows.push({
    req: "브라우저 직접: 중급자 제한 없음 안정권",
    evidence: `5전설 ${directText(directIntermediateFive)}; 제한 없음 ${directText(directIntermediateOpen)}`,
    pass: directIntermediateOpenPass,
    missing: !direct || !directIntermediateFive || !directIntermediateOpen,
  });
  rows.push({
    req: "브라우저 직접: 고수는 5전설보다 높은 성장 필요",
    evidence: `중급 5전설 ${directText(directIntermediateFive)}; 고수 5전설 ${directText(directExpertFive)}; 고수 제한 없음 ${directText(directExpertOpen)}`,
    pass: directExpertPass,
    missing: !direct || !directIntermediateFive || !directExpertFive || !directExpertOpen,
  });
  rows.push({
    req: "브라우저 직접: 초고수 클리어 접근 차단",
    evidence: directText(directMaster),
    pass: directMasterPass,
    missing: !direct || !directMaster,
  });

  const manualTotalMinutes = manualMinutes(manual);
  const manualDiffs = manualDifficulties(manual);
  const manualMinutesByDiff = manualMinutesByDifficulty(manual);
  const manualDifficultyMinutesText = REQUIRED_DIFFICULTIES
    .map((d) => `${d} ${(manualMinutesByDiff.get(d) ?? 0).toFixed(1)}분`)
    .join(", ");
  const manualCoversAll = REQUIRED_DIFFICULTIES.every((d) => manualDiffs.has(d));
  const manualCoversMinimumMinutes = REQUIRED_DIFFICULTIES.every((d) => (manualMinutesByDiff.get(d) ?? 0) >= MIN_MANUAL_MINUTES_PER_DIFFICULTY);
  const manualSessionCount = countNonExampleManualSessions(manual);
  const validManualSessionCount = humanManualSessions(manual).length;
  const codexDirectSessions = codexDirectManualSessions(manual);
  const separateCodexDirectSessions = codexDirectManualSessions(codex);
  const allCodexDirectSessions = [...codexDirectSessions, ...separateCodexDirectSessions];
  const codexDirectMinutes = codexDirectSessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const allCodexDirectMinutes = allCodexDirectSessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const codexCoverage = codexDirectCoverage(allCodexDirectSessions);
  const invalidManual = invalidManualSessions(manual);
  const pendingManual = pendingManualSessions(manual);
  const pendingManualText = `pending ${pendingManual.length}개`;
  const noviceManual = manualSessions(manual, "novice");
  const normalManual = manualSessions(manual, "normal");
  const intermediateManual = manualSessions(manual, "intermediate");
  const expertManual = manualSessions(manual, "expert");
  const masterManual = manualSessions(manual, "master");

  const noviceManualPass = hasManual(manual, "novice", (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) === 0);
  const normalManualPass = hasManual(manual, "normal", (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 1 && legendCount(s) <= 2);
  const intermediateManualPass = hasManual(manual, "intermediate", (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 5);
  const expertManualWeakFail = hasManual(manual, "expert", (s) => isMeaningfulManualTargetSession(s) && isLoss(s) && legendCount(s) <= 5);
  const expertManualStrongClear = hasManual(manual, "expert", (s) => isMeaningfulManualTargetSession(s) && isClear(s) && reachedFinalRound(s) && legendCount(s) >= 6);
  const masterManualPass = hasManual(manual, "master", (s) => isMeaningfulManualTargetSession(s) && isLoss(s));
  const manualTargetPassCount = [
    noviceManualPass,
    normalManualPass,
    intermediateManualPass,
    expertManualWeakFail,
    expertManualStrongClear,
    masterManualPass,
  ].filter(Boolean).length;
  const manualTargetTotal = 6;
  const normalNoLegendObservation = hasManual(manual, "normal", MANUAL_OBSERVATIONS[0].predicate);
  const intermediateTwoLegendObservation = hasManual(manual, "intermediate", MANUAL_OBSERVATIONS[1].predicate);
  const expertOpenGrowthObservation = hasManual(manual, "expert", MANUAL_OBSERVATIONS[2].predicate);
  const masterExtraFailureObservation = hasManual(manual, "master", MANUAL_OBSERVATIONS[3].predicate);
  const manualObservationPassCount = [
    normalNoLegendObservation,
    intermediateTwoLegendObservation,
    expertOpenGrowthObservation,
    masterExtraFailureObservation,
  ].filter(Boolean).length;
  const manualObservationTotal = MANUAL_OBSERVATIONS.length;
  const manualRemainingMinutes = Math.max(0, MIN_MANUAL_TOTAL_MINUTES - manualTotalMinutes);
  const manualProgressText = `남은 ${manualRemainingMinutes.toFixed(1)}분, 목표 ${manualTargetPassCount}/${manualTargetTotal}개 완료, 관찰 ${manualObservationPassCount}/${manualObservationTotal}개 완료`;
  const humanDirectCoveragePass = manualTotalMinutes >= MIN_MANUAL_TOTAL_MINUTES &&
    manualCoversAll &&
    manualCoversMinimumMinutes &&
    manualTargetPassCount === manualTargetTotal;
  const directPlayGoalPass = humanDirectCoveragePass || codexCoverage.pass;
  const directPlayGoalEvidence = directPlayGoalPass
    ? [
      humanDirectCoveragePass ? `human ${manualTotalMinutes.toFixed(1)}분, 핵심 ${manualTargetPassCount}/${manualTargetTotal}조건` : "",
      codexCoverage.pass ? codexCoverage.evidence : "",
    ].filter(Boolean).join("; ")
    : [
      `human ${manualTotalMinutes.toFixed(1)}/${MIN_MANUAL_TOTAL_MINUTES.toFixed(1)}분, 핵심 ${manualTargetPassCount}/${manualTargetTotal}조건`,
      codexCoverage.evidence,
    ].join("; ");

  rows.push({
    req: "직접 플레이 2시간 목표",
    evidence: directPlayGoalEvidence,
    pass: directPlayGoalPass,
    missing: !directPlayGoalPass,
  });
  rows.push({
    req: "사람 수동 보강 증거",
    evidence: manual
      ? `${isExampleManualLog(manual) ? "예시 로그 제외, " : ""}human ${validManualSessionCount}/${manualSessionCount}세션, codex-direct ${codexDirectSessions.length}세션 ${codexDirectMinutes.toFixed(1)}분, 무효 ${invalidManual.length}개, ${manualTotalMinutes.toFixed(1)}/${MIN_MANUAL_TOTAL_MINUTES.toFixed(1)}분, ${manualProgressText}, 난이도별 ${manualDifficultyMinutesText}, ${pendingManualText}`
      : `아직 실제 수동 플레이 기록 없음, ${manualProgressText}`,
    pass: !!manual && manualTotalMinutes >= 120 && manualCoversAll && manualCoversMinimumMinutes,
    missing: !manual || manualTotalMinutes < 120 || !manualCoversAll || !manualCoversMinimumMinutes,
    supplemental: true,
  });
  rows.push({
    req: "Codex 직접 조작 보조 증거 분리",
    evidence: allCodexDirectSessions.length > 0
      ? `codex-direct ${allCodexDirectSessions.length}세션 ${allCodexDirectMinutes.toFixed(1)}분, human 집계 ${manualTotalMinutes.toFixed(1)}분에는 미포함`
      : "codex-direct 보조 세션 없음",
    pass: true,
  });
  if (allCodexDirectSessions.length > 0) {
    rows.push({
      req: "Codex 직접 플레이형 2시간 커버리지",
      evidence: codexCoverage.evidence,
      pass: codexCoverage.pass,
      missing: !codexCoverage.pass,
    });
  }
  rows.push({
    req: "수동: 무효 세션 없음",
    evidence: manual ? invalidManualEvidence(invalidManual) : "수동 로그 없음",
    pass: invalidManual.length === 0,
    missing: !!manual && invalidManual.length > 0,
  });
  rows.push({
    req: "수동: 시작 마커 미완료 없음",
    evidence: manual ? pendingManualEvidence(pendingManual) : "수동 로그 없음",
    pass: pendingManual.length === 0,
    missing: !!manual && pendingManual.length > 0,
  });
  rows.push({
    req: "다음 수동 플레이 세션",
    evidence: manualNextEvidence(manual),
    pass: !manualNextMissing(manual),
    missing: manualNextMissing(manual),
    supplemental: true,
  });
  rows.push({
    req: "수동: 입문자 무전설 클리어",
    evidence: manualEvidence(noviceManual),
    pass: noviceManualPass,
    missing: !manual || !noviceManualPass,
    supplemental: true,
  });
  rows.push({
    req: "수동: 일반 1~2전설 클리어권",
    evidence: manualEvidence(normalManual),
    pass: normalManualPass,
    missing: !manual || !normalManualPass,
    supplemental: true,
  });
  rows.push({
    req: "수동: 중급자 5전설 이상 클리어권",
    evidence: manualEvidence(intermediateManual),
    pass: intermediateManualPass,
    missing: !manual || !intermediateManualPass,
    supplemental: true,
  });
  rows.push({
    req: "수동: 고수는 5전설보다 높은 성장 필요",
    evidence: manualEvidence(expertManual),
    pass: expertManualWeakFail && expertManualStrongClear,
    missing: !manual || !expertManualWeakFail || !expertManualStrongClear,
    supplemental: true,
  });
  rows.push({
    req: "수동: 초고수는 매우 어려움",
    evidence: manualEvidence(masterManual),
    pass: masterManualPass,
    missing: !manual || !masterManualPass,
    supplemental: true,
  });
  rows.push({
    req: "수동 관찰: 일반 무전설 경계",
    evidence: manualEvidence(normalManual.filter(MANUAL_OBSERVATIONS[0].predicate)),
    pass: normalNoLegendObservation,
    missing: !manual || !normalNoLegendObservation,
    supplemental: true,
  });
  rows.push({
    req: "수동 관찰: 중급자 2전설 경계",
    evidence: manualEvidence(intermediateManual.filter(MANUAL_OBSERVATIONS[1].predicate)),
    pass: intermediateTwoLegendObservation,
    missing: !manual || !intermediateTwoLegendObservation,
    supplemental: true,
  });
  rows.push({
    req: "수동 관찰: 고수 제한 없음 성장",
    evidence: manualEvidence(expertManual.filter(MANUAL_OBSERVATIONS[2].predicate)),
    pass: expertOpenGrowthObservation,
    missing: !manual || !expertOpenGrowthObservation,
    supplemental: true,
  });
  rows.push({
    req: "수동 관찰: 초고수 추가 실패",
    evidence: manualEvidence(masterManual.filter(MANUAL_OBSERVATIONS[3].predicate)),
    pass: masterExtraFailureObservation,
    missing: !manual || !masterExtraFailureObservation,
    supplemental: true,
  });

  return rows;
}

function buildMarkdown(balance, browser, direct, manual, codex) {
  const rows = buildRows(balance, browser, direct, manual, codex);
  const lines = [
    "# 5난이도 밸런스 감사",
    "",
    `- 생성 시각: ${new Date().toISOString()}`,
    `- balance: ${balancePath} (${balance ? "loaded" : "missing"})`,
    `- browser-balance: ${browserPath} (${browser ? "loaded" : "missing"})`,
    `- browser-direct: ${directPath} (${direct ? "loaded" : "missing"})`,
    `- manual-playlog: ${manualPath} (${manual ? "loaded" : "missing"})`,
    `- codex-direct-playlog: ${codexPath} (${codex ? "loaded" : "missing"})`,
    "",
    "| 요구사항 | 상태 | 근거 |",
    "| --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| ${row.req} | ${status(row.pass, row.missing)} | ${row.evidence} |`);
  }
  lines.push("");
  lines.push("## 판정");
  lines.push("");
  const coreRows = rows.filter((r) => !r.supplemental);
  const corePassed = coreRows.every((r) => r.pass);
  const missingRows = coreRows.filter((r) => r.missing || !r.pass);
  const supplementalMissingRows = rows.filter((r) => r.supplemental && !r.pass);
  lines.push(`- 자동/브라우저/직접 플레이 검증: ${corePassed ? "PASS" : "FAIL"}`);
  lines.push(`- 핵심 미완료 항목: ${missingRows.length > 0 ? missingRows.map((r) => r.req).join(", ") : "없음"}`);
  lines.push(`- 보강 수동 증거 미완료: ${supplementalMissingRows.length > 0 ? supplementalMissingRows.map((r) => r.req).join(", ") : "없음"}`);
  lines.push(missingRows.length === 0
    ? "- 목표 완료 여부: 원 요청 기준 핵심 항목이 충족되었다."
    : "- 목표 완료 여부: 핵심 미완료 항목이 있으므로 아직 완료로 보지 않는다.");
  return lines.join("\n");
}

const balance = readJson(balancePath);
const browser = readJson(browserPath);
const direct = readJson(directPath);
const manual = readJson(manualPath);
const codex = codexPath === manualPath ? null : readCodexJson(codexPath);
const rows = buildRows(balance, browser, direct, manual, codex);
const markdown = buildMarkdown(balance, browser, direct, manual, codex);

console.log(markdown);

if (outPath) {
  const dir = dirname(outPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, markdown, "utf8");
}

if (args.assert === "true") {
  const failedRows = rows.filter((row) => !row.pass && !row.supplemental);
  if (failedRows.length > 0) {
    console.error("");
    console.error(`balance-audit assert failed: ${failedRows.length}개 항목 미충족`);
    for (const row of failedRows) {
      console.error(`- ${row.req}: ${status(row.pass, row.missing)} (${row.evidence})`);
    }
    process.exit(1);
  }
  console.log("balance-audit assert passed");
}
