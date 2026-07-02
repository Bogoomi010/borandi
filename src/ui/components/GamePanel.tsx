import { type ReactNode, useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { gameUiSkin } from "../skin/GameUiSkin";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameNineSlice } from "../skin/createNineSliceSprite";
import type { UiTextureKey } from "../skin/UiTextureKeys";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GamePanelProps {
  accent?: GameUiTone;
  children?: ReactNode;
  height: number;
  innerAlpha?: number;
  textureKey?: UiTextureKey;
  title?: string;
  variant?: "main" | "small" | "modal";
  width: number;
  x?: number;
  y?: number;
}

export function GamePanel({
  accent = "normal",
  children,
  height,
  innerAlpha = 0.88,
  textureKey,
  title,
  variant = "main",
  width,
  x = 0,
  y = 0,
}: GamePanelProps) {
  const frameKey = textureKey ?? (variant === "small" ? gameUiSkin.panels.small : gameUiSkin.panels.main);
  const borders = variant === "small" ? gameUiSkin.nineSlice.panelSmall : gameUiSkin.nineSlice.panel;
  const accentColor = toneColor(accent);

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(10, 10, Math.max(1, width - 20), Math.max(1, height - 20), 8)
      .fill({ color: GAME_UI_COLORS.ink, alpha: innerAlpha });
    g.roundRect(14, 14, Math.max(1, width - 28), Math.max(1, height - 28), 6)
      .stroke({ color: accentColor, width: 1, alpha: 0.16 });
    if (title) {
      // 타이틀 밑 금선 + 다이아 (구 divider 이미지 대체)
      const lw = Math.min(width - 44, 190);
      g.rect(22, 28, lw, 1).fill({ color: GAME_UI_COLORS.goldDeep, alpha: 0.55 });
      g.poly([22 + lw + 6, 28.5, 22 + lw + 11, 25.5, 22 + lw + 16, 28.5, 22 + lw + 11, 31.5])
        .fill({ color: GAME_UI_COLORS.gold, alpha: 0.7 });
    }
  }, [accentColor, height, innerAlpha, title, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <GameNineSlice borders={borders} height={height} textureKey={frameKey} width={width} />
      {title ? (
        <>
          <pixiText
            eventMode="none"
            text={title}
            x={32}
            y={13}
            style={{
              fill: accentColor,
              fontFamily: GAME_UI_FONT,
              fontSize: 11,
              fontWeight: "bold" as const,
              stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
            }}
          />
        </>
      ) : null}
      {children}
    </pixiContainer>
  );
}
