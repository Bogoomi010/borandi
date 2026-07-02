import { Rng } from "./rng";
import { buildLoop, buildSlots, pointAt, type LoopPath } from "./path";
import type {
  DifficultyDef, EnemyInst, Family, GameEvent, GamePhase, Grade, RecipeDef,
  SelectorOffer, SkillDef, SlotDef, StageDef, UnitDef, UnitInst, Vec2, WaveDef,
} from "./types";
import { UNIT_BY_ID, unitsOfGrade } from "../data/units";
import { RECIPES } from "../data/recipes";
import { FINAL_ROUND, waveForRound, bossForRound } from "../data/waves";
import { SUMMON_COST, SUMMON_TABLE, PITY_THRESHOLD, PITY_TABLE, SELL_REFUND } from "../data/difficulty";
import { UPGRADE_BY_FAMILY, upgradeCost } from "../data/upgrades";

export const TICK = 1 / 20;
const ENEMY_BASE_SPEED = 62;
const PREP_FIRST = 14;
const PREP_BETWEEN = 9;
const BOSS_ENRAGE_AT = 60;
const ARMOR_K = 130;
const NEXT_GRADE: Partial<Record<Grade, Grade>> = { common: "rare", rare: "hero", hero: "legend" };

export interface CraftableInfo {
  recipe: RecipeDef;
  result: UnitDef;
  /** 재료별 보유 수량 충족 여부 */
  haveAll: boolean;
  canAfford: boolean;
  unlocked: boolean; // minRound 충족
  discovered: boolean;
}

export class Game {
  readonly rng: Rng;
  readonly stage: StageDef;
  readonly difficulty: DifficultyDef;
  readonly path: LoopPath;
  readonly slots: SlotDef[];

  phase: GamePhase = "prep";
  time = 0;
  round = 0; // 마지막으로 시작한 라운드. prep 중이면 다음은 round+1
  gold: number;
  units: UnitInst[] = [];
  enemies: EnemyInst[] = [];
  events: GameEvent[] = [];
  prepTimer = PREP_FIRST;
  selectorOffer: SelectorOffer | null = null;
  discovered = new Set<string>();
  totalKills = 0;
  bossTimer = 0;
  bossEnraged = false;
  /** 현재 라운드 잔여 시간. 만료되면 다음 웨이브가 겹쳐서 시작된다 (보스 제외) */
  roundTimer = 0;
  /** 진영별 강화 레벨 */
  famLevels: Record<Family, number> = { flame: 0, frost: 0, storm: 0, iron: 0, void: 0, forest: 0 };

  private uidSeq = 1;
  private spawnLeft = 0;
  private spawnTimer = 0;
  private spawnedAll = false;
  private wave: WaveDef | null = null;
  private pityCounter = 0;
  private enrageSpawnTimer = 0;

  constructor(seed: number, stage: StageDef, difficulty: DifficultyDef) {
    this.rng = new Rng(seed);
    this.stage = stage;
    this.difficulty = difficulty;
    this.path = buildLoop(stage.loop);
    this.slots = buildSlots(stage, this.path);
    this.gold = difficulty.startGold;
    // 시작부터 알려진 레시피 (visible)
    for (const r of RECIPES) if (r.visibility === "visible") this.discovered.add(r.id);
    this.emit({ type: "log", text: `${stage.name} · ${difficulty.name} — 새로운 방어전이 시작됩니다.` });
  }

  // ===== 조회 =====

  def(u: UnitInst): UnitDef { return UNIT_BY_ID[u.defId]; }
  unitByUid(uid: number): UnitInst | undefined { return this.units.find((u) => u.uid === uid); }
  enemyByUid(uid: number): EnemyInst | undefined { return this.enemies.find((e) => e.uid === uid); }
  slotPos(slot: number): Vec2 { return this.slots[slot]; }
  unitPos(u: UnitInst): Vec2 { return this.slots[u.slot]; }
  enemyPos(e: EnemyInst): Vec2 { return pointAt(this.path, e.dist); }
  freeSlots(): SlotDef[] {
    const used = new Set(this.units.map((u) => u.slot));
    return this.slots.filter((s) => !used.has(s.id));
  }
  countOf(defId: string): number { return this.units.filter((u) => u.defId === defId).length; }
  get summonCost(): number { return SUMMON_COST; }
  get boss(): EnemyInst | undefined { return this.enemies.find((e) => e.isBoss); }
  get nextRound(): number { return Math.min(this.round + 1, FINAL_ROUND); }
  get currentWave(): WaveDef | null { return this.wave; }

  /** 3개 조합 가능한 defId 목록 */
  mergeableDefs(): string[] {
    const counts = new Map<string, number>();
    for (const u of this.units) counts.set(u.defId, (counts.get(u.defId) ?? 0) + 1);
    const out: string[] = [];
    for (const [id, c] of counts) {
      if (c >= 3 && NEXT_GRADE[UNIT_BY_ID[id].grade]) out.push(id);
    }
    return out;
  }

  craftables(): CraftableInfo[] {
    return RECIPES.map((recipe) => {
      const discovered = this.discovered.has(recipe.id);
      const haveAll = recipe.ingredients.every((ing) => this.countOf(ing.unitId) >= ing.count);
      return {
        recipe,
        result: UNIT_BY_ID[recipe.resultUnitId],
        haveAll,
        canAfford: this.gold >= recipe.cost.gold,
        unlocked: (recipe.minRound ?? 0) <= this.round + 1,
        discovered,
      };
    });
  }

  /** 지금 바로 실행 가능한 조합 */
  readyCrafts(): CraftableInfo[] {
    return this.craftables().filter((c) => c.haveAll && c.canAfford && c.unlocked);
  }

  // ===== 플레이어 행동 =====

  summon(): { ok: boolean; reason?: string; defId?: string } {
    if (this.phase === "victory" || this.phase === "defeat") return { ok: false, reason: "게임 종료" };
    if (this.gold < SUMMON_COST) return { ok: false, reason: "골드 부족" };
    if (this.units.length >= this.difficulty.unitCap) return { ok: false, reason: "유닛 한도 초과" };
    const free = this.freeSlots();
    if (free.length === 0) return { ok: false, reason: "빈 자리 없음" };

    this.gold -= SUMMON_COST;
    let grade: Grade;
    if (this.pityCounter >= PITY_THRESHOLD) {
      grade = this.rng.weighted(PITY_TABLE);
      this.emit({ type: "pity", text: "연속 일반 보정! 희귀 이상 확정 소환." });
    } else {
      grade = this.rng.weighted(SUMMON_TABLE);
    }
    this.pityCounter = grade === "common" ? this.pityCounter + 1 : 0;

    const pool = unitsOfGrade(grade);
    const def = this.rng.pick(pool);
    const inner = free.filter((s) => s.id < this.slots.length * 0.55);
    const slot = this.rng.pick(inner.length > 0 ? inner : free);
    const inst = this.makeUnit(def.id, slot.id);
    this.emit({ type: "summon", uid: inst.uid, unitDefId: def.id, grade: def.grade, x: slot.x, y: slot.y });
    if (grade !== "common") {
      this.emit({ type: "log", text: `[소환] ${gradeLabel(def.grade)} ${def.name} 획득!` });
    }
    return { ok: true, defId: def.id };
  }

  sell(uid: number): boolean {
    const u = this.unitByUid(uid);
    if (!u) return false;
    const def = this.def(u);
    const refund = SELL_REFUND[def.grade];
    this.units = this.units.filter((x) => x.uid !== uid);
    this.gold += refund;
    const p = this.slotPos(u.slot);
    this.emit({ type: "sell", uid, unitDefId: def.id, amount: refund, x: p.x, y: p.y });
    return true;
  }

  /** 같은 유닛 3개 조합 → 다음 등급 랜덤. anchor 유닛 자리에 생성 */
  merge3(uid: number): { ok: boolean; defId?: string; reason?: string } {
    const anchor = this.unitByUid(uid);
    if (!anchor) return { ok: false, reason: "유닛 없음" };
    const def = this.def(anchor);
    const next = NEXT_GRADE[def.grade];
    if (!next) return { ok: false, reason: "조합 불가 등급" };
    const same = this.units.filter((u) => u.defId === def.id);
    if (same.length < 3) return { ok: false, reason: "같은 유닛 3개 필요" };
    const consumed = [anchor, ...same.filter((u) => u.uid !== anchor.uid).slice(0, 2)];
    this.units = this.units.filter((u) => !consumed.includes(u));
    const resultDef = this.rng.pick(unitsOfGrade(next));
    const inst = this.makeUnit(resultDef.id, anchor.slot);
    const p = this.slotPos(anchor.slot);
    this.emit({ type: "merge", uid: inst.uid, unitDefId: resultDef.id, grade: resultDef.grade, x: p.x, y: p.y });
    this.emit({ type: "log", text: `[조합] ${def.name} ×3 → ${gradeLabel(resultDef.grade)} ${resultDef.name}` });
    return { ok: true, defId: resultDef.id };
  }

  craft(recipeId: string, anchorUid?: number): { ok: boolean; defId?: string; reason?: string } {
    const info = this.craftables().find((c) => c.recipe.id === recipeId);
    if (!info) return { ok: false, reason: "레시피 없음" };
    if (!info.unlocked) return { ok: false, reason: `${info.recipe.minRound}R부터 가능` };
    if (!info.haveAll) return { ok: false, reason: "재료 부족" };
    if (!info.canAfford) return { ok: false, reason: "골드 부족" };

    const consumed: UnitInst[] = [];
    const anchor = anchorUid !== undefined ? this.unitByUid(anchorUid) : undefined;
    for (const ing of info.recipe.ingredients) {
      let pool = this.units.filter((u) => u.defId === ing.unitId && !consumed.includes(u));
      // anchor 우선 소모
      pool = pool.sort((a, b) => (a === anchor ? -1 : b === anchor ? 1 : a.uid - b.uid));
      consumed.push(...pool.slice(0, ing.count));
    }
    const slot = (anchor && consumed.includes(anchor)) ? anchor.slot : consumed[0].slot;
    this.units = this.units.filter((u) => !consumed.includes(u));
    this.gold -= info.recipe.cost.gold;
    const inst = this.makeUnit(info.recipe.resultUnitId, slot);
    const first = !this.discovered.has(recipeId);
    this.discovered.add(recipeId);
    const p = this.slotPos(slot);
    this.emit({ type: "craft", uid: inst.uid, unitDefId: inst.defId, grade: info.result.grade, x: p.x, y: p.y });
    this.emit({
      type: "log",
      text: `[레시피] ${info.result.name} 조합 완성!${first ? " (새로운 레시피 발견)" : ""}`,
    });
    return { ok: true, defId: inst.defId };
  }

  /** 다음 강화 비용. 최대 레벨이면 null */
  upgradeCostFor(family: Family): number | null {
    const def = UPGRADE_BY_FAMILY[family];
    const lv = this.famLevels[family];
    if (lv >= def.maxLevel) return null;
    return upgradeCost(def, lv);
  }

  buyUpgrade(family: Family): { ok: boolean; reason?: string } {
    const def = UPGRADE_BY_FAMILY[family];
    const cost = this.upgradeCostFor(family);
    if (cost === null) return { ok: false, reason: "최대 레벨" };
    if (this.gold < cost) return { ok: false, reason: "골드 부족" };
    this.gold -= cost;
    this.famLevels[family]++;
    this.emit({ type: "log", text: `[강화] ${def.name} Lv.${this.famLevels[family]} (${def.desc})` });
    return { ok: true };
  }

  /** 진영 강화 배율 (1 + 레벨×효과) */
  famBonus(family: Family): number {
    return 1 + this.famLevels[family] * UPGRADE_BY_FAMILY[family].effectPerLevel;
  }

  moveUnit(uid: number, slotId: number): boolean {
    const u = this.unitByUid(uid);
    if (!u) return false;
    if (this.units.some((x) => x.slot === slotId && x.uid !== uid)) return false;
    if (!this.slots[slotId]) return false;
    u.slot = slotId;
    return true;
  }

  startRound(): boolean {
    if (this.phase !== "prep") return false;
    const round = this.round + 1;
    if (round > FINAL_ROUND) return false;
    this.round = round;
    this.phase = "combat";
    this.wave = waveForRound(round);
    this.spawnLeft = this.wave.count;
    this.spawnTimer = 0;
    this.spawnedAll = false;
    const spawnSpan = this.wave.count * (this.wave.type === "swarm" ? 0.42 : 0.55);
    this.roundTimer = this.wave.type === "boss" ? Infinity : Math.max(26, spawnSpan + 9);
    this.bossTimer = 0;
    this.bossEnraged = false;
    this.enrageSpawnTimer = 0;
    const boss = bossForRound(round);
    this.emit({ type: "roundStart", amount: round, text: `${round}R — ${this.wave.enemyName}` });
    if (boss) this.emit({ type: "log", text: `⚠ 보스 접근: ${boss.name} — 약점: ${boss.weakness}` });
    return true;
  }

  chooseSelector(index: number): { ok: boolean; defId?: string } {
    if (!this.selectorOffer) return { ok: false };
    const defId = this.selectorOffer.options[index];
    if (!defId) return { ok: false };
    const free = this.freeSlots();
    if (free.length === 0) return { ok: false };
    const slot = this.rng.pick(free);
    const inst = this.makeUnit(defId, slot.id);
    const def = UNIT_BY_ID[defId];
    this.selectorOffer = null;
    this.emit({ type: "selectorReward", uid: inst.uid, unitDefId: defId, grade: def.grade, x: slot.x, y: slot.y });
    this.emit({ type: "log", text: `[보상] ${gradeLabel(def.grade)} ${def.name} 영입!` });
    return { ok: true, defId };
  }

  // ===== 시뮬레이션 =====

  /** 고정 틱 1회 진행 */
  tick(): void {
    if (this.phase === "victory" || this.phase === "defeat") return;
    this.time += TICK;

    if (this.phase === "prep") {
      this.prepTimer -= TICK;
      if (this.prepTimer <= 0 && !this.selectorOffer) this.startRound();
      return;
    }

    this.tickSpawn();
    this.tickEnemies();
    this.tickUnits();
    this.checkEnd();
  }

  private tickSpawn(): void {
    if (!this.wave || this.spawnLeft <= 0) return;
    this.spawnTimer -= TICK;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.wave.type === "boss" ? 0 : this.wave.type === "swarm" ? 0.42 : 0.55;
    this.spawnLeft--;
    if (this.spawnLeft === 0) this.spawnedAll = true;
    this.spawnEnemy(this.wave, false);
  }

  private spawnEnemy(wave: WaveDef, enrageAdd: boolean): void {
    const boss = wave.type === "boss" && !enrageAdd;
    const bossDef = boss ? bossForRound(wave.round) : undefined;
    const hpMult = this.difficulty.enemyHpMult * (enrageAdd ? 0.4 : 1);
    const e: EnemyInst = {
      uid: this.uidSeq++,
      name: enrageAdd ? "균열 잔당" : wave.enemyName,
      isBoss: boss,
      bossId: bossDef?.id,
      hp: Math.round(wave.hp * hpMult),
      maxHp: Math.round(wave.hp * hpMult),
      armor: wave.armor,
      dist: 0,
      speed: wave.speed * ENEMY_BASE_SPEED,
      radius: boss ? 30 : wave.type === "swarm" ? 10 : wave.type === "armored" ? 15 : 13,
      slowPct: 0, slowUntil: 0, stunUntil: 0,
      armorBreak: 0, amp: 0, dots: [],
      bounty: Math.max(1, Math.round((wave.goldReward / wave.count) * this.difficulty.goldMult * (enrageAdd ? 0.3 : 1))),
      slowResist: bossDef?.slowResist ?? 0,
    };
    this.enemies.push(e);
    if (boss) {
      const p = this.enemyPos(e);
      this.emit({ type: "bossSpawn", enemyUid: e.uid, text: e.name, x: p.x, y: p.y });
    }
  }

  private tickEnemies(): void {
    const t = this.time;
    for (const e of this.enemies) {
      // 도트
      let dotDmg = 0;
      e.dots = e.dots.filter((d) => {
        if (d.until >= t) { dotDmg += d.dps * TICK; return true; }
        return false;
      });
      if (dotDmg > 0) this.applyDamage(e, dotDmg, null, true);
      if (e.hp <= 0) continue;
      // 이동
      if (e.stunUntil > t) continue;
      const slow = e.slowUntil > t ? e.slowPct * (1 - e.slowResist) : 0;
      const enrage = e.isBoss && this.bossEnraged ? 1.5 : 1;
      e.dist += e.speed * (1 - slow) * enrage * TICK;
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // 보스 타이머/광폭화
    const boss = this.boss;
    if (boss && this.wave?.type === "boss") {
      this.bossTimer += TICK;
      if (!this.bossEnraged && this.bossTimer >= BOSS_ENRAGE_AT) {
        this.bossEnraged = true;
        this.emit({ type: "log", text: `⚠ ${boss.name} 광폭화! 잔당을 소환하기 시작합니다.` });
      }
      if (this.bossEnraged) {
        this.enrageSpawnTimer -= TICK;
        if (this.enrageSpawnTimer <= 0) {
          this.enrageSpawnTimer = 8;
          const w = waveForRound(Math.max(1, this.round - 1));
          for (let i = 0; i < 4; i++) this.spawnEnemy({ ...w, type: "normal" }, true);
        }
      }
    }
  }

  private tickUnits(): void {
    const t = this.time;
    for (const u of this.units) {
      u.buffAtk = u.buffAtk.filter((b) => b.until >= t);
      u.buffAspd = u.buffAspd.filter((b) => b.until >= t);
      const def = this.def(u);

      // 타이머 스킬
      const skills = def.skills ?? [];
      for (let i = 0; i < skills.length; i++) {
        const sk = skills[i];
        if (sk.trigger.kind !== "timer") continue;
        u.skillTimers[i] = (u.skillTimers[i] ?? sk.trigger.everySeconds) - TICK;
        if (u.skillTimers[i] <= 0) {
          u.skillTimers[i] = sk.trigger.everySeconds;
          this.castSkill(u, def, sk);
        }
      }

      // 공격
      const storm = def.family === "storm" ? this.famBonus("storm") : 1;
      const aspd = def.attackSpeed * storm * u.buffAspd.reduce((m, b) => m * b.mult, 1);
      u.cd -= TICK;
      for (let i = 0; i < skills.length; i++) {
        if (skills[i].trigger.kind === "onAttack" && (u.skillCds[i] ?? 0) > 0) u.skillCds[i] -= TICK;
      }
      if (u.cd > 0) continue;
      const target = this.pickTarget(u, def);
      if (!target) continue;
      u.cd = 1 / Math.max(0.05, aspd);
      this.performAttack(u, def, target);
    }
  }

  private pickTarget(u: UnitInst, def: UnitDef): EnemyInst | null {
    const p = this.unitPos(u);
    let best: EnemyInst | null = null;
    let bestKey = -Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const ep = this.enemyPos(e);
      const d = Math.hypot(ep.x - p.x, ep.y - p.y);
      if (d > def.range + e.radius) continue;
      let key: number;
      switch (def.targeting) {
        case "lowestHp": key = -e.hp; break;
        case "highestHp": key = e.hp; break;
        default: key = e.dist; break; // first = 가장 많이 진행
      }
      if (key > bestKey) { bestKey = key; best = e; }
    }
    return best;
  }

  private unitAttack(u: UnitInst): number {
    const def = this.def(u);
    const flame = def.family === "flame" ? this.famBonus("flame") : 1;
    return def.attack * flame * u.buffAtk.reduce((m, b) => m * b.mult, 1);
  }

  private performAttack(u: UnitInst, def: UnitDef, target: EnemyInst): void {
    const t = this.time;
    u.lastTarget = target.uid;
    const atk = this.unitAttack(u);
    const ironBonus = def.family === "iron" ? this.famBonus("iron") - 1 : 0;
    const bossBonus = target.isBoss ? 1 + (def.bossDamageBonus ?? 0) + ironBonus : 1;
    const tp = this.enemyPos(target);
    this.emit({ type: "hit", uid: u.uid, enemyUid: target.uid, x: tp.x, y: tp.y });

    const frostMult = def.family === "frost" ? this.famBonus("frost") : 1;
    const voidMult = def.family === "void" ? this.famBonus("void") : 1;
    const applyOnHit = (e: EnemyInst) => {
      if (def.slowPct) {
        e.slowPct = Math.max(e.slowUntil > t ? e.slowPct : 0, def.slowPct);
        e.slowUntil = Math.max(e.slowUntil, t + (def.slowDuration ?? 1.5) * frostMult * (1 - e.slowResist));
      }
      if (def.stunChance && this.rng.chance(def.stunChance)) {
        e.stunUntil = Math.max(e.stunUntil, t + (def.stunDuration ?? 0.5) * (1 - e.slowResist));
      }
      if (def.armorBreakPct) e.armorBreak = Math.min(0.6, e.armorBreak + def.armorBreakPct * 0.25 * voidMult);
      if (def.damageAmpPct) e.amp = Math.min(0.5, e.amp + def.damageAmpPct * 0.25 * voidMult);
    };

    const victims: EnemyInst[] = [target];
    if (def.splashRadius) {
      for (const e of this.enemies) {
        if (e === target || e.hp <= 0) continue;
        const ep = this.enemyPos(e);
        if (Math.hypot(ep.x - tp.x, ep.y - tp.y) <= def.splashRadius) victims.push(e);
      }
    }
    for (const e of victims) {
      applyOnHit(e);
      this.applyDamage(e, atk * bossBonus * (e === target ? 1 : 0.75), u, def.attackType === "true", def.attackType === "pierce");
      if (def.executePct && e.hp > 0 && !e.isBoss && e.hp <= e.maxHp * def.executePct) {
        this.applyDamage(e, e.hp + 1, u, true);
      }
    }

    // onAttack 스킬
    const skills = def.skills ?? [];
    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      if (sk.trigger.kind !== "onAttack") continue;
      if ((u.skillCds[i] ?? 0) > 0) continue;
      if (!this.rng.chance(sk.trigger.chance)) continue;
      u.skillCds[i] = sk.trigger.internalCd ?? 0.3;
      this.castSkill(u, def, sk, target);
    }
  }

  private castSkill(u: UnitInst, def: UnitDef, sk: SkillDef, attackTarget?: EnemyInst): void {
    const t = this.time;
    const atk = this.unitAttack(u);
    const up = this.unitPos(u);

    // 대상 결정
    let focus: EnemyInst | null = attackTarget ?? null;
    if (sk.target === "lowestHpEnemy" || sk.target === "highestHpEnemy") {
      let best: EnemyInst | null = null;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (!best) { best = e; continue; }
        if (sk.target === "lowestHpEnemy" ? e.hp < best.hp : e.hp > best.hp) best = e;
      }
      focus = best;
    } else if (!focus) {
      focus = this.pickTarget(u, def);
    }
    if (!focus && sk.target !== "alliesInRadius" && sk.target !== "self") return;
    const fp = focus ? this.enemyPos(focus) : up;

    let procRadius = 0;
    for (const ef of sk.effects) {
      switch (ef.type) {
        case "burst": {
          const radius = ef.radius ?? 0;
          procRadius = Math.max(procRadius, radius);
          const dmg = atk * ef.power;
          if (radius > 0) {
            for (const e of this.enemies) {
              if (e.hp <= 0) continue;
              const ep = this.enemyPos(e);
              if (Math.hypot(ep.x - fp.x, ep.y - fp.y) <= radius) {
                this.applyDamage(e, dmg * (e.isBoss ? 1 + (ef.bossBonus ?? 0) : 1), u, def.attackType === "true");
              }
            }
          } else if (focus) {
            this.applyDamage(focus, dmg * (focus.isBoss ? 1 + (ef.bossBonus ?? 0) : 1), u, def.attackType === "true");
          }
          break;
        }
        case "chain": {
          if (!focus) break;
          let cur: EnemyInst | null = focus;
          let power = ef.power;
          const visited = new Set<number>();
          for (let j = 0; j <= ef.maxJumps && cur; j++) {
            visited.add(cur.uid);
            this.applyDamage(cur, atk * power, u, def.attackType === "true");
            const cp: Vec2 = this.enemyPos(cur);
            power *= ef.falloff;
            let next: EnemyInst | null = null;
            let nd = 160;
            for (const e of this.enemies) {
              if (e.hp <= 0 || visited.has(e.uid)) continue;
              const ep = this.enemyPos(e);
              const d = Math.hypot(ep.x - cp.x, ep.y - cp.y);
              if (d < nd) { nd = d; next = e; }
            }
            cur = next;
          }
          procRadius = Math.max(procRadius, 60);
          break;
        }
        case "stun": {
          const radius = ef.radius ?? 0;
          procRadius = Math.max(procRadius, radius);
          const apply = (e: EnemyInst) => {
            e.stunUntil = Math.max(e.stunUntil, t + ef.duration * (1 - e.slowResist));
          };
          if (radius > 0) {
            for (const e of this.enemies) {
              const ep = this.enemyPos(e);
              if (Math.hypot(ep.x - fp.x, ep.y - fp.y) <= radius) apply(e);
            }
          } else if (focus) apply(focus);
          break;
        }
        case "slow": {
          const radius = ef.radius ?? 0;
          procRadius = Math.max(procRadius, radius);
          const apply = (e: EnemyInst) => {
            e.slowPct = Math.max(e.slowUntil > t ? e.slowPct : 0, ef.pct);
            e.slowUntil = Math.max(e.slowUntil, t + ef.duration * (1 - e.slowResist));
          };
          if (radius > 0) {
            for (const e of this.enemies) {
              const ep = this.enemyPos(e);
              if (Math.hypot(ep.x - fp.x, ep.y - fp.y) <= radius) apply(e);
            }
          } else if (focus) apply(focus);
          break;
        }
        case "execute": {
          if (focus && !focus.isBoss && focus.hp <= focus.maxHp * ef.pct) {
            this.applyDamage(focus, focus.hp + 1, u, true);
          }
          break;
        }
        case "armorBreak": if (focus) focus.armorBreak = Math.min(0.6, focus.armorBreak + 0.12); break;
        case "amp": if (focus) focus.amp = Math.min(0.5, focus.amp + 0.06); break;
        case "dot": if (focus) focus.dots.push({ dps: atk * ef.perSecond, until: t + ef.duration }); break;
        case "buffAttack": case "buffAttackSpeed": {
          const radius = ef.radius ?? 170;
          for (const ally of this.units) {
            const ap = this.unitPos(ally);
            if (Math.hypot(ap.x - up.x, ap.y - up.y) > radius) continue;
            const arr = ef.type === "buffAttack" ? ally.buffAtk : ally.buffAspd;
            arr.push({ mult: ef.mult, until: t + ef.duration });
          }
          procRadius = Math.max(procRadius, radius);
          break;
        }
      }
    }
    this.emit({ type: "skillProc", uid: u.uid, text: sk.name, x: fp.x, y: fp.y, radius: procRadius });
  }

  private applyDamage(e: EnemyInst, raw: number, source: UnitInst | null, ignoreArmor = false, pierce = false): void {
    if (e.hp <= 0) return;
    let dmg = raw * (1 + e.amp);
    if (!ignoreArmor) {
      const armor = Math.max(0, e.armor * (1 - e.armorBreak) * (pierce ? 0.6 : 1));
      dmg *= 1 - armor / (armor + ARMOR_K);
    }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    if (source) source.damageDealt += dmg;
    const p = this.enemyPos(e);
    this.emit({ type: "hit", enemyUid: e.uid, amount: dmg, x: p.x, y: p.y, crit: raw > 400 });
    if (e.hp <= 0) this.onKill(e, source);
  }

  private onKill(e: EnemyInst, source: UnitInst | null): void {
    this.totalKills++;
    let gold = e.bounty;
    if (source) {
      source.kills++;
      const def = this.def(source);
      if (def.killGoldBonus) gold += def.killGoldBonus;
      if (def.family === "forest") gold += this.famLevels.forest;
    }
    this.gold += gold;
    const p = this.enemyPos(e);
    this.emit({ type: "kill", enemyUid: e.uid, amount: gold, x: p.x, y: p.y });
    if (e.isBoss) {
      this.emit({ type: "bossKill", text: e.name, x: p.x, y: p.y });
      this.emit({ type: "log", text: `👑 보스 ${e.name} 처치!` });
    }
  }

  private checkEnd(): void {
    // 패배: 적 한도 초과
    const alive = this.enemies.length;
    if (alive >= this.difficulty.enemyLimit) {
      this.phase = "defeat";
      this.emit({ type: "defeat", text: `적이 한계(${this.difficulty.enemyLimit})에 도달했습니다.` });
      return;
    }
    // 라운드 시간 만료 → 정리 못 한 적을 남긴 채 다음 웨이브 강행 (누적 압박)
    if (this.wave && this.wave.type !== "boss") {
      this.roundTimer -= TICK;
      if (this.roundTimer <= 0 && this.spawnedAll && alive > 0 && this.round < FINAL_ROUND) {
        const leftover = alive;
        this.phase = "prep";
        this.wave = null;
        this.prepTimer = 0.01; // 즉시 다음 라운드
        this.emit({ type: "log", text: `⚠ ${this.round}R 시간 초과 — 적 ${leftover}기가 남은 채 다음 웨이브!` });
        return;
      }
    }
    // 라운드 클리어
    if (this.wave && this.spawnedAll && alive === 0) {
      const wave = this.wave;
      this.wave = null;
      const bonus = Math.round((20 + wave.round * 4) * this.difficulty.goldMult);
      this.gold += bonus;
      this.emit({ type: "roundClear", amount: wave.round, text: `+${bonus}G` });
      this.emit({ type: "log", text: `${wave.round}R 클리어 (+${bonus} 골드)` });

      if (wave.reward?.selector) {
        const grade = wave.reward.selector.grade;
        const pool = unitsOfGrade(grade);
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = this.rng.int(i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        this.selectorOffer = { grade, options: shuffled.slice(0, 3).map((d) => d.id) };
      }

      if (wave.round >= FINAL_ROUND) {
        this.phase = "victory";
        this.emit({ type: "victory", text: "40라운드 최종 보스 격파! 다음 맵 선택권을 획득했습니다." });
        return;
      }
      this.phase = "prep";
      this.prepTimer = PREP_BETWEEN;
    }
  }

  private makeUnit(defId: string, slot: number): UnitInst {
    const inst: UnitInst = {
      uid: this.uidSeq++,
      defId,
      slot,
      cd: 0,
      skillTimers: [],
      skillCds: [],
      buffAtk: [],
      buffAspd: [],
      damageDealt: 0,
      kills: 0,
      lastTarget: 0,
    };
    this.units.push(inst);
    return inst;
  }

  private emit(ev: GameEvent): void {
    this.events.push(ev);
  }

  /** UI가 프레임마다 가져가서 비운다 */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

export function gradeLabel(g: Grade): string {
  return { common: "일반", rare: "희귀", hero: "영웅", legend: "전설", hidden: "히든" }[g];
}
