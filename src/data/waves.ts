import type { BossDef, WaveDef } from "../core/types";

export const FINAL_ROUND = 40;
export const BOSS_ROUNDS = [10, 20, 30, 40] as const;
export const BOSS_ROUND_LIST = [...BOSS_ROUNDS];

export const BOSSES: BossDef[] = [
  {
    id: "crack_golem", name: "균열 골렘", round: 10, slowResist: 0.5,
    weakness: "방깎 · 보스딜",
    hint: "단단한 외피. 공허(방깎)와 강철(보스딜)이 유효하다. 감속 저항 50%.",
  },
  {
    id: "void_matriarch", name: "공허 모체", round: 20, slowResist: 0.35,
    weakness: "지속 화력 · 약화",
    hint: "체력이 높다. 피해 증폭과 꾸준한 화력이 필요하다.",
  },
  {
    id: "abyss_warden", name: "심연 감시자", round: 30, slowResist: 0.35,
    weakness: "총합 화력 · 약화 · 홀딩",
    hint: "후반 보스. 모든 축이 균형 있게 필요하다.",
  },
  {
    id: "ancient_rift_lord", name: "고대 균열 군주", round: 40, slowResist: 0.45,
    weakness: "최종 화력 · 방깎 · 보스딜",
    hint: "40라운드 최종 보스. 처치하면 다음 새 게임부터 다음 맵을 선택할 수 있다.",
  },
];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(
  BOSSES.map((b) => [b.id, b]),
);

export function bossForRound(round: number): BossDef | undefined {
  return BOSSES.find((b) => b.round === round);
}

const normalNames = [
  "썩은 길목의 짐승", "잿빛 배회자", "죽은 풀 날벌레", "마녀불 무리",
  "뿌리잠식 괴수", "묘지 파수꾼", "혈시장 약탈자", "영혼과실 박쥐떼",
  "저주받은 과수원 군단", "부서진 울타리 기사", "영묘 갈림길 망령", "룬 미궁 추적자",
];

function normalWave(round: number): WaveDef {
  const pattern = (round - 1) % 4;
  const type = (["normal", "swarm", "armored", "mixed"] as const)[pattern];
  const hpBase = Math.round(19 * Math.pow(1.105, round - 1));
  const countBase = 12 + Math.floor(round * 1.35);
  const armorBase = Math.floor(round * 1.45);
  const name = normalNames[(round - 1) % normalNames.length];

  if (type === "swarm") {
    return {
      round, type, enemyName: name, count: countBase + 12,
      hp: Math.round(hpBase * 0.75), speed: 1.28, armor: Math.floor(armorBase * 0.35),
      goldReward: 30 + round * 9,
    };
  }
  if (type === "armored") {
    return {
      round, type, enemyName: name, count: countBase - 3,
      hp: Math.round(hpBase * 1.45), speed: 0.9, armor: armorBase + 10,
      goldReward: 34 + round * 10,
    };
  }
  if (type === "mixed") {
    return {
      round, type, enemyName: name, count: countBase + 4,
      hp: Math.round(hpBase * 1.15), speed: 1.1, armor: Math.floor(armorBase * 0.75),
      goldReward: 36 + round * 10,
    };
  }
  return {
    round, type, enemyName: name, count: countBase,
    hp: hpBase, speed: 1.0, armor: Math.floor(armorBase * 0.45),
    goldReward: 28 + round * 9,
  };
}

function bossWave(boss: BossDef): WaveDef {
  const spec: Record<string, Omit<WaveDef, "round" | "type" | "enemyName" | "count" | "bossId">> = {
    crack_golem: {
      hp: 2600, speed: 0.72, armor: 30, goldReward: 180,
      reward: { selector: { grade: "rare", count: 1 } },
    },
    void_matriarch: {
      hp: 8600, speed: 0.66, armor: 62, goldReward: 360,
      reward: { selector: { grade: "hero", count: 1 } },
    },
    abyss_warden: {
      hp: 21000, speed: 0.6, armor: 92, goldReward: 620,
      reward: { selector: { grade: "hero", count: 1 } },
    },
    ancient_rift_lord: {
      hp: 44000, speed: 0.56, armor: 125, goldReward: 1200,
    },
  };
  return {
    round: boss.round, type: "boss", enemyName: boss.name, count: 1, bossId: boss.id,
    ...spec[boss.id],
  };
}

function buildWaves(): WaveDef[] {
  const bosses = new Map(BOSSES.map((b) => [b.round, b]));
  const waves: WaveDef[] = [];
  for (let round = 1; round <= FINAL_ROUND; round++) {
    const boss = bosses.get(round);
    waves.push(boss ? bossWave(boss) : normalWave(round));
  }
  return waves;
}

export const WAVES: WaveDef[] = buildWaves();

export function waveForRound(round: number): WaveDef {
  const w = WAVES.find((x) => x.round === round);
  if (!w) throw new Error(`no wave for round ${round}`);
  return w;
}
