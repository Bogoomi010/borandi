// ===== 정적 데이터 정의 =====

export type Grade = "common" | "rare" | "hero" | "legend" | "hidden";
export type Family = "flame" | "frost" | "storm" | "iron" | "void" | "forest";
export type Role = "waveClear" | "hold" | "bossKiller" | "debuff" | "economy" | "finisher";
export type AttackType = "physical" | "magic" | "pierce" | "true";
export type Targeting = "first" | "lowestHp" | "highestHp";

export type SkillEffect =
  | { type: "burst"; power: number; radius?: number; bossBonus?: number }
  | { type: "stun"; duration: number; radius?: number }
  | { type: "slow"; pct: number; duration: number; radius?: number }
  | { type: "execute"; pct: number }
  | { type: "chain"; power: number; maxJumps: number; falloff: number }
  | { type: "armorBreak" }
  | { type: "amp" }
  | { type: "dot"; perSecond: number; duration: number }
  | { type: "buffAttack"; mult: number; duration: number; radius?: number }
  | { type: "buffAttackSpeed"; mult: number; duration: number; radius?: number };

export type SkillTrigger =
  | { kind: "onAttack"; chance: number; internalCd?: number }
  | { kind: "timer"; everySeconds: number };

export type SkillTarget =
  | "currentTarget" | "areaAroundTarget" | "lowestHpEnemy" | "highestHpEnemy" | "alliesInRadius" | "self";

export interface SkillDef {
  id: string;
  name: string;
  icon: "skill" | "damage" | "passive" | "summon";
  trigger: SkillTrigger;
  target: SkillTarget;
  effects: SkillEffect[];
  desc: string;
}

export interface UnitDef {
  id: string;
  name: string;
  grade: Grade;
  family: Family;
  roles: Role[];
  attackType: AttackType;
  attack: number;
  attackSpeed: number;
  range: number;
  targeting: Targeting;
  splashRadius?: number;
  slowPct?: number;
  slowDuration?: number;
  stunChance?: number;
  stunDuration?: number;
  bossDamageBonus?: number;
  armorBreakPct?: number;
  damageAmpPct?: number;
  killGoldBonus?: number;
  executePct?: number;
  desc: string;
  skills?: SkillDef[];
}

export interface RecipeDef {
  id: string;
  resultUnitId: string;
  ingredients: { unitId: string; count: number }[];
  cost: { gold: number };
  visibility: "visible" | "hidden";
  minRound?: number;
}

export interface BossDef {
  id: string;
  name: string;
  round: number;
  slowResist: number;
  weakness: string;
  hint: string;
}

export type WaveType = "normal" | "swarm" | "armored" | "mixed" | "boss";

export interface WaveDef {
  round: number;
  type: WaveType;
  enemyName: string;
  count: number;
  hp: number;
  speed: number;
  armor: number;
  goldReward: number;
  bossId?: string;
  reward?: { selector?: { grade: Grade; count: number } };
}

export interface DifficultyDef {
  id: string;
  name: string;
  unitCap: number;
  enemyHpMult: number;
  enemyLimit: number;
  goldMult: number;
  startGold: number;
}

export interface StageDef {
  id: string;
  name: string;
  subtitle: string;
  /** 닫힌 루프 제어점 (1280x720 보드 좌표) */
  loop: { x: number; y: number }[];
  theme: {
    ground: number;
    groundDark: number;
    path: number;
    pathEdge: number;
    accent: number;
    fog: number;
    /** 하늘 그라데이션 (위→아래) */
    skyTop: number;
    skyBottom: number;
    /** 구름 불투명도 (0이면 구름 없음) */
    cloudAlpha: number;
  };
}

export interface UpgradeDef {
  id: string;
  family: Family;
  name: string;
  desc: string;
  baseCost: number;
  costGrowth: number;
  effectPerLevel: number;
  maxLevel: number;
}

// ===== 런타임 상태 =====

export interface Vec2 { x: number; y: number }

export interface SlotDef { id: number; x: number; y: number }

export interface UnitInst {
  uid: number;
  defId: string;
  slot: number;
  /** 남은 공격 쿨다운 (초) */
  cd: number;
  /** 타이머 스킬 잔여 시간 */
  skillTimers: number[];
  /** onAttack 스킬 내부 쿨다운 잔여 */
  skillCds: number[];
  buffAtk: { mult: number; until: number }[];
  buffAspd: { mult: number; until: number }[];
  damageDealt: number;
  kills: number;
  /** 마지막 공격 대상 uid (연출용) */
  lastTarget: number;
}

export interface EnemyInst {
  uid: number;
  name: string;
  isBoss: boolean;
  bossId?: string;
  hp: number;
  maxHp: number;
  armor: number;
  /** 경로 진행 거리 (px) */
  dist: number;
  /** px/s */
  speed: number;
  radius: number;
  slowPct: number;
  slowUntil: number;
  stunUntil: number;
  armorBreak: number;
  amp: number;
  dots: { dps: number; until: number }[];
  bounty: number;
  slowResist: number;
}

export type GamePhase = "prep" | "combat" | "victory" | "defeat";

export interface GameEvent {
  type:
    | "log" | "summon" | "merge" | "craft" | "sell" | "kill" | "leak"
    | "roundStart" | "roundClear" | "bossSpawn" | "bossKill" | "skillProc"
    | "hit" | "gold" | "defeat" | "victory" | "selectorReward" | "pity";
  text?: string;
  uid?: number;
  enemyUid?: number;
  unitDefId?: string;
  amount?: number;
  x?: number;
  y?: number;
  radius?: number;
  crit?: boolean;
  grade?: Grade;
}

export interface SelectorOffer {
  grade: Grade;
  options: string[]; // unitDef ids
}
