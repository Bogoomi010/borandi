import type { DifficultyDef, Grade } from "../core/types";

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: "novice", name: "입문",
    unitCap: 48, enemyHpMult: 1.0, goldMult: 1.15, startGold: 120, startLife: 20,
  },
  {
    id: "normal", name: "보통",
    unitCap: 40, enemyHpMult: 1.15, goldMult: 1.0, startGold: 100, startLife: 20,
  },
];

export const DIFFICULTY_BY_ID: Record<string, DifficultyDef> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.id, d]),
);

export const SUMMON_COST = 20;

/** MVP 소환 확률 (합 100). 히든은 소환으로 나오지 않는다(히든 조합 전용). */
export const SUMMON_TABLE: Record<Grade, number> = {
  common: 58, rare: 28, hero: 10, legend: 4, hidden: 0,
};

/** 연속 일반 보정: N회 연속 일반이면 다음 소환은 희귀 이상 확정 */
export const PITY_THRESHOLD = 10;
export const PITY_TABLE: Record<Grade, number> = {
  common: 0, rare: 78, hero: 17, legend: 5, hidden: 0,
};

/** 판매 환급 (등급별 골드) */
export const SELL_REFUND: Record<Grade, number> = {
  common: 10, rare: 20, hero: 40, legend: 80, hidden: 120,
};

/** 영웅 보정: 이 라운드 시작까지 영웅 이상이 없으면 영웅 선택권 지급 */
export const HERO_PITY_ROUND = 16;
