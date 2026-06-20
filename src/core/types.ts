// ===== 공통 타입 정의 (game core) =====

export type Grade = "common" | "rare" | "hero" | "legend" | "hidden";
export type Family = "flame" | "frost" | "storm" | "iron" | "void" | "forest";
export type Role = "waveClear" | "bossKiller" | "debuff" | "hold" | "finisher" | "economy";
export type AttackType = "physical" | "magic" | "pierce" | "true";
export type Targeting = "first" | "last" | "highestHp" | "lowestHp";

export const GRADE_ORDER: Grade[] = ["common", "rare", "hero", "legend", "hidden"];
export const FAMILIES: Family[] = ["flame", "frost", "storm", "iron", "void", "forest"];

export const GRADE_LABEL: Record<Grade, string> = {
  common: "일반", rare: "희귀", hero: "영웅", legend: "전설", hidden: "히든",
};
export const FAMILY_LABEL: Record<Family, string> = {
  flame: "화염", frost: "서리", storm: "폭풍", iron: "강철", void: "공허", forest: "숲",
};
export const ROLE_LABEL: Record<Role, string> = {
  waveClear: "라인딜", bossKiller: "보스딜", debuff: "약화",
  hold: "홀딩", finisher: "마무리", economy: "경제",
};

export interface UnitDef {
  id: string;
  name: string;
  grade: Grade;
  family: Family;
  roles: Role[];
  attackType: AttackType;
  attack: number;
  attackSpeed: number; // 초당 공격 횟수
  range: number; // px
  targeting: Targeting;
  /** 패시브 효과 수치 (없으면 0) */
  splashRadius?: number;       // flame: 스플래시 반경
  slowPct?: number;            // frost: 명중 시 감속 %
  slowDuration?: number;       // frost: 감속 지속(초)
  stunChance?: number;         // frost(상위): 빙결 확률
  stunDuration?: number;
  bossDamageBonus?: number;    // iron: 보스 추가 피해 %
  armorBreakPct?: number;      // void: 스택당 방어 감소 비율
  damageAmpPct?: number;       // void: 받는 피해 증폭 스택
  killGoldBonus?: number;      // forest(숲): 처치 골드 보너스
  executePct?: number;         // storm finisher: 체력 % 이하 즉시 처치
  desc?: string;
}

export interface RecipeIngredient {
  unitId?: string;
  grade?: Grade;
  family?: Family;
  count: number;
}

export interface RecipeDef {
  id: string;
  resultUnitId: string;
  ingredients: RecipeIngredient[];
  cost: { gold: number };
  visibility: "visible" | "hidden";
  minRound?: number;
}

export type MissionCondition =
  | { type: "collectFamilies"; grade: Grade; countEach: number }
  | { type: "craftCount"; count: number }
  | { type: "ownFamily"; family: Family; count: number }
  | { type: "ownRole"; role: Role; count: number }
  | { type: "ownGrade"; grade: Grade; count: number }
  | { type: "noLeakUntil"; round: number }
  | { type: "pityTriggered"; count: number }
  | { type: "merge3Count"; count: number }
  | { type: "upgradeTotal"; level: number }
  | { type: "goldAtOnce"; gold: number }
  | { type: "bossKillUnderSec"; round: number; seconds: number };

export interface RewardDef {
  gold?: number;
  selector?: { grade: Grade; count: number };
  /** 다음 보스 감속 저항 감소(0~1) */
  bossSlowResistReduction?: number;
  /** 특정 보스 처치 시 추가 골드 */
  bossKillBonusGold?: { round: number; gold: number };
}

export interface MissionDef {
  id: string;
  name: string;
  visibility: "visible" | "hidden";
  expireRound?: number;
  condition: MissionCondition;
  reward: RewardDef;
  desc: string;
}

export type WaveType = "normal" | "swarm" | "armored" | "mixed" | "boss";

export interface WaveDef {
  round: number;
  type: WaveType;
  enemyName: string;
  count: number;
  hp: number;
  speed: number; // 1.0 = 기준 속도
  armor: number;
  goldReward: number;
  bossId?: string;
  reward?: RewardDef;
}

export interface BossDef {
  id: string;
  name: string;
  round: number;
  slowResist: number; // 0~1
  weakness: string;
  hint: string;
}

export interface UpgradeDef {
  id: string;
  family: Family;
  name: string;
  stat: "attack" | "attackSpeed" | "bossDamage" | "slowDuration" | "debuffPower" | "killGold";
  baseCost: number;
  costGrowth: number;
  effectPerLevel: number; // 0.12 = +12%/lv
  maxLevel: number;
}

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  unitCap: number;
  enemyHpMult: number;
  enemyLimit: number;
  goldMult: number;
  startGold: number;
  startLife: number;
}

export type DifficultyId = "novice" | "normal" | "intermediate" | "expert" | "master";

// ===== 런타임 상태 =====

/** 유닛 행동 상태 (렌더/디버그용) */
export type UnitState = "idle" | "moving" | "attacking" | "chasing" | "hold" | "dead";

/** 유닛 명령. 플레이어 명령이 자동 행동보다 우선한다. */
// x,y = 이 유닛의 개별 목적지(대형 슬롯). cx,cy = 플레이어가 우클릭한 명령 지점(점선 표시용).
export type UnitOrder =
  | { kind: "none" }                          // 대기: 시야 내 적 자동 교전(앵커 leash)
  | { kind: "move"; x: number; y: number; cx: number; cy: number }    // 이동: 적 무시하고 목적지 우선
  | { kind: "attackMove"; x: number; y: number; cx: number; cy: number } // 공격 이동: 이동 중 적 교전
  | { kind: "attack"; targetEid: number }     // 지정 공격: leash 내 추적
  | { kind: "hold" };                          // 정지: 이동 안 함, 사거리 내만 자동 공격

export interface OwnedUnit {
  uid: number;
  defId: string;
  locked: boolean;
  x: number; // 전투판 자유 배치 좌표 (논리 960x560)
  y: number;
  acquiredRound: number;
  totalDamage: number;
  cooldown: number; // 남은 공격 쿨다운 (초)
  state: UnitState;
  order: UnitOrder;
  anchorX: number; // leash 기준점(복귀 위치)
  anchorY: number;
}

export interface SlowEffect { pct: number; until: number; }

export interface EnemyState {
  eid: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  dist: number; // 경로 진행 거리(px)
  isBoss: boolean;
  slows: SlowEffect[];
  stunUntil: number;
  armorBreakStacks: number;
  ampStacks: number;
  spawnAt: number; // 게임 시간(초)
}

export type Phase = "prepare" | "wave" | "reward" | "ended";

export interface PendingSelector {
  id: string;
  grade: Grade;
  candidateIds: string[];
  source: string;
}

export interface MissionState {
  defId: string;
  status: "active" | "done" | "expired";
  completedRound?: number;
}

export interface LogEvent {
  round: number;
  kind: "summon" | "merge" | "craft" | "sell" | "mission" | "boss" | "wave" | "upgrade" | "reward" | "system";
  text: string;
}

export interface GameInput {
  tick: number;
  type: "summon" | "merge3" | "craft" | "sell" | "upgrade" | "toggleLock"
      | "startWave" | "nextRound" | "pickSelector" | "setSpeed"
      | "cmdMove" | "cmdAttackMove" | "cmdAttack" | "cmdStop"
      | "devSpawn"; // DEV전용: 원하는 유닛 즉시 생성 (출시 전 제거)
  payload?: Record<string, unknown>;
}

export interface GameState {
  dataVersion: string;
  seed: string;
  difficulty: DifficultyDef["id"];
  stageId: number;
  tick: number;
  time: number; // 게임 시간(초)
  round: number;
  phase: Phase;
  life: number;
  gold: number;
  units: OwnedUnit[];
  enemies: EnemyState[];
  missions: MissionState[];
  discoveredRecipeIds: string[];
  upgrades: Record<string, number>;
  pendingSelectors: PendingSelector[];
  summonStats: { rolls: number; consecutiveCommon: number; pityTriggered: number };
  craftCount: number;
  merge3Count: number;
  leakedRounds: number[];
  waveLeaks: number;
  bossSlowResistReduction: number;
  bossKillBonus: { round: number; gold: number } | null;
  heroPityGiven: boolean;
  bossSpawnTime: number;
  bossKillSeconds: Record<number, number>; // round -> 처치까지 걸린 초
  bossFailedRounds: number[];
  cleared: boolean;
  log: LogEvent[];
  inputHistory: GameInput[];
  nextUid: number;
  nextEid: number;
  waveSpawned: number; // 이번 웨이브에서 스폰된 수
  waveKilled: number;
  /** 라운드 사이 휴식 남은 틱 (>0이면 다음 라운드 스폰 대기 중). 0이면 스폰 진행. */
  breakTicks: number;
  speed: 1 | 2 | 3;
}

export interface ResultSummary {
  seed: string;
  difficultyId: DifficultyId;
  difficulty: string;
  stageId: number;
  stageName: string;
  dataVersion: string;
  stateChecksum: string;
  cleared: boolean;
  reachedRound: number;
  life: number;
  maxGrade: Grade;
  legendCount: number;
  hiddenCount: number;
  legendOrBetterCount: number;
  missionsDone: number;
  missionsTotal: number;
  topDealers: { name: string; grade: Grade; damage: number }[];
  failHint: string | null;
  bossKills: { round: number; seconds: number }[];
  bossFails: number[];
  pityTriggered: number;
  craftCount: number;
  merge3Count: number;
  inputCount: number;
  inputCounts: Record<string, number>;
  playedAt: string;
  manualStartedAt?: string;
  wallSeconds?: number;
  unlockedNextStage?: boolean;
}
