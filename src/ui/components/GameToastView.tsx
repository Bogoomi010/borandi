import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameNineSlice } from "../skin/createNineSliceSprite";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameToastViewProps {
  height: number;
  text: string;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

export function GameToastView({
  height,
  text,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameToastViewProps) {
  const accent = toneColor(tone);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(10, 8, width - 20, height - 16, 8).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.5 });
    g.circle(25, height / 2, 7).fill({ color: accent, alpha: 0.82 });
    g.circle(25, height / 2, 10).stroke({ color: accent, width: 1, alpha: 0.36 });
  }, [accent, height, width]);

  return (
    <pixiContainer x={x} y={y}>
      <GameNineSlice
        alpha={0.98}
        borders={{ left: 82, top: 42, right: 82, bottom: 42 }}
        height={height}
        textureKey="popup.banner"
        width={width}
      />
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={text}
        x={42}
        y={Math.max(10, height / 2 - 8)}
        style={{
          fill: GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: 12,
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          wordWrap: true,
          wordWrapWidth: Math.max(80, width - 58),
        }}
      />
    </pixiContainer>
  );
}
