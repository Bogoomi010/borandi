import { useMemo, useState } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { GAME_UI_COLORS, GAME_UI_FONT } from "../skin/GameUiTokens";
import type { UiTextureKey } from "../skin/UiTextureKeys";
import { GameIcon } from "./GameIcon";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameTabButtonProps {
  active: boolean;
  badge?: boolean;
  height: number;
  icon?: UiTextureKey;
  label: string;
  onPress: () => void;
  width: number;
  x?: number;
  y?: number;
}

export function GameTabButton({
  active,
  badge = false,
  height,
  icon,
  label,
  onPress,
  width,
  x = 0,
  y = 0,
}: GameTabButtonProps) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, width, height).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.001 });
    if (active || hovered) {
      g.roundRect(8, 7, width - 16, height - 13, 7).stroke({
        color: active ? GAME_UI_COLORS.gold : GAME_UI_COLORS.arcane,
        width: active ? 2 : 1,
        alpha: active ? 0.44 : 0.34,
      });
    }
    if (badge) {
      g.circle(width - 15, 12, 4).fill({ color: GAME_UI_COLORS.danger, alpha: 0.96 });
      g.circle(width - 15, 12, 7).stroke({ color: GAME_UI_COLORS.danger, width: 1, alpha: 0.42 });
    }
  }, [active, badge, height, hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPress}
      x={x}
      y={y}
    >
      <pixiSprite
        height={height}
        texture={uiTexture(active ? "button.rightTab.selected" : "button.rightTab.normal")}
        width={width}
      />
      <pixiGraphics draw={draw} />
      {icon ? <GameIcon height={18} textureKey={icon} width={18} x={12} y={(height - 18) / 2} /> : null}
      <pixiText
        anchor={0.5}
        eventMode="none"
        text={label}
        x={icon ? width / 2 + 8 : width / 2}
        y={height / 2}
        style={{
          fill: active ? 0xfff0bf : GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: Math.max(11, Math.min(13, height * 0.34)),
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
        }}
      />
    </pixiContainer>
  );
}
