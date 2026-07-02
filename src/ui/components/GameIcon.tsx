import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { drawIconGlyph } from "../skin/consoleDraw";
import type { UiTextureKey } from "../skin/UiTextureKeys";

extend({ Container, Graphics });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameIconProps {
  alpha?: number;
  height?: number;
  textureKey: UiTextureKey;
  width?: number;
  x?: number;
  y?: number;
}

/** 이미지 대신 코드로 그리는 아이콘 글리프 */
export function GameIcon({
  alpha = 1,
  height = 24,
  textureKey,
  width = height,
  x = 0,
  y = 0,
}: GameIconProps) {
  const size = Math.min(width, height);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    drawIconGlyph(g, textureKey, size);
  }, [size, textureKey]);
  return <pixiGraphics alpha={alpha} draw={draw} x={x + width / 2} y={y + height / 2} />;
}
