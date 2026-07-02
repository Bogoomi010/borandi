import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text, type TextStyleOptions } from "pixi.js";
import { drawKeycapShape } from "../skin/consoleDraw";
import { GAME_UI_COLORS, GAME_UI_FONT } from "../skin/GameUiTokens";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameKeycapProps {
  alpha?: number;
  height?: number;
  label: string;
  width?: number;
  x?: number;
  y?: number;
}

export function GameKeycap({
  alpha = 1,
  height = 20,
  label,
  width = 34,
  x = 0,
  y = 0,
}: GameKeycapProps) {
  const style: TextStyleOptions = {
    align: "center",
    fill: GAME_UI_COLORS.text,
    fontFamily: GAME_UI_FONT,
    fontSize: Math.max(9, Math.floor(height * 0.48)),
    fontWeight: "bold",
    stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
  };

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    drawKeycapShape(g, width, height);
  }, [height, width]);

  return (
    <pixiContainer alpha={alpha} x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText anchor={0.5} eventMode="none" text={label} x={width / 2} y={height / 2 - 1} style={style} />
    </pixiContainer>
  );
}
