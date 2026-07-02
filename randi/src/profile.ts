import { STAGES } from "./data/stages";

export interface Profile {
  /** 해금된 맵 수 (1 = 첫 맵만) */
  unlockedStages: number;
  /** stageId:difficultyId → 최고 도달 라운드 */
  best: Record<string, number>;
  /** 클리어한 stageId:difficultyId */
  cleared: Record<string, boolean>;
  discoveredRecipes: string[];
  lastDifficulty: string;
}

const KEY = "randi.profile.v1";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      return {
        unlockedStages: Math.min(Math.max(1, p.unlockedStages ?? 1), STAGES.length),
        best: p.best ?? {},
        cleared: p.cleared ?? {},
        discoveredRecipes: p.discoveredRecipes ?? [],
        lastDifficulty: p.lastDifficulty ?? "novice",
      };
    }
  } catch { /* 무시 */ }
  return { unlockedStages: 1, best: {}, cleared: {}, discoveredRecipes: [], lastDifficulty: "novice" };
}

export function saveProfile(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 무시 */ }
}

export function recordResult(
  p: Profile, stageId: string, difficultyId: string, round: number, cleared: boolean,
): Profile {
  const key = `${stageId}:${difficultyId}`;
  const best = { ...p.best, [key]: Math.max(p.best[key] ?? 0, round) };
  const clearedMap = { ...p.cleared };
  let unlockedStages = p.unlockedStages;
  if (cleared) {
    clearedMap[key] = true;
    const idx = STAGES.findIndex((s) => s.id === stageId);
    // 현재 해금 프런티어를 클리어했을 때만 다음 맵 해금
    if (idx === p.unlockedStages - 1) {
      unlockedStages = Math.min(STAGES.length, p.unlockedStages + 1);
    }
  }
  const next: Profile = { ...p, best, cleared: clearedMap, unlockedStages };
  saveProfile(next);
  return next;
}
