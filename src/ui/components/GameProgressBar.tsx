import { useMemo } from "react";
import { extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone, toneColor } from "../skin/GameUiTokens";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface GameProgressBarProps {
  height?: number;
  label?: string;
  ratio: number;
  tone?: GameUiTone;
  width: number;
  x?: number;
  y?: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function GameProgressBar({
  height = 18,
  label,
  ratio,
  tone = "normal",
  width,
  x = 0,
  y = 0,
}: GameProgressBarProps) {
  const value = clamp01(ratio);
  const accent = toneColor(tone);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const bw = Math.max(1, width - 14);
    const bh = Math.max(1, height - 10);
    g.clear();
    // 콘솔 세그먼트 게이지 — 이미지 없이 코드로만
    g.roundRect(7, 5, bw, bh, 3).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.85 });
    const fw = Math.max(0, (width - 18) * value);
    if (fw > 1) {
      g.roundRect(9, 7, fw, Math.max(1, height - 14), 2).fill({ color: accent, alpha: 0.88 });
      g.rect(9, 7, fw, Math.max(1, (height - 14) / 2.6)).fill({ color: 0xffffff, alpha: 0.18 });
      const seg = Math.max(18, bw / 8);
      for (let sx = 9 + seg; sx < 9 + fw; sx += seg) {
        g.rect(sx, 7, 1, Math.max(1, height - 14)).fill({ color: GAME_UI_COLORS.obsidian, alpha: 0.4 });
      }
    }
    g.roundRect(7, 5, bw, bh, 3).stroke({ color: GAME_UI_COLORS.steelDark, width: 1, alpha: 0.9 });
    g.roundRect(7, 5, bw, bh, 3).stroke({ color: accent, width: 1, alpha: 0.25 });
  }, [accent, height, value, width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      {label ? (
        <pixiText
          anchor={0.5}
          eventMode="none"
          text={label}
          x={width / 2}
          y={height / 2}
          style={{
            fill: GAME_UI_COLORS.text,
            fontFamily: GAME_UI_FONT,
            fontSize: Math.max(9, Math.floor(height * 0.48)),
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
          }}
        />
      ) : null}
    </pixiContainer>
  );
}
