import type { UnitDef } from "../core/types";

// 오리지널 "차원 균열" 세계관 유닛. 에셋 없이 도형+색으로 표현한다.
// 등급 기대 DPS 가이드: 일반 ~13, 희귀 ~29, 영웅 ~65, 전설 ~270, 히든 ~420

export const UNITS: UnitDef[] = [
  // ===== 일반 (common) =====
  {
    id: "ember_scout", name: "잿불 정찰병", grade: "common", family: "flame",
    roles: ["waveClear"], attackType: "magic",
    attack: 12, attackSpeed: 1.2, range: 120, targeting: "first",
    splashRadius: 26, desc: "작은 스플래시로 라인을 정리한다.",
  },
  {
    id: "frost_archer", name: "서리 궁수", grade: "common", family: "frost",
    roles: ["hold"], attackType: "physical",
    attack: 9, attackSpeed: 1.0, range: 140, targeting: "first",
    slowPct: 0.15, slowDuration: 1.6, desc: "명중 시 적을 느리게 만든다.",
  },
  {
    id: "gust_gunner", name: "돌풍 사수", grade: "common", family: "storm",
    roles: ["waveClear"], attackType: "pierce",
    attack: 10, attackSpeed: 1.45, range: 120, targeting: "first",
    desc: "빠른 연사로 물량을 깎는다.",
  },
  {
    id: "gear_soldier", name: "톱니 병사", grade: "common", family: "iron",
    roles: ["bossKiller"], attackType: "physical",
    attack: 16, attackSpeed: 0.8, range: 110, targeting: "highestHp",
    bossDamageBonus: 0.3, desc: "단단한 적에게 강하다.",
  },
  {
    id: "rift_eye", name: "그림자 눈", grade: "common", family: "void",
    roles: ["debuff"], attackType: "magic",
    attack: 8, attackSpeed: 1.0, range: 130, targeting: "first",
    armorBreakPct: 0.10, desc: "적 방어를 깎는다.",
  },
  {
    id: "sprout_healer", name: "새싹 치유사", grade: "common", family: "forest",
    roles: ["economy"], attackType: "magic",
    attack: 7, attackSpeed: 1.0, range: 120, targeting: "first",
    killGoldBonus: 1, desc: "처치 보상을 늘린다.",
  },

  // ===== 희귀 (rare) =====
  {
    id: "flame_mage", name: "화염술사", grade: "rare", family: "flame",
    roles: ["waveClear"], attackType: "magic",
    attack: 26, attackSpeed: 1.05, range: 150, targeting: "first",
    splashRadius: 40, desc: "넓은 스플래시 라인딜.",
  },
  {
    id: "ice_shaman", name: "빙결 주술사", grade: "rare", family: "frost",
    roles: ["hold"], attackType: "magic",
    attack: 17, attackSpeed: 0.9, range: 150, targeting: "first",
    slowPct: 0.25, slowDuration: 2.0, stunChance: 0.05, stunDuration: 0.6,
    desc: "강한 감속과 낮은 확률의 빙결.",
  },
  {
    id: "storm_lancer", name: "폭풍 창병", grade: "rare", family: "storm",
    roles: ["waveClear", "finisher"], attackType: "pierce",
    attack: 20, attackSpeed: 1.6, range: 130, targeting: "lowestHp",
    executePct: 0.05, desc: "빈사 적을 마무리한다.",
  },
  {
    id: "steam_knight", name: "증기 기사", grade: "rare", family: "iron",
    roles: ["bossKiller"], attackType: "physical",
    attack: 38, attackSpeed: 0.75, range: 120, targeting: "highestHp",
    bossDamageBonus: 0.45, desc: "보스전의 핵심 화력.",
  },
  {
    id: "void_priest", name: "공허 사제", grade: "rare", family: "void",
    roles: ["debuff"], attackType: "magic",
    attack: 16, attackSpeed: 1.0, range: 145, targeting: "highestHp",
    armorBreakPct: 0.10, damageAmpPct: 0.04, desc: "방어 감소와 피해 증폭.",
  },
  {
    id: "grove_druid", name: "생장 드루이드", grade: "rare", family: "forest",
    roles: ["economy"], attackType: "magic",
    attack: 15, attackSpeed: 1.0, range: 130, targeting: "first",
    killGoldBonus: 2, desc: "경제를 키우는 드루이드.",
  },

  // ===== 영웅 (hero) =====
  {
    id: "phoenix_archmage", name: "불사조 대마법사", grade: "hero", family: "flame",
    roles: ["waveClear"], attackType: "magic",
    attack: 58, attackSpeed: 1.1, range: 160, targeting: "first",
    splashRadius: 52, desc: "화염 폭발로 웨이브를 태운다.",
    skills: [{
      id: "sk_phoenix_blast", name: "화염 폭심", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.15 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 1.6, radius: 70 }],
      desc: "대상 주변을 광역 폭발로 태운다 (15%).",
    }],
  },
  {
    id: "glacier_warden", name: "빙하 수호자", grade: "hero", family: "frost",
    roles: ["hold"], attackType: "magic",
    attack: 40, attackSpeed: 0.9, range: 150, targeting: "first",
    slowPct: 0.3, slowDuration: 2.5, stunChance: 0.08, stunDuration: 0.8,
    desc: "전선을 얼려 붙인다.",
    skills: [{
      id: "sk_glacier_zero", name: "절대영도", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.16 }, target: "currentTarget",
      effects: [{ type: "stun", duration: 1.0 }, { type: "slow", pct: 0.45, duration: 2.5 }],
      desc: "대상을 빙결시키고 강하게 둔화시킨다 (16%).",
    }],
  },
  {
    id: "tempest_blademaster", name: "폭풍 검무가", grade: "hero", family: "storm",
    roles: ["waveClear", "finisher"], attackType: "pierce",
    attack: 30, attackSpeed: 2.2, range: 130, targeting: "lowestHp",
    executePct: 0.08, desc: "검무로 적을 휩쓴다.",
    skills: [{
      id: "sk_tempest_reap", name: "처형 검무", icon: "damage",
      trigger: { kind: "onAttack", chance: 0.18 }, target: "lowestHpEnemy",
      effects: [{ type: "execute", pct: 0.15 }, { type: "burst", power: 1.2 }],
      desc: "빈사의 적을 즉시 처형한다 (18%).",
    }],
  },
  {
    id: "fortress_breaker", name: "요새 파쇄자", grade: "hero", family: "iron",
    roles: ["bossKiller"], attackType: "physical",
    attack: 95, attackSpeed: 0.7, range: 120, targeting: "highestHp",
    bossDamageBonus: 0.6, desc: "보스를 부수기 위해 태어났다.",
    skills: [{
      id: "sk_fortress_smash", name: "포위 강타", icon: "damage",
      trigger: { kind: "onAttack", chance: 0.14, internalCd: 1.5 }, target: "highestHpEnemy",
      effects: [{ type: "burst", power: 2.2, bossBonus: 0.3 }, { type: "armorBreak" }],
      desc: "최대체력 적에게 강타 + 방어 분쇄 (14%).",
    }],
  },
  {
    id: "abyss_oracle", name: "심연 예언자", grade: "hero", family: "void",
    roles: ["debuff"], attackType: "magic",
    attack: 38, attackSpeed: 1.0, range: 155, targeting: "highestHp",
    armorBreakPct: 0.12, damageAmpPct: 0.06, desc: "적의 종말을 예언한다.",
    skills: [{
      id: "sk_abyss_rift", name: "차원 균열", icon: "passive",
      trigger: { kind: "onAttack", chance: 0.15 }, target: "currentTarget",
      effects: [{ type: "armorBreak" }, { type: "amp" }, { type: "burst", power: 1.0 }],
      desc: "방어를 깎고 받는 피해를 증폭시킨다 (15%).",
    }],
  },
  {
    id: "world_tree_sage", name: "세계수 현자", grade: "hero", family: "forest",
    roles: ["economy", "waveClear"], attackType: "magic",
    attack: 34, attackSpeed: 1.0, range: 140, targeting: "first",
    killGoldBonus: 4, desc: "세계수의 축복으로 부를 부른다.",
    skills: [{
      id: "sk_worldtree_burst", name: "생명 폭발", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.14 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 1.4, radius: 60 }],
      desc: "대상 주변에 생명력 폭발을 일으킨다 (14%).",
    }],
  },

  // ===== 전설 (legend) =====
  {
    id: "solar_avatar", name: "태양 화신", grade: "legend", family: "flame",
    roles: ["waveClear"], attackType: "magic",
    attack: 165, attackSpeed: 1.6, range: 170, targeting: "first",
    splashRadius: 86, desc: "태양의 불꽃이 전장을 뒤덮는다.",
    skills: [{
      id: "sk_solar_nova", name: "초신성", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.18 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 2.0, radius: 100 }],
      desc: "광범위 초신성 폭발 (18%).",
    }, {
      id: "sk_solar_meteor", name: "운석 낙하", icon: "skill",
      trigger: { kind: "timer", everySeconds: 9 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 3.0, radius: 90 }, { type: "dot", perSecond: 0.5, duration: 3 }],
      desc: "9초마다 운석으로 광역 폭발 + 화상.",
    }],
  },
  {
    id: "chrono_marshal", name: "시간의 집정관", grade: "legend", family: "frost",
    roles: ["hold", "debuff"], attackType: "magic",
    attack: 127, attackSpeed: 1.3, range: 160, targeting: "first",
    slowPct: 0.42, slowDuration: 2.7, stunChance: 0.16, stunDuration: 1.0,
    desc: "시간을 늦춰 적을 묶는다.",
    skills: [{
      id: "sk_chrono_stop", name: "시간 정지", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.18 }, target: "areaAroundTarget",
      effects: [{ type: "stun", duration: 1.2, radius: 80 }, { type: "slow", pct: 0.5, duration: 2.5 }],
      desc: "주변 적의 시간을 멈춘다 (18%).",
    }, {
      id: "sk_chrono_field", name: "시간 정지장", icon: "skill",
      trigger: { kind: "timer", everySeconds: 10 }, target: "areaAroundTarget",
      effects: [{ type: "stun", duration: 1.5, radius: 110 }, { type: "slow", pct: 0.55, duration: 3 }],
      desc: "10초마다 광역 시간정지장을 펼친다.",
    }],
  },
  {
    id: "titan_slayer", name: "거신 사냥꾼", grade: "legend", family: "iron",
    roles: ["bossKiller"], attackType: "physical",
    attack: 340, attackSpeed: 0.9, range: 140, targeting: "highestHp",
    bossDamageBonus: 1.1, desc: "거신의 천적.",
    skills: [{
      id: "sk_titan_execute", name: "거신 처형", icon: "damage",
      trigger: { kind: "onAttack", chance: 0.16, internalCd: 1.2 }, target: "highestHpEnemy",
      effects: [{ type: "burst", power: 3.2, bossBonus: 0.4 }, { type: "armorBreak" }],
      desc: "최대체력 적·보스에게 막대한 강타 (16%).",
    }, {
      id: "sk_titan_quake", name: "거신 강타", icon: "damage",
      trigger: { kind: "timer", everySeconds: 8 }, target: "highestHpEnemy",
      effects: [{ type: "burst", power: 4.0, bossBonus: 0.5 }, { type: "armorBreak" }],
      desc: "8초마다 최강 적에게 결정타.",
    }],
  },
  {
    id: "ancient_world_tree", name: "고대 세계수", grade: "legend", family: "forest",
    roles: ["waveClear", "economy"], attackType: "magic",
    attack: 159, attackSpeed: 1.4, range: 165, targeting: "first",
    splashRadius: 74, killGoldBonus: 14, desc: "숲의 태초부터 자라온 거목.",
    skills: [{
      id: "sk_worldtree_wrath", name: "대지 분노", icon: "skill",
      trigger: { kind: "onAttack", chance: 0.16 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 1.8, radius: 90 }],
      desc: "대지의 분노로 주변을 강타한다 (16%).",
    }, {
      id: "sk_worldtree_grove", name: "생명의 진", icon: "passive",
      trigger: { kind: "timer", everySeconds: 10 }, target: "alliesInRadius",
      effects: [
        { type: "buffAttackSpeed", mult: 1.3, duration: 5, radius: 170 },
        { type: "buffAttack", mult: 1.2, duration: 5 },
      ],
      desc: "10초마다 주변 아군 공격력·공속 강화.",
    }],
  },

  // ===== 히든 (hidden) =====
  {
    id: "rift_singularity", name: "균열 특이점", grade: "hidden", family: "void",
    roles: ["debuff", "bossKiller"], attackType: "true",
    attack: 220, attackSpeed: 1.5, range: 180, targeting: "highestHp",
    armorBreakPct: 0.2, damageAmpPct: 0.14, desc: "모든 방어를 무시하는 특이점.",
    skills: [{
      id: "sk_singularity_collapse", name: "특이점 붕괴", icon: "passive",
      trigger: { kind: "onAttack", chance: 0.2 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 2.4, radius: 90 }, { type: "armorBreak" }, { type: "amp" }],
      desc: "공간을 붕괴시켜 광역 고정 피해 + 약화 (20%).",
    }, {
      id: "sk_singularity_implode", name: "차원 붕괴", icon: "passive",
      trigger: { kind: "timer", everySeconds: 9 }, target: "areaAroundTarget",
      effects: [
        { type: "burst", power: 4.0, radius: 100 }, { type: "armorBreak" },
        { type: "amp" }, { type: "dot", perSecond: 0.6, duration: 3 },
      ],
      desc: "9초마다 차원을 붕괴시켜 광역 말살.",
    }],
  },
  {
    id: "prism_dragon", name: "프리즘 용", grade: "hidden", family: "storm",
    roles: ["waveClear", "bossKiller"], attackType: "true",
    attack: 185, attackSpeed: 2.0, range: 170, targeting: "first",
    splashRadius: 78, desc: "여섯 빛깔 숨결을 내뿜는다.",
    skills: [{
      id: "sk_prism_barrage", name: "프리즘 폭격", icon: "damage",
      trigger: { kind: "onAttack", chance: 0.22 }, target: "areaAroundTarget",
      effects: [{ type: "burst", power: 2.2, radius: 90 }, { type: "execute", pct: 0.12 }],
      desc: "여섯 빛깔 폭격 + 빈사 처형 (22%).",
    }, {
      id: "sk_prism_storm", name: "프리즘 폭풍", icon: "skill",
      trigger: { kind: "timer", everySeconds: 8 }, target: "currentTarget",
      effects: [{ type: "chain", power: 2.0, maxJumps: 6, falloff: 0.75 }],
      desc: "8초마다 여섯 갈래 번개가 연쇄한다.",
    }],
  },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(
  UNITS.map((u) => [u.id, u]),
);

export function unitsOfGrade(grade: UnitDef["grade"]): UnitDef[] {
  return UNITS.filter((u) => u.grade === grade);
}
