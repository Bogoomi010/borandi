// 게임 코어 엔진. 렌더링/저장과 분리된 결정론적 판정 모듈.
// 같은 dataVersion + seed + difficulty + inputHistory => 같은 결과.

import { Rng } from "./rng";
import {
  SLOTS, UNIT_MIN_DIST, pathLengthForStage,
  clampToField, posAtDist,
} from "./path";
import type {
  EnemyState, GameInput, GameState, Grade, MissionState, OwnedUnit,
  PendingSelector, Phase, ResultSummary, RewardDef, UnitDef,
  DifficultyId,
} from "./types";
import { GRADE_ORDER } from "./types";
import { UNIT_BY_ID, unitsOfGrade } from "../data/units";
import { RECIPE_BY_ID } from "../data/recipes";
import { MISSIONS, MISSION_BY_ID } from "../data/missions";
import { FINAL_ROUND, bossForRound, waveForRound } from "../data/waves";
import { stageById } from "../data/stages";
import { UPGRADE_BY_ID, UPGRADES, upgradeCost } from "../data/upgrades";
import {
  DIFFICULTY_BY_ID, HERO_PITY_ROUND, PITY_TABLE, PITY_THRESHOLD,
  SELL_REFUND, SUMMON_COST, SUMMON_TABLE,
} from "../data/difficulty";
import { DATA_VERSION } from "../data/version";

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
const ENEMY_BASE_SPEED = 60; // px/s, speed 1.0 기준
const SPAWN_INTERVAL = 0.8;
const SPAWN_INTERVAL_SWARM = 0.5;
const SLOW_CAP_NORMAL = 0.7;
const SLOW_CAP_BOSS = 0.4;

// ===== RTS 유닛 컨트롤 파라미터 =====
const UNIT_MOVE_SPEED = 130;   // px/s
const DETECT_BONUS = 70;       // 자동 탐지(시야) = 공격 사거리 + 보너스
const LEASH_RANGE = 220;       // 앵커에서 이 거리를 넘으면 추적 포기·복귀
const ARRIVE_EPS = 10;         // 목적지 도착 판정(px)

// ===== 라운드/패배 파라미터 =====
/** 루프를 도는 적이 다음 라운드 시작 시점에 이 수 이상이면 패배 */
export const LOSE_THRESHOLD = 80;
/** 스폰 완료 후 다음 라운드까지 최대 대기(틱). 20틱=1초 → 60초 */
const ROUND_BREAK_MAX = 1200;
/** 적을 전멸시킨 시점부터 다음 라운드까지 대기(틱) → 10초 */
const ROUND_BREAK_CLEARED = 200;
/** 1라운드 시작 전 대기(틱) → 10초 */
const INITIAL_BREAK_TICKS = 200;

export interface ActionResult { ok: boolean; reason?: string; }

const ok: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export class Game {
  state: GameState;
  private rng: Rng;
  private spawnTimer = 0;
  /** 외부(UI) 알림 콜백 */
  onEvent: ((kind: string, text: string) => void) | null = null;

  constructor(seed: string, difficulty: DifficultyId, stageId = 1) {
    const diff = DIFFICULTY_BY_ID[difficulty];
    const stage = stageById(stageId);
    this.rng = new Rng(`${DATA_VERSION}:${seed}:${difficulty}:${stage.id}`);
    this.state = {
      dataVersion: DATA_VERSION,
      seed, difficulty, stageId: stage.id,
      tick: 0, time: 0,
      round: 1, phase: "wave", breakTicks: INITIAL_BREAK_TICKS,
      life: diff.startLife, gold: diff.startGold,
      units: [], enemies: [],
      missions: MISSIONS.map((m): MissionState => ({ defId: m.id, status: "active" })),
      discoveredRecipeIds: [],
      upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
      pendingSelectors: [],
      summonStats: { rolls: 0, consecutiveCommon: 0, pityTriggered: 0 },
      craftCount: 0, merge3Count: 0,
      leakedRounds: [], waveLeaks: 0,
      bossSlowResistReduction: 0, bossKillBonus: null,
      heroPityGiven: false,
      bossSpawnTime: 0, bossKillSeconds: {}, bossFailedRounds: [],
      cleared: false,
      log: [], inputHistory: [],
      nextUid: 1, nextEid: 1,
      waveSpawned: 0, waveKilled: 0,
      speed: 1,
    };
    this.log("system", `시드 ${seed} · 난이도 ${diff.name} · 맵 ${stage.name}로 시작`);
  }

  get diff() { return DIFFICULTY_BY_ID[this.state.difficulty]; }

  private log(kind: GameState["log"][number]["kind"], text: string) {
    this.state.log.push({ round: this.state.round, kind, text });
    if (this.state.log.length > 400) this.state.log.splice(0, this.state.log.length - 400);
    this.onEvent?.(kind, text);
  }

  // ===================== 입력 =====================

  dispatch(type: GameInput["type"], payload?: Record<string, unknown>): ActionResult {
    const input: GameInput = { tick: this.state.tick, type, payload };
    const res = this.execute(input);
    if (res.ok) this.state.inputHistory.push(input);
    return res;
  }

  /** 리플레이용: 기록된 입력을 그대로 실행 (history에 다시 쌓지 않음) */
  executeRecorded(input: GameInput): ActionResult {
    return this.execute(input);
  }

  private execute(input: GameInput): ActionResult {
    const p = input.payload ?? {};
    switch (input.type) {
      case "summon": return this.summon();
      case "merge3": return this.merge3(p.unitIds as number[]);
      case "craft": return this.craft(p.recipeId as string);
      case "sell": return this.sell(p.unitIds as number[]);
      case "upgrade": return this.upgrade(p.upgradeId as string);
      case "toggleLock": return this.toggleLock(p.unitId as number);
      case "startWave": return this.skipBreak();   // 라운드 사이 휴식 즉시 종료
      case "nextRound": return this.skipBreak();
      case "cmdMove": return this.cmdMoveLike("move", p.unitIds as number[], p.x as number, p.y as number);
      case "cmdAttackMove": return this.cmdMoveLike("attackMove", p.unitIds as number[], p.x as number, p.y as number);
      case "cmdAttack": return this.cmdAttack(p.unitIds as number[], p.targetEid as number);
      case "cmdStop": return this.cmdStop(p.unitIds as number[]);
      case "devSpawn": { // DEV전용: 보유칸 무시하고 즉시 생성
        if (this.state.phase === "ended") return fail("게임이 끝났습니다.");
        if (!UNIT_BY_ID[p.defId as string]) return fail("존재하지 않는 유닛입니다.");
        return this.addUnit(p.defId as string, "DEV 생성") ? ok : fail("생성 실패");
      }
      case "pickSelector": return this.pickSelector(p.selectorId as string, p.unitId as string);
      case "setSpeed": {
        this.state.speed = p.speed as 1 | 2 | 3;
        return ok;
      }
    }
  }

  private requirePhase(phases: Phase[], what: string): ActionResult {
    if (!phases.includes(this.state.phase)) {
      if (this.state.phase === "wave") {
        return fail(`전투 중에는 ${what}을(를) 할 수 없습니다. 다음 준비 단계에서 가능합니다.`);
      }
      return fail(`지금은 ${what}을(를) 할 수 없습니다.`);
    }
    return ok;
  }

  // ===================== 소환 =====================

  private rollGrade(): Grade {
    const s = this.state.summonStats;
    let table = SUMMON_TABLE;
    let pity = false;
    if (s.consecutiveCommon >= PITY_THRESHOLD) {
      table = PITY_TABLE;
      pity = true;
    }
    const grade = this.rng.weighted(table as Record<Grade, number>);
    s.rolls++;
    if (grade === "common") s.consecutiveCommon++;
    else s.consecutiveCommon = 0;
    if (pity) {
      s.pityTriggered++;
      this.log("system", "연속 일반 보정 발동! 희귀 이상 확정");
    }
    return grade;
  }

  private addUnit(defId: string, how: string): OwnedUnit | null {
    // 기본 배치: 비어 있는 기본 앵커(SLOTS) 중 첫 자리. 이후 플레이어가 자유롭게 옮긴다.
    let ax = SLOTS[0].x, ay = SLOTS[0].y;
    for (const s of SLOTS) {
      if (!this.state.units.some((u) => Math.hypot(u.x - s.x, u.y - s.y) < UNIT_MIN_DIST)) {
        ax = s.x; ay = s.y; break;
      }
    }
    const uid = this.state.nextUid++;
    const { x, y } = this.resolvePlacement(uid, ax, ay);
    const unit: OwnedUnit = {
      uid, defId, locked: false, x, y,
      acquiredRound: this.state.round,
      totalDamage: 0, cooldown: 0,
      state: "idle", order: { kind: "none" }, anchorX: x, anchorY: y,
    };
    this.state.units.push(unit);
    const def = UNIT_BY_ID[defId];
    this.log("summon", `${how}: ${def.name} 획득`);
    return unit;
  }

  /** 좌표를 사각형 내부 + 다른 유닛과 최소 간격으로 보정 (순수·결정론적) */
  private resolvePlacement(selfUid: number, x: number, y: number): { x: number; y: number } {
    ({ x, y } = clampToField(x, y));
    const others = this.state.units
      .filter((o) => o.uid !== selfUid)
      .sort((a, b) => a.uid - b.uid); // 정렬 고정 → 결정론
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const o of others) {
        let dx = x - o.x, dy = y - o.y;
        let d = Math.hypot(dx, dy);
        if (d < UNIT_MIN_DIST) {
          if (d < 1e-4) { dx = (selfUid % 7) - 3; dy = (selfUid % 5) - 2; d = Math.hypot(dx, dy) || 1; }
          const push = UNIT_MIN_DIST - d;
          x += (dx / d) * push; y += (dy / d) * push;
          moved = true;
        }
      }
      ({ x, y } = clampToField(x, y));
      if (!moved) break;
    }
    return { x, y };
  }

  /** 선택 유닛들을 대상 좌표 주변 대형으로 배치할 개별 목표 좌표 (결정론적) */
  private formationTargets(uids: number[], cx: number, cy: number): Array<{ x: number; y: number }> {
    const n = uids.length;
    if (n <= 1) return [{ x: cx, y: cy }];
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const sp = UNIT_MIN_DIST + 6;
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push({ x: cx + (c - (cols - 1) / 2) * sp, y: cy + (r - (rows - 1) / 2) * sp });
    }
    return out;
  }

  private selectedUnits(unitIds: number[]): OwnedUnit[] {
    // uid 정렬 고정 → 대형 배치·실행 순서 결정론
    return this.state.units
      .filter((u) => unitIds.includes(u.uid))
      .sort((a, b) => a.uid - b.uid);
  }

  /** 이동/공격이동: 대상 좌표 주변 대형으로 명령. 전투 외 단계에서는 즉시 스냅. */
  private cmdMoveLike(kind: "move" | "attackMove", unitIds: number[], x: number, y: number): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "이동 명령");
    if (!g.ok) return g;
    const units = this.selectedUnits(unitIds);
    if (units.length === 0) return fail("선택된 유닛이 없습니다.");
    const targets = this.formationTargets(units.map((u) => u.uid), x, y);
    units.forEach((u, i) => {
      const t = targets[i];
      u.anchorX = t.x; u.anchorY = t.y;
      u.order = kind === "move"
        ? { kind: "move", x: t.x, y: t.y, cx: x, cy: y }
        : { kind: "attackMove", x: t.x, y: t.y, cx: x, cy: y };
      u.state = "moving";
    });
    return ok;
  }

  /** 지정 공격: 해당 적을 추적·공격 */
  private cmdAttack(unitIds: number[], targetEid: number): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "공격 명령");
    if (!g.ok) return g;
    const units = this.selectedUnits(unitIds);
    if (units.length === 0) return fail("선택된 유닛이 없습니다.");
    for (const u of units) {
      u.anchorX = u.x; u.anchorY = u.y;
      u.order = { kind: "attack", targetEid };
      u.state = "chasing";
    }
    return ok;
  }

  /** 정지(Hold): 현재 위치 대기, 사거리 내 적만 자동 공격 */
  private cmdStop(unitIds: number[]): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "정지 명령");
    if (!g.ok) return g;
    const units = this.selectedUnits(unitIds);
    if (units.length === 0) return fail("선택된 유닛이 없습니다.");
    for (const u of units) {
      u.anchorX = u.x; u.anchorY = u.y;
      u.order = { kind: "hold" };
      u.state = "hold";
    }
    return ok;
  }

  private summon(): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "소환");
    if (!g.ok) return g;
    if (this.state.gold < SUMMON_COST) return fail("골드가 부족합니다.");
    if (this.state.units.length >= this.diff.unitCap) {
      return fail("보유칸이 가득 차 소환할 수 없습니다.");
    }
    this.state.gold -= SUMMON_COST;
    const grade = this.rollGrade();
    const def = this.rng.pick(unitsOfGrade(grade));
    this.addUnit(def.id, "소환");
    this.checkMissions();
    return ok;
  }

  // ===================== 합성/조합 =====================

  private merge3(uids: number[]): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "3합성");
    if (!g.ok) return g;
    if (!uids || uids.length !== 3) return fail("3기를 선택해야 합니다.");
    const units = uids.map((id) => this.state.units.find((u) => u.uid === id));
    if (units.some((u) => !u)) return fail("선택한 유닛을 찾을 수 없습니다.");
    const list = units as OwnedUnit[];
    if (list.some((u) => u.locked)) return fail("잠금 유닛이 포함되어 있습니다.");
    const defs = list.map((u) => UNIT_BY_ID[u.defId]);
    const grade = defs[0].grade;
    if (defs.some((d) => d.grade !== grade)) return fail("같은 등급 3기가 필요합니다.");
    const gi = GRADE_ORDER.indexOf(grade);
    if (grade === "legend" || grade === "hidden") return fail("이 등급은 3합성할 수 없습니다.");
    const nextGrade = GRADE_ORDER[gi + 1];
    if (nextGrade === "hidden") return fail("히든은 3합성으로 만들 수 없습니다.");

    const sameFamily = defs.every((d) => d.family === defs[0].family);
    let pool: UnitDef[];
    if (sameFamily) {
      const famPool = unitsOfGrade(nextGrade).filter((u) => u.family === defs[0].family);
      pool = famPool.length > 0 ? famPool : unitsOfGrade(nextGrade);
    } else {
      pool = unitsOfGrade(nextGrade);
    }
    const result = this.rng.pick(pool);
    this.state.units = this.state.units.filter((u) => !uids.includes(u.uid));
    this.addUnit(result.id, sameFamily ? "계열 3합성" : "3합성");
    this.state.merge3Count++;
    this.log("merge", `${defs[0].name} 외 2기 → ${result.name}`);
    this.checkMissions();
    return ok;
  }

  /** 잠금 제외, 재료 충족 검사 후 소비할 uid 목록 반환 */
  private matchIngredients(recipeId: string): number[] | null {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) return null;
    const available = this.state.units.filter((u) => !u.locked);
    const usedUids: number[] = [];
    for (const ing of recipe.ingredients) {
      let need = ing.count;
      for (const u of available) {
        if (usedUids.includes(u.uid)) continue;
        const d = UNIT_BY_ID[u.defId];
        if (ing.unitId && u.defId !== ing.unitId) continue;
        if (ing.grade && d.grade !== ing.grade) continue;
        if (ing.family && d.family !== ing.family) continue;
        usedUids.push(u.uid);
        need--;
        if (need === 0) break;
      }
      if (need > 0) return null;
    }
    return usedUids;
  }

  private craft(recipeId: string): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "지정 조합");
    if (!g.ok) return g;
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) return fail("존재하지 않는 조합입니다.");
    if (recipe.minRound && this.state.round < recipe.minRound) {
      return fail(`${recipe.minRound}라운드부터 제작할 수 있습니다.`);
    }
    if (this.state.gold < recipe.cost.gold) return fail("골드가 부족합니다.");
    const uids = this.matchIngredients(recipeId);
    if (!uids) return fail("재료가 부족합니다. (잠금 유닛은 재료로 쓰지 않습니다)");
    this.state.gold -= recipe.cost.gold;
    this.state.units = this.state.units.filter((u) => !uids.includes(u.uid));
    this.addUnit(recipe.resultUnitId, "조합");
    this.state.craftCount++;
    if (recipe.visibility === "hidden" && !this.state.discoveredRecipeIds.includes(recipe.id)) {
      this.state.discoveredRecipeIds.push(recipe.id);
      this.log("craft", `히든 조합 발견! ${UNIT_BY_ID[recipe.resultUnitId].name}`);
    } else {
      this.log("craft", `조합 완성: ${UNIT_BY_ID[recipe.resultUnitId].name}`);
    }
    this.checkMissions();
    return ok;
  }

  private sell(uids: number[]): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "판매");
    if (!g.ok) return g;
    if (!uids || uids.length === 0) return fail("판매할 유닛을 선택하세요.");
    const targets = this.state.units.filter((u) => uids.includes(u.uid));
    if (targets.length !== uids.length) return fail("선택한 유닛을 찾을 수 없습니다.");
    if (targets.some((u) => u.locked)) return fail("잠금 유닛이 포함되어 있습니다.");
    let refund = 0;
    for (const u of targets) refund += SELL_REFUND[UNIT_BY_ID[u.defId].grade];
    this.state.units = this.state.units.filter((u) => !uids.includes(u.uid));
    this.state.gold += refund;
    this.log("sell", `${targets.length}기 판매 (+${refund}골드)`);
    this.checkMissions();
    return ok;
  }

  private toggleLock(uid: number): ActionResult {
    const u = this.state.units.find((x) => x.uid === uid);
    if (!u) return fail("유닛을 찾을 수 없습니다.");
    u.locked = !u.locked;
    return ok;
  }

  private upgrade(upgradeId: string): ActionResult {
    if (this.state.phase === "ended") return fail("게임이 끝났습니다.");
    const def = UPGRADE_BY_ID[upgradeId];
    if (!def) return fail("존재하지 않는 업그레이드입니다.");
    const lv = this.state.upgrades[upgradeId] ?? 0;
    if (lv >= def.maxLevel) return fail("최대 레벨입니다.");
    const cost = upgradeCost(def, lv);
    if (this.state.gold < cost) return fail("골드가 부족합니다.");
    this.state.gold -= cost;
    this.state.upgrades[upgradeId] = lv + 1;
    this.log("upgrade", `${def.name} Lv.${lv + 1}`);
    this.checkMissions();
    return ok;
  }

  // ===================== 선택권 =====================

  private grantSelector(grade: Grade, source: string) {
    const pool = unitsOfGrade(grade);
    const shuffled = this.rng.shuffle(pool.map((u) => u.id));
    const candidates = shuffled.slice(0, Math.min(3, shuffled.length));
    const sel: PendingSelector = {
      id: `sel_${this.state.round}_${this.state.pendingSelectors.length}_${this.rng.int(99999)}`,
      grade, candidateIds: candidates, source,
    };
    this.state.pendingSelectors.push(sel);
    this.log("reward", `${source}: 선택권 획득 (${grade})`);
  }

  private pickSelector(selectorId: string, unitId: string): ActionResult {
    const g = this.requirePhase(["prepare", "wave", "reward"], "선택권 사용");
    if (!g.ok) return g;
    const idx = this.state.pendingSelectors.findIndex((s) => s.id === selectorId);
    if (idx === -1) return fail("선택권을 찾을 수 없습니다.");
    const sel = this.state.pendingSelectors[idx];
    if (!sel.candidateIds.includes(unitId)) return fail("후보에 없는 유닛입니다.");
    if (this.state.units.length >= this.diff.unitCap) {
      return fail("보유칸이 가득 찼습니다. 정리 후 선택하세요.");
    }
    this.state.pendingSelectors.splice(idx, 1);
    this.addUnit(unitId, "선택권");
    this.checkMissions();
    return ok;
  }

  // ===================== 라운드 흐름 =====================

  /** 라운드 사이 휴식을 건너뛰고 즉시 다음 라운드를 시작 (Space/버튼). */
  private skipBreak(): ActionResult {
    const g = this.requirePhase(["wave"], "라운드 시작");
    if (!g.ok) return g;
    if (this.state.breakTicks <= 0) return fail("이미 라운드가 진행 중입니다.");
    this.state.breakTicks = 0;
    this.beginRoundSpawning();
    return ok;
  }

  /** 휴식 종료 → 현재 round의 적 스폰 시작. 이 시점에 패배/승리를 판정한다. */
  private beginRoundSpawning() {
    const s = this.state;
    if (s.round > FINAL_ROUND) { this.endGame(true); return; } // 모든 라운드 생존 → 승리
    // 다음 라운드가 시작되는 순간 루프에 쌓인 적이 임계 이상이면 패배
    if (s.enemies.length >= LOSE_THRESHOLD) {
      this.log("system", `누적 적 ${s.enemies.length}마리 — 방어선 붕괴`);
      this.endGame(false);
      return;
    }
    s.waveSpawned = 0;
    s.waveKilled = 0;
    this.spawnTimer = 0;
    // 영웅 보정
    if (
      !s.heroPityGiven && s.round >= HERO_PITY_ROUND &&
      !s.units.some((u) => GRADE_ORDER.indexOf(UNIT_BY_ID[u.defId].grade) >= GRADE_ORDER.indexOf("hero"))
    ) {
      s.heroPityGiven = true;
      this.grantSelector("hero", "영웅 보정");
    }
    const wave = waveForRound(s.round);
    if (wave.type === "boss") {
      s.bossSpawnTime = s.time;
      this.log("boss", `보스 등장: ${wave.enemyName}`);
    } else {
      this.log("wave", `${s.round}라운드 시작 (${wave.enemyName} x${wave.count})`);
    }
  }

  /** 현재 round의 적 스폰 완료 → 보상 후 다음 라운드 휴식으로 전환 */
  private completeRound() {
    const s = this.state;
    const wave = waveForRound(s.round);
    const gold = Math.round(wave.goldReward * this.diff.goldMult);
    s.gold += gold;
    this.log("reward", `${s.round}라운드 정리 (+${gold}골드)`);
    if (wave.reward?.selector) this.grantSelector(wave.reward.selector.grade, "보스 보상");
    this.checkMissions();
    this.expireMissions();
    if (s.round >= FINAL_ROUND) {
      this.endGame(true);
      return;
    }
    s.round++;
    s.breakTicks = ROUND_BREAK_MAX; // 스폰 완료 → 최대 60초(전멸 시 10초로 단축)
  }

  private endGame(cleared: boolean) {
    this.state.cleared = cleared;
    this.state.phase = "ended";
    this.log("system", cleared ? `${stageById(this.state.stageId).name} 40라운드 클리어!` : `${this.state.round}라운드에서 패배`);
  }

  // ===================== 전투 tick =====================

  /** 고정 timestep 1회 진행. 적 루프·유닛 AI는 라운드 사이 휴식 중에도 계속 돈다. */
  advanceTick() {
    if (this.state.phase !== "wave") return; // 게임 진행 중에는 항상 "wave"
    const s = this.state;
    s.tick++;
    s.time += DT;

    const boss = bossForRound(s.round);

    // 휴식 중: 스폰은 멈추되 적 루프·유닛 전투는 계속 (아군이 멈추지 않는다)
    if (s.breakTicks > 0) {
      this.moveEnemies();
      this.tickUnits(boss?.slowResist ?? 0);
      // 적을 전멸시켰으면 그 시점부터 10초로 단축 (60초 상한과 둘 중 빠른 쪽)
      if (s.enemies.length === 0 && s.breakTicks > ROUND_BREAK_CLEARED) {
        s.breakTicks = ROUND_BREAK_CLEARED;
      }
      s.breakTicks--;
      if (s.breakTicks <= 0) this.beginRoundSpawning();
      return;
    }

    // 스폰 진행
    const wave = waveForRound(s.round);
    const hpMult = this.diff.enemyHpMult;
    const interval = wave.type === "swarm" ? SPAWN_INTERVAL_SWARM : SPAWN_INTERVAL;
    this.spawnTimer -= DT;
    if (s.waveSpawned < wave.count && this.spawnTimer <= 0) {
      this.spawnTimer = interval;
      const isBoss = wave.type === "boss";
      const enemy: EnemyState = {
        eid: s.nextEid++,
        hp: wave.hp * hpMult, maxHp: wave.hp * hpMult,
        speed: wave.speed, armor: wave.armor,
        dist: 0, isBoss,
        slows: [], stunUntil: 0,
        armorBreakStacks: 0, ampStacks: 0,
        spawnAt: s.time,
      };
      s.enemies.push(enemy);
      s.waveSpawned++;
    }

    this.moveEnemies();
    this.tickUnits(boss?.slowResist ?? 0);

    // 일반 라운드는 스폰 완료 시 정산한다. 보스 라운드는 보스를 처치해야 정산한다.
    if (s.waveSpawned >= wave.count && (wave.type !== "boss" || s.waveKilled >= wave.count)) this.completeRound();
  }

  /** 적을 루프(사각형 둘레)로 이동. 누수/탈출 없음 — 끝에 닿으면 처음으로 순환. */
  private moveEnemies() {
    const s = this.state;
    const pathLength = pathLengthForStage(s.stageId);
    for (const e of s.enemies) {
      if (e.stunUntil > s.time) continue;
      e.slows = e.slows.filter((sl) => sl.until > s.time);
      let slowProduct = 1;
      for (const sl of e.slows) slowProduct *= 1 - sl.pct;
      let totalSlow = 1 - slowProduct;
      const cap = e.isBoss ? SLOW_CAP_BOSS : SLOW_CAP_NORMAL;
      if (totalSlow > cap) totalSlow = cap;
      e.dist += ENEMY_BASE_SPEED * e.speed * (1 - totalSlow) * DT;
      while (e.dist >= pathLength) e.dist -= pathLength; // 루프 순환
    }
  }

  private upLv(id: string): number { return this.state.upgrades[id] ?? 0; }

  /** 사거리/시야 radius 안에서 타게팅 우선순위에 따른 적 1기 (없으면 null) */
  private pickTarget(u: OwnedUnit, d: UnitDef, radius: number): EnemyState | null {
    const cands: EnemyState[] = [];
    for (const e of this.state.enemies) {
      const p = posAtDist(e.dist, this.state.stageId);
      if (Math.hypot(p.x - u.x, p.y - u.y) <= radius) cands.push(e);
    }
    if (cands.length === 0) return null;
    cands.sort((a, b) => a.eid - b.eid); // 동률 eid 낮은 쪽
    let t = cands[0];
    for (const c of cands) {
      switch (d.targeting) {
        case "first": if (c.dist > t.dist) t = c; break;
        case "last": if (c.dist < t.dist) t = c; break;
        case "highestHp": if (c.hp > t.hp) t = c; break;
        case "lowestHp": if (c.hp < t.hp) t = c; break;
      }
    }
    return t;
  }

  /** (tx,ty)를 향해 한 틱 이동 — 경로 밖/유닛 겹침 보정 포함 */
  private stepUnit(u: OwnedUnit, tx: number, ty: number, maxStep: number) {
    const dx = tx - u.x, dy = ty - u.y;
    const dist = Math.hypot(dx, dy);
    let nx = u.x, ny = u.y;
    if (dist > 1e-4) {
      const stp = Math.min(maxStep, dist);
      nx = u.x + (dx / dist) * stp;
      ny = u.y + (dy / dist) * stp;
    }
    const pos = this.resolvePlacement(u.uid, nx, ny);
    u.x = pos.x; u.y = pos.y;
  }

  /** 유닛 AI 한 틱: 명령 해석 → 이동/추적 → 사거리 내 자동 사격 (결정론, uid 순서) */
  private tickUnits(bossSlowResist: number) {
    const s = this.state;
    const lv = {
      flame: this.upLv("upgrade_flame"), storm: this.upLv("upgrade_storm"),
      iron: this.upLv("upgrade_iron"), frost: this.upLv("upgrade_frost"),
      void: this.upLv("upgrade_void"),
    };
    const step = UNIT_MOVE_SPEED * DT;
    const units = [...s.units].sort((a, b) => a.uid - b.uid);
    for (const u of units) {
      u.cooldown -= DT;
      const d = UNIT_BY_ID[u.defId];
      const attackR = d.range;
      const detectR = attackR + DETECT_BONUS;

      let moveTo: { x: number; y: number } | null = null;
      let target: EnemyState | null = null;

      switch (u.order.kind) {
        case "move":
          moveTo = { x: u.order.x, y: u.order.y }; // 적 무시, 목적지 우선
          break;
        case "hold":
          target = this.pickTarget(u, d, attackR); // 제자리, 사거리 내만
          break;
        case "attack": {
          const wanted = u.order.targetEid;
          target = s.enemies.find((e) => e.eid === wanted) ?? null;
          if (!target) target = this.pickTarget(u, d, detectR); // 사망 → 주변 재탐색
          if (target) u.order = { kind: "attack", targetEid: target.eid };
          else u.order = { kind: "none" };
          break;
        }
        case "attackMove":
          target = this.pickTarget(u, d, detectR);
          if (!target) moveTo = { x: u.order.x, y: u.order.y };
          break;
        case "none":
          target = this.pickTarget(u, d, detectR); // 시야 내 자동 교전
          break;
      }

      // leash: 자동 교전/지정 공격에서 적이 앵커로부터 너무 멀면 포기·복귀
      if (target && (u.order.kind === "attack" || u.order.kind === "none")) {
        const tp = posAtDist(target.dist, s.stageId);
        if (Math.hypot(tp.x - u.anchorX, tp.y - u.anchorY) > LEASH_RANGE) {
          target = null;
          if (u.order.kind === "attack") u.order = { kind: "none" };
        }
      }

      // 이동 목표 결정
      if (target && u.order.kind !== "hold") {
        const tp = posAtDist(target.dist, s.stageId);
        moveTo = Math.hypot(tp.x - u.x, tp.y - u.y) > attackR ? { x: tp.x, y: tp.y } : null;
      } else if (!target && u.order.kind === "none") {
        if (Math.hypot(u.x - u.anchorX, u.y - u.anchorY) > ARRIVE_EPS) moveTo = { x: u.anchorX, y: u.anchorY };
      }

      // 이동 적용 + 상태/도착 처리
      if (moveTo) {
        const bx = u.x, by = u.y;
        this.stepUnit(u, moveTo.x, moveTo.y, step);
        u.state = target ? "chasing" : "moving";
        const reached = Math.hypot(u.x - moveTo.x, u.y - moveTo.y) <= ARRIVE_EPS;
        const stuck = Math.hypot(u.x - bx, u.y - by) < 0.05;
        if (!target && (u.order.kind === "move" || u.order.kind === "attackMove") && (reached || stuck)) {
          u.anchorX = u.x; u.anchorY = u.y; // 도착(또는 막힘) → 대기
          u.order = { kind: "none" };
          u.state = "idle";
        }
      } else {
        u.state = target ? "attacking" : u.order.kind === "hold" ? "hold" : "idle";
      }

      // 사격 (사거리 안 + 쿨다운)
      if (target && u.cooldown <= 0) {
        const tp = posAtDist(target.dist, s.stageId);
        if (Math.hypot(tp.x - u.x, tp.y - u.y) <= attackR) this.fireAt(u, d, target, lv, bossSlowResist);
      }
    }
  }

  /** 한 발 발사: 피해·스플래시·디버프·마무리 적용 (rng는 uid 순서로만 호출) */
  private fireAt(
    u: OwnedUnit, d: UnitDef, e: EnemyState,
    lv: { flame: number; storm: number; iron: number; frost: number; void: number },
    bossSlowResist: number,
  ) {
    const s = this.state;
    const atkSpeed = d.attackSpeed * (d.family === "storm" ? 1 + 0.1 * lv.storm : 1);
    u.cooldown = 1 / atkSpeed;

    let atk = d.attack * (d.family === "flame" ? 1 + 0.12 * lv.flame : 1);
    if (e.isBoss && d.bossDamageBonus) {
      const bonus = d.bossDamageBonus + (d.family === "iron" ? 0.15 * lv.iron : 0);
      atk *= 1 + bonus;
    }
    u.totalDamage += this.applyDamage(e, atk, d.attackType, lv.void);

    if (d.splashRadius) {
      const tp = posAtDist(e.dist, s.stageId);
      for (const c of s.enemies) {
        if (c === e) continue;
        const cp = posAtDist(c.dist, s.stageId);
        if (Math.hypot(cp.x - tp.x, cp.y - tp.y) <= d.splashRadius) {
          u.totalDamage += this.applyDamage(c, atk * 0.6, d.attackType, lv.void);
        }
      }
    }

    if (d.slowPct) {
      let pct = d.slowPct;
      if (e.isBoss) {
        const resist = Math.max(0, bossSlowResist - s.bossSlowResistReduction);
        pct *= 1 - resist;
      }
      const dur = (d.slowDuration ?? 1.5) * (d.family === "frost" ? 1 + 0.1 * lv.frost : 1);
      e.slows.push({ pct, until: s.time + dur });
    }
    if (d.stunChance && this.rng.next() < d.stunChance) {
      const dur = (d.stunDuration ?? 0.5) * (e.isBoss ? 0.5 : 1);
      e.stunUntil = Math.max(e.stunUntil, s.time + dur);
    }
    if (d.armorBreakPct && e.armorBreakStacks < 3) e.armorBreakStacks++;
    if (d.damageAmpPct && e.ampStacks < 3) e.ampStacks++;
    if (d.executePct && !e.isBoss && e.hp > 0 && e.hp <= e.maxHp * d.executePct) {
      u.totalDamage += e.hp;
      e.hp = 0;
    }

    this.collectDead();
  }

  private applyDamage(e: EnemyState, raw: number, attackType: UnitDef["attackType"], voidLv: number): number {
    const armorFactor =
      attackType === "true" ? 0 :
      attackType === "pierce" ? 0.3 :
      attackType === "magic" ? 0.6 : 1.0;
    const breakPerStack = 0.1 * (1 + 0.1 * voidLv);
    const effArmor = Math.max(
      0,
      e.armor * armorFactor * (1 - Math.min(0.45, e.armorBreakStacks * breakPerStack)),
    );
    const amp = 1 + e.ampStacks * 0.04 * (1 + 0.1 * voidLv);
    const dmg = raw * (100 / (100 + effArmor)) * amp;
    e.hp -= dmg;
    return dmg;
  }

  private collectDead() {
    const s = this.state;
    const dead = s.enemies.filter((e) => e.hp <= 0);
    if (dead.length === 0) return;
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    for (const e of dead) {
      s.waveKilled++;
      // 숲 계열 처치 보상: 5킬마다 보너스
      if (s.waveKilled % 5 === 0) {
        let bonus = 0;
        for (const u of s.units) {
          const d = UNIT_BY_ID[u.defId];
          if (d.killGoldBonus) bonus += d.killGoldBonus;
        }
        bonus += this.upLv("upgrade_forest");
        if (bonus > 0) s.gold += bonus;
      }
      if (e.isBoss) this.onBossKilled(e);
    }
    this.checkMissions();
  }

  private onBossKilled(e: EnemyState) {
    const s = this.state;
    const seconds = Math.round((s.time - e.spawnAt) * 10) / 10;
    s.bossKillSeconds[s.round] = seconds;
    this.log("boss", `보스 처치! (${seconds}초)`);
    if (s.bossKillBonus && s.bossKillBonus.round === s.round) {
      s.gold += s.bossKillBonus.gold;
      this.log("reward", `미션 보너스 +${s.bossKillBonus.gold}골드`);
      s.bossKillBonus = null;
    }
    // 감속 저항 감소 버프는 1회성
    s.bossSlowResistReduction = 0;
  }

  // ===================== 미션 =====================

  private countFamilies(grade: Grade): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const u of this.state.units) {
      const d = UNIT_BY_ID[u.defId];
      if (d.grade === grade) counts[d.family] = (counts[d.family] ?? 0) + 1;
    }
    return counts;
  }

  /** 진행률 텍스트 (UI용) */
  missionProgress(missionId: string): string {
    const m = MISSION_BY_ID[missionId];
    const s = this.state;
    const c = m.condition;
    switch (c.type) {
      case "collectFamilies": {
        const counts = this.countFamilies(c.grade);
        const have = Object.keys(counts).filter((f) => counts[f] >= c.countEach).length;
        return `${have}/6 계열`;
      }
      case "craftCount": return `${Math.min(s.craftCount, c.count)}/${c.count}`;
      case "ownFamily": {
        const n = s.units.filter((u) => UNIT_BY_ID[u.defId].family === c.family).length;
        return `${Math.min(n, c.count)}/${c.count}`;
      }
      case "ownRole": {
        const n = s.units.filter((u) => UNIT_BY_ID[u.defId].roles.includes(c.role)).length;
        return `${Math.min(n, c.count)}/${c.count}`;
      }
      case "ownGrade": {
        const n = s.units.filter((u) => UNIT_BY_ID[u.defId].grade === c.grade).length;
        return `${Math.min(n, c.count)}/${c.count}`;
      }
      case "noLeakUntil": return s.leakedRounds.some((r) => r <= c.round) ? "실패" : `${Math.min(s.round, c.round)}/${c.round}R`;
      case "pityTriggered": return `${Math.min(s.summonStats.pityTriggered, c.count)}/${c.count}`;
      case "merge3Count": return `${Math.min(s.merge3Count, c.count)}/${c.count}`;
      case "upgradeTotal": {
        const total = Object.values(s.upgrades).reduce((a, b) => a + b, 0);
        return `${Math.min(total, c.level)}/${c.level}`;
      }
      case "goldAtOnce": return `${Math.min(s.gold, c.gold)}/${c.gold}`;
      case "bossKillUnderSec": {
        const t = s.bossKillSeconds[c.round];
        return t !== undefined ? `${t}초` : `${c.round}R 보스`;
      }
    }
  }

  private isMissionSatisfied(missionId: string): boolean {
    const m = MISSION_BY_ID[missionId];
    const s = this.state;
    const c = m.condition;
    switch (c.type) {
      case "collectFamilies": {
        const counts = this.countFamilies(c.grade);
        return ["flame", "frost", "storm", "iron", "void", "forest"]
          .every((f) => (counts[f] ?? 0) >= c.countEach);
      }
      case "craftCount": return s.craftCount >= c.count;
      case "ownFamily":
        return s.units.filter((u) => UNIT_BY_ID[u.defId].family === c.family).length >= c.count;
      case "ownRole":
        return s.units.filter((u) => UNIT_BY_ID[u.defId].roles.includes(c.role)).length >= c.count;
      case "ownGrade":
        return s.units.filter((u) => UNIT_BY_ID[u.defId].grade === c.grade).length >= c.count;
      case "noLeakUntil":
        return s.round >= c.round && s.phase === "reward" &&
          !s.leakedRounds.some((r) => r <= c.round);
      case "pityTriggered": return s.summonStats.pityTriggered >= c.count;
      case "merge3Count": return s.merge3Count >= c.count;
      case "upgradeTotal":
        return Object.values(s.upgrades).reduce((a, b) => a + b, 0) >= c.level;
      case "goldAtOnce": return s.gold >= c.gold;
      case "bossKillUnderSec": {
        const t = s.bossKillSeconds[c.round];
        return t !== undefined && t <= c.seconds;
      }
    }
  }

  private checkMissions() {
    for (const ms of this.state.missions) {
      if (ms.status !== "active") continue;
      const def = MISSION_BY_ID[ms.defId];
      if (def.expireRound !== undefined && this.state.round > def.expireRound) continue;
      if (this.isMissionSatisfied(ms.defId)) {
        ms.status = "done";
        ms.completedRound = this.state.round;
        this.applyReward(def.reward, `미션 [${def.visibility === "hidden" ? "히든" : def.name}]`);
        this.log("mission", `미션 완료: ${def.visibility === "hidden" ? def.desc.replace("(히든) ", "") : def.name}`);
      }
    }
  }

  private expireMissions() {
    for (const ms of this.state.missions) {
      if (ms.status !== "active") continue;
      const def = MISSION_BY_ID[ms.defId];
      if (def.expireRound !== undefined && this.state.round >= def.expireRound) {
        ms.status = "expired";
        if (def.visibility === "visible") this.log("mission", `미션 만료: ${def.name}`);
      }
    }
  }

  private applyReward(reward: RewardDef, source: string) {
    const s = this.state;
    if (reward.gold) {
      s.gold += reward.gold;
      this.log("reward", `${source} +${reward.gold}골드`);
    }
    if (reward.selector) {
      for (let i = 0; i < reward.selector.count; i++) {
        this.grantSelector(reward.selector.grade, source);
      }
    }
    if (reward.bossSlowResistReduction) {
      s.bossSlowResistReduction += reward.bossSlowResistReduction;
      this.log("reward", `${source}: 다음 보스 감속 저항 -${Math.round(reward.bossSlowResistReduction * 100)}%`);
    }
    if (reward.bossKillBonusGold) {
      s.bossKillBonus = reward.bossKillBonusGold;
    }
  }

  // ===================== 결과 =====================

  maxOwnedGrade(): Grade {
    let max = 0;
    for (const u of this.state.units) {
      const gi = GRADE_ORDER.indexOf(UNIT_BY_ID[u.defId].grade);
      if (gi > max) max = gi;
    }
    return GRADE_ORDER[max];
  }

  failHint(): string | null {
    const s = this.state;
    if (s.cleared) return null;
    if (s.bossFailedRounds.length > 0) {
      const r = s.bossFailedRounds[s.bossFailedRounds.length - 1];
      return `boss_damage_low: ${r}R 보스를 막지 못했습니다. 보스딜(강철)과 약화(공허) 유닛을 보강하세요.`;
    }
    const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
    if (wave.type === "swarm") {
      return "wave_clear_low: 물량 라운드에서 밀렸습니다. 스플래시(화염)와 공격속도(폭풍)를 보강하세요.";
    }
    if (wave.type === "armored") {
      return "armor_wall: 철갑 라운드에서 밀렸습니다. 방깎(공허)이나 관통 공격이 필요합니다.";
    }
    return "wave_clear_low: 라인딜이 부족합니다. 조합으로 상위 등급 라인딜을 확보하세요.";
  }

  resultSummary(): ResultSummary {
    const s = this.state;
    const dealers = [...s.units]
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .slice(0, 3)
      .map((u) => ({
        name: UNIT_BY_ID[u.defId].name,
        grade: UNIT_BY_ID[u.defId].grade,
        damage: Math.round(u.totalDamage),
      }));
    return {
      seed: s.seed,
      difficulty: this.diff.name,
      stageId: s.stageId,
      stageName: stageById(s.stageId).name,
      dataVersion: s.dataVersion,
      cleared: s.cleared,
      reachedRound: s.round,
      life: s.life,
      maxGrade: this.maxOwnedGrade(),
      missionsDone: s.missions.filter((m) => m.status === "done").length,
      missionsTotal: s.missions.length,
      topDealers: dealers,
      failHint: this.failHint(),
      bossKills: Object.entries(s.bossKillSeconds).map(([r, sec]) => ({
        round: Number(r), seconds: sec,
      })),
      bossFails: s.bossFailedRounds,
      pityTriggered: s.summonStats.pityTriggered,
      craftCount: s.craftCount,
      merge3Count: s.merge3Count,
      playedAt: "",
    };
  }
}

/** 리플레이: 기록된 입력으로 게임을 재실행. stopAtTick까지 진행 후 정지. */
export function replay(
  seed: string,
  difficulty: DifficultyId,
  stageId: number,
  inputHistory: GameInput[],
  stopAtTick?: number,
  maxTicks = 2_000_000,
): Game {
  const game = new Game(seed, difficulty, stageId);
  let i = 0;
  let guard = 0;
  while (guard++ < maxTicks) {
    while (i < inputHistory.length && inputHistory[i].tick <= game.state.tick) {
      game.executeRecorded(inputHistory[i]);
      game.state.inputHistory.push(inputHistory[i]);
      i++;
    }
    if (game.state.phase === "ended") break;
    const inputsDone = i >= inputHistory.length;
    if (stopAtTick !== undefined && game.state.tick >= stopAtTick && inputsDone) break;
    if (game.state.phase === "wave") {
      game.advanceTick();
    } else {
      if (inputsDone) break;
      // prepare/reward인데 다음 입력 tick이 미래면 더 진행할 수 없음 (방어)
      if (inputHistory[i].tick > game.state.tick) break;
    }
  }
  return game;
}
