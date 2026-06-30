import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { BOARD_H, BOARD_W, FIELD, PATH_WIDTH, pathLengthForStage, posAtDist, waypointsForStage } from "../core/path";
import type { GameState, Grade, UnitDef } from "../core/types";
import { analyzeRecipes } from "../core/advisor";
import { UNIT_BY_ID } from "../data/units";
import { stageById, type StageDecoration, type StageDecorationKind, type StageDef } from "../data/stages";
import { getRuntimeControls, type BoardPointerInput, type RenderInterpolationFrame } from "../runtimeBridge";
import { screenToBoard, type BoardBox } from "../board/boardHitTest";
import groundDarkRockyUrl from "../assets/ui/tile_ground/ground-dark-rocky.png?url";
import groundDirtPlainUrl from "../assets/ui/tile_ground/ground-dirt-plain.png?url";
import groundGrassPatchesUrl from "../assets/ui/tile_ground/ground-grass-patches.png?url";
import groundMagicRuneUrl from "../assets/ui/tile_ground/ground-magic-rune.png?url";
import groundRockyCrackedUrl from "../assets/ui/tile_ground/ground-rocky-cracked.png?url";
import groundSandyPebblesUrl from "../assets/ui/tile_ground/ground-sandy-pebbles.png?url";
import groundScorchedUrl from "../assets/ui/tile_ground/ground-scorched.png?url";
import objectAbandonedShackUrl from "../assets/ui/tile_object/object-abandoned-shack.png?url";
import objectArcanePortalUrl from "../assets/ui/tile_object/object-arcane-portal.png?url";
import objectBlueCrystalClusterUrl from "../assets/ui/tile_object/object-blue-crystal-cluster.png?url";
import objectBoulderPileUrl from "../assets/ui/tile_object/object-boulder-pile.png?url";
import objectBrokenCartUrl from "../assets/ui/tile_object/object-broken-cart.png?url";
import objectCampfireUrl from "../assets/ui/tile_object/object-campfire.png?url";
import objectDeadTreeUrl from "../assets/ui/tile_object/object-dead-tree.png?url";
import objectRuneBannerUrl from "../assets/ui/tile_object/object-rune-banner.png?url";
import objectStoneShrineUrl from "../assets/ui/tile_object/object-stone-shrine.png?url";
import objectWoodenFenceUrl from "../assets/ui/tile_object/object-wooden-fence.png?url";
import battlefieldEnemyEliteUrl from "../assets/ui/battlefield/enemy-marker-elite.png?url";
import battlefieldEnemyNormalUrl from "../assets/ui/battlefield/enemy-marker-normal.png?url";
import battlefieldPathMarkerUrl from "../assets/ui/battlefield/enemy-path-marker.png?url";
import battlefieldPlacedUnitUrl from "../assets/ui/battlefield/placed-unit-marker.png?url";
import battlefieldSelectedUnitUrl from "../assets/ui/battlefield/selected-unit-marker.png?url";
import enemyPortalUrl from "../assets/effects/enemy-portal.png?url";
import { GameNineSlice } from "./skin/createNineSliceSprite";

extend({ Container, Graphics, Sprite, Text });

const forestIdleEastUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-idle02/east/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestIdleWestUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-idle02/west/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestIdleSouthUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-idle02/south/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestWalkEastUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-walk/east/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestWalkWestUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-walk/west/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestAttackEastUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-attack/east/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);
const forestAttackWestUrls = sortedGlob(import.meta.glob("../assets/unit-legendary-forest/animation-attack/west/frame_*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>);

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

const GROUND_TEXTURE_URL: Record<StageDef["ground"], string> = {
  dirt: groundDirtPlainUrl,
  ash: groundScorchedUrl,
  grass: groundGrassPatchesUrl,
  stone: groundRockyCrackedUrl,
  corrupt: groundDarkRockyUrl,
  blood: groundSandyPebblesUrl,
  rune: groundMagicRuneUrl,
};

const DECORATION_TEXTURE_URL: Record<StageDecorationKind, string> = {
  cottage: objectAbandonedShackUrl,
  stoneHouse: objectStoneShrineUrl,
  witchHut: objectArcanePortalUrl,
  rootHouse: objectDeadTreeUrl,
  manor: objectAbandonedShackUrl,
  forge: objectCampfireUrl,
  crypt: objectStoneShrineUrl,
  deadTree: objectDeadTreeUrl,
  oak: objectDeadTreeUrl,
  rottenTree: objectDeadTreeUrl,
  soulTree: objectBlueCrystalClusterUrl,
  specialTree: objectArcanePortalUrl,
  thornBush: objectRuneBannerUrl,
  poisonBush: objectBlueCrystalClusterUrl,
  berryBush: objectBlueCrystalClusterUrl,
  grave: objectStoneShrineUrl,
  coffin: objectStoneShrineUrl,
  shrine: objectStoneShrineUrl,
  fenceWood: objectWoodenFenceUrl,
  fenceIron: objectWoodenFenceUrl,
  gate: objectWoodenFenceUrl,
  market: objectAbandonedShackUrl,
  well: objectStoneShrineUrl,
  cart: objectBrokenCartUrl,
  farmlandDead: objectRuneBannerUrl,
  farmlandSprouts: objectBlueCrystalClusterUrl,
  farmlandCursed: objectArcanePortalUrl,
  rocks: objectBoulderPileUrl,
  runeStone: objectRuneBannerUrl,
  mushrooms: objectBlueCrystalClusterUrl,
  web: objectRuneBannerUrl,
};

const BOARD_TEXTURE_URLS = Array.from(new Set([
  ...Object.values(GROUND_TEXTURE_URL),
  ...Object.values(DECORATION_TEXTURE_URL),
  battlefieldEnemyNormalUrl,
  battlefieldEnemyEliteUrl,
  battlefieldPathMarkerUrl,
  battlefieldPlacedUnitUrl,
  battlefieldSelectedUnitUrl,
  enemyPortalUrl,
  ...forestIdleEastUrls,
  ...forestIdleWestUrls,
  ...forestIdleSouthUrls,
  ...forestWalkEastUrls,
  ...forestWalkWestUrls,
  ...forestAttackEastUrls,
  ...forestAttackWestUrls,
]));

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

function sortedGlob(glob: Record<string, string>) {
  return Object.entries(glob).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
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

function textureFor(url: string) {
  return Texture.from(url);
}

function texturesFor(urls: string[]) {
  return urls.map(textureFor);
}

function usePixiBoardTextures() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Assets.load(BOARD_TEXTURE_URLS).then(() => {
      if (!cancelled) setReady(true);
    }).catch((error) => {
      console.error("Failed to load Pixi board textures", error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({
    ready,
    ground: Object.fromEntries(
      Object.entries(GROUND_TEXTURE_URL).map(([ground, url]) => [ground, textureFor(url)]),
    ) as Record<StageDef["ground"], Texture>,
    decorations: Object.fromEntries(
      Object.entries(DECORATION_TEXTURE_URL).map(([kind, url]) => [kind, textureFor(url)]),
    ) as Record<StageDecorationKind, Texture>,
    enemy: {
      normal: textureFor(battlefieldEnemyNormalUrl),
      elite: textureFor(battlefieldEnemyEliteUrl),
      portal: textureFor(enemyPortalUrl),
    },
    battlefield: {
      pathMarker: textureFor(battlefieldPathMarkerUrl),
      placedUnit: textureFor(battlefieldPlacedUnitUrl),
      selectedUnit: textureFor(battlefieldSelectedUnitUrl),
    },
    unitAnimation: {
      idleEast: texturesFor(forestIdleEastUrls),
      idleWest: texturesFor(forestIdleWestUrls),
      idleSouth: texturesFor(forestIdleSouthUrls),
      walkEast: texturesFor(forestWalkEastUrls),
      walkWest: texturesFor(forestWalkWestUrls),
      attackEast: texturesFor(forestAttackEastUrls),
      attackWest: texturesFor(forestAttackWestUrls),
    },
  }), [ready]);
}

type PixiBoardTextures = ReturnType<typeof usePixiBoardTextures>;

function StageGroundLayer({ stage, textures }: { stage: StageDef; textures: PixiBoardTextures }) {
  if (!textures.ready) return null;
  return (
    <pixiSprite
      alpha={0.55}
      blendMode="multiply"
      height={BOARD_H}
      texture={textures.ground[stage.ground]}
      width={BOARD_W}
      x={0}
      y={0}
    />
  );
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

  if (!textures.ready) return null;

  return (
    <pixiContainer>
      <pixiSprite
        alpha={0.4}
        anchor={0.5}
        height={92}
        texture={textures.enemy.portal}
        width={92}
        x={posAtDist(0, stageId).x}
        y={posAtDist(0, stageId).y}
      />
      {markers.map((marker, index) => (
        <pixiSprite
          alpha={0.58}
          anchor={0.5}
          height={28}
          key={`path-marker-${index}`}
          rotation={marker.angle}
          texture={textures.battlefield.pathMarker}
          width={28}
          x={marker.x}
          y={marker.y}
        />
      ))}
    </pixiContainer>
  );
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

  if (!textures.ready) return null;

  return (
    <pixiContainer>
      {decorations.map((decoration, index) => {
        const size = decorationSize(decoration);
        return (
          <pixiSprite
            alpha={0.9}
            anchor={0.5}
            blendMode="multiply"
            height={size}
            key={`${decoration.kind}-${index}`}
            texture={textures.decorations[decoration.kind]}
            width={size}
            x={decoration.x + size / 2}
            y={decoration.y + size / 2}
          />
        );
      })}
    </pixiContainer>
  );
}

function directionForUnit(unit: GameState["units"][number], x = unit.x) {
  if (unit.order.kind === "move" || unit.order.kind === "attackMove") {
    const dx = unit.order.x - x;
    if (Math.abs(dx) > 8) return dx < 0 ? "west" : "east";
  }
  return "south";
}

function animationForUnit(unit: GameState["units"][number], textures: PixiBoardTextures, x = unit.x) {
  const direction = directionForUnit(unit, x);
  if (unit.state === "moving" || unit.state === "chasing") {
    return direction === "west" ? textures.unitAnimation.walkWest : textures.unitAnimation.walkEast;
  }
  if (unit.state === "attacking" || unit.cooldown > 0.05) {
    return direction === "west" ? textures.unitAnimation.attackWest : textures.unitAnimation.attackEast;
  }
  if (direction === "west") return textures.unitAnimation.idleWest;
  if (direction === "east") return textures.unitAnimation.idleEast;
  return textures.unitAnimation.idleSouth;
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
  if (!textures.ready) return null;

  return (
    <pixiContainer>
      {renderedUnits.map(({ unit, x, y }) => {
        const def = UNIT_BY_ID[unit.defId];
        const isSelected = selected.has(unit.uid);
        const size = def.grade === "hidden" ? 66 : def.grade === "legend" ? 60 : def.grade === "hero" ? 54 : 48;
        const tint = FAMILY_COLOR[def.family] ?? 0xffffff;
        const frames = animationForUnit(unit, textures, x);
        const frameRate = unit.state === "attacking" ? 14 : unit.state === "moving" || unit.state === "chasing" ? 12 : 7;
        const animationTime = paused ? renderTime : renderTime * state.speed;
        const frameIndex = frames.length > 0
          ? Math.floor(animationTime * frameRate + unit.uid) % frames.length
          : 0;
        const frame = frames[frameIndex] ?? Texture.EMPTY;
        return (
          <pixiContainer key={`unit-sprite-${unit.uid}`} x={x} y={y}>
            <pixiSprite
              alpha={isSelected ? 0.9 : 0.48}
              anchor={0.5}
              height={isSelected ? 52 : 42}
              texture={isSelected ? textures.battlefield.selectedUnit : textures.battlefield.placedUnit}
              tint={isSelected ? 0xfff0a6 : GRADE_COLOR[def.grade]}
              width={isSelected ? 46 : 36}
              x={0}
              y={9}
            />
            <pixiSprite
              anchor={0.5}
              height={size}
              texture={frame}
              tint={tint}
              width={size}
              x={0}
              y={-12}
            />
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
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
  if (!textures.ready) return null;

  return (
    <pixiContainer>
      {renderedEnemies.map(({ enemy, x, y }) => {
        const stunned = enemy.stunUntil > renderTime;
        const slowed = enemy.slows.length > 0;
        const size = enemy.isBoss ? 60 : 34;
        const tint = stunned ? 0xffe14d : slowed ? 0x8fdfff : enemy.armor > 0 ? 0xb8c0d4 : 0xffffff;
        return (
          <pixiSprite
            alpha={0.96}
            anchor={0.5}
            height={size}
            key={`enemy-sprite-${enemy.eid}`}
            texture={enemy.isBoss || enemy.armor > 0 ? textures.enemy.elite : textures.enemy.normal}
            tint={tint}
            width={size}
            x={x}
            y={y - (enemy.isBoss ? 5 : 2)}
          />
        );
      })}
    </pixiContainer>
  );
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

  const portraitTexture = textures.unitAnimation.idleSouth[0] ?? Texture.EMPTY;

  return (
    <pixiContainer x={UNIT_DETAIL_X} y={UNIT_DETAIL_Y}>
      <HudPanel accent={gradeColor} height={UNIT_DETAIL_H} width={UNIT_DETAIL_W} x={0} y={0} />
      <pixiGraphics draw={portraitDraw} />
      {textures.ready ? (
        <pixiSprite
          anchor={0.5}
          height={76}
          texture={portraitTexture}
          tint={familyColor}
          width={76}
          x={60}
          y={68}
        />
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
