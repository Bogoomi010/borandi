import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { BOARD_H, BOARD_W, FIELD, PATH_WIDTH, pathLengthForStage, posAtDist, waypointsForStage } from "../core/path";
import type { GameState, Grade, UnitDef } from "../core/types";
import { analyzeRecipes } from "../core/advisor";
import { UNIT_BY_ID } from "../data/units";
import { stageById, type StageDecoration, type StageDecorationKind, type StageDef } from "../data/stages";
import { getRuntimeControls, type BoardPointerInput, type RenderInterpolationFrame } from "../runtimeBridge";
import { screenToBoard, type BoardBox } from "../board/boardHitTest";
import { GameNineSlice } from "./skin/createNineSliceSprite";

extend({ Container, Graphics, Sprite, Text });


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




const HUD_MARGIN = 14;
const DPS_HUD_W = 236;
const DPS_HUD_H = 220;
const DPS_HUD_X = BOARD_W - DPS_HUD_W - HUD_MARGIN;
const DPS_HUD_Y = 14;
const UNIT_DETAIL_X = 18;
const UNIT_DETAIL_W = 570;
const UNIT_DETAIL_H = 154;
const UNIT_DETAIL_Y = BOARD_H - UNIT_DETAIL_H - 18;
const RECIPE_HUD_W = 310;
const RECIPE_DETAILS_H = 96;
const RECIPE_LIST_H = 128;
const RECIPE_HUD_X = BOARD_W - RECIPE_HUD_W - 16;
const RECIPE_LIST_Y = BOARD_H - RECIPE_LIST_H - 18;
const RECIPE_DETAILS_Y = RECIPE_LIST_Y - RECIPE_DETAILS_H - 18;

export interface PixiBoardProps {
  revision: number;
  state: GameState;
  selectedUids?: ReadonlySet<number>;
  selectBox?: BoardBox | null;
  attackMoveMode?: boolean;
  paused?: boolean;
  dpsVisible?: boolean;
  showLabels?: boolean;
  showDamage?: boolean;
  renderFrame?: RenderInterpolationFrame;
}

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface PixiDpsRow {
  uid: number;
  name: string;
  family: string;
  grade: Grade;
  dps: number;
  total: number;
  skill: number;
}

interface PixiDpsSnapshot {
  rows: PixiDpsRow[];
  teamDps: number;
  teamTotal: number;
  maxDps: number;
}

interface DpsStat {
  last: number;
  dps: number;
  total: number;
}

interface RenderedUnit {
  unit: GameState["units"][number];
  x: number;
  y: number;
}

interface RenderedEnemy {
  enemy: GameState["enemies"][number];
  dist: number;
  x: number;
  y: number;
}

type RecipeStatus = ReturnType<typeof analyzeRecipes>[number];

function BoardGraphics({ draw }: { draw: GraphicsDraw }) {
  return <pixiGraphics draw={draw} />;
}

function HudPanel({
  accent = 0x4aa3ff,
  alpha = 0.86,
  height,
  width,
  x,
  y,
}: {
  accent?: number;
  alpha?: number;
  height: number;
  width: number;
  x: number;
  y: number;
}) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 6).fill({ color: 0x0d141d, alpha });
    g.roundRect(0, 0, width, height, 6).stroke({ color: 0x000000, width: 3, alpha: 0.62 });
    g.roundRect(2, 2, width - 4, height - 4, 5).stroke({ color: accent, width: 1, alpha: 0.42 });
    g.rect(0, 0, 4, height).fill({ color: accent, alpha: 0.82 });
  }, [accent, alpha, height, width]);

  return <pixiGraphics draw={draw} x={x} y={y} />;
}


function cssColorToNumber(color: string | undefined, fallback: number) {
  if (!color || !color.startsWith("#")) return fallback;
  return Number.parseInt(color.slice(1), 16);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, alpha: number) {
  return a + (b - a) * alpha;
}

function renderTimeForState(state: GameState, renderFrame?: RenderInterpolationFrame) {
  if (!renderFrame) return state.time;
  const stepSeconds = renderFrame.stepSeconds > 0
    ? renderFrame.stepSeconds
    : Math.max(0, state.time - renderFrame.previousTime);
  return state.time + stepSeconds * clamp01(renderFrame.alpha);
}

function renderUnitPosition(unit: GameState["units"][number], renderFrame?: RenderInterpolationFrame) {
  const previous = renderFrame?.units[unit.uid];
  if (!previous) return { x: unit.x, y: unit.y };
  const alpha = clamp01(renderFrame.alpha);
  return {
    x: lerp(previous.x, unit.x, alpha),
    y: lerp(previous.y, unit.y, alpha),
  };
}

function renderEnemyDist(
  enemy: GameState["enemies"][number],
  pathLength: number,
  renderFrame?: RenderInterpolationFrame,
) {
  const previous = renderFrame?.enemies[enemy.eid];
  if (!previous || pathLength <= 0) return enemy.dist;

  const alpha = clamp01(renderFrame.alpha);
  let current = enemy.dist;
  const delta = current - previous.dist;
  if (delta < -pathLength / 2) current += pathLength;
  else if (delta > pathLength / 2) current -= pathLength;

  const dist = lerp(previous.dist, current, alpha) % pathLength;
  return dist < 0 ? dist + pathLength : dist;
}

function colorForCss(cssColor: string | undefined, fallback: number) {
  if (!cssColor) return fallback;
  if (cssColor.startsWith("#")) return Number.parseInt(cssColor.slice(1), 16);
  return fallback;
}

function fmtNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function passiveChips(def: UnitDef): string[] {
  const out: string[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  if (def.splashRadius) out.push(`Splash ${def.splashRadius}`);
  if (def.slowPct) out.push(`Slow ${pct(def.slowPct)}`);
  if (def.stunChance) out.push(`Stun ${pct(def.stunChance)}`);
  if (def.bossDamageBonus) out.push(`Boss +${pct(def.bossDamageBonus)}`);
  if (def.armorBreakPct) out.push(`Break ${pct(def.armorBreakPct)}`);
  if (def.damageAmpPct) out.push(`Amp ${pct(def.damageAmpPct)}`);
  if (def.killGoldBonus) out.push(`Gold +${def.killGoldBonus}`);
  if (def.executePct) out.push(`Execute ${pct(def.executePct)}`);
  return out;
}

function recipeUsesUnit(recipe: RecipeStatus["recipe"], defId: string): boolean {
  const def = UNIT_BY_ID[defId];
  return recipe.ingredients.some((ingredient) => {
    if (ingredient.unitId) return ingredient.unitId === defId;
    if (ingredient.grade && ingredient.grade !== def.grade) return false;
    if (ingredient.family && ingredient.family !== def.family) return false;
    return !!ingredient.grade || !!ingredient.family;
  });
}

function recipeMaterialText(recipe: RecipeStatus["recipe"]): string {
  return recipe.ingredients.map((ingredient) => {
    const label = ingredient.unitId
      ? UNIT_BY_ID[ingredient.unitId].name
      : `${ingredient.grade ?? "any"} ${ingredient.family ?? ""}`.trim();
    return `${label} x${ingredient.count}`;
  }).join(" + ");
}

function canCraftRecipe(status: RecipeStatus, state: GameState): boolean {
  const roundLocked = status.recipe.minRound !== undefined && state.round < status.recipe.minRound;
  return status.tier === "ok" && status.goldShort === 0 && !roundLocked && !status.needsLocked;
}

function recipeWarningLines(status: RecipeStatus, state: GameState): string[] {
  const roundLocked = status.recipe.minRound !== undefined && state.round < status.recipe.minRound;
  return [
    roundLocked ? `Round ${status.recipe.minRound}+` : "",
    status.goldShort > 0 ? `Gold short ${status.goldShort}` : "",
    status.missing.length > 0
      ? `Missing ${status.missing.map((missing) => `${missing.label} x${missing.count}`).join(", ")}`
      : "",
    status.needsLocked ? "Unlock materials" : "",
    status.reasonTag ?? "",
  ].filter(Boolean).slice(0, 3);
}

function usePixiDpsSnapshot(state: GameState): PixiDpsSnapshot {
  const statsRef = useRef(new Map<number, DpsStat>());
  const lastTimeRef = useRef(0);
  const runKeyRef = useRef("");

  const runKey = `${state.seed}:${state.difficulty}:${state.stageId}`;
  if (runKeyRef.current !== runKey || state.time < lastTimeRef.current) {
    statsRef.current.clear();
    lastTimeRef.current = 0;
    runKeyRef.current = runKey;
  }

  const dt = state.time - lastTimeRef.current;
  lastTimeRef.current = state.time;

  const alive = new Set<number>();
  const rows = state.units.map((unit) => {
    alive.add(unit.uid);
    const stat = statsRef.current.get(unit.uid) ?? { last: unit.totalDamage, dps: 0, total: unit.totalDamage };
    const delta = unit.totalDamage - stat.last;
    stat.last = unit.totalDamage;
    stat.total = unit.totalDamage;
    if (dt > 0.0001) {
      const instant = Math.max(0, delta) / dt;
      const k = Math.min(1, dt / 1.2);
      stat.dps += (instant - stat.dps) * k;
    }
    statsRef.current.set(unit.uid, stat);

    const def = UNIT_BY_ID[unit.defId];
    return {
      uid: unit.uid,
      name: def.name,
      family: def.family,
      grade: def.grade,
      dps: stat.dps,
      total: stat.total,
      skill: unit.skillDamage,
    };
  });

  for (const uid of [...statsRef.current.keys()]) {
    if (!alive.has(uid)) statsRef.current.delete(uid);
  }

  rows.sort((a, b) => b.dps - a.dps || b.total - a.total);

  const top = rows.slice(0, 6);
  return {
    rows: top,
    teamDps: rows.reduce((sum, row) => sum + row.dps, 0),
    teamTotal: rows.reduce((sum, row) => sum + row.total, 0),
    maxDps: Math.max(1, ...top.map((row) => row.dps)),
  };
}

function usePixiBoardTextures() {
  // 이미지 에셋 제거: 보드의 모든 요소는 Graphics 벡터로 그린다.
  return useMemo(() => ({ ready: true }), []);
}

type PixiBoardTextures = ReturnType<typeof usePixiBoardTextures>;

function StageGroundLayer({ stage, textures }: { stage: StageDef; textures: PixiBoardTextures }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    const base = GROUND_COLOR[stage.ground] ?? 0x3a2c1d;
    // 절차 노이즈 점 + 비네트로 지면 질감을 코드로만 표현
    for (let i = 0; i < 240; i++) {
      const x = (i * 379 + 83) % BOARD_W;
      const y = (i * 233 + 47) % BOARD_H;
      const r = 1 + ((i * 7) % 4);
      const light = i % 6 === 0;
      g.circle(x, y, r).fill({ color: light ? 0xffffff : base, alpha: light ? 0.025 : 0.35 });
    }
    for (let i = 0; i < 26; i++) {
      const x = (i * 631 + 199) % BOARD_W;
      const y = (i * 401 + 151) % BOARD_H;
      g.ellipse(x, y, 34 + (i % 5) * 12, 18 + (i % 3) * 8).fill({ color: 0x000000, alpha: 0.05 });
    }
    // 가장자리 비네트
    g.rect(0, 0, BOARD_W, 46).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(0, BOARD_H - 46, BOARD_W, 46).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(0, 0, 46, BOARD_H).fill({ color: 0x000000, alpha: 0.14 });
    g.rect(BOARD_W - 46, 0, 46, BOARD_H).fill({ color: 0x000000, alpha: 0.14 });
  }, [stage.ground]);
  if (!textures.ready) return null;
  return <pixiGraphics draw={draw} />;
}

function PathSpriteLayer({
  pathLength,
  stageId,
  textures,
}: {
  pathLength: number;
  stageId: number;
  textures: PixiBoardTextures;
}) {
  const markers = useMemo(() => {
    const out: Array<{ angle: number; x: number; y: number }> = [];
    for (let dist = 96; dist < pathLength; dist += 128) {
      const p = posAtDist(dist, stageId);
      const p2 = posAtDist(dist + 12, stageId);
      out.push({
        angle: Math.atan2(p2.y - p.y, p2.x - p.x),
        x: p.x,
        y: p.y,
      });
    }
    return out;
  }, [pathLength, stageId]);

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    // 스폰 포탈 — 마법진
    const sp = posAtDist(0, stageId);
    g.circle(sp.x, sp.y, 40).fill({ color: 0x1a0f2e, alpha: 0.75 });
    g.circle(sp.x, sp.y, 40).stroke({ color: 0xa167ff, width: 3, alpha: 0.85 });
    g.circle(sp.x, sp.y, 29).stroke({ color: 0xcaa5ff, width: 1.6, alpha: 0.6 });
    g.circle(sp.x, sp.y, 13).fill({ color: 0xcaa5ff, alpha: 0.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rx = sp.x + Math.cos(a) * 35, ry = sp.y + Math.sin(a) * 35;
      g.poly([rx, ry - 4, rx + 3.5, ry, rx, ry + 4, rx - 3.5, ry]).fill({ color: 0xa167ff, alpha: 0.8 });
    }
    // 진행 방향 셰브론
    for (const m of markers) {
      const c = Math.cos(m.angle), sn = Math.sin(m.angle);
      const pt = (lx: number, ly: number) => [m.x + lx * c - ly * sn, m.y + lx * sn + ly * c];
      g.poly([...pt(-4, -7), ...pt(6, 0), ...pt(-4, 7), ...pt(-1, 0)])
        .fill({ color: 0xe7b53e, alpha: 0.4 });
    }
  }, [markers, stageId]);

  if (!textures.ready) return null;
  return <pixiGraphics draw={draw} />;
}

function decorationSize(decoration: StageDecoration) {
  const base =
    decoration.kind === "specialTree" || decoration.kind === "manor" ? 82 :
    decoration.kind.toLowerCase().includes("house") || decoration.kind === "cottage" || decoration.kind === "witchHut" ? 72 :
    decoration.kind.toLowerCase().includes("tree") || decoration.kind === "oak" ? 70 :
    decoration.kind === "gate" || decoration.kind.includes("fence") ? 58 :
    48;
  return base * (decoration.scale ?? 1);
}

function DecorationSpriteLayer({ stage, textures }: { stage: StageDef; textures: PixiBoardTextures }) {
  const decorations = useMemo(
    () => [...stage.decorations].sort((a, b) => a.y - b.y),
    [stage.decorations],
  );

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const decoration of decorations) {
      const size = decorationSize(decoration);
      const cx = decoration.x + size / 2;
      const cy = decoration.y + size / 2;
      drawDecorationShape(g, decoration.kind, cx, cy, size);
    }
  }, [decorations]);

  if (!textures.ready) return null;
  return <pixiGraphics draw={draw} />;
}

/** 데코 오브젝트를 단순 실루엣 벡터로 표현 (에셋 0) */
function drawDecorationShape(
  g: Graphics, kind: StageDecorationKind, cx: number, cy: number, size: number,
) {
  const s = size / 2;
  const k = kind.toLowerCase();
  const shadow = () => g.ellipse(cx, cy + s * 0.42, s * 0.7, s * 0.2).fill({ color: 0x000000, alpha: 0.16 });
  if (k.includes("tree") || kind === "oak") {
    shadow();
    g.rect(cx - s * 0.08, cy - s * 0.05, s * 0.16, s * 0.5).fill({ color: 0x241a10, alpha: 0.8 });
    const leaf = kind === "soulTree" ? 0x3f6f8a : kind === "specialTree" ? 0x6a4a8a : 0x27381f;
    g.circle(cx, cy - s * 0.3, s * 0.42).fill({ color: leaf, alpha: 0.85 });
    g.circle(cx - s * 0.26, cy - s * 0.1, s * 0.3).fill({ color: leaf, alpha: 0.75 });
    g.circle(cx + s * 0.26, cy - s * 0.12, s * 0.3).fill({ color: leaf, alpha: 0.75 });
  } else if (k.includes("house") || kind === "cottage" || kind === "witchHut" || kind === "manor" || kind === "market" || kind === "forge") {
    shadow();
    g.rect(cx - s * 0.42, cy - s * 0.1, s * 0.84, s * 0.5).fill({ color: 0x2a2018, alpha: 0.88 });
    g.poly([cx - s * 0.52, cy - s * 0.1, cx, cy - s * 0.52, cx + s * 0.52, cy - s * 0.1])
      .fill({ color: 0x1c1410, alpha: 0.9 });
    g.rect(cx - s * 0.08, cy + s * 0.12, s * 0.16, s * 0.28).fill({ color: 0x0f0b08, alpha: 0.9 });
  } else if (k.includes("fence") || kind === "gate") {
    for (let i = -2; i <= 2; i++) {
      g.rect(cx + i * s * 0.3 - 1.5, cy - s * 0.22, 3, s * 0.44).fill({ color: 0x2a2018, alpha: 0.8 });
    }
    g.rect(cx - s * 0.66, cy - s * 0.1, s * 1.32, 2.5).fill({ color: 0x241a10, alpha: 0.8 });
  } else if (k.includes("rock") || kind === "grave" || kind === "coffin" || kind === "well" || kind === "shrine" || kind === "crypt") {
    shadow();
    g.poly([cx - s * 0.4, cy + s * 0.3, cx - s * 0.28, cy - s * 0.25, cx, cy - s * 0.38, cx + s * 0.34, cy - s * 0.16, cx + s * 0.4, cy + s * 0.3])
      .fill({ color: 0x2e2a26, alpha: 0.88 });
    g.poly([cx - s * 0.28, cy - s * 0.25, cx, cy - s * 0.38, cx + s * 0.05, cy - s * 0.1, cx - s * 0.18, cy - s * 0.02])
      .fill({ color: 0x3d3831, alpha: 0.7 });
  } else if (k.includes("bush") || k.includes("mushroom") || k.includes("farmland")) {
    g.ellipse(cx, cy, s * 0.42, s * 0.26).fill({ color: 0x24301c, alpha: 0.75 });
    g.circle(cx - s * 0.18, cy - s * 0.08, s * 0.16).fill({ color: 0x2e3d24, alpha: 0.8 });
    g.circle(cx + s * 0.16, cy - s * 0.05, s * 0.14).fill({ color: 0x2e3d24, alpha: 0.8 });
  } else {
    // 룬/기타 — 마름모 룬 스톤
    shadow();
    g.poly([cx, cy - s * 0.4, cx + s * 0.26, cy, cx, cy + s * 0.34, cx - s * 0.26, cy])
      .fill({ color: 0x2c2535, alpha: 0.85 }).stroke({ color: 0xa167ff, width: 1.2, alpha: 0.4 });
    g.circle(cx, cy - s * 0.02, s * 0.07).fill({ color: 0xa167ff, alpha: 0.6 });
  }
}


function UnitSpriteLayer({
  paused,
  renderedUnits,
  renderTime,
  selected,
  state,
  textures,
}: {
  paused: boolean;
  renderedUnits: RenderedUnit[];
  renderTime: number;
  selected: ReadonlySet<number>;
  state: GameState;
  textures: PixiBoardTextures;
}) {
  const animationTime = paused ? renderTime : renderTime * state.speed;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const { unit, x, y } of renderedUnits) {
      const def = UNIT_BY_ID[unit.defId];
      const isSelected = selected.has(unit.uid);
      const r = def.grade === "hidden" ? 21 : def.grade === "legend" ? 19 : def.grade === "hero" ? 17 : 14;
      drawUnitTokenAt(g, x, y - 6, def.family, def.grade, r, {
        selected: isSelected,
        attacking: unit.state === "attacking" || unit.cooldown > 0.05,
        pulse: animationTime + unit.uid,
      });
    }
  }, [animationTime, renderedUnits, selected]);

  if (!textures.ready) return null;
  return <pixiGraphics draw={draw} />;
}

/** drawUnitTokenShape의 위치 지정 버전 */
function drawUnitTokenAt(
  g: Graphics, x: number, y: number, family: string, grade: Grade, r: number,
  opts: { selected?: boolean; attacking?: boolean; pulse?: number } = {},
) {
  const fam = FAMILY_COLOR[family] ?? 0xffffff;
  const gradeColor = GRADE_COLOR[grade];
  const pulse = opts.attacking ? 1 + Math.sin((opts.pulse ?? 0) * 14) * 0.06 : 1;
  const rr = r * pulse;
  g.ellipse(x, y + rr * 0.85, rr * 0.85, rr * 0.3).fill({ color: 0x000000, alpha: 0.3 });
  if (opts.selected) {
    g.circle(x, y, rr + 7).stroke({ color: 0xf6d365, width: 2, alpha: 0.9 });
    g.circle(x, y, rr + 11).stroke({ color: 0xf6d365, width: 1, alpha: 0.4 });
  }
  g.circle(x, y, rr).fill({ color: 0x0d1118, alpha: 0.9 });
  g.circle(x, y, rr).stroke({ color: gradeColor, width: Math.max(2, rr * 0.16) });
  g.circle(x, y, rr * 0.7).fill({ color: fam, alpha: 0.85 });
  g.ellipse(x - rr * 0.22, y - rr * 0.26, rr * 0.3, rr * 0.2).fill({ color: 0xffffff, alpha: 0.3 });
  g.poly([x, y - rr * 0.38, x + rr * 0.3, y, x, y + rr * 0.38, x - rr * 0.3, y]).fill({ color: 0x0d1118, alpha: 0.55 });
}

function EnemySpriteLayer({
  renderedEnemies,
  renderTime,
  textures,
}: {
  renderedEnemies: RenderedEnemy[];
  renderTime: number;
  textures: PixiBoardTextures;
}) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const { enemy, x, y } of renderedEnemies) {
      const stunned = enemy.stunUntil > renderTime;
      const slowed = enemy.slows.length > 0;
      const r = enemy.isBoss ? 26 : enemy.armor > 0 ? 15 : 12;
      const cy = y - (enemy.isBoss ? 5 : 2);
      const body = stunned ? 0x5a4a1e : slowed ? 0x2c4258 : 0x3a2430;
      const edge = stunned ? 0xffe14d : slowed ? 0x8fdfff : enemy.isBoss ? 0xd85560 : enemy.armor > 0 ? 0xb8c0d4 : 0xc75560;
      g.ellipse(x, cy + r * 0.8, r * 0.9, r * 0.3).fill({ color: 0x000000, alpha: 0.28 });
      if (enemy.isBoss) {
        g.poly([x - r * 0.7, cy - r * 0.45, x - r * 1.05, cy - r * 1.2, x - r * 0.3, cy - r * 0.8]).fill(0xd8a355);
        g.poly([x + r * 0.7, cy - r * 0.45, x + r * 1.05, cy - r * 1.2, x + r * 0.3, cy - r * 0.8]).fill(0xd8a355);
      }
      if (enemy.armor > 0 && !enemy.isBoss) {
        // 장갑: 육각 실루엣
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          pts.push(x + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.poly(pts).fill({ color: body, alpha: 0.95 }).stroke({ color: edge, width: 2 });
      } else {
        g.circle(x, cy, r).fill({ color: body, alpha: 0.95 }).stroke({ color: edge, width: enemy.isBoss ? 3 : 1.8 });
      }
      // 눈
      g.circle(x - r * 0.28, cy - r * 0.12, Math.max(1.5, r * 0.15)).fill(0xffd7a0);
      g.circle(x + r * 0.28, cy - r * 0.12, Math.max(1.5, r * 0.15)).fill(0xffd7a0);
    }
  }, [renderedEnemies, renderTime]);

  if (!textures.ready) return null;
  return <pixiGraphics draw={draw} />;
}

function UnitDetailSlot({
  color,
  label,
  x,
  y,
}: {
  color: number;
  label: string;
  x: number;
  y: number;
}) {
  const width = Math.min(126, Math.max(72, label.length * 7 + 18));
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 21, 4).fill({ color: 0x151e29, alpha: 0.86 });
    g.roundRect(0, 0, width, 21, 4).stroke({ color, width: 1, alpha: 0.55 });
  }, [color, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        text={label}
        x={9}
        y={4}
        style={{
          fill: 0xdde8f6,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function PixiUnitDetailPanel({
  textures,
  unit,
}: {
  textures: PixiBoardTextures;
  unit: GameState["units"][number];
}) {
  const def = UNIT_BY_ID[unit.defId];
  const gradeColor = GRADE_COLOR[def.grade];
  const familyColor = FAMILY_COLOR[def.family] ?? 0xffffff;
  const chips = passiveChips(def);
  const skillLabels = (def.skills ?? []).slice(0, 2).map((skill) => {
    const rate = skill.trigger.kind === "onAttack"
      ? `${Math.round(skill.trigger.chance * 100)}%`
      : `${skill.trigger.everySeconds}s`;
    return `${skill.name} ${rate}`;
  });
  const slotLabels = [...skillLabels, ...chips, ...def.roles].slice(0, 4);
  while (slotLabels.length < 4) slotLabels.push("Empty");

  const portraitDraw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(14, 16, 92, 112, 8).fill({ color: 0x101820, alpha: 0.92 });
    g.roundRect(14, 16, 92, 112, 8).stroke({ color: gradeColor, width: 3, alpha: 0.9 });
    g.circle(60, 70, 42).fill({ color: familyColor, alpha: 0.34 });
    g.circle(60, 70, 48).stroke({ color: familyColor, width: 1, alpha: 0.58 });
    g.roundRect(124, 61, 82, 44, 5).fill({ color: 0x0a1018, alpha: 0.45 });
    g.roundRect(220, 61, 72, 44, 5).fill({ color: 0x0a1018, alpha: 0.45 });
    g.roundRect(304, 61, 72, 44, 5).fill({ color: 0x0a1018, alpha: 0.45 });
    g.roundRect(388, 61, 130, 44, 5).fill({ color: 0x0a1018, alpha: 0.45 });
  }, [familyColor, gradeColor]);

  const portraitTokenDraw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    drawUnitTokenAt(g, 0, 0, def.family, def.grade, 26);
  }, [def.family, def.grade]);

  return (
    <pixiContainer x={UNIT_DETAIL_X} y={UNIT_DETAIL_Y}>
      <HudPanel accent={gradeColor} height={UNIT_DETAIL_H} width={UNIT_DETAIL_W} x={0} y={0} />
      <pixiGraphics draw={portraitDraw} />
      {textures.ready ? (
        <pixiGraphics draw={portraitTokenDraw} x={60} y={68} />
      ) : null}
      {unit.locked ? (
        <pixiText
          text="LOCK"
          x={44}
          y={111}
          style={{
            fill: 0xf6d365,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 10,
            fontWeight: "bold" as const,
            stroke: { color: 0x000000, width: 2 },
          }}
        />
      ) : null}
      <pixiText
        text="UNIT"
        x={124}
        y={14}
        style={{
          fill: 0x8fd7ff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        text={def.name}
        x={124}
        y={28}
        style={{
          fill: 0xffffff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 17,
          fontWeight: "bold" as const,
          stroke: { color: 0x000000, width: 3 },
          wordWrap: true,
          wordWrapWidth: 250,
        }}
      />
      <pixiText
        text={`${def.grade.toUpperCase()} / ${def.family} / ${def.roles.join("/")}`}
        x={346}
        y={32}
        style={{
          fill: gradeColor,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText text="ATK" x={134} y={67} style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 10, fontWeight: "bold" as const }} />
      <pixiText text={String(def.attack)} x={134} y={81} style={{ fill: 0xffffff, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 19, fontWeight: "bold" as const }} />
      <pixiText text="SPD" x={230} y={67} style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 10, fontWeight: "bold" as const }} />
      <pixiText text={`${def.attackSpeed.toFixed(2)}/s`} x={230} y={84} style={{ fill: 0xe8f2ff, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 13, fontWeight: "bold" as const }} />
      <pixiText text="RNG" x={314} y={67} style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 10, fontWeight: "bold" as const }} />
      <pixiText text={String(def.range)} x={314} y={84} style={{ fill: 0xe8f2ff, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 13, fontWeight: "bold" as const }} />
      <pixiText text="DMG" x={398} y={67} style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 10, fontWeight: "bold" as const }} />
      <pixiText text={fmtNumber(unit.totalDamage)} x={398} y={84} style={{ fill: 0xf6d365, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 13, fontWeight: "bold" as const }} />
      {slotLabels.map((label, index) => (
        <UnitDetailSlot
          color={index < skillLabels.length ? gradeColor : familyColor}
          key={`${label}-${index}`}
          label={label}
          x={124 + (index % 4) * 108}
          y={118}
        />
      ))}
    </pixiContainer>
  );
}

function PixiUnitDetailHud({
  selected,
  state,
  textures,
}: {
  selected: ReadonlySet<number>;
  state: GameState;
  textures: PixiBoardTextures;
}) {
  const selectedUnits = state.units.filter((unit) => selected.has(unit.uid));
  if (selectedUnits.length !== 1) return null;
  return <PixiUnitDetailPanel textures={textures} unit={selectedUnits[0]} />;
}

function DpsGraph({
  snapshot,
}: {
  snapshot: PixiDpsSnapshot;
}) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const [index, row] of snapshot.rows.entries()) {
      const y = 48 + index * 29;
      const gradeColor = GRADE_COLOR[row.grade];
      const familyColor = FAMILY_COLOR[row.family] ?? 0xffffff;
      const barWidth = 136;
      g.roundRect(10, y - 2, 214, 27, 5).fill({ color: 0x101820, alpha: index % 2 === 0 ? 0.5 : 0.3 });
      g.roundRect(17, y + 6, 12, 12, 3).fill({ color: familyColor, alpha: 0.9 });
      g.roundRect(17, y + 6, 12, 12, 3).stroke({ color: gradeColor, width: 2, alpha: 0.9 });
      g.roundRect(39, y + 16, barWidth, 5, 3).fill({ color: 0x26303c, alpha: 0.95 });
      g.roundRect(39, y + 16, Math.max(2, barWidth * clamp01(row.dps / snapshot.maxDps)), 5, 3)
        .fill({ color: gradeColor, alpha: 0.92 });
    }
  }, [snapshot]);

  return <pixiGraphics draw={draw} />;
}

function PixiDpsHud({
  snapshot,
  visible,
}: {
  snapshot: PixiDpsSnapshot;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <pixiContainer x={DPS_HUD_X} y={DPS_HUD_Y}>
      <HudPanel accent={0x4aa3ff} height={DPS_HUD_H} width={DPS_HUD_W} x={0} y={0} />
      <pixiText
        text="DPS"
        x={14}
        y={12}
        style={{
          fill: 0x8fd7ff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        text={`${fmtNumber(snapshot.teamDps)}/s`}
        x={164}
        y={10}
        style={{
          fill: 0xf6d365,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 15,
          fontWeight: "bold" as const,
          stroke: { color: 0x000000, width: 2 },
        }}
      />
      {snapshot.rows.length === 0 || snapshot.teamTotal <= 0 ? (
        <pixiText
          text="DPS waits for combat"
          x={38}
          y={78}
          style={{
            fill: 0x9fb2c7,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 12,
            fontWeight: "bold" as const,
          }}
        />
      ) : (
        <>
          <DpsGraph snapshot={snapshot} />
          {snapshot.rows.map((row, index) => {
            const y = 48 + index * 29;
            const share = snapshot.teamTotal > 0 ? Math.round((row.total / snapshot.teamTotal) * 100) : 0;
            const skillPct = row.total > 0 ? Math.round((row.skill / row.total) * 100) : 0;
            return (
              <pixiContainer key={`dps-row-${row.uid}`}>
                <pixiText
                  text={row.name}
                  x={39}
                  y={y}
                  style={{
                    fill: 0xeef3fa,
                    fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
                    fontSize: 10,
                    fontWeight: "bold" as const,
                    wordWrap: false,
                  }}
                />
                <pixiText
                  text={`${fmtNumber(row.dps)}/s`}
                  x={176}
                  y={y}
                  style={{
                    fill: 0xffffff,
                    fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
                    fontSize: 10,
                    fontWeight: "bold" as const,
                  }}
                />
                <pixiText
                  text={`${fmtNumber(row.total)} total / skill ${skillPct}% / ${share}%`}
                  x={39}
                  y={y + 20}
                  style={{
                    fill: 0x8f9eb0,
                    fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
                    fontSize: 8,
                  }}
                />
              </pixiContainer>
            );
          })}
        </>
      )}
    </pixiContainer>
  );
}

function RecipeIcon({
  active,
  index,
  onCraft,
  onHover,
  onLeave,
  state,
  status,
}: {
  active: boolean;
  index: number;
  onCraft: () => void;
  onHover: () => void;
  onLeave: () => void;
  state: GameState;
  status: RecipeStatus;
}) {
  const def = UNIT_BY_ID[status.recipe.resultUnitId];
  const craftable = canCraftRecipe(status, state);
  const gradeColor = GRADE_COLOR[def.grade];
  const familyColor = FAMILY_COLOR[def.family] ?? 0xffffff;
  const x = 16 + (index % 4) * 70;
  const y = 38 + Math.floor(index / 4) * 42;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, 62, 36, 5).fill({ color: craftable ? 0x16202b : 0x12161c, alpha: craftable ? 0.94 : 0.74 });
    g.roundRect(0, 0, 62, 36, 5).stroke({ color: active ? 0xf6d365 : craftable ? gradeColor : 0x3a424d, width: active ? 2 : 1, alpha: 0.92 });
    g.roundRect(5, 6, 22, 22, def.grade === "common" ? 11 : 5).fill({ color: familyColor, alpha: craftable ? 0.9 : 0.48 });
    g.roundRect(5, 6, 22, 22, def.grade === "common" ? 11 : 5).stroke({ color: gradeColor, width: 2, alpha: craftable ? 0.9 : 0.42 });
    if (!craftable) {
      g.moveTo(7, 28);
      g.lineTo(27, 8);
      g.stroke({ color: 0x8893a0, width: 2, alpha: 0.5 });
    }
  }, [active, craftable, def.grade, familyColor, gradeColor]);

  return (
    <pixiContainer
      cursor={craftable ? "pointer" : "default"}
      eventMode="static"
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      onPointerTap={() => {
        if (craftable) onCraft();
      }}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        text={def.name}
        x={31}
        y={8}
        style={{
          fill: craftable ? 0xeef3fa : 0x7f8b98,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 9,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: 28,
        }}
      />
    </pixiContainer>
  );
}

function RecipeDetails({
  state,
  status,
}: {
  state: GameState;
  status: RecipeStatus;
}) {
  const def = UNIT_BY_ID[status.recipe.resultUnitId];
  const gradeColor = GRADE_COLOR[def.grade];
  const warnings = recipeWarningLines(status, state);
  const craftable = canCraftRecipe(status, state);

  return (
    <pixiContainer x={RECIPE_HUD_X} y={RECIPE_DETAILS_Y}>
      <HudPanel accent={craftable ? 0x6cdd8b : 0xe8a33d} height={RECIPE_DETAILS_H} width={RECIPE_HUD_W} x={0} y={0} />
      <pixiText
        text={craftable ? "READY" : "PLAN"}
        x={14}
        y={10}
        style={{
          fill: craftable ? 0x6cdd8b : 0xe8a33d,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        text={`${def.name} / ${def.grade} / ${status.recipe.cost.gold}G`}
        x={64}
        y={10}
        style={{
          fill: gradeColor,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: 224,
        }}
      />
      <pixiText
        text={recipeMaterialText(status.recipe)}
        x={14}
        y={34}
        style={{
          fill: 0xdbe7f5,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          wordWrap: true,
          wordWrapWidth: 278,
        }}
      />
      {warnings.map((warning, index) => (
        <pixiText
          key={`${warning}-${index}`}
          text={warning}
          x={14}
          y={62 + index * 12}
          style={{
            fill: craftable ? 0x8fd7ff : 0xf2c46d,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 9,
            wordWrap: true,
            wordWrapWidth: 278,
          }}
        />
      ))}
    </pixiContainer>
  );
}

function PixiRecipeSuggestionsPanel({
  selectedDefId,
  state,
}: {
  selectedDefId: string;
  state: GameState;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const related = analyzeRecipes(state)
    .filter((status) => recipeUsesUnit(status.recipe, selectedDefId))
    .slice(0, 8);

  if (related.length === 0) return null;

  const craftableCount = related.filter((status) => canCraftRecipe(status, state)).length;
  const activeStatus = related.find((status) => status.recipe.id === hoveredId) ?? null;

  return (
    <>
      {activeStatus ? <RecipeDetails state={state} status={activeStatus} /> : null}
      <pixiContainer x={RECIPE_HUD_X} y={RECIPE_LIST_Y}>
        <HudPanel accent={craftableCount > 0 ? 0x6cdd8b : 0x4aa3ff} height={RECIPE_LIST_H} width={RECIPE_HUD_W} x={0} y={0} />
        <pixiText
          text={craftableCount > 0 ? "CRAFT" : "RECIPES"}
          x={16}
          y={12}
          style={{
            fill: craftableCount > 0 ? 0x6cdd8b : 0x8fd7ff,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 10,
            fontWeight: "bold" as const,
          }}
        />
        <pixiText
          text={`${craftableCount}/${related.length}`}
          x={250}
          y={12}
          style={{
            fill: 0xeef3fa,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 10,
            fontWeight: "bold" as const,
          }}
        />
        {related.map((status, index) => (
          <RecipeIcon
            active={status.recipe.id === hoveredId}
            index={index}
            key={status.recipe.id}
            onCraft={() => getRuntimeControls()?.act("craft", { recipeId: status.recipe.id })}
            onHover={() => setHoveredId(status.recipe.id)}
            onLeave={() => setHoveredId((current) => current === status.recipe.id ? null : current)}
            state={state}
            status={status}
          />
        ))}
      </pixiContainer>
    </>
  );
}

function PixiRecipeSuggestionsHud({
  selected,
  state,
}: {
  selected: ReadonlySet<number>;
  state: GameState;
}) {
  const selectedUnits = state.units.filter((unit) => selected.has(unit.uid));
  if (selectedUnits.length !== 1) return null;
  return <PixiRecipeSuggestionsPanel selectedDefId={selectedUnits[0].defId} state={state} />;
}

export function PixiBoard({
  revision,
  state,
  selectedUids,
  selectBox,
  attackMoveMode = false,
  paused = false,
  dpsVisible = false,
  showLabels = false,
  showDamage = true,
  renderFrame,
}: PixiBoardProps) {
  const stage = stageById(state.stageId);
  const selected = selectedUids ?? new Set<number>();
  const textures = usePixiBoardTextures();
  const dpsSnapshot = usePixiDpsSnapshot(state);
  const waypoints = useMemo(() => waypointsForStage(state.stageId), [state.stageId]);
  const pathLength = useMemo(() => pathLengthForStage(state.stageId), [state.stageId]);
  const renderTime = useMemo(
    () => renderTimeForState(state, renderFrame),
    [renderFrame, revision, state.time],
  );
  const renderedUnits = useMemo<RenderedUnit[]>(
    () => state.units.map((unit) => ({ unit, ...renderUnitPosition(unit, renderFrame) })),
    [renderFrame, revision, state.units],
  );
  const renderedEnemies = useMemo<RenderedEnemy[]>(
    () => state.enemies.map((enemy) => {
      const dist = renderEnemyDist(enemy, pathLength, renderFrame);
      const p = posAtDist(dist, state.stageId);
      return { enemy, dist, x: p.x, y: p.y };
    }),
    [pathLength, renderFrame, revision, state.enemies, state.stageId],
  );
  const selectedUnits = useMemo(() => state.units.filter((unit) => selected.has(unit.uid)), [selected, state.units]);
  const unitDetailVisible = selectedUnits.length === 1;
  const recipeHudVisible = useMemo(() => {
    if (selectedUnits.length !== 1) return false;
    return analyzeRecipes(state).some((status) => recipeUsesUnit(status.recipe, selectedUnits[0].defId));
  }, [selectedUnits, state]);
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
  const isHudPoint = useCallback((input: BoardPointerInput) => {
    if (unitDetailVisible && input.x >= UNIT_DETAIL_X && input.x <= UNIT_DETAIL_X + UNIT_DETAIL_W && input.y >= UNIT_DETAIL_Y && input.y <= UNIT_DETAIL_Y + UNIT_DETAIL_H) return true;
    if (dpsVisible && input.x >= DPS_HUD_X && input.x <= DPS_HUD_X + DPS_HUD_W && input.y >= DPS_HUD_Y && input.y <= DPS_HUD_Y + DPS_HUD_H) return true;
    if (recipeHudVisible && input.x >= RECIPE_HUD_X && input.x <= RECIPE_HUD_X + RECIPE_HUD_W && input.y >= RECIPE_DETAILS_Y && input.y <= RECIPE_LIST_Y + RECIPE_LIST_H) return true;
    return false;
  }, [dpsVisible, recipeHudVisible, unitDetailVisible]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const input = toBoardInput(event);
    if (isHudPoint(input)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    getRuntimeControls()?.boardPointerDown(input);
  }, [isHudPoint, toBoardInput]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const input = toBoardInput(event);
    if (isHudPoint(input)) return;
    getRuntimeControls()?.boardPointerMove(input);
  }, [isHudPoint, toBoardInput]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const input = toBoardInput(event);
    if (isHudPoint(input)) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
      getRuntimeControls()?.boardPointerCancel();
      return;
    }
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    getRuntimeControls()?.boardPointerUp(input);
  }, [isHudPoint, toBoardInput]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    getRuntimeControls()?.boardPointerCancel();
  }, []);

  const drawBackground = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, BOARD_W, BOARD_H).fill({ color: GROUND_COLOR[stage.ground], alpha: 0.24 });
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
    g.rect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top).stroke({ color: 0x9d7b4b, width: 2, alpha: 0.28 });
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
    g.stroke({ color: 0x241712, width: PATH_WIDTH, alpha: 0.92 });
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
      const size = decorationSize(decoration);
      g.ellipse(decoration.x + size / 2, decoration.y + size * 0.78, size * 0.36, size * 0.14)
        .fill({ color: 0x000000, alpha: 0.24 });
    }
  }, [stage.decorations]);

  const drawUnits = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const { unit, x, y } of renderedUnits) {
      const def = UNIT_BY_ID[unit.defId];
      const isSelected = selected.has(unit.uid);
      const justFired = unit.cooldown > 0 && unit.cooldown > 1 / def.attackSpeed - 0.12;
      if (isSelected) {
        g.circle(x, y, def.range).stroke({ color: 0xe8b54d, width: 1, alpha: 0.4 });
        if (unit.order.kind === "move" || unit.order.kind === "attackMove") {
          const orderColor = unit.order.kind === "attackMove" ? 0xe5534b : 0x6cdd8b;
          g.moveTo(x, y);
          g.lineTo(unit.order.cx, unit.order.cy);
          g.stroke({ color: orderColor, width: 2, alpha: 0.5 });
          g.circle(unit.order.cx, unit.order.cy, 4).fill({ color: orderColor, alpha: 0.8 });
        }
      }
      if (justFired) {
        g.circle(x, y, isSelected ? 25 : 20)
          .stroke({ color: FAMILY_COLOR[def.family] ?? 0xffd98a, width: 2, alpha: 0.75 });
      }
      if (unit.locked) {
        g.rect(x - 7, y - 22, 14, 5).fill({ color: 0xf6d365, alpha: 0.92 });
      }
    }
  }, [renderedUnits, revision, selected]);

  const drawEnemies = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const { enemy, x, y } of renderedEnemies) {
      const radius = enemy.isBoss ? 26 : 13;
      const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
      g.ellipse(x, y + radius * 0.42, radius * 0.75, radius * 0.25).fill({ color: 0x000000, alpha: 0.28 });
      if (enemy.armorBreakStacks > 0 || enemy.ampStacks > 0) {
        const markerColor = enemy.ampStacks > 0 ? 0xb478ff : 0xff8a3d;
        g.circle(x + radius * 0.48, y - radius * 0.52, 4).fill({ color: markerColor, alpha: 0.9 });
      }
      g.rect(x - radius, y - radius - 10, radius * 2, 4).fill({ color: 0x2a1414, alpha: 0.9 });
      g.rect(x - radius, y - radius - 10, radius * 2 * hpPct, 4).fill({
        color: hpPct > 0.5 ? 0x68d06f : hpPct > 0.25 ? 0xe8a33d : 0xe5534b,
        alpha: 0.95,
      });
    }
  }, [renderedEnemies, revision]);

  const drawCastFx = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    for (const fx of state.castFx) {
      const age = renderTime - fx.born;
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
  }, [renderTime, revision, state.castFx]);

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
        <StageGroundLayer stage={stage} textures={textures} />
        <BoardGraphics draw={drawPath} />
        <PathSpriteLayer pathLength={pathLength} stageId={state.stageId} textures={textures} />
        <BoardGraphics draw={drawDecorations} />
        <DecorationSpriteLayer stage={stage} textures={textures} />
        <BoardGraphics draw={drawUnits} />
        <UnitSpriteLayer
          paused={paused}
          renderedUnits={renderedUnits}
          renderTime={renderTime}
          selected={selected}
          state={state}
          textures={textures}
        />
        <EnemySpriteLayer
          renderedEnemies={renderedEnemies}
          renderTime={renderTime}
          textures={textures}
        />
        <BoardGraphics draw={drawEnemies} />
        <BoardGraphics draw={drawCastFx} />
        <BoardGraphics draw={drawBossBar} />
        <BoardGraphics draw={drawOverlay} />
        <GameNineSlice
          alpha={0.9}
          borders={{ left: 44, top: 42, right: 44, bottom: 42 }}
          height={BOARD_H}
          textureKey="frame.panel"
          width={BOARD_W}
        />
        {showLabels ? renderedUnits.map(({ unit, x, y }) => {
          const def = UNIT_BY_ID[unit.defId];
          return (
            <pixiText
              key={`unit-label-${unit.uid}`}
              anchor={0.5}
              text={def.name}
              x={x}
              y={y + 28}
              style={labelStyle}
            />
          );
        }) : null}
        {showDamage ? state.damageFx.map((fx, index) => {
          const age = renderTime - fx.born;
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
        <PixiUnitDetailHud selected={selected} state={state} textures={textures} />
        <PixiRecipeSuggestionsHud selected={selected} state={state} />
        <PixiDpsHud snapshot={dpsSnapshot} visible={dpsVisible} />
      </pixiContainer>
      </Application>
    </div>
  );
}
