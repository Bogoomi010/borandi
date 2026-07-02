import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { drawConsoleFrame } from "./consoleDraw";
import type { UiTextureKey } from "./UiTextureKeys";

extend({ Container, Graphics });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

export interface GameNineSliceBorders {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface GameNineSliceProps {
  alpha?: number;
  /** 과거 나인슬라이스 보더 값 — 벡터 프레임에서는 사용하지 않지만 호환을 위해 유지 */
  borders: GameNineSliceBorders;
  height: number;
  textureKey: UiTextureKey;
  width: number;
  x?: number;
  y?: number;
}

/**
 * 과거 이미지 나인슬라이스 프레임의 벡터 대체.
 * textureKey를 스타일 셀렉터로 해석해 콘솔풍 프레임을 코드로 그린다.
 * 이미지 에셋을 전혀 로드하지 않는다.
 */
export function GameNineSlice({
  alpha = 1,
  borders: _borders,
  height,
  textureKey,
  width,
  x = 0,
  y = 0,
}: GameNineSliceProps) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    drawConsoleFrame(g, textureKey, width, height, alpha);
  }, [alpha, height, textureKey, width]);

  return <pixiGraphics draw={draw} x={x} y={y} />;
}
