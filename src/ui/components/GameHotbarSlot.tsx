import { useMemo, useState } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { gameUiSkin } from "../skin/GameUiSkin";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameKeycap } from "./GameKeycap";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

export type GameHotbarGlyph = "summon" | "merge" | "sell" | "upgrade" | "relic" | "dps" | "start";

interface GameHotbarSlotProps {
  cost?: string;
  disabled?: boolean;
  glyph: GameHotbarGlyph;
  height: number;
  keycap: string;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

function slotTexture(disabled: boolean, selected: boolean, glyph: GameHotbarGlyph) {
  if (disabled) return gameUiSkin.slots.locked;
  if (selected || glyph === "start") return gameUiSkin.slots.selected;
  if (glyph === "relic") return gameUiSkin.slots.relic;
  return gameUiSkin.slots.normal;
}

function ActionGlyph({
  glyph,
  size,
  tone,
  x,
  y,
}: {
  glyph: GameHotbarGlyph;
  size: number;
  tone: GameUiTone;
  x: number;
  y: number;
}) {
  const accent = toneColor(tone);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const cx = size / 2;
    const cy = size / 2;
    g.clear();
    g.circle(cx, cy, size * 0.42).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.42 });
    g.circle(cx, cy, size * 0.4).stroke({ color: accent, width: 2, alpha: 0.72 });

    if (glyph === "summon") {
      g.circle(cx, cy, size * 0.24).stroke({ color: GAME_UI_COLORS.arcane, width: 3, alpha: 0.95 });
      g.circle(cx, cy, size * 0.1).fill({ color: GAME_UI_COLORS.arcane, alpha: 0.82 });
      g.moveTo(cx - size * 0.34, cy);
      g.lineTo(cx + size * 0.34, cy);
      g.moveTo(cx, cy - size * 0.34);
      g.lineTo(cx, cy + size * 0.34);
      g.stroke({ color: GAME_UI_COLORS.arcane, width: 1.5, alpha: 0.72 });
    } else if (glyph === "merge") {
      g.circle(cx - size * 0.16, cy, size * 0.14).fill({ color: GAME_UI_COLORS.arcane, alpha: 0.92 });
      g.circle(cx + size * 0.16, cy, size * 0.14).fill({ color: GAME_UI_COLORS.ok, alpha: 0.92 });
      g.moveTo(cx - size * 0.04, cy);
      g.lineTo(cx + size * 0.09, cy);
      g.lineTo(cx + size * 0.03, cy - size * 0.06);
      g.moveTo(cx + size * 0.09, cy);
      g.lineTo(cx + size * 0.03, cy + size * 0.06);
      g.stroke({ color: GAME_UI_COLORS.text, width: 2.5, alpha: 0.88 });
    } else if (glyph === "sell") {
      g.rect(cx - size * 0.2, cy - size * 0.16, size * 0.4, size * 0.34).stroke({ color: GAME_UI_COLORS.gold, width: 2, alpha: 0.82 });
      g.moveTo(cx - size * 0.26, cy + size * 0.24);
      g.lineTo(cx + size * 0.27, cy - size * 0.24);
      g.stroke({ color: GAME_UI_COLORS.danger, width: 4, alpha: 0.9 });
    } else if (glyph === "upgrade") {
      g.roundRect(cx - size * 0.05, cy - size * 0.28, size * 0.11, size * 0.46, 2).fill({ color: GAME_UI_COLORS.steel, alpha: 0.9 });
      g.poly([cx - size * 0.22, cy - size * 0.3, cx + size * 0.23, cy - size * 0.3, cx + size * 0.16, cy - size * 0.12, cx - size * 0.16, cy - size * 0.12])
        .fill({ color: GAME_UI_COLORS.gold, alpha: 0.92 });
      g.moveTo(cx - size * 0.23, cy + size * 0.26);
      g.lineTo(cx + size * 0.23, cy + size * 0.26);
      g.stroke({ color: GAME_UI_COLORS.arcane, width: 2, alpha: 0.8 });
    } else if (glyph === "relic") {
      g.poly([cx, cy - size * 0.3, cx + size * 0.25, cy, cx, cy + size * 0.3, cx - size * 0.25, cy])
        .fill({ color: GAME_UI_COLORS.rift, alpha: 0.78 });
      g.poly([cx, cy - size * 0.3, cx + size * 0.25, cy, cx, cy + size * 0.3, cx - size * 0.25, cy])
        .stroke({ color: GAME_UI_COLORS.gold, width: 2, alpha: 0.86 });
    } else if (glyph === "dps") {
      const bars = [0.32, 0.52, 0.76];
      bars.forEach((bar, index) => {
        const bx = cx - size * 0.2 + index * size * 0.16;
        g.roundRect(bx, cy + size * 0.26 - size * bar, size * 0.09, size * bar, 2)
          .fill({ color: index === 2 ? GAME_UI_COLORS.gold : GAME_UI_COLORS.arcane, alpha: 0.9 });
      });
    } else {
      g.circle(cx, cy, size * 0.24).stroke({ color: GAME_UI_COLORS.rift, width: 4, alpha: 0.9 });
      g.poly([cx + size * 0.1, cy - size * 0.22, cx + size * 0.34, cy, cx + size * 0.1, cy + size * 0.22])
        .fill({ color: GAME_UI_COLORS.gold, alpha: 0.92 });
    }
  }, [accent, glyph, size]);

  return <pixiGraphics draw={draw} x={x} y={y} />;
}

export function GameHotbarSlot({
  cost,
  disabled = false,
  glyph,
  height,
  keycap,
  label,
  onPress,
  selected = false,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameHotbarSlotProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const activeTone: GameUiTone = disabled ? "disabled" : selected ? "selected" : tone;
  const accent = toneColor(activeTone);
  const textureKey = slotTexture(disabled, selected, glyph);
  const iconSize = Math.min(width * 0.46, height * 0.42);
  const labelY = Math.max(42, height * 0.58);

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, width, height).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.001 });
    if (!disabled && (hovered || selected || tone === "primary")) {
      g.roundRect(7, 7, width - 14, height - 14, 10).stroke({ color: accent, width: hovered ? 3 : 2, alpha: hovered ? 0.62 : 0.42 });
    }
    if (disabled) {
      g.roundRect(10, 10, width - 20, height - 20, 8).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.28 });
      g.moveTo(width * 0.24, height * 0.32);
      g.lineTo(width * 0.76, height * 0.68);
      g.stroke({ color: GAME_UI_COLORS.steel, width: 3, alpha: 0.48 });
    }
  }, [accent, disabled, height, hovered, selected, tone, width]);

  return (
    <pixiContainer
      cursor={disabled ? "default" : "pointer"}
      eventMode={disabled ? "none" : "static"}
      onPointerDown={() => setPressed(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerTap={() => {
        if (!disabled) onPress?.();
      }}
      onPointerUp={() => setPressed(false)}
      x={x}
      y={y + (pressed && !disabled ? 2 : 0)}
    >
      <pixiSprite alpha={disabled ? 0.72 : 1} height={height} texture={uiTexture(textureKey)} width={width} />
      <pixiGraphics draw={draw} />
      <ActionGlyph glyph={glyph} size={iconSize} tone={activeTone} x={(width - iconSize) / 2} y={12} />
      <GameKeycap alpha={disabled ? 0.54 : 1} label={keycap} width={32} height={19} x={8} y={7} />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        eventMode="none"
        text={label}
        x={width / 2}
        y={labelY}
        style={{
          align: "center" as const,
          fill: disabled ? GAME_UI_COLORS.textFaint : GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: Math.max(10, Math.min(13, width * 0.12)),
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          wordWrap: true,
          wordWrapWidth: width - 14,
        }}
      />
      {cost ? (
        <pixiText
          anchor={{ x: 0.5, y: 0 }}
          eventMode="none"
          text={cost}
          x={width / 2}
          y={height - 22}
          style={{
            align: "center" as const,
            fill: disabled ? GAME_UI_COLORS.textFaint : tone === "danger" ? 0xffb9b4 : GAME_UI_COLORS.gold,
            fontFamily: GAME_UI_FONT,
            fontSize: 10,
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
            wordWrap: true,
            wordWrapWidth: width - 18,
          }}
        />
      ) : null}
    </pixiContainer>
  );
}
