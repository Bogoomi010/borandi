import { type ReactNode, useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameNineSlice } from "../skin/createNineSliceSprite";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameModalFrameProps {
  children?: ReactNode;
  height: number;
  subtitle?: string;
  title?: string;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

export function GameModalFrame({
  children,
  height,
  subtitle,
  title,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameModalFrameProps) {
  const accent = toneColor(tone);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(28, 28, width - 56, height - 56, 10).fill({ color: GAME_UI_COLORS.ink, alpha: 0.74 });
    g.rect(38, 64, width - 76, 1).fill({ color: accent, alpha: 0.32 });
  }, [accent, height, width]);

  return (
    <pixiContainer x={x} y={y}>
      <GameNineSlice
        borders={{ left: 96, top: 88, right: 96, bottom: 88 }}
        height={height}
        textureKey="popup.confirm"
        width={width}
      />
      <pixiGraphics draw={draw} />
      {title ? (
        <pixiText
          eventMode="none"
          text={title}
          x={32}
          y={24}
          style={{
            fill: GAME_UI_COLORS.text,
            fontFamily: GAME_UI_FONT,
            fontSize: 18,
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 3 },
            wordWrap: true,
            wordWrapWidth: width - 64,
          }}
        />
      ) : null}
      {subtitle ? (
        <pixiText
          eventMode="none"
          text={subtitle}
          x={32}
          y={50}
          style={{
            fill: GAME_UI_COLORS.textDim,
            fontFamily: GAME_UI_FONT,
            fontSize: 12,
            wordWrap: true,
            wordWrapWidth: width - 64,
          }}
        />
      ) : null}
      {children}
    </pixiContainer>
  );
}
