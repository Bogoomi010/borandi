import { Container, Graphics } from "pixi.js";
import { VW, VH } from "./theme";

export interface SkyOpts {
  top: number;
  bottom: number;
  cloudAlpha: number;
  /** 별(어두운 하늘용) */
  stars?: boolean;
}

interface Cloud { g: Graphics; speed: number; baseY: number }

/** 메뉴 화면과 동일한 하늘·구름 테마 배경. 모든 씬에서 공용. */
export class SkyBackdrop extends Container {
  private clouds: Cloud[] = [];
  private time = 0;

  constructor(opts: SkyOpts) {
    super();
    const sky = new Graphics();
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      sky.rect(0, (VH / steps) * i - 1, VW, VH / steps + 2).fill(lerpColor(opts.top, opts.bottom, t));
    }
    this.addChild(sky);

    if (opts.stars) {
      const stars = new Graphics();
      for (let i = 0; i < 60; i++) {
        const x = (i * 331 + 97) % VW;
        const y = ((i * 197 + 43) % (VH * 0.7));
        stars.circle(x, y, (i % 3) * 0.5 + 0.6).fill({ color: 0xffffff, alpha: 0.25 + (i % 4) * 0.12 });
      }
      this.addChild(stars);
    }

    if (opts.cloudAlpha > 0) {
      const defs: [number, number, number, number][] = [
        [180, 120, 1.0, 6], [640, 70, 0.75, 9], [1050, 160, 1.25, 5],
        [360, 300, 1.5, 4], [900, 420, 1.8, 3], [140, 500, 1.3, 5], [1180, 560, 1.1, 4],
      ];
      for (const [x, y, s, speed] of defs) {
        const g = new Graphics();
        const puffs = [[0, 0, 44], [36, -12, 32], [-38, -8, 30], [68, 2, 24], [-70, 4, 22], [14, -24, 26]];
        for (const [px, py, pr] of puffs) {
          g.circle(px * s, py * s, pr * s).fill({ color: 0xffffff, alpha: opts.cloudAlpha });
        }
        g.position.set(x, y);
        this.addChild(g);
        this.clouds.push({ g, speed, baseY: y });
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const c of this.clouds) {
      c.g.x += c.speed * dt;
      if (c.g.x > VW + 180) c.g.x = -180;
      c.g.y = c.baseY + Math.sin(this.time * 0.4 + c.baseY) * 5;
    }
  }
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
