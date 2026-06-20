import { runSimulation, type SimReport } from "./runner";
import type { AutoPlayOptions } from "./autoPlayer";
import type { DifficultyId, Grade } from "../core/types";
import { DATA_VERSION } from "../data/version";

export interface BalanceScenario {
  id: string;
  label: string;
  difficulty: DifficultyId;
  options: AutoPlayOptions;
}

export interface BalanceGate {
  label: string;
  pass: boolean;
  detail: string;
}

export interface BalanceScenarioResult {
  scenario: BalanceScenario;
  report: SimReport;
}

export interface BalanceGateResult {
  seeds: number;
  strategy: "balanced";
  scenarios: BalanceScenarioResult[];
  gates: BalanceGate[];
  passed: boolean;
}

export const BALANCE_GATE_DEFAULT_SEEDS = 30;

export const BALANCE_SCENARIOS: BalanceScenario[] = [
  { id: "noviceHero", label: "입문자 / 전설 없음", difficulty: "novice", options: { strategy: "balanced", maxGrade: "hero" as Grade } },
  { id: "normalNoLegend", label: "일반 / 전설 0개", difficulty: "normal", options: { strategy: "balanced", maxLegendCount: 0 } },
  { id: "normalOneLegend", label: "일반 / 전설 1개", difficulty: "normal", options: { strategy: "balanced", maxLegendCount: 1 } },
  { id: "normalTwoLegend", label: "일반 / 전설 2개", difficulty: "normal", options: { strategy: "balanced", maxLegendCount: 2 } },
  { id: "intermediateTwoLegend", label: "중급자 / 전설 2개", difficulty: "intermediate", options: { strategy: "balanced", maxLegendCount: 2 } },
  { id: "intermediateFiveLegend", label: "중급자 / 전설 5개", difficulty: "intermediate", options: { strategy: "balanced", maxLegendCount: 5 } },
  { id: "intermediateOpen", label: "중급자 / 제한 없음", difficulty: "intermediate", options: { strategy: "balanced" } },
  { id: "expertFiveLegend", label: "고수 / 전설 5개", difficulty: "expert", options: { strategy: "balanced", maxLegendCount: 5 } },
  { id: "expertOpen", label: "고수 / 제한 없음", difficulty: "expert", options: { strategy: "balanced" } },
  { id: "masterOpen", label: "초고수 / 제한 없음", difficulty: "master", options: { strategy: "balanced" } },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function resultById(results: BalanceScenarioResult[], id: string): SimReport {
  const result = results.find((r) => r.scenario.id === id)?.report;
  if (!result) throw new Error(`missing scenario result: ${id}`);
  return result;
}

export function evaluateBalanceGate(seeds: number, scenarioResults: BalanceScenarioResult[]): BalanceGateResult {
  const noviceHero = resultById(scenarioResults, "noviceHero");
  const normalNoLegend = resultById(scenarioResults, "normalNoLegend");
  const normalOneLegend = resultById(scenarioResults, "normalOneLegend");
  const normalTwoLegend = resultById(scenarioResults, "normalTwoLegend");
  const intermediateTwoLegend = resultById(scenarioResults, "intermediateTwoLegend");
  const intermediateFiveLegend = resultById(scenarioResults, "intermediateFiveLegend");
  const intermediateOpen = resultById(scenarioResults, "intermediateOpen");
  const expertFiveLegend = resultById(scenarioResults, "expertFiveLegend");
  const expertOpen = resultById(scenarioResults, "expertOpen");
  const masterOpen = resultById(scenarioResults, "masterOpen");

  const gates: BalanceGate[] = [
    {
      label: "입문자는 전설 없이도 안정적으로 클리어",
      pass: noviceHero.clearRate >= 0.9,
      detail: `입문자 전설 없음 ${pct(noviceHero.clearRate)} >= 90.0%`,
    },
    {
      label: "일반은 전설 1~2개 보유가 무전설보다 명확히 유리",
      pass: normalNoLegend.clearRate <= 0.25 &&
        normalOneLegend.clearRate >= 0.2 &&
        normalOneLegend.clearRate >= normalNoLegend.clearRate &&
        normalTwoLegend.clearRate >= 0.45 &&
        normalTwoLegend.clearRate >= normalNoLegend.clearRate + 0.3,
      detail: `0전설 ${pct(normalNoLegend.clearRate)}, 1전설 ${pct(normalOneLegend.clearRate)}, 2전설 ${pct(normalTwoLegend.clearRate)}`,
    },
    {
      label: "중급자는 2전설보다 5전설 이상에서 클리어권 진입",
      pass: intermediateTwoLegend.clearRate <= 0.15 &&
        intermediateFiveLegend.clearRate >= 0.4 &&
        intermediateFiveLegend.clearRate >= intermediateTwoLegend.clearRate + 0.3 &&
        intermediateOpen.clearRate >= 0.85,
      detail: `2전설 ${pct(intermediateTwoLegend.clearRate)}, 5전설 ${pct(intermediateFiveLegend.clearRate)}, 제한 없음 ${pct(intermediateOpen.clearRate)}`,
    },
    {
      label: "고수는 중급 예산보다 더 높은 성장이 필요",
      pass: expertFiveLegend.clearRate <= 0.1 &&
        expertOpen.clearRate >= 0.4 &&
        expertOpen.clearRate >= expertFiveLegend.clearRate + 0.3,
      detail: `5전설 ${pct(expertFiveLegend.clearRate)}, 제한 없음 ${pct(expertOpen.clearRate)}`,
    },
    {
      label: "초고수는 자동 플레이 기준으로 매우 어려움",
      pass: masterOpen.clearRate <= 0.05,
      detail: `제한 없음 ${pct(masterOpen.clearRate)} <= 5.0%`,
    },
  ];

  return {
    seeds,
    strategy: "balanced",
    scenarios: scenarioResults,
    gates,
    passed: gates.every((g) => g.pass),
  };
}

export function runBalanceGate(
  seeds = BALANCE_GATE_DEFAULT_SEEDS,
  onScenario?: (result: BalanceScenarioResult, index: number, total: number) => void,
): BalanceGateResult {
  const scenarioResults: BalanceScenarioResult[] = [];
  for (let i = 0; i < BALANCE_SCENARIOS.length; i++) {
    const scenario = BALANCE_SCENARIOS[i];
    const result = {
      scenario,
      report: runSimulation(seeds, scenario.difficulty, scenario.options),
    };
    scenarioResults.push(result);
    onScenario?.(result, i + 1, BALANCE_SCENARIOS.length);
  }
  return evaluateBalanceGate(seeds, scenarioResults);
}

export function balanceGateToMarkdown(result: BalanceGateResult): string {
  const lines: string[] = [];
  lines.push("# 5난이도 밸런스 게이트");
  lines.push("");
  lines.push(`- 시드 수: ${result.seeds}`);
  lines.push(`- 전략: ${result.strategy}`);
  lines.push(`- 결과: ${result.passed ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push("## 시나리오");
  lines.push("");
  lines.push("| 조건 | 클리어율 | 평균 라운드 | 평균 전설 |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const { scenario, report } of result.scenarios) {
    lines.push(`| ${scenario.label} | ${pct(report.clearRate)} | ${report.avgReachedRound.toFixed(1)}R | ${report.avgLegendCount.toFixed(1)} |`);
  }
  lines.push("");
  lines.push("## 게이트");
  lines.push("");
  for (const gate of result.gates) {
    lines.push(`- ${gate.pass ? "PASS" : "FAIL"} ${gate.label} (${gate.detail})`);
  }
  return lines.join("\n");
}

export function balanceGateToJson(result: BalanceGateResult): string {
  return JSON.stringify({
    dataVersion: DATA_VERSION,
    seeds: result.seeds,
    strategy: result.strategy,
    scenarios: result.scenarios.map(({ scenario, report }) => ({
      id: scenario.id,
      label: scenario.label,
      difficulty: scenario.difficulty,
      options: scenario.options,
      report,
    })),
    gates: result.gates,
    passed: result.passed,
  }, null, 2);
}
