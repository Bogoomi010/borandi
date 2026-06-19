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

function usage() {
  return [
    "사용법:",
    "  yarn manual-playlog --difficulty=normal --minutes=24 --result=loss --stage=1 --round=39 --notes=\"2전설, 후반 누적 압박\"",
    "",
    "필수:",
    "  --difficulty=novice|normal|intermediate|expert|master",
    "  --minutes=분 또는 --seconds=초",
    "",
    "선택:",
    "  --out=output/manual-balance-playlog.json",
    "  --result=clear|loss|quit",
    "  --stage=1 --round=40 --seed=...",
    "  --legends=2        # 전설 이상 보유 수",
    "  --maxGrade=legend",
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

const difficulty = args.difficulty;
if (!difficulties.includes(difficulty)) {
  fail(`지원하지 않는 난이도입니다: ${difficulty ?? "(없음)"}`);
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
const session = {
  difficulty,
  ...(minutes !== undefined ? { minutes } : { seconds }),
  ...(args.startedAt ? { startedAt: String(args.startedAt) } : {}),
  ...(args.endedAt ? { endedAt: String(args.endedAt) } : { endedAt: now.toISOString() }),
  ...(args.result ? { result: String(args.result) } : {}),
  ...(args.stage !== undefined ? { stage: asNumber("stage") } : {}),
  ...(args.round !== undefined ? { round: asNumber("round") } : {}),
  ...(args.seed ? { seed: String(args.seed) } : {}),
  ...(args.legends !== undefined ? { legends: asNumber("legends") } : {}),
  ...(args.maxGrade ? { maxGrade: String(args.maxGrade) } : {}),
  ...(args.notes ? { notes: String(args.notes) } : {}),
};

const log = readJson(outPath);
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
