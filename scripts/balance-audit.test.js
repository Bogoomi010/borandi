import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir;
const CURRENT_DATA_VERSION = readCurrentDataVersion();

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

function readCurrentDataVersion() {
  const source = readFileSync("src/data/version.ts", "utf8");
  return source.match(/export const DATA_VERSION = "([^"]+)"/)?.[1] ?? "";
}

function commandArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
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
    dataVersion: CURRENT_DATA_VERSION,
    seeds: 50,
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
  return { dataVersion: CURRENT_DATA_VERSION, passed: true, gates: [{ pass: true }, { pass: true }] };
}

function directScenario(id, clearRate, avgRound, avgPressureRatio, avgLegendOrBetter) {
  return { id, clearRate, avgRound, avgPressureRatio, avgLegendOrBetter };
}

function completeDirect({ seeds = 6 } = {}) {
  return {
    dataVersion: CURRENT_DATA_VERSION,
    passed: true,
    seeds,
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
    dataVersion: CURRENT_DATA_VERSION,
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

function codexDirectOnlyManual() {
  return {
    sessions: completeManual().sessions.map((s) => ({
      ...s,
      source: "codex-direct-playtest",
    })),
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
    dataVersion: CURRENT_DATA_VERSION,
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
    dataVersion: CURRENT_DATA_VERSION,
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
    expect(output).toContain("입문자: 전설 없이 클리어 가능 | PASS | 50시드 전설 없음 100.0%");
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

  it("브라우저 직접 입력 증거는 최소 6시드가 필요하다", () => {
    const paths = {
      balance: writeJson("balance.json", completeBalance()),
      browser: writeJson("browser.json", completeBrowser()),
      direct: writeJson("direct.json", completeDirect({ seeds: 2 })),
      manual: writeJson("manual.json", completeManual()),
    };

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("브라우저 직접 플레이형 자동 표본 범위 | FAIL | 9/9 target scenarios, 2/6 seeds");
    expect(failed.stderr).toContain("브라우저 직접 플레이형 자동 표본 범위");
  });

  it("관찰 배열이 없는 직접 입력 증거도 중급자 5전설 클리어권 기준을 요구한다", () => {
    const direct = completeDirect();
    direct.observations = [];
    direct.passed = true;
    for (const item of direct.scenarios) {
      if (item.id === "intermediateTwoLegend") {
        item.clearRate = 0;
        item.avgRound = 37.5;
        item.avgPressureRatio = 1.2;
      }
      if (item.id === "intermediateFiveLegend") {
        item.clearRate = 0.33;
        item.avgRound = 38.7;
        item.avgPressureRatio = 0.9;
      }
    }
    const paths = {
      balance: writeJson("balance.json", completeBalance()),
      browser: writeJson("browser.json", completeBrowser()),
      direct: writeJson("direct.json", direct),
      manual: writeJson("manual.json", completeManual()),
    };

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("브라우저 직접: 중급자 5전설 개선 | FAIL");
    expect(failed.stdout).toContain("5전설 33.0%, 평균 38.7R");
    expect(failed.stderr).toContain("브라우저 직접: 중급자 5전설 개선");
  });

  it("현재 데이터 버전이 아닌 자동/브라우저 증거는 assert가 실패한다", () => {
    const staleBalance = completeBalance();
    const staleBrowser = completeBrowser();
    const staleDirect = completeDirect();
    staleBalance.dataVersion = "0.0.0";
    staleBrowser.dataVersion = "0.0.0";
    staleDirect.dataVersion = "0.0.0";
    const paths = {
      balance: writeJson("balance.json", staleBalance),
      browser: writeJson("browser.json", staleBrowser),
      direct: writeJson("direct.json", staleDirect),
      manual: writeJson("manual.json", completeManual()),
    };

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain(`자동 밸런스 데이터 버전 | FAIL | dataVersion 0.0.0, 현재 ${CURRENT_DATA_VERSION}`);
    expect(failed.stdout).toContain(`브라우저 10R 데이터 버전 | FAIL | dataVersion 0.0.0, 현재 ${CURRENT_DATA_VERSION}`);
    expect(failed.stdout).toContain(`브라우저 직접 데이터 버전 | FAIL | dataVersion 0.0.0, 현재 ${CURRENT_DATA_VERSION}`);
    expect(failed.stderr).toContain("자동 밸런스 데이터 버전");
    expect(failed.stderr).toContain("브라우저 10R 데이터 버전");
    expect(failed.stderr).toContain("브라우저 직접 데이터 버전");
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
    expect(failed.stdout).toContain("아직 실제 수동 플레이 기록 없음, 남은 120.0분, 목표 0/6개 완료");
    expect(failed.stdout).toContain("다음 수동 플레이 세션 | MISSING | 입문자 무전설 40R 클리어");
    expect(failed.stdout).toContain("추천 시작 검증: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(failed.stdout).toContain("--dry-run");
    expect(failed.stdout).toContain("추천 시작 마커: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(failed.stdout).toContain(`--out=${commandArg(paths.manual)}`);
    expect(failed.stderr).toContain("balance-audit assert failed");
  });

  it("codex 직접 조작 세션은 사람 직접 2시간 증거를 대체하지 않는다", () => {
    const paths = writeCompleteInputs({ manual: codexDirectOnlyManual() });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | MISSING | human 0/6세션, codex-direct 6세션 120.0분");
    expect(failed.stdout).toContain("Codex 직접 조작 보조 증거 분리 | PASS | codex-direct 6세션 120.0분, human 집계 0.0분에는 미포함");
    expect(failed.stdout).toContain("수동: 입문자 무전설 클리어 | MISSING | 증거 없음");
    expect(failed.stdout).toContain("다음 수동 플레이 세션 | MISSING | 입문자 무전설 40R 클리어");
    expect(failed.stderr).toContain("사람이 직접 2시간 플레이");
  });

  it("별도 codex 직접 조작 로그는 기본 수동 증거와 분리해 표시한다", () => {
    const paths = writeCompleteInputs({ manual: null });
    const codex = writeJson("codex-direct.json", codexDirectOnlyManual());

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      `--codex=${codex}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain(`codex-direct-playlog: ${codex} (loaded)`);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | MISSING | 아직 실제 수동 플레이 기록 없음");
    expect(failed.stdout).toContain("Codex 직접 조작 보조 증거 분리 | PASS | codex-direct 6세션 120.0분, human 집계 0.0분에는 미포함");
    expect(failed.stdout).toContain("수동: 입문자 무전설 클리어 | MISSING | 증거 없음");
    expect(failed.stderr).toContain("사람이 직접 2시간 플레이");
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
    expect(failed.stdout).toContain("dryRunFinish=yarn manual-playlog --finish=pending-run");
    expect(failed.stdout).toContain("--dry-run");
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
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | PASS | human 6/8세션, codex-direct 0세션 0.0분, 무효 2개, 120.0/120.0분, 남은 0.0분, 목표 6/6개 완료");
    expect(failed.stdout).toContain("수동: 무효 세션 없음 | MISSING");
    expect(failed.stdout).toContain("#7 normal clear 40R seed=BAD-TIME #bad00001");
    expect(failed.stdout).toContain("startedAt/endedAt와 기록 시간이 맞지 않음");
    expect(failed.stdout).toContain("#8 expert clear 40R seed=DUP-SEED #00000001");
    expect(failed.stdout).toContain("stateChecksum 중복");
    expect(failed.stderr).toContain("수동: 무효 세션 없음");
  });

  it("현재 데이터 버전이 아닌 수동 세션은 감사에서 무효 처리한다", () => {
    const manual = completeManual();
    manual.sessions.push({
      source: "human-playtest",
      difficulty: "novice",
      minutes: 20,
      result: "clear",
      stage: 1,
      round: 40,
      seed: "STALE-VERSION",
      legends: 0,
      maxGrade: "hero",
      dataVersion: "0.0.0",
      stateChecksum: "bad00002",
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:20:00.000Z",
    });
    const paths = writeCompleteInputs({ manual });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | PASS | human 6/7세션, codex-direct 0세션 0.0분, 무효 1개");
    expect(failed.stdout).toContain("#7 novice clear 40R seed=STALE-VERSION #bad00002");
    expect(failed.stdout).toContain(`dataVersion 0.0.0이 현재 ${CURRENT_DATA_VERSION}와 다름`);
    expect(failed.stderr).toContain("수동: 무효 세션 없음");
  });

  it("불가능한 clear 라운드 수동 세션은 감사에서 무효 처리한다", () => {
    const manual = completeManual();
    manual.sessions.push({
      source: "human-playtest",
      difficulty: "novice",
      minutes: 20,
      result: "clear",
      stage: 1,
      round: 39,
      seed: "EARLY-CLEAR",
      legends: 0,
      maxGrade: "hero",
      dataVersion: CURRENT_DATA_VERSION,
      stateChecksum: "bad00003",
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:20:00.000Z",
    });
    const paths = writeCompleteInputs({ manual });

    const failed = runAuditFailure([
      `--balance=${paths.balance}`,
      `--browser=${paths.browser}`,
      `--direct=${paths.direct}`,
      `--manual=${paths.manual}`,
      "--assert",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("사람이 직접 2시간 플레이 | PASS | human 6/7세션, codex-direct 0세션 0.0분, 무효 1개");
    expect(failed.stdout).toContain("#7 novice clear 39R seed=EARLY-CLEAR #bad00003");
    expect(failed.stdout).toContain("필수 결과 메타데이터 누락 또는 모순");
    expect(failed.stderr).toContain("수동: 무효 세션 없음");
  });
});
