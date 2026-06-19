// Append one human playtest session to the manual balance play log.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const outPath = String(args.out ?? "output/manual-balance-playlog.json");
const difficulties = ["novice", "normal", "intermediate", "expert", "master"];
const results = ["clear", "loss", "quit"];
const grades = ["common", "rare", "hero", "legend", "hidden"];

function usage() {
  return [
    "사용법:",
    "  yarn manual-playlog --difficulty=normal --minutes=24 --result=loss --stage=1 --round=39 --seed=RUN123 --legends=1 --maxGrade=legend --dataVersion=0.8.0 --stateChecksum=1234abcd --notes=\"2전설, 후반 누적 압박\"",
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
    "  --notes=...",
    "  --startedAt=ISO --endedAt=ISO",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  console.error("");
  console.error(usage());
  process.exit(1);
}

function readJson(path) {
  if (!existsSync(path)) return { sessions: [] };
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data.sessions)) data.sessions = [];
  return data;
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

function durationSeconds() {
  if (seconds !== undefined) return seconds;
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

const difficulty = args.difficulty;
if (!difficulties.includes(difficulty)) {
  fail(`지원하지 않는 난이도입니다: ${difficulty ?? "(없음)"}`);
}

const result = String(args.result ?? "").toLowerCase();
if (!results.includes(result)) {
  fail(`--result 값은 ${results.join("|")} 중 하나여야 합니다.`);
}

const stage = requireNumber("stage");
const round = requireNumber("round");
const legends = requireNumber("legends");
const seed = String(args.seed ?? "");
if (!seed) fail("--seed 값이 필요합니다.");

const maxGrade = String(args.maxGrade ?? "");
if (!grades.includes(maxGrade)) {
  fail(`--maxGrade 값은 ${grades.join("|")} 중 하나여야 합니다.`);
}
const dataVersion = String(args.dataVersion ?? "");
if (!dataVersion) fail("--dataVersion 값이 필요합니다.");
const stateChecksum = String(args.stateChecksum ?? "");
if (!/^[0-9a-f]{8}$/i.test(stateChecksum)) {
  fail("--stateChecksum 값은 결과 리포트의 8자리 16진 체크섬이어야 합니다.");
}
if (stage < 1 || round < 1 || legends < 0) {
  fail("--stage/--round는 1 이상, --legends는 0 이상이어야 합니다.");
}
if (!isLegendMetadataConsistent(maxGrade, legends)) {
  fail("--legends와 --maxGrade가 모순됩니다. 전설 이상 보유 수와 최고 등급을 결과 리포트 그대로 입력하세요.");
}

const minutes = asNumber("minutes");
const seconds = asNumber("seconds");
if (minutes === undefined && seconds === undefined) {
  fail("--minutes 또는 --seconds 중 하나가 필요합니다.");
}
if ((minutes ?? 0) <= 0 && (seconds ?? 0) <= 0) {
  fail("플레이 시간은 0보다 커야 합니다.");
}

const now = new Date();
const duration = durationSeconds();
let endedAt = parseDate("endedAt", args.endedAt) ?? now;
let startedAt = parseDate("startedAt", args.startedAt);
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

const session = {
  source: "human-playtest",
  difficulty,
  ...(minutes !== undefined ? { minutes } : { seconds }),
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
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

const log = readJson(outPath);
log.schemaVersion = 1;
log.source = "manual-playlog";
if (log.sessions.some((s) => String(s.stateChecksum ?? "").toLowerCase() === stateChecksum.toLowerCase())) {
  fail(`이미 같은 결과 체크섬이 기록되어 있습니다: ${stateChecksum.toLowerCase()}`);
}
log.sessions.push(session);
log.totalMinutes = sessionsTotalMinutes(log);

const dir = dirname(outPath);
if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");

const total = log.totalMinutes;
const covered = coveredDifficulties(log);
const missing = difficulties.filter((d) => !covered.has(d));

console.log(`수동 플레이 로그 저장: ${outPath}`);
console.log(`- 추가 세션: ${difficulty}, ${(minutes ?? seconds / 60).toFixed(1)}분`);
console.log(`- 누적 시간: ${total.toFixed(1)}분 / 120.0분`);
console.log(`- 난이도 커버: ${[...covered].join(", ") || "없음"}`);
console.log(`- 남은 난이도: ${missing.join(", ") || "없음"}`);
console.log(`- 감사 통과 조건: ${total >= 120 && missing.length === 0 ? "충족" : "미충족"}`);
