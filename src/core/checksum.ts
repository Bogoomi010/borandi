import type { GameState } from "./types";

/** FNV-1a 32bit 문자열 해시 */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 상태 체크섬: 렌더링과 무관한 핵심 필드만 사용 */
export function stateChecksum(s: GameState): string {
  const core = {
    v: s.dataVersion,
    seed: s.seed,
    diff: s.difficulty,
    stage: s.stageId,
    tick: s.tick,
    round: s.round,
    phase: s.phase,
    life: s.life,
    gold: s.gold,
    units: s.units.map((u) => [u.uid, u.defId, u.locked ? 1 : 0, Math.round(u.x), Math.round(u.y)]),
    enemies: s.enemies.map((e) => [e.eid, Math.round(e.hp * 100), Math.round(e.dist * 100)]),
    missions: s.missions.map((m) => [m.defId, m.status]),
    upg: s.upgrades,
    stats: s.summonStats,
  };
  return fnv1a(JSON.stringify(core));
}
