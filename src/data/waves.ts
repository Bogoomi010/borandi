import type { BossDef, WaveDef } from "../core/types";
import { BOSS_ROUNDS, FINAL_STAGE } from "./stages";

export const BOSSES: BossDef[] = [
  {
    id: "crack_golem", name: "균열 골렘", round: 5, slowResist: 0.5,
    weakness: "방깎 · 보스딜",
    hint: "단단한 외피. 공허(방깎)와 강철(보스딜)이 유효하다. 감속 저항 50%.",
  },
  {
    id: "void_matriarch", name: "공허 모체", round: 10, slowResist: 0.3,
    weakness: "지속 화력 · 약화",
    hint: "체력이 높다. 피해 증폭과 꾸준한 화력이 필요하다.",
  },
  {
    id: "abyss_warden", name: "심연 감시자", round: 15, slowResist: 0.35,
    weakness: "총합 화력 · 약화 · 홀딩",
    hint: "최종 보스. 모든 축이 균형 있게 필요하다.",
  },
];

export const BOSS_ROUND_LIST = [...BOSS_ROUNDS];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(
  BOSSES.map((b) => [b.id, b]),
);

export function bossForRound(round: number): BossDef | undefined {
  return BOSSES.find((b) => b.round === round);
}

function buildWaves(): WaveDef[] {
  return [
    { round: 1, type: "normal", enemyName: "썩은 길목의 짐승", count: 12, hp: 20, speed: 1.0, armor: 0, goldReward: 35 },
    { round: 2, type: "normal", enemyName: "잿빛 배회자", count: 14, hp: 27, speed: 1.0, armor: 0, goldReward: 40 },
    { round: 3, type: "swarm", enemyName: "죽은 풀 날벌레", count: 24, hp: 24, speed: 1.25, armor: 0, goldReward: 48 },
    { round: 4, type: "mixed", enemyName: "마녀불 무리", count: 20, hp: 45, speed: 1.08, armor: 4, goldReward: 58 },
    {
      round: 5, type: "boss", enemyName: "균열 골렘", count: 1, hp: 980, speed: 0.72, armor: 24,
      goldReward: 100, bossId: "crack_golem",
      reward: { selector: { grade: "rare", count: 1 } },
    },
    { round: 6, type: "normal", enemyName: "뿌리잠식 괴수", count: 24, hp: 70, speed: 1.05, armor: 6, goldReward: 72 },
    { round: 7, type: "armored", enemyName: "묘지 파수꾼", count: 16, hp: 125, speed: 0.88, armor: 18, goldReward: 84 },
    { round: 8, type: "mixed", enemyName: "혈시장 약탈자", count: 26, hp: 105, speed: 1.12, armor: 8, goldReward: 98 },
    { round: 9, type: "swarm", enemyName: "영혼과실 박쥐떼", count: 34, hp: 78, speed: 1.32, armor: 0, goldReward: 112 },
    {
      round: 10, type: "boss", enemyName: "공허 모체", count: 1,
      hp: 5200, speed: 0.66, armor: 50, goldReward: 190, bossId: "void_matriarch",
      reward: { selector: { grade: "hero", count: 1 } },
    },
    { round: 11, type: "mixed", enemyName: "저주받은 과수원 군단", count: 30, hp: 160, speed: 1.14, armor: 12, goldReward: 130 },
    { round: 12, type: "armored", enemyName: "부서진 울타리 기사", count: 20, hp: 240, speed: 0.9, armor: 36, goldReward: 150 },
    { round: 13, type: "swarm", enemyName: "영묘 갈림길 망령", count: 40, hp: 128, speed: 1.35, armor: 10, goldReward: 170 },
    { round: 14, type: "mixed", enemyName: "룬 미궁 추적자", count: 32, hp: 260, speed: 1.18, armor: 22, goldReward: 210 },
    {
      round: 15, type: "boss", enemyName: "심연 감시자", count: 1,
      hp: 16000, speed: 0.58, armor: 95, goldReward: 500, bossId: "abyss_warden",
    },
  ];
}

export const WAVES: WaveDef[] = buildWaves();
export const FINAL_ROUND = FINAL_STAGE;

export function waveForRound(round: number): WaveDef {
  const w = WAVES.find((x) => x.round === round);
  if (!w) throw new Error(`no wave for round ${round}`);
  return w;
}
