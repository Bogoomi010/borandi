import { describe, expect, it } from "vitest";
import { evaluateBalanceGate, type BalanceScenarioResult } from "./balanceGate";
import type { DifficultyId, Grade } from "../core/types";
import type { SimReport } from "./runner";

function report(difficulty: DifficultyId, clearRate: number): SimReport {
  return {
    seeds: 30,
    difficulty,
    strategy: "balanced",
    clearRate,
    avgReachedRound: 40,
    deathRounds: {},
    bossFailCounts: {},
    avgMissionsDone: 0,
    missionRates: {},
    pityRate: 0,
    gradeDistribution: { common: 0, rare: 0, hero: 0, legend: 0, hidden: 0 } satisfies Record<Grade, number>,
    avgLegendCount: 0,
    avgHiddenCount: 0,
    durationMs: 0,
  };
}

function scenario(id: string, difficulty: DifficultyId, clearRate: number): BalanceScenarioResult {
  return {
    scenario: { id, label: id, difficulty, options: { strategy: "balanced" } },
    report: report(difficulty, clearRate),
  };
}

function fullScenarioResults(overrides: Record<string, number> = {}): BalanceScenarioResult[] {
  const rates: Record<string, [DifficultyId, number]> = {
    noviceHero: ["novice", 1],
    normalNoLegend: ["normal", 0.13],
    normalOneLegend: ["normal", 0.2],
    normalTwoLegend: ["normal", 0.53],
    intermediateTwoLegend: ["intermediate", 0.1],
    intermediateFiveLegend: ["intermediate", 0.4],
    intermediateOpen: ["intermediate", 0.93],
    expertFiveLegend: ["expert", 0.06],
    expertOpen: ["expert", 0.56],
    masterOpen: ["master", 0],
  };
  return Object.entries(rates).map(([id, [difficulty, rate]]) =>
    scenario(id, difficulty, overrides[id] ?? rate),
  );
}

describe("5난이도 밸런스 게이트", () => {
  it("일반은 1전설 최소 클리어권과 2전설 확실한 개선을 요구한다", () => {
    const result = evaluateBalanceGate(30, fullScenarioResults());

    expect(result.passed).toBe(true);
    expect(result.gates.find((gate) => gate.label.startsWith("일반"))?.pass).toBe(true);
  });

  it("일반 2전설이 무전설보다 충분히 낫지 않으면 실패한다", () => {
    const result = evaluateBalanceGate(30, fullScenarioResults({ normalTwoLegend: 0.4 }));

    expect(result.passed).toBe(false);
    expect(result.gates.find((gate) => gate.label.startsWith("일반"))?.pass).toBe(false);
  });

  it("초고수는 제한 없음에서도 클리어율이 0%가 아니면 실패한다", () => {
    const result = evaluateBalanceGate(30, fullScenarioResults({ masterOpen: 1 / 30 }));

    expect(result.passed).toBe(false);
    expect(result.gates.find((gate) => gate.label.startsWith("초고수"))?.pass).toBe(false);
  });
});
