import { describe, expect, it } from "vitest";
import type { DifficultyId, Grade, ResultSummary } from "./types";
import { manualProofResultChecklist, manualProofResultTarget } from "./manualProofResult";

function summary(args: {
  difficultyId: DifficultyId;
  cleared: boolean;
  reachedRound?: number;
  legendOrBetterCount?: number;
  maxGrade?: Grade;
  wallSeconds?: number;
}): ResultSummary {
  const legends = args.legendOrBetterCount ?? 0;
  return {
    seed: "TEST",
    difficultyId: args.difficultyId,
    difficulty: args.difficultyId,
    stageId: 1,
    stageName: "Rotten Crossroads",
    dataVersion: "test",
    stateChecksum: "checksum",
    cleared: args.cleared,
    reachedRound: args.reachedRound ?? 40,
    life: 1,
    maxGrade: args.maxGrade ?? (legends > 0 ? "legend" : "hero"),
    legendCount: legends,
    hiddenCount: 0,
    legendOrBetterCount: legends,
    missionsDone: 0,
    missionsTotal: 0,
    topDealers: [],
    failHint: null,
    bossKills: [],
    bossFails: [],
    pityTriggered: 0,
    craftCount: 0,
    merge3Count: 0,
    playedAt: "2026-06-20T00:00:00.000Z",
    wallSeconds: args.wallSeconds ?? 12 * 60,
  };
}

describe("수동 결과 증거 판정", () => {
  it("고수 5전설 이하는 40R 실패 증거 행만 검사한다", () => {
    const r = summary({ difficultyId: "expert", cleared: false, legendOrBetterCount: 5 });
    const checks = manualProofResultChecklist(r);

    expect(manualProofResultTarget(r)).toBe("고수 5전설 이하 40R 실패 증거");
    expect(checks).toContainEqual({
      label: "고수 5전설 이하 40R 실패",
      ok: true,
      detail: "패배, 5전설+",
    });
    expect(checks.some((check) => check.label === "고수 6전설 이상 40R 클리어")).toBe(false);
  });

  it("고수 6전설 이상은 40R 클리어 증거 행만 검사한다", () => {
    const r = summary({ difficultyId: "expert", cleared: true, legendOrBetterCount: 6 });
    const checks = manualProofResultChecklist(r);

    expect(manualProofResultTarget(r)).toBe("고수 6전설 이상 40R 클리어 증거");
    expect(checks).toContainEqual({
      label: "고수 6전설 이상 40R 클리어",
      ok: true,
      detail: "클리어, 6전설+",
    });
    expect(checks.some((check) => check.label === "고수 5전설 이하 40R 실패")).toBe(false);
  });

  it("초고수 실패 기록은 40R 도달을 요구하지 않는다", () => {
    const checks = manualProofResultChecklist(summary({
      difficultyId: "master",
      cleared: false,
      reachedRound: 12,
      legendOrBetterCount: 3,
    }));

    expect(checks.some((check) => check.label === "40R 최종 보스 구간")).toBe(false);
    expect(checks).toContainEqual({
      label: "초고수 실패 기록",
      ok: true,
      detail: "패배",
    });
  });
});
