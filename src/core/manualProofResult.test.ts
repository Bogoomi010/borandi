import { describe, expect, it } from "vitest";
import type { DifficultyId, Grade, ResultSummary } from "./types";
import { manualProofResultChecklist, manualProofResultLogNote, manualProofResultTarget } from "./manualProofResult";

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
    inputCount: 12,
    inputCounts: { summon: 12 },
    playedAt: "2026-06-20T00:00:00.000Z",
    wallSeconds: args.wallSeconds ?? 12 * 60,
  };
}

describe("수동 결과 증거 판정", () => {
  it("고수 5전설 이하는 40R 이전 실패도 증거 행으로 검사한다", () => {
    const r = summary({ difficultyId: "expert", cleared: false, reachedRound: 33, legendOrBetterCount: 5 });
    const checks = manualProofResultChecklist(r);

    expect(manualProofResultTarget(r)).toBe("고수 5전설 이하 실패 증거");
    expect(checks).toContainEqual({
      label: "고수 5전설 이하 실패",
      ok: true,
      detail: "패배, 5전설+",
    });
    expect(checks.some((check) => check.label === "40R 최종 보스 구간")).toBe(false);
    expect(checks.some((check) => check.label === "고수 6전설 이상 40R 클리어")).toBe(false);
  });

  it("고수 6전설 이상은 40R 클리어 증거 행만 검사한다", () => {
    const r = summary({ difficultyId: "expert", cleared: true, legendOrBetterCount: 6 });
    const checks = manualProofResultChecklist(r);

    expect(manualProofResultTarget(r)).toBe("고수 6전설 이상 40R 클리어 증거 / 고수 제한 없음 성장 확인");
    expect(checks).toContainEqual({
      label: "고수 6전설 이상 40R 클리어",
      ok: true,
      detail: "클리어, 6전설+",
    });
    expect(checks.some((check) => check.label === "고수 5전설 이하 실패")).toBe(false);
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

  it("로그 note에는 목표 증거 판정 라벨을 포함한다", () => {
    const target = summary({ difficultyId: "normal", cleared: true, legendOrBetterCount: 2 });
    const observation = summary({ difficultyId: "normal", cleared: false, legendOrBetterCount: 0, reachedRound: 32 });

    expect(manualProofResultLogNote(target)).toBe("일반 1~2전설 40R 클리어 증거 · normal clear, 2전설 이상");
    expect(manualProofResultLogNote(observation)).toBe("일반 무전설 경계 확인 · normal loss, 0전설 이상");
  });

  it("경계 관찰 결과에도 수동 관찰 라벨을 붙인다", () => {
    expect(manualProofResultTarget(summary({ difficultyId: "intermediate", cleared: false, legendOrBetterCount: 2, reachedRound: 39 })))
      .toBe("중급자 2전설 경계 확인");
    expect(manualProofResultTarget(summary({ difficultyId: "master", cleared: false, legendOrBetterCount: 1, reachedRound: 4 })))
      .toBe("초고수 실패 기록 증거 / 초고수 추가 실패 확인");
  });
});
