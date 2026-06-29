import { useEffect, useMemo, useRef, useState } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { DIFFICULTY_BY_ID } from "../data/difficulty";
import { stageById } from "../data/stages";
import { BOSS_ROUND_LIST, FINAL_ROUND } from "../data/waves";
import { getRuntimeControls, type RuntimeSnapshot } from "../runtimeBridge";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const TOPBAR_H = 30;

interface PixiTopbarProps {
  runtime: RuntimeSnapshot | null;
}

interface StatSpec {
  id: string;
  label: string;
  value: string;
  color: number;
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

function TopStat({
  height,
  spec,
  x,
  y,
}: {
  height: number;
  spec: StatSpec;
  x: number;
  y: number;
}) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, spec.width, height, 5).fill({ color: 0x121820, alpha: 0.42 });
    g.roundRect(0, 0, spec.width, height, 5).stroke({ color: 0x384452, width: 1, alpha: 0.5 });
    g.circle(12, height / 2, 4).fill({ color: spec.color, alpha: 0.95 });
  }, [height, spec.color, spec.width]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        text={spec.label}
        x={22}
        y={5}
        style={{
          fill: 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 8,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        text={spec.value}
        x={22}
        y={15}
        style={{
          fill: spec.color,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(40, spec.width - 28),
        }}
      />
    </pixiContainer>
  );
}

function TopPill({
  height,
  spec,
  x,
  y,
}: {
  height: number;
  spec: PillSpec;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = spec.warn ? 0xe8a33d : spec.active ? 0xe7b53e : 0x4aa3ff;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, spec.width, height, 6).fill({ color: spec.active ? 0x3d2b10 : 0x17202b, alpha: 0.92 });
    g.roundRect(0, 0, spec.width, height, 6).stroke({ color: hovered ? 0xbfdfff : accent, width: hovered ? 2 : 1, alpha: 0.9 });
  }, [accent, height, hovered, spec.active, spec.width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={spec.onPress}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={spec.label}
        x={12}
        y={5}
        style={{
          fill: spec.active ? 0xfff0bf : 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
      {spec.sub ? (
        <pixiText
          eventMode="none"
          text={spec.sub}
          x={12}
          y={17}
          style={{
            fill: 0x9fb2c7,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 8,
          }}
        />
      ) : null}
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
  const itemHeight = Math.min(TOPBAR_H, height);
  const y = Math.max(0, Math.floor((height - itemHeight) / 2));
  const gap = compact ? 5 : 7;
  const speedWidth = compact ? 96 : 112;
  const pauseWidth = runtime.paused ? 78 : 86;
  const save = saveText(runtime.saveStatus);
  const saveWidth = save ? (runtime.saveStatus === "failed" ? 90 : 58) : 0;
  const rightWidth = speedWidth + pauseWidth + saveWidth + gap * (save ? 2 : 1);
  const rightStart = Math.max(0, width - rightWidth);

  const stats: StatSpec[] = [
    { id: "map", label: "MAP", value: `${stage.id}. ${stage.name}`, color: 0x8fd7ff, width: compact ? 136 : 168 },
    { id: "round", label: "ROUND", value: `${Math.min(state.round, FINAL_ROUND)}/${FINAL_ROUND}`, color: 0xdbe7f5, width: compact ? 76 : 88 },
    { id: "enemy", label: "ENEMY", value: `${state.enemies.length}/${runtime.enemyLimit}`, color: 0xff6f61, width: compact ? 82 : 92 },
    { id: "gold", label: "GOLD", value: String(state.gold), color: 0xf6d365, width: compact ? 70 : 84 },
    { id: "diff", label: "DIFF", value: diff?.id ?? state.difficulty, color: 0x8fd7ff, width: compact ? 86 : 104 },
  ];

  if (!compact && nextBoss !== undefined) {
    stats.push({
      id: "boss",
      label: "NEXT BOSS",
      value: `${nextBoss}R (${Math.max(0, nextBoss - state.round)}R)`,
      color: 0xe8a33d,
      width: 128,
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
      {stats.map((spec) => {
        const nextX = x;
        x += spec.width + gap;
        if (nextX + spec.width > rightStart - 10) return null;
        return <TopStat height={itemHeight} key={spec.id} spec={spec} x={nextX} y={y} />;
      })}
      {pending.map((spec, index) => {
        const nextX = x;
        x += spec.width + gap;
        if (nextX + spec.width > rightStart - 10) return null;
        return <TopPill height={itemHeight} key={`${spec.label}-${index}`} spec={spec} x={nextX} y={y} />;
      })}
      <pixiContainer x={rightStart} y={y}>
        {[1, 2, 3].map((speed, index) => (
          <TopPill
            height={itemHeight}
            key={speed}
            spec={{
              label: `x${speed}`,
              active: state.speed === speed,
              width: Math.floor((speedWidth - 8) / 3),
              onPress: () => controls?.act("setSpeed", { speed }),
            }}
            x={index * Math.floor(speedWidth / 3)}
            y={0}
          />
        ))}
      </pixiContainer>
      <TopPill
        height={itemHeight}
        spec={{
          label: runtime.paused ? "Resume" : "Pause",
          active: runtime.paused,
          width: pauseWidth,
          onPress: () => controls?.togglePause(),
        }}
        x={rightStart + speedWidth + gap}
        y={y}
      />
      {save ? (
        <TopPill
          height={itemHeight}
          spec={{
            label: save,
            warn: runtime.saveStatus === "failed",
            width: saveWidth,
            onPress: () => {
              if (runtime.saveStatus === "failed") controls?.autosave();
            },
          }}
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
