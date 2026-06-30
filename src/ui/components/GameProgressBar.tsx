import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameProgressBarProps {
  height?: number;
  label?: string;
  ratio: number;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function GameProgressBar({
  height = 18,
  label,
  ratio,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameProgressBarProps) {
  const value = clamp01(ratio);
  const accent = toneColor(tone);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(7, 5, Math.max(1, width - 14), Math.max(1, height - 10), Math.max(3, (height - 10) / 2))
      .fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.78 });
    g.roundRect(9, 7, Math.max(1, (width - 18) * value), Math.max(1, height - 14), Math.max(2, (height - 14) / 2))
      .fill({ color: accent, alpha: 0.86 });
    g.roundRect(7, 5, Math.max(1, width - 14), Math.max(1, height - 10), Math.max(3, (height - 10) / 2))
      .stroke({ color: accent, width: 1, alpha: 0.52 });
  }, [accent, height, value, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiSprite alpha={0.74} height={height} texture={uiTexture("mission.progress")} width={width} />
      <pixiGraphics draw={draw} />
      {label ? (
        <pixiText
          anchor={0.5}
          eventMode="none"
          text={label}
          x={width / 2}
          y={height / 2}
          style={{
            fill: GAME_UI_COLORS.text,
            fontFamily: GAME_UI_FONT,
            fontSize: Math.max(9, Math.floor(height * 0.48)),
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          }}
        />
      ) : null}
    </pixiContainer>
  );
}
