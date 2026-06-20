import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let tempDir = "";
const CURRENT_DATA_VERSION = readCurrentDataVersion();

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

function readCurrentDataVersion() {
  const source = readFileSync("src/data/version.ts", "utf8");
  return source.match(/export const DATA_VERSION = "([^"]+)"/)?.[1] ?? "";
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
    `--dataVersion=${CURRENT_DATA_VERSION}`,
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
    expect(output).toContain("--start-next --difficulty=normal --seed=RUN123");
    expect(output).toContain("--preflight-json         # --preflight 결과를 JSON으로 출력");
    expect(output).toContain("--summary-json        # --summary --json과 동일");
    expect(output).toContain("--plan-json           # --plan --json과 동일");
    expect(output).toContain("--sheet               # 남은 수동 플레이 계획과 결과 필드를 Markdown 시트로 출력");
    expect(output).toContain("--sheet-md            # --sheet와 동일");
    expect(output).toContain("--next-json           # --next --json과 동일");
    expect(output).toContain("--pending-json        # --pending --json과 동일");
    expect(output).toContain("--pending-id=RUN1");
    expect(output).toContain("--pending-id-json");
    expect(output).toContain("--source=human-playtest|codex-direct-playtest");
  });

  it("README는 고수 약한 증거를 40R 고정 실패로 안내하지 않는다", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("고수 5전설 이하 실패 + 고수 6전설 이상 40R 클리어");
    expect(readme).toContain("고수 5전설 이하 실패는 현재 조정된 밸런스처럼 40R 이전에 무너진 기록도 목표 증거로 인정한다.");
    expect(readme).not.toContain("고수 40R 5전설 이하 실패");
  });

  it("인게임 수동 증거 모달은 start-next 저장 전에 dry-run PASS를 요구한다", () => {
    const modalSource = readFileSync("src/ui/modals.ts", "utf8");

    expect(modalSource).toContain("현재 판의 실제 시드로 다음 필요 수동 세션 dry-run 검증을 먼저 실행하세요.");
    expect(modalSource).toContain("검증이 PASS일 때만 시작 마커를 저장합니다.");
    expect(modalSource).not.toContain("다음 필요 수동 세션 시작 검증과 시작 마커를 바로 실행할 수 있습니다.");
  });

  it("preflight는 정리할 마커가 없으면 다음 시작 마커를 보여주고 성공한다", () => {
    const out = makeTempPath("preflight-empty.json");
    const output = runManualPlaylog([`--out=${out}`, "--preflight"]);

    expect(output).toContain("PASS 새 수동 플레이 시작 가능");
    expect(output).toContain("- 남은 수집 계획: 7단계");
    expect(output).toContain("추천 시작 검증:");
    expect(output).toContain(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`);
    expect(output).toContain("추천 시작 마커:");
    expect(output).toContain(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(output).toContain("실행 순서:");
    expect(output).toContain("1. 게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인");
    expect(output).toContain("3. 검증이 통과하면 같은 명령에서 --dry-run을 빼고 시작 마커 저장");
    expect(output).toContain("5. 결과 화면의 dataVersion/stateChecksum/endedAt 값으로 finish --dry-run 실행 후 실제 finish 저장");
    expect(output).toContain("전체 수집 계획:");
    expect(output).toContain(`yarn manual-playlog --plan --out=${shellArg(out)}`);
    expect(output).toContain("결과 기록 필드:");
    expect(output).toContain("- dataVersion: 결과 화면 RESULT_DATA_VERSION");
    expect(output).toContain("- stateChecksum: 결과 화면 RESULT_CHECKSUM");
    expect(output).toContain("- minutes: 시작/종료 시각으로 계산된 실제 플레이 시간 (기대값: 12분 이상)");
    expect(output).toContain("남은 계획 첫 항목:");
    expect(output).toContain("- 입문자 무전설 40R 클리어 (12.0분 이상)");
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
    expect(preflight.nextStartCommandTemplate).toBe(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(preflight.nextStartDryRunCommandTemplate).toBe(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`);
    expect(preflight.planCommandTemplate).toBe(`yarn manual-playlog --plan --out=${shellArg(out)}`);
    expect(preflight.remainingPlanStepCount).toBe(7);
    expect(preflight.remainingPlanPreview.map((step) => step.label)).toEqual([
      "입문자 무전설 40R 클리어",
      "일반 1~2전설 40R 클리어",
      "중급자 5전설 이상 40R 클리어",
    ]);
    expect(preflight.resultFieldChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "dataVersion", source: "결과 화면 RESULT_DATA_VERSION", expected: "0.8.4" }),
      expect.objectContaining({ field: "stateChecksum", source: "결과 화면 RESULT_CHECKSUM", expected: "8자리 checksum" }),
      expect.objectContaining({ field: "result", expected: "clear" }),
      expect.objectContaining({ field: "round", expected: "40" }),
      expect.objectContaining({ field: "legends", expected: "0" }),
      expect.objectContaining({ field: "maxGrade", expected: "hero" }),
      expect.objectContaining({ field: "minutes", expected: "12분 이상" }),
    ]));
    expect(preflight.startWorkflow).toEqual([
      "게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인",
      "추천 시작 검증 명령의 GAME_SEED_HERE를 실제 시드로 바꿔 --dry-run 실행",
      "검증이 통과하면 같은 명령에서 --dry-run을 빼고 시작 마커 저장",
      "12분 이상 실제로 플레이하고 목표 결과 조건 확인",
      "결과 화면의 dataVersion/stateChecksum/endedAt 값으로 finish --dry-run 실행 후 실제 finish 저장",
    ]);
  });

  it("codex 직접 플레이 출처는 start-next 마커와 finish 결과에 보존된다", () => {
    const out = makeTempPath("codex-direct-source.json");
    const startedAt = "2026-06-20T02:00:00.000Z";
    const endedAt = "2026-06-20T02:12:30.000Z";

    const startOutput = runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--difficulty=novice",
      "--seed=CODEX-DIRECT-SEED",
      `--startedAt=${startedAt}`,
      "--source=codex-direct-playtest",
    ]);
    expect(startOutput).toContain("- 출처: codex-direct-playtest");

    expect(readJson(out).pendingSessions[0]).toMatchObject({
      source: "codex-direct-playtest-start",
      difficulty: "novice",
      seed: "CODEX-DIRECT-SEED",
    });

    runManualPlaylog([
      `--out=${out}`,
      "--finish-latest",
      "--result=clear",
      "--round=40",
      "--legends=0",
      "--maxGrade=hero",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=2000abcd",
      `--endedAt=${endedAt}`,
    ]);

    const log = readJson(out);
    expect(log.pendingSessions).toEqual([]);
    expect(log.sessions[0]).toMatchObject({
      source: "codex-direct-playtest",
      difficulty: "novice",
      seconds: 750,
      result: "clear",
      round: 40,
      legends: 0,
      stateChecksum: "2000abcd",
    });

    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));
    expect(summary.validSessionCount).toBe(1);
    expect(summary.validHumanSessionCount).toBe(0);
    expect(summary.codexDirectSessionCount).toBe(1);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.rows.find((row) => row.label === "사람이 직접 2시간 플레이")).toMatchObject({
      pass: false,
    });
    expect(summary.rows.find((row) => row.label === "입문자 무전설 40R 클리어")).toMatchObject({
      pass: false,
      evidence: "증거 없음",
    });

    const preflightText = runManualPlaylog([`--out=${out}`, "--preflight"]);
    expect(preflightText).toContain("유효 사람 플레이 시간: 0.0/120.0분");
    expect(preflightText).toContain("Codex 직접 조작 보조 시간: 1세션, 12.5분 (사람 120분 증거에는 미포함)");
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
    expect(failed.stdout).toContain("경과: 12분 목표 충족");
    expect(failed.stdout).toContain("마무리 템플릿: yarn manual-playlog --finish='novice-1-PENDING-SEED-20260620T020000000Z'");
    expect(failed.stdout).toContain("FAIL 새 수동 플레이 시작 전 정리 필요");
    expect(failed.stdout).toContain("판정: 정리 필요");
  });

  it("pending-id는 특정 시작 마커 저장 여부를 성공/실패 코드로 확인한다", () => {
    const out = makeTempPath("pending-id.json");
    const id = "novice-1-PENDING-SEED-20260620T020000000Z";
    runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=PENDING-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    const found = runManualPlaylog([`--out=${out}`, `--pending-id=${id}`]);
    expect(found).toContain("# 수동 플레이 시작 마커 확인");
    expect(found).toContain(`- 확인 id: ${id}`);
    expect(found).toContain("- 대기 중: 1개");
    expect(found).toContain(`- ${id}: novice stage=1 seed=PENDING-SEED`);
    expect(found).toContain("마무리 템플릿:");

    const foundJson = JSON.parse(runManualPlaylog([`--out=${out}`, `--pending-id=${id}`, "--json"]));
    expect(foundJson.pendingId).toBe(id);
    expect(foundJson.pendingCount).toBe(1);
    expect(foundJson.pending[0].id).toBe(id);

    const missing = runManualPlaylogFailure([`--out=${out}`, "--pending-id=missing-id"]);
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain("- 확인 id: missing-id");
    expect(missing.stdout).toContain("해당 id의 시작 마커가 없습니다");
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
    expect(preflight.pending[0]).toMatchObject({
      targetMinutes: 12,
      remainingTargetMinutes: 0,
      targetReady: true,
    });
    expect(preflight.pending[0].elapsedMinutes).toBeGreaterThanOrEqual(12);
    expect(preflight.next).toBeNull();
    expect(preflight.nextStartCommandTemplate).toBe("");
    expect(preflight.nextStartDryRunCommandTemplate).toBe("");
  });

  it("pending은 시작 마커의 12분 목표까지 남은 시간을 보여준다", () => {
    const out = makeTempPath("pending-timer.json");
    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=timer-run",
      "--difficulty=normal",
      "--stage=1",
      "--seed=TIMER-SEED",
      `--startedAt=${startedAt}`,
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    const text = runManualPlaylog([`--out=${out}`, "--pending"]);

    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({
      id: "timer-run",
      targetMinutes: 12,
      targetReady: false,
    });
    expect(pending.pending[0].elapsedMinutes).toBeGreaterThanOrEqual(4.9);
    expect(pending.pending[0].elapsedMinutes).toBeLessThan(6);
    expect(pending.pending[0].remainingTargetMinutes).toBeGreaterThan(6);
    expect(pending.pending[0].remainingTargetMinutes).toBeLessThanOrEqual(7.1);
    expect(text).toContain("timer-run");
    expect(text).toContain("경과: 12분까지");
    expect(text).toContain("분 남음");
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
      startNextDryRunCommandTemplate: `yarn manual-playlog --start-next --difficulty=DIFFICULTY --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`,
    });
    expect(plan.steps.slice(0, 6).map((step) => step.startNextCommandTemplate)).toEqual([
      "novice", "normal", "intermediate", "expert", "expert", "master",
    ].map((difficulty) => `yarn manual-playlog --start-next --difficulty=${difficulty} --seed=GAME_SEED_HERE --out=${shellArg(out)}`));
    expect(plan.steps.slice(0, 6).map((step) => step.startNextDryRunCommandTemplate)).toEqual([
      "novice", "normal", "intermediate", "expert", "expert", "master",
    ].map((difficulty) => `yarn manual-playlog --start-next --difficulty=${difficulty} --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`));
  });

  it("sheet는 남은 수동 플레이 계획과 결과 기록 필드를 Markdown으로 출력한다", () => {
    const out = makeTempPath("sheet-empty.json");
    const sheet = runManualPlaylog([`--out=${out}`, "--sheet"]);

    expect(sheet).toContain("# 수동 밸런스 플레이 시트");
    expect(sheet).toContain("| 유효 사람 플레이 시간 | 0.0/120.0분 |");
    expect(sheet).toContain("| 목표 세션 | 0/6개 완료 |");
    expect(sheet).toContain("## 다음 세션");
    expect(sheet).toContain("- 목표: 입문자 무전설 40R 클리어");
    expect(sheet).toContain("```bash");
    expect(sheet).toContain(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`);
    expect(sheet).toContain(`yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(sheet).toContain("| 7 | total-minutes | any | 총 120분 보충 | 48.0분 | result=loss, round=ROUND_REACHED, legends=FINAL_LEGENDS, maxGrade=MAX_GRADE |");
    expect(sheet).toContain("| dataVersion | 결과 화면 RESULT_DATA_VERSION | 0.8.4 |");
    expect(sheet).toContain("| stateChecksum | 결과 화면 RESULT_CHECKSUM | 8자리 checksum |");
    expect(sheet).toContain("1. 게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인");
    expect(sheet).toContain("판정: 수동 증거 미충족");
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
      startCommandDryRunTemplate: `yarn manual-playlog --start --difficulty=novice --stage=1 --seed=GAME_SEED_HERE --notes='입문자 무전설 40R 클리어' --out=${shellArg(out)} --dry-run`,
      startNextCommandTemplate: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
      startNextDryRunCommandTemplate: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`,
      finishTemplate: {
        result: "clear",
        round: "40",
        legends: "0",
        maxGrade: "hero",
      },
    });
    expect(next.resultFieldChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "seed", expected: "실제 게임 시드" }),
      expect.objectContaining({ field: "startedAt", expected: "실제 시작 시각" }),
      expect.objectContaining({ field: "endedAt", source: "결과 화면 RESULT_ENDED_AT" }),
      expect.objectContaining({ field: "dataVersion", expected: "0.8.4" }),
      expect.objectContaining({ field: "stateChecksum", expected: "8자리 checksum" }),
      expect.objectContaining({ field: "result", expected: "clear" }),
      expect.objectContaining({ field: "round", expected: "40" }),
      expect.objectContaining({ field: "legends", expected: "0" }),
      expect.objectContaining({ field: "maxGrade", expected: "hero" }),
      expect.objectContaining({ field: "minutes", expected: "12분 이상" }),
    ]));
    expect(next.startWorkflow).toEqual([
      "게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인",
      "추천 시작 검증 명령의 GAME_SEED_HERE를 실제 시드로 바꿔 --dry-run 실행",
      "검증이 통과하면 같은 명령에서 --dry-run을 빼고 시작 마커 저장",
      "12분 이상 실제로 플레이하고 목표 결과 조건 확인",
      "결과 화면의 dataVersion/stateChecksum/endedAt 값으로 finish --dry-run 실행 후 실제 finish 저장",
    ]);
    const text = runManualPlaylog([`--out=${out}`, "--next"]);
    expect(text).toContain("추천 시작 검증:");
    expect(text).toContain("yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(text).toContain("--dry-run");
    expect(text).toContain("추천 시작 마커:");
    expect(text).toContain("yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(text).toContain("직접 시작 검증:");
    expect(text).toContain("직접 시작 마커:");
    expect(text).toContain("마무리 조건: result=clear round=40 legends=0 maxGrade=hero");
    expect(text).toContain("실행 순서:");
    expect(text).toContain("1. 게임에서 다음 목표 난이도로 새 게임을 시작하고 상단의 실제 시드를 확인");
    expect(text).toContain("결과 기록 필드:");
    expect(text).toContain("- stateChecksum: 결과 화면 RESULT_CHECKSUM (기대값: 8자리 checksum)");
    expect(text).toContain("- minutes: 시작/종료 시각으로 계산된 실제 플레이 시간 (기대값: 12분 이상)");
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
    expect(summary.commandTemplates).toMatchObject({
      preflight: `yarn manual-playlog --preflight --out=${shellArg(out)}`,
      preflightJson: `yarn --silent manual-playlog --preflight-json --out=${shellArg(out)}`,
      plan: `yarn manual-playlog --plan --out=${shellArg(out)}`,
      planJson: `yarn --silent manual-playlog --plan-json --out=${shellArg(out)}`,
      sheet: `yarn manual-playlog --sheet --out=${shellArg(out)}`,
      summary: `yarn manual-playlog --summary --out=${shellArg(out)}`,
      summaryJson: `yarn --silent manual-playlog --summary-json --out=${shellArg(out)}`,
      next: `yarn manual-playlog --next --out=${shellArg(out)}`,
      nextJson: `yarn --silent manual-playlog --next-json --out=${shellArg(out)}`,
      startNext: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
      startNextDryRun: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`,
    });
    expect(summary.resultFieldChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "seed", expected: "실제 게임 시드" }),
      expect.objectContaining({ field: "startedAt", expected: "실제 시작 시각" }),
      expect.objectContaining({ field: "endedAt", source: "결과 화면 RESULT_ENDED_AT" }),
      expect.objectContaining({ field: "dataVersion", expected: "0.8.4" }),
      expect.objectContaining({ field: "stateChecksum", expected: "8자리 checksum" }),
      expect.objectContaining({ field: "result", expected: "clear" }),
      expect.objectContaining({ field: "round", expected: "40" }),
      expect.objectContaining({ field: "legends", expected: "0" }),
      expect.objectContaining({ field: "maxGrade", expected: "hero" }),
      expect.objectContaining({ field: "minutes", expected: "12분 이상" }),
    ]));
    expect(text).toContain("추천 시작 검증:");
    expect(text).toContain("yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(text).toContain("--dry-run");
    expect(text).toContain("추천 시작 마커:");
    expect(text).toContain("yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(text).toContain("GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    expect(summary.next).toMatchObject({
      kind: "target-session",
      difficulty: "novice",
      label: "입문자 무전설 40R 클리어",
      startNextCommandTemplate: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`,
      startNextDryRunCommandTemplate: `yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`,
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
          dataVersion: CURRENT_DATA_VERSION,
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
          dataVersion: CURRENT_DATA_VERSION,
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
          dataVersion: CURRENT_DATA_VERSION,
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

  it("summary는 현재 데이터 버전이 아닌 수동 세션을 무효 처리한다", () => {
    const out = makeTempPath("summary-stale-data-version.json");
    writeFileSync(out, JSON.stringify({
      schemaVersion: 1,
      source: "manual-playlog",
      sessions: [
        {
          source: "human-playtest",
          difficulty: "novice",
          minutes: 12,
          startedAt: "2026-06-20T00:00:00.000Z",
          endedAt: "2026-06-20T00:12:00.000Z",
          result: "clear",
          stage: 1,
          round: 40,
          seed: "STALE-VERSION",
          legends: 0,
          maxGrade: "hero",
          dataVersion: "0.0.0",
          stateChecksum: "bad00003",
        },
      ],
    }, null, 2), "utf8");

    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));
    const preflight = JSON.parse(runManualPlaylogFailure([`--out=${out}`, "--preflight-json"]).stdout);

    expect(summary.currentDataVersion).toBe(CURRENT_DATA_VERSION);
    expect(summary.validSessionCount).toBe(0);
    expect(summary.invalidSessionCount).toBe(1);
    expect(summary.invalidSessions[0]).toMatchObject({
      seed: "STALE-VERSION",
      dataVersion: "0.0.0",
      issues: [`dataVersion 0.0.0이 현재 ${CURRENT_DATA_VERSION}와 다름`],
    });
    expect(preflight.canStart).toBe(false);
    expect(preflight.blockingReasons).toEqual(["invalidSessions"]);
  });

  it("start와 start-next는 무효 수동 세션이 있으면 새 시작 마커를 만들지 않는다", () => {
    const out = makeTempPath("start-blocked-by-invalid-session.json");
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
          seed: "BAD-START-BLOCK",
          legends: 0,
          maxGrade: "hero",
          dataVersion: CURRENT_DATA_VERSION,
          stateChecksum: "bad00005",
        },
      ],
    }, null, 2), "utf8");

    const startNextFailed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start-next",
      "--seed=NEXT-SEED",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);
    const startFailed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start",
      "--id=manual-start",
      "--difficulty=novice",
      "--stage=1",
      "--seed=MANUAL-SEED",
      "--startedAt=2026-06-20T03:00:00.000Z",
    ]);

    const log = readJson(out);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(startNextFailed.status).toBe(1);
    expect(startNextFailed.stderr).toContain("수동 로그에 무효 세션이 1개 있습니다.");
    expect(startNextFailed.stderr).toContain("새 수동 시작 마커를 만들기 전에 기존 INVALID 세션을 고치거나 제거하세요.");
    expect(startNextFailed.stderr).toContain("#1 novice clear 40R seed=BAD-START-BLOCK #bad00005");
    expect(startNextFailed.stderr).toContain("startedAt/endedAt와 기록 시간이 맞지 않음");
    expect(startNextFailed.stderr).toContain(`확인 명령: yarn manual-playlog --summary --out=${shellArg(out)}`);
    expect(startFailed.status).toBe(1);
    expect(startFailed.stderr).toContain("수동 로그에 무효 세션이 1개 있습니다.");
    expect(log.sessions).toHaveLength(1);
    expect(log.pendingSessions ?? []).toEqual([]);
    expect(pending.pending).toHaveLength(0);
  });

  it("start와 start-next는 GAME_SEED_HERE placeholder seed를 저장하지 않는다", () => {
    const startOut = makeTempPath("start-placeholder-seed.json");
    const startNextOut = makeTempPath("start-next-placeholder-seed.json");
    const startFailed = runManualPlaylogFailure([
      `--out=${startOut}`,
      "--start",
      "--id=placeholder-start",
      "--difficulty=novice",
      "--stage=1",
      "--seed=GAME_SEED_HERE",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);
    const startNextFailed = runManualPlaylogFailure([
      `--out=${startNextOut}`,
      "--start-next",
      "--seed=GAME_SEED_HERE",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);

    expect(startFailed.status).toBe(1);
    expect(startFailed.stderr).toContain("--seed=GAME_SEED_HERE는 템플릿 placeholder입니다.");
    expect(startNextFailed.status).toBe(1);
    expect(startNextFailed.stderr).toContain("게임 화면의 실제 시드로 바꿔 실행하세요.");
    expect(JSON.parse(runManualPlaylog([`--out=${startOut}`, "--pending-json"])).pending).toHaveLength(0);
    expect(JSON.parse(runManualPlaylog([`--out=${startNextOut}`, "--pending-json"])).pending).toHaveLength(0);
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
    expect(output).toContain("결과가 나오면 먼저 아래 형식으로 저장 전 검증을 실행하세요");
    expect(output).toContain("yarn manual-playlog --finish='novice-1-NEXT-SEED-20260620T020000000Z' --result=clear --round=40 --legends=0 --maxGrade=hero --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --endedAt=RESULT_ENDED_AT");
    expect(output).toContain("--dry-run");
    expect(output).toContain("검증이 통과하면 아래 형식으로 실제 저장하세요");
    expect(output).toContain("yarn manual-playlog --finish='novice-1-NEXT-SEED-20260620T020000000Z' --result=clear --round=40 --legends=0 --maxGrade=hero");
    expect(output).toContain("--dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM");
    expect(output).toContain("--endedAt=RESULT_ENDED_AT");
    expect(output).toContain("RESULT_ENDED_AT은 결과 화면의 종료 시각을 사용하세요");
    expect(output).not.toContain("dry-run 검증용 임시 id 예시");
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
      finishDryRunCommandTemplate: `yarn manual-playlog --finish='novice-1-NEXT-SEED-20260620T020000000Z' --result=clear --round=40 --legends=0 --maxGrade=hero --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --endedAt=RESULT_ENDED_AT --out=${shellArg(out)} --dry-run`,
    });
  });

  it("start-next --dry-run은 다음 필요 세션을 검증하지만 pending 시작 마커를 저장하지 않는다", () => {
    const out = makeTempPath("start-next-dry-run.json");
    const output = runManualPlaylog([
      `--out=${out}`,
      "--start-next",
      "--seed=DRY-SEED",
      "--startedAt=2026-06-20T02:15:00.000Z",
      "--dry-run",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("DRY-RUN 수동 플레이 시작 마커 검증 통과");
    expect(output).toContain("- 목표: 입문자 무전설 40R 클리어");
    expect(output).toContain("- 로그 쓰기: 안 함");
    expect(output).toContain("아래 finish 명령은 dry-run 검증용 임시 id 예시입니다.");
    expect(output).toContain("그 출력 또는 yarn manual-playlog --pending의 id를 사용하세요.");
    expect(output).toContain("yarn manual-playlog --finish='novice-1-DRY-SEED-20260620T021500000Z' --result=clear --round=40 --legends=0 --maxGrade=hero");
    expect(output).toContain("시작 마커를 실제로 저장하려면 같은 명령에서 --dry-run을 빼고 실행하세요.");
    expect(pending.pending).toHaveLength(0);
  });

  it("start --dry-run은 직접 시작 마커를 검증하지만 pending 시작 마커를 저장하지 않는다", () => {
    const out = makeTempPath("start-dry-run.json");
    const output = runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=direct-dry-start",
      "--difficulty=normal",
      "--stage=2",
      "--seed=DIRECT-DRY-SEED",
      "--startedAt=2026-06-20T02:20:00.000Z",
      "--dry-run",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("DRY-RUN 수동 플레이 시작 마커 검증 통과");
    expect(output).toContain("- id: direct-dry-start");
    expect(output).toContain("- 로그 쓰기: 안 함");
    expect(output).toContain("yarn manual-playlog --finish='direct-dry-start'");
    expect(pending.pending).toHaveLength(0);
  });

  it("start는 목표 notes 라벨을 해석해 목표 마무리 템플릿을 출력한다", () => {
    const out = makeTempPath("start-target-notes.json");
    const output = runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=direct-target-start",
      "--difficulty=intermediate",
      "--stage=1",
      "--seed=TARGET-NOTES-SEED",
      "--startedAt=2026-06-20T02:25:00.000Z",
      "--notes=중급자 5전설 이상 40R 클리어",
    ]);

    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("- 목표: 중급자 5전설 이상 40R 클리어");
    expect(output).toContain("- 플레이 조건: 전설 5개 이상으로 40R 최종 보스 클리어");
    expect(output).toContain("- 기록 조건: result=clear round=40 legends>=5 maxGrade=legend|hidden");
    expect(output).toContain("yarn manual-playlog --finish='direct-target-start' --result=clear --round=40 --legends=5 --maxGrade=legend");
    expect(pending.pending[0]).toMatchObject({
      id: "direct-target-start",
      difficulty: "intermediate",
      notes: "중급자 5전설 이상 40R 클리어",
    });
    expect(pending.pending[0].finishCommandTemplate).toContain("--result=clear --round=40 --legends=5 --maxGrade=legend");
  });

  it("start는 목표 notes 라벨과 난이도가 다르면 거부한다", () => {
    const out = makeTempPath("start-target-notes-wrong-difficulty.json");
    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start",
      "--id=wrong-target-start",
      "--difficulty=normal",
      "--stage=1",
      "--seed=WRONG-TARGET-SEED",
      "--startedAt=2026-06-20T02:25:00.000Z",
      "--notes=중급자 5전설 이상 40R 클리어",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("--notes 목표는 intermediate 난이도입니다");
    expect(failed.stderr).toContain("--difficulty=normal와 함께 시작할 수 없습니다");
    expect(JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"])).pending).toHaveLength(0);
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
    expect(failed.stderr).toContain("다음 필요 세션: 입문자 무전설 40R 클리어");
    expect(failed.stderr).toContain(`추천 시작 검증: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`);
    expect(failed.stderr).toContain(`추천 시작 마커: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(failed.stderr).toContain("올바른 난이도로 새 게임을 시작한 뒤 GAME_SEED_HERE를 그 판의 실제 시드로 바꿔 실행하세요.");
  });

  it("start-next는 일부 목표를 채운 뒤에도 다음 필요 난이도와 다른 강제 난이도를 거부한다", () => {
    const out = makeTempPath("start-next-wrong-difficulty-after-progress.json");
    const sessions = [
      ["novice", "clear", 40, 0, "hero", "abc40001"],
      ["normal", "clear", 40, 1, "legend", "abc40002"],
      ["intermediate", "clear", 40, 5, "legend", "abc40003"],
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

    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--start-next",
      "--difficulty=master",
      "--seed=WRONG-MID-SEED",
      "--startedAt=2026-06-20T02:30:00.000Z",
    ]);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("다음 필요 세션은 expert 난이도입니다");
    expect(failed.stderr).toContain("--difficulty=master로 시작할 수 없습니다");
    expect(failed.stderr).toContain("다음 필요 세션: 고수 5전설 이하 실패");
    expect(failed.stderr).toContain(`추천 시작 검증: yarn manual-playlog --start-next --difficulty=expert --seed=GAME_SEED_HERE --out=${shellArg(out)} --dry-run`);
    expect(failed.stderr).toContain(`추천 시작 마커: yarn manual-playlog --start-next --difficulty=expert --seed=GAME_SEED_HERE --out=${shellArg(out)}`);
    expect(failed.stderr).toContain("올바른 난이도로 새 게임을 시작한 뒤 GAME_SEED_HERE를 그 판의 실제 시드로 바꿔 실행하세요.");
    expect(pending.pending).toHaveLength(0);
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
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));

    expect(output).toContain("- 목표: 일반 1~2전설 40R 클리어");
    expect(output).toContain("- 기록 조건: result=clear round=40 legends=1~2 maxGrade=legend");
    expect(output).toContain("yarn manual-playlog --finish='normal-1-NORMAL-SEED-20260620T024500000Z' --result=clear --round=40 --legends=1 --maxGrade=legend");
    expect(next.blockedByPendingStartMarkers).toBe(true);
    expect(next.next).toBeNull();
    expect(pending.pending[0].finishCommandTemplate).toContain("--result=clear --round=40 --legends=1 --maxGrade=legend");
    expect(pending.pending[0].finishDryRunCommandTemplate).toContain("--result=clear --round=40 --legends=1 --maxGrade=legend");
    expect(pending.pending[0].finishDryRunCommandTemplate).toContain("--dry-run");
  });

  it("start-next는 고수 5전설 이하 실패에 실제 도달 라운드 마감 템플릿을 쓴다", () => {
    const out = makeTempPath("start-next-expert-weak.json");
    const sessions = [
      ["novice", "clear", 40, 0, "hero", "abc30001"],
      ["normal", "clear", 40, 1, "legend", "abc30002"],
      ["intermediate", "clear", 40, 5, "legend", "abc30003"],
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
      "--seed=EXPERT-WEAK-SEED",
      "--startedAt=2026-06-20T02:15:00.000Z",
    ]);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));

    expect(output).toContain("- 목표: 고수 5전설 이하 실패");
    expect(output).toContain("- 기록 조건: result=loss round=RESULT_ROUND legends<=5");
    expect(output).toContain("yarn manual-playlog --finish='expert-1-EXPERT-WEAK-SEED-20260620T021500000Z' --result=loss --round=ROUND_REACHED --legends=FINAL_LEGENDS --maxGrade=MAX_GRADE");
    expect(output).not.toContain("--result=loss --round=40 --legends=5");
    expect(pending.pending[0]).toMatchObject({
      difficulty: "expert",
      notes: "고수 5전설 이하 실패",
    });
    expect(pending.pending[0].finishCommandTemplate).toContain("--result=loss --round=ROUND_REACHED --legends=FINAL_LEGENDS --maxGrade=MAX_GRADE");
  });

  it("start-next는 초고수 실패 기록에 40R 고정 마감 템플릿을 쓰지 않는다", () => {
    const out = makeTempPath("start-next-master.json");
    const sessions = [
      ["novice", "clear", 40, 0, "hero", "abc10001"],
      ["normal", "clear", 40, 1, "legend", "abc10002"],
      ["intermediate", "clear", 40, 5, "legend", "abc10003"],
      ["expert", "loss", 33, 5, "legend", "abc10004"],
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
      ["expert", "loss", 33, 5, "legend", "abc20004"],
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
    expect(failed.stderr).toContain(`시작 전 점검: yarn manual-playlog --preflight --out=${shellArg(out)}`);
    expect(failed.stderr).toContain(`전체 수집 계획: yarn manual-playlog --plan --out=${shellArg(out)}`);
    expect(failed.stderr).toContain("추천 시작 검증: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
    expect(failed.stderr).toContain("--dry-run");
    expect(failed.stderr).toContain("추천 시작 마커: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
  });

  it("dry-run 직접 저장은 검증 미리보기만 출력하고 로그 파일을 만들지 않는다", () => {
    const out = makeTempPath("dry-run-direct.json");

    const output = runManualPlaylog([
      `--out=${out}`,
      "--dry-run",
      "--difficulty=novice",
      "--seconds=900",
      "--result=clear",
      "--stage=1",
      "--round=40",
      "--seed=DRY-RUN",
      "--legends=0",
      "--maxGrade=hero",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000020",
      "--startedAt=2026-06-20T02:00:00.000Z",
      "--endedAt=2026-06-20T02:15:00.000Z",
    ]);

    expect(output).toContain("DRY RUN 수동 플레이 로그 검증 통과");
    expect(output).toContain("- 저장하지 않음: --dry-run");
    expect(output).toContain("- 추가 예정 세션: novice, 15.0분");
    expect(output).toContain("- 상태 체크섬: 20000020");
    expect(output).toContain('"seed": "DRY-RUN"');
    expect(existsSync(out)).toBe(false);
  });

  it("결과 저장은 RESULT_* 및 GAME_SEED_HERE placeholder 값을 저장하지 않는다", () => {
    const cases = [
      {
        out: makeTempPath("placeholder-result-seed.json"),
        args: ["--seed=GAME_SEED_HERE", `--dataVersion=${CURRENT_DATA_VERSION}`, "--stateChecksum=20000024", "--endedAt=2026-06-20T02:15:00.000Z"],
        message: "--seed=GAME_SEED_HERE는 템플릿 placeholder입니다.",
      },
      {
        out: makeTempPath("placeholder-result-data-version.json"),
        args: ["--seed=REAL-SEED", "--dataVersion=RESULT_DATA_VERSION", "--stateChecksum=20000025", "--endedAt=2026-06-20T02:15:00.000Z"],
        message: "--dataVersion=RESULT_DATA_VERSION는 템플릿 placeholder입니다.",
      },
      {
        out: makeTempPath("placeholder-result-checksum.json"),
        args: ["--seed=REAL-SEED", `--dataVersion=${CURRENT_DATA_VERSION}`, "--stateChecksum=RESULT_CHECKSUM", "--endedAt=2026-06-20T02:15:00.000Z"],
        message: "--stateChecksum=RESULT_CHECKSUM는 템플릿 placeholder입니다.",
      },
      {
        out: makeTempPath("placeholder-result-ended-at.json"),
        args: ["--seed=REAL-SEED", `--dataVersion=${CURRENT_DATA_VERSION}`, "--stateChecksum=20000026", "--endedAt=RESULT_ENDED_AT"],
        message: "--endedAt=RESULT_ENDED_AT는 템플릿 placeholder입니다.",
      },
    ];

    for (const { out, args, message } of cases) {
      const failed = runManualPlaylogFailure([
        `--out=${out}`,
        "--dry-run",
        "--difficulty=novice",
        "--seconds=900",
        "--result=clear",
        "--stage=1",
        "--round=40",
        "--legends=0",
        "--maxGrade=hero",
        "--startedAt=2026-06-20T02:00:00.000Z",
        ...args,
      ]);

      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain(message);
      expect(existsSync(out)).toBe(false);
    }
  });

  it("dry-run finish는 시작 마커를 닫지 않고 세션도 저장하지 않는다", () => {
    const out = makeTempPath("dry-run-finish.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=dry-run-finish",
      "--difficulty=normal",
      "--stage=1",
      "--seed=DRY-FINISH",
      "--startedAt=2026-06-20T00:00:00.000Z",
    ]);

    const output = runManualPlaylog([
      `--out=${out}`,
      "--finish=dry-run-finish",
      "--dry-run",
      "--result=clear",
      "--round=40",
      "--legends=1",
      "--maxGrade=legend",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000021",
      "--endedAt=2026-06-20T00:15:00.000Z",
    ]);

    const log = readJson(out);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));
    expect(output).toContain("DRY RUN 수동 플레이 로그 검증 통과");
    expect(output).toContain("- 연결 예정 시작 마커: dry-run-finish");
    expect(output).toContain('"pendingSessionId": "dry-run-finish"');
    expect(log.sessions).toEqual([]);
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toMatchObject({
      id: "dry-run-finish",
      seed: "DRY-FINISH",
    });
  });

  it("직접 저장은 현재 데이터 버전이 아닌 결과를 즉시 거부한다", () => {
    const out = makeTempPath("save-stale-data-version.json");

    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--difficulty=novice",
      "--seconds=900",
      "--result=clear",
      "--stage=1",
      "--round=40",
      "--seed=STALE-SAVE",
      "--legends=0",
      "--maxGrade=hero",
      "--dataVersion=0.0.0",
      "--stateChecksum=20000030",
      "--startedAt=2026-06-20T02:00:00.000Z",
      "--endedAt=2026-06-20T02:15:00.000Z",
    ]);

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(`--dataVersion 0.0.0은 현재 DATA_VERSION ${CURRENT_DATA_VERSION}와 다릅니다`);
  });

  it("finish도 현재 데이터 버전이 아닌 결과를 저장하지 않는다", () => {
    const out = makeTempPath("finish-stale-data-version.json");
    runManualPlaylog([
      `--out=${out}`,
      "--start",
      "--id=stale-finish",
      "--difficulty=normal",
      "--stage=1",
      "--seed=STALE-FINISH",
      "--startedAt=2026-06-20T00:00:00.000Z",
    ]);

    const failed = runManualPlaylogFailure([
      `--out=${out}`,
      "--finish=stale-finish",
      "--result=clear",
      "--round=40",
      "--legends=1",
      "--maxGrade=legend",
      "--dataVersion=0.0.0",
      "--stateChecksum=20000031",
      "--endedAt=2026-06-20T00:15:00.000Z",
    ]);
    const pending = JSON.parse(runManualPlaylog([`--out=${out}`, "--pending-json"]));

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(`--dataVersion 0.0.0은 현재 DATA_VERSION ${CURRENT_DATA_VERSION}와 다릅니다`);
    expect(pending.pending).toHaveLength(1);
  });

  it("직접 저장은 40R 미만 clear와 40R 초과 round를 거부한다", () => {
    const out = makeTempPath("save-impossible-round.json");

    const earlyClear = runManualPlaylogFailure([
      `--out=${out}`,
      "--difficulty=novice",
      "--seconds=900",
      "--result=clear",
      "--stage=1",
      "--round=39",
      "--seed=EARLY-CLEAR",
      "--legends=0",
      "--maxGrade=hero",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000033",
      "--startedAt=2026-06-20T02:00:00.000Z",
      "--endedAt=2026-06-20T02:15:00.000Z",
    ]);
    const overRound = runManualPlaylogFailure([
      `--out=${out}`,
      "--difficulty=master",
      "--seconds=900",
      "--result=loss",
      "--stage=1",
      "--round=41",
      "--seed=OVER-ROUND",
      "--legends=0",
      "--maxGrade=hero",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000034",
      "--startedAt=2026-06-20T03:00:00.000Z",
      "--endedAt=2026-06-20T03:15:00.000Z",
    ]);

    expect(earlyClear.status).toBe(1);
    expect(earlyClear.stderr).toContain("--result=clear는 40R 최종 보스 클리어 결과에서만 사용할 수 있습니다");
    expect(overRound.status).toBe(1);
    expect(overRound.stderr).toContain("--round는 최종 라운드 40을 넘을 수 없습니다");
  });

  it("시작 마커와 직접 저장은 실제 맵 번호 범위 밖 stage를 거부한다", () => {
    const startOut = makeTempPath("start-invalid-stage.json");
    const saveOut = makeTempPath("save-invalid-stage.json");
    const startNextOut = makeTempPath("start-next-invalid-stage.json");

    const startFailed = runManualPlaylogFailure([
      `--out=${startOut}`,
      "--start",
      "--id=invalid-stage-start",
      "--difficulty=novice",
      "--stage=16",
      "--seed=BAD-STAGE-START",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);
    const startNextFailed = runManualPlaylogFailure([
      `--out=${startNextOut}`,
      "--start-next",
      "--stage=1.5",
      "--seed=BAD-STAGE-START-NEXT",
      "--startedAt=2026-06-20T02:00:00.000Z",
    ]);
    const saveFailed = runManualPlaylogFailure([
      `--out=${saveOut}`,
      "--difficulty=novice",
      "--seconds=900",
      "--result=clear",
      "--stage=16",
      "--round=40",
      "--seed=BAD-STAGE-SAVE",
      "--legends=0",
      "--maxGrade=hero",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000035",
      "--startedAt=2026-06-20T02:00:00.000Z",
      "--endedAt=2026-06-20T02:15:00.000Z",
    ]);

    expect(startFailed.status).toBe(1);
    expect(startFailed.stderr).toContain("--stage는 실제 맵 번호 1~15 중 하나여야 합니다");
    expect(startNextFailed.status).toBe(1);
    expect(startNextFailed.stderr).toContain("--stage는 실제 맵 번호 1~15 중 하나여야 합니다");
    expect(saveFailed.status).toBe(1);
    expect(saveFailed.stderr).toContain("--stage는 실제 맵 번호 1~15 중 하나여야 합니다");
    expect(JSON.parse(runManualPlaylog([`--out=${startOut}`, "--pending-json"])).pending).toHaveLength(0);
    expect(JSON.parse(runManualPlaylog([`--out=${startNextOut}`, "--pending-json"])).pending).toHaveLength(0);
    expect(existsSync(saveOut)).toBe(false);
  });

  it("summary는 외부에서 들어온 불가능한 clear 라운드를 무효 처리한다", () => {
    const out = makeTempPath("summary-impossible-round.json");
    writeFileSync(out, JSON.stringify({
      schemaVersion: 1,
      source: "manual-playlog",
      sessions: [
        {
          source: "human-playtest",
          difficulty: "novice",
          minutes: 12,
          startedAt: "2026-06-20T00:00:00.000Z",
          endedAt: "2026-06-20T00:12:00.000Z",
          result: "clear",
          stage: 1,
          round: 39,
          seed: "EARLY-CLEAR",
          legends: 0,
          maxGrade: "hero",
          dataVersion: CURRENT_DATA_VERSION,
          stateChecksum: "bad00004",
        },
      ],
    }, null, 2), "utf8");

    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));

    expect(summary.validSessionCount).toBe(0);
    expect(summary.invalidSessionCount).toBe(1);
    expect(summary.invalidSessions[0]).toMatchObject({
      seed: "EARLY-CLEAR",
      round: 39,
      issues: ["필수 결과 메타데이터 누락 또는 모순"],
    });
  });

  it("summary는 외부에서 들어온 실제 맵 범위 밖 stage를 무효 처리한다", () => {
    const out = makeTempPath("summary-invalid-stage.json");
    writeFileSync(out, JSON.stringify({
      schemaVersion: 1,
      source: "manual-playlog",
      sessions: [
        {
          source: "human-playtest",
          difficulty: "novice",
          minutes: 12,
          startedAt: "2026-06-20T00:00:00.000Z",
          endedAt: "2026-06-20T00:12:00.000Z",
          result: "clear",
          stage: 16,
          round: 40,
          seed: "INVALID-STAGE",
          legends: 0,
          maxGrade: "hero",
          dataVersion: CURRENT_DATA_VERSION,
          stateChecksum: "bad00006",
        },
      ],
    }, null, 2), "utf8");

    const summary = JSON.parse(runManualPlaylog([`--out=${out}`, "--summary-json"]));

    expect(summary.validSessionCount).toBe(0);
    expect(summary.invalidSessionCount).toBe(1);
    expect(summary.invalidSessions[0]).toMatchObject({
      seed: "INVALID-STAGE",
      issues: ["필수 결과 메타데이터 누락 또는 모순"],
    });
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
    expect(pending.pending[0].finishDryRunCommandTemplate).toContain("yarn manual-playlog --finish='normal-run-1'");
    expect(pending.pending[0].finishDryRunCommandTemplate).toContain("--dry-run");
    expect(pending.pending[0].finishCommandTemplate).toContain("--round=ROUND_REACHED");
    const pendingText = runManualPlaylog([`--out=${out}`, "--pending"]);
    expect(pendingText).toContain("저장 전 검증 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(pendingText).toContain("마무리 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(summaryBeforeFinish.pendingCount).toBe(1);
    expect(summaryBeforeFinish.pending[0].finishCommandTemplate).toContain("yarn manual-playlog --finish='normal-run-1'");
    expect(summaryBeforeFinish.pending[0].finishDryRunCommandTemplate).toContain("--dry-run");
    expect(planBeforeFinish.current.pendingCount).toBe(1);
    const summaryText = runManualPlaylog([`--out=${out}`, "--summary"]);
    expect(summaryText).toContain("PENDING 아직 finish되지 않은 시작 마커");
    expect(summaryText).toContain("경과: 12분 목표 충족");
    expect(summaryText).toContain("저장 전 검증 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(summaryText).toContain("마무리 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(summaryText).toContain("새 시작 마커 추천은 pending 시작 마커를 finish한 뒤 다시 표시됩니다.");
    expect(summaryText).not.toContain("추천 시작 마커:");
    const nextBeforeFinish = runManualPlaylog([`--out=${out}`, "--next"]);
    const nextJsonBeforeFinish = JSON.parse(runManualPlaylog([`--out=${out}`, "--next-json"]));
    expect(nextBeforeFinish).toContain("PENDING 먼저 finish해야 하는 시작 마커가 있습니다.");
    expect(nextBeforeFinish).toContain("저장 전 검증 템플릿: yarn manual-playlog --finish='normal-run-1'");
    expect(nextBeforeFinish).not.toContain("추천 시작 마커:");
    expect(nextJsonBeforeFinish.blockedByPendingStartMarkers).toBe(true);
    expect(nextJsonBeforeFinish.next).toBeNull();
    expect(nextJsonBeforeFinish.pending).toHaveLength(1);

    const finishOutput = runManualPlaylog([
      `--out=${out}`,
      "--finish=normal-run-1",
      "--result=clear",
      "--round=40",
      "--legends=1",
      "--maxGrade=legend",
      `--dataVersion=${CURRENT_DATA_VERSION}`,
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
    expect(finishOutput).toContain("- 추천 시작 마커: yarn manual-playlog --start-next --difficulty=novice --seed=GAME_SEED_HERE");
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
      `--dataVersion=${CURRENT_DATA_VERSION}`,
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
      `--dataVersion=${CURRENT_DATA_VERSION}`,
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
      `--dataVersion=${CURRENT_DATA_VERSION}`,
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
      ["expert", 12, "loss", 33, 5, "legend", "20000004"],
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
      `--dataVersion=${CURRENT_DATA_VERSION}`,
      "--stateChecksum=20000008",
      "--startedAt=2026-06-20T03:00:00.000Z",
      "--endedAt=2026-06-20T03:01:00.000Z",
    ]);
    expect(finalOutput).toContain("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
  });
});
