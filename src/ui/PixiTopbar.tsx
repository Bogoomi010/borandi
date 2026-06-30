import { useEffect, useMemo, useRef, useState } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { DIFFICULTY_BY_ID } from "../data/difficulty";
import { stageById } from "../data/stages";
import { BOSS_ROUND_LIST, FINAL_ROUND } from "../data/waves";
import { getRuntimeControls, type RuntimeSnapshot } from "../runtimeBridge";
import { uiTexture } from "./assets/UiTextureRegistry";
import { GameButton, GameResourceBadge, type GameResourceKind } from "./components";
import { GAME_UI_COLORS, GAME_UI_FONT } from "./skin/GameUiTokens";
import type { UiTextureKey } from "./skin/UiTextureKeys";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const TOPBAR_H = 50;

interface PixiTopbarProps {
  runtime: RuntimeSnapshot | null;
}

interface StatSpec {
  id: string;
  kind: GameResourceKind;
  label: string;
  tone?: "normal" | "primary" | "danger" | "selected" | "disabled" | "reward" | "warning";
  value: string;
  width: number;
}

interface PillSpec {
  label: string;
  sub?: string;
  active?: boolean;
  warn?: boolean;
  width: number;
  onPress: () => void;
}

function useSurfaceSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: TOPBAR_H });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let raf = 0;
    let frames = 0;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    resize();
    const tick = () => {
      resize();
      frames += 1;
      if (frames < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return { ref, size };
}

function saveText(status: RuntimeSnapshot["saveStatus"]) {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "failed") return "Save failed";
  return "";
}

function TopSpeedButton({
  active,
  height,
  onPress,
  speed,
  width,
  x,
  y,
}: {
  active: boolean;
  height: number;
  onPress: () => void;
  speed: 1 | 2 | 3;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const textureKey: UiTextureKey = `topbar.speed.x${speed}${active ? ".selected" : ""}` as UiTextureKey;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    if (hovered || active) {
      g.roundRect(4, 5, width - 8, height - 10, 8).stroke({
        color: active ? GAME_UI_COLORS.gold : GAME_UI_COLORS.arcane,
        width: active ? 2 : 1,
        alpha: hovered ? 0.5 : 0.32,
      });
    }
  }, [active, height, hovered, width]);

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
      <pixiSprite height={height} texture={uiTexture(textureKey)} width={width} />
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        eventMode="none"
        text={`x${speed}`}
        x={width / 2}
        y={height / 2}
        style={{
          fill: active ? 0xfff0bf : GAME_UI_COLORS.text,
          fontFamily: GAME_UI_FONT,
          fontSize: 10,
          fontWeight: "bold" as const,
          stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
        }}
      />
    </pixiContainer>
  );
}

function TopPauseButton({
  height,
  onPress,
  paused,
  width,
  x,
  y,
}: {
  height: number;
  onPress: () => void;
  paused: boolean;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    if (hovered || paused) {
      g.roundRect(4, 4, width - 8, height - 8, 10).stroke({
        color: paused ? GAME_UI_COLORS.gold : GAME_UI_COLORS.arcane,
        width: 2,
        alpha: hovered ? 0.58 : 0.32,
      });
    }
  }, [height, hovered, paused, width]);

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
      <pixiSprite height={height} texture={uiTexture(paused ? "topbar.play" : "topbar.pause")} width={width} />
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}

function PixiTopbarStage({
  height,
  runtime,
  width,
}: {
  height: number;
  runtime: RuntimeSnapshot;
  width: number;
}) {
  const controls = getRuntimeControls();
  const state = runtime.state;
  const stage = stageById(state.stageId);
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  const nextBoss = BOSS_ROUND_LIST.find((round) => round >= state.round);
  const compact = width < 1120;
  const itemHeight = Math.min(46, height - 2);
  const y = Math.max(0, Math.floor((height - itemHeight) / 2));
  const gap = compact ? 5 : 8;
  const speedWidth = compact ? 126 : 144;
  const pauseWidth = 48;
  const save = saveText(runtime.saveStatus);
  const saveWidth = save ? (runtime.saveStatus === "failed" ? 94 : 66) : 0;
  const rightWidth = speedWidth + pauseWidth + saveWidth + gap * (save ? 2 : 1);
  const rightStart = Math.max(0, width - rightWidth);

  const stats: StatSpec[] = [
    { id: "map", kind: "map", label: "MAP", value: `${stage.id}. ${stage.name}`, tone: "normal", width: compact ? 146 : 184 },
    { id: "round", kind: "round", label: "ROUND", value: `${Math.min(state.round, FINAL_ROUND)}/${FINAL_ROUND}`, tone: "normal", width: compact ? 92 : 108 },
    { id: "enemy", kind: "enemy", label: "ENEMY", value: `${state.enemies.length}/${runtime.enemyLimit}`, tone: state.enemies.length > runtime.enemyLimit * 0.7 ? "danger" : "warning", width: compact ? 98 : 116 },
    { id: "gold", kind: "gold", label: "GOLD", value: String(state.gold), tone: "reward", width: compact ? 86 : 104 },
    { id: "diff", kind: "difficulty", label: "DIFF", value: diff?.id ?? state.difficulty, tone: "normal", width: compact ? 96 : 116 },
  ];

  if (!compact && nextBoss !== undefined) {
    stats.push({
      id: "boss",
      kind: "boss",
      label: "NEXT BOSS",
      value: `${nextBoss}R (${Math.max(0, nextBoss - state.round)}R)`,
      tone: "warning",
      width: 154,
    });
  }

  const pending: PillSpec[] = [];
  if (state.pendingSelectors.length > 0) {
    pending.push({
      label: `Selector ${state.pendingSelectors.length}`,
      warn: true,
      width: compact ? 92 : 110,
      onPress: () => controls?.openSelector(),
    });
  }
  if (state.pendingRelicChoices.length > 0) {
    pending.push({
      label: `Relic ${state.pendingRelicChoices.length}`,
      warn: true,
      width: compact ? 82 : 96,
      onPress: () => controls?.openRelicChoice(),
    });
  }

  let x = 0;

  return (
    <pixiContainer>
      <pixiSprite alpha={0.98} height={height} texture={uiTexture("frame.topbar")} width={width} />
      {stats.map((spec) => {
        const nextX = x;
        x += spec.width + gap;
        if (nextX + spec.width > rightStart - 10) return null;
        return (
          <GameResourceBadge
            height={itemHeight}
            key={spec.id}
            kind={spec.kind}
            label={spec.label}
            tone={spec.tone}
            value={spec.value}
            width={spec.width}
            x={nextX}
            y={y}
          />
        );
      })}
      {pending.map((spec, index) => {
        const nextX = x;
        x += spec.width + gap;
        if (nextX + spec.width > rightStart - 10) return null;
        return (
          <GameButton
            height={itemHeight}
            key={`${spec.label}-${index}`}
            label={spec.label}
            onPress={spec.onPress}
            tone={spec.warn ? "warning" : "normal"}
            width={spec.width}
            x={nextX}
            y={y}
          />
        );
      })}
      <pixiContainer x={rightStart} y={y}>
        <pixiSprite alpha={0.82} height={itemHeight} texture={uiTexture("topbar.speed.group")} width={speedWidth} />
        {([1, 2, 3] as const).map((speed, index) => (
          <TopSpeedButton
            active={state.speed === speed}
            height={itemHeight}
            key={speed}
            onPress={() => controls?.act("setSpeed", { speed })}
            speed={speed}
            width={Math.floor(speedWidth / 3)}
            x={index * Math.floor(speedWidth / 3)}
            y={0}
          />
        ))}
      </pixiContainer>
      <TopPauseButton
        height={itemHeight}
        onPress={() => controls?.togglePause()}
        paused={runtime.paused}
        width={pauseWidth}
        x={rightStart + speedWidth + gap}
        y={y}
      />
      {save ? (
        <GameButton
          height={itemHeight}
          label={save}
          onPress={() => {
            if (runtime.saveStatus === "failed") controls?.autosave();
          }}
          tone={runtime.saveStatus === "failed" ? "danger" : "normal"}
          width={saveWidth}
          x={rightStart + speedWidth + pauseWidth + gap * 2}
          y={y}
        />
      ) : null}
    </pixiContainer>
  );
}

export function PixiTopbar({ runtime }: PixiTopbarProps) {
  const { ref, size } = useSurfaceSize();

  if (!runtime) return <div ref={ref} className="pixi-topbar-surface" />;

  return (
    <div ref={ref} className="pixi-topbar-surface">
      <Application key={`${size.width}x${size.height}`} width={size.width} height={size.height} backgroundAlpha={0} antialias>
        <PixiTopbarStage height={size.height} runtime={runtime} width={size.width} />
      </Application>
    </div>
  );
}
