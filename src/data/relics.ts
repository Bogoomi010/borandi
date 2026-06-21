import type { RelicDef } from "../core/types";

export const RELICS: RelicDef[] = [
  {
    id: "ember_crown",
    name: "잿불 왕관",
    theme: "flame",
    rarity: "rare",
    desc: "화염 유닛 공격력 +18%, 스플래시 반경 +18",
    effect: { family: "flame", attackMult: 0.18, splashRadiusBonus: 18 },
  },
  {
    id: "frost_hourglass",
    name: "서리 모래시계",
    theme: "frost",
    rarity: "rare",
    desc: "서리 감속량 +18%, 감속 지속시간 +25%",
    effect: { family: "frost", slowPctMult: 0.18, slowDurationMult: 0.25 },
  },
  {
    id: "storm_turbine",
    name: "폭풍 터빈",
    theme: "storm",
    rarity: "rare",
    desc: "폭풍 유닛 공격속도 +18%, 처형 기준 +3%",
    effect: { family: "storm", attackSpeedMult: 0.18, executePctBonus: 0.03 },
  },
  {
    id: "iron_oath",
    name: "강철 맹세",
    theme: "iron",
    rarity: "epic",
    desc: "강철 유닛 공격력 +10%, 보스 피해 +35%",
    effect: { family: "iron", attackMult: 0.10, bossDamageMult: 0.35 },
  },
  {
    id: "void_lens",
    name: "공허 렌즈",
    theme: "void",
    rarity: "epic",
    desc: "방어 감소 효과 +25%, 피해 증폭 효과 +25%",
    effect: { armorBreakMult: 0.25, damageAmpMult: 0.25 },
  },
  {
    id: "forest_tithe",
    name: "숲의 십일조",
    theme: "forest",
    rarity: "rare",
    desc: "라운드 정리 골드 +12%, 5킬 보너스 +3골드",
    effect: { roundGoldMult: 0.12, killGoldBonus: 3 },
  },
  {
    id: "prism_banner",
    name: "프리즘 깃발",
    theme: "prism",
    rarity: "legend",
    desc: "모든 유닛 공격력 +8%, 공격속도 +8%",
    effect: { attackMult: 0.08, attackSpeedMult: 0.08 },
  },
  {
    id: "guardian_totem",
    name: "수호 토템",
    theme: "guard",
    rarity: "epic",
    desc: "누적 적 허용치 +8",
    effect: { enemyLimitBonus: 8 },
  },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);
