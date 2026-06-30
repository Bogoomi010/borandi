import { type ReactNode, useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
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
    g.rect(22, 12, Math.max(1, width - 44), 1).fill({ color: GAME_UI_COLORS.steel, alpha: 0.18 });
  }, [accentColor, height, innerAlpha, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <GameNineSlice borders={borders} height={height} textureKey={frameKey} width={width} />
      {title ? (
        <>
          <pixiSprite
            alpha={0.95}
            height={22}
            texture={uiTexture("frame.divider")}
            width={Math.min(width - 44, 190)}
            x={22}
            y={10}
          />
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
