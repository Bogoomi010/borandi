import { TextStyle, type TextStyleOptions } from "pixi.js";
import type { Family, Grade } from "../core/types";

/** 디자인 해상도 */
export const VW = 1280;
export const VH = 720;

export const COLORS = {
  // '차원 균열' 테마: 짙은 어둠 + 슬레이트 보더 + 금빛 액센트 (메뉴 화면과 동일)
  panel: 0x151b24,
  panelDark: 0x10151d,
  panelLight: 0x1f2836,
  frame: 0x384452,
  frameLight: 0x6fb8ff,
  parchment: 0x8a6a3b,
  parchmentDark: 0x6b5230,

  textMain: 0xeef3fa,
  textSub: 0x9fb2c7,
  textDim: 0x687589,
  textGold: 0xf6d365,
  textDanger: 0xff7a6b,
  textGood: 0x9fe085,

  gold: 0xe7b53e,
  hp: 0xe25555,
  hpDark: 0x5a1f1f,
  shield: 0x5aa7e8,

  buttonNormal: 0x3a4152,
  buttonHover: 0x4a5368,
  buttonPress: 0x2c3240,
  buttonDisabled: 0x2a2e38,
  buttonPrimary: 0x7a5c2e,
  buttonPrimaryHover: 0x94713a,
  buttonDanger: 0x74333a,
  buttonDangerHover: 0x8f4049,
  buttonGood: 0x3d6b3a,
  buttonGoodHover: 0x4c8548,

  overlay: 0x000000,
} as const;

export const GRADE_COLORS: Record<Grade, number> = {
  common: 0x9aa4b0,
  rare: 0x55a4f2,
  hero: 0xb473f0,
  legend: 0xf2a33c,
  hidden: 0xef5564,
};

export const GRADE_STARS: Record<Grade, number> = {
  common: 1, rare: 2, hero: 3, legend: 4, hidden: 5,
};

export const FAMILY_COLORS: Record<Family, number> = {
  flame: 0xff7043,
  frost: 0x64c7f5,
  storm: 0xffd54f,
  iron: 0xaab4c0,
  void: 0xae77f0,
  forest: 0x81c784,
};

export const FAMILY_LABEL: Record<Family, string> = {
  flame: "화염", frost: "서리", storm: "폭풍", iron: "강철", void: "공허", forest: "숲",
};

export const ROLE_LABEL: Record<string, string> = {
  waveClear: "광역", hold: "홀딩", bossKiller: "보스딜", debuff: "약화", economy: "경제", finisher: "마무리",
};

const BASE_FONT = '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

export function font(size: number, opts: Partial<TextStyleOptions> = {}): TextStyle {
  return new TextStyle({
    fontFamily: BASE_FONT,
    fontSize: size,
    fill: COLORS.textMain,
    ...opts,
  });
}

export function fontBold(size: number, fill: number = COLORS.textMain, opts: Partial<TextStyleOptions> = {}): TextStyle {
  return new TextStyle({
    fontFamily: BASE_FONT,
    fontSize: size,
    fontWeight: "700",
    fill,
    ...opts,
  });
}

/** 외곽선 있는 전장 텍스트 (데미지 숫자 등) */
export function fontOutlined(size: number, fill: number, stroke = 0x14161c): TextStyle {
  return new TextStyle({
    fontFamily: BASE_FONT,
    fontSize: size,
    fontWeight: "800",
    fill,
    stroke: { color: stroke, width: Math.max(2, size / 7) },
  });
}
