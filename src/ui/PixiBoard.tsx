import { useCallback, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { BOARD_H, BOARD_W, pathLengthForStage, posAtDist, waypointsForStage } from "../core/path";
import type { GameState, Grade } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { stageById } from "../data/stages";
import { getRuntimeControls, type BoardPointerInput } from "../runtimeBridge";
import { screenToBoard, type BoardBox } from "../board/boardHitTest";

extend({ Container, Graphics, Text });

const GRADE_COLOR: Record<Grade, number> = {
  common: 0x8d99a8,
  rare: 0x3f9ae0,
  hero: 0xb05cff,
  legend: 0xf0a830,
  hidden: 0xe35ad0,
};

const GROUND_COLOR: Record<ReturnType<typeof stageById>["ground"], number> = {
  dirt: 0x3a2c1d,
  ash: 0x46403a,
  grass: 0x46512f,
  stone: 0x403a30,
  corrupt: 0x352338,
  blood: 0x3a2018,
  rune: 0x2c2535,
};

const FAMILY_COLOR: Record<string, number> = {
  flame: 0xff6a3a,
  frost: 0x57c4ff,
  storm: 0xffd84d,
  iron: 0xc4ccd6,
  void: 0xb478ff,
  forest: 0x79d65a,
};

export interface PixiBoardProps {
  revision: number;
  state: GameState;
  selectedUids?: ReadonlySet<number>;
  selectBox?: BoardBox | null;
  attackMoveMode?: boolean;
  showLabels?: boolean;
  showDamage?: boolean;
}

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

function BoardGraphics({ draw }: { draw: GraphicsDraw }) {
  return <pixiGraphics draw={draw} />;
}

function cssColorToNumber(color: string | undefined, fallback: number) {
  if (!color || !color.startsWith("#")) return fallback;
  return Number.parseInt(color.slice(1), 16);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorForCss(cssColor: string | undefined, fallback: number) {
  if (!cssColor) return fallback;
  if (cssColor.startsWith("#")) return Number.parseInt(cssColor.slice(1), 16);
  return fallback;
}

export function PixiBoard({
  revision,
  state,
  selectedUids,
  selectBox,
  attackMoveMode = false,
  showLabels = false,
  showDamage = true,
}: PixiBoardProps) {
  const stage = stageById(state.stageId);
  const selected = selectedUids ?? new Set<number>();
  const waypoints = useMemo(() => waypointsForStage(state.stageId), [state.stageId]);
  const pathLength = useMemo(() => pathLengthForStage(state.stageId), [state.stageId]);
  const toBoardInput = useCallback((event: ReactPointerEvent<HTMLDivElement>): BoardPointerInput => {
    const point = screenToBoard(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    return {
      x: point.x,
      y: point.y,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    };
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    getRuntimeControls()?.boardPointerDown(toBoardInput(event));
  }, [toBoardInput]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    getRuntimeControls()?.boardPointerMove(toBoardInput(event));
  }, [toBoardInput]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    getRuntimeControls()?.boardPointerUp(toBoardInput(event));
  }, [toBoardInput]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    getRuntimeControls()?.boardPointerCancel();
  }, []);

  const drawBackground = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, BOARD_W, BOARD_H).fill(GROUND_COLOR[stage.ground]);
    for (let x = 0; x <= BOARD_W; x += 64) {
      g.moveTo(x, 0);
      g.lineTo(x, BOARD_H);
    }
    for (let y = 0; y <= BOARD_H; y += 64) {
      g.moveTo(0, y);
      g.lineTo(BOARD_W, y);
    }
    g.stroke({ color: 0x8a93a0, width: 1, alpha: 0.08 });
    g.rect(0, 0, BOARD_W, BOARD_H).stroke({ color: 0x090c11, width: 18, alpha: 0.5 });
    g.rect(8, 8, BOARD_W - 16, BOARD_H - 16).stroke({ color: 0xe7b53e, width: 2, alpha: 0.16 });
    g.rect(80, 70, 800, 420).stroke({ color: 0x9d7b4b, width: 2, alpha: 0.28 });
    const light = stage.ground === "rune" ? 0x8052d9 : stage.ground === "blood" ? 0x7d1c1c : 0xffffff;
    const dark = stage.ground === "rune" ? 0x241f2e : 0x000000;
    for (let i = 0; i < 120; i++) {
      const x = (i * 73 + state.stageId * 41) % BOARD_W;
      const y = (i * 47 + state.stageId * 29) % BOARD_H;
      g.rect(x, y, 2 + (i % 5), 1 + (i % 3)).fill({
        color: i % 2 === 0 ? light : dark,
        alpha: i % 2 === 0 ? 0.08 : 0.16,
      });
    }
    if (stage.ground === "rune" || stage.ground === "corrupt") {
      for (let i = 0; i < 8; i++) {
        const x = 120 + ((i * 103 + state.stageId * 17) % 700);
        const y = 90 + ((i * 61 + state.stageId * 23) % 380);
        g.moveTo(x, y);
        g.lineTo(x + 18, y + 20);
        g.lineTo(x + 36, y);
        g.stroke({ color: stage.ground === "rune" ? 0xa167ff : 0x783fac, width: 2, alpha: 0.28 });
      }
    }
  }, [stage.ground, state.stageId]);

  const drawPath = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    if (waypoints.length === 0) return;
    g.moveTo(waypoints[0][0], waypoints[0][1]);
    for (let i = 1; i < waypoints.length; i++) {
      g.lineTo(waypoints[i][0], waypoints[i][1]);
    }
    g.lineTo(waypoints[0][0], waypoints[0][1]);
    g.stroke({ color: 0x241712, width: 34, alpha: 0.92 });
    g.stroke({ color: stage.ground === "rune" ? 0x8052d9 : 0x5a4226, width: 3, alpha: 0.72 });
    for (let dist = 160; dist < pathLength; dist += 260) {
      const p = posAtDist(dist, state.stageId);
      const p2 = posAtDist(dist + 8, state.stageId);
      const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const points = [
        [6, 0],
        [-4, -5],
        [-4, 5],
      ].map(([x, y]) => [p.x + x * cos - y * sin, p.y + x * sin + y * cos]);
      g.poly(points.flat()).fill({ color: 0x7a5a30, alpha: 0.9 });
    }
  }, [pathLength, stage.ground, state.stageId, waypoints]);

  const drawDecorations = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const decoration of stage.decorations) {
      const scale = decoration.scale ?? 1;
      const w = 28 * scale;
      const h = 28 * scale;
      const isTree = decoration.kind.toLowerCase().includes("tree") || decoration.kind.includes("oak");
      const isStone = decoration.kind.toLowerCase().includes("stone") || decoration.kind.includes("grave") || decoration.kind.includes("crypt");
      const color = isTree ? 0x315936 : isStone ? 0x737173 : 0x3b2b25;
      g.ellipse(decoration.x + w / 2, decoration.y + h * 0.82, w * 0.46, h * 0.18).fill({ color: 0x000000, alpha: 0.22 });
      if (isTree) {
        g.rect(decoration.x + w * 0.42, decoration.y + h * 0.44, w * 0.16, h * 0.44).fill({ color: 0x5b3c24, alpha: 0.95 });
        g.circle(decoration.x + w * 0.5, decoration.y + h * 0.35, w * 0.36).fill({ color, alpha: 0.95 });
      } else {
        g.roundRect(decoration.x, decoration.y, w, h, 4).fill({ color, alpha: 0.78 });
        g.roundRect(decoration.x, decoration.y, w, h, 4).stroke({ color: 0x111111, width: 2, alpha: 0.5 });
      }
    }
  }, [stage.decorations]);

  const drawUnits = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const unit of state.units) {
      const def = UNIT_BY_ID[unit.defId];
      const color = GRADE_COLOR[def.grade];
      const isSelected = selected.has(unit.uid);
      const justFired = unit.cooldown > 0 && unit.cooldown > 1 / def.attackSpeed - 0.12;
      if (isSelected) {
        g.circle(unit.x, unit.y, def.range).stroke({ color: 0xe8b54d, width: 1, alpha: 0.4 });
        if (unit.order.kind === "move" || unit.order.kind === "attackMove") {
          const orderColor = unit.order.kind === "attackMove" ? 0xe5534b : 0x6cdd8b;
          g.moveTo(unit.x, unit.y);
          g.lineTo(unit.order.cx, unit.order.cy);
          g.stroke({ color: orderColor, width: 2, alpha: 0.5 });
          g.circle(unit.order.cx, unit.order.cy, 4).fill({ color: orderColor, alpha: 0.8 });
        }
      }
      g.circle(unit.x, unit.y, isSelected ? 19 : 15)
        .fill({ color, alpha: unit.locked ? 0.78 : 0.95 });
      g.circle(unit.x, unit.y, isSelected ? 22 : 17)
        .stroke({ color: isSelected ? 0xfff0a6 : 0x17120c, width: isSelected ? 3 : 2, alpha: 0.95 });
      if (justFired) {
        g.circle(unit.x, unit.y, isSelected ? 25 : 20)
          .stroke({ color: FAMILY_COLOR[def.family] ?? 0xffd98a, width: 2, alpha: 0.75 });
      }
      if (unit.locked) {
        g.rect(unit.x - 7, unit.y - 22, 14, 5).fill({ color: 0xf6d365, alpha: 0.92 });
      }
    }
  }, [revision, selected, state.units]);

  const drawEnemies = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const enemy of state.enemies) {
      const p = posAtDist(enemy.dist, state.stageId);
      const radius = enemy.isBoss ? 26 : 13;
      const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
      const stunned = enemy.stunUntil > state.time;
      const slowed = enemy.slows.length > 0;
      const strokeColor = stunned ? 0xffe14d : slowed ? 0x56c8ff : enemy.isBoss ? 0xffcf66 : 0xdd5f5f;
      const fillColor = enemy.isBoss ? 0x9b2f2f : enemy.armor > 0 ? 0x4d5668 : 0x2f1c24;
      g.ellipse(p.x, p.y + radius * 0.42, radius * 0.75, radius * 0.25).fill({ color: 0x000000, alpha: 0.28 });
      g.circle(p.x, p.y, radius).fill({ color: fillColor, alpha: 0.95 });
      g.circle(p.x, p.y, radius + 2).stroke({ color: strokeColor, width: stunned || slowed ? 3 : 2, alpha: 0.85 });
      if (enemy.armorBreakStacks > 0 || enemy.ampStacks > 0) {
        const markerColor = enemy.ampStacks > 0 ? 0xb478ff : 0xff8a3d;
        g.circle(p.x + radius * 0.48, p.y - radius * 0.52, 4).fill({ color: markerColor, alpha: 0.9 });
      }
      g.rect(p.x - radius, p.y - radius - 10, radius * 2, 4).fill({ color: 0x2a1414, alpha: 0.9 });
      g.rect(p.x - radius, p.y - radius - 10, radius * 2 * hpPct, 4).fill({
        color: hpPct > 0.5 ? 0x68d06f : hpPct > 0.25 ? 0xe8a33d : 0xe5534b,
        alpha: 0.95,
      });
    }
  }, [revision, state.enemies, state.stageId]);

  const drawCastFx = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const fx of state.castFx) {
      const age = state.time - fx.born;
      if (age < 0 || age > 0.6) continue;
      const t = age / 0.6;
      const base = fx.kind === "buff" ? 38 : fx.kind === "cc" ? 46 : 30;
      const grow = fx.kind === "buff" ? 54 : fx.kind === "cc" ? 70 : 86;
      const color = colorForCss(fx.color, 0xffd98a);
      g.circle(fx.x, fx.y, base + t * grow).stroke({
        color,
        width: (fx.kind === "burst" ? 3.5 : 2.5) * (1 - t) + 0.5,
        alpha: (1 - t) * 0.75,
      });
      if (fx.kind !== "buff") {
        g.circle(fx.x, fx.y, (base + t * grow) * 0.6).stroke({ color, width: 1.5, alpha: (1 - t) * 0.4 });
      }
    }
  }, [revision, state.castFx, state.time]);

  const drawBossBar = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    const boss = state.enemies.find((enemy) => enemy.isBoss);
    if (!boss) return;
    const ratio = clamp01(boss.hp / Math.max(1, boss.maxHp));
    g.rect(BOARD_W / 2 - 220, 8, 440, 22).fill({ color: 0x000000, alpha: 0.76 });
    g.rect(BOARD_W / 2 - 218, 10, 436 * ratio, 18).fill({ color: 0xa13d4e, alpha: 0.95 });
    g.rect(BOARD_W / 2 - 220, 8, 440, 22).stroke({ color: 0xffcf66, width: 1, alpha: 0.45 });
  }, [revision, state.enemies]);

  const drawOverlay = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    if (selectBox) {
      const x = Math.min(selectBox.x0, selectBox.x1);
      const y = Math.min(selectBox.y0, selectBox.y1);
      const w = Math.abs(selectBox.x1 - selectBox.x0);
      const h = Math.abs(selectBox.y1 - selectBox.y0);
      g.rect(x, y, w, h).fill({ color: 0x66b8ff, alpha: 0.12 });
      g.rect(x, y, w, h).stroke({ color: 0x8ed0ff, width: 2, alpha: 0.88 });
    }
    if (attackMoveMode) {
      g.rect(0, 0, BOARD_W, BOARD_H).stroke({ color: 0xffcf66, width: 4, alpha: 0.75 });
    }
  }, [attackMoveMode, revision, selectBox]);

  const labelStyle = useMemo(() => ({
    fill: 0xf5efe0,
    fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
    fontSize: 11,
    fontWeight: "bold" as const,
    stroke: { color: 0x111111, width: 3 },
  }), []);

  const damageStyle = useMemo(() => ({
    fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
    fontSize: 14,
    fontWeight: "bold" as const,
    stroke: { color: 0x111111, width: 3 },
  }), []);

  return (
    <div
      className="pixi-board-input-surface"
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Application width={BOARD_W} height={BOARD_H} backgroundAlpha={0} antialias>
        <pixiContainer>
        <BoardGraphics draw={drawBackground} />
        <BoardGraphics draw={drawPath} />
        <BoardGraphics draw={drawDecorations} />
        <BoardGraphics draw={drawUnits} />
        <BoardGraphics draw={drawEnemies} />
        <BoardGraphics draw={drawCastFx} />
        <BoardGraphics draw={drawBossBar} />
        <BoardGraphics draw={drawOverlay} />
        {showLabels ? state.units.map((unit) => {
          const def = UNIT_BY_ID[unit.defId];
          return (
            <pixiText
              key={`unit-label-${unit.uid}`}
              anchor={0.5}
              text={def.name}
              x={unit.x}
              y={unit.y + 28}
              style={labelStyle}
            />
          );
        }) : null}
        {showDamage ? state.damageFx.map((fx, index) => {
          const age = state.time - fx.born;
          const t = clamp01(age / 0.8);
          return (
            <pixiText
              key={`damage-${index}-${fx.born}`}
              alpha={1 - t}
              anchor={0.5}
              text={fx.text}
              x={fx.x}
              y={fx.y - t * 24}
              style={{ ...damageStyle, fill: cssColorToNumber(fx.color, 0xf2f0dc) }}
            />
          );
        }) : null}
      </pixiContainer>
      </Application>
    </div>
  );
}
