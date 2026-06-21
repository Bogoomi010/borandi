// 게임 설정과 플레이어 프로필(도감/기록) 영속화.
// Tauri 웹뷰에서도 localStorage가 동작하므로 두 환경 공통으로 사용한다.

import { FINAL_STAGE } from "../data/stages";
import { FINAL_ROUND } from "../data/waves";

export interface Settings {
  master: number;       // 0~1
  sfx: number;          // 0~1
  music: number;        // 0~1
  shake: boolean;       // 피격 화면 흔들림
  highContrast: boolean;// 고대비(계열 이니셜 표시)
  showDamage: boolean;  // 적 피격 데미지 숫자 표시
  defaultSpeed: 1 | 2 | 3;
  autoPause: boolean;   // 창 비활성 시 자동 일시정지
}

const SETTINGS_KEY = "rrd_settings";
const PROFILE_KEY = "rrd_profile";

const DEFAULT_SETTINGS: Settings = {
  master: 0.8, sfx: 0.8, music: 0.5,
  shake: true, highContrast: false, showDamage: true,
  defaultSpeed: 1, autoPause: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* 저장 실패는 치명적이지 않음 */ }
}

// ---------- 프로필 (도감/전적, 런과 무관하게 누적) ----------

export interface Profile {
  seenUnits: string[];          // 한 번이라도 보유했던 유닛
  foundHiddenRecipes: string[]; // 발견한 히든 조합
  runs: number;
  clears: Record<string, number>; // difficulty -> 클리어 수
  bestRound: number;
  unlockedStage: number;        // 이전 진행 모델의 기록값. 새 게임 맵 선택은 전체 맵을 허용한다.
}

const DEFAULT_PROFILE: Profile = {
  seenUnits: [], foundHiddenRecipes: [], runs: 0, clears: {}, bestRound: 0, unlockedStage: 1,
};

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch { /* noop */ }
}

export function maxSelectableStageId(unlockedStage: number): number {
  return Math.max(1, Math.min(Math.floor(unlockedStage || 1), FINAL_STAGE));
}

export function profileMarkSeen(unitIds: string[], hiddenRecipeIds: string[]) {
  const p = loadProfile();
  let changed = false;
  for (const id of unitIds) {
    if (!p.seenUnits.includes(id)) { p.seenUnits.push(id); changed = true; }
  }
  for (const id of hiddenRecipeIds) {
    if (!p.foundHiddenRecipes.includes(id)) { p.foundHiddenRecipes.push(id); changed = true; }
  }
  if (changed) saveProfile(p);
}

export function canUnlockNextStage(
  cleared: boolean,
  round: number,
  stageId: number,
  unlockedStage: number,
  finalBossCleared: boolean,
): boolean {
  // 맵은 라운드 사이에 전환되지 않는다. 이 값은 이전 진행 모델의
  // 순차 클리어 기록으로만 남기며, 새 게임의 맵 선택을 제한하지 않는다.
  return cleared &&
    round === FINAL_ROUND &&
    finalBossCleared &&
    stageId === maxSelectableStageId(unlockedStage) &&
    maxSelectableStageId(unlockedStage) < FINAL_STAGE;
}

export function playableStageId(requestedStageId: number, unlockedStage: number): number {
  const requested = Math.max(1, Math.min(Math.floor(requestedStageId || 1), FINAL_STAGE));
  return requested;
}

export function defaultNewRunStageId(currentStageId: number, unlockedStage: number): number {
  // 새 게임에서는 전체 맵을 자유롭게 고를 수 있다. 모달 기본값은
  // 자동 추천 없이 현재/이전 선택 맵을 유지한다.
  return playableStageId(currentStageId, unlockedStage);
}

export function initialNewRunStageId(currentStageId: number, unlockedStage: number): number {
  // 전체 맵을 자유 선택하되, 모달을 열 때 임의의 다른 맵으로 이동하지 않는다.
  return playableStageId(currentStageId, unlockedStage);
}

export function profileRecordRun(
  cleared: boolean,
  difficulty: string,
  round: number,
  stageId: number,
  finalBossCleared: boolean,
): boolean {
  const p = loadProfile();
  p.runs++;
  let unlockedNext = false;
  if (cleared) p.clears[difficulty] = (p.clears[difficulty] ?? 0) + 1;
  if (round > p.bestRound) p.bestRound = round;
  if (canUnlockNextStage(cleared, round, stageId, p.unlockedStage, finalBossCleared)) {
    p.unlockedStage = stageId + 1;
    unlockedNext = true;
  }
  saveProfile(p);
  return unlockedNext;
}
