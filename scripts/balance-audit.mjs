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

function manualMinutes(manual) {
  if (!manual) return 0;
  if (typeof manual.totalMinutes === "number") return manual.totalMinutes;
  if (typeof manual.totalSeconds === "number") return manual.totalSeconds / 60;
  return (manual.sessions ?? []).reduce((sum, s) => {
    if (typeof s.minutes === "number") return sum + s.minutes;
    if (typeof s.seconds === "number") return sum + (s.seconds / 60);
    return sum;
  }, 0);
}

function manualDifficulties(manual) {
  return new Set((manual?.sessions ?? []).map((s) => s.difficulty).filter(Boolean));
}

function manualSessions(manual, difficulty) {
  return (manual?.sessions ?? []).filter((s) => s.difficulty === difficulty);
}

function sessionMinutes(session) {
  if (typeof session.minutes === "number") return session.minutes;
  if (typeof session.seconds === "number") return session.seconds / 60;
  return 0;
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

function manualEvidence(sessions) {
  if (sessions.length === 0) return "증거 없음";
  return sessions
    .map((s) => {
      const result = sessionResult(s) || "결과 없음";
      const round = s.round !== undefined ? `${s.round}R` : "라운드 없음";
      const legends = `${legendCount(s)}전설 이상`;
      const minutes = `${sessionMinutes(s).toFixed(1)}분`;
      return `${s.difficulty} ${result} ${round} ${legends} ${minutes}`;
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
  rows.push({
    req: "브라우저 직접 플레이형 자동 표본",
    evidence: direct ? `${direct.scenarios?.length ?? 0} scenarios, ${(directSeconds / 3600).toFixed(2)} simulated hours` : "missing browser-direct JSON",
    pass: !!direct && directSeconds > 0,
    missing: !direct,
  });

  const manualTotalMinutes = manualMinutes(manual);
  const manualDiffs = manualDifficulties(manual);
  const manualCoversAll = requiredDifficulties.every((d) => manualDiffs.has(d));
  const noviceManual = manualSessions(manual, "novice");
  const normalManual = manualSessions(manual, "normal");
  const intermediateManual = manualSessions(manual, "intermediate");
  const expertManual = manualSessions(manual, "expert");
  const masterManual = manualSessions(manual, "master");

  const noviceManualPass = hasManual(manual, "novice", (s) => isClear(s) && reachedFinalRound(s) && legendCount(s) === 0);
  const normalManualPass = hasManual(manual, "normal", (s) => isClear(s) && reachedFinalRound(s) && legendCount(s) >= 1 && legendCount(s) <= 2);
  const intermediateManualPass = hasManual(manual, "intermediate", (s) => isClear(s) && reachedFinalRound(s) && legendCount(s) >= 5);
  const expertManualWeakFail = hasManual(manual, "expert", (s) => isLoss(s) && reachedFinalRound(s) && legendCount(s) <= 5);
  const expertManualStrongClear = hasManual(manual, "expert", (s) => isClear(s) && reachedFinalRound(s) && legendCount(s) >= 6);
  const masterManualPass = hasManual(manual, "master", (s) => isLoss(s));

  rows.push({
    req: "사람이 직접 2시간 플레이",
    evidence: manual
      ? `${manualTotalMinutes.toFixed(1)}분, 난이도 ${[...manualDiffs].join(", ") || "없음"}`
      : "아직 실제 수동 플레이 기록 없음",
    pass: !!manual && manualTotalMinutes >= 120 && manualCoversAll,
    missing: !manual || manualTotalMinutes < 120 || !manualCoversAll,
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
