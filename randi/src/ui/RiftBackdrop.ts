import { Container, Graphics } from "pixi.js";
import { VW, VH, FAMILY_COLORS } from "./theme";
import { shade } from "./tokens";

/**
 * '차원 균열' 테마 배경 — 기존 게임의 직접 그린 메뉴 화면과 동일한 무드.
 * 짙은 어둠 + 중앙 금빛 글로우 + 떠오르는 진영색 다이아 파티클. 에셋 0.
 */
export interface RiftOpts {
  /** 글로우 색 (기본: 금빛). 스테이지 악센트로 물들일 수 있다 */
  glow?: number;
  /** 파티클 수 */
  count?: number;
  /** 글로우 중심 y 비율 (기본 0.42) */
  glowY?: number;
}

interface P { x: number; y: number; vy: number; size: number; color: number; rot: number; vr: number; phase: number }

const PALETTE = Object.values(FAMILY_COLORS);

export class RiftBackdrop extends Container {
  private particles: P[] = [];
  private layer = new Graphics();

  constructor(opts: RiftOpts = {}) {
    super();
    const glow = opts.glow ?? 0xf4c95a;
    const glowY = VH * (opts.glowY ?? 0.42);

    const bg = new Graphics();
    bg.rect(0, 0, VW, VH).fill(0x0c0f14);
    const r = Math.min(VW, VH);
    bg.circle(VW / 2, glowY, r * 0.5).fill({ color: glow, alpha: 0.05 });
    bg.circle(VW / 2, glowY, r * 0.34).fill({ color: glow, alpha: 0.055 });
    bg.circle(VW / 2, glowY, r * 0.2).fill({ color: shade(glow, -0.2), alpha: 0.045 });
    this.addChild(bg, this.layer);

    const n = opts.count ?? 46;
    for (let i = 0; i < n; i++) this.particles.push(this.spawn(Math.random() * VH));
  }

  private spawn(y?: number): P {
    return {
      x: Math.random() * VW,
      y: y ?? VH + 20,
      vy: 8 + Math.random() * 18,
      size: 3 + Math.random() * 9,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.6,
      phase: Math.random() * Math.PI * 2,
    };
  }

  update(dt: number): void {
    const g = this.layer;
    g.clear();
    for (let i = 0; i < this.particles.length; i++) {
      let p = this.particles[i];
      p.y -= p.vy * dt;
      p.rot += p.vr * dt;
      p.phase += dt;
      if (p.y < -30) {
        p = this.spawn();
        this.particles[i] = p;
      }
      const alpha = Math.max(0.08, 0.35 + Math.sin(p.phase * 2) * 0.2);
      const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
      const base: [number, number][] = [
        [0, -p.size], [p.size * 0.6, 0], [0, p.size], [-p.size * 0.6, 0],
      ];
      const pts = base.flatMap(([x, y]) => [p.x + x * cos - y * sin, p.y + x * sin + y * cos]);
      g.poly(pts).fill({ color: p.color, alpha });
    }
  }
}
