// CLI 시뮬레이션: yarn sim [--seeds=100] [--difficulty=novice|normal] [--strategy=balanced]
import { runSimulation, reportToMarkdown } from "../src/sim/runner";
import type { Strategy } from "../src/sim/autoPlayer";

declare const process: { argv: string[] };

const args = Object.fromEntries(
  process.argv.slice(2).map((a: string) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const seeds = Number(args.seeds ?? 100);
const difficulty = (args.difficulty ?? "novice") as "novice" | "normal";
const strategy = (args.strategy ?? "balanced") as Strategy;

console.log(`시뮬레이션 시작: ${seeds}시드, ${difficulty}, ${strategy}`);
const report = runSimulation(seeds, difficulty, strategy, (done, total) => {
  if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
});
console.log("");
console.log(reportToMarkdown(report));
