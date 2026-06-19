// Difficulty balance gate: verifies the five requested difficulty bands with deterministic autoplay.
import { runSimulation, type SimReport } from "../src/sim/runner";
import type { AutoPlayOptions } from "../src/sim/autoPlayer";
import type { DifficultyId, Grade } from "../src/core/types";

declare const process: { argv: string[]; exitCode?: number };

interface Scenario {
  id: string;
  label: string;
  difficulty: DifficultyId;
  options: AutoPlayOptions;
}

interface Gate {
  label: string;
  pass: boolean;
  detail: string;
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a: string) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const seeds = Number(args.seeds ?? 30);

const scenarios: Scenario[] = [
  { id: "noviceHero", label: "입문자 / 전설 없음", difficulty: "novice", options: { strategy: "balanced", maxGrade: "hero" as Grade } },
  { id: "normalNoLegend", label: "일반 / 전설 0개", difficulty: "normal", options: { strategy: "balanced", maxLegendCount: 0 } },
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

function formatReport(r: SimReport): string {
  return [
    pct(r.clearRate).padStart(6),
    `${r.avgReachedRound.toFixed(1)}R`.padStart(6),
    `${r.avgLegendCount.toFixed(1)}전설`.padStart(8),
  ].join(" | ");
}

function get(results: Record<string, SimReport>, id: string): SimReport {
  const result = results[id];
  if (!result) throw new Error(`missing scenario result: ${id}`);
  return result;
}

console.log(`밸런스 게이트 시작: ${seeds}시드, balanced autoplay`);
const results: Record<string, SimReport> = {};
for (const scenario of scenarios) {
  const report = runSimulation(seeds, scenario.difficulty, scenario.options);
  results[scenario.id] = report;
  console.log(`- ${scenario.label}: ${formatReport(report)}`);
}

const noviceHero = get(results, "noviceHero");
const normalNoLegend = get(results, "normalNoLegend");
const normalTwoLegend = get(results, "normalTwoLegend");
const intermediateTwoLegend = get(results, "intermediateTwoLegend");
const intermediateFiveLegend = get(results, "intermediateFiveLegend");
const intermediateOpen = get(results, "intermediateOpen");
const expertFiveLegend = get(results, "expertFiveLegend");
const expertOpen = get(results, "expertOpen");
const masterOpen = get(results, "masterOpen");

const gates: Gate[] = [
  {
    label: "입문자는 전설 없이도 안정적으로 클리어",
    pass: noviceHero.clearRate >= 0.9,
    detail: `입문자 전설 없음 ${pct(noviceHero.clearRate)} >= 90.0%`,
  },
  {
    label: "일반은 전설 1~2개 보유가 무전설보다 명확히 유리",
    pass: normalNoLegend.clearRate <= 0.25 &&
      normalTwoLegend.clearRate >= 0.3 &&
      normalTwoLegend.clearRate >= normalNoLegend.clearRate + 0.2,
    detail: `0전설 ${pct(normalNoLegend.clearRate)}, 2전설 ${pct(normalTwoLegend.clearRate)}`,
  },
  {
    label: "중급자는 2전설보다 5전설 이상에서 클리어권 진입",
    pass: intermediateTwoLegend.clearRate <= 0.25 &&
      intermediateFiveLegend.clearRate >= 0.4 &&
      intermediateFiveLegend.clearRate >= intermediateTwoLegend.clearRate + 0.2 &&
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

console.log("");
console.log("## 게이트");
for (const gate of gates) {
  console.log(`${gate.pass ? "PASS" : "FAIL"} ${gate.label} (${gate.detail})`);
}

if (gates.some((g) => !g.pass)) process.exitCode = 1;
