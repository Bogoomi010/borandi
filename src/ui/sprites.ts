// 적군 스프라이트 시트 렌더러.
// 에셋 없이 도형으로만 표현하던 적을 걷기 스프라이트 애니메이션으로 교체한다.
// 시트: 64x64 프레임 8개 (4열 x 2행), 좌→우 진행하는 걷기 사이클.

import alien1WalkUrl from "../assets/enemies/alien1_walk.png";

const FRAME_W = 64;
const FRAME_H = 64;
const COLS = 4;
const FRAMES = 8;
/** 걷기 사이클 재생 속도 (frames per second) */
const WALK_FPS = 10;

/** 상태 틴트를 입히기 위한 오프스크린 캔버스 (프레임 1칸 크기) */
const tintCanvas = document.createElement("canvas");
tintCanvas.width = FRAME_W;
tintCanvas.height = FRAME_H;
const tintCtx = tintCanvas.getContext("2d")!;

export class EnemySprite {
  private img = new Image();
  loaded = false;

  constructor(url: string) {
    this.img.onload = () => {
      this.loaded = true;
    };
    this.img.src = url;
  }

  /**
   * 적 한 마리를 그린다.
   * @param time   게임 시간(초) — 결정론적 timestep 기준이라 애니메이션이 일관됨
   * @param phase  개체별 위상 오프셋(eid 등) — 군집이 동시에 같은 발을 딛지 않게 함
   * @param size   화면상 한 변 크기(px)
   * @param faceLeft 진행 방향이 왼쪽이면 좌우 반전
   * @param tint   상태 틴트 색 (없으면 원본). 스프라이트 픽셀에만 입힘.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
    phase: number,
    size: number,
    faceLeft: boolean,
    tint?: string,
    tintAlpha = 0.45,
  ) {
    if (!this.loaded) return;
    const frame = (Math.floor(time * WALK_FPS) + phase) % FRAMES;
    const sx = (frame % COLS) * FRAME_W;
    const sy = Math.floor(frame / COLS) * FRAME_H;

    // 발 딛는 느낌의 미세한 상하 바운스 (사이클당 2회)
    const bounce = Math.sin((time * WALK_FPS + phase) * Math.PI) * size * 0.04;
    const half = size / 2;
    // 캐릭터는 프레임 하단(발=y63)에 그려져 있으므로 발을 기준점(y)에 맞춰 바닥 정렬한다.
    const footY = -size + size * (1 / FRAME_H); // 프레임 맨 아랫줄을 기준점에 정렬

    let src: CanvasImageSource = this.img;
    let srcX = sx;
    let srcY = sy;
    if (tint) {
      // 프레임을 오프스크린에 복사 후 source-atop으로 스프라이트 픽셀에만 색을 덧입힌다.
      tintCtx.clearRect(0, 0, FRAME_W, FRAME_H);
      tintCtx.globalCompositeOperation = "source-over";
      tintCtx.drawImage(this.img, sx, sy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      tintCtx.globalCompositeOperation = "source-atop";
      tintCtx.globalAlpha = tintAlpha;
      tintCtx.fillStyle = tint;
      tintCtx.fillRect(0, 0, FRAME_W, FRAME_H);
      tintCtx.globalAlpha = 1;
      tintCtx.globalCompositeOperation = "source-over";
      src = tintCanvas;
      srcX = 0;
      srcY = 0;
    }

    ctx.save();
    ctx.translate(x, y + bounce);
    if (faceLeft) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false; // 픽셀아트 선명하게
    ctx.drawImage(src, srcX, srcY, FRAME_W, FRAME_H, -half, footY, size, size);
    ctx.restore();
  }
}

export const alien1Walk = new EnemySprite(alien1WalkUrl);
