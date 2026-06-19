import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
    expect(result.stderr).toContain("yarn exited with 1");
  });
});
