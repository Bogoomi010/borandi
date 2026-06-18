import type { MissionDef } from "../core/types";

export const MISSIONS: MissionDef[] = [
  {
    id: "mission_all_families", name: "균형 잡힌 시작", visibility: "visible",
    expireRound: 8,
    condition: { type: "collectFamilies", grade: "common", countEach: 1 },
    reward: { gold: 120 },
    desc: "일반 6계열을 1기씩 보유",
  },
  {
    id: "mission_first_recipe", name: "첫 조합", visibility: "visible",
    expireRound: 10,
    condition: { type: "craftCount", count: 1 },
    reward: { gold: 80, selector: { grade: "common", count: 1 } },
    desc: "지정 조합 1회 성공",
  },
  {
    id: "mission_hold_line", name: "차가운 전선", visibility: "visible",
    expireRound: 10,
    condition: { type: "ownFamily", family: "frost", count: 2 },
    reward: { bossSlowResistReduction: 0.1 },
    desc: "서리 유닛 2기 이상 보유",
  },
  {
    id: "mission_boss_ready", name: "보스 사냥 준비", visibility: "visible",
    expireRound: 10,
    condition: { type: "ownRole", role: "bossKiller", count: 2 },
    reward: { bossKillBonusGold: { round: 5, gold: 50 } },
    desc: "보스딜 역할 유닛 2기 보유",
  },
  {
    id: "mission_no_leak", name: "새지 않는 전선", visibility: "visible",
    expireRound: 5,
    condition: { type: "noLeakUntil", round: 5 },
    reward: { gold: 100 },
    desc: "1~5라운드 라이프 손실 0",
  },
  {
    id: "mission_low_luck", name: "안 좋은 패도 굴린다", visibility: "visible",
    expireRound: 12,
    condition: { type: "pityTriggered", count: 1 },
    reward: { selector: { grade: "rare", count: 1 } },
    desc: "연속 일반 보정 1회 발동",
  },
  {
    id: "mission_merge_master", name: "합성의 달인", visibility: "visible",
    expireRound: 13,
    condition: { type: "merge3Count", count: 3 },
    reward: { gold: 150 },
    desc: "3합성 3회 수행",
  },
  {
    id: "mission_hero_road", name: "영웅의 길", visibility: "visible",
    expireRound: 14,
    condition: { type: "ownGrade", grade: "hero", count: 1 },
    reward: { gold: 200 },
    desc: "영웅 등급 1기 보유",
  },
  {
    id: "mission_upgrade_core", name: "강화 노선", visibility: "visible",
    expireRound: 15,
    condition: { type: "upgradeTotal", level: 5 },
    reward: { selector: { grade: "hero", count: 1 } },
    desc: "업그레이드 합계 5레벨 달성",
  },
  {
    id: "mission_war_chest", name: "전쟁 자금", visibility: "visible",
    expireRound: 15,
    condition: { type: "goldAtOnce", gold: 600 },
    reward: { selector: { grade: "hero", count: 1 } },
    desc: "골드 600 이상 한 번에 보유",
  },
  // ===== 히든 미션 =====
  {
    id: "mission_speed_killer", name: "???", visibility: "hidden",
    condition: { type: "bossKillUnderSec", round: 10, seconds: 25 },
    reward: { selector: { grade: "legend", count: 1 } },
    desc: "(히든) 10스테이지 보스를 25초 안에 처치",
  },
  {
    id: "mission_full_bloom", name: "???", visibility: "hidden",
    expireRound: 15,
    condition: { type: "collectFamilies", grade: "rare", countEach: 1 },
    reward: { gold: 400 },
    desc: "(히든) 희귀 6계열을 1기씩 보유",
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);
