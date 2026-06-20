import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "borandi-balance-audit-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeJson(name, data) {
  const path = join(tempDir, name);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  return path;
}

function runAudit(args) {
  return execFileSync(process.execPath, ["scripts/balance-audit.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function runAuditFailure(args) {
  const result = spawnSync(process.execPath, ["scripts/balance-audit.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status === 0) throw new Error("balance-audit command unexpectedly succeeded");
  return result;
}

function scenario(id, difficulty, clearRate) {
  return { id, difficulty, report: { clearRate } };
}

function completeBalance() {
  return {
    scenarios: [
      scenario("noviceHero", "novice", 1),
      scenario("normalNoLegend", "normal", 0.05),
      scenario("normalOneLegend", "normal", 0.35),
      scenario("normalTwoLegend", "normal", 0.55),
      scenario("intermediateTwoLegend", "intermediate", 0.1),
      scenario("intermediateFiveLegend", "intermediate", 0.5),
      scenario("intermediateOpen", "intermediate", 0.95),
      scenario("expertFiveLegend", "expert", 0),
      scenario("expertOpen", "expert", 0.6),
      scenario("masterOpen", "master", 0),
    ],
  };
}

function boundaryNormalBalance() {
  const balance = completeBalance();
  for (const item of balance.scenarios) {
    if (item.id === "normalNoLegend") item.report.clearRate = 0.13;
    if (item.id === "normalOneLegend") item.report.clearRate = 0.2;
    if (item.id === "normalTwoLegend") item.report.clearRate = 0.53;
  }
  return balance;
}

function completeBrowser() {
  return { passed: true, gates: [{ pass: true }, { pass: true }] };
}

function directScenario(id, clearRate, avgRound, avgPressureRatio, avgLegendOrBetter) {
  return { id, clearRate, avgRound, avgPressureRatio, avgLegendOrBetter };
}

function completeDirect() {
  return {
    passed: true,
    seeds: 2,
    totalSimulatedSeconds: 3600,
    scenarios: [
      directScenario("noviceHero", 1, 40, 0, 0),
      directScenario("normalNoLegend", 0, 37, 0.9, 0),
      directScenario("normalOneLegend", 1, 40, 0.1, 1),
      directScenario("normalTwoLegend", 1, 40, 0, 2),
      directScenario("intermediateTwoLegend", 0, 38, 0.8, 2),
      directScenario("intermediateFiveLegend", 1, 40, 0.1, 5),
      directScenario("expertFiveLegend", 0, 39, 0.8, 5),
      directScenario("expertOpen", 1, 40, 0.1, 8),
      directScenario("masterOpen", 0, 3, 1.2, 8),
    ],
    observations: [
      { label: "입문자 직접 플레이 표본", pass: true },
      { label: "일반 직접 플레이 표본", pass: true },
      { label: "중급자 직접 플레이 표본", pass: true },
      { label: "고수 직접 플레이 표본", pass: true },
      { label: "초고수 직접 플레이 표본", pass: true },
    ],
  };
}

function session(index, difficulty, result, legends, maxGrade, round = 40) {
  const start = new Date(Date.UTC(2026, 0, 1, index, 0, 0));
  const end = new Date(start.getTime() + 20 * 60 * 1000);
  return {
    source: "human-playtest",
    difficulty,
    minutes: 20,
    result,
    stage: 1,
    round,
    seed: `TEST-${index}`,
    legends,
    maxGrade,
    dataVersion: "0.8.0",
    stateChecksum: `${index.toString(16).padStart(8, "0")}`,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
  };
}

function completeManual() {
  return {
    sessions: [
      session(1, "novice", "clear", 0, "hero"),
      session(2, "normal", "clear", 1, "legend"),
      session(3, "intermediate", "clear", 5, "legend"),
      session(4, "expert", "loss", 5, "legend"),
      session(5, "expert", "clear", 6, "legend"),
      session(6, "master", "loss", 0, "hero", 3),
    ],
  };
}

function manualWithPendingStart() {
  const manual = completeManual();
  manual.pendingSessions = [
    {
      id: "pending-run",
      source: "human-playtest-start",
      difficulty: "normal",
      stage: 1,
      seed: "PENDING",
      startedAt: "2026-01-01T09:00:00.000Z",
      notes: "일반 1~2전설 40R 클리어",
    },
  ];
  return manual;
}

function manualWithInvalidSessions() {
  const manual = completeManual();
  manual.sessions.push({
    source: "human-playtest",
    difficulty: "normal",
    minutes: 20,
    result: "clear",
    stage: 1,
    round: 40,
    seed: "BAD-TIME",
    legends: 1,
    maxGrade: "legend",
    dataVersion: "0.8.0",
    stateChecksum: "bad00001",
    startedAt: "2026-01-01T07:00:00.000Z",
    endedAt: "2026-01-01T07:01:00.000Z",
  });
  manual.sessions.push({
    source: "human-playtest",
    difficulty: "expert",
    minutes: 20,
    result: "clear",
    stage: 1,
    round: 40,
    seed: "DUP-SEED",
    legends: 6,
    maxGrade: "legend",
    dataVersion: "0.8.0",
    stateChecksum: "00000001",
    startedAt: "2026-01-01T08:00:00.000Z",
    endedAt: "2026-01-01T08:20:00.000Z",
  });
  return manual;
}

function writeCompleteInputs({ manual = completeManual() } = {}) {
  return {
    balance: writeJson("balance.json", completeBalance()),
    browser: writeJson("browser.json", completeBrowser()),
    direct: writeJson("direct.json", completeDirect()),
    manual: manual ? writeJson("manual.json", manual) : join(tempDir, "missing-manual.json"),
  };
}

describe("balance-audit assert", () => {
  it("모든 자동/브라우저/수동 증거가 있으면 assert가 성공한다", () => {
    const paths = writeCompleteInputs();

    const output = runAudit([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(output).toContain("목표 완료 여부: 감사표 기준으로 모든 항목이 충족되었다.");
    expect(output).toContain("다음 수동 플레이 세션 | PASS | 필요 없음 - 수동 플레이 증거 목표 충족");
  });

  it("일반 1전설 최소 클리어권과 2전설 개선 기준이면 assert가 성공한다", () => {
    const paths = {
      balance: writeJson("balance.json", boundaryNormalBalance()),
      browser: writeJson("browser.json", completeBrowser()),
      direct: writeJson("direct.json", completeDirect()),
      manual: writeJson("manual.json", completeManual()),
    };

    const output = runAudit([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(output).toContain("일반: 전설 1~2개부터 클리어권 | PASS");
  });

  it("수동 2시간 증거가 없으면 assert가 실패한다", () => {
    const paths = writeCompleteInputs({ manual: null });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | MISSING");
    expect(failed.stdout).toContain("다음 수동 플레이 세션 | MISSING | 입문자 무전설 40R 클리어");
    expect(failed.stdout).toContain("추천 시작 마커: yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
    expect(failed.stderr).toContain("balance-audit assert failed");
  });

  it("수동 시작 마커가 미완료로 남아 있으면 assert가 실패한다", () => {
    const paths = writeCompleteInputs({ manual: manualWithPendingStart() });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("수동: 시작 마커 미완료 없음 | MISSING");
    expect(failed.stdout).toContain("pending-run normal stage=1 seed=PENDING");
    expect(failed.stdout).toContain("finish=yarn manual-playlog --finish=pending-run");
    expect(failed.stdout).toContain("--result=clear --round=40 --legends=1 --maxGrade=legend");
    expect(failed.stdout).toContain("--endedAt=RESULT_ENDED_AT");
    expect(failed.stderr).toContain("수동: 시작 마커 미완료 없음");
  });

  it("수동 로그에 무효 세션이 있으면 감사에서 사유를 출력하고 실패한다", () => {
    const paths = writeCompleteInputs({ manual: manualWithInvalidSessions() });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | PASS | 증거검증 6/8세션, 무효 2개");
    expect(failed.stdout).toContain("수동: 무효 세션 없음 | MISSING");
    expect(failed.stdout).toContain("#7 normal clear 40R seed=BAD-TIME #bad00001");
    expect(failed.stdout).toContain("startedAt/endedAt와 기록 시간이 맞지 않음");
    expect(failed.stdout).toContain("#8 expert clear 40R seed=DUP-SEED #00000001");
    expect(failed.stdout).toContain("stateChecksum 중복");
    expect(failed.stderr).toContain("수동: 무효 세션 없음");
  });
});
