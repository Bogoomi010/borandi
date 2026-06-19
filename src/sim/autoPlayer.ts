// 자동 플레이어: 실제 게임 코어(Game)를 그대로 사용한다.
// 간이 전투식을 별도로 만들지 않는다 (시스템 기획 결정).

import { Game } from "../core/engine";
import { analyzeRecipes } from "../core/advisor";
import { UNIT_BY_ID } from "../data/units";
import { GRADE_ORDER, type Grade } from "../core/types";
import { SUMMON_COST } from "../data/difficulty";
import { UPGRADES, upgradeCost } from "../data/upgrades";

export type Strategy = "balanced" | "aggressive" | "conservative";

export interface AutoPlayOptions {
  strategy?: Strategy;
  maxGrade?: Grade;
  maxLegendCount?: number;
}

const MAX_TICKS_PER_WAVE = 20 * 60 * 5; // 웨이브당 최대 5분(게임 시간)

function gradeRank(grade: Grade): number {
  return GRADE_ORDER.indexOf(grade);
}

function withinGradeCap(defId: string, maxGrade?: Grade): boolean {
  return maxGrade === undefined || gradeRank(UNIT_BY_ID[defId].grade) <= gradeRank(maxGrade);
}

function enforceGradeCap(game: Game, maxGrade?: Grade) {
  if (!maxGrade) return;
  const overCap = game.state.units
    .filter((u) => !withinGradeCap(u.defId, maxGrade))
    .map((u) => u.uid);
  if (overCap.length > 0) game.dispatch("sell", { unitIds: overCap });
}

function unitScore(defId: string): number {
  const d = UNIT_BY_ID[defId];
  return d.attack * d.attackSpeed * (1 + (d.bossDamageBonus ?? 0)) * (1 + (d.splashRadius ? 0.25 : 0));
}

function enforceLegendLimit(game: Game, maxLegendCount?: number) {
  if (maxLegendCount === undefined) return;
  const legends = game.state.units
    .filter((u) => UNIT_BY_ID[u.defId].grade === "legend")
    .sort((a, b) => {
      const sameA = game.state.units.filter((u) => u.defId === a.defId).length;
      const sameB = game.state.units.filter((u) => u.defId === b.defId).length;
      if (sameA !== sameB) return sameA - sameB;
      return unitScore(b.defId) - unitScore(a.defId) || a.uid - b.uid;
    });
  const sell = legends.slice(maxLegendCount).map((u) => u.uid);
  if (sell.length > 0) game.dispatch("sell", { unitIds: sell });
}

function enforceLimits(game: Game, options: AutoPlayOptions) {
  enforceGradeCap(game, options.maxGrade);
  enforceLegendLimit(game, options.maxLegendCount);
}

function claimSelectors(game: Game, options: AutoPlayOptions) {
  // 후보 중 기대 DPS가 가장 높은 유닛 선택
  while (game.state.pendingSelectors.length > 0) {
    const sel = game.state.pendingSelectors[0];
    const candidates = sel.candidateIds.filter((id) => {
      if (!withinGradeCap(id, options.maxGrade)) return false;
      if (options.maxLegendCount !== undefined && UNIT_BY_ID[id].grade === "legend") {
        const owned = game.state.units.filter((u) => UNIT_BY_ID[u.defId].grade === "legend").length;
        return owned < options.maxLegendCount;
      }
      return true;
    });
    if (candidates.length === 0) break;
    let best = candidates[0];
    let bestScore = -1;
    for (const id of candidates) {
      const d = UNIT_BY_ID[id];
      const score = d.attack * d.attackSpeed * (1 + (d.bossDamageBonus ?? 0));
      if (score > bestScore) { bestScore = score; best = id; }
    }
    const res = game.dispatch("pickSelector", { selectorId: sel.id, unitId: best });
    if (!res.ok) break; // 보유칸 가득 등
  }
}

function doCrafts(game: Game, maxCrafts: number, options: AutoPlayOptions) {
  for (let i = 0; i < maxCrafts; i++) {
    const statuses = analyzeRecipes(game.state)
      .filter((s) => {
        if (s.tier !== "ok" || s.goldShort !== 0) return false;
        if (!withinGradeCap(s.recipe.resultUnitId, options.maxGrade)) return false;
        if (options.maxLegendCount !== undefined && UNIT_BY_ID[s.recipe.resultUnitId].grade === "legend") {
          const owned = game.state.units.filter((u) => UNIT_BY_ID[u.defId].grade === "legend").length;
          return owned < options.maxLegendCount;
        }
        return true;
      });
    if (statuses.length === 0) return;
    // 결과 등급이 높은 것 우선, 같은 등급이면 현재 전투 기여도가 높은 조합 우선
    statuses.sort((a, b) => {
      const aDef = UNIT_BY_ID[a.recipe.resultUnitId];
      const bDef = UNIT_BY_ID[b.recipe.resultUnitId];
      const gradeDelta = GRADE_ORDER.indexOf(bDef.grade) - GRADE_ORDER.indexOf(aDef.grade);
      if (gradeDelta !== 0) return gradeDelta;
      if (!!a.reasonTag !== !!b.reasonTag) return a.reasonTag ? -1 : 1;
      const aOwned = game.state.units.filter((u) => u.defId === a.recipe.resultUnitId).length;
      const bOwned = game.state.units.filter((u) => u.defId === b.recipe.resultUnitId).length;
      if (aOwned !== bOwned) return aOwned - bOwned;
      return unitScore(b.recipe.resultUnitId) - unitScore(a.recipe.resultUnitId);
    });
    const res = game.dispatch("craft", { recipeId: statuses[0].recipe.id });
    if (!res.ok) return;
  }
}

function doMerges(game: Game, maxMerges: number) {
  for (let i = 0; i < maxMerges; i++) {
    const s = game.state;
    if (s.units.length < game.diff.unitCap * 0.7) return;
    // 가장 흔한 일반/희귀 그룹에서 3기 합성
    for (const grade of ["common", "rare"] as const) {
      const byFamily = new Map<string, number[]>();
      for (const u of s.units) {
        const d = UNIT_BY_ID[u.defId];
        if (d.grade !== grade || u.locked) continue;
        const arr = byFamily.get(d.family) ?? [];
        arr.push(u.uid);
        byFamily.set(d.family, arr);
      }
      let merged = false;
      for (const [, uids] of byFamily) {
        if (uids.length >= 3) {
          const res = game.dispatch("merge3", { unitIds: uids.slice(0, 3) });
          if (res.ok) { merged = true; break; }
        }
      }
      if (merged) break;
      // 계열 무관 3기
      const all = [...byFamily.values()].flat();
      if (all.length >= 3) {
        const res = game.dispatch("merge3", { unitIds: all.slice(0, 3) });
        if (res.ok) break;
      }
    }
  }
}

function doUpgrades(game: Game, strategy: Strategy) {
  const s = game.state;
  const threshold = strategy === "conservative" ? 8 : 10;
  if (s.round < threshold) return;
  // 가장 많이 보유한 계열 강화
  const famCount = new Map<string, number>();
  for (const u of s.units) {
    const f = UNIT_BY_ID[u.defId].family;
    famCount.set(f, (famCount.get(f) ?? 0) + 1);
  }
  const sorted = [...UPGRADES].sort(
    (a, b) => (famCount.get(b.family) ?? 0) - (famCount.get(a.family) ?? 0));
  for (const up of sorted.slice(0, 2)) {
    const lv = s.upgrades[up.id] ?? 0;
    if (lv >= up.maxLevel) continue;
    const cost = upgradeCost(up, lv);
    if (s.gold >= cost + 200) {
      game.dispatch("upgrade", { upgradeId: up.id });
    }
  }
}

/** 준비 행동(소환/합성/조합/업글/선택권)을 1회 수행 */
function doPrep(game: Game, options: AutoPlayOptions) {
  const s = game.state;
  const strategy = options.strategy ?? "balanced";
  enforceLimits(game, options);
  claimSelectors(game, options);
  doMerges(game, 3);
  enforceLimits(game, options);
  doCrafts(game, 4, options);
  const reserve = strategy === "aggressive" ? 0 : strategy === "conservative" ? 120 : 50;
  let guard = 0;
  while (s.gold >= SUMMON_COST + reserve && s.units.length < game.diff.unitCap - 2 && guard++ < 60) {
    if (!game.dispatch("summon").ok) break;
    enforceLimits(game, options);
  }
  doCrafts(game, 2, options);
  doUpgrades(game, strategy);
  enforceLimits(game, options);
  claimSelectors(game, options);
}

/**
 * 한 라운드를 자동으로 진행. 게임이 끝나면 true.
 * 연속 시뮬 모델: 라운드 사이 휴식 동안 준비 행동을 하고, 라운드 번호가 바뀔 때까지(=이번 라운드
 * 스폰 완료) 틱을 진행한다. 휴식은 엔진이 틱 기반으로 자동 종료하므로 startWave를 강제하지 않는다.
 */
export function playOneRound(game: Game, strategyOrOptions: Strategy | AutoPlayOptions = "balanced"): boolean {
  const options: AutoPlayOptions = typeof strategyOrOptions === "string"
    ? { strategy: strategyOrOptions }
    : strategyOrOptions;
  const s = game.state;
  const isEnded = () => game.state.phase === "ended"; // 함수 호출 → TS 좁힘 회피
  if (isEnded()) return true;
  const startRound = s.round;
  let ticks = 0;
  let prepped = false;
  while (!isEnded() && ticks++ < MAX_TICKS_PER_WAVE) {
    if (s.breakTicks > 0) {
      if (!prepped) { doPrep(game, options); prepped = true; }
    } else {
      prepped = false;
    }
    game.advanceTick();
    if (s.round !== startRound) break; // 이번 라운드 스폰 완료 → 다음 라운드 휴식 진입
  }
  return isEnded();
}

export function playFullRun(game: Game, strategyOrOptions: Strategy | AutoPlayOptions = "balanced"): void {
  let guard = 0;
  while (guard++ < 300) {
    if (playOneRound(game, strategyOrOptions)) return;
  }
}
