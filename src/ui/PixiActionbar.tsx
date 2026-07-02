import { useEffect, useMemo, useRef, useState } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls } from "../runtimeBridge";
import { SUMMON_COST, SELL_REFUND } from "../data/difficulty";
import { UNIT_BY_ID } from "../data/units";
import { FINAL_ROUND, waveForRound } from "../data/waves";
import { GameHotbarSlot, GamePanel, type GameHotbarGlyph } from "./components";
import { drawConsoleFrame } from "./skin/consoleDraw";
import { GAME_UI_COLORS, GAME_UI_FONT, type GameUiTone } from "./skin/GameUiTokens";

extend({ Container, Graphics, Sprite, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const ACTIONBAR_H = 78;

interface PixiActionbarProps {
  runtime: RuntimeSnapshot | null;
}

interface ActionSpec {
  id: string;
  label: string;
  sub: string;
  disabled?: boolean;
  glyph: GameHotbarGlyph;
  keycap: string;
  selected?: boolean;
  tone?: GameUiTone;
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
  const slotHeight = Math.min(74, height - 8);

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

  const baseWidth = compact ? 76 : 92;
  const actions: ActionSpec[] = [
    {
      id: "SUM",
      keycap: "Z",
      label: "Summon",
      sub: `${SUMMON_COST}G`,
      disabled: ended || state.gold < SUMMON_COST || runtime.ownedUnitCount >= runtime.unitCap,
      glyph: "summon",
      tone: "reward",
      width: baseWidth,
      onPress: () => controls?.act("summon"),
    },
    {
      id: "M3",
      keycap: "X",
      label: "Merge",
      sub: canMergeCount ? "ready" : `${selectedIds.length}/3`,
      disabled: ended || !canMergeCount,
      glyph: "merge",
      tone: "normal",
      width: baseWidth,
      onPress: () => {
        if (!controls?.act("merge3", { unitIds: selectedIds })) return;
        controls.clearSelection();
      },
    },
    {
      id: "DEL",
      keycap: "Del",
      label: "Sell",
      sub: selectedIds.length > 0 ? `${selectedIds.length} +${refund}G` : "select",
      disabled: ended || selectedIds.length === 0,
      glyph: "sell",
      tone: "danger",
      width: baseWidth,
      onPress: () => controls?.confirmSell(selectedIds, refund),
    },
    {
      id: "UP",
      keycap: "U",
      label: "Upgrade",
      sub: "families",
      disabled: ended,
      glyph: "upgrade",
      tone: "normal",
      width: compact ? 80 : 96,
      onPress: () => controls?.openUpgrade(),
    },
    {
      id: "REL",
      keycap: "R",
      label: "Relic",
      sub: relicSub,
      disabled: ended || (state.pendingRelicChoices.length === 0 && state.relicIds.length === 0),
      glyph: "relic",
      tone: "reward",
      width: compact ? 80 : 96,
      onPress: () => {
        if (state.pendingRelicChoices.length > 0) controls?.openRelicChoice();
        else controls?.setActiveTab("boss");
      },
    },
    {
      id: "DPS",
      keycap: "D",
      label: "DPS",
      sub: runtime.dpsVisible ? "on" : "off",
      glyph: "dps",
      selected: runtime.dpsVisible,
      tone: runtime.dpsVisible ? "selected" : "normal",
      width: compact ? 72 : 88,
      onPress: () => controls?.toggleDps(),
    },
  ];

  if (inBreak && !ended) {
    actions.push({
      id: "GO",
      keycap: "Space",
      label: `Start R${state.round}`,
      sub: nextWaveText(runtime),
      glyph: "start",
      tone: "primary",
      width: compact ? 116 : 154,
      onPress: () => {
        if (state.pendingRelicChoices.length > 0) controls?.openRelicChoice();
        else if (state.pendingSelectors.length > 0) controls?.openSelector();
        else controls?.advanceWave();
      },
    });
  }

  const gap = compact ? 5 : 8;
  const phaseWidth = compact ? 154 : 224;
  const phaseX = Math.max(0, width - phaseWidth - 6);
  let cursorX = compact ? 8 : 14;

  const drawPhase = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.circle(18, 22, 6).fill({ color: state.phase === "ended" ? GAME_UI_COLORS.danger : GAME_UI_COLORS.gold, alpha: 0.9 });
    g.circle(18, 22, 10).stroke({ color: GAME_UI_COLORS.gold, width: 1, alpha: 0.34 });
  }, [state.phase]);

  return (
    <pixiContainer>
      <pixiGraphics
        draw={(g) => {
          drawConsoleFrame(g, "frame.actionbar", width, height, 0.96);
        }}
      />
      {actions.map((spec) => {
        const nextX = cursorX;
        cursorX += spec.width + gap;
        if (nextX + spec.width > phaseX - gap) return null;
        return (
          <GameHotbarSlot
            cost={spec.sub}
            disabled={spec.disabled}
            glyph={spec.glyph}
            height={slotHeight}
            key={spec.id}
            keycap={spec.keycap}
            label={spec.label}
            onPress={spec.onPress}
            selected={spec.selected}
            tone={spec.tone}
            width={spec.width}
            x={nextX}
            y={Math.max(2, Math.floor((height - slotHeight) / 2))}
          />
        );
      })}
      <GamePanel accent={inBreak ? "warning" : "normal"} height={slotHeight} textureKey="frame.panelSmall" variant="small" width={phaseWidth} x={phaseX} y={Math.max(2, Math.floor((height - slotHeight) / 2))}>
        <pixiGraphics draw={drawPhase} />
        <pixiText
          text={phaseText(runtime)}
          x={34}
          y={12}
          style={{
            fill: GAME_UI_COLORS.text,
            fontFamily: GAME_UI_FONT,
            fontSize: compact ? 10 : 12,
            fontWeight: "bold" as const,
            stroke: { color: GAME_UI_COLORS.obsidian, width: 2 },
            wordWrap: true,
            wordWrapWidth: phaseWidth - 48,
          }}
        />
        <pixiText
          text={`${runtime.ownedUnitCount}/${runtime.unitCap} units`}
          x={34}
          y={38}
          style={{
            fill: GAME_UI_COLORS.textDim,
            fontFamily: GAME_UI_FONT,
            fontSize: 9,
          }}
        />
      </GamePanel>
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
