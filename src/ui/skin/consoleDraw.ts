import type { Graphics } from "pixi.js";
import { GAME_UI_COLORS } from "./GameUiTokens";
import type { UiTextureKey } from "./UiTextureKeys";

/**
 * 콘솔 게임풍 벡터 프레임/아이콘 라이브러리.
 * 이미지 에셋을 전혀 쓰지 않고 모든 UI 크롬을 코드로 그린다.
 * 테마: 메뉴 화면과 동일 — 짙은 어둠 + 슬레이트 보더 + 금빛 액센트.
 */

const GOLD = 0xe7b53e;
const GOLD_LIGHT = 0xf6d365;
const BORDER = GAME_UI_COLORS.steelDark; // 0x384452
const CARD = 0x151b24;
const CARD_HOVER = 0x1f3658;

/** 모서리를 깎은 콘솔 프레임 경로 */
export function chamferPath(g: Graphics, x: number, y: number, w: number, h: number, c: number): Graphics {
  g.poly([
    x + c, y, x + w - c, y, x + w, y + c,
    x + w, y + h - c, x + w - c, y + h,
    x + c, y + h, x, y + h - c, x, y + c,
  ]);
  return g;
}

/** 금색 코너 브래킷 */
export function drawBrackets(
  g: Graphics, w: number, h: number,
  o = 5, len = 12, color = GOLD, alpha = 0.6,
): void {
  const s = { color, width: 2, alpha };
  g.moveTo(o, o + len).lineTo(o, o + 4).lineTo(o + 4, o).lineTo(o + len, o).stroke(s);
  g.moveTo(w - o - len, o).lineTo(w - o - 4, o).lineTo(w - o, o + 4).lineTo(w - o, o + len).stroke(s);
  g.moveTo(w - o, h - o - len).lineTo(w - o, h - o - 4).lineTo(w - o - 4, h - o).lineTo(w - o - len, h - o).stroke(s);
  g.moveTo(o + len, h - o).lineTo(o + 4, h - o).lineTo(o, h - o - 4).lineTo(o, h - o - len).stroke(s);
}

/** 얇고 강한 금속 HUD 스트립 (상단바/액션바) */
function drawMetalStrip(g: Graphics, w: number, h: number, alpha: number): void {
  g.rect(0, 0, w, h).fill({ color: 0x0b0e14, alpha: 0.94 * alpha });
  // 상단 이중 라인
  g.rect(0, 0, w, 1.5).fill({ color: 0x4a5870, alpha: 0.9 * alpha });
  g.rect(0, 1.5, w, 1).fill({ color: 0x1a212e, alpha });
  // 하단 금선 + 마감
  g.rect(0, h - 3, w, 1).fill({ color: GOLD, alpha: 0.4 * alpha });
  g.rect(0, h - 2, w, 2).fill({ color: 0x05070b, alpha });
  // 끝단 캡
  for (const x of [0, w - 7]) {
    g.rect(x, 2, 7, h - 4).fill({ color: 0x1a2130, alpha: 0.9 * alpha });
    g.rect(x === 0 ? 6 : x, 2, 1, h - 4).fill({ color: GOLD, alpha: 0.3 * alpha });
  }
  // 중앙 하단 다이아 장식
  g.poly([w / 2, h - 7, w / 2 + 5, h - 2.5, w / 2, h + 2, w / 2 - 5, h - 2.5])
    .fill({ color: GOLD, alpha: 0.55 * alpha });
}

/** 패널 (미션 로그/정보 창) */
function drawPanelFrame(g: Graphics, w: number, h: number, alpha: number, heavy: boolean): void {
  const c = Math.min(14, Math.min(w, h) / 6);
  chamferPath(g, 0, 0, w, h, c).fill({ color: 0x10151d, alpha: 0.92 * alpha });
  g.poly([c, 1, w - c, 1, w - c - 8, 4.5, c + 8, 4.5]).fill({ color: 0xffffff, alpha: 0.04 * alpha });
  chamferPath(g, 0, 0, w, h, c).stroke({ color: BORDER, width: heavy ? 2 : 1.5, alpha: 0.9 * alpha });
  if (heavy) {
    chamferPath(g, 4, 4, w - 8, h - 8, Math.max(4, c - 4))
      .stroke({ color: GOLD, width: 1, alpha: 0.22 * alpha });
  }
  drawBrackets(g, w, h, 5, heavy ? 15 : 12, GOLD, heavy ? 0.75 : 0.55);
}

/** 버튼 카드 */
function drawButtonFrame(
  g: Graphics, w: number, h: number, alpha: number,
  state: "normal" | "hover" | "pressed" | "disabled" | "primary" | "secondary" | "cta",
): void {
  const cut = Math.min(9, h / 4);
  const fill = state === "hover" ? CARD_HOVER
    : state === "pressed" ? 0x101623
    : state === "disabled" ? 0x11141b
    : state === "primary" ? 0x14263a
    : state === "secondary" ? 0x241d10
    : state === "cta" ? 0x2a2110
    : CARD;
  const border = state === "hover" ? 0x6fb8ff
    : state === "disabled" ? 0x2a3240
    : state === "primary" ? 0x4a90d0
    : state === "secondary" || state === "cta" ? GOLD
    : BORDER;
  if (state === "cta") {
    chamferPath(g, -2.5, -2.5, w + 5, h + 5, cut + 2).stroke({ color: GOLD, width: 4, alpha: 0.16 * alpha });
  }
  chamferPath(g, 0, 0, w, h, cut)
    .fill({ color: fill, alpha: (state === "disabled" ? 0.6 : 0.94) * alpha });
  g.poly([cut, 1, w - cut, 1, w - cut - 6, 4.5, cut + 6, 4.5])
    .fill({ color: 0xffffff, alpha: (state === "disabled" ? 0.02 : 0.05) * alpha });
  chamferPath(g, 0, 0, w, h, cut)
    .stroke({ color: border, width: state === "cta" ? 1.8 : 1.2, alpha: 0.9 * alpha });
  // 좌측 액센트 노치
  const accent = state === "disabled" ? 0x3a4452 : state === "primary" ? 0x66c7ff : GOLD;
  g.poly([0, cut, 3.5, cut + 2, 3.5, h - cut - 2, 0, h - cut])
    .fill({ color: accent, alpha: (state === "disabled" ? 0.25 : 0.9) * alpha });
}

/** 핫바 룬 슬롯 */
function drawSlotFrame(
  g: Graphics, w: number, h: number, alpha: number,
  state: "normal" | "selected" | "locked" | "relic",
): void {
  const cut = Math.min(11, Math.min(w, h) / 5);
  const border = state === "selected" ? GOLD_LIGHT
    : state === "relic" ? 0xa167ff
    : state === "locked" ? 0x2c3442
    : BORDER;
  if (state === "selected") {
    chamferPath(g, -2.5, -2.5, w + 5, h + 5, cut + 2).stroke({ color: GOLD_LIGHT, width: 4, alpha: 0.18 * alpha });
  }
  chamferPath(g, 0, 0, w, h, cut)
    .fill({ color: state === "locked" ? 0x0e1218 : 0x121722, alpha: 0.94 * alpha });
  // 내부 다이아 인레이
  g.poly([w / 2, 4, w - 4, h / 2, w / 2, h - 4, 4, h / 2])
    .stroke({ color: border, width: 1, alpha: 0.18 * alpha });
  chamferPath(g, 0, 0, w, h, cut)
    .stroke({ color: border, width: state === "selected" ? 2 : 1.3, alpha: 0.92 * alpha });
  chamferPath(g, 3.5, 3.5, w - 7, h - 7, Math.max(3, cut - 3))
    .stroke({ color: border, width: 1, alpha: 0.25 * alpha });
}

/** 재화/상태 명판 (상단 HUD) */
function drawBadgeFrame(g: Graphics, w: number, h: number, alpha: number): void {
  const cut = Math.min(9, h / 4);
  chamferPath(g, 0, 0, w, h, cut).fill({ color: 0x10151d, alpha: 0.88 * alpha });
  chamferPath(g, 0, 0, w, h, cut).stroke({ color: BORDER, width: 1.2, alpha: 0.9 * alpha });
  // 좌측 아이콘 존 분리선 + 금 노치
  const iconW = Math.min(w * 0.32, h * 1.3);
  g.rect(iconW, 5, 1, h - 10).fill({ color: BORDER, alpha: 0.6 * alpha });
  g.poly([0, cut, 3, cut + 2, 3, h - cut - 2, 0, h - cut]).fill({ color: GOLD, alpha: 0.8 * alpha });
}

/** 미션 계약서 카드 */
function drawQuestFrame(g: Graphics, w: number, h: number, alpha: number, done: boolean): void {
  const c = 10;
  const edge = done ? GOLD : BORDER;
  chamferPath(g, 0, 0, w, h, c).fill({ color: done ? 0x171512 : 0x11151d, alpha: 0.94 * alpha });
  // 상단 헤더 밴드
  g.poly([c, 1, w - c, 1, w - c - 6, 30, c + 6, 30]).fill({ color: 0xffffff, alpha: 0.03 * alpha });
  g.rect(8, 32, w - 16, 1).fill({ color: GOLD, alpha: 0.35 * alpha });
  g.poly([w / 2, 29.5, w / 2 + 4, 32.5, w / 2, 35.5, w / 2 - 4, 32.5]).fill({ color: GOLD, alpha: 0.6 * alpha });
  chamferPath(g, 0, 0, w, h, c).stroke({ color: edge, width: done ? 1.6 : 1.3, alpha: (done ? 0.75 : 0.9) * alpha });
  // 좌측 등뼈(spine)
  g.poly([0, c, 3, c + 2, 3, h - c - 2, 0, h - c]).fill({ color: done ? GOLD : 0x55617a, alpha: 0.8 * alpha });
}

/** 배너 (토스트) */
function drawBannerFrame(g: Graphics, w: number, h: number, alpha: number): void {
  const wing = Math.min(16, h / 2.4);
  g.poly([
    2, h / 2, 2 + wing, 2, w - wing - 2, 2, w - 2, h / 2, w - wing - 2, h - 2, 2 + wing, h - 2,
  ]).fill({ color: 0x11161f, alpha: 0.94 * alpha })
    .stroke({ color: GOLD, width: 1.2, alpha: 0.5 * alpha });
}

/** 텍스처 키 → 벡터 프레임. GameNineSlice 대체의 핵심 스위치 */
export function drawConsoleFrame(g: Graphics, key: UiTextureKey | string, w: number, h: number, alpha = 1): void {
  g.clear();
  if (w < 2 || h < 2) return;
  if (key === "frame.topbar" || key === "frame.actionbar") return drawMetalStrip(g, w, h, alpha);
  if (key === "popup.banner") return drawBannerFrame(g, w, h, alpha);
  if (key.startsWith("popup") || key === "frame.panel" || key === "frame.battlefield") {
    return drawPanelFrame(g, w, h, alpha, true);
  }
  if (key.startsWith("frame.panel") || key === "frame.badge") return drawPanelFrame(g, w, h, alpha, false);
  if (key.startsWith("mission.card")) return drawQuestFrame(g, w, h, alpha, key === "mission.card.done");
  if (key.startsWith("topbar.badge")) return drawBadgeFrame(g, w, h, alpha);
  if (key === "topbar.speed.group") {
    const cut = Math.min(8, h / 4);
    chamferPath(g, 0, 0, w, h, cut).fill({ color: 0x0e1218, alpha: 0.8 * alpha })
      .stroke({ color: BORDER, width: 1, alpha: 0.7 * alpha });
    return;
  }
  if (key.startsWith("slot.")) {
    const state = key === "slot.skill.selected" ? "selected"
      : key === "slot.locked" ? "locked"
      : key === "slot.relic" ? "relic" : "normal";
    return drawSlotFrame(g, w, h, alpha, state);
  }
  if (key.startsWith("button.roundStart")) return drawButtonFrame(g, w, h, alpha, "cta");
  if (key === "button.primary") return drawButtonFrame(g, w, h, alpha, "primary");
  if (key === "button.secondary") return drawButtonFrame(g, w, h, alpha, "secondary");
  if (key === "button.generic.hover") return drawButtonFrame(g, w, h, alpha, "hover");
  if (key === "button.generic.pressed") return drawButtonFrame(g, w, h, alpha, "pressed");
  if (key === "button.generic.disabled") return drawButtonFrame(g, w, h, alpha, "disabled");
  if (key.startsWith("button.rightTab")) {
    const active = key.endsWith("selected");
    const cut = Math.min(8, h / 4);
    chamferPath(g, 0, 0, w, h, cut)
      .fill({ color: active ? 0x1c2536 : 0x11161f, alpha: 0.92 * alpha })
      .stroke({ color: active ? GOLD : BORDER, width: active ? 1.6 : 1, alpha: 0.85 * alpha });
    if (active) g.rect(cut, h - 3, w - cut * 2, 2).fill({ color: GOLD, alpha: 0.85 * alpha });
    return;
  }
  if (key.startsWith("button.")) return drawButtonFrame(g, w, h, alpha, "normal");
  // 폴백: 일반 콘솔 프레임
  drawPanelFrame(g, w, h, alpha, false);
}

/** 키캡 */
export function drawKeycapShape(g: Graphics, w: number, h: number, alpha = 1): void {
  g.clear();
  g.roundRect(0, 2, w, h - 2, 3).fill({ color: 0x0a0e15, alpha });
  g.roundRect(0, 0, w, h - 3, 3).fill({ color: 0x27303f, alpha })
    .stroke({ color: 0x4a5a74, width: 1, alpha: 0.9 * alpha });
}

/** 재화/상태 아이콘 (상단 HUD) */
export function drawResourceIcon(
  g: Graphics, kind: "map" | "round" | "enemy" | "gold" | "difficulty" | "boss", size: number,
): void {
  const s = size / 2;
  g.clear();
  switch (kind) {
    case "map": // 나침반 다이아
      g.poly([0, -s, s * 0.8, 0, 0, s, -s * 0.8, 0]).stroke({ color: 0x9fb2c7, width: 1.6 });
      g.poly([0, -s * 0.45, s * 0.35, 0, 0, s * 0.45, -s * 0.35, 0]).fill(GOLD);
      break;
    case "round": // 모래시계
      g.poly([-s * 0.6, -s, s * 0.6, -s, 0, 0, s * 0.6, s, -s * 0.6, s, 0, 0])
        .fill({ color: 0x66c7ff, alpha: 0.85 });
      g.rect(-s * 0.7, -s - 1.5, s * 1.4, 1.8).fill(0x9fb2c7);
      g.rect(-s * 0.7, s, s * 1.4, 1.8).fill(0x9fb2c7);
      break;
    case "enemy": // 해골
      g.circle(0, -s * 0.15, s * 0.62).fill(0xd8dde6);
      g.roundRect(-s * 0.4, s * 0.18, s * 0.8, s * 0.42, 1.5).fill(0xd8dde6);
      g.circle(-s * 0.24, -s * 0.2, s * 0.17).fill(0x14161c);
      g.circle(s * 0.24, -s * 0.2, s * 0.17).fill(0x14161c);
      break;
    case "gold": // 코인
      g.circle(0, 0, s * 0.75).fill(GOLD).stroke({ color: 0x8a6a1e, width: 1.5 });
      g.circle(0, 0, s * 0.42).stroke({ color: 0xffe9a8, width: 1.2 });
      break;
    case "difficulty": // 방패
      g.moveTo(0, -s).lineTo(s * 0.75, -s * 0.5).lineTo(s * 0.75, s * 0.2)
        .quadraticCurveTo(s * 0.75, s * 0.75, 0, s)
        .quadraticCurveTo(-s * 0.75, s * 0.75, -s * 0.75, s * 0.2)
        .lineTo(-s * 0.75, -s * 0.5).closePath()
        .fill({ color: 0x66c7ff, alpha: 0.8 }).stroke({ color: 0x9fb2c7, width: 1.2 });
      break;
    case "boss": // 뿔 달린 해골
      g.poly([-s * 0.55, -s * 0.35, -s, -s, -s * 0.3, -s * 0.6]).fill(GOLD);
      g.poly([s * 0.55, -s * 0.35, s, -s, s * 0.3, -s * 0.6]).fill(GOLD);
      g.circle(0, -s * 0.05, s * 0.58).fill(0xd8dde6);
      g.roundRect(-s * 0.38, s * 0.28, s * 0.76, s * 0.4, 1.5).fill(0xd8dde6);
      g.circle(-s * 0.22, -s * 0.1, s * 0.16).fill(0x8a2430);
      g.circle(s * 0.22, -s * 0.1, s * 0.16).fill(0x8a2430);
      break;
  }
}

/** 범용 아이콘 글리프 (icon.* / topbar.icon.*) */
export function drawIconGlyph(g: Graphics, key: string, size: number): void {
  const s = size / 2;
  g.clear();
  const k = key.replace("topbar.icon.", "").replace("icon.", "");
  switch (k) {
    case "map": case "round": case "enemy": case "gold": case "difficulty": case "boss":
      return drawResourceIcon(g, k as never, size);
    case "summon":
      g.circle(0, 0, s * 0.55).stroke({ color: 0x66c7ff, width: 2 });
      g.circle(0, 0, s * 0.2).fill(0x66c7ff);
      g.moveTo(-s * 0.9, 0).lineTo(s * 0.9, 0).stroke({ color: 0x66c7ff, width: 1.2, alpha: 0.7 });
      g.moveTo(0, -s * 0.9).lineTo(0, s * 0.9).stroke({ color: 0x66c7ff, width: 1.2, alpha: 0.7 });
      break;
    case "merge":
      g.circle(-s * 0.4, 0, s * 0.32).fill({ color: 0x66c7ff, alpha: 0.9 });
      g.circle(s * 0.4, 0, s * 0.32).fill({ color: 0x67d98a, alpha: 0.9 });
      g.poly([-s * 0.05, -s * 0.14, s * 0.18, 0, -s * 0.05, s * 0.14]).fill(0xeef3fa);
      break;
    case "sell":
      g.circle(0, 0, s * 0.7).fill(GOLD).stroke({ color: 0x8a6a1e, width: 1.4 });
      g.moveTo(-s * 0.85, s * 0.85).lineTo(s * 0.85, -s * 0.85)
        .stroke({ color: 0xe5534b, width: 2.5 });
      break;
    case "upgrade":
      g.poly([0, -s * 0.9, s * 0.7, 0, s * 0.3, 0, s * 0.3, s * 0.9, -s * 0.3, s * 0.9, -s * 0.3, 0, -s * 0.7, 0])
        .fill(GOLD_LIGHT);
      break;
    case "relic":
      g.poly([0, -s * 0.85, s * 0.65, 0, 0, s * 0.85, -s * 0.65, 0])
        .fill({ color: 0xa167ff, alpha: 0.85 }).stroke({ color: GOLD, width: 1.4 });
      break;
    case "dps":
      for (let i = 0; i < 3; i++) {
        const bh = s * (0.5 + i * 0.4);
        g.roundRect(-s * 0.6 + i * s * 0.5, s * 0.8 - bh, s * 0.32, bh, 1)
          .fill(i === 2 ? GOLD : 0x66c7ff);
      }
      break;
    case "start":
      g.poly([-s * 0.5, -s * 0.75, s * 0.85, 0, -s * 0.5, s * 0.75]).fill(GOLD_LIGHT);
      break;
    case "speed":
      g.poly([-s * 0.9, -s * 0.6, -s * 0.2, 0, -s * 0.9, s * 0.6]).fill(0x9fb2c7);
      g.poly([-s * 0.1, -s * 0.6, s * 0.6, 0, -s * 0.1, s * 0.6]).fill(GOLD_LIGHT);
      break;
    case "warning":
      g.poly([0, -s * 0.85, s * 0.9, s * 0.75, -s * 0.9, s * 0.75]).fill({ color: 0xe8a33d, alpha: 0.9 });
      g.rect(-1.2, -s * 0.35, 2.4, s * 0.55).fill(0x14161c);
      g.circle(0, s * 0.45, 1.6).fill(0x14161c);
      break;
    default: // 폴백: 금 다이아
      g.poly([0, -s * 0.7, s * 0.55, 0, 0, s * 0.7, -s * 0.55, 0]).fill({ color: GOLD, alpha: 0.8 });
      break;
  }
}
