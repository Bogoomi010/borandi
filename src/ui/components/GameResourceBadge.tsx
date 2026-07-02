import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { drawConsoleFrame, drawResourceIcon } from "../skin/consoleDraw";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

export type GameResourceKind = "map" | "round" | "enemy" | "gold" | "difficulty" | "boss";

interface GameResourceBadgeProps {
  height: number;
  kind: GameResourceKind;
  label: string;
  subValue?: string;
  tone?: GameUiTone;
  value: string;
  width: number;
  x?: number;
  y?: number;
}

export function GameResourceBadge({
  height,
  kind,
  label,
  subValue,
  tone = "normal",
  value,
  width,
  x = 0,
  y = 0,
}: GameResourceBadgeProps) {
  const accent = toneColor(tone);
  const iconSpace = Math.min(width * 0.34, height * 1.42);
  const textX = Math.max(42, iconSpace - 2);
  const textWidth = Math.max(40, width - textX - 12);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    drawConsoleFrame(g, "topbar.badge." + kind, width, height);
    if (tone === "danger" || tone === "warning" || tone === "reward") {
      g.roundRect(4, 4, width - 8, height - 8, 6).stroke({ color: accent, width: 1.6, alpha: 0.4 });
    }
  }, [accent, height, kind, tone, width]);

  const iconDraw = useMemo<GraphicsDraw>(() => (g) => {
    drawResourceIcon(g, kind, Math.min(24, height * 0.52));
  }, [height, kind]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiGraphics draw={iconDraw} x={Math.min(width * 0.32, height * 1.3) / 2} y={height / 2} />
      <pixiText
        eventMode="none"
        text={label}
        x={textX}
        y={Math.max(6, height * 0.19)}
        style={{
          fill: GAME_UI_COLORS.textDim,
          fontFamily: GAME_UI_FONT,
          fontSize: Math.max(8, Math.floor(height * 0.18)),
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
        }}
      />
      <pixiText
        eventMode="none"
        text={value}
        x={textX}
        y={Math.max(18, height * 0.42)}
        style={{
          fill: accent,
          fontFamily: GAME_UI_FONT,
          fontSize: Math.max(11, Math.floor(height * 0.26)),
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 3 },
          wordWrap: true,
          wordWrapWidth: textWidth,
        }}
      />
      {subValue ? (
        <pixiText
          anchor={{ x: 1, y: 0 }}
          eventMode="none"
          text={subValue}
          x={width - 12}
          y={Math.max(18, height * 0.44)}
          style={{
            fill: GAME_UI_COLORS.textDim,
            fontFamily: GAME_UI_FONT,
            fontSize: Math.max(8, Math.floor(height * 0.18)),
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          }}
        />
      ) : null}
    </pixiContainer>
  );
}
