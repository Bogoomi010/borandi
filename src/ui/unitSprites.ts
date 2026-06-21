// 유닛 애니메이션 스프라이트 — 애니메이션×방향별 개별 PNG 프레임 시퀀스 재생.
// (적 알리언은 단일 스프라이트시트라 sprites.ts로 별도 처리)

import type { UnitDef, UnitState } from "../core/types";
import { UNITS } from "../data/units";

const FRAME_W = 128;
const FRAME_H = 128;
/** 프레임 내 발 위치 비율 (콘텐츠 하단 ≈ y94/128) — 발을 보드 좌표에 정렬 */
const FOOT_FRAC = 0.74;

type FrameSet = Record<string, Record<string, string[]>>; // anim -> dir -> [url 정렬됨]
type FamilyMark = "flame" | "frost" | "storm" | "iron" | "void" | "forest";
type RoleMark = "waveClear" | "hold" | "bossKiller" | "debuff" | "economy" | "finisher";
type SpriteStyle = {
  id: string;
  family: FamilyMark;
  role: RoleMark;
  aura: string;
  accent: string;
  filter: string;
  scale: number;
  phase: number;
};

// forest 전설 프레임 일괄 수집 (Vite glob: 키는 forward-slash 경로)
const forestModules = import.meta.glob(
  "../assets/unit-legendary-forest/**/frame_*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function buildFrameSet(modules: Record<string, string>): FrameSet {
  const tmp: Record<string, Record<string, { n: number; url: string }[]>> = {};
  for (const path in modules) {
    const m = path.match(/animation-([^/\\]+)[/\\]([^/\\]+)[/\\]frame_(\d+)\.png$/);
    if (!m) continue;
    const [, anim, dir, num] = m;
    (tmp[anim] ??= {});
    (tmp[anim][dir] ??= []);
    tmp[anim][dir].push({ n: parseInt(num, 10), url: modules[path] });
  }
  const set: FrameSet = {};
  for (const anim in tmp) {
    set[anim] = {};
    for (const dir in tmp[anim]) {
      set[anim][dir] = tmp[anim][dir].sort((a, b) => a.n - b.n).map((x) => x.url);
    }
  }
  return set;
}

// 이미지 캐시 (url -> Image). 처음 그릴 때 lazy 로드.
const imgCache = new Map<string, HTMLImageElement>();
function getImg(url: string): HTMLImageElement {
  let im = imgCache.get(url);
  if (typeof Image === "undefined") return { complete: false, naturalWidth: 0 } as HTMLImageElement;
  if (!im) { im = new Image(); im.src = url; imgCache.set(url, im); }
  return im;
}

const FAMILY_ASSET_STYLE: Record<FamilyMark, { hue: number; aura: string; accent: string; contrast: number }> = {
  flame: { hue: 330, aura: "#ff6b32", accent: "#ffd36a", contrast: 1.08 },
  frost: { hue: 150, aura: "#68c8ff", accent: "#d7f5ff", contrast: 1.04 },
  storm: { hue: 214, aura: "#a978ff", accent: "#e7dcff", contrast: 1.1 },
  iron: { hue: 38, aura: "#c6c0ae", accent: "#ffdf8a", contrast: 1.18 },
  void: { hue: 262, aura: "#9b5cff", accent: "#f08cff", contrast: 1.14 },
  forest: { hue: 0, aura: "#64d77a", accent: "#e3ff9b", contrast: 1.02 },
};

const GRADE_ASSET_STYLE: Record<UnitDef["grade"], { scale: number; saturate: number; brightness: number; glow: number }> = {
  common: { scale: 0.74, saturate: 0.86, brightness: 0.88, glow: 0.35 },
  rare: { scale: 0.82, saturate: 1.02, brightness: 0.96, glow: 0.45 },
  hero: { scale: 0.91, saturate: 1.15, brightness: 1.04, glow: 0.58 },
  legend: { scale: 1, saturate: 1.35, brightness: 1.13, glow: 0.78 },
  hidden: { scale: 1.08, saturate: 1.55, brightness: 1.22, glow: 0.95 },
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function assetStyleFor(def: UnitDef): SpriteStyle {
  const family = def.family as FamilyMark;
  const role = (def.roles[0] ?? "waveClear") as RoleMark;
  const familyStyle = FAMILY_ASSET_STYLE[family];
  const gradeStyle = GRADE_ASSET_STYLE[def.grade];
  const jitter = (hashId(def.id) % 31) - 15;
  return {
    id: def.id,
    family,
    role,
    aura: familyStyle.aura,
    accent: familyStyle.accent,
    filter: [
      `hue-rotate(${familyStyle.hue + jitter}deg)`,
      `saturate(${gradeStyle.saturate})`,
      `brightness(${gradeStyle.brightness})`,
      `contrast(${familyStyle.contrast})`,
      `drop-shadow(0 0 ${Math.round(4 + gradeStyle.glow * 6)}px ${familyStyle.aura})`,
    ].join(" "),
    scale: gradeStyle.scale,
    phase: hashId(def.id) % 100,
  };
}

function drawAura(ctx: CanvasRenderingContext2D, style: SpriteStyle, x: number, y: number, size: number, time: number) {
  const pulse = 0.55 + Math.sin(time * 4 + style.phase) * 0.12;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = style.aura;
  ctx.lineWidth = 2;
  ctx.shadowColor = style.aura;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.1, size * 0.19, size * 0.07, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRoleMark(ctx: CanvasRenderingContext2D, style: SpriteStyle, x: number, y: number, size: number, time: number) {
  const bob = Math.sin(time * 3 + style.phase) * 1.4;
  ctx.save();
  ctx.translate(x + size * 0.28, y - size * 0.58 + bob);
  ctx.strokeStyle = style.accent;
  ctx.fillStyle = style.accent;
  ctx.lineWidth = 2;
  ctx.shadowColor = style.aura;
  ctx.shadowBlur = 8;
  switch (style.role) {
    case "hold":
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-4, -4, 8, 8);
      break;
    case "bossKiller":
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -2);
      ctx.lineTo(4, 6);
      ctx.lineTo(0, 9);
      ctx.lineTo(-4, 6);
      ctx.lineTo(-6, -2);
      ctx.closePath();
      ctx.stroke();
      break;
    case "debuff":
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      break;
    case "economy":
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 9, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(18, 36, 22, .65)";
      ctx.beginPath();
      ctx.moveTo(-2, 5);
      ctx.lineTo(3, -5);
      ctx.stroke();
      break;
    case "finisher":
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.quadraticCurveTo(2, -2, 8, -8);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(3, -2);
      ctx.lineTo(9, 0);
      ctx.lineTo(3, 2);
      ctx.lineTo(0, 8);
      ctx.lineTo(-3, 2);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-3, -2);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

export type Facing = "east" | "west";

export class UnitSprite {
  constructor(
    private set: FrameSet,
    /** 애니메이션별 재생 속도(fps) */
    private fps: Record<string, number>,
    private style: SpriteStyle,
  ) {}

  /** 핵심 애니메이션 이미지를 미리 로드 (깜빡임 최소화) */
  preload(anims: string[]) {
    if (typeof Image === "undefined") return;
    for (const a of anims) {
      const dirs = this.set[a];
      if (!dirs) continue;
      for (const dir in dirs) for (const url of dirs[dir]) getImg(url);
    }
  }

  /** 상태 → 애니메이션 이름 */
  private animFor(state: UnitState): string {
    switch (state) {
      case "moving": case "chasing": return "walk";
      case "attacking": return "attack";
      default: return "idle02"; // idle / hold
    }
  }

  /**
   * 유닛 한 마리를 그린다. 준비된 프레임이 없으면 false(호출측이 도형 폴백).
   * @param facing 좌우 방향(이동/추적 기준). idle은 가능하면 south(정면).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    state: UnitState, facing: Facing,
    time: number, phase: number, size: number,
  ): boolean {
    const anim = this.animFor(state);
    const dirs = this.set[anim];
    if (!dirs) return false;

    // 방향 결정: idle은 정면(south) 우선, 이동/공격은 좌우. 없으면 좌우 반전/폴백.
    let dir: string;
    let flip = false;
    const isIdle = anim === "idle02";
    if (isIdle && dirs["south"]) {
      dir = "south";
    } else if (dirs[facing]) {
      dir = facing;
    } else {
      const other = facing === "east" ? "west" : "east";
      if (dirs[other]) { dir = other; flip = true; }
      else if (dirs["south"]) { dir = "south"; }
      else { dir = Object.keys(dirs)[0]; }
    }

    const frames = dirs[dir];
    if (!frames || frames.length === 0) return false;
    const fps = this.fps[anim] ?? 10;
    const idx = (Math.floor(time * fps + phase) % frames.length + frames.length) % frames.length;
    const im = getImg(frames[idx]);
    if (!im.complete || im.naturalWidth === 0) return false;

    const drawSize = size * this.style.scale;
    const half = drawSize / 2;
    drawAura(ctx, this.style, x, y, drawSize, time);
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.filter = this.style.filter;
    // 발(프레임 y≈FOOT_FRAC)을 보드 좌표 y에 맞춰 바닥 정렬
    ctx.drawImage(im, 0, 0, FRAME_W, FRAME_H, -half, -drawSize * FOOT_FRAC, drawSize, drawSize);
    ctx.restore();
    drawRoleMark(ctx, this.style, x, y, drawSize, time);
    return true;
  }
}

const forestSet = buildFrameSet(forestModules);

function createUnitSprite(def: UnitDef): UnitSprite {
  const sprite = new UnitSprite(forestSet, {
    idle02: 6,
    walk: 14,
    attack: 18,
  }, assetStyleFor(def));
  sprite.preload(["idle02", "walk", "attack"]);
  return sprite;
}

/** defId → 스프라이트 (등록된 유닛만 스프라이트로 렌더, 나머지는 도형) */
export const UNIT_SPRITES: Record<string, UnitSprite> = Object.fromEntries(
  UNITS.map((unit) => [unit.id, createUnitSprite(unit)]),
);

export const UNIT_SPRITE_ASSET_IDS = Object.keys(UNIT_SPRITES);
