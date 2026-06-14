import type { UpgradeDef } from "../core/types";

export const UPGRADES: UpgradeDef[] = [
  {
    id: "upgrade_flame", family: "flame", name: "화염 공격력",
    stat: "attack", baseCost: 80, costGrowth: 1.45, effectPerLevel: 0.12, maxLevel: 8,
  },
  {
    id: "upgrade_frost", family: "frost", name: "서리 감속 지속",
    stat: "slowDuration", baseCost: 70, costGrowth: 1.4, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "upgrade_storm", family: "storm", name: "폭풍 공격속도",
    stat: "attackSpeed", baseCost: 80, costGrowth: 1.5, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "upgrade_iron", family: "iron", name: "강철 보스 피해",
    stat: "bossDamage", baseCost: 90, costGrowth: 1.55, effectPerLevel: 0.15, maxLevel: 8,
  },
  {
    id: "upgrade_void", family: "void", name: "공허 약화 효율",
    stat: "debuffPower", baseCost: 75, costGrowth: 1.45, effectPerLevel: 0.10, maxLevel: 8,
  },
  {
    id: "upgrade_forest", family: "forest", name: "숲 처치 보상",
    stat: "killGold", baseCost: 75, costGrowth: 1.5, effectPerLevel: 1, maxLevel: 8,
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

export function upgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
