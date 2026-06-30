import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { GAME_UI_COLORS } from "../skin/GameUiTokens";

extend({ Container, Graphics, Sprite });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameScrollBarProps {
  height: number;
  ratio: number;
  thumbRatio: number;
  x?: number;
  y?: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function GameScrollBar({ height, ratio, thumbRatio, x = 0, y = 0 }: GameScrollBarProps) {
  const thumbH = Math.max(26, height * clamp01(thumbRatio));
  const thumbY = (height - thumbH) * clamp01(ratio);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(3, 8, 8, height - 16, 4).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.72 });
    g.roundRect(2, 8 + thumbY, 10, thumbH, 5).fill({ color: GAME_UI_COLORS.goldDeep, alpha: 0.86 });
    g.roundRect(2, 8 + thumbY, 10, thumbH, 5).stroke({ color: GAME_UI_COLORS.gold, width: 1, alpha: 0.62 });
  }, [height, thumbH, thumbY]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiSprite alpha={0.26} height={height} texture={uiTexture("frame.divider")} width={14} />
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}
