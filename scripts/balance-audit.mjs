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
const manualPath = String(args.manual ?? "output/manual-balance-playlog.json");
const outPath = typeof args.out === "string" && args.out !== "true" ? args.out : "";
const MIN_MANUAL_MINUTES_PER_DIFFICULTY = 12;
const MIN_MANUAL_TARGET_SESSION_MINUTES = 12;

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function status(ok, missing = false) {
  if (missing) return "MISSING";
  return ok ? "PASS" : "FAIL";
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
  if (!manual || isExampleManualLog(manual)) return [];
  const seenChecksums = new Set();
  return (manual.sessions ?? []).filter((s) => {
    if (isExampleManualSession(s) || !hasValidManualTiming(s) || !hasCompleteManualMetadata(s)) return false;
    const checksum = String(s.stateChecksum).toLowerCase();
    if (seenChecksums.has(checksum)) return false;
    seenChecksums.add(checksum);
    return true;
  });
}

function countNonExampleManualSessions(manual) {
  if (!manual || isExampleManualLog(manual)) return 0;
  return (manual.sessions ?? []).filter((s) => !isExampleManualSession(s)).length;
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
    ["common", "rare", "hero", "legend", "hidden"].includes(maxGrade) &&
    seed.length > 0 &&
    dataVersion.length > 0 &&
    /^[0-9a-f]{8}$/i.test(stateChecksum);
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

function buildRows(balance, browser, direct, manual) {
  const rows = [];
  const requiredDifficulties = ["novice", "normal", "intermediate", "expert", "master"];
  const difficulties = new Set((balance?.scenarios ?? []).map((s) => s.difficulty));
  rows.push({
    req: "난이도 5종",
    evidence: [...difficulties].join(", ") || "missing",
    pass: requiredDifficulties.every((d) => difficulties.has(d)),
  });

  const novice = clearRate(balance, "noviceHero");
  rows.push({
    req: "입문자: 전설 없이 클리어 가능",
    evidence: `30시드 전설 없음 ${rateText(balance, "noviceHero")}`,
    pass: typeof novice === "number" && novice >= 0.9,
  });

  const normalNo = clearRate(balance, "normalNoLegend");
  const normalOne = clearRate(balance, "normalOneLegend");
  const normalTwo = clearRate(balance, "normalTwoLegend");
  rows.push({
    req: "일반: 전설 1~2개부터 클리어권",
    evidence: `0전설 ${rateText(balance, "normalNoLegend")}, 1전설 ${rateText(balance, "normalOneLegend")}, 2전설 ${rateText(balance, "normalTwoLegend")}`,
    pass: typeof normalNo === "number" && typeof normalOne === "number" && typeof normalTwo === "number" &&
      normalNo <= 0.25 && normalOne >= 0.2 && normalOne >= normalNo + 0.15 &&
      normalTwo >= 0.45 && normalTwo >= normalOne + 0.15,
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
    evidence: direct ? `${direct.scenarios?.length ?? 0}/${directScenarioIds.length} target scenarios, ${direct.seeds ?? "?"} seeds, ${(directSeconds / 3600).toFixed(2)} simulated hours` : "missing browser-direct JSON",
    pass: !!direct && Number(direct.seeds ?? 0) >= 2 && directSeconds > 0 && directCoversTargets,
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
    (directBetterThan(directNormalNo, directNormalOne) && directBetterThan(directNormalNo, directNormalTwo));
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
  const manualDifficultyMinutesText = requiredDifficulties
    .map((d) => `${d} ${(manualMinutesByDiff.get(d) ?? 0).toFixed(1)}분`)
    .join(", ");
  const manualCoversAll = requiredDifficulties.every((d) => manualDiffs.has(d));
  const manualCoversMinimumMinutes = requiredDifficulties.every((d) => (manualMinutesByDiff.get(d) ?? 0) >= MIN_MANUAL_MINUTES_PER_DIFFICULTY);
  const manualSessionCount = countNonExampleManualSessions(manual);
  const validManualSessionCount = realManualSessions(manual).length;
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

  rows.push({
    req: "사람이 직접 2시간 플레이",
    evidence: manual
      ? `${isExampleManualLog(manual) ? "예시 로그 제외, " : ""}증거검증 ${validManualSessionCount}/${manualSessionCount}세션, ${manualTotalMinutes.toFixed(1)}분, 난이도별 ${manualDifficultyMinutesText}`
      : "아직 실제 수동 플레이 기록 없음",
    pass: !!manual && manualTotalMinutes >= 120 && manualCoversAll && manualCoversMinimumMinutes,
    missing: !manual || manualTotalMinutes < 120 || !manualCoversAll || !manualCoversMinimumMinutes,
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
const markdown = buildMarkdown(balance, browser, direct, manual);

console.log(markdown);

if (outPath) {
  const dir = dirname(outPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, markdown, "utf8");
}
