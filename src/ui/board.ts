// 캔버스 전투판 렌더러 — 에셋 없이 도형과 색으로만 표현한다.
// 등급 = 테두리 색 + 도형, 계열 = 채움 색.

import { BOARD_H, BOARD_W, pathLengthForStage, waypointsForStage, posAtDist } from "../core/path";
import type { GameState, Grade } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { FINAL_ROUND, waveForRound } from "../data/waves";
import { alien1Walk } from "./sprites";
import { UNIT_SPRITES, type Facing } from "./unitSprites";
import { stageById, type StageDecorationKind } from "../data/stages";
import tilesetUrl from "../assets/tilesets/dark-fantasy-village-tileset.png";
import enemyPortalUrl from "../assets/effects/enemy-portal.png";

const GRADE_COLOR: Record<Grade, string> = {
  common: "#b9ac92", rare: "#5bb6d6", hero: "#b07bff",
  legend: "#ffb347", hidden: "#df6aa0",
};
const FAMILY_COLOR: Record<string, string> = {
  flame: "#ff6b4a", frost: "#56c8ff", storm: "#ffe14d",
  iron: "#cdbfa6", void: "#b07bff", forest: "#7fdd72",
};

const FAMILY_INITIAL: Record<string, string> = {
  flame: "화", frost: "서", storm: "폭", iron: "강", void: "공", forest: "숲",
};

const GROUND_COLOR = {
  dirt: "#3a2c1d",
  ash: "#46403a",
  grass: "#46512f",
  stone: "#403a30",
  corrupt: "#352338",
  blood: "#3a2018",
  rune: "#2c2535",
} as const;

const ATLAS: Record<StageDecorationKind, [number, number, number, number]> = {
  cottage: [42, 80, 150, 160],
  stoneHouse: [212, 80, 150, 160],
  witchHut: [382, 80, 158, 160],
  rootHouse: [552, 80, 150, 160],
  manor: [722, 80, 160, 160],
  forge: [942, 78, 180, 165],
  crypt: [1210, 78, 205, 165],
  deadTree: [812, 318, 126, 180],
  oak: [948, 310, 150, 188],
  rottenTree: [1084, 318, 130, 180],
  soulTree: [1220, 306, 168, 192],
  specialTree: [40, 584, 195, 232],
  thornBush: [1398, 350, 90, 80],
  poisonBush: [1498, 350, 94, 80],
  berryBush: [1598, 350, 94, 80],
  grave: [846, 588, 82, 116],
  coffin: [1126, 588, 100, 116],
  shrine: [1228, 604, 106, 96],
  fenceWood: [1084, 1214, 112, 110],
  fenceIron: [1204, 1214, 112, 110],
  gate: [1444, 1214, 112, 120],
  market: [672, 988, 110, 100],
  well: [48, 988, 100, 100],
  cart: [256, 988, 110, 100],
  farmlandDead: [50, 332, 118, 82],
  farmlandSprouts: [174, 332, 118, 82],
  farmlandCursed: [298, 332, 118, 82],
  rocks: [50, 1222, 74, 70],
  runeStone: [706, 1222, 74, 78],
  mushrooms: [378, 1222, 74, 70],
  web: [952, 1222, 78, 78],
};

class VillageTileset {
  private img = new Image();
  private source: HTMLCanvasElement | null = null;
  loaded = false;

  constructor() {
    this.img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = this.img.naturalWidth;
      canvas.height = this.img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(this.img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) data[i + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
      this.source = canvas;
      this.loaded = true;
    };
    this.img.src = tilesetUrl;
  }

  draw(ctx: CanvasRenderingContext2D, kind: StageDecorationKind, x: number, y: number, scale = 1) {
    const src = ATLAS[kind];
    if (!src || !this.loaded || !this.source) return false;
    const [sx, sy, sw, sh] = src;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.source, sx, sy, sw, sh, x, y, sw * scale, sh * scale);
    return true;
  }
}

const villageTileset = new VillageTileset();

class EnemyPortalAsset {
  private img = new Image();
  loaded = false;

  constructor() {
    this.img.onload = () => {
      this.loaded = true;
    };
    this.img.src = enemyPortalUrl;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
    const pulse = 1 + Math.sin(time * 2.4) * 0.035;
    const size = 108 * pulse;
    ctx.save();
    ctx.translate(x, y);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.38 + Math.sin(time * 3.1) * 0.08;
    ctx.fillStyle = "#d9743a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 42 * pulse, 24 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    if (this.loaded) {
      ctx.rotate(Math.sin(time * 0.35) * 0.035);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.img, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    // 이미지 로드 전 fallback. 실제 에셋이 뜨기 전에도 출발 지점이 비어 보이지 않게 한다.
    ctx.strokeStyle = "#f0a850";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ffd98a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 31, time % (Math.PI * 2), time % (Math.PI * 2) + Math.PI * 1.15);
    ctx.stroke();
    ctx.restore();
  }
}

const enemyPortal = new EnemyPortalAsset();

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  selectedUids = new Set<number>();
  /** 고대비 모드: 유닛 위 계열 이니셜 표시 */
  showLabels = false;
  /** 적 피격 데미지 숫자 표시 */
  showDamage = true;
  /** 적 eid별 직전 프레임 메타 (데미지/이펙트 산출용, 렌더 전용·결정론 무관) */
  private enemyMeta = new Map<number, { x: number; y: number; hp: number; maxHp: number; isBoss: boolean; hit: number }>();
  /** 떠오르는 데미지 숫자 */
  private floaters: { x: number; y: number; amount: number; born: number; frac: number; boss: boolean }[] = [];
  /** 파티클(스파크/처치 버스트/머즐), 빔(트레이서), 링(충격파) — 전부 렌더 전용 */
  private particles: { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string; size: number; grav: number }[] = [];
  private beams: { x0: number; y0: number; x1: number; y1: number; born: number; life: number; color: string; width: number }[] = [];
  private rings: { x: number; y: number; born: number; life: number; color: string; r: number }[] = [];
  /** 유닛 uid별 직전 쿨다운 (발사 엣지 감지용) */
  private unitCd = new Map<number, number>();
  /** 라운드 종료 후 다음 라운드 자동 시작까지 남은 초 (null이면 표시 안 함) */
  autoStartIn: number | null = null;
  /** 드래그 다중 선택 박스 (보드 좌표, 없으면 null) */
  selectBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** 공격 이동(A) 대기 모드 — 커서 표시용 */
  attackMoveMode = false;
  /** 유닛 좌우 방향 추적 (이동 방향 기반, 스프라이트 facing용) */
  private unitFacing = new Map<number, { x: number; face: Facing }>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context 없음");
    this.ctx = ctx;
  }

  /** 런 전환 시 렌더 전용 상태 초기화 (이전 런의 데미지 숫자/HP 잔재 제거) */
  resetFx() {
    this.enemyMeta.clear();
    this.floaters.length = 0;
    this.particles.length = 0;
    this.beams.length = 0;
    this.rings.length = 0;
    this.unitCd.clear();
  }

  // ---------- 이펙트 스폰 헬퍼 ----------

  private spawnSparks(x: number, y: number, color: string, count: number, speed: number, now: number) {
    if (this.particles.length > 520) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.3,
        born: now, life: 0.28 + Math.random() * 0.28,
        color, size: 1.4 + Math.random() * 2.2, grav: speed * 1.6,
      });
    }
  }

  private spawnBeam(x0: number, y0: number, x1: number, y1: number, color: string, width: number, now: number) {
    if (this.beams.length > 140) this.beams.shift();
    this.beams.push({ x0, y0, x1, y1, born: now, life: 0.11, color, width });
  }

  private spawnDeath(x: number, y: number, color: string, isBoss: boolean, now: number) {
    this.spawnSparks(x, y, color, isBoss ? 26 : 12, isBoss ? 130 : 78, now);
    this.spawnSparks(x, y, "#fff3d0", isBoss ? 10 : 5, isBoss ? 90 : 54, now);
    if (this.rings.length > 44) this.rings.shift();
    this.rings.push({ x, y, born: now, life: isBoss ? 0.5 : 0.32, color, r: isBoss ? 60 : 28 });
  }

  /** 사거리 안 가장 가까운 적의 화면 좌표 (없으면 null) — 트레이서 표적용 */
  private nearestEnemyPos(state: GameState, ux: number, uy: number, range: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = range * range;
    for (const e of state.enemies) {
      const p = posAtDist(e.dist, state.stageId);
      const dx = p.x - ux, dy = p.y - uy;
      const d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /** 화면 좌표 → 논리 보드 좌표 */
  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * BOARD_W,
      y: ((clientY - rect.top) / rect.height) * BOARD_H,
    };
  }

  /** 화면 좌표에 있는 유닛 uid (없으면 -1). 위에 그려진(나중에 추가된) 유닛 우선. */
  unitAt(state: GameState, clientX: number, clientY: number): number {
    const { x, y } = this.toBoard(clientX, clientY);
    for (let i = state.units.length - 1; i >= 0; i--) {
      const u = state.units[i];
      if (Math.hypot(u.x - x, u.y - y) < 16) return u.uid;
    }
    return -1;
  }

  /** 화면 좌표에 있는 적 eid (없으면 -1). 보스 우선·위에 그려진 적 우선. */
  enemyAt(state: GameState, clientX: number, clientY: number): number {
    const { x, y } = this.toBoard(clientX, clientY);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const p = posAtDist(e.dist, state.stageId);
      const r = e.isBoss ? 48 : 26;
      if (Math.hypot(p.x - x, p.y - y) <= r) return e.eid;
    }
    return -1;
  }

  /** 박스(보드 좌표) 안에 들어온 유닛 uid 목록 */
  unitsInBox(state: GameState, box: { x0: number; y0: number; x1: number; y1: number }): number[] {
    const minX = Math.min(box.x0, box.x1), maxX = Math.max(box.x0, box.x1);
    const minY = Math.min(box.y0, box.y1), maxY = Math.max(box.y0, box.y1);
    return state.units
      .filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY)
      .map((u) => u.uid);
  }

  draw(state: GameState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    const stage = stageById(state.stageId);
    const waypoints = waypointsForStage(state.stageId);
    const pathLength = pathLengthForStage(state.stageId);

    ctx.fillStyle = GROUND_COLOR[stage.ground];
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    this.drawGroundTexture(stage.ground, state.stageId);
    this.drawDecorations(stage.decorations.filter((d) => d.y < 250));

    // 경로 (새 게임에서 선택한 맵의 닫힌 루프)
    ctx.lineWidth = 34;
    ctx.strokeStyle = "#241712";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(waypoints[0][0], waypoints[0][1]);
    for (let i = 1; i < waypoints.length; i++) ctx.lineTo(waypoints[i][0], waypoints[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stage.ground === "rune" ? "#8052d9" : "#5a4226";
    ctx.stroke();

    // 진행 방향 화살표
    ctx.fillStyle = "#7a5a30";
    for (let d = 160; d < pathLength; d += 260) {
      const p = posAtDist(d, state.stageId);
      const p2 = posAtDist(d + 8, state.stageId);
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${stage.id}. ${stage.name}`, 14, 22);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(226,223,233,.75)";
    ctx.fillText(stage.subtitle, 14, 38);

    this.drawDecorations(stage.decorations.filter((d) => d.y >= 250));
    this.drawEnemyPortal(waypoints[0][0], waypoints[0][1], state.time);

    // 유닛
    for (const u of state.units) {
      const def = UNIT_BY_ID[u.defId];
      const s = { x: u.x, y: u.y };
      const selected = this.selectedUids.has(u.uid);
      const justFired = u.cooldown > 0 && u.cooldown > 1 / def.attackSpeed - 0.12;

      // 발사 엣지 감지 → 트레이서 + 머즐 플래시 (한 발당 1회)
      const prevCd = this.unitCd.get(u.uid);
      if (prevCd !== undefined && u.cooldown > prevCd + 0.001) {
        const color = FAMILY_COLOR[def.family] ?? "#ffd98a";
        const target = this.nearestEnemyPos(state, s.x, s.y, def.range + 12);
        if (target) {
          const w = def.grade === "legend" || def.grade === "hidden" ? 3.2 : def.grade === "hero" ? 2.4 : 1.7;
          this.spawnBeam(s.x, s.y - 2, target.x, target.y, color, w, state.time);
        }
        this.spawnSparks(s.x, s.y - 2, color, 3, 26, state.time);
      }
      this.unitCd.set(u.uid, u.cooldown);

      // 사거리 표시 (선택 시)
      if (selected) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, def.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(232,181,77,.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // 이동/공격 목적지 안내선
        const o = u.order;
        if (o.kind === "move" || o.kind === "attackMove") {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(o.cx, o.cy); // 우클릭한 명령 지점(대형 슬롯이 아닌)으로 정확히 표시
          ctx.strokeStyle = o.kind === "attackMove" ? "rgba(229,83,75,.5)" : "rgba(108,221,139,.5)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          // 명령 지점 마커
          ctx.fillStyle = o.kind === "attackMove" ? "rgba(229,83,75,.8)" : "rgba(108,221,139,.8)";
          ctx.beginPath();
          ctx.arc(o.cx, o.cy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 선택 표시: 발밑 초록 셀렉션 링
      if (selected) {
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 9, 13, 5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "#6cdd8b";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 좌우 방향 추적 (이동 방향)
      const prevF = this.unitFacing.get(u.uid);
      let face: Facing = prevF?.face ?? "east";
      if (prevF) {
        const dx = u.x - prevF.x;
        if (dx > 0.4) face = "east"; else if (dx < -0.4) face = "west";
      }
      this.unitFacing.set(u.uid, { x: u.x, face });

      // 스프라이트가 등록된 유닛은 애니메이션으로, 아니면 도형으로 표현
      const sprite = UNIT_SPRITES[def.id];
      const drew = sprite
        ? sprite.draw(ctx, s.x, s.y, u.state, face, state.time, u.uid * 2, 96)
        : false;

      if (!drew) {
        ctx.fillStyle = FAMILY_COLOR[def.family];
        ctx.strokeStyle = selected ? "#ffffff" : GRADE_COLOR[def.grade];
        ctx.lineWidth = selected ? 3 : 2;
        this.drawGradeShape(s.x, s.y, def.grade, justFired ? 13 : 11);
        ctx.fill();
        ctx.stroke();

        if (this.showLabels) {
          ctx.fillStyle = "#0b0d12";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(FAMILY_INITIAL[def.family], s.x, s.y + 3);
          ctx.textAlign = "left";
        }
      }

      // 상태/잠금 마커
      if (u.state === "hold") {
        ctx.fillStyle = "#ffd54a";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("H", s.x, s.y - 11);
        ctx.textAlign = "left";
      }
      if (u.locked) {
        ctx.fillStyle = "#ffd54a";
        ctx.font = "9px sans-serif";
        ctx.fillText("L", s.x + 8, s.y - 9);
      }
    }

    // 적 — 외계인 걷기 스프라이트로 표현 (등급/상태는 크기·틴트로 구분)
    // 직전 프레임 HP를 비교해 데미지 숫자를 띄운다(렌더 전용, 게임 상태 불변).
    const prevMeta = this.enemyMeta;
    this.enemyMeta = new Map();
    let boss: GameState["enemies"][number] | null = null;
    for (const e of state.enemies) {
      const p = posAtDist(e.dist, state.stageId);
      if (e.isBoss) boss = e;
      const slowed = e.slows.length > 0;
      const stunned = e.stunUntil > state.time;
      const size = e.isBoss ? 96 : 52;
      const r = size / 2;

      const prev = prevMeta.get(e.eid);
      let hitT = prev?.hit ?? -1;
      if (prev !== undefined && e.hp < prev.hp - 0.5) {
        const amount = prev.hp - e.hp;
        hitT = state.time;
        const big = amount > e.maxHp * 0.1;
        if (this.showDamage) {
          this.floaters.push({
            x: p.x + ((e.eid % 5) - 2) * 4,
            y: p.y - r * 0.6,
            amount,
            born: state.time,
            frac: amount / Math.max(1, e.maxHp),
            boss: e.isBoss,
          });
          if (this.floaters.length > 90) this.floaters.shift();
        }
        // 피격 스파크 (항상)
        this.spawnSparks(p.x, p.y - r * 0.45, big ? "#ffd36a" : "#fff0c4", big ? 6 : 3, big ? 95 : 58, state.time);
      }
      this.enemyMeta.set(e.eid, { x: p.x, y: p.y, hp: e.hp, maxHp: e.maxHp, isBoss: e.isBoss, hit: hitT });

      // 진행 방향: 살짝 앞 지점과 비교해 좌우 반전 결정
      const ahead = posAtDist(e.dist + 4, state.stageId);
      const faceLeft = ahead.x < p.x - 0.01;

      // 상태/속성 틴트 (우선순위: 기절 > 둔화 > 장갑 > 보스)
      let tint: string | undefined;
      let tintAlpha = 0.45;
      if (stunned) tint = "#ffe14d";
      else if (slowed) tint = "#56c8ff";
      else if (e.armor > 0) { tint = "#b8c0cc"; tintAlpha = 0.35; }
      else if (e.isBoss) { tint = "#ff5a6a"; tintAlpha = 0.3; }

      // 발밑 그림자 (접지감) — 발이 p.y에 정렬되므로 바로 아래에 깐다
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + r * 0.08, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (alien1Walk.loaded) {
        alien1Walk.draw(ctx, p.x, p.y, state.time, e.eid * 3, size, faceLeft, tint, tintAlpha);
      } else {
        // 스프라이트 로드 전 폴백: 기존 도형 표현
        ctx.beginPath();
        ctx.arc(p.x, p.y, e.isBoss ? 18 : 8, 0, Math.PI * 2);
        ctx.fillStyle = e.isBoss ? "#a13d4e" : e.armor > 0 ? "#6b7384" : "#c75d54";
        ctx.fill();
        ctx.strokeStyle = stunned ? "#ffe14d" : slowed ? "#56c8ff" : "#2a2030";
        ctx.lineWidth = stunned || slowed ? 2.5 : 1.5;
        ctx.stroke();
      }

      // 피격 플래시 (최근 0.09초 내 데미지)
      if (hitT >= 0 && state.time - hitT < 0.09) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5 * (1 - (state.time - hitT) / 0.09);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - r * 0.12, r * 0.5, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 체력바 (스프라이트 머리 위)
      const w = e.isBoss ? 44 : 20;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const barY = p.y - size * 0.58 - 6; // 캐릭터 머리 위
      ctx.fillStyle = "#000a";
      ctx.fillRect(p.x - w / 2, barY, w, 4);
      ctx.fillStyle = ratio > 0.5 ? "#4cc38a" : ratio > 0.25 ? "#e8a33d" : "#e5534b";
      ctx.fillRect(p.x - w / 2, barY, w * ratio, 4);
    }

    // 처치 감지 — 직전 프레임에 있던 적이 사라졌고 체력이 낮았다면 처치로 간주
    for (const [eid, m] of prevMeta) {
      if (!this.enemyMeta.has(eid) && m.hp <= m.maxHp * 0.55) {
        this.spawnDeath(m.x, m.y, m.isBoss ? "#ff6a4a" : "#ffb455", m.isBoss, state.time);
      }
    }

    // 빔(트레이서) · 파티클 · 링 — 적 위에 가산 합성으로 그린다
    this.drawEffects(state.time);

    // 스킬 발동 링 (엔진 castFx, 렌더 전용)
    if (state.castFx.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const f of state.castFx) {
        const age = state.time - f.born;
        if (age < 0 || age > 0.6) continue;
        const t = age / 0.6;
        const base = f.kind === "buff" ? 38 : f.kind === "cc" ? 46 : 30;
        const grow = f.kind === "buff" ? 54 : f.kind === "cc" ? 70 : 86;
        ctx.globalAlpha = (1 - t) * 0.75;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = (f.kind === "burst" ? 3.5 : 2.5) * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, base + t * grow, 0, Math.PI * 2);
        ctx.stroke();
        if (f.kind !== "buff") {
          ctx.globalAlpha = (1 - t) * 0.4;
          ctx.beginPath();
          ctx.arc(f.x, f.y, (base + t * grow) * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // 데미지 숫자 — 떠오르며 페이드. 피해량 비중으로 크기/색 차등 (크리티컬 강조).
    if (this.showDamage && this.floaters.length > 0) {
      ctx.textAlign = "center";
      this.floaters = this.floaters.filter((f) => {
        const age = state.time - f.born;
        if (age < 0 || age > 0.9) return false;
        const t = age / 0.9;
        ctx.globalAlpha = Math.max(0, 1 - t * t);
        const big = f.frac > 0.1 || f.boss;
        const huge = f.frac > 0.22;
        const sz = (huge ? 19 : big ? 15 : 12) * (1 + Math.max(0, 0.35 - age) * 0.9);
        ctx.font = `900 ${sz.toFixed(1)}px sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(40,20,8,.9)";
        ctx.fillStyle = huge ? "#ff7a4a" : big ? "#ffc24a" : "#fff0c2";
        const tx = f.x, ty = f.y - age * 38;
        const label = `-${Math.round(f.amount).toLocaleString()}`;
        ctx.strokeText(label, tx, ty);
        ctx.fillText(label, tx, ty);
        return true;
      });
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    } else if (this.floaters.length > 0) {
      this.floaters.length = 0; // 옵션 끄면 즉시 정리
    }

    // 보스 체력바 (상단)
    if (boss) {
      const wave = waveForRound(Math.min(state.round, FINAL_ROUND));
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = "#000c";
      ctx.fillRect(BOARD_W / 2 - 220, 8, 440, 22);
      ctx.fillStyle = "#a13d4e";
      ctx.fillRect(BOARD_W / 2 - 218, 10, 436 * ratio, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${wave.enemyName}  ${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`,
        BOARD_W / 2, 23,
      );
      ctx.textAlign = "left";
    }

    // 라운드 사이 휴식 카운트다운 (Space/버튼으로 바로 시작)
    if (state.phase !== "ended" && this.autoStartIn !== null) {
      const secs = Math.ceil(this.autoStartIn);
      ctx.fillStyle = "rgba(255,209,74,.95)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${state.round}라운드 시작까지 ${secs}초 (Space로 바로 시작)`, BOARD_W / 2, BOARD_H - 14);
      ctx.textAlign = "left";
    }

    // 공격 이동(A) 모드 안내
    if (this.attackMoveMode) {
      ctx.fillStyle = "rgba(229,83,75,.95)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("공격 이동: 목표 지점을 좌클릭하세요 (Esc 취소)", BOARD_W / 2, 44);
      ctx.textAlign = "left";
    }

    // 다중 선택 박스
    if (this.selectBox) {
      const b = this.selectBox;
      const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      const w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      ctx.fillStyle = "rgba(108,221,139,.12)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(108,221,139,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
  }

  /** 빔·링·파티클을 가산 합성으로 렌더 + 만료 제거 */
  private drawEffects(now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    this.beams = this.beams.filter((b) => {
      const age = now - b.born;
      if (age < 0 || age > b.life) return false;
      const a = 1 - age / b.life;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * (0.6 + a * 0.4);
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = "#fff6dc";
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, b.width * 1.15, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    this.rings = this.rings.filter((r) => {
      const age = now - r.born;
      if (age < 0 || age > r.life) return false;
      const t = age / r.life;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.3 + t * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    this.particles = this.particles.filter((p) => {
      const age = now - p.born;
      if (age < 0 || age > p.life) return false;
      const a = 1 - age / p.life;
      const px = p.x + p.vx * age;
      const py = p.y + p.vy * age + 0.5 * p.grav * age * age;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawGradeShape(x: number, y: number, grade: Grade, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    switch (grade) {
      case "common":
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        break;
      case "rare":
        ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
        break;
      case "hero":
        this.polygon(x, y, r, 5);
        break;
      case "legend":
        this.polygon(x, y, r, 6);
        break;
      case "hidden":
        this.star(x, y, r);
        break;
    }
  }

  private polygon(x: number, y: number, r: number, n: number) {
    const ctx = this.ctx;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  private star(x: number, y: number, r: number) {
    const ctx = this.ctx;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  private drawGroundTexture(ground: keyof typeof GROUND_COLOR, round: number) {
    const ctx = this.ctx;
    const colors = ground === "rune"
      ? ["rgba(128,82,217,.22)", "rgba(36,31,46,.35)"]
      : ground === "blood"
        ? ["rgba(125,28,28,.22)", "rgba(20,16,18,.28)"]
        : ["rgba(255,255,255,.08)", "rgba(0,0,0,.16)"];
    for (let i = 0; i < 120; i++) {
      const x = (i * 73 + round * 41) % BOARD_W;
      const y = (i * 47 + round * 29) % BOARD_H;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, 2 + (i % 5), 1 + (i % 3));
    }
    if (ground === "rune" || ground === "corrupt") {
      ctx.strokeStyle = ground === "rune" ? "rgba(161,103,255,.32)" : "rgba(120,63,172,.24)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = 120 + ((i * 103 + round * 17) % 700);
        const y = 90 + ((i * 61 + round * 23) % 380);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18, y + 20);
        ctx.lineTo(x + 36, y);
        ctx.stroke();
      }
    }
  }

  private drawDecorations(decorations: { kind: StageDecorationKind; x: number; y: number; scale?: number }[]) {
    const ctx = this.ctx;
    for (const d of decorations) {
      const ok = villageTileset.draw(ctx, d.kind, d.x, d.y, d.scale ?? 1);
      if (!ok) {
        ctx.fillStyle = "#2d2330";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        ctx.fillRect(d.x, d.y, 28, 28);
        ctx.strokeRect(d.x, d.y, 28, 28);
      }
    }
  }

  private drawEnemyPortal(x: number, y: number, time: number) {
    enemyPortal.draw(this.ctx, x, y, time);
  }
}

export { GRADE_COLOR, FAMILY_COLOR };
