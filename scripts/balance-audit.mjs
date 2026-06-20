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
const outPath = typeof args.out === "string" && args.out !== "true" ? args.out : "";
const MIN_MANUAL_MINUTES_PER_DIFFICULTY = 12;
const MIN_MANUAL_TARGET_SESSION_MINUTES = 12;
const MIN_MANUAL_TOTAL_MINUTES = 120;
const MIN_BROWSER_DIRECT_SEEDS = 6;
const REQUIRED_DIFFICULTIES = ["novice", "normal", "intermediate", "expert", "master"];
const CURRENT_DATA_VERSION = readCurrentDataVersion();

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readCurrentDataVersion() {
  try {
    const source = readFileSync("src/data/version.ts", "utf8");
    return source.match(/export const DATA_VERSION = "([^"]+)"/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
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

function directScenario(direct, id) {
  return direct?.scenarios?.find((s) => s.id === id) ?? null;
}

function directObservation(direct, labelPrefix) {
  return direct?.observations?.find((g) => g.label?.startsWith(labelPrefix)) ?? null;
}

function directText(scenario) {
  if (!scenario) return "n/a";
  return `${pct(Number(scenario.clearRate ?? 0))}, 평균 ${Number(scenario.avgRound ?? 0).toFixed(1)}R, 평균 전설 ${Number(scenario.avgLegendOrBetter ?? 0).toFixed(1)}, 압박 ${pct(Number(scenario.avgPressureRatio ?? 0))}`;
}

function directBetterThan(base, improved) {
  if (!base || !improved) return false;
  return Number(improved.clearRate ?? 0) > Number(base.clearRate ?? 0) ||
    Number(improved.avgRound ?? 0) >= Number(base.avgRound ?? 0) + 1 ||
    Number(improved.avgPressureRatio ?? 1) < Number(base.avgPressureRatio ?? 1);
}

function manualMinutes(manual) {
  if (!manual) return 0;
  if (isExampleManualLog(manual)) return 0;
  if (Array.isArray(manual.sessions)) {
    return realManualSessions(manual).reduce((sum, s) => {
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
  return new Set(realManualSessions(manual).map((s) => s.difficulty).filter(Boolean));
}

function manualMinutesByDifficulty(manual) {
  const result = new Map();
  for (const session of realManualSessions(manual)) {
    result.set(session.difficulty, (result.get(session.difficulty) ?? 0) + sessionMinutes(session));
  }
  return result;
}

function manualSessions(manual, difficulty) {
  return realManualSessions(manual).filter((s) => s.difficulty === difficulty);
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
      const finish = ` finish=${s.finishCommandTemplate ?? pendingFinishCommandTemplate(s)}`;
      return `${id} ${difficulty} stage=${stage} seed=${seed} startedAt=${startedAt}${finish}`;
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
  const difficulty = String(session.difficulty ?? "");
  const result = sessionResult(session);
  const stage = Number(session.stage);
  const round = Number(session.round);
  const legends = legendCount(session);
  const maxGrade = String(session.maxGrade ?? "");
  const seed = String(session.seed ?? "");
  const dataVersion = String(session.dataVersion ?? "");
  const stateChecksum = String(session.stateChecksum ?? "");
  return ["novice", "normal", "intermediate", "expert", "master"].includes(difficulty) &&
    ["clear", "cleared", "win", "won", "victory", "loss", "lose", "lost", "fail", "failed", "defeat", "quit"].includes(result) &&
    Number.isFinite(stage) && stage >= 1 &&
    Number.isFinite(round) && round >= 1 &&
    Number.isFinite(legends) && legends >= 0 &&
    isLegendMetadataConsistent(maxGrade, legends) &&
    ["common", "rare", "hero", "legend", "hidden"].includes(maxGrade) &&
    seed.length > 0 &&
    dataVersion.length > 0 &&
    /^[0-9a-f]{8}$/i.test(stateChecksum);
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

function reachedFinalRound(session) {
  return Number(session.round ?? 0) >= 40;
}

function isMeaningfulManualTargetSession(session) {
  return sessionMinutes(session) >= MIN_MANUAL_TARGET_SESSION_MINUTES;
}

function manualEvidence(sessions) {
  if (sessions.length === 0) return "증거 없음";
  return sessions
    .map((s) => {
      const result = sessionResult(s) || "결과 없음";
      const round = s.round !== undefined ? `${s.round}R` : "라운드 없음";
      const legends = `${legendCount(s)}전설 이상`;
      const minutes = `${sessionMinutes(s).toFixed(1)}분`;
      const checksum = s.stateChecksum ? `#${s.stateChecksum}` : "체크섬 없음";
      return `${s.difficulty} ${result} ${round} ${legends} ${minutes} ${checksum}`;
    })
    .join("; ");
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
    label: "고수 5전설 이하 40R 실패",
    difficulty: "expert",
    minutes: MIN_MANUAL_TARGET_SESSION_MINUTES,
    goal: "전설 5개 이하 성장 조건으로 40R 실패",
    logHint: "result=loss round=40 legends<=5",
    predicate: (s) => isMeaningfulManualTargetSession(s) && isLoss(s) && reachedFinalRound(s) && legendCount(s) <= 5,
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

function manualNextEvidence(manual) {
  const totalMinutes = manualMinutes(manual);
  const minutesByDifficulty = manualMinutesByDifficulty(manual);
  for (const target of MANUAL_TARGETS) {
    if (!hasManual(manual, target.difficulty, target.predicate)) {
      return `${target.label} (${target.minutes.toFixed(1)}분 이상) - ${target.goal}; 기록 힌트: ${target.logHint}; 추천 시작 마커: ${startNextCommandTemplate(target)}`;
    }
  }
  for (const difficulty of REQUIRED_DIFFICULTIES) {
    const current = minutesByDifficulty.get(difficulty) ?? 0;
    if (current < MIN_MANUAL_MINUTES_PER_DIFFICULTY) {
      return `${difficulty} 추가 ${(MIN_MANUAL_MINUTES_PER_DIFFICULTY - current).toFixed(1)}분 이상 - 난이도별 최소 ${MIN_MANUAL_MINUTES_PER_DIFFICULTY}분 보충; 추천 시작 마커: ${startNextCommandTemplate({ difficulty })}`;
    }
  }
  if (totalMinutes < MIN_MANUAL_TOTAL_MINUTES) {
    return `자유 난이도 추가 ${(MIN_MANUAL_TOTAL_MINUTES - totalMinutes).toFixed(1)}분 이상 - 총 ${MIN_MANUAL_TOTAL_MINUTES}분 보충; 추천 시작 마커: ${startNextCommandTemplate({ difficulty: "any" })}`;
  }
  return "필요 없음 - 수동 플레이 증거 목표 충족";
}

function manualNextMissing(manual) {
  return manualNextEvidence(manual) !== "필요 없음 - 수동 플레이 증거 목표 충족";
}

function startNextCommandTemplate(step) {
  if (!step) return "";
  const difficultyArg = step.difficulty === "any" ? " --difficulty=DIFFICULTY" : "";
  const outArg = manualPath === DEFAULT_MANUAL_LOG_PATH ? "" : ` --out=${shellArg(manualPath)}`;
  return `yarn manual-playlog --start-next${difficultyArg} --seed=GAME_SEED_HERE${outArg}`;
}

function buildRows(balance, browser, direct, manual) {
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
  rows.push({
    req: "고수: 중급 예산보다 더 높은 성장 필요",
    evidence: `5전설 ${rateText(balance, "expertFiveLegend")}, 제한 없음 ${rateText(balance, "expertOpen")}`,
    pass: typeof expertFive === "number" && typeof expertOpen === "number" &&
      expertFive <= 0.1 && expertOpen >= 0.4 && expertOpen >= expertFive + 0.3,
  });

  const masterOpen = clearRate(balance, "masterOpen");
  rows.push({
    req: "초고수: 매우 어려움",
    evidence: `제한 없음 ${rateText(balance, "masterOpen")}`,
    pass: typeof masterOpen === "number" && masterOpen <= 0.05,
  });

  rows.push({
    req: "브라우저 10R 체감 게이트",
    evidence: browser ? `${browser.gates?.filter((g) => g.pass).length ?? 0}/${browser.gates?.length ?? 0} gates` : "missing browser-balance JSON",
    pass: !!browser?.passed,
    missing: !browser,
  });

  const directSeconds = Number(direct?.totalSimulatedSeconds ?? 0);
  const directScenarioIds = [
    "noviceHero",
    "normalNoLegend",
    "normalOneLegend",
    "normalTwoLegend",
    "intermediateTwoLegend",
    "intermediateFiveLegend",
    "expertFiveLegend",
    "expertOpen",
    "masterOpen",
  ];
  const directCoversTargets = directScenarioIds.every((id) => !!directScenario(direct, id));
  rows.push({
    req: "브라우저 직접 플레이형 자동 표본 범위",
    evidence: direct ? `${direct.scenarios?.length ?? 0}/${directScenarioIds.length} target scenarios, ${direct.seeds ?? "?"}/${MIN_BROWSER_DIRECT_SEEDS} seeds, ${(directSeconds / 3600).toFixed(2)} simulated hours` : "missing browser-direct JSON",
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
  const directExpertFive = directScenario(direct, "expertFiveLegend");
  const directExpertOpen = directScenario(direct, "expertOpen");
  const directMaster = directScenario(direct, "masterOpen");
  const directNovicePass = directObservation(direct, "입문자 직접 플레이 표본")?.pass ??
    (!!directNovice && (Number(directNovice.clearRate ?? 0) >= 0.5 || Number(directNovice.avgRound ?? 0) >= 39));
  const directNormalPass = directObservation(direct, "일반 직접 플레이 표본")?.pass ??
    (!!directNormalNo && Number(directNormalNo.clearRate ?? 1) <= 0.5 && directBetterThan(directNormalNo, directNormalTwo));
  const directIntermediatePass = directObservation(direct, "중급자 직접 플레이 표본")?.pass ??
    (!!directIntermediateTwo && !!directIntermediateFive &&
      (Number(directIntermediateFive.clearRate ?? 0) > Number(directIntermediateTwo.clearRate ?? 0) ||
        Number(directIntermediateFive.avgRound ?? 0) >= Number(directIntermediateTwo.avgRound ?? 0) + 1 ||
        Number(directIntermediateFive.avgPressureRatio ?? 1) < Number(directIntermediateTwo.avgPressureRatio ?? 1)));
  const directExpertPass = directObservation(direct, "고수 직접 플레이 표본")?.pass ??
    directBetterThan(directExpertFive, directExpertOpen);
  const directMasterPass = directObservation(direct, "초고수 직접 플레이 표본")?.pass ??
    (!!directMaster && Number(directMaster.clearRate ?? 1) <= 0.1);
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
    req: "브라우저 직접: 고수는 5전설보다 높은 성장 필요",
    evidence: `5전설 ${directText(directExpertFive)}; 제한 없음 ${directText(directExpertOpen)}`,
    pass: directExpertPass,
    missing: !direct || !directExpertFive || !directExpertOpen,
  });
  rows.push({
    req: "브라우저 직접: 초고수는 매우 어려움",
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
  const validManualSessionCount = realManualSessions(manual).length;
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
  const expertManualWeakFail = hasManual(manual, "expert", (s) => isMeaningfulManualTargetSession(s) && isLoss(s) && reachedFinalRound(s) && legendCount(s) <= 5);
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
  const manualRemainingMinutes = Math.max(0, MIN_MANUAL_TOTAL_MINUTES - manualTotalMinutes);
  const manualProgressText = `남은 ${manualRemainingMinutes.toFixed(1)}분, 목표 ${manualTargetPassCount}/${manualTargetTotal}개 완료`;

  rows.push({
    req: "사람이 직접 2시간 플레이",
    evidence: manual
      ? `${isExampleManualLog(manual) ? "예시 로그 제외, " : ""}증거검증 ${validManualSessionCount}/${manualSessionCount}세션, 무효 ${invalidManual.length}개, ${manualTotalMinutes.toFixed(1)}/${MIN_MANUAL_TOTAL_MINUTES.toFixed(1)}분, ${manualProgressText}, 난이도별 ${manualDifficultyMinutesText}, ${pendingManualText}`
      : `아직 실제 수동 플레이 기록 없음, ${manualProgressText}`,
    pass: !!manual && manualTotalMinutes >= 120 && manualCoversAll && manualCoversMinimumMinutes,
    missing: !manual || manualTotalMinutes < 120 || !manualCoversAll || !manualCoversMinimumMinutes,
  });
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
  });
  rows.push({
    req: "수동: 입문자 무전설 클리어",
    evidence: manualEvidence(noviceManual),
    pass: noviceManualPass,
    missing: !manual || !noviceManualPass,
  });
  rows.push({
    req: "수동: 일반 1~2전설 클리어권",
    evidence: manualEvidence(normalManual),
    pass: normalManualPass,
    missing: !manual || !normalManualPass,
  });
  rows.push({
    req: "수동: 중급자 5전설 이상 클리어권",
    evidence: manualEvidence(intermediateManual),
    pass: intermediateManualPass,
    missing: !manual || !intermediateManualPass,
  });
  rows.push({
    req: "수동: 고수는 5전설보다 높은 성장 필요",
    evidence: manualEvidence(expertManual),
    pass: expertManualWeakFail && expertManualStrongClear,
    missing: !manual || !expertManualWeakFail || !expertManualStrongClear,
  });
  rows.push({
    req: "수동: 초고수는 매우 어려움",
    evidence: manualEvidence(masterManual),
    pass: masterManualPass,
    missing: !manual || !masterManualPass,
  });

  return rows;
}

function buildMarkdown(balance, browser, direct, manual) {
  const rows = buildRows(balance, browser, direct, manual);
  const lines = [
    "# 5난이도 밸런스 감사",
    "",
    `- 생성 시각: ${new Date().toISOString()}`,
    `- balance: ${balancePath} (${balance ? "loaded" : "missing"})`,
    `- browser-balance: ${browserPath} (${browser ? "loaded" : "missing"})`,
    `- browser-direct: ${directPath} (${direct ? "loaded" : "missing"})`,
    `- manual-playlog: ${manualPath} (${manual ? "loaded" : "missing"})`,
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
  const hardRows = rows.filter((r) => !r.missing);
  const hardPassed = hardRows.every((r) => r.pass);
  const missingRows = rows.filter((r) => r.missing);
  lines.push(`- 자동/브라우저 검증: ${hardPassed ? "PASS" : "FAIL"}`);
  lines.push(`- 미완료 항목: ${missingRows.length > 0 ? missingRows.map((r) => r.req).join(", ") : "없음"}`);
  lines.push(missingRows.length === 0
    ? "- 목표 완료 여부: 감사표 기준으로 모든 항목이 충족되었다."
    : "- 목표 완료 여부: 미완료 항목이 있으므로 아직 완료로 보지 않는다.");
  return lines.join("\n");
}

const balance = readJson(balancePath);
const browser = readJson(browserPath);
const direct = readJson(directPath);
const manual = readJson(manualPath);
const rows = buildRows(balance, browser, direct, manual);
const markdown = buildMarkdown(balance, browser, direct, manual);

console.log(markdown);

if (outPath) {
  const dir = dirname(outPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, markdown, "utf8");
}

if (args.assert === "true") {
  const failedRows = rows.filter((row) => !row.pass);
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
