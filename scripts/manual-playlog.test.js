import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
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

function shellArg(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
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
  it("help는 사용법과 JSON 단축 명령을 성공 코드로 출력한다", () => {
    const output = runManualPlaylog(["--help"]);

    expect(output).toContain("사용법:");
    expect(output).toContain("--preflight              # 새 수동 세션 시작 전 무효/미완료 마커 점검");
    expect(output).toContain("--preflight-json         # --preflight 결과를 JSON으로 출력");
    expect(output).toContain("--summary-json        # --summary --json과 동일");
    expect(output).toContain("--plan-json           # --plan --json과 동일");
    expect(output).toContain("--next-json           # --next --json과 동일");
    expect(output).toContain("--pending-json        # --pending --json과 동일");
  });

  it("preflight는 정리할 마커가 없으면 다음 시작 마커를 보여주고 성공한다", () => {
    const out = makeTempPath("preflight-empty.json");
    const output = runManualPlaylog([`--out=${out}`, "--preflight"]);

    expect(output).toContain("PASS 새 수동 플레이 시작 가능");
    expect(output).toContain("추천 시작 마커:");
    expect(output).toContain(`yarn manual-playlog --start-next --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(output).toContain("판정: 시작 가능");
  });

  it("preflight-json은 시작 가능 여부와 다음 시작 명령을 구조화해서 출력한다", () => {
    const out = makeTempPath("preflight-json-empty.json");
    const preflight = JSON.parse(runManualPlaylog([`--out=${out}`, "--preflight-json"]));

    expect(preflight.canStart).toBe(true);
    expect(preflight.blockingReasons).toEqual([]);
    expect(preflight.pendingCount).toBe(0);
    expect(preflight.invalidSessionCount).toBe(0);
    expect(preflight.next.label).toBe("입문자 무전설 40R 클리어");
    expect(preflight.nextStartCommandTemplate).toBe(`yarn manual-playlog --start-next --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
  });

  it("preflight는 미완료 시작 마커가 있으면 먼저 finish하도록 실패한다", () => {
    const out = makeTempPath("preflight-pending.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=PENDING-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const failed = runManualPlaylogFailure([`--out=${out}`, "--preflight"]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("PENDING 새 시작 전에 먼저 finish해야 하는 시작 마커:");
    expect(failed.stdout).toContain("마무리 템플릿: yarn manual-playlog --finish='novice-1-PENDING-SEED-20260620T020000000Z'");
    expect(failed.stdout).toContain("FAIL 새 수동 플레이 시작 전 정리 필요");
    expect(failed.stdout).toContain("판정: 정리 필요");
  });

  it("preflight-json은 미완료 시작 마커가 있으면 실패 코드와 blocking 이유를 출력한다", () => {
    const out = makeTempPath("preflight-json-pending.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=PENDING-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const failed = runManualPlaylogFailure([`--out=${out}`, "--preflight-json"]);
    const preflight = JSON.parse(failed.stdout);

    expect(failed.status).toBe(1);
    expect(preflight.canStart).toBe(false);
    expect(preflight.blockingReasons).toEqual(["pendingStartMarkers"]);
    expect(preflight.pendingCount).toBe(1);
    expect(preflight.pending[0].finishCommandTemplate).toContain("yarn manual-playlog --finish='novice-1-PENDING-SEED-20260620T020000000Z'");
  });

  it("빈 실제 로그에는 목표 세션 6개와 총 120분 보충 계획이 나온다", () => {
    const out = makeTempPath("empty.json");
    const plan = JSON.parse(runManualPlaylog([`--out=${out}`, "--plan-json"]));

    expect(plan.passed).toBe(false);
    expect(plan.current.totalMinutes).toBe(0);
    expect(plan.current.remainingMinutes).toBe(120);
    expect(plan.current.targetRowsPassed).toBe(0);
    expect(plan.current.targetRowsTotal).toBe(6);
    expect(plan.current.targetRowsRemaining).toBe(6);
    expect(plan.steps).toHaveLength(7);
    expect(plan.steps.slice(0, 6).map((step) => step.kind)).toEqual(Array(6).fill("target-session"));
    expect(plan.steps[6]).toMatchObject({
      kind: "total-minutes",
      minutes: 48,
      label: "총 120분 보충",
      startNextCommandTemplate: `yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
    });
    expect(plan.steps.slice(0, 6).map((step) => step.startNextCommandTemplate)).toEqual(Array(6).fill(`yarn manual-playlog --start-next --seed=GAME_SEED_HERE --out=${shellArg(out)}`));
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
      startCommandTemplate: `yarn manual-playlog --start --difficulty=novice --stage=1 --seed=GAME_SEED_HERE --notes='입문자 무전설 40R 클리어' --out=${shellArg(out)}`,
      startNextCommandTemplate: `yarn manual-playlog --start-next --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
      finishTemplate: {
        result: "clear",
        round: "40",
        legends: "0",
        maxGrade: "hero",
      },
    });
    const text = runManualPlaylog([`--out=${out}`, "--next"]);
    expect(text).toContain("추천 시작 마커:");
    expect(text).toContain("yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
    expect(text).toContain("직접 시작 마커:");
    expect(text).toContain("마무리 조건: result=clear round=40 legends=0 maxGrade=hero");
    expect(text).toContain("--seed=GAME_SEED_HERE");
  });

  it("summary도 다음 수동 세션의 추천 시작 마커를 출력한다", () => {
    const out = makeTempPath("summary-next-marker.json");
    const text = runManualPlaylog([`--out=${out}`, "--summary"]);
    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));

    expect(text).toContain("- 유효 플레이 시간: 0.0/120.0분, 남은 120.0분");
    expect(text).toContain("- 목표 세션: 0/6개 완료, 남은 6개");
    expect(summary.remainingMinutes).toBe(120);
    expect(summary.targetRowsPassed).toBe(0);
    expect(summary.targetRowsTotal).toBe(6);
    expect(summary.targetRowsRemaining).toBe(6);
    expect(text).toContain("추천 시작 마커:");
    expect(text).toContain("yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
    expect(text).toContain("GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    expect(summary.next).toMatchObject({
      kind: "target-session",
      difficulty: "novice",
      label: "입문자 무전설 40R 클리어",
      startNextCommandTemplate: `yarn manual-playlog --start-next --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
      finishTemplate: {
        result: "clear",
        round: "40",
        legends: "0",
        maxGrade: "hero",
      },
    });
  });

  it("summary는 증거로 인정되지 않는 수동 세션과 사유를 보여준다", () => {
    const out = makeTempPath("summary-invalid-sessions.json");
    writeFileSync(out, JSON.stringify({
      schemaVersion: 1,
      source: "manual-playlog",
      sessions: [
        {
          source: "human-playtest",
          difficulty: "novice",
          minutes: 12,
          startedAt: "2026-06-20T00:00:00.000Z",
          endedAt: "2026-06-20T00:01:00.000Z",
          result: "clear",
          stage: 1,
          round: 40,
          seed: "BAD-TIME",
          legends: 0,
          maxGrade: "hero",
          dataVersion: "0.8.0",
          stateChecksum: "bad00001",
        },
        {
          source: "human-playtest",
          difficulty: "novice",
          minutes: 12,
          startedAt: "2026-06-20T01:00:00.000Z",
          endedAt: "2026-06-20T01:12:00.000Z",
          result: "clear",
          stage: 1,
          round: 40,
          seed: "GOOD-SEED",
          legends: 0,
          maxGrade: "hero",
          dataVersion: "0.8.0",
          stateChecksum: "bad00002",
        },
        {
          source: "human-playtest",
          difficulty: "normal",
          minutes: 12,
          startedAt: "2026-06-20T02:00:00.000Z",
          endedAt: "2026-06-20T02:12:00.000Z",
          result: "clear",
          stage: 1,
          round: 40,
          seed: "DUP-SEED",
          legends: 1,
          maxGrade: "legend",
          dataVersion: "0.8.0",
          stateChecksum: "bad00002",
        },
      ],
    }, null, 2), "utf8");

    const text = runManualPlaylog([`--out=${out}`, "--summary"]);
    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));
    const plan = JSON.parse(runManualPlaylog([`--out=${out}`, "--plan-json"]));
    const failed = runManualPlaylogFailure([`--out=${out}`, "--assert"]);

    expect(summary.passed).toBe(false);
    expect(summary.validSessionCount).toBe(1);
    expect(summary.invalidSessionCount).toBe(2);
    expect(summary.rows[0]).toMatchObject({
      label: "수동 로그 무효 세션 없음",
      pass: false,
      evidence: "2개 무효 세션",
    });
    expect(plan.current.invalidSessionCount).toBe(2);
    expect(summary.invalidSessions[0]).toMatchObject({
      index: 0,
      difficulty: "novice",
      seed: "BAD-TIME",
      checksum: "bad00001",
      issues: ["startedAt/endedAt와 기록 시간이 맞지 않음"],
    });
    expect(summary.invalidSessions[1]).toMatchObject({
      index: 2,
      difficulty: "normal",
      seed: "DUP-SEED",
      checksum: "bad00002",
      issues: ["stateChecksum 중복"],
    });
    expect(text).toContain("INVALID 증거로 인정되지 않은 세션:");
    expect(text).toContain("#1 novice clear 40R seed=BAD-TIME #bad00001");
    expect(text).toContain("startedAt/endedAt와 기록 시간이 맞지 않음");
    expect(text).toContain("#3 normal clear 40R seed=DUP-SEED #bad00002");
    expect(text).toContain("stateChecksum 중복");
    expect(text).toContain("MISSING 수동 로그 무효 세션 없음: 2개 무효 세션");
    expect(failed.stdout).toContain("MISSING 수동 로그 무효 세션 없음: 2개 무효 세션");
    expect(failed.status).toBe(1);
  });

  it("start-next는 다음 필요 세션의 시작 마커를 바로 저장한다", () => {
    const out = makeTempPath("start-next.json");
    const output = runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=NEXT-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("- 목표: 입문자 무전설 40R 클리어");
    expect(output).toContain("- 플레이 조건: 전설 없이 40R 최종 보스 클리어");
    expect(output).toContain("- 기록 조건: result=clear round=40 legends=0 maxGrade=hero 이하");
    expect(output).toContain("yarn manual-playlog --finish='novice-1-NEXT-SEED-20260620T020000000Z' --result=clear --round=40 --legends=0 --maxGrade=hero");
    expect(output).toContain("--dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM");
    expect(output).toContain("--endedAt=RESULT_ENDED_AT");
    expect(output).toContain("RESULT_ENDED_AT은 결과 화면의 종료 시각을 사용하세요");
    expect(output).not.toContain("--dataVersion=0.8.0 --stateChecksum=1234abcd");
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({
      source: "human-playtest-start",
      difficulty: "novice",
      stage: 1,
      seed: "NEXT-SEED",
      notes: "입문자 무전설 40R 클리어",
      startedAt: "2026-06-20T02:00:00.000Z",
      finishCommandTemplate: `yarn manual-playlog --finish='novice-1-NEXT-SEED-20260620T020000000Z' --result=clear --round=40 --legends=0 --maxGrade=hero --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --endedAt=RESULT_ENDED_AT --out=${shellArg(out)}`,
    });
  });

  it("start-next는 비어 있는 out 파일도 새 로그처럼 처리한다", () => {
    const out = makeTempPath("start-next-empty-file.json");
    writeFileSync(out, "", "utf8");

    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=EMPTY-FILE-SEED",
      "--startedAt=2026-06-20T02:30:00.000Z",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({
      difficulty: "novice",
      seed: "EMPTY-FILE-SEED",
    });
  });

  it("start-next는 미완료 시작 마커가 있으면 새 마커를 만들지 않는다", () => {
    const out = makeTempPath("start-next-pending-block.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=FIRST-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start-next",
      "--seed=SECOND-SEED",
      "--startedAt=2026-06-20T02:10:00.000Z",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("이미 finish되지 않은 수동 시작 마커가 1개 있습니다.");
    expect(failed.stderr).toContain("새 start-next를 만들기 전에 기존 시작 마커를 먼저 마무리하세요.");
    expect(failed.stderr).toContain("마무리 템플릿: yarn manual-playlog --finish='novice-1-FIRST-SEED-20260620T020000000Z'");
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0].seed).toBe("FIRST-SEED");
  });

  it("start-next는 다음 필요 난이도와 다른 강제 난이도를 거부한다", () => {
    const out = makeTempPath("start-next-wrong-difficulty.json");
    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start-next",
      "--difficulty=normal",
      "--seed=NEXT-SEED",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("다음 필요 세션은 novice 난이도입니다");
  });

  it("start-next는 채워진 목표 다음 세션의 마무리 템플릿을 목표 조건에 맞춘다", () => {
    const out = makeTempPath("start-next-after-novice.json");
    appendSession(out, {
      difficulty: "novice",
      minutes: 12,
      result: "clear",
      round: 40,
      legends: 0,
      maxGrade: "hero",
      checksum: "abc00001",
      startedAt: "2026-06-20T00:00:00.000Z",
    });

    const output = runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=NORMAL-SEED",
      "--startedAt=2026-06-20T02:45:00.000Z",
    ]);
    const next = JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"]));

    expect(output).toContain("- 목표: 일반 1~2전설 40R 클리어");
    expect(output).toContain("- 기록 조건: result=clear round=40 legends=1~2 maxGrade=legend");
    expect(output).toContain("yarn manual-playlog --finish='normal-1-NORMAL-SEED-20260620T024500000Z' --result=clear --round=40 --legends=1 --maxGrade=legend");
    expect(next.next.finishTemplate).toEqual({
      result: "clear",
      round: "40",
      legends: "1",
      maxGrade: "legend",
    });
  });

  it("start-next는 초고수 실패 기록에 40R 고정 마감 템플릿을 쓰지 않는다", () => {
    const out = makeTempPath("start-next-master.json");
    const sessions = [
      ["novice", "clear", 40, 0, "hero", "abc10001"],
      ["normal", "clear", 40, 1, "legend", "abc10002"],
      ["intermediate", "clear", 40, 5, "legend", "abc10003"],
      ["expert", "loss", 40, 5, "legend", "abc10004"],
      ["expert", "clear", 40, 6, "legend", "abc10005"],
    ];
    let startMs = Date.parse("2026-06-20T00:00:00.000Z");
    for (const [difficulty, result, round, legends, maxGrade, checksum] of sessions) {
      appendSession(out, {
        difficulty,
        minutes: 12,
        result,
        round,
        legends,
        maxGrade,
        checksum,
        startedAt: new Date(startMs).toISOString(),
      });
      startMs += 13 * 60_000;
    }

    const output = runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=MASTER-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    expect(output).toContain("- 목표: 초고수 실패 기록");
    expect(output).toContain("- 기록 조건: result=loss legends=최종값");
    expect(output).toContain("yarn manual-playlog --finish='master-1-MASTER-SEED-20260620T020000000Z' --result=loss --round=ROUND_REACHED --legends=FINAL_LEGENDS --maxGrade=MAX_GRADE");
    expect(output).toContain("--endedAt=RESULT_ENDED_AT");
    expect(output).not.toContain("--result=loss --round=40 --legends=5");
  });

  it("목표 세션 이후 총 시간 보충 단계도 start-next 추천 명령을 출력한다", () => {
    const out = makeTempPath("start-next-flexible-minutes.json");
    const sessions = [
      ["novice", "clear", 40, 0, "hero", "abc20001"],
      ["normal", "clear", 40, 1, "legend", "abc20002"],
      ["intermediate", "clear", 40, 5, "legend", "abc20003"],
      ["expert", "loss", 40, 5, "legend", "abc20004"],
      ["expert", "clear", 40, 6, "legend", "abc20005"],
      ["master", "loss", 18, 3, "legend", "abc20006"],
    ];
    let startMs = Date.parse("2026-06-20T00:00:00.000Z");
    for (const [difficulty, result, round, legends, maxGrade, checksum] of sessions) {
      appendSession(out, {
        difficulty,
        minutes: 12,
        result,
        round,
        legends,
        maxGrade,
        checksum,
        startedAt: new Date(startMs).toISOString(),
      });
      startMs += 13 * 60_000;
    }

    const next = JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"]));
    const text = runManualPlaylog([`--out=${out}`, "--next"]);

    expect(next.next).toMatchObject({
      kind: "total-minutes",
      difficulty: "any",
      label: "총 120분 보충",
      minutes: 48,
      startNextCommandTemplate: `yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
    });
    expect(text).toContain("추천 시작 마커:");
    expect(text).toContain("yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE");
  });

  it("수동 증거 assert는 빈 로그에서 실패 코드와 다음 세션을 출력한다", () => {
    const out = makeTempPath("assert-empty.json");
    const failed = runManualPlaylogFailure([`--out=${out}`, "--assert"]);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("수동 증거 미충족");
    expect(failed.stderr).toContain("다음 필요 세션: 입문자 무전설 40R 클리어");
    expect(failed.stderr).toContain("추천 시작 마커: yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
  });

  it("시작 마커를 저장한 뒤 finish로 실제 세션을 완성할 수 있다", () => {
    const out = makeTempPath("pending-finish.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=normal-run-1",
      "--difficulty=normal",
      "--stage=1",
      "--seed=PENDING-SEED",
      "--startedAt=2026-06-20T00:00:00.000Z",
    ]);

    let pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    const summaryBeforeFinish = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));
    const planBeforeFinish = JSON.parse(runManualPlaylog([`--out=${out}`, "--plan-json"]));
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({
      id: "normal-run-1",
      difficulty: "normal",
      seed: "PENDING-SEED",
    });
    expect(pending.pending[0].finishCommandTemplate).toContain("yarn manual-playlog --finish='normal-run-1'");
    expect(pending.pending[0].finishCommandTemplate).toContain("--round=ROUND_REACHED");
    expect(runManualPlaylog([`--out=${out}`, "--pending"])).toContain("마무리 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(summaryBeforeFinish.pendingCount).toBe(1);
    expect(summaryBeforeFinish.pending[0].finishCommandTemplate).toContain("yarn manual-playlog --finish='normal-run-1'");
    expect(planBeforeFinish.current.pendingCount).toBe(1);
    const summaryText = runManualPlaylog([`--out=${out}`, "--summary"]);
    expect(summaryText).toContain("PENDING 아직 finish되지 않은 시작 마커");
    expect(summaryText).toContain("마무리 템플릿: yarn manual-playlog --finish='normal-run-1'");

    const finishOutput = runManualPlaylog([
      `--out=${out}`,
      "--finish=normal-run-1",
      "--result=clear",
      "--round=40",
      "--legends=1",
      "--maxGrade=legend",
      "--dataVersion=0.8.0",
      "--stateChecksum=20000010",
      "--endedAt=2026-06-20T00:15:00.000Z",
    ]);

    const log = readJson(out);
    pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    const summaryAfterFinish = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));
    expect(pending.pending).toHaveLength(0);
    expect(summaryAfterFinish.pendingCount).toBe(0);
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0]).toMatchObject({
      pendingSessionId: "normal-run-1",
      difficulty: "normal",
      stage: 1,
      seed: "PENDING-SEED",
      seconds: 900,
    });
    expect(finishOutput).toContain("다음 필요 세션: 입문자 무전설 40R 클리어");
    expect(finishOutput).toContain("- 추천 시작 마커: yarn manual-playlog --start-next --seed=GAME_SEED_HERE");
  });

  it("직접 저장 명령도 같은 시작 마커가 있으면 자동으로 연결해 닫는다", () => {
    const out = makeTempPath("pending-direct-save.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=DIRECT-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const output = runManualPlaylog([
      `--out=${out}`,
      "--difficulty=novice",
      "--seconds=900",
      "--result=clear",
      "--stage=1",
      "--round=40",
      "--seed=DIRECT-SEED",
      "--legends=0",
      "--maxGrade=hero",
      "--dataVersion=0.8.0",
      "--stateChecksum=20000012",
      "--startedAt=2026-06-20T02:00:00.000Z",
      "--endedAt=2026-06-20T02:15:00.000Z",
    ]);

    const log = readJson(out);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("- 연결된 시작 마커: novice-1-DIRECT-SEED-20260620T020000000Z");
    expect(output).toContain("- 시작 마커 목표: 입문자 무전설 40R 클리어 충족");
    expect(output).toContain("- 남은 유효 플레이 시간: 105.0분");
    expect(output).toContain("- 목표 세션: 1/6개 완료, 남은 5개");
    expect(pending.pending).toHaveLength(0);
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0]).toMatchObject({
      pendingSessionId: "novice-1-DIRECT-SEED-20260620T020000000Z",
      difficulty: "novice",
      seed: "DIRECT-SEED",
      seconds: 900,
    });
  });

  it("시작 마커 목표를 못 채운 결과도 저장하되 미충족을 즉시 출력한다", () => {
    const out = makeTempPath("pending-direct-save-miss.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=MISS-SEED",
      "--startedAt=2026-06-20T03:00:00.000Z",
    ]);

    const output = runManualPlaylog([
      `--out=${out}`,
      "--difficulty=novice",
      "--seconds=900",
      "--result=loss",
      "--stage=1",
      "--round=20",
      "--seed=MISS-SEED",
      "--legends=0",
      "--maxGrade=hero",
      "--dataVersion=0.8.0",
      "--stateChecksum=20000013",
      "--startedAt=2026-06-20T03:00:00.000Z",
      "--endedAt=2026-06-20T03:15:00.000Z",
    ]);

    const log = readJson(out);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    const next = JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"]));
    expect(output).toContain("- 연결된 시작 마커: novice-1-MISS-SEED-20260620T030000000Z");
    expect(output).toContain("- 시작 마커 목표: 입문자 무전설 40R 클리어 미충족");
    expect(output).toContain("이 세션은 실제 플레이 시간으로 저장됐지만 목표 증거 행은 아직 남아 있습니다.");
    expect(output).toContain("- 남은 유효 플레이 시간: 105.0분");
    expect(output).toContain("- 목표 세션: 0/6개 완료, 남은 6개");
    expect(pending.pending).toHaveLength(0);
    expect(log.sessions[0]).toMatchObject({
      pendingSessionId: "novice-1-MISS-SEED-20260620T030000000Z",
      result: "loss",
      round: 20,
    });
    expect(next.next).toMatchObject({
      difficulty: "novice",
      label: "입문자 무전설 40R 클리어",
    });
  });

  it("finish-latest는 가장 최근 시작 마커만 마무리한다", () => {
    const out = makeTempPath("finish-latest.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=old-run",
      "--difficulty=novice",
      "--stage=1",
      "--seed=OLD-SEED",
      "--startedAt=2026-06-20T00:00:00.000Z",
    ]);
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=new-run",
      "--difficulty=intermediate",
      "--stage=1",
      "--seed=NEW-SEED",
      "--startedAt=2026-06-20T01:00:00.000Z",
    ]);

    runManualPlaylog([
      `--out=${out}`,
      "--finish-latest",
      "--result=clear",
      "--round=40",
      "--legends=5",
      "--maxGrade=legend",
      "--dataVersion=0.8.0",
      "--stateChecksum=20000011",
      "--endedAt=2026-06-20T01:13:00.000Z",
    ]);

    const log = readJson(out);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0]).toMatchObject({
      pendingSessionId: "new-run",
      difficulty: "intermediate",
      seed: "NEW-SEED",
      seconds: 780,
    });
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({ id: "old-run" });
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
    const finalOutput = runManualPlaylog([
      `--out=${out}`,
      "--difficulty=normal",
      "--minutes=1",
      "--result=quit",
      "--stage=1",
      "--round=1",
      "--seed=AFTER-COMPLETE",
      "--legends=0",
      "--maxGrade=hero",
      "--dataVersion=0.8.0",
      "--stateChecksum=20000008",
      "--startedAt=2026-06-20T03:00:00.000Z",
      "--endedAt=2026-06-20T03:01:00.000Z",
    ]);
    expect(finalOutput).toContain("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
  });
});
