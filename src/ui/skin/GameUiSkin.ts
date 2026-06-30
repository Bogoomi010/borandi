import type { UiTextureKey } from "./UiTextureKeys";
import { GAME_UI_COLORS, GAME_UI_FONT, GAME_UI_NINESLICE } from "./GameUiTokens";

export const gameUiSkin = {
  fontFamily: GAME_UI_FONT,
  colors: GAME_UI_COLORS,
  nineSlice: GAME_UI_NINESLICE,
  panels: {
    main: "frame.panel",
    small: "frame.panelSmall",
    modal: "popup.confirm",
    hotbar: "frame.actionbar",
    topbar: "frame.topbar",
  } satisfies Record<string, UiTextureKey>,
  buttons: {
    normal: "button.generic.normal",
    hover: "button.generic.hover",
    pressed: "button.generic.pressed",
    disabled: "button.generic.disabled",
    primary: "button.primary",
    secondary: "button.secondary",
    roundStart: "button.roundStart.normal",
    roundStartHover: "button.roundStart.hover",
    tab: "button.rightTab.normal",
    tabActive: "button.rightTab.selected",
  } satisfies Record<string, UiTextureKey>,
  slots: {
    normal: "slot.skill",
    selected: "slot.skill.selected",
    locked: "slot.locked",
    relic: "slot.relic",
  } satisfies Record<string, UiTextureKey>,
} as const;
