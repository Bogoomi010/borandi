import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import type { UiTextureKey } from "../skin/UiTextureKeys";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

export type GameResourceKind = "map" | "round" | "enemy" | "gold" | "difficulty" | "boss";

const RESOURCE_TEXTURE: Record<GameResourceKind, UiTextureKey> = {
  map: "topbar.badge.map",
  round: "topbar.badge.round",
  enemy: "topbar.badge.enemy",
  gold: "topbar.badge.gold",
  difficulty: "topbar.badge.difficulty",
  boss: "topbar.badge.boss",
};

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
    g.clear();
    if (tone === "danger" || tone === "warning" || tone === "reward") {
      g.roundRect(8, 7, width - 16, height - 14, 8).stroke({ color: accent, width: 2, alpha: 0.36 });
    }
  }, [accent, height, tone, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiSprite height={height} texture={uiTexture(RESOURCE_TEXTURE[kind])} width={width} />
      <pixiGraphics draw={draw} />
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
