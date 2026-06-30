export const GAME_UI_FONT = "Segoe UI, Malgun Gothic, sans-serif";

export const GAME_UI_COLORS = {
  obsidian: 0x090c11,
  ink: 0x0d1118,
  stone: 0x14181f,
  stone2: 0x1b2029,
  steel: 0x87909a,
  steelDark: 0x384452,
  brass: 0xbc842b,
  gold: 0xf6d365,
  goldDeep: 0xcf962a,
  arcane: 0x66c7ff,
  rift: 0xa167ff,
  danger: 0xe5534b,
  ember: 0xe8a33d,
  ok: 0x67d98a,
  text: 0xeef3fa,
  textDim: 0x9fb2c7,
  textFaint: 0x657180,
} as const;

export const GAME_UI_SPACING = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  panelPad: 14,
} as const;

export const GAME_UI_NINESLICE = {
  panel: { left: 44, top: 42, right: 44, bottom: 42 },
  panelSmall: { left: 36, top: 34, right: 36, bottom: 34 },
  button: { left: 36, top: 26, right: 36, bottom: 26 },
  badge: { left: 34, top: 30, right: 34, bottom: 30 },
  modal: { left: 88, top: 84, right: 88, bottom: 84 },
} as const;

export type GameUiTone = "normal" | "primary" | "danger" | "selected" | "disabled" | "reward" | "warning";

export function toneColor(tone: GameUiTone): number {
  if (tone === "primary") return GAME_UI_COLORS.arcane;
  if (tone === "danger") return GAME_UI_COLORS.danger;
  if (tone === "selected" || tone === "reward") return GAME_UI_COLORS.gold;
  if (tone === "warning") return GAME_UI_COLORS.ember;
  if (tone === "disabled") return GAME_UI_COLORS.textFaint;
  return GAME_UI_COLORS.steel;
}
