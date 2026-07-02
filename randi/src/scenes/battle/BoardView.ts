import { Container, Graphics, Text } from "pixi.js";
import type { Game } from "../../core/engine";
import { pointAt } from "../../core/path";
import type { GameEvent, UnitInst } from "../../core/types";
import { UNIT_BY_ID } from "../../data/units";
import { COLORS, GRADE_COLORS, fontOutlined } from "../../ui/theme";
import { drawEnemyToken, drawUnitToken, shade } from "../../ui/tokens";

const DMG_POOL_MAX = 44;

interface FloatText { t: Text; vx: number; vy: number; life: number; max: number }
interface Ring { g: Graphics; life: number; max: number; radius: number; color: number }
interface Bullet { g: Graphics; x0: number; y0: number; x1: number; y1: number; life: number; color: number }

export class BoardView extends Container {
  private game: Game;
  private field = new Graphics();
  private slotLayer = new Graphics();
  private rangeLayer = new Graphics();
  private enemyLayer = new Container();
  private unitLayer = new Container();
  private fxLayer = new Container();
  private textLayer = new Container();

  private enemyViews = new Map<number, { c: Container; g: Graphics; bar: Graphics; type: string; isBoss: boolean }>();
  private unitViews = new Map<number, { c: Container; defId: string; sel: Graphics }>();
  private prevDist = new Map<number, number>();
  private floats: FloatText[] = [];
  private floatPool: Text[] = [];
  private rings: Ring[] = [];
  private bullets: Bullet[] = [];
  private shake = 0;

  selectedUid = 0;
  hoverSlotId = -1;
  onUnitTap: (uid: number) => void = () => {};
  onSlotTap: (slotId: number) => void = () => {};
  onGroundTap: () => void = () => {};

  constructor(game: Game) {
    super();
    this.game = game;
    this.addChild(this.field, this.slotLayer, this.rangeLayer, this.enemyLayer, this.unitLayer, this.fxLayer, this.textLayer);
    this.drawField();
    this.drawSlots();

    this.eventMode = "static";
    this.hitArea = { contains: () => true };
    this.on("pointertap", (e) => {
      const p = this.toLocal(e.global);
      // 유닛 우선
      let best: UnitInst | null = null;
      let bd = 26;
      for (const u of game.units) {
        const sp = game.unitPos(u);
        const d = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (d < bd) { bd = d; best = u; }
      }
      if (best) { this.onUnitTap(best.uid); return; }
      // 빈 슬롯
      const used = new Set(game.units.map((u) => u.slot));
      for (const s of game.slots) {
        if (used.has(s.id)) continue;
        if (Math.hypot(s.x - p.x, s.y - p.y) < 22) { this.onSlotTap(s.id); return; }
      }
      this.onGroundTap();
    });
  }

  private drawField(): void {
    const g = this.field;
    const th = this.game.stage.theme;
    const path = this.game.path;
    g.clear();
    // ===== 부유섬 지반 (메뉴 화면과 같은 하늘 테마 위에 뜬 섬) =====
    const xs = path.points.map((p) => p.x);
    const ys = path.points.map((p) => p.y);
    const minX = Math.min(...xs) - 66, maxX = Math.max(...xs) + 66;
    const minY = Math.min(...ys) - 54, maxY = Math.max(...ys) + 50;
    const iw = maxX - minX, ih = maxY - minY;
    const rad = Math.min(120, ih / 2.6);
    const cx = (minX + maxX) / 2;

    // 섬 아래 드리운 그림자
    g.ellipse(cx, maxY + 52, iw * 0.4, 24).fill({ color: 0x000000, alpha: 0.22 });
    // 절벽 (섬 두께) — 아래로 뾰족하게 layered
    g.roundRect(minX + iw * 0.08, minY + ih * 0.4, iw * 0.84, ih * 0.72, rad).fill(shade(th.groundDark, -0.5));
    g.roundRect(minX + iw * 0.18, minY + ih * 0.55, iw * 0.64, ih * 0.68, rad).fill(shade(th.groundDark, -0.62));
    g.ellipse(cx, maxY + ih * 0.13, iw * 0.26, ih * 0.2).fill(shade(th.groundDark, -0.68));
    // 떠 있는 잔돌
    g.ellipse(minX - 26, maxY - ih * 0.2, 18, 12).fill(shade(th.groundDark, -0.45));
    g.ellipse(maxX + 30, minY + ih * 0.55, 13, 9).fill(shade(th.groundDark, -0.4));
    g.ellipse(cx + iw * 0.3, maxY + 34, 10, 7).fill(shade(th.groundDark, -0.55));
    // 지표면
    g.roundRect(minX, minY, iw, ih, rad).fill(th.groundDark);
    g.roundRect(minX, minY, iw, ih, rad).stroke({ color: shade(th.ground, 0.25), width: 2.5, alpha: 0.55 });
    g.roundRect(minX + 5, minY + 5, iw - 10, ih - 10, Math.max(20, rad - 6))
      .stroke({ color: th.ground, width: 6, alpha: 0.35 });
    // 지면 텍스처 점 (섬 내부에만)
    for (let i = 0; i < 90; i++) {
      const x = minX + 30 + ((i * 233) % (iw - 60));
      const y = minY + 26 + ((i * 149) % (ih - 52));
      const r = 1 + (i % 4);
      g.circle(x, y, r).fill({ color: i % 5 === 0 ? th.accent : th.ground, alpha: i % 5 === 0 ? 0.12 : 0.4 });
    }
    // 중앙 전투 구역 표시
    const c = path.centroid;
    g.ellipse(c.x, c.y, 150, 92).stroke({ color: th.accent, width: 1.5, alpha: 0.14 });
    g.ellipse(c.x, c.y, 100, 60).stroke({ color: th.accent, width: 1, alpha: 0.1 });

    // 경로 리본
    const pts = path.points.filter((_, i) => i % 3 === 0);
    const trace = () => {
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.closePath();
    };
    trace(); g.stroke({ color: shade(th.pathEdge, -0.35), width: 46, alpha: 0.55 });
    trace(); g.stroke({ color: th.pathEdge, width: 40 });
    trace(); g.stroke({ color: th.path, width: 32 });
    // 진행 방향 대시
    const dashCount = Math.floor(path.total / 64);
    for (let i = 0; i < dashCount; i++) {
      const d = (i / dashCount) * path.total;
      const a = pointAt(path, d);
      const b = pointAt(path, d + 12);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xffffff, width: 3, alpha: 0.13 });
    }

    // 스폰 포탈
    const sp = pointAt(path, 0);
    g.circle(sp.x, sp.y, 26).fill({ color: 0x1a0f24, alpha: 0.9 });
    g.circle(sp.x, sp.y, 26).stroke({ color: 0xa06df0, width: 3, alpha: 0.9 });
    g.circle(sp.x, sp.y, 18).stroke({ color: 0xcaa5ff, width: 2, alpha: 0.7 });
    g.circle(sp.x, sp.y, 9).fill({ color: 0xcaa5ff, alpha: 0.5 });
  }

  private drawSlots(): void {
    const g = this.slotLayer;
    g.clear();
    for (const s of this.game.slots) {
      g.poly([s.x, s.y - 7, s.x + 7, s.y, s.x, s.y + 7, s.x - 7, s.y])
        .fill({ color: 0xffffff, alpha: 0.05 })
        .stroke({ color: 0xffffff, width: 1, alpha: 0.10 });
    }
  }

  /** 틱 직전 위치 저장 (보간용) */
  captureprev(): void {
    this.prevDist.clear();
    for (const e of this.game.enemies) this.prevDist.set(e.uid, e.dist);
  }

  handleEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case "hit":
          if (ev.amount !== undefined && ev.x !== undefined) {
            this.spawnDamage(ev.x, ev.y!, ev.amount, ev.crit === true);
          } else if (ev.uid !== undefined && ev.enemyUid !== undefined) {
            this.spawnBullet(ev.uid, ev.enemyUid);
          }
          break;
        case "kill":
          if (ev.x !== undefined) this.spawnRing(ev.x, ev.y!, 18, 0xd8dde6, 0.3);
          break;
        case "skillProc":
          if (ev.x !== undefined) {
            this.spawnRing(ev.x, ev.y!, Math.max(34, ev.radius ?? 0), 0xffd77a, 0.5);
          }
          break;
        case "summon": case "merge": case "craft": case "selectorReward": {
          if (ev.x !== undefined && ev.unitDefId) {
            const def = UNIT_BY_ID[ev.unitDefId];
            this.spawnRing(ev.x, ev.y!, 34, GRADE_COLORS[def.grade], 0.6);
            if (ev.type !== "summon" || def.grade !== "common") {
              this.spawnFloat(ev.x, ev.y! - 30, def.name, GRADE_COLORS[def.grade], 15);
            }
          }
          break;
        }
        case "sell":
          if (ev.x !== undefined) this.spawnFloat(ev.x, ev.y! - 16, `+${ev.amount}G`, COLORS.gold, 13);
          break;
        case "bossSpawn":
          this.shake = 0.5;
          break;
        case "bossKill":
          this.shake = 0.4;
          if (ev.x !== undefined) {
            this.spawnRing(ev.x, ev.y!, 90, 0xffd77a, 1.0);
            this.spawnFloat(ev.x, ev.y! - 44, "보스 격파!", 0xffd77a, 22);
          }
          break;
        default: break;
      }
    }
  }

  /** 매 렌더 프레임 호출 */
  render_(alpha: number, dt: number): void {
    const game = this.game;

    // 흔들림
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const m = this.shake * 9;
      this.position.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    } else if (this.x !== 0 || this.y !== 0) {
      this.position.set(0, 0);
    }

    // ===== 적 =====
    const seen = new Set<number>();
    for (const e of game.enemies) {
      seen.add(e.uid);
      let v = this.enemyViews.get(e.uid);
      if (!v) {
        const c = new Container();
        const g = new Graphics();
        const type = game.currentWave?.type ?? "normal";
        drawEnemyToken(g, e.isBoss ? "boss" : type, e.radius, e.isBoss, this.game.stage.theme.accent);
        const bar = new Graphics();
        c.addChild(g, bar);
        this.enemyLayer.addChild(c);
        v = { c, g, bar, type, isBoss: e.isBoss };
        this.enemyViews.set(e.uid, v);
      }
      const prev = this.prevDist.get(e.uid) ?? e.dist;
      const d = prev + (e.dist - prev) * alpha;
      const p = pointAt(game.path, d);
      v.c.position.set(p.x, p.y);
      // 상태 표현
      const t = game.time;
      const stunned = e.stunUntil > t;
      const slowed = e.slowUntil > t;
      v.g.tint = stunned ? 0x9ad0ff : slowed ? 0xb8ccff : 0xffffff;
      // HP 바
      const ratio = e.hp / e.maxHp;
      v.bar.clear();
      if (ratio < 1) {
        const w = e.isBoss ? 56 : 26;
        const y = -e.radius - (e.isBoss ? 16 : 9);
        v.bar.rect(-w / 2, y, w, e.isBoss ? 6 : 4).fill({ color: 0x14161c, alpha: 0.85 });
        v.bar.rect(-w / 2 + 1, y + 1, (w - 2) * Math.max(0, ratio), (e.isBoss ? 6 : 4) - 2)
          .fill(ratio > 0.5 ? 0x7ac96a : ratio > 0.25 ? 0xe8b34a : 0xe25555);
      }
    }
    for (const [uid, v] of this.enemyViews) {
      if (!seen.has(uid)) { v.c.destroy({ children: true }); this.enemyViews.delete(uid); }
    }

    // ===== 유닛 =====
    const seenU = new Set<number>();
    for (const u of game.units) {
      seenU.add(u.uid);
      let v = this.unitViews.get(u.uid);
      if (!v || v.defId !== u.defId) {
        v?.c.destroy({ children: true });
        const def = UNIT_BY_ID[u.defId];
        const c = new Container();
        const sel = new Graphics();
        const g = new Graphics();
        drawUnitToken(g, def, def.grade === "legend" || def.grade === "hidden" ? 17 : def.grade === "hero" ? 15 : 13);
        c.addChild(sel, g);
        this.unitLayer.addChild(c);
        v = { c, defId: u.defId, sel };
        this.unitViews.set(u.uid, v);
      }
      const p = game.unitPos(u);
      v.c.position.set(p.x, p.y);
      const isSel = u.uid === this.selectedUid;
      v.sel.clear();
      if (isSel) {
        v.sel.circle(0, 0, 22).stroke({ color: 0xffe9a8, width: 2, alpha: 0.9 });
        v.sel.circle(0, 0, 26).stroke({ color: 0xffe9a8, width: 1, alpha: 0.4 });
      }
    }
    for (const [uid, v] of this.unitViews) {
      if (!seenU.has(uid)) { v.c.destroy({ children: true }); this.unitViews.delete(uid); }
    }

    // ===== 사거리 표시 =====
    this.rangeLayer.clear();
    const sel = game.unitByUid(this.selectedUid);
    if (sel) {
      const def = UNIT_BY_ID[sel.defId];
      const p = game.unitPos(sel);
      this.rangeLayer.circle(p.x, p.y, def.range).fill({ color: 0xffe07a, alpha: 0.07 });
      this.rangeLayer.circle(p.x, p.y, def.range).stroke({ color: 0xffe07a, width: 1.6, alpha: 0.55 });
      // 이동 가능 슬롯 표시
      const used = new Set(game.units.map((x) => x.slot));
      for (const s of game.slots) {
        if (used.has(s.id)) continue;
        this.rangeLayer.poly([s.x, s.y - 8, s.x + 8, s.y, s.x, s.y + 8, s.x - 8, s.y])
          .fill({ color: 0x8fd06a, alpha: 0.18 })
          .stroke({ color: 0x8fd06a, width: 1.2, alpha: 0.5 });
      }
    }

    // ===== 탄환 =====
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt * 6.5;
      if (b.life <= 0) { b.g.destroy(); this.bullets.splice(i, 1); continue; }
      const t = 1 - b.life;
      const x = b.x0 + (b.x1 - b.x0) * t;
      const y = b.y0 + (b.y1 - b.y0) * t - Math.sin(t * Math.PI) * 14;
      b.g.position.set(x, y);
      b.g.alpha = Math.min(1, b.life * 3);
    }

    // ===== 링 이펙트 =====
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { r.g.destroy(); this.rings.splice(i, 1); continue; }
      const t = 1 - r.life / r.max;
      r.g.clear();
      r.g.circle(0, 0, 6 + r.radius * t).stroke({ color: r.color, width: 3 * (1 - t) + 1, alpha: (1 - t) * 0.85 });
      if (t < 0.4) r.g.circle(0, 0, (6 + r.radius * t) * 0.55).fill({ color: r.color, alpha: (0.4 - t) * 0.5 });
    }

    // ===== 플로팅 텍스트 =====
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.t.visible = false;
        this.floatPool.push(f.t);
        this.floats.splice(i, 1);
        continue;
      }
      f.t.x += f.vx * dt;
      f.t.y += f.vy * dt;
      f.vy += 30 * dt;
      f.t.alpha = Math.min(1, f.life / (f.max * 0.5));
    }
  }

  private spawnBullet(uid: number, enemyUid: number): void {
    if (this.bullets.length > 70) return;
    const u = this.game.unitByUid(uid);
    const e = this.game.enemyByUid(enemyUid);
    if (!u || !e) return;
    const def = UNIT_BY_ID[u.defId];
    const p0 = this.game.unitPos(u);
    const p1 = this.game.enemyPos(e);
    const g = new Graphics();
    const color = def.attackType === "magic" ? 0xc79aff : def.attackType === "pierce" ? 0xfff2a8 : def.attackType === "true" ? 0xff9ad5 : 0xffd7a0;
    g.circle(0, 0, def.grade === "legend" || def.grade === "hidden" ? 4.5 : 3).fill(color);
    g.circle(0, 0, def.grade === "legend" || def.grade === "hidden" ? 7 : 5).stroke({ color, width: 1, alpha: 0.4 });
    this.fxLayer.addChild(g);
    this.bullets.push({ g, x0: p0.x, y0: p0.y - 8, x1: p1.x, y1: p1.y, life: 1, color });
  }

  private spawnRing(x: number, y: number, radius: number, color: number, dur: number): void {
    if (this.rings.length > 30) return;
    const g = new Graphics();
    g.position.set(x, y);
    this.fxLayer.addChild(g);
    this.rings.push({ g, life: dur, max: dur, radius, color });
  }

  private spawnDamage(x: number, y: number, amount: number, big: boolean): void {
    if (this.floats.length >= DMG_POOL_MAX) return;
    this.spawnFloat(
      x + (Math.random() - 0.5) * 18, y - 14,
      formatNum(amount),
      big ? 0xffd35c : 0xf5f0e0,
      big ? 16 : 12,
    );
  }

  private spawnFloat(x: number, y: number, text: string, color: number, size: number): void {
    if (this.floats.length >= DMG_POOL_MAX + 10) return;
    let t = this.floatPool.pop();
    if (!t) {
      t = new Text({ text: "", style: fontOutlined(12, 0xffffff) });
      t.anchor.set(0.5);
      this.textLayer.addChild(t);
    }
    t.visible = true;
    t.text = text;
    t.style.fontSize = size;
    t.style.fill = color;
    t.position.set(x, y);
    t.alpha = 1;
    this.floats.push({ t, vx: (Math.random() - 0.5) * 14, vy: -46, life: 0.9, max: 0.9 });
  }
}

export function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
