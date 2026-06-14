// 유닛 애니메이션 스프라이트 — 애니메이션×방향별 개별 PNG 프레임 시퀀스 재생.
// (적 알리언은 단일 스프라이트시트라 sprites.ts로 별도 처리)

import type { UnitState } from "../core/types";

const FRAME_W = 128;
const FRAME_H = 128;
/** 프레임 내 발 위치 비율 (콘텐츠 하단 ≈ y94/128) — 발을 보드 좌표에 정렬 */
const FOOT_FRAC = 0.74;

type FrameSet = Record<string, Record<string, string[]>>; // anim -> dir -> [url 정렬됨]

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
  if (!im) { im = new Image(); im.src = url; imgCache.set(url, im); }
  return im;
}

export type Facing = "east" | "west";

export class UnitSprite {
  constructor(
    private set: FrameSet,
    /** 애니메이션별 재생 속도(fps) */
    private fps: Record<string, number>,
  ) {}

  /** 핵심 애니메이션 이미지를 미리 로드 (깜빡임 최소화) */
  preload(anims: string[]) {
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

    const half = size / 2;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    // 발(프레임 y≈FOOT_FRAC)을 보드 좌표 y에 맞춰 바닥 정렬
    ctx.drawImage(im, 0, 0, FRAME_W, FRAME_H, -half, -size * FOOT_FRAC, size, size);
    ctx.restore();
    return true;
  }
}

const forestSet = buildFrameSet(forestModules);
const forestLegendSprite = new UnitSprite(forestSet, {
  idle02: 6, walk: 14, attack: 18,
});
forestLegendSprite.preload(["idle02", "walk", "attack"]);

/** defId → 스프라이트 (등록된 유닛만 스프라이트로 렌더, 나머지는 도형) */
export const UNIT_SPRITES: Record<string, UnitSprite> = {
  ancient_world_tree: forestLegendSprite,
};
