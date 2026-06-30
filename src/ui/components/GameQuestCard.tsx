import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { uiTexture } from "../assets/UiTextureRegistry";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";
import { GameProgressBar } from "./GameProgressBar";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameQuestCardProps {
  condition: string;
  height: number;
  progressLabel?: string;
  progressRatio?: number;
  reward: string;
  status: "active" | "done" | "expired";
  statusLabel?: string;
  title: string;
  width: number;
  x?: number;
  y?: number;
}

function statusTone(status: GameQuestCardProps["status"]): GameUiTone {
  if (status === "done") return "reward";
  if (status === "expired") return "disabled";
  return "normal";
}

export function GameQuestCard({
  condition,
  height,
  progressLabel,
  progressRatio = 0,
  reward,
  status,
  statusLabel,
  title,
  width,
  x = 0,
  y = 0,
}: GameQuestCardProps) {
  const tone = statusTone(status);
  const accent = toneColor(tone);
  const alpha = status === "expired" ? 0.56 : status === "done" ? 0.78 : 1;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(12, 12, width - 24, height - 24, 8).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.24 });
    g.rect(18, 42, width - 36, 1).fill({ color: accent, alpha: 0.24 });
    if (status === "done") {
      g.circle(width - 24, 24, 7).fill({ color: GAME_UI_COLORS.gold, alpha: 0.92 });
      g.moveTo(width - 28, 24);
      g.lineTo(width - 25, 28);
      g.lineTo(width - 19, 19);
      g.stroke({ color: GAME_UI_COLORS.obsidian, width: 2, alpha: 0.9 });
    }
  }, [accent, height, status, width]);

  return (
    <pixiContainer alpha={alpha} x={x} y={y}>
      <pixiSprite height={height} texture={uiTexture(status === "done" ? "mission.card.done" : "mission.card.active")} width={width} />
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={title}
        x={20}
        y={14}
        style={{
          fill: status === "expired" ? GAME_UI_COLORS.textFaint : GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: 12,
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          wordWrap: true,
          wordWrapWidth: Math.max(80, width - 90),
        }}
      />
      {statusLabel ? (
        <pixiText
          anchor={{ x: 1, y: 0 }}
          eventMode="none"
          text={statusLabel}
          x={width - 22}
          y={16}
          style={{
            fill: accent,
            fontFamily: GAME_UI_FONT,
            fontSize: 10,
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          }}
        />
      ) : null}
      <pixiText
        eventMode="none"
        text={condition}
        x={20}
        y={50}
        style={{
          fill: status === "expired" ? GAME_UI_COLORS.textFaint : GAME_UI_COLORS.textDim,
          fontFamily: GAME_UI_FONT,
          fontSize: 11,
          lineHeight: 14,
          wordWrap: true,
          wordWrapWidth: Math.max(90, width - 40),
        }}
      />
      {status === "active" && progressLabel ? (
        <GameProgressBar
          height={20}
          label={progressLabel}
          ratio={progressRatio}
          tone="normal"
          width={Math.max(120, width - 40)}
          x={20}
          y={Math.max(72, height - 54)}
        />
      ) : null}
      <pixiText
        eventMode="none"
        text={reward}
        x={20}
        y={height - 28}
        style={{
          fill: status === "expired" ? GAME_UI_COLORS.textFaint : GAME_UI_COLORS.gold,
          fontFamily: GAME_UI_FONT,
          fontSize: 11,
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          wordWrap: true,
          wordWrapWidth: Math.max(90, width - 40),
        }}
      />
    </pixiContainer>
  );
}
