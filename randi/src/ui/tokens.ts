import { Container, Graphics } from "pixi.js";
import type { UnitDef, WaveType } from "../core/types";
import { FAMILY_COLORS, GRADE_COLORS } from "./theme";

/** 유닛 토큰: 등급 링 + 진영 색 보석 + 진영 문양. 에셋 없이 벡터로 그린다. */
export function drawUnitToken(g: Graphics, def: UnitDef, r: number): void {
  const fam = FAMILY_COLORS[def.family];
  const grade = GRADE_COLORS[def.grade];
  g.clear();
  // 바닥 그림자
  g.ellipse(0, r * 0.82, r * 0.85, r * 0.3).fill({ color: 0x000000, alpha: 0.35 });
  // 등급 링
  g.circle(0, 0, r).fill({ color: 0x14161c, alpha: 0.9 });
  g.circle(0, 0, r).stroke({ color: grade, width: Math.max(2, r * 0.16) });
  // 본체 보석
  g.circle(0, 0, r * 0.72).fill(shade(fam, -0.45));
  g.circle(0, 0, r * 0.72).fill({ color: fam, alpha: 0.85 });
  // 하이라이트
  g.ellipse(-r * 0.22, -r * 0.28, r * 0.32, r * 0.22).fill({ color: 0xffffff, alpha: 0.3 });
  drawFamilyGlyph(g, def.family, r * 0.44);
}

export function makeUnitToken(def: UnitDef, r: number): Container {
  const c = new Container();
  const g = new Graphics();
  drawUnitToken(g, def, r);
  c.addChild(g);
  return c;
}

function drawFamilyGlyph(g: Graphics, family: UnitDef["family"], s: number): void {
  const ink = 0x14161c;
  switch (family) {
    case "flame":
      g.moveTo(0, -s).bezierCurveTo(s * 0.9, -s * 0.2, s * 0.55, s * 0.55, 0, s)
        .bezierCurveTo(-s * 0.55, s * 0.55, -s * 0.9, -s * 0.2, 0, -s)
        .fill({ color: ink, alpha: 0.75 });
      g.circle(0, s * 0.25, s * 0.3).fill({ color: 0xffffff, alpha: 0.5 });
      break;
    case "frost":
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.moveTo(Math.cos(a) * -s, Math.sin(a) * -s).lineTo(Math.cos(a) * s, Math.sin(a) * s)
          .stroke({ color: ink, width: Math.max(1.5, s * 0.22), alpha: 0.75 });
      }
      g.circle(0, 0, s * 0.24).fill({ color: 0xffffff, alpha: 0.6 });
      break;
    case "storm":
      g.poly([ -s * 0.15, -s, s * 0.45, -s * 0.15, s * 0.05, -s * 0.05, s * 0.2, s, -s * 0.45, s * 0.05, -s * 0.02, -s * 0.05 ])
        .fill({ color: ink, alpha: 0.8 });
      break;
    case "iron":
      g.moveTo(0, -s).lineTo(s * 0.8, -s * 0.5).lineTo(s * 0.8, s * 0.25)
        .quadraticCurveTo(s * 0.8, s * 0.8, 0, s)
        .quadraticCurveTo(-s * 0.8, s * 0.8, -s * 0.8, s * 0.25)
        .lineTo(-s * 0.8, -s * 0.5).closePath()
        .fill({ color: ink, alpha: 0.75 });
      break;
    case "void":
      g.ellipse(0, 0, s, s * 0.62).fill({ color: ink, alpha: 0.8 });
      g.circle(0, 0, s * 0.34).fill({ color: 0xffffff, alpha: 0.75 });
      g.circle(0, 0, s * 0.15).fill({ color: ink, alpha: 0.9 });
      break;
    case "forest":
      g.moveTo(0, s * 0.9).quadraticCurveTo(-s, 0, 0, -s * 0.9)
        .quadraticCurveTo(s, 0, 0, s * 0.9)
        .fill({ color: ink, alpha: 0.75 });
      g.moveTo(0, s * 0.8).lineTo(0, -s * 0.7).stroke({ color: 0xffffff, width: Math.max(1, s * 0.12), alpha: 0.45 });
      break;
  }
}

/** 적 토큰 */
export function drawEnemyToken(g: Graphics, type: WaveType, r: number, isBoss: boolean, accent: number): void {
  g.clear();
  g.ellipse(0, r * 0.8, r * 0.9, r * 0.32).fill({ color: 0x000000, alpha: 0.35 });
  if (isBoss) {
    // 보스: 뿔 달린 대형 몸체
    g.circle(0, 0, r).fill(0x3a2430).stroke({ color: 0xd85560, width: 3 });
    g.poly([-r * 0.75, -r * 0.5, -r * 1.05, -r * 1.25, -r * 0.35, -r * 0.85]).fill(0xd8a355);
    g.poly([r * 0.75, -r * 0.5, r * 1.05, -r * 1.25, r * 0.35, -r * 0.85]).fill(0xd8a355);
    g.circle(-r * 0.3, -r * 0.12, r * 0.16).fill(0xffd7a0);
    g.circle(r * 0.3, -r * 0.12, r * 0.16).fill(0xffd7a0);
    g.moveTo(-r * 0.4, r * 0.35).quadraticCurveTo(0, r * 0.6, r * 0.4, r * 0.35)
      .stroke({ color: 0xffd7a0, width: 2.5 });
    return;
  }
  const body = shade(accent, -0.55);
  switch (type) {
    case "swarm":
      g.circle(0, 0, r).fill(body).stroke({ color: accent, width: 1.6, alpha: 0.85 });
      g.circle(-r * 0.28, -r * 0.15, r * 0.15).fill(accent);
      g.circle(r * 0.28, -r * 0.15, r * 0.15).fill(accent);
      break;
    case "armored": {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts).fill(body).stroke({ color: 0xb9c0cc, width: 2.2 });
      g.circle(0, 0, r * 0.35).fill({ color: 0xb9c0cc, alpha: 0.5 });
      break;
    }
    default:
      g.circle(0, 0, r).fill(body).stroke({ color: accent, width: 1.8, alpha: 0.8 });
      g.circle(-r * 0.26, -r * 0.1, r * 0.14).fill(0xffe0e0);
      g.circle(r * 0.26, -r * 0.1, r * 0.14).fill(0xffe0e0);
      break;
  }
}

export function shade(color: number, amt: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}
