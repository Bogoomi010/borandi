import { extend } from "@pixi/react";
import { Container, Sprite } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import type { UiTextureKey } from "../skin/UiTextureKeys";

extend({ Container, Sprite });

interface GameIconProps {
  alpha?: number;
  height?: number;
  textureKey: UiTextureKey;
  width?: number;
  x?: number;
  y?: number;
}

export function GameIcon({
  alpha = 1,
  height = 24,
  textureKey,
  width = height,
  x = 0,
  y = 0,
}: GameIconProps) {
  return <pixiSprite alpha={alpha} height={height} texture={uiTexture(textureKey)} width={width} x={x} y={y} />;
}
