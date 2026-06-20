import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("증거 갱신은 browser-direct 스크린샷과 Codex 보조 로그 경로를 전달한다", () => {
    const port = 59597;
    const fakeYarn = join(tempDir, "yarn");
    const logPath = join(tempDir, "fake-yarn.log");
    writeFileSync(fakeYarn, `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_YARN_LOG"
if [ "$1" = "dev" ]; then
  port=""
  prev=""
  for arg in "$@"; do
    if [ "$prev" = "--port" ]; then port="$arg"; fi
    prev="$arg"
  done
  exec node -e "require('node:http').createServer((_, res) => res.end('ok')).listen(Number(process.argv[1]), '127.0.0.1')" "$port"
fi
if [ "$1" = "manual-playlog" ]; then
  for arg in "$@"; do
    if [ "$arg" = "--sheet" ]; then
      printf '%s\\n' '# 수동 밸런스 플레이 시트'
      printf '%s\\n' '| 목표 세션 | 0/6개 완료 |'
    fi
  done
fi
exit 0
`, "utf8");
    chmodSync(fakeYarn, 0o755);

    const browserShots = join(tempDir, "browser-shots");
    const directShots = join(tempDir, "direct-shots");
    const directCodexLog = join(tempDir, "codex-direct.json");
    const manualSheet = join(tempDir, "manual-sheet.md");
    const result = spawnSync(process.execPath, [
      "scripts/balance-proof.mjs",
      "--host=127.0.0.1",
      `--port=${port}`,
      `--manual=${join(tempDir, "manual.json")}`,
      `--balance=${join(tempDir, "balance.json")}`,
      `--browser=${join(tempDir, "browser.json")}`,
      `--direct=${join(tempDir, "direct.json")}`,
      `--out=${join(tempDir, "audit.md")}`,
      `--screenshots=${browserShots}`,
      `--direct-screenshots=${directShots}`,
      `--direct-codex-log=${directCodexLog}`,
      `--manual-sheet=${manualSheet}`,
      "--seeds=1",
      "--direct-seeds=1",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        FAKE_YARN_LOG: logPath,
      },
    });

    expect(result.status).toBe(0);
    const calls = readFileSync(logPath, "utf8");
    expect(calls).toContain(`browser-balance --url=http://127.0.0.1:${port}/ --json=${join(tempDir, "browser.json")} --screenshots=${browserShots}`);
    expect(calls).toContain(`browser-direct --url=http://127.0.0.1:${port}/ --seeds=1 --strict --json=${join(tempDir, "direct.json")} --screenshots=${directShots} --codex-log=${directCodexLog}`);
    expect(calls).toContain(`balance-audit --balance=${join(tempDir, "balance.json")} --browser=${join(tempDir, "browser.json")} --direct=${join(tempDir, "direct.json")} --manual=${join(tempDir, "manual.json")} --codex=${directCodexLog} --out=${join(tempDir, "audit.md")}`);
    expect(calls).toContain(`manual-playlog --out=${join(tempDir, "manual.json")} --sheet`);
    expect(readFileSync(manualSheet, "utf8")).toContain("# 수동 밸런스 플레이 시트");
    expect(result.stdout).toContain(`수동 플레이 시트 저장: ${manualSheet}`);
  });

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
    expect(result.stderr).toContain(`시작 전 점검: yarn manual-playlog --preflight --out='${manualPath}'`);
    expect(result.stderr).toContain(`전체 수집 계획: yarn manual-playlog --plan --out='${manualPath}'`);
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
