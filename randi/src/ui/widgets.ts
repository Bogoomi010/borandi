import { Container, Graphics, Text, type TextStyle } from "pixi.js";
import { COLORS, GRADE_COLORS, GRADE_STARS, font, fontBold } from "./theme";
import type { Grade } from "../core/types";
import { sfx } from "../audio/sfx";

// ============================================================
// 콘솔 게임 문법의 공유 프리미티브 — 전부 벡터, 에셋 0
// ============================================================

/** 모서리를 깎은(chamfer) 콘솔풍 프레임 경로 */
export function chamfer(g: Graphics, x: number, y: number, w: number, h: number, c: number): Graphics {
  g.poly([
    x + c, y, x + w - c, y, x + w, y + c,
    x + w, y + h - c, x + w - c, y + h,
    x + c, y + h, x, y + h - c, x, y + c,
  ]);
  return g;
}

/** 금색 코너 브래킷 4개 (콘솔 UI 시그니처) */
export function drawCornerBrackets(
  g: Graphics, w: number, h: number,
  o = 5, len = 13, color = 0xe7b53e, alpha = 0.65,
): void {
  const s = { color, width: 2, alpha };
  g.moveTo(o, o + len).lineTo(o, o + 4).lineTo(o + 4, o).lineTo(o + len, o).stroke(s);
  g.moveTo(w - o - len, o).lineTo(w - o - 4, o).lineTo(w - o, o + 4).lineTo(w - o, o + len).stroke(s);
  g.moveTo(w - o, h - o - len).lineTo(w - o, h - o - 4).lineTo(w - o - 4, h - o).lineTo(w - o - len, h - o).stroke(s);
  g.moveTo(o + len, h - o).lineTo(o + 4, h - o).lineTo(o, h - o - 4).lineTo(o, h - o - len).stroke(s);
}

// ===== 패널 =====

export interface PanelOpts {
  width: number;
  height: number;
  radius?: number; // chamfer 크기로 사용
  fill?: number;
  fillAlpha?: number;
  border?: number;
  borderWidth?: number;
  /** 코너 브래킷 표시 (기본 true) */
  ornate?: boolean;
}

export function drawPanel(g: Graphics, o: PanelOpts): Graphics {
  const c = Math.min(16, o.radius ?? 12);
  g.clear();
  chamfer(g, 0, 0, o.width, o.height, c)
    .fill({ color: o.fill ?? 0x10151d, alpha: o.fillAlpha ?? 0.78 });
  // 상단 사선 광택
  g.poly([c, 1, o.width - c, 1, o.width - c - 8, 5, c + 8, 5])
    .fill({ color: 0xffffff, alpha: 0.04 });
  chamfer(g, 0, 0, o.width, o.height, c)
    .stroke({ color: o.border ?? 0x384452, width: o.borderWidth ?? 1.5, alpha: 0.85 });
  if (o.ornate !== false) drawCornerBrackets(g, o.width, o.height);
  return g;
}

export function makePanel(o: PanelOpts): Graphics {
  return drawPanel(new Graphics(), o);
}

// ===== 앵귤러 명판 (섹션/모달 타이틀) =====

export function makePlaque(text: string, minWidth = 0, fontSize = 17): Container {
  const box = new Container();
  const t = new Text({
    text,
    style: fontBold(fontSize, 0xf6d365, { letterSpacing: 3 }),
  });
  t.anchor.set(0.5);
  const w = Math.max(minWidth, t.width + 96);
  const h = fontSize + 22;
  const g = new Graphics();
  const wing = 18;
  g.poly([
    -w / 2, 0, -w / 2 + wing, -h / 2, w / 2 - wing, -h / 2,
    w / 2, 0, w / 2 - wing, h / 2, -w / 2 + wing, h / 2,
  ]).fill({ color: 0x151b24, alpha: 0.97 })
    .stroke({ color: 0xe7b53e, width: 1.5, alpha: 0.7 });
  // 내부 라인
  g.poly([
    -w / 2 + 7, 0, -w / 2 + wing + 4, -h / 2 + 4, w / 2 - wing - 4, -h / 2 + 4,
    w / 2 - 7, 0, w / 2 - wing - 4, h / 2 - 4, -w / 2 + wing + 4, h / 2 - 4,
  ]).stroke({ color: 0xe7b53e, width: 1, alpha: 0.25 });
  // 양 옆 다이아
  g.poly([-w / 2 - 12, 0, -w / 2 - 4, -5, -w / 2 + 4, 0, -w / 2 - 4, 5]).fill({ color: 0xe7b53e, alpha: 0.85 });
  g.poly([w / 2 + 12, 0, w / 2 + 4, -5, w / 2 - 4, 0, w / 2 + 4, 5]).fill({ color: 0xe7b53e, alpha: 0.85 });
  box.addChild(g, t);
  return box;
}

// ===== 버튼 =====

export type ButtonTone = "normal" | "primary" | "danger" | "good";

export interface ButtonOpts {
  width: number;
  height: number;
  label: string;
  sub?: string;
  keycap?: string;
  tone?: ButtonTone;
  fontSize?: number;
  onClick?: () => void;
}

const TONE_ACCENT: Record<ButtonTone, number> = {
  normal: 0xe7b53e,
  primary: 0xf6d365,
  danger: 0xff7a6b,
  good: 0x79d65a,
};
const TONE_HOVER_BORDER: Record<ButtonTone, number> = {
  normal: 0x6fb8ff,
  primary: 0xf6d365,
  danger: 0xff9a8a,
  good: 0x9fe085,
};

export class UiButton extends Container {
  private bg = new Graphics();
  private labelText: Text;
  private subText?: Text;
  private keycapView?: Container;
  private opts: ButtonOpts;
  private hovered = false;
  private pressed = false;
  private _enabled = true;

  constructor(opts: ButtonOpts) {
    super();
    this.opts = opts;
    this.addChild(this.bg);
    this.labelText = new Text({
      text: opts.label,
      style: fontBold(opts.fontSize ?? 16, COLORS.textMain, {
        stroke: { color: 0x0c0e14, width: 3 },
      }),
    });
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);
    if (opts.sub) {
      this.subText = new Text({
        text: opts.sub,
        style: font(11, { fill: 0x8fd7ff, stroke: { color: 0x0c0e14, width: 2.5 } }),
      });
      this.subText.anchor.set(0.5);
      this.addChild(this.subText);
    }
    if (opts.keycap) {
      this.keycapView = makeKeycap(opts.keycap);
      this.addChild(this.keycapView);
    }
    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerover", () => { this.hovered = true; this.redraw(); });
    this.on("pointerout", () => { this.hovered = false; this.pressed = false; this.redraw(); });
    this.on("pointerdown", () => { this.pressed = true; this.redraw(); });
    this.on("pointerup", () => {
      if (this.pressed && this._enabled) {
        sfx.click();
        this.opts.onClick?.();
      }
      this.pressed = false;
      this.redraw();
    });
    this.on("pointerupoutside", () => { this.pressed = false; this.redraw(); });
    this.redraw();
  }

  setLabel(label: string, sub?: string): void {
    if (this.labelText.text !== label) this.labelText.text = label;
    if (this.subText && sub !== undefined && this.subText.text !== sub) this.subText.text = sub;
    this.layout();
  }

  setEnabled(v: boolean): void {
    if (this._enabled === v) return;
    this._enabled = v;
    this.eventMode = v ? "static" : "none";
    this.cursor = v ? "pointer" : "default";
    this.redraw();
  }

  get enabledState(): boolean { return this._enabled; }

  setTone(tone: ButtonTone): void {
    if (this.opts.tone === tone) return;
    this.opts.tone = tone;
    this.redraw();
  }

  private layout(): void {
    const { width: w, height: h } = this.opts;
    const hasSub = !!this.subText?.text;
    this.labelText.position.set(w / 2, hasSub ? h / 2 - 8 : h / 2);
    this.subText?.position.set(w / 2, h / 2 + 11);
    this.keycapView?.position.set(7, 6);
  }

  private redraw(): void {
    const { width: w, height: h } = this.opts;
    const tone = this.opts.tone ?? "normal";
    const accent = TONE_ACCENT[tone];
    const hover = this._enabled && (this.hovered || this.pressed);
    const cut = Math.min(10, h / 4);
    const g = this.bg;
    g.clear();
    // 호버 시 외곽 글로우
    if (hover) {
      chamfer(g, -3, -3, w + 6, h + 6, cut + 2)
        .stroke({ color: TONE_HOVER_BORDER[tone], width: 4, alpha: 0.18 });
    }
    // 본체: 모따기 다크 카드
    chamfer(g, 0, 0, w, h, cut)
      .fill({ color: hover ? 0x1f3658 : 0x151b24, alpha: this._enabled ? (this.pressed ? 0.99 : 0.94) : 0.55 });
    // 상단 사선 광택
    g.poly([cut, 1, w - cut, 1, w - cut - 6, 5, cut + 6, 5])
      .fill({ color: 0xffffff, alpha: this._enabled ? 0.05 : 0.02 });
    chamfer(g, 0, 0, w, h, cut)
      .stroke({ color: hover ? TONE_HOVER_BORDER[tone] : 0x384452, width: hover ? 2 : 1.2, alpha: 0.9 });
    // 좌측 액센트 노치
    g.poly([0, cut, 3.5, cut + 2, 3.5, h - cut - 2, 0, h - cut])
      .fill({ color: accent, alpha: this._enabled ? 0.95 : 0.3 });
    this.labelText.style.fill = this._enabled ? 0xeef3fa : 0x718091;
    if (this.subText) this.subText.style.fill = this._enabled ? 0x8fd7ff : 0x718091;
    if (this.keycapView) this.keycapView.alpha = this._enabled ? 0.95 : 0.35;
    this.layout();
  }
}

// ===== 키캡 (게임패드/키보드 프롬프트 느낌) =====

export function makeKeycap(key: string): Container {
  const c = new Container();
  const t = new Text({ text: key, style: fontBold(10, 0xcfe0ff) });
  const w = Math.max(17, t.width + 9);
  const g = new Graphics();
  g.roundRect(0, 2, w, 15, 3).fill(0x0e131b); // 아래 두께
  g.roundRect(0, 0, w, 14, 3).fill(0x27303f).stroke({ color: 0x4a5a74, width: 1, alpha: 0.9 });
  t.position.set(w / 2 - t.width / 2, 1);
  c.addChild(g, t);
  return c;
}

// ===== 등급 별 =====

export function makeGradeStars(grade: Grade, size = 7): Container {
  const c = new Container();
  const n = GRADE_STARS[grade];
  const color = GRADE_COLORS[grade];
  for (let i = 0; i < n; i++) {
    const s = new Graphics();
    drawStar(s, size, color);
    s.position.set(i * (size * 2 + 3), 0);
    c.addChild(s);
  }
  return c;
}

export function drawStar(g: Graphics, r: number, color: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.poly(pts).fill(color).stroke({ color: 0x14161c, width: 1, alpha: 0.6 });
}

// ===== 게이지 바 (세그먼트 콘솔 스타일) =====

export class UiBar extends Container {
  private bg = new Graphics();
  private fg = new Graphics();
  private w: number;
  private h: number;
  private color: number;
  private lastRatio = -1;

  constructor(w: number, h: number, color: number, back = 0x0e131b) {
    super();
    this.w = w; this.h = h; this.color = color;
    const cut = Math.min(4, h / 2);
    chamfer(this.bg, 0, 0, w, h, cut).fill(back)
      .stroke({ color: 0x384452, width: 1, alpha: 0.8 });
    this.addChild(this.bg, this.fg);
    this.setRatio(1);
  }

  setRatio(r: number, color?: number): void {
    const ratio = Math.max(0, Math.min(1, r));
    if (color !== undefined) this.color = color;
    if (Math.abs(ratio - this.lastRatio) < 0.003 && color === undefined) return;
    this.lastRatio = ratio;
    this.fg.clear();
    if (ratio > 0.01) {
      const w = (this.w - 2) * ratio;
      const cut = Math.min(3, (this.h - 2) / 2);
      chamfer(this.fg, 1, 1, w, this.h - 2, cut).fill(this.color);
      this.fg.rect(1, 1, w, (this.h - 2) / 2.6).fill({ color: 0xffffff, alpha: 0.2 });
      // 세그먼트 눈금
      const seg = Math.max(24, this.w / 12);
      for (let x = seg; x < w; x += seg) {
        this.fg.rect(x, 1, 1, this.h - 2).fill({ color: 0x0c0f14, alpha: 0.35 });
      }
    }
  }
}

// ===== 재화 명판 =====

export class ResourceBadge extends Container {
  private valueText: Text;
  private lastValue = "";

  constructor(iconDraw: (g: Graphics) => void, initial: string, minWidth = 86, style?: TextStyle) {
    super();
    const g = new Graphics();
    chamfer(g, 0, 0, minWidth, 26, 8).fill({ color: 0x10151d, alpha: 0.82 })
      .stroke({ color: 0x384452, width: 1.2, alpha: 0.9 });
    g.poly([0, 8, 2.5, 9.5, 2.5, 16.5, 0, 18]).fill({ color: 0xe7b53e, alpha: 0.8 });
    const icon = new Graphics();
    iconDraw(icon);
    icon.position.set(15, 13);
    this.valueText = new Text({ text: initial, style: style ?? fontBold(14, COLORS.textGold) });
    this.valueText.anchor.set(0, 0.5);
    this.valueText.position.set(28, 13.5);
    this.addChild(g, icon, this.valueText);
  }

  setValue(v: string): void {
    if (v === this.lastValue) return;
    this.lastValue = v;
    this.valueText.text = v;
  }
}

export function drawGoldIcon(g: Graphics): void {
  g.circle(0, 0, 7).fill(0xe7b53e).stroke({ color: 0x8a6a1e, width: 1.5 });
  g.circle(0, 0, 4).stroke({ color: 0xffe9a8, width: 1.2 });
}

export function drawSkullIcon(g: Graphics): void {
  g.circle(0, -1, 6).fill(0xd8dde6);
  g.roundRect(-4, 2, 8, 4, 1.5).fill(0xd8dde6);
  g.circle(-2.4, -1.5, 1.7).fill(0x20242c);
  g.circle(2.4, -1.5, 1.7).fill(0x20242c);
}

export function drawWaveIcon(g: Graphics): void {
  g.moveTo(-7, 2).quadraticCurveTo(-3.5, -6, 0, 2).quadraticCurveTo(3.5, 8, 7, 0)
    .stroke({ color: 0x7fd0ff, width: 2.4 });
}

export function drawUnitCapIcon(g: Graphics): void {
  g.circle(-3, -2, 3.4).fill(0xa9c1e8);
  g.circle(3.5, 0, 2.8).fill(0x7d95ba);
  g.roundRect(-7, 2, 8.5, 5, 2).fill(0xa9c1e8);
  g.roundRect(0.5, 3, 7, 4, 2).fill(0x7d95ba);
}

// ===== 스탯 글리프 (콘솔 UI용 아이콘) =====

export function drawStatGlyph(g: Graphics, kind: "atk" | "aspd" | "range" | "type", color = 0x9fb2c7): void {
  switch (kind) {
    case "atk": // 검
      g.poly([-1, 6, 1, 6, 1, -3, 4, -6, 2.5, -7.5, 0, -5, -2.5, -7.5, -4, -6, -1, -3]).fill(color);
      g.rect(-3.5, 3, 7, 1.6).fill(color);
      break;
    case "aspd": // 이중 셰브론
      g.poly([-6, -5, -1, 0, -6, 5, -4, 5, 1, 0, -4, -5]).fill(color);
      g.poly([0, -5, 5, 0, 0, 5, 2, 5, 7, 0, 2, -5]).fill(color);
      break;
    case "range": // 조준 링
      g.circle(0, 0, 5.5).stroke({ color, width: 1.6 });
      g.circle(0, 0, 1.6).fill(color);
      g.rect(-8, -0.8, 3, 1.6).fill(color);
      g.rect(5, -0.8, 3, 1.6).fill(color);
      break;
    case "type": // 마름모 룬
      g.poly([0, -6, 5, 0, 0, 6, -5, 0]).stroke({ color, width: 1.6 });
      g.poly([0, -2.5, 2.2, 0, 0, 2.5, -2.2, 0]).fill(color);
      break;
  }
}

// ===== 라벨 도우미 =====

export function label(text: string, size: number, fill: number): Text {
  return new Text({ text, style: font(size, { fill }) });
}

export function labelBold(text: string, size: number, fill: number): Text {
  return new Text({ text, style: fontBold(size, fill) });
}
