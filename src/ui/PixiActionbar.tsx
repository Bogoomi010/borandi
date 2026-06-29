import { useEffect, useMemo, useRef, useState } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import type { RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls } from "../runtimeBridge";
import { SUMMON_COST, SELL_REFUND } from "../data/difficulty";
import { UNIT_BY_ID } from "../data/units";
import { FINAL_ROUND, waveForRound } from "../data/waves";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const ACTIONBAR_H = 60;

interface PixiActionbarProps {
  runtime: RuntimeSnapshot | null;
}

interface ActionSpec {
  id: string;
  label: string;
  sub: string;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  width: number;
  onPress: () => void;
}

function useSurfaceSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: ACTIONBAR_H });

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

function phaseText(runtime: RuntimeSnapshot) {
  const state = runtime.state;
  const alive = state.enemies.length;
  const limit = runtime.enemyLimit;

  if (state.phase === "ended") return state.cleared ? "Cleared" : "Game over";
  if (state.breakTicks > 0) return `Round ${state.round} break / ${alive}/${limit}`;
  return `Round ${state.round} wave / ${alive}/${limit}`;
}

function nextWaveText(runtime: RuntimeSnapshot) {
  const state = runtime.state;
  if (state.pendingRelicChoices.length > 0) return "Relic pending";
  if (state.pendingSelectors.length > 0) return "Selector pending";

  const wave = waveForRound(Math.min(state.round, FINAL_ROUND));
  return wave.type === "boss" ? "Boss round" : `${wave.enemyName} x${wave.count}`;
}

function PixiButton({
  height,
  spec,
  x,
  y,
}: {
  height: number;
  spec: ActionSpec;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = spec.danger ? 0xe5534b : spec.primary ? 0x3f86e6 : 0x4aa3ff;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const disabledAlpha = spec.disabled ? 0.46 : 1;
    const fill = spec.primary ? 0x245fbd : spec.danger ? 0x2a1820 : 0x1a222d;
    const border = hovered && !spec.disabled ? 0x9fd4ff : accent;

    g.clear();
    g.roundRect(0, 0, spec.width, height, 7).fill({ color: fill, alpha: spec.primary ? 0.95 * disabledAlpha : 0.9 * disabledAlpha });
    g.roundRect(0, 0, spec.width, height, 7).stroke({ color: border, width: hovered && !spec.disabled ? 2 : 1, alpha: 0.82 * disabledAlpha });
    g.roundRect(7, 9, 26, 26, 5).fill({ color: accent, alpha: 0.18 * disabledAlpha });
    g.roundRect(7, 9, 26, 26, 5).stroke({ color: accent, width: 1, alpha: 0.7 * disabledAlpha });
    if (hovered && !spec.disabled) {
      g.roundRect(1, 1, spec.width - 2, height - 2, 6).stroke({ color: 0xffffff, width: 1, alpha: 0.16 });
    }
  }, [accent, height, hovered, spec.danger, spec.disabled, spec.primary, spec.width]);

  return (
    <pixiContainer
      cursor={spec.disabled ? "default" : "pointer"}
      eventMode={spec.disabled ? "none" : "static"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={() => {
        if (!spec.disabled) spec.onPress();
      }}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={spec.id}
        x={13}
        y={14}
        style={{
          fill: spec.disabled ? 0x7f8b98 : 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 9,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        eventMode="none"
        text={spec.label}
        x={42}
        y={9}
        style={{
          fill: spec.disabled ? 0x7f8b98 : 0xffffff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(32, spec.width - 48),
        }}
      />
      <pixiText
        eventMode="none"
        text={spec.sub}
        x={42}
        y={32}
        style={{
          fill: spec.disabled ? 0x657180 : spec.primary ? 0xcfe2ff : 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 9,
          wordWrap: true,
          wordWrapWidth: Math.max(32, spec.width - 48),
        }}
      />
    </pixiContainer>
  );
}

function PixiActionbarStage({
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
  const ended = state.phase === "ended";
  const inBreak = state.breakTicks > 0;
  const selectedIds = [...runtime.selectedUids];
  const canMergeCount = selectedIds.length === 3;
  const compact = width < 1060;
  const buttonHeight = Math.min(54, height - 6);

  let refund = 0;
  for (const uid of selectedIds) {
    const unit = state.units.find((candidate) => candidate.uid === uid);
    if (unit) refund += SELL_REFUND[UNIT_BY_ID[unit.defId].grade];
  }

  const relicSub = state.pendingRelicChoices.length > 0
    ? `${state.pendingRelicChoices.length} pending`
    : state.relicIds.length > 0
      ? `${state.relicIds.length} owned`
      : "Boss reward";

  const baseWidth = compact ? 78 : 104;
  const actions: ActionSpec[] = [
    {
      id: "SUM",
      label: "Summon",
      sub: `${SUMMON_COST}G`,
      disabled: ended || state.gold < SUMMON_COST || runtime.ownedUnitCount >= runtime.unitCap,
      width: baseWidth,
      onPress: () => controls?.act("summon"),
    },
    {
      id: "M3",
      label: "Merge",
      sub: canMergeCount ? "ready" : `${selectedIds.length}/3`,
      disabled: ended || !canMergeCount,
      width: baseWidth,
      onPress: () => {
        if (!controls?.act("merge3", { unitIds: selectedIds })) return;
        controls.clearSelection();
      },
    },
    {
      id: "DEL",
      label: "Sell",
      sub: selectedIds.length > 0 ? `${selectedIds.length} +${refund}G` : "select",
      danger: true,
      disabled: ended || selectedIds.length === 0,
      width: baseWidth,
      onPress: () => controls?.confirmSell(selectedIds, refund),
    },
    {
      id: "UP",
      label: "Upgrade",
      sub: "families",
      disabled: ended,
      width: compact ? 86 : 112,
      onPress: () => controls?.openUpgrade(),
    },
    {
      id: "REL",
      label: "Relic",
      sub: relicSub,
      disabled: ended || (state.pendingRelicChoices.length === 0 && state.relicIds.length === 0),
      width: compact ? 84 : 108,
      onPress: () => {
        if (state.pendingRelicChoices.length > 0) controls?.openRelicChoice();
        else controls?.setActiveTab("boss");
      },
    },
    {
      id: "DPS",
      label: "DPS",
      sub: runtime.dpsVisible ? "on" : "off",
      primary: runtime.dpsVisible,
      width: compact ? 78 : 96,
      onPress: () => controls?.toggleDps(),
    },
  ];

  if (!compact) {
    actions.splice(5, 0, {
      id: "LOG",
      label: "Proof",
      sub: "run notes",
      disabled: ended,
      width: 108,
      onPress: () => controls?.openManualProofGuide(),
    });
  }

  if (inBreak && !ended) {
    actions.push({
      id: "GO",
      label: `Start R${state.round}`,
      sub: nextWaveText(runtime),
      primary: true,
      width: compact ? 134 : 188,
      onPress: () => {
        if (state.pendingRelicChoices.length > 0) controls?.openRelicChoice();
        else if (state.pendingSelectors.length > 0) controls?.openSelector();
        else controls?.advanceWave();
      },
    });
  }

  const gap = compact ? 6 : 8;
  const phaseWidth = compact ? 154 : 230;
  const phaseX = Math.max(0, width - phaseWidth);
  let x = 0;

  const drawPhase = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, phaseWidth, buttonHeight, 7).fill({ color: 0x121820, alpha: 0.72 });
    g.roundRect(0, 0, phaseWidth, buttonHeight, 7).stroke({ color: 0x384452, width: 1, alpha: 0.72 });
  }, [buttonHeight, phaseWidth]);

  return (
    <pixiContainer>
      {actions.map((spec) => {
        const nextX = x;
        x += spec.width + gap;
        if (nextX + spec.width > phaseX - gap) return null;
        return <PixiButton height={buttonHeight} key={spec.id} spec={spec} x={nextX} y={3} />;
      })}
      <pixiContainer x={phaseX} y={3}>
        <pixiGraphics draw={drawPhase} />
        <pixiText
          text={phaseText(runtime)}
          x={14}
          y={11}
          style={{
            fill: 0xdbe7f5,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: compact ? 10 : 12,
            fontWeight: "bold" as const,
            wordWrap: true,
            wordWrapWidth: phaseWidth - 28,
          }}
        />
        <pixiText
          text={`${runtime.ownedUnitCount}/${runtime.unitCap} units`}
          x={14}
          y={32}
          style={{
            fill: 0x9fb2c7,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 9,
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export function PixiActionbar({ runtime }: PixiActionbarProps) {
  const { ref, size } = useSurfaceSize();

  if (!runtime || runtime.scene !== "game") {
    return <div ref={ref} className="pixi-actionbar-surface" />;
  }

  return (
    <div ref={ref} className="pixi-actionbar-surface">
      <Application key={`${size.width}x${size.height}`} width={size.width} height={size.height} backgroundAlpha={0} antialias>
        <PixiActionbarStage height={size.height} runtime={runtime} width={size.width} />
      </Application>
    </div>
  );
}
