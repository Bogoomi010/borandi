import type { UpgradeDef } from "../core/types";

/** 진영별 강화. 기존 프로젝트의 밸런스 수치 이식. */
export const UPGRADES: UpgradeDef[] = [
  {
    id: "up_flame", family: "flame", name: "화염 공격력",
    desc: "화염 유닛 공격력 +12%/Lv",
    baseCost: 80, costGrowth: 1.45, effectPerLevel: 0.12, maxLevel: 8,
  },
  {
    id: "up_frost", family: "frost", name: "서리 감속 지속",
    desc: "서리 유닛 감속 지속 +10%/Lv",
    baseCost: 70, costGrowth: 1.4, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "up_storm", family: "storm", name: "폭풍 공격속도",
    desc: "폭풍 유닛 공속 +10%/Lv",
    baseCost: 80, costGrowth: 1.5, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "up_iron", family: "iron", name: "강철 보스 피해",
    desc: "강철 유닛 보스 피해 +15%/Lv",
    baseCost: 90, costGrowth: 1.55, effectPerLevel: 0.15, maxLevel: 8,
  },
  {
    id: "up_void", family: "void", name: "공허 약화 효율",
    desc: "공허 유닛 방깎·증폭 효율 +10%/Lv",
    baseCost: 75, costGrowth: 1.45, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "up_forest", family: "forest", name: "숲 처치 보상",
    desc: "숲 유닛 처치 골드 +1/Lv",
    baseCost: 75, costGrowth: 1.5, effectPerLevel: 1, maxLevel: 8,
  },
];

export const UPGRADE_BY_FAMILY: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.family, u]),
);

export function upgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
