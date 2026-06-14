import type { BossDef, WaveDef } from "../core/types";

export const BOSSES: BossDef[] = [
  {
    id: "crack_golem", name: "균열 골렘", round: 10, slowResist: 0.5,
    weakness: "방깎 · 보스딜",
    hint: "단단한 외피. 공허(방깎)와 강철(보스딜)이 유효하다. 감속 저항 50%.",
  },
  {
    id: "void_matriarch", name: "공허 모체", round: 20, slowResist: 0.3,
    weakness: "지속 화력 · 약화",
    hint: "체력이 높다. 피해 증폭과 꾸준한 화력이 필요하다.",
  },
  {
    id: "storm_titan", name: "폭풍 거신", round: 30, slowResist: 0.2,
    weakness: "홀딩 · 감속",
    hint: "이동이 빠르다. 감속과 홀딩 없이는 통과당한다.",
  },
  {
    id: "abyss_warden", name: "심연 감시자", round: 40, slowResist: 0.4,
    weakness: "총합 화력 · 약화 · 홀딩",
    hint: "최종 보스. 모든 축이 균형 있게 필요하다.",
  },
];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(
  BOSSES.map((b) => [b.id, b]),
);

export function bossForRound(round: number): BossDef | undefined {
  return BOSSES.find((b) => b.round === round);
}

// 1~10라운드는 샘플 데이터 팩 수치 그대로, 11~40라운드는 성장 곡선으로 생성한다.
function buildWaves(): WaveDef[] {
  const waves: WaveDef[] = [
    { round: 1, type: "normal", enemyName: "균열 짐승", count: 12, hp: 22, speed: 1.0, armor: 0, goldReward: 30 },
    { round: 2, type: "normal", enemyName: "균열 짐승", count: 14, hp: 28, speed: 1.0, armor: 0, goldReward: 34 },
    { round: 3, type: "normal", enemyName: "균열 짐승", count: 16, hp: 35, speed: 1.05, armor: 0, goldReward: 38 },
    { round: 4, type: "normal", enemyName: "균열 짐승", count: 18, hp: 44, speed: 1.05, armor: 0, goldReward: 42 },
    { round: 5, type: "normal", enemyName: "균열 짐승", count: 20, hp: 55, speed: 1.1, armor: 0, goldReward: 50 },
    { round: 6, type: "swarm", enemyName: "균열 날벌레", count: 28, hp: 38, speed: 1.25, armor: 0, goldReward: 55 },
    { round: 7, type: "armored", enemyName: "石피 거북", count: 16, hp: 85, speed: 0.9, armor: 12, goldReward: 60 },
    { round: 8, type: "normal", enemyName: "균열 짐승", count: 24, hp: 72, speed: 1.1, armor: 0, goldReward: 65 },
    { round: 9, type: "mixed", enemyName: "혼합 무리", count: 24, hp: 82, speed: 1.15, armor: 6, goldReward: 70 },
    {
      round: 10, type: "boss", enemyName: "균열 골렘", count: 1, hp: 1450, speed: 0.7, armor: 30,
      goldReward: 100, bossId: "crack_golem",
      reward: { selector: { grade: "rare", count: 1 } },
    },
  ];

  for (let r = 11; r <= 40; r++) {
    if (r === 20) {
      waves.push({
        round: r, type: "boss", enemyName: "공허 모체", count: 1,
        hp: 12000, speed: 0.65, armor: 60, goldReward: 200, bossId: "void_matriarch",
        reward: { selector: { grade: "hero", count: 1 } },
      });
      continue;
    }
    if (r === 30) {
      waves.push({
        round: r, type: "boss", enemyName: "폭풍 거신", count: 1,
        hp: 30000, speed: 0.8, armor: 80, goldReward: 400, bossId: "storm_titan",
        reward: { selector: { grade: "legend", count: 1 } },
      });
      continue;
    }
    if (r === 40) {
      waves.push({
        round: r, type: "boss", enemyName: "심연 감시자", count: 1,
        hp: 58000, speed: 0.55, armor: 120, goldReward: 600, bossId: "abyss_warden",
      });
      continue;
    }

    const baseHp = Math.round(72 * Math.pow(1.145, r - 8));
    const baseCount = 20 + Math.floor((r - 10) / 2);
    const gold = 70 + (r - 10) * 8;
    const mod = r % 10;

    if (mod === 3 || mod === 6) {
      waves.push({
        round: r, type: "swarm", enemyName: "균열 날벌레 떼",
        count: Math.round(baseCount * 1.5), hp: Math.round(baseHp * 0.55),
        speed: 1.3, armor: 0, goldReward: gold,
      });
    } else if (mod === 7) {
      waves.push({
        round: r, type: "armored", enemyName: "철갑 파수꾼",
        count: Math.round(baseCount * 0.7), hp: Math.round(baseHp * 1.35),
        speed: 0.85, armor: Math.round(15 + r * 1.2), goldReward: gold,
      });
    } else if (mod === 9 || mod === 4) {
      waves.push({
        round: r, type: "mixed", enemyName: "혼합 군단",
        count: baseCount, hp: baseHp, speed: 1.15,
        armor: Math.round(r * 0.6), goldReward: gold,
      });
    } else {
      waves.push({
        round: r, type: "normal", enemyName: "균열 짐승 무리",
        count: baseCount, hp: baseHp, speed: 1.05, armor: 0, goldReward: gold,
      });
    }
  }
  return waves;
}

export const WAVES: WaveDef[] = buildWaves();
export const FINAL_ROUND = 40;

export function waveForRound(round: number): WaveDef {
  const w = WAVES.find((x) => x.round === round);
  if (!w) throw new Error(`no wave for round ${round}`);
  return w;
}