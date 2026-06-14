// 조합도우미: 현재 보유 유닛 기준으로 제작 가능/부족 조합과 역할 충족도를 계산한다.
// 순수 함수 모듈 — 엔진 상태를 변경하지 않는다.

import type { GameState, RecipeDef, Role } from "./types";
import { UNIT_BY_ID } from "../data/units";
import { RECIPES } from "../data/recipes";
import { bossForRound, waveForRound, FINAL_ROUND } from "../data/waves";

export interface RecipeStatus {
  recipe: RecipeDef;
  resultName: string;
  /** ok: 제작 가능 / near: 1개 부족 / far: 2개 이상 부족 */
  tier: "ok" | "near" | "far";
  missing: { label: string; count: number }[];
  /** 잠금 유닛을 풀어야 제작 가능한가 */
  needsLocked: boolean;
  goldShort: number;
  reasonTag: string | null;
}

function countOwned(state: GameState, locked: boolean | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const u of state.units) {
    if (locked !== null && u.locked !== locked) continue;
    map.set(u.defId, (map.get(u.defId) ?? 0) + 1);
  }
  return map;
}

function missingFor(recipe: RecipeDef, owned: Map<string, number>): { label: string; count: number }[] {
  const missing: { label: string; count: number }[] = [];
  const pool = new Map(owned);
  for (const ing of recipe.ingredients) {
    let need = ing.count;
    if (ing.unitId) {
      const have = pool.get(ing.unitId) ?? 0;
      const used = Math.min(have, need);
      pool.set(ing.unitId, have - used);
      need -= used;
      if (need > 0) missing.push({ label: UNIT_BY_ID[ing.unitId].name, count: need });
    } else {
      // grade/family 조건 재료
      for (const [defId, have] of pool) {
        if (need === 0) break;
        const d = UNIT_BY_ID[defId];
        if (ing.grade && d.grade !== ing.grade) continue;
        if (ing.family && d.family !== ing.family) continue;
        const used = Math.min(have, need);
        pool.set(defId, have - used);
        need -= used;
      }
      if (need > 0) missing.push({ label: `${ing.grade ?? ""}${ing.family ?? ""}`, count: need });
    }
  }
  return missing;
}

/** 현재 부족한 역할 계산 (다음 보스/웨이브 기준) */
export function roleNeeds(state: GameState): Role[] {
  const counts: Record<Role, number> = {
    waveClear: 0, bossKiller: 0, debuff: 0, hold: 0, finisher: 0, economy: 0,
  };
  for (const u of state.units) {
    for (const r of UNIT_BY_ID[u.defId].roles) counts[r]++;
  }
  const needs: Role[] = [];
  if (counts.waveClear < 3) needs.push("waveClear");
  // 다음 보스가 가까우면 보스딜/약화 요구
  const nextBossRound = [10, 20, 30, 40].find((r) => r >= state.round);
  if (nextBossRound !== undefined && nextBossRound - state.round <= 3) {
    if (counts.bossKiller < 2) needs.push("bossKiller");
    if (counts.debuff < 1) needs.push("debuff");
    const boss = bossForRound(nextBossRound);
    if (boss && boss.slowResist <= 0.3 && counts.hold < 1) needs.push("hold");
  }
  return needs;
}

export function analyzeRecipes(state: GameState): RecipeStatus[] {
  const ownedFree = countOwned(state, false); // 잠금 제외
  const ownedAll = countOwned(state, null);
  const needs = roleNeeds(state);
  const out: RecipeStatus[] = [];

  for (const recipe of RECIPES) {
    // 히든 조합은 발견 전에는 표시하지 않음
    if (recipe.visibility === "hidden" && !state.discoveredRecipeIds.includes(recipe.id)) {
      continue;
    }
    const missFree = missingFor(recipe, ownedFree);
    const missAll = missingFor(recipe, ownedAll);
    const missingCountFree = missFree.reduce((a, m) => a + m.count, 0);
    const missingCountAll = missAll.reduce((a, m) => a + m.count, 0);
    const needsLocked = missingCountAll < missingCountFree;
    const result = UNIT_BY_ID[recipe.resultUnitId];

    let tier: RecipeStatus["tier"];
    if (missingCountFree === 0) tier = "ok";
    else if (missingCountFree === 1) tier = "near";
    else tier = "far";

    let reasonTag: string | null = null;
    for (const need of needs) {
      if (result.roles.includes(need)) {
        reasonTag =
          need === "bossKiller" ? "보스딜 보완" :
          need === "waveClear" ? "라인 안정" :
          need === "debuff" ? "약화 보완" :
          need === "hold" ? "홀딩 보완" : null;
        break;
      }
    }

    out.push({
      recipe,
      resultName: result.name,
      tier,
      missing: missFree,
      needsLocked,
      goldShort: Math.max(0, recipe.cost.gold - state.gold),
      reasonTag,
    });
  }

  // 정렬: 제작 가능 > 역할 보완 > 1개 부족 > 나머지
  const tierRank = { ok: 0, near: 1, far: 2 } as const;
  out.sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (!!a.reasonTag !== !!b.reasonTag) return a.reasonTag ? -1 : 1;
    return a.recipe.id.localeCompare(b.recipe.id);
  });
  return out;
}

/** 다음 보스 정보와 위험도 평가 */
export function bossOutlook(state: GameState): {
  round: number; name: string; weakness: string; hint: string;
  roundsLeft: number; risk: "ok" | "warn" | "bad"; riskText: string;
} | null {
  const nextBossRound = [10, 20, 30, 40].find((r) => r >= state.round);
  if (nextBossRound === undefined) return null;
  const boss = bossForRound(nextBossRound);
  if (!boss) return null;
  const wave = waveForRound(nextBossRound);

  // 대략적 보스 DPS 추정 (advisor 전용 — 전투 판정과 무관)
  let estDps = 0;
  for (const u of state.units) {
    const d = UNIT_BY_ID[u.defId];
    let dps = d.attack * d.attackSpeed;
    if (d.bossDamageBonus) dps *= 1 + d.bossDamageBonus;
    estDps += dps;
  }
  const windowSec = 45;
  const score = (estDps * windowSec) / (wave.hp * 1.3); // 방어 감안 여유율
  const risk: "ok" | "warn" | "bad" = score >= 1 ? "ok" : score >= 0.7 ? "warn" : "bad";
  const riskText = score >= 1 ? "안정" : score >= 0.7 ? "대응 가능" : score >= 0.4 ? "위험" : "심각하게 부족";

  return {
    round: nextBossRound,
    name: boss.name,
    weakness: boss.weakness,
    hint: boss.hint,
    roundsLeft: nextBossRound - state.round,
    risk, riskText,
  };
}

export { FINAL_ROUND };
