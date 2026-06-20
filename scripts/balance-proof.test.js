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
    expect(result.stderr).toContain("추천 시작 마커: yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
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
});
