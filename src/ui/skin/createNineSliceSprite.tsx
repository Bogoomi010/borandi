import { useEffect, useRef } from "react";
import { Container, NineSliceSprite } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import type { UiTextureKey } from "./UiTextureKeys";

export interface GameNineSliceBorders {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface GameNineSliceProps {
  alpha?: number;
  borders: GameNineSliceBorders;
  height: number;
  textureKey: UiTextureKey;
  width: number;
  x?: number;
  y?: number;
}

function clampBorder(value: number, max: number) {
  return Math.max(1, Math.min(value, max));
}

export function GameNineSlice({
  alpha = 1,
  borders,
  height,
  textureKey,
  width,
  x = 0,
  y = 0,
}: GameNineSliceProps) {
  const containerRef = useRef<Container>(null);
  const spriteRef = useRef<NineSliceSprite | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const sprite = new NineSliceSprite({
      texture: uiTexture(textureKey),
      width,
      height,
      leftWidth: clampBorder(borders.left, width / 2),
      topHeight: clampBorder(borders.top, height / 2),
      rightWidth: clampBorder(borders.right, width / 2),
      bottomHeight: clampBorder(borders.bottom, height / 2),
      roundPixels: true,
    });
    sprite.alpha = alpha;
    container.addChild(sprite);
    spriteRef.current = sprite;

    return () => {
      container.removeChild(sprite);
      sprite.destroy();
      if (spriteRef.current === sprite) spriteRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    sprite.texture = uiTexture(textureKey);
    sprite.leftWidth = clampBorder(borders.left, width / 2);
    sprite.topHeight = clampBorder(borders.top, height / 2);
    sprite.rightWidth = clampBorder(borders.right, width / 2);
    sprite.bottomHeight = clampBorder(borders.bottom, height / 2);
    sprite.setSize(width, height);
    sprite.alpha = alpha;
  }, [alpha, borders.bottom, borders.left, borders.right, borders.top, height, textureKey, width]);

  return <pixiContainer ref={containerRef} x={x} y={y} />;
}
