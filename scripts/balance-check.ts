// Difficulty balance gate CLI.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  BALANCE_GATE_DEFAULT_SEEDS,
  balanceGateToJson,
  runBalanceGate,
} from "../src/sim/balanceGate";

declare const process: { argv: string[]; exitCode?: number };

const args = Object.fromEntries(
  process.argv.slice(2).map((a: string) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const seeds = Number(args.seeds ?? BALANCE_GATE_DEFAULT_SEEDS);
const jsonPath = typeof args.json === "string" && args.json !== "true" ? args.json : undefined;

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatScenario(label: string, clearRate: number, avgRound: number, avgLegend: number): string {
  return `- ${label}: ${pct(clearRate).padStart(6)} | ${`${avgRound.toFixed(1)}R`.padStart(6)} | ${`${avgLegend.toFixed(1)}전설`.padStart(8)}`;
}

console.log(`밸런스 게이트 시작: ${seeds}시드, balanced autoplay`);
const result = runBalanceGate(seeds, ({ scenario, report }) => {
  console.log(formatScenario(scenario.label, report.clearRate, report.avgReachedRound, report.avgLegendCount));
});

console.log("");
console.log("## 게이트");
for (const gate of result.gates) {
  console.log(`${gate.pass ? "PASS" : "FAIL"} ${gate.label} (${gate.detail})`);
}

if (jsonPath) {
  const dir = dirname(jsonPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(jsonPath, balanceGateToJson(result), "utf8");
  console.log("");
  console.log(`JSON 리포트 저장: ${jsonPath}`);
}

if (!result.passed) process.exitCode = 1;
