// 다중 시드 자동 시뮬레이션 — 실제 게임 코어 재사용

import { Game } from "../core/engine";
import { playFullRun, type AutoPlayOptions, type Strategy } from "./autoPlayer";
import { GRADE_LABEL, GRADE_ORDER, type DifficultyId, type Grade } from "../core/types";
import { MISSION_BY_ID } from "../data/missions";
import { UNIT_BY_ID } from "../data/units";

export interface SimReport {
  seeds: number;
  difficulty: DifficultyId;
  strategy: Strategy;
  clearRate: number;
  avgReachedRound: number;
  deathRounds: Record<number, number>;
  bossFailCounts: Record<number, number>;
  avgMissionsDone: number;
  missionRates: Record<string, number>;
  pityRate: number;
  gradeDistribution: Record<Grade, number>;
  avgLegendCount: number;
  avgHiddenCount: number;
  durationMs: number;
}

export function runSimulation(
  seeds: number,
  difficulty: DifficultyId,
  strategyOrOptions: Strategy | AutoPlayOptions = "balanced",
  onProgress?: (done: number, total: number) => void,
): SimReport {
  const options: AutoPlayOptions = typeof strategyOrOptions === "string"
    ? { strategy: strategyOrOptions }
    : strategyOrOptions;
  const strategy = options.strategy ?? "balanced";
  const started = Date.now();
  let clears = 0;
  let totalRound = 0;
  let totalMissions = 0;
  let totalLegends = 0;
  let totalHidden = 0;
  let pityRuns = 0;
  const deathRounds: Record<number, number> = {};
  const bossFailCounts: Record<number, number> = {};
  const missionDone: Record<string, number> = {};
  const gradeDist: Record<Grade, number> = {
    common: 0, rare: 0, hero: 0, legend: 0, hidden: 0,
  };

  for (let i = 0; i < seeds; i++) {
    const game = new Game(`SIM-${i + 1}`, difficulty);
    playFullRun(game, options);
    const s = game.state;
    if (s.cleared) clears++;
    else deathRounds[s.round] = (deathRounds[s.round] ?? 0) + 1;
    totalRound += s.round;
    totalMissions += s.missions.filter((m) => m.status === "done").length;
    for (const m of s.missions) {
      if (m.status === "done") missionDone[m.defId] = (missionDone[m.defId] ?? 0) + 1;
    }
    for (const r of s.bossFailedRounds) {
      bossFailCounts[r] = (bossFailCounts[r] ?? 0) + 1;
    }
    if (s.summonStats.pityTriggered > 0) pityRuns++;
    totalLegends += s.units.filter((u) => UNIT_BY_ID[u.defId].grade === "legend").length;
    totalHidden += s.units.filter((u) => UNIT_BY_ID[u.defId].grade === "hidden").length;
    gradeDist[game.maxOwnedGrade()]++;
    onProgress?.(i + 1, seeds);
  }

  const missionRates: Record<string, number> = {};
  for (const [id, n] of Object.entries(missionDone)) missionRates[id] = n / seeds;

  return {
    seeds, difficulty, strategy,
    clearRate: clears / seeds,
    avgReachedRound: totalRound / seeds,
    deathRounds, bossFailCounts,
    avgMissionsDone: totalMissions / seeds,
    missionRates,
    pityRate: pityRuns / seeds,
    gradeDistribution: gradeDist,
    avgLegendCount: totalLegends / seeds,
    avgHiddenCount: totalHidden / seeds,
    durationMs: Date.now() - started,
  };
}

export function reportToMarkdown(r: SimReport): string {
  const lines: string[] = [];
  lines.push(`# 시뮬레이션 리포트`);
  lines.push("");
  lines.push(`- 시드 수: ${r.seeds}`);
  lines.push(`- 난이도: ${r.difficulty}`);
  lines.push(`- 전략: ${r.strategy}`);
  lines.push(`- 클리어율: ${(r.clearRate * 100).toFixed(1)}%`);
  lines.push(`- 평균 도달 라운드: ${r.avgReachedRound.toFixed(1)}`);
  lines.push(`- 평균 미션 완료: ${r.avgMissionsDone.toFixed(1)}`);
  lines.push(`- 평균 전설 보유: ${r.avgLegendCount.toFixed(1)}`);
  lines.push(`- 평균 히든 보유: ${r.avgHiddenCount.toFixed(1)}`);
  lines.push(`- 보정 발동 판 비율: ${(r.pityRate * 100).toFixed(1)}%`);
  lines.push(`- 실행 시간: ${(r.durationMs / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push(`## 최고 등급 분포`);
  lines.push("");
  for (const g of GRADE_ORDER) {
    lines.push(`- ${GRADE_LABEL[g]}: ${r.gradeDistribution[g]}`);
  }
  lines.push("");
  lines.push(`## 패배 라운드 분포`);
  lines.push("");
  const dr = Object.entries(r.deathRounds).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (dr.length === 0) lines.push("- 없음");
  for (const [round, n] of dr) lines.push(`- ${round}R: ${n}판`);
  lines.push("");
  lines.push(`## 보스 실패`);
  lines.push("");
  const bf = Object.entries(r.bossFailCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (bf.length === 0) lines.push("- 없음");
  for (const [round, n] of bf) lines.push(`- ${round}R 보스: ${n}회`);
  lines.push("");
  lines.push(`## 미션 달성률`);
  lines.push("");
  for (const [id, rate] of Object.entries(r.missionRates)) {
    const name = MISSION_BY_ID[id]?.name ?? id;
    lines.push(`- ${name}: ${(rate * 100).toFixed(0)}%`);
  }
  return lines.join("\n");
}
