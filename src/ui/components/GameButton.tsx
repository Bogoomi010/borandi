import { useMemo, useState } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { gameUiSkin } from "../skin/GameUiSkin";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameNineSlice } from "../skin/createNineSliceSprite";
import type { UiTextureKey } from "../skin/UiTextureKeys";
import { GameIcon } from "./GameIcon";
import { GameKeycap } from "./GameKeycap";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

export interface GameButtonProps {
  disabled?: boolean;
  height: number;
  icon?: UiTextureKey;
  keycap?: string;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  subLabel?: string;
  textureKey?: UiTextureKey;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

function buttonTexture({
  disabled,
  hovered,
  pressed,
  selected,
  textureKey,
  tone,
}: {
  disabled?: boolean;
  hovered: boolean;
  pressed: boolean;
  selected?: boolean;
  textureKey?: UiTextureKey;
  tone: GameUiTone;
}) {
  if (textureKey) return textureKey;
  if (disabled) return gameUiSkin.buttons.disabled;
  if (pressed) return gameUiSkin.buttons.pressed;
  if (tone === "primary") return gameUiSkin.buttons.primary;
  if (tone === "reward" || selected) return gameUiSkin.buttons.secondary;
  if (hovered) return gameUiSkin.buttons.hover;
  return gameUiSkin.buttons.normal;
}

export function GameButton({
  disabled = false,
  height,
  icon,
  keycap,
  label,
  onPress,
  selected = false,
  subLabel,
  textureKey,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const activeTone: GameUiTone = disabled ? "disabled" : selected ? "selected" : tone;
  const accent = toneColor(activeTone);
  const background = buttonTexture({ disabled, hovered, pressed, selected, textureKey, tone });
  const iconSize = Math.min(30, height - 14);
  const textX = icon ? iconSize + 18 : 14;
  const textW = Math.max(40, width - textX - (keycap ? 42 : 12));

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, width, height).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.001 });
    if (!disabled && (hovered || selected)) {
      g.roundRect(5, 5, width - 10, height - 10, 8).stroke({ color: accent, width: 2, alpha: hovered ? 0.54 : 0.36 });
    }
    if (pressed && !disabled) {
      g.rect(9, height - 11, width - 18, 2).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.52 });
    }
  }, [accent, disabled, height, hovered, pressed, selected, width]);

  return (
    <pixiContainer
      cursor={disabled ? "default" : "pointer"}
      eventMode={disabled ? "none" : "static"}
      onPointerDown={() => setPressed(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerTap={() => {
        if (!disabled) onPress?.();
      }}
      onPointerUp={() => setPressed(false)}
      x={x}
      y={y + (pressed && !disabled ? 1 : 0)}
    >
      <GameNineSlice borders={gameUiSkin.nineSlice.button} height={height} textureKey={background} width={width} alpha={disabled ? 0.72 : 1} />
      <pixiGraphics draw={draw} />
      {icon ? <GameIcon alpha={disabled ? 0.45 : 1} height={iconSize} textureKey={icon} width={iconSize} x={10} y={(height - iconSize) / 2} /> : null}
      <pixiText
        eventMode="none"
        text={label}
        x={textX}
        y={subLabel ? Math.max(7, height * 0.2) : height / 2 - 8}
        style={{
          fill: disabled ? GAME_UI_COLORS.textFaint : GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: Math.max(11, Math.min(14, height * 0.34)),
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          wordWrap: true,
          wordWrapWidth: textW,
        }}
      />
      {subLabel ? (
        <pixiText
          eventMode="none"
          text={subLabel}
          x={textX}
          y={Math.max(24, height * 0.56)}
          style={{
            fill: disabled ? GAME_UI_COLORS.textFaint : tone === "primary" ? 0xd9ecff : GAME_UI_COLORS.textDim,
            fontFamily: GAME_UI_FONT,
            fontSize: Math.max(9, Math.min(11, height * 0.25)),
            wordWrap: true,
            wordWrapWidth: textW,
          }}
        />
      ) : null}
      {keycap ? <GameKeycap alpha={disabled ? 0.5 : 1} label={keycap} width={34} height={19} x={width - 42} y={7} /> : null}
    </pixiContainer>
  );
}
