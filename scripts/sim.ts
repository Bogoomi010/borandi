// CLI 시뮬레이션: yarn sim [--seeds=100] [--difficulty=novice] [--strategy=balanced] [--maxGrade=hero]
import { runSimulation, reportToMarkdown } from "../src/sim/runner";
import type { Strategy } from "../src/sim/autoPlayer";
import type { DifficultyId, Grade } from "../src/core/types";

declare const process: { argv: string[] };

const args = Object.fromEntries(
  process.argv.slice(2).map((a: string) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const seeds = Number(args.seeds ?? 100);
const difficulty = (args.difficulty ?? "novice") as DifficultyId;
const strategy = (args.strategy ?? "balanced") as Strategy;
const maxGrade = args.maxGrade as Grade | undefined;
const maxLegendCount = args.maxLegendCount !== undefined ? Number(args.maxLegendCount) : undefined;

console.log(`시뮬레이션 시작: ${seeds}시드, ${difficulty}, ${strategy}${maxGrade ? `, maxGrade=${maxGrade}` : ""}${maxLegendCount !== undefined ? `, maxLegendCount=${maxLegendCount}` : ""}`);
const report = runSimulation(seeds, difficulty, { strategy, maxGrade, maxLegendCount }, (done, total) => {
  if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
});
console.log("");
console.log(reportToMarkdown(report));
