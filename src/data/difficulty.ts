import type { DifficultyDef, Grade } from "../core/types";

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: "novice", name: "입문자",
    unitCap: 50, enemyHpMult: 0.82, enemyLimit: 100, goldMult: 1.35, startGold: 160, startLife: 30,
  },
  {
    id: "normal", name: "일반",
    unitCap: 38, enemyHpMult: 5.3, enemyLimit: 54, goldMult: 1.0, startGold: 100, startLife: 20,
  },
  {
    id: "intermediate", name: "중급자",
    unitCap: 36, enemyHpMult: 5.6, enemyLimit: 52, goldMult: 0.92, startGold: 90, startLife: 18,
  },
  {
    id: "expert", name: "고수",
    unitCap: 34, enemyHpMult: 8.2, enemyLimit: 46, goldMult: 0.84, startGold: 75, startLife: 14,
  },
  {
    id: "master", name: "초고수",
    unitCap: 28, enemyHpMult: 12.0, enemyLimit: 32, goldMult: 0.76, startGold: 55, startLife: 10,
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
