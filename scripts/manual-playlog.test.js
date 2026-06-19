import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let tempDir = "";

function makeTempPath(name) {
  tempDir = mkdtempSync(join(tmpdir(), "borandi-manual-log-"));
  return join(tempDir, name);
}

function runManualPlaylog(args) {
  return execFileSync(process.execPath, ["scripts/manual-playlog.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function runManualPlaylogFailure(args) {
  const result = spawnSync(process.execPath, ["scripts/manual-playlog.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status === 0) throw new Error("manual-playlog command unexpectedly succeeded");
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function appendSession(out, {
  difficulty,
  minutes,
  result,
  round,
  legends,
  maxGrade,
  checksum,
  startedAt,
}) {
  const startMs = Date.parse(startedAt);
  const endedAt = new Date(startMs + minutes * 60_000).toISOString();
  runManualPlaylog([
    `--out=${out}`,
    `--difficulty=${difficulty}`,
    `--minutes=${minutes}`,
    `--result=${result}`,
    "--stage=1",
    `--round=${round}`,
    `--seed=TEST-${checksum}`,
    `--legends=${legends}`,
    `--maxGrade=${maxGrade}`,
    "--dataVersion=0.8.0",
    `--stateChecksum=${checksum}`,
    `--startedAt=${startedAt}`,
    `--endedAt=${endedAt}`,
  ]);
}

afterEach(() => {
  if (!tempDir) return;
  rmSync(tempDir, { recursive: true, force: true });
  tempDir = "";
});

describe("manual-playlog plan", () => {
  it("빈 실제 로그에는 목표 세션 6개와 총 120분 보충 계획이 나온다", () => {
    const out = makeTempPath("empty.json");
    const plan = JSON.parse(runManualPlaylog([`--out=${out}`, "--plan-json"]));

    expect(plan.passed).toBe(false);
    expect(plan.current.totalMinutes).toBe(0);
    expect(plan.steps).toHaveLength(7);
    expect(plan.steps.slice(0, 6).map((step) => step.kind)).toEqual(Array(6).fill("target-session"));
    expect(plan.steps[6]).toMatchObject({
      kind: "total-minutes",
      minutes: 48,
      label: "총 120분 보충",
    });
  });

  it("예시 로그는 실제 2시간 수동 증거 계획에서 제외된다", () => {
    const plan = JSON.parse(runManualPlaylog([
      "--out=docs/manual-balance-playlog.example.json",
      "--plan-json",
    ]));

    expect(plan.passed).toBe(false);
    expect(plan.current.validSessionCount).toBe(0);
    expect(plan.current.totalMinutes).toBe(0);
    expect(plan.steps).toHaveLength(7);
  });

  it("다음 필요 세션만 출력할 수 있다", () => {
    const out = makeTempPath("next.json");
    const next = JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"]));

    expect(next.passed).toBe(false);
    expect(next.next).toMatchObject({
      kind: "target-session",
      difficulty: "novice",
      label: "입문자 무전설 40R 클리어",
      minutes: 12,
    });
  });

  it("수동 증거 assert는 빈 로그에서 실패 코드와 다음 세션을 출력한다", () => {
    const out = makeTempPath("assert-empty.json");
    const failed = runManualPlaylogFailure([`--out=${out}`, "--assert"]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("수동 증거 미충족");
    expect(failed.stderr).toContain("다음 필요 세션: 입문자 무전설 40R 클리어");
  });

  it("필수 목표와 120분을 채운 로그는 남은 계획이 없다", () => {
    const out = makeTempPath("complete.json");
    const sessions = [
      ["novice", 12, "clear", 40, 0, "hero", "20000001"],
      ["normal", 12, "clear", 40, 1, "legend", "20000002"],
      ["intermediate", 12, "clear", 40, 5, "legend", "20000003"],
      ["expert", 12, "loss", 40, 5, "legend", "20000004"],
      ["expert", 12, "clear", 40, 6, "legend", "20000005"],
      ["master", 12, "loss", 3, 0, "hero", "20000006"],
      ["novice", 48, "quit", 20, 0, "hero", "20000007"],
    ];
    let startMs = Date.parse("2026-06-20T00:00:00.000Z");
    for (const [difficulty, minutes, result, round, legends, maxGrade, checksum] of sessions) {
      appendSession(out, {
        difficulty,
        minutes,
        result,
        round,
        legends,
        maxGrade,
        checksum,
        startedAt: new Date(startMs).toISOString(),
      });
      startMs += (minutes + 1) * 60_000;
    }

    const log = readJson(out);
    const plan = JSON.parse(runManualPlaylog([`--out=${out}`, "--plan-json"]));

    expect(log.sessions).toHaveLength(7);
    expect(plan.passed).toBe(true);
    expect(plan.current.totalMinutes).toBe(120);
    expect(plan.steps).toEqual([]);
    expect(JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"])).next).toBeNull();
    expect(runManualPlaylog([`--out=${out}`, "--assert"])).toContain("PASS 수동 플레이 증거 충족");
  });
});
