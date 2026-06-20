import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "borandi-balance-proof-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function session(index, difficulty, result, legends, maxGrade, round = 40, minutes = 12) {
  const start = new Date(Date.UTC(2026, 5, 20, index, 0, 0));
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return {
    source: "human-playtest",
    difficulty,
    minutes,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    result,
    stage: 1,
    round,
    seed: `PROOF-${index}`,
    legends,
    maxGrade,
    dataVersion: "0.8.4",
    stateChecksum: `${(0x30000000 + index).toString(16)}`,
  };
}

function completeManualWithInvalidSession() {
  const sessions = [
    session(1, "novice", "clear", 0, "hero"),
    session(2, "normal", "clear", 1, "legend"),
    session(3, "intermediate", "clear", 5, "legend"),
    session(4, "expert", "loss", 5, "legend"),
    session(5, "expert", "clear", 6, "legend"),
    session(6, "master", "loss", 0, "hero", 12),
    session(7, "novice", "quit", 0, "hero", 20, 48),
    {
      ...session(8, "normal", "clear", 1, "legend"),
      seed: "BAD-TIME",
      endedAt: "2026-06-20T08:01:00.000Z",
    },
  ];
  return {
    schemaVersion: 1,
    source: "manual-playlog",
    sessions,
  };
}

describe("balance-proof require-complete", () => {
  it("수동 증거가 없으면 자동 게이트를 시작하기 전에 실패한다", () => {
    const manualPath = join(tempDir, "missing-manual.json");
    const result = spawnSync(process.execPath, [
      "scripts/balance-proof.mjs",
      "--require-complete",
      `--manual=${manualPath}`,
      `--balance=${join(tempDir, "balance.json")}`,
      `--browser=${join(tempDir, "browser.json")}`,
      `--direct=${join(tempDir, "direct.json")}`,
      `--out=${join(tempDir, "audit.md")}`,
      `--screenshots=${join(tempDir, "shots")}`,
      "--port=59999",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("$ yarn manual-playlog");
    expect(result.stdout).not.toContain("$ yarn balance ");
    expect(result.stderr).toContain("추천 시작 검증: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(result.stderr).toContain("--dry-run");
    expect(result.stderr).toContain("추천 시작 마커: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(result.stderr).toContain("yarn exited with 1");
  });

  it("미완료 수동 시작 마커가 있으면 finish 템플릿을 보여주고 자동 게이트 전에 실패한다", () => {
    const manualPath = join(tempDir, "pending-manual.json");
    writeFileSync(manualPath, JSON.stringify({
      sessions: [],
      schemaVersion: 1,
      source: "manual-playlog",
      pendingSessions: [
        {
          id: "novice-1-PROOF-PENDING-20260620T080000000Z",
          source: "human-playtest-start",
          difficulty: "novice",
          stage: 1,
          seed: "PROOF-PENDING",
          startedAt: "2026-06-20T08:00:00.000Z",
          notes: "입문자 무전설 40R 클리어",
        },
      ],
    }, null, 2), "utf8");

    const result = spawnSync(process.execPath, [
      "scripts/balance-proof.mjs",
      "--require-complete",
      `--manual=${manualPath}`,
      `--balance=${join(tempDir, "balance.json")}`,
      `--browser=${join(tempDir, "browser.json")}`,
      `--direct=${join(tempDir, "direct.json")}`,
      `--out=${join(tempDir, "audit.md")}`,
      `--screenshots=${join(tempDir, "shots")}`,
      "--port=59999",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("$ yarn manual-playlog");
    expect(result.stdout).not.toContain("$ yarn balance ");
    expect(result.stdout).toContain("PENDING 아직 finish되지 않은 시작 마커");
    expect(result.stdout).toContain("마무리 템플릿: yarn manual-playlog --finish='novice-1-PROOF-PENDING-20260620T080000000Z'");
    expect(result.stdout).toContain("--result=clear --round=40 --legends=0 --maxGrade=hero");
    expect(result.stdout).toContain("--endedAt=RESULT_ENDED_AT");
    expect(result.stdout).toContain("수동 증거 미충족");
    expect(result.stderr).toContain("yarn exited with 1");
  });

  it("무효 수동 세션이 있으면 자동 게이트 전에 실패한다", () => {
    const manualPath = join(tempDir, "invalid-manual.json");
    writeFileSync(manualPath, JSON.stringify(completeManualWithInvalidSession(), null, 2), "utf8");

    const result = spawnSync(process.execPath, [
      "scripts/balance-proof.mjs",
      "--require-complete",
      `--manual=${manualPath}`,
      `--balance=${join(tempDir, "balance.json")}`,
      `--browser=${join(tempDir, "browser.json")}`,
      `--direct=${join(tempDir, "direct.json")}`,
      `--out=${join(tempDir, "audit.md")}`,
      `--screenshots=${join(tempDir, "shots")}`,
      "--port=59999",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("$ yarn manual-playlog");
    expect(result.stdout).not.toContain("$ yarn balance ");
    expect(result.stdout).toContain("INVALID 증거로 인정되지 않은 세션:");
    expect(result.stdout).toContain("#8 normal clear 40R seed=BAD-TIME #30000008");
    expect(result.stdout).toContain("startedAt/endedAt와 기록 시간이 맞지 않음");
    expect(result.stdout).toContain("MISSING 수동 로그 무효 세션 없음: 1개 무효 세션");
    expect(result.stdout).toContain("판정: 수동 증거 미충족");
    expect(result.stderr).toContain("yarn exited with 1");
  });
});
