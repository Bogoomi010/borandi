import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text, type FederatedPointerEvent } from "pixi.js";
import { FAMILY_LABEL, GRADE_LABEL, ROLE_LABEL, type DifficultyId, type Grade, type RelicDef, type UnitDef } from "../core/types";
import { DIFFICULTIES } from "../data/difficulty";
import { RECIPES } from "../data/recipes";
import { FINAL_STAGE, STAGES, stageById, type StageDef } from "../data/stages";
import { UNITS } from "../data/units";
import { UPGRADES, upgradeCost } from "../data/upgrades";
import { LOCALES, getLocale, onLocaleChange, t, type Locale } from "../i18n";
import { getRuntimeSnapshot, subscribeRuntimeSnapshot } from "../runtimeBridge";
import type { SlotMeta } from "../save/saveApi";
import { FAMILY_COLOR, GRADE_COLOR } from "./boardPalette";
import {
  closeReactOverlay,
  type ReactAboutOverlay,
  type ReactBalanceGateOverlay,
  type ReactCollectionOverlay,
  type ReactConfirmOverlay,
  type ReactHelpOverlay,
  type ReactLoadOverlay,
  type ReactManualProofOverlay,
  type ReactNewRunOverlay,
  type ReactOptionsOverlay,
  type ReactRelicChoiceOverlay,
  type ReactResultCommand,
  type ReactResultOverlay,
  type ReactSaveOverlay,
  type ReactSelectorOverlay,
  type ReactSimulationOverlay,
  type ReactUpgradeOverlay,
} from "./reactOverlayBridge";
import { pushToast } from "./toastBridge";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;
type PixiPointerEvent = FederatedPointerEvent & { currentTarget: Container };

const FONT = "Segoe UI, Malgun Gothic, sans-serif";
const PADDING = 24;
const BUTTON_H = 36;

const HELP_ROWS: [string, string][] = [
  ["Z", "Summon"],
  ["X", "Merge three selected units"],
  ["Delete / Backspace", "Sell selected units"],
  ["A + Left click", "Attack move"],
  ["S", "Hold position"],
  ["L", "Toggle selected unit lock"],
  ["Q / W / E", "Speed x1 / x2 / x3"],
  ["Ctrl + 1-9", "Save selected group"],
  ["1-9", "Select saved group"],
  ["Esc", "Cancel attack move / close modal / pause menu"],
];

const MANUAL_TARGET_HINTS: Record<string, string> = {
  novice: "무전멸 40R 클리어",
  normal: "1~2전설 40R 클리어 / 무전멸 경계 확인",
  intermediate: "5전설 이상 40R 클리어 / 2전설 경계 확인",
  expert: "5전설 이하 실패 / 6전설 이상 40R 클리어",
  master: "실패 기록 / 추가 실패 확인",
};

function hexColor(value: string) {
  return value.startsWith("#") ? Number.parseInt(value.slice(1), 16) : 0x8fd7ff;
}

function estimateLines(text: string, width: number, fontSize = 12) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.72)));
  return Math.max(1, Math.ceil(Array.from(text).length / charsPerLine));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function PixiModalShell({
  children,
  dismissable,
  height,
  overlayId,
  width,
}: {
  children: ReactNode;
  dismissable: boolean;
  height: number;
  overlayId: number;
  width: number;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (dismissable && event.target === event.currentTarget) closeReactOverlay(overlayId);
      }}
    >
      <div className="pixi-modal-canvas" style={{ height, width }}>
        <Application width={width} height={height} backgroundAlpha={0} antialias>
          {children}
        </Application>
      </div>
    </div>
  );
}

function PanelBg({ height, reward, width }: { height: number; reward?: boolean; width: number }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 12).fill({ color: reward ? 0x171421 : 0x121820, alpha: 0.98 });
    g.roundRect(0, 0, width, height, 12).stroke({ color: reward ? 0xe7b53e : 0x8fd7ff, width: 1, alpha: 0.86 });
    g.roundRect(1, 1, width - 2, height - 2, 11).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
  }, [height, reward, width]);

  return <pixiGraphics draw={draw} />;
}

function PixiButton({
  danger,
  label,
  onPress,
  primary,
  width,
  x,
  y,
}: {
  danger?: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = danger ? 0xe5534b : primary ? 0x3f86e6 : 0x8fd7ff;
  const fill = primary ? 0x245fbd : danger ? 0x2a1820 : 0x151b24;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, BUTTON_H, 6).fill({ color: fill, alpha: hovered ? 1 : 0.96 });
    g.roundRect(0, 0, width, BUTTON_H, 6).stroke({ color: hovered ? 0xbfdfff : accent, width: hovered ? 2 : 1, alpha: 0.92 });
  }, [accent, fill, hovered, width]);

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
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        eventMode="none"
        text={label}
        x={width / 2}
        y={BUTTON_H / 2}
        style={{
          fill: danger ? 0xffb9b4 : 0xffffff,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(48, width - 16),
        }}
      />
    </pixiContainer>
  );
}

function Header({ subtitle, title, width }: { subtitle?: string; title: string; width: number }) {
  return (
    <pixiContainer>
      <pixiText
        text={title}
        x={PADDING}
        y={22}
        style={{
          fill: 0xeef3fa,
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - PADDING * 2,
        }}
      />
      {subtitle ? (
        <pixiText
          text={subtitle}
          x={PADDING}
          y={50}
          style={{
            fill: 0x9fb2c7,
            fontFamily: FONT,
            fontSize: 12,
            wordWrap: true,
            wordWrapWidth: width - PADDING * 2,
          }}
        />
      ) : null}
    </pixiContainer>
  );
}

function UnitCard({
  height,
  onPick,
  unit,
  width,
  x,
  y,
}: {
  height: number;
  onPick: () => void;
  unit: UnitDef;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const familyColor = hexColor(FAMILY_COLOR[unit.family]);
  const gradeColor = hexColor(GRADE_COLOR[unit.grade]);
  const roleText = `${FAMILY_LABEL[unit.family]} / ${unit.roles.map((role) => ROLE_LABEL[role]).join("/")}`;
  const statText = `공격 ${unit.attack} / 속도 ${unit.attackSpeed}`;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 8).fill({ color: hovered ? 0x1e2a39 : 0x141a22, alpha: 0.96 });
    g.roundRect(0, 0, width, height, 8).stroke({ color: hovered ? 0xbfdfff : gradeColor, width: hovered ? 2 : 1, alpha: 0.9 });
    g.roundRect(width / 2 - 16, 14, 32, 32, 6).fill({ color: familyColor, alpha: 0.92 });
    g.roundRect(width / 2 - 16, 14, 32, 32, 6).stroke({ color: gradeColor, width: 3, alpha: 0.95 });
  }, [familyColor, gradeColor, height, hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPick}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        eventMode="none"
        text={unit.name}
        x={width / 2}
        y={58}
        style={{
          align: "center" as const,
          fill: 0xeef3fa,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - 18,
        }}
      />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        eventMode="none"
        text={`${roleText}\n${statText}${unit.desc ? `\n${unit.desc}` : ""}`}
        x={width / 2}
        y={88}
        style={{
          align: "center" as const,
          fill: 0x9fb2c7,
          fontFamily: FONT,
          fontSize: 11,
          lineHeight: 15,
          wordWrap: true,
          wordWrapWidth: width - 18,
        }}
      />
    </pixiContainer>
  );
}

function RelicCard({
  height,
  onPick,
  relic,
  width,
  x,
  y,
}: {
  height: number;
  onPick: () => void;
  relic: RelicDef;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const color = relic.rarity === "legend" ? 0xf0a830 : relic.rarity === "epic" ? 0xb05cff : 0x3f9ae0;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 8).fill({ color: hovered ? 0x211b2f : 0x141a22, alpha: 0.96 });
    g.roundRect(0, 0, width, height, 8).stroke({ color: hovered ? 0xffe6a6 : color, width: hovered ? 2 : 1, alpha: 0.86 });
    g.roundRect(14, 14, 32, 32, 7).fill({ color, alpha: 0.14 });
    g.roundRect(14, 14, 32, 32, 7).stroke({ color, width: 1, alpha: 0.9 });
  }, [color, height, hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPick}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        eventMode="none"
        text="◆"
        x={30}
        y={30}
        style={{ fill: color, fontFamily: FONT, fontSize: 14, fontWeight: "bold" as const }}
      />
      <pixiText
        eventMode="none"
        text={relic.name}
        x={58}
        y={14}
        style={{
          fill: 0xeef3fa,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - 72,
        }}
      />
      <pixiText
        eventMode="none"
        text={relic.rarity}
        x={58}
        y={36}
        style={{ fill: color, fontFamily: FONT, fontSize: 10, fontWeight: "bold" as const }}
      />
      <pixiText
        eventMode="none"
        text={relic.desc}
        x={16}
        y={62}
        style={{
          fill: 0x9fb2c7,
          fontFamily: FONT,
          fontSize: 12,
          lineHeight: 16,
          wordWrap: true,
          wordWrapWidth: width - 32,
        }}
      />
    </pixiContainer>
  );
}

function ChoiceGridStage({ overlay }: { overlay: ReactSelectorOverlay }) {
  const cols = Math.min(3, overlay.candidates.length);
  const cardW = 210;
  const cardH = 174;
  const gap = 12;
  const width = PADDING * 2 + cols * cardW + (cols - 1) * gap;
  const title = `🎁 ${GRADE_LABEL[overlay.grade as Grade]} 선택권`;

  return (
    <pixiContainer>
      <PanelBg height={312} reward width={width} />
      <Header subtitle={`출처: ${overlay.source} / 1기를 선택하세요.`} title={title} width={width} />
      {overlay.candidates.map((unit, index) => (
        <UnitCard
          height={cardH}
          key={unit.id}
          onPick={() => {
            closeReactOverlay(overlay.id);
            overlay.actions.pick(unit.id);
          }}
          unit={unit}
          width={cardW}
          x={PADDING + index * (cardW + gap)}
          y={82}
        />
      ))}
      <PixiButton label="나중에 선택" onPress={() => closeReactOverlay(overlay.id)} width={128} x={width - PADDING - 128} y={264} />
    </pixiContainer>
  );
}

export function PixiSelectorModal({ overlay }: { overlay: ReactSelectorOverlay }) {
  const cols = Math.min(3, overlay.candidates.length);
  const width = PADDING * 2 + cols * 210 + (cols - 1) * 12;
  return (
    <PixiModalShell dismissable={false} height={312} overlayId={overlay.id} width={width}>
      <ChoiceGridStage overlay={overlay} />
    </PixiModalShell>
  );
}

function RelicGridStage({ overlay, height, width }: { overlay: ReactRelicChoiceOverlay; height: number; width: number }) {
  const cols = Math.min(3, overlay.candidates.length);
  const gap = 12;
  const cardW = Math.floor((width - PADDING * 2 - gap * (cols - 1)) / cols);
  const cardH = height - 144;

  return (
    <pixiContainer>
      <PanelBg height={height} reward width={width} />
      <Header subtitle={`${overlay.source} / 이번 런 동안 유지되는 유물 1개를 고르세요.`} title="보스 유물 선택" width={width} />
      {overlay.candidates.map((relic, index) => (
        <RelicCard
          height={cardH}
          key={relic.id}
          onPick={() => {
            closeReactOverlay(overlay.id);
            overlay.actions.pick(relic.id);
          }}
          relic={relic}
          width={cardW}
          x={PADDING + index * (cardW + gap)}
          y={86}
        />
      ))}
      <PixiButton label="나중에 선택" onPress={() => closeReactOverlay(overlay.id)} width={128} x={width - PADDING - 128} y={height - 52} />
    </pixiContainer>
  );
}

export function PixiRelicChoiceModal({ overlay }: { overlay: ReactRelicChoiceOverlay }) {
  const width = 760;
  const longest = Math.max(0, ...overlay.candidates.map((relic) => estimateLines(relic.desc, 210, 12)));
  const height = Math.max(342, 292 + Math.max(0, longest - 3) * 16);
  return (
    <PixiModalShell dismissable={false} height={height} overlayId={overlay.id} width={width}>
      <RelicGridStage height={height} overlay={overlay} width={width} />
    </PixiModalShell>
  );
}

function HelpStage({ overlay }: { overlay: ReactHelpOverlay }) {
  const width = 560;
  const height = 500;
  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header title="Shortcuts" width={width} />
      {HELP_ROWS.map(([key, description], index) => {
        const y = 68 + index * 26;
        return (
          <pixiContainer key={key} y={y}>
            <pixiText
              text={key}
              x={PADDING}
              y={0}
              style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const }}
            />
            <pixiText
              text={description}
              x={170}
              y={0}
              style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 12 }}
            />
          </pixiContainer>
        );
      })}
      <pixiText
        text="Rules"
        x={PADDING}
        y={340}
        style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const }}
      />
      <pixiText
        text="Summon, merge, hidden recipes, sell, and upgrades are available during combat unless the run has ended. Locked units are protected from sell and recipe material consumption."
        x={PADDING}
        y={366}
        style={{
          fill: 0x9fb2c7,
          fontFamily: FONT,
          fontSize: 12,
          lineHeight: 17,
          wordWrap: true,
          wordWrapWidth: width - PADDING * 2,
        }}
      />
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiHelpModal({ overlay }: { overlay: ReactHelpOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={500} overlayId={overlay.id} width={560}>
      <HelpStage overlay={overlay} />
    </PixiModalShell>
  );
}

function AboutStage({ overlay }: { overlay: ReactAboutOverlay }) {
  const width = 440;
  const height = 250;
  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="Original 2D random defense MVP prototype." title="Rift Random Defense" width={width} />
      <pixiText
        text={`App v${overlay.version} / Data v${overlay.dataVersion}\nRuntime: ${overlay.runtimeLabel}`}
        x={PADDING}
        y={104}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 12, lineHeight: 20 }}
      />
      {overlay.canOpenDataDir ? (
        <PixiButton label="Open data folder" onPress={overlay.actions.openDataDir} width={150} x={142} y={height - 56} />
      ) : null}
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiAboutModal({ overlay }: { overlay: ReactAboutOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={250} overlayId={overlay.id} width={440}>
      <AboutStage overlay={overlay} />
    </PixiModalShell>
  );
}

function ConfirmStage({ overlay, height }: { overlay: ReactConfirmOverlay; height: number }) {
  const width = 430;
  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header title={overlay.title} width={width} />
      <pixiText
        text={overlay.message}
        x={PADDING}
        y={72}
        style={{
          fill: 0xeef3fa,
          fontFamily: FONT,
          fontSize: 13,
          lineHeight: 18,
          wordWrap: true,
          wordWrapWidth: width - PADDING * 2,
        }}
      />
      <PixiButton label={t("common.cancel")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 232} y={height - 56} />
      <PixiButton
        danger={overlay.danger}
        label={overlay.confirmLabel}
        onPress={() => {
          closeReactOverlay(overlay.id);
          overlay.actions.confirm();
        }}
        primary={!overlay.danger}
        width={112}
        x={width - PADDING - 112}
        y={height - 56}
      />
    </pixiContainer>
  );
}

export function PixiConfirmModal({ overlay }: { overlay: ReactConfirmOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const height = Math.max(214, 164 + estimateLines(overlay.message, 382, 13) * 18);
  return (
    <PixiModalShell dismissable height={height} overlayId={overlay.id} width={430}>
      <ConfirmStage height={height} overlay={overlay} />
    </PixiModalShell>
  );
}

function OptionSectionLabel({ label, width, y }: { label: string; width: number; y: number }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 22, width, 1).fill({ color: 0x384452, alpha: 0.82 });
  }, [width]);

  return (
    <pixiContainer x={PADDING} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        text={label}
        style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const }}
      />
    </pixiContainer>
  );
}

function SliderTrack({
  onChange,
  value,
  width,
}: {
  onChange: (value: number) => void;
  value: number;
  width: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const knobX = width * clamp01(value);
    g.clear();
    g.rect(0, 0, width, 30).fill({ color: 0x000000, alpha: 0.001 });
    g.roundRect(0, 12, width, 6, 3).fill({ color: 0x0b0f15, alpha: 0.95 });
    g.roundRect(0, 12, width * clamp01(value), 6, 3).fill({ color: 0x3f86e6, alpha: 0.95 });
    g.roundRect(0, 12, width, 6, 3).stroke({ color: hovered || dragging ? 0xbfdfff : 0x384452, width: 1, alpha: 0.9 });
    g.circle(knobX, 15, hovered || dragging ? 8 : 7).fill({ color: hovered || dragging ? 0xbfdfff : 0x8fd7ff, alpha: 1 });
    g.circle(knobX, 15, 4).fill({ color: 0x245fbd, alpha: 1 });
  }, [dragging, hovered, value, width]);

  const applyPointer = (event: PixiPointerEvent) => {
    const local = event.getLocalPosition(event.currentTarget);
    onChange(Math.round(clamp01(local.x / width) * 100) / 100);
  };

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onGlobalPointerMove={(event: FederatedPointerEvent) => {
        if (dragging) applyPointer(event as PixiPointerEvent);
      }}
      onPointerDown={(event: FederatedPointerEvent) => {
        setDragging(true);
        applyPointer(event as PixiPointerEvent);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerUp={() => setDragging(false)}
      onPointerUpOutside={() => setDragging(false)}
    >
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}

function PixiSliderRow({
  label,
  onChange,
  value,
  width,
  y,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
  width: number;
  y: number;
}) {
  const percent = Math.round(value * 100);

  return (
    <pixiContainer x={PADDING} y={y}>
      <pixiText
        text={label}
        y={7}
        style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 12, wordWrap: true, wordWrapWidth: 154 }}
      />
      <pixiContainer x={178} y={3}>
        <SliderTrack onChange={onChange} value={value} width={220} />
      </pixiContainer>
      <pixiText
        anchor={{ x: 1, y: 0 }}
        text={`${percent}%`}
        x={width}
        y={8}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 12 }}
      />
    </pixiContainer>
  );
}

function PixiToggleRow({
  label,
  onChange,
  value,
  width,
  y,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
  width: number;
  y: number;
}) {
  return (
    <pixiContainer x={PADDING} y={y}>
      <pixiText
        text={label}
        y={8}
        style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 12, wordWrap: true, wordWrapWidth: width - 116 }}
      />
      <PixiButton
        label={value ? t("common.on") : t("common.off")}
        onPress={() => onChange(!value)}
        primary={value}
        width={82}
        x={width - 82}
        y={0}
      />
    </pixiContainer>
  );
}

function PixiSegmentRow<T extends string | number>({
  active,
  items,
  label,
  onPick,
  width,
  y,
}: {
  active: T;
  items: Array<{ id: T; label: string }>;
  label: string;
  onPick: (id: T) => void;
  width: number;
  y: number;
}) {
  const gap = 8;
  const buttonW = Math.min(82, Math.floor((width - 166 - gap * (items.length - 1)) / items.length));
  const startX = width - items.length * buttonW - (items.length - 1) * gap;

  return (
    <pixiContainer x={PADDING} y={y}>
      <pixiText
        text={label}
        y={8}
        style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 12, wordWrap: true, wordWrapWidth: startX - 12 }}
      />
      {items.map((item, index) => (
        <PixiButton
          key={String(item.id)}
          label={item.label}
          onPress={() => onPick(item.id)}
          primary={item.id === active}
          width={buttonW}
          x={startX + index * (buttonW + gap)}
          y={0}
        />
      ))}
    </pixiContainer>
  );
}

function OptionsStage({ height, overlay }: { height: number; overlay: ReactOptionsOverlay }) {
  const [, setRevision] = useState(0);
  const width = 560;
  const rowW = width - PADDING * 2;
  const settings = overlay.settings;
  const rerender = () => setRevision((value) => value + 1);
  const update = (change: () => void) => {
    change();
    overlay.actions.apply();
    rerender();
  };

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="Audio / Graphics / Gameplay" title={t("options.title")} width={width} />
      <PixiSegmentRow<Locale>
        active={getLocale()}
        items={LOCALES}
        label={t("options.language")}
        onPick={(locale) => {
          overlay.actions.setLanguage(locale);
          rerender();
        }}
        width={rowW}
        y={86}
      />

      <OptionSectionLabel label={t("options.audio")} width={rowW} y={134} />
      <PixiSliderRow label={t("options.master")} value={settings.master} width={rowW} y={160} onChange={(value) => update(() => { settings.master = value; })} />
      <PixiSliderRow label={t("options.sfx")} value={settings.sfx} width={rowW} y={202} onChange={(value) => update(() => { settings.sfx = value; })} />
      <PixiSliderRow label={t("options.music")} value={settings.music} width={rowW} y={244} onChange={(value) => update(() => { settings.music = value; })} />

      <OptionSectionLabel label={t("options.graphics")} width={rowW} y={294} />
      <PixiToggleRow label={t("options.shake")} value={settings.shake} width={rowW} y={320} onChange={(value) => update(() => { settings.shake = value; })} />
      <PixiToggleRow label={t("options.highContrast")} value={settings.highContrast} width={rowW} y={362} onChange={(value) => update(() => { settings.highContrast = value; })} />
      <PixiToggleRow label={t("options.showDamage")} value={settings.showDamage} width={rowW} y={404} onChange={(value) => update(() => { settings.showDamage = value; })} />
      <pixiContainer x={PADDING} y={446}>
        <pixiText
          text={t("options.fullscreen")}
          y={8}
          style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 12, wordWrap: true, wordWrapWidth: rowW - 160 }}
        />
        <PixiButton label={t("options.fullscreenBtn")} onPress={overlay.actions.toggleFullscreen} width={142} x={rowW - 142} y={0} />
      </pixiContainer>

      <OptionSectionLabel label={t("options.gameplay")} width={rowW} y={496} />
      <PixiSegmentRow<1 | 2 | 3>
        active={settings.defaultSpeed}
        items={[1, 2, 3].map((speed) => ({ id: speed as 1 | 2 | 3, label: `x${speed}` }))}
        label={t("options.defaultSpeed")}
        onPick={(speed) => update(() => { settings.defaultSpeed = speed; })}
        width={rowW}
        y={522}
      />
      <PixiToggleRow label={t("options.autoPause")} value={settings.autoPause} width={rowW} y={564} onChange={(value) => update(() => { settings.autoPause = value; })} />

      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiOptionsModal({ overlay }: { overlay: ReactOptionsOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const height = 680;
  return (
    <PixiModalShell dismissable height={height} overlayId={overlay.id} width={560}>
      <OptionsStage height={height} overlay={overlay} />
    </PixiModalShell>
  );
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString();
}

function slotMetaText(meta: SlotMeta, includeLife?: boolean): string {
  const stage = stageById(meta.stageId ?? 1);
  const life = includeLife ? ` / Life ${meta.life}` : "";
  const version = includeLife ? ` / v${meta.dataVersion}` : "";
  return `${stage.name} / ${meta.round}R${life} / ${meta.difficulty} / seed ${meta.seed}${version} / ${formatSavedAt(meta.savedAt)}`;
}

function usePixiSlots(listSlots: () => Promise<SlotMeta[]>) {
  const [slots, setSlots] = useState<SlotMeta[] | null>(null);
  const [error, setError] = useState(false);

  const reload = () => {
    setError(false);
    void listSlots()
      .then((next) => setSlots(next))
      .catch(() => {
        setSlots([]);
        setError(true);
      });
  };

  useEffect(() => {
    reload();
  }, [listSlots]);

  return { slots, error, reload };
}

function PixiSlotCard({
  empty,
  includeLife,
  meta,
  onDelete,
  onPress,
  title,
  width,
  y,
}: {
  empty?: string;
  includeLife?: boolean;
  meta?: SlotMeta;
  onDelete?: () => void;
  onPress: () => void;
  title: string;
  width: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 66, 7).fill({ color: hovered ? 0x1e2a39 : 0x141a22, alpha: 0.96 });
    g.roundRect(0, 0, width, 66, 7).stroke({ color: hovered ? 0xbfdfff : 0x384452, width: hovered ? 2 : 1, alpha: 0.86 });
    if (onDelete) {
      g.roundRect(width - 76, 18, 58, 30, 6).fill({ color: 0x2a1820, alpha: hovered ? 1 : 0.92 });
      g.roundRect(width - 76, 18, 58, 30, 6).stroke({ color: 0xe5534b, width: 1, alpha: 0.84 });
    }
  }, [hovered, onDelete, width]);
  const metaText = meta ? slotMetaText(meta, includeLife) : (empty ?? "Empty");

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      x={PADDING}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiContainer
        cursor="pointer"
        eventMode="static"
        onPointerTap={onPress}
      >
        <pixiGraphics
          draw={(g) => {
            g.clear();
            g.rect(0, 0, width - (onDelete ? 92 : 0), 66).fill({ color: 0x000000, alpha: 0.001 });
          }}
        />
      </pixiContainer>
      <pixiText
        eventMode="none"
        text={title}
        x={14}
        y={10}
        style={{ fill: 0xeef3fa, fontFamily: FONT, fontSize: 13, fontWeight: "bold" as const }}
      />
      <pixiText
        eventMode="none"
        text={metaText}
        x={14}
        y={32}
        style={{ fill: meta ? 0x9fb2c7 : 0x657180, fontFamily: FONT, fontSize: 10, wordWrap: true, wordWrapWidth: width - (onDelete ? 108 : 28) }}
      />
      {onDelete ? (
        <pixiContainer
          cursor="pointer"
          eventMode="static"
          onPointerTap={(event: FederatedPointerEvent) => {
            event.stopPropagation();
            onDelete();
          }}
          x={width - 76}
          y={18}
        >
          <pixiGraphics
            draw={(g) => {
              g.clear();
              g.rect(0, 0, 58, 30).fill({ color: 0x000000, alpha: 0.001 });
            }}
          />
          <pixiText
            anchor={0.5}
            text="Delete"
            x={29}
            y={15}
            style={{ fill: 0xffd0d0, fontFamily: FONT, fontSize: 11, fontWeight: "bold" as const }}
          />
        </pixiContainer>
      ) : null}
    </pixiContainer>
  );
}

function SaveStage({
  height,
  overlay,
}: {
  height: number;
  overlay: ReactSaveOverlay;
}) {
  const { slots, error } = usePixiSlots(overlay.actions.listSlots);
  const width = 560;
  const rowW = width - PADDING * 2;

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle={slots === null ? "Loading slots..." : undefined} title="Save" width={width} />
      {error ? (
        <pixiText
          text="Could not read save slots."
          x={PADDING}
          y={72}
          style={{ fill: 0xe5534b, fontFamily: FONT, fontSize: 12 }}
        />
      ) : null}
      {["slot1", "slot2", "slot3"].map((slotId, index) => {
        const meta = slots?.find((item) => item.slotId === slotId);
        return (
          <PixiSlotCard
            empty="Empty"
            key={slotId}
            meta={meta}
            onPress={() => {
              void (async () => {
                if (await overlay.actions.save(slotId)) closeReactOverlay(overlay.id);
              })();
            }}
            title={`Slot ${slotId.slice(-1)}`}
            width={rowW}
            y={92 + index * 76}
          />
        );
      })}
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiSaveModal({ overlay }: { overlay: ReactSaveOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const height = 382;
  return (
    <PixiModalShell dismissable height={height} overlayId={overlay.id} width={560}>
      <SaveStage height={height} overlay={overlay} />
    </PixiModalShell>
  );
}

function LoadStage({
  height,
  overlay,
}: {
  height: number;
  overlay: ReactLoadOverlay;
}) {
  const { slots, error, reload } = usePixiSlots(overlay.actions.listSlots);
  const width = 560;
  const rowW = width - PADDING * 2;
  const autosave = slots?.find((slot) => slot.slotId === "autosave");
  const manual = slots?.filter((slot) => slot.slotId !== "autosave") ?? [];
  const autosaveCardY = 94;
  const manualSectionY = autosave ? 180 : 72;
  const manualCardY = manualSectionY + 24;

  const loadSlot = (slotId: string) => {
    void (async () => {
      if (await overlay.actions.load(slotId)) closeReactOverlay(overlay.id);
    })();
  };
  const deleteSlot = (slotId: string) => {
    void (async () => {
      await overlay.actions.delete(slotId);
      reload();
    })();
  };

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle={slots === null ? "Loading slots..." : undefined} title="Load" width={width} />
      {error ? (
        <pixiText
          text="Could not read save slots."
          x={PADDING}
          y={72}
          style={{ fill: 0xe5534b, fontFamily: FONT, fontSize: 12 }}
        />
      ) : null}
      {slots && slots.length === 0 ? (
        <pixiText
          text="No saved slots."
          x={PADDING}
          y={92}
          style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 12 }}
        />
      ) : null}
      {autosave ? (
        <>
          <OptionSectionLabel label="Autosave" width={rowW} y={72} />
          <PixiSlotCard
            includeLife
            meta={autosave}
            onDelete={() => deleteSlot(autosave.slotId)}
            onPress={() => loadSlot(autosave.slotId)}
            title="Autosave"
            width={rowW}
            y={autosaveCardY}
          />
        </>
      ) : null}
      {manual.length > 0 ? <OptionSectionLabel label="Manual slots" width={rowW} y={manualSectionY} /> : null}
      {manual.map((meta, index) => (
        <PixiSlotCard
          includeLife
          key={meta.slotId}
          meta={meta}
          onDelete={() => deleteSlot(meta.slotId)}
          onPress={() => loadSlot(meta.slotId)}
          title={`Slot ${meta.slotId.slice(-1)}`}
          width={rowW}
          y={manualCardY + index * 76}
        />
      ))}
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiLoadModal({ overlay }: { overlay: ReactLoadOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const height = 510;

  return (
    <PixiModalShell dismissable height={height} overlayId={overlay.id} width={560}>
      <LoadStage height={height} overlay={overlay} />
    </PixiModalShell>
  );
}

function wrapTextLines(text: string, maxChars: number) {
  const lines: string[] = [];
  const source = String(text || "").split(/\r?\n/);
  for (const raw of source) {
    if (!raw) {
      lines.push(" ");
      continue;
    }
    let remaining = raw;
    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars + 1);
      const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\t"));
      const index = breakAt > Math.floor(maxChars * 0.45) ? breakAt : maxChars;
      lines.push(remaining.slice(0, index).trimEnd());
      remaining = remaining.slice(index).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

function PagedLineBox({
  height,
  lines,
  lineHeight = 15,
  width,
  x,
  y,
}: {
  height: number;
  lines: string[];
  lineHeight?: number;
  width: number;
  x: number;
  y: number;
}) {
  const [page, setPage] = useState(0);
  const pageSize = Math.max(1, Math.floor((height - 42) / lineHeight));
  const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * pageSize;
  const visible = lines.slice(start, start + pageSize);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 7).fill({ color: 0x0b0f15, alpha: 0.72 });
    g.roundRect(0, 0, width, height, 7).stroke({ color: 0x384452, width: 1, alpha: 0.86 });
    g.rect(0, height - 36, width, 1).fill({ color: 0x384452, alpha: 0.72 });
  }, [height, width]);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      {visible.map((line, index) => (
        <pixiText
          eventMode="none"
          key={`${start + index}-${line}`}
          text={line}
          x={10}
          y={8 + index * lineHeight}
          style={{
            fill: 0xc7d2df,
            fontFamily: "Consolas, Cascadia Mono, monospace",
            fontSize: 10,
            lineHeight,
            wordWrap: true,
            wordWrapWidth: width - 20,
          }}
        />
      ))}
      <pixiText
        text={`Page ${currentPage + 1}/${pageCount} - ${lines.length} lines`}
        x={10}
        y={height - 26}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 11 }}
      />
      <PixiButton label="Prev" onPress={() => setPage(Math.max(0, currentPage - 1))} width={70} x={width - 154} y={height - 32} />
      <PixiButton label="Next" onPress={() => setPage(Math.min(pageCount - 1, currentPage + 1))} width={70} x={width - 78} y={height - 32} />
    </pixiContainer>
  );
}

function ActionPager({
  actions,
  columns = 3,
  pageSize = 6,
  width,
  x,
  y,
}: {
  actions: Array<{ danger?: boolean; label: string; onPress: () => void; primary?: boolean }>;
  columns?: number;
  pageSize?: number;
  width: number;
  x: number;
  y: number;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(actions.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = actions.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const gap = 8;
  const buttonW = Math.floor((width - gap * (columns - 1)) / columns);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  return (
    <pixiContainer x={x} y={y}>
      {visible.map((action, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        return (
          <PixiButton
            danger={action.danger}
            key={`${action.label}-${index}`}
            label={action.label}
            onPress={action.onPress}
            primary={action.primary}
            width={buttonW}
            x={col * (buttonW + gap)}
            y={row * 42}
          />
        );
      })}
      {pageCount > 1 ? (
        <>
          <pixiText
            text={`Actions ${currentPage + 1}/${pageCount}`}
            x={0}
            y={Math.ceil(pageSize / columns) * 42 + 9}
            style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 11 }}
          />
          <PixiButton label="Prev" onPress={() => setPage(Math.max(0, currentPage - 1))} width={70} x={width - 154} y={Math.ceil(pageSize / columns) * 42} />
          <PixiButton label="Next" onPress={() => setPage(Math.min(pageCount - 1, currentPage + 1))} width={70} x={width - 78} y={Math.ceil(pageSize / columns) * 42} />
        </>
      ) : null}
    </pixiContainer>
  );
}

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    pushToast(okMessage, "ok");
  } catch {
    pushToast("Copy failed.", "warn");
  }
}

function CollectionCard({
  entry,
  width,
  x,
  y,
}: {
  entry:
    | { kind: "unit"; grade: Grade; seen: boolean; unit: UnitDef }
    | { id: string; kind: "recipe"; resultUnitId: string };
  width: number;
  x: number;
  y: number;
}) {
  const isUnit = entry.kind === "unit";
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 74, 7).fill({ color: isUnit && entry.seen ? 0x141a22 : 0x10151d, alpha: 0.96 });
    g.roundRect(0, 0, width, 74, 7).stroke({ color: isUnit ? hexColor(GRADE_COLOR[entry.grade]) : 0xe7b53e, width: 1, alpha: isUnit && !entry.seen ? 0.46 : 0.82 });
    if (isUnit) {
      g.circle(18, 24, 10).fill({ color: entry.seen ? hexColor(FAMILY_COLOR[entry.unit.family]) : 0x222633, alpha: 0.95 });
      g.circle(18, 24, 12).stroke({ color: entry.seen ? hexColor(GRADE_COLOR[entry.unit.grade]) : 0x333a4f, width: 2, alpha: 0.9 });
    } else {
      g.roundRect(8, 12, 22, 22, 5).fill({ color: 0x2b2415, alpha: 0.95 });
      g.roundRect(8, 12, 22, 22, 5).stroke({ color: 0xe7b53e, width: 1, alpha: 0.86 });
    }
  }, [entry, isUnit, width]);

  const title = isUnit ? (entry.seen ? entry.unit.name : "???") : `Hidden recipe ${entry.id}`;
  const meta = isUnit
    ? entry.seen
      ? `${GRADE_LABEL[entry.grade]} / ${FAMILY_LABEL[entry.unit.family]} / ${entry.unit.roles.map((role) => ROLE_LABEL[role]).join("/")} / ATK ${entry.unit.attack} / SPD ${entry.unit.attackSpeed}`
      : `${GRADE_LABEL[entry.grade]} / undiscovered`
    : `Result: ${entry.resultUnitId}`;
  const desc = isUnit
    ? entry.seen
      ? entry.unit.desc || entry.unit.skills?.map((skill) => skill.name).join(", ") || ""
      : "Not discovered yet."
    : "Found hidden combination.";

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={title}
        x={40}
        y={8}
        style={{ fill: isUnit && !entry.seen ? 0x7f8b98 : 0xeef3fa, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const, wordWrap: true, wordWrapWidth: width - 50 }}
      />
      <pixiText
        eventMode="none"
        text={meta}
        x={40}
        y={28}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 9, wordWrap: true, wordWrapWidth: width - 50 }}
      />
      <pixiText
        eventMode="none"
        text={desc}
        x={40}
        y={48}
        style={{ fill: 0x7f8b98, fontFamily: FONT, fontSize: 9, wordWrap: true, wordWrapWidth: width - 50 }}
      />
    </pixiContainer>
  );
}

function CollectionStage({ overlay }: { overlay: ReactCollectionOverlay }) {
  const [page, setPage] = useState(0);
  const width = 760;
  const height = 650;
  const hiddenTotal = RECIPES.filter((recipe) => recipe.visibility === "hidden").length;
  const entries: Array<
    | { kind: "unit"; grade: Grade; seen: boolean; unit: UnitDef }
    | { id: string; kind: "recipe"; resultUnitId: string }
  > = [
    ...overlay.unitsByGrade.flatMap(({ grade, units }) => units.map(({ unit, seen }) => ({ kind: "unit" as const, grade: grade as Grade, seen, unit }))),
    ...overlay.hiddenRecipes.map((recipe) => ({ kind: "recipe" as const, id: recipe.id, resultUnitId: recipe.resultUnitId })),
  ];
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = entries.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle={`Runs ${overlay.profile.runs} / Best ${overlay.profile.bestRound > 0 ? `${overlay.profile.bestRound}R` : "-"} / Stage ${FINAL_STAGE}/${FINAL_STAGE}`} title={t("menu.collection")} width={width} />
      <pixiText
        text={`Units ${overlay.profile.seenUnits.length}/${UNITS.length} / Hidden recipes ${overlay.profile.foundHiddenRecipes.length}/${hiddenTotal}`}
        x={PADDING}
        y={74}
        style={{ fill: 0xf6d365, fontFamily: FONT, fontSize: 12 }}
      />
      {DIFFICULTIES.map((difficulty, index) => (
        <pixiText
          key={difficulty.id}
          text={`${difficulty.name}: ${overlay.profile.clears[difficulty.id] ?? 0}`}
          x={PADDING + (index % 5) * 138}
          y={100}
          style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 10 }}
        />
      ))}
      {visible.map((entry, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        return (
          <CollectionCard
            entry={entry}
            key={entry.kind === "unit" ? entry.unit.id : entry.id}
            width={346}
            x={PADDING + col * 358}
            y={132 + row * 82}
          />
        );
      })}
      <pixiText
        text={`Page ${currentPage + 1}/${pageCount}`}
        x={PADDING}
        y={height - 44}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 12 }}
      />
      <PixiButton label="Prev" onPress={() => setPage(Math.max(0, currentPage - 1))} width={84} x={width - PADDING - 308} y={height - 56} />
      <PixiButton label="Next" onPress={() => setPage(Math.min(pageCount - 1, currentPage + 1))} width={84} x={width - PADDING - 216} y={height - 56} />
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiCollectionModal({ overlay }: { overlay: ReactCollectionOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={650} overlayId={overlay.id} width={760}>
      <CollectionStage overlay={overlay} />
    </PixiModalShell>
  );
}

function SimulationStage({ overlay }: { overlay: ReactSimulationOverlay }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("Ready.");
  const width = 700;
  const height = 520;
  const canSave = !running && output !== "Ready." && output !== "Running...";

  const run = async () => {
    if (running) return;
    setRunning(true);
    setOutput("Running...");
    try {
      setOutput(await overlay.actions.run());
    } finally {
      setRunning(false);
    }
  };
  const save = async () => {
    if (!canSave) return;
    try {
      const path = await overlay.actions.save(output);
      pushToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushToast("Save failed.", "danger");
    }
  };

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="Runs the current data version through 100 auto-play seeds." title="Auto Simulation (100 seeds)" width={width} />
      <PagedLineBox height={336} lines={wrapTextLines(output, 104)} width={width - PADDING * 2} x={PADDING} y={82} />
      <PixiButton primary label={running ? "Running..." : "Run"} onPress={() => void run()} width={112} x={PADDING} y={height - 56} />
      <PixiButton label="Save report" onPress={() => void save()} width={132} x={PADDING + 122} y={height - 56} />
      <PixiButton label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiSimulationModal({ overlay }: { overlay: ReactSimulationOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={520} overlayId={overlay.id} width={700}>
      <SimulationStage overlay={overlay} />
    </PixiModalShell>
  );
}

function BalanceGateStage({ overlay }: { overlay: ReactBalanceGateOverlay }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("Ready.");
  const [result, setResult] = useState<{ markdown: string; json: string } | null>(null);
  const width = 720;
  const height = 540;

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setOutput("Running...");
    try {
      const next = await overlay.actions.run(setOutput);
      setResult(next);
      setOutput(next.markdown);
    } finally {
      setRunning(false);
    }
  };
  const saveMarkdown = async () => {
    if (!result) return;
    try {
      const path = await overlay.actions.saveMarkdown(result.markdown);
      pushToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushToast("Save failed.", "danger");
    }
  };
  const saveJson = async () => {
    if (!result) return;
    try {
      const path = await overlay.actions.saveJson(result.json);
      pushToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushToast("Save failed.", "danger");
    }
  };

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="Runs the full 30-seed automatic balance gate across all configured scenarios." title="5-Difficulty Balance Gate" width={width} />
      <PagedLineBox height={348} lines={wrapTextLines(output, 108)} width={width - PADDING * 2} x={PADDING} y={82} />
      <PixiButton primary label={running ? "Running..." : "Run"} onPress={() => void run()} width={112} x={PADDING} y={height - 56} />
      <PixiButton label="Save MD" onPress={() => void saveMarkdown()} width={112} x={PADDING + 122} y={height - 56} />
      <PixiButton label="Save JSON" onPress={() => void saveJson()} width={122} x={PADDING + 244} y={height - 56} />
      <PixiButton label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiBalanceGateModal({ overlay }: { overlay: ReactBalanceGateOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={540} overlayId={overlay.id} width={720}>
      <BalanceGateStage overlay={overlay} />
    </PixiModalShell>
  );
}

function commandActions(groups: Array<{ commands: ReactResultCommand[]; label: string }>) {
  return groups.flatMap((group) => group.commands.map((command) => ({
    label: `${group.label}: ${command.label}`.slice(0, 28),
    onPress: () => void copyText(command.text, command.okMessage),
  })));
}

function manualProofLines(overlay: ReactManualProofOverlay) {
  const lines: string[] = [
    "Manual Proof Guide",
    overlay.intro.text,
    "",
    `DATA_VERSION ${overlay.dataVersion}`,
  ];
  for (const section of overlay.sections) {
    lines.push("", section.title);
    if (section.note) lines.push(section.note.text);
    for (const command of section.commands) lines.push(`$ ${command}`);
  }
  if (overlay.currentTarget) {
    lines.push(
      "",
      "Current target status",
      `Difficulty: ${overlay.currentTarget.difficulty}`,
      `Legend / hidden: ${overlay.currentTarget.legends}`,
      `Target: ${overlay.currentTarget.label}`,
      `Condition: ${overlay.currentTarget.status}`,
      overlay.currentTarget.note,
    );
  }
  if (overlay.finishReadiness) {
    lines.push("", "Current finish readiness", overlay.finishReadiness.ready
      ? "Current run meets the minimum manual proof save requirements."
      : `Not ready: ${overlay.finishReadiness.blockers.join(", ")}`);
  }
  lines.push("", "Workflow", ...overlay.workflow.map((step, index) => `${index + 1}. ${step}`));
  lines.push("", "Result fields", ...overlay.resultFields.map((row) => `${row.field}: ${row.source} -> ${row.value}`));
  lines.push("", "Required target sessions", ...overlay.balanceTargets.map((row) => `${row.difficulty}: ${row.target} / ${row.length}`));
  lines.push("", "Required boundary observations", ...overlay.balanceObservations.map((row) => `${row.difficulty}: ${row.target} / ${row.length}`));
  for (const group of overlay.commandGroups) {
    lines.push("", `Commands - ${group.label}`);
    for (const command of group.commands) lines.push(`${command.label}: ${command.text}`);
  }
  return wrapTextLines(lines.join("\n"), 108);
}

function ManualProofStage({ overlay }: { overlay: ReactManualProofOverlay }) {
  const width = 760;
  const height = 650;
  const actions = commandActions(overlay.commandGroups);

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="Guide, current target, evidence fields, and copy tools." title="Manual Proof Guide" width={width} />
      <PagedLineBox height={390} lines={manualProofLines(overlay)} width={width - PADDING * 2} x={PADDING} y={82} />
      <ActionPager actions={actions} columns={3} pageSize={6} width={width - PADDING * 2 - 130} x={PADDING} y={height - 126} />
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiManualProofModal({ overlay }: { overlay: ReactManualProofOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={650} overlayId={overlay.id} width={760}>
      <ManualProofStage overlay={overlay} />
    </PixiModalShell>
  );
}

function resultLines(overlay: ReactResultOverlay) {
  const summary = overlay.summary;
  const proofPassed = overlay.proofChecks.every((check) => check.ok);
  const lines = [
    summary.cleared ? "Final boss cleared" : `Defeated at round ${summary.reachedRound}`,
    proofPassed ? `Manual proof complete: ${overlay.proofTarget}` : `Manual proof incomplete: ${overlay.proofTarget}`,
    "",
    `Seed: ${summary.seed}`,
    `Stage: ${summary.stageId}. ${summary.stageName}`,
    `Difficulty: ${summary.difficulty}`,
    `Best grade: ${GRADE_LABEL[summary.maxGrade]}`,
    `Legend / hidden: ${summary.legendCount} / ${summary.hiddenCount}`,
    `Play time: ${((summary.wallSeconds ?? 0) / 60).toFixed(1)}m`,
    `Missions: ${summary.missionsDone}/${summary.missionsTotal}`,
    `Craft / merge: ${summary.craftCount} / ${summary.merge3Count}`,
    `Pity: ${String(summary.pityTriggered)}`,
    "",
    "Top dealers",
    ...(summary.topDealers.length > 0
      ? summary.topDealers.map((dealer) => `${dealer.name} (${GRADE_LABEL[dealer.grade]}): ${dealer.damage.toLocaleString()}`)
      : ["None"]),
    "",
    "Manual proof checklist",
    ...overlay.proofChecks.map((check) => `${check.ok ? "OK" : "Missing"} - ${check.label}: ${check.detail}`),
  ];
  if (summary.failHint) lines.push("", summary.failHint);
  for (const group of overlay.commandGroups) {
    lines.push("", `Commands - ${group.label}`);
    for (const command of group.commands) lines.push(`${command.label}: ${command.text}`);
  }
  return wrapTextLines(lines.join("\n"), 108);
}

function ResultStage({ overlay }: { overlay: ReactResultOverlay }) {
  const width = 760;
  const height = 650;
  const summary = overlay.summary;
  const proofPassed = overlay.proofChecks.every((check) => check.ok);
  const reportActions = [
    {
      label: "Report MD",
      onPress: () => void (async () => {
        try {
          const path = await overlay.actions.exportReport();
          pushToast(`Saved ${path}`, "ok", 4000);
        } catch {
          pushToast("Report save failed.", "danger");
        }
      })(),
    },
    {
      label: overlay.exportJsonLabel,
      onPress: () => void (async () => {
        try {
          const path = await overlay.actions.exportJson();
          pushToast(`Saved ${path}`, "ok", 4000);
        } catch {
          pushToast("JSON save failed.", "danger");
        }
      })(),
    },
    {
      label: overlay.copyJsonLabel,
      onPress: () => void copyText(overlay.manualResultJson, overlay.copyJsonOkMessage),
    },
    ...commandActions(overlay.commandGroups),
  ];

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} reward={summary.cleared} />
      <Header
        subtitle={proofPassed ? `Manual proof complete: ${overlay.proofTarget}` : `Manual proof incomplete: ${overlay.proofTarget}`}
        title={summary.cleared ? "Final boss cleared" : `Defeated at round ${summary.reachedRound}`}
        width={width}
      />
      <PagedLineBox height={326} lines={resultLines(overlay)} width={width - PADDING * 2} x={PADDING} y={86} />
      <ActionPager actions={reportActions} columns={3} pageSize={6} width={width - PADDING * 2} x={PADDING} y={424} />
      <PixiButton label="Title" onPress={() => { closeReactOverlay(overlay.id); overlay.actions.toTitle(); }} width={112} x={PADDING} y={height - 56} />
      <PixiButton label="Same seed" onPress={() => { closeReactOverlay(overlay.id); overlay.actions.restartSeed(); }} width={112} x={PADDING + 122} y={height - 56} />
      <PixiButton primary label="New run" onPress={() => { closeReactOverlay(overlay.id); overlay.actions.newRun(); }} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiResultModal({ overlay }: { overlay: ReactResultOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable={false} height={650} overlayId={overlay.id} width={760}>
      <ResultStage overlay={overlay} />
    </PixiModalShell>
  );
}

function upgradeEffectText(stat: string, effectPerLevel: number, level: number) {
  if (stat === "killGold") return `5 kills +${level} gold -> +${level + 1} gold`;
  return `+${Math.round(effectPerLevel * 100 * level)}% -> +${Math.round(effectPerLevel * 100 * (level + 1))}%`;
}

function UpgradeRow({
  canBuy,
  costText,
  effect,
  familyColor,
  levelText,
  name,
  onBuy,
  width,
  y,
}: {
  canBuy: boolean;
  costText: string;
  effect: string;
  familyColor: number;
  levelText: string;
  name: string;
  onBuy: () => void;
  width: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 46, 7).fill({ color: hovered && canBuy ? 0x1e2a39 : 0x141a22, alpha: 0.94 });
    g.roundRect(0, 0, width, 46, 7).stroke({ color: hovered && canBuy ? 0xbfdfff : 0x384452, width: hovered && canBuy ? 2 : 1, alpha: 0.82 });
    g.circle(15, 23, 6).fill({ color: familyColor, alpha: canBuy ? 0.9 : 0.42 });
    g.roundRect(width - 82, 8, 68, 30, 6).fill({ color: canBuy ? 0x245fbd : 0x1b2029, alpha: canBuy ? 0.96 : 0.62 });
    g.roundRect(width - 82, 8, 68, 30, 6).stroke({ color: canBuy ? 0x3f86e6 : 0x384452, width: 1, alpha: 0.8 });
  }, [canBuy, familyColor, hovered, width]);

  return (
    <pixiContainer
      cursor={canBuy ? "pointer" : "default"}
      eventMode={canBuy ? "static" : "none"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={() => {
        if (canBuy) onBuy();
      }}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        text={`${name} - ${levelText}`}
        x={30}
        y={8}
        style={{
          fill: canBuy ? 0xeef3fa : 0x7f8b98,
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - 124,
        }}
      />
      <pixiText
        text={effect}
        x={30}
        y={26}
        style={{
          fill: canBuy ? 0x9fb2c7 : 0x657180,
          fontFamily: FONT,
          fontSize: 10,
          wordWrap: true,
          wordWrapWidth: width - 124,
        }}
      />
      <pixiText
        anchor={0.5}
        text={costText}
        x={width - 48}
        y={23}
        style={{
          fill: canBuy ? 0xffffff : 0x7f8b98,
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function UpgradeStage({ overlay }: { overlay: ReactUpgradeOverlay }) {
  const runtime = useSyncExternalStore(subscribeRuntimeSnapshot, getRuntimeSnapshot, getRuntimeSnapshot);
  const state = runtime?.state;
  const width = 560;
  const height = 446;
  const rowW = width - PADDING * 2;

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle={`Gold: ${state?.gold ?? 0}`} title="Family upgrades" width={width} />
      {UPGRADES.map((upgrade, index) => {
        const level = state?.upgrades[upgrade.id] ?? 0;
        const cost = upgradeCost(upgrade, level);
        const maxed = level >= upgrade.maxLevel;
        const canBuy = !!state && !maxed && state.gold >= cost;
        return (
          <UpgradeRow
            canBuy={canBuy}
            costText={maxed ? "Max" : `${cost}G`}
            effect={upgradeEffectText(upgrade.stat, upgrade.effectPerLevel, level)}
            familyColor={hexColor(FAMILY_COLOR[upgrade.family])}
            key={upgrade.id}
            levelText={`Lv.${level}/${upgrade.maxLevel}`}
            name={upgrade.name}
            onBuy={() => overlay.actions.buy(upgrade.id)}
            width={rowW}
            y={78 + index * 52}
          />
        );
      })}
      <PixiButton primary label={t("common.close")} onPress={() => closeReactOverlay(overlay.id)} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiUpgradeModal({ overlay }: { overlay: ReactUpgradeOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  return (
    <PixiModalShell dismissable height={446} overlayId={overlay.id} width={560}>
      <UpgradeStage overlay={overlay} />
    </PixiModalShell>
  );
}

function DifficultyButton({
  active,
  difficulty,
  onPress,
  width,
  x,
  y,
}: {
  active: boolean;
  difficulty: (typeof DIFFICULTIES)[number];
  onPress: () => void;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 76, 7).fill({ color: active ? 0x253c63 : hovered ? 0x1e2a39 : 0x141a22, alpha: 0.96 });
    g.roundRect(0, 0, width, 76, 7).stroke({ color: active ? 0xe7b53e : hovered ? 0xbfdfff : 0x384452, width: active || hovered ? 2 : 1, alpha: 0.9 });
  }, [active, hovered, width]);

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
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        eventMode="none"
        text={difficulty.name}
        x={width / 2}
        y={10}
        style={{
          align: "center" as const,
          fill: active ? 0xfff0bf : 0xeef3fa,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - 12,
        }}
      />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        eventMode="none"
        text={`Cap ${difficulty.unitCap} / HP x${difficulty.enemyHpMult}\nLimit ${difficulty.enemyLimit} / ${difficulty.startGold}G`}
        x={width / 2}
        y={34}
        style={{
          align: "center" as const,
          fill: 0x9fb2c7,
          fontFamily: FONT,
          fontSize: 10,
          lineHeight: 13,
          wordWrap: true,
          wordWrapWidth: width - 12,
        }}
      />
    </pixiContainer>
  );
}

function StagePreview({ stage, width }: { stage: StageDef; width: number }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const previewW = width - 14;
    const previewH = 30;
    const scaleX = previewW / 960;
    const scaleY = previewH / 560;
    g.clear();
    g.roundRect(0, 0, previewW, previewH, 5).fill({ color: 0x0b0f15, alpha: 0.9 });
    g.roundRect(0, 0, previewW, previewH, 5).stroke({ color: 0x384452, width: 1, alpha: 0.65 });
    g.moveTo(stage.waypoints[0][0] * scaleX, stage.waypoints[0][1] * scaleY);
    for (const [x, y] of stage.waypoints.slice(1)) {
      g.lineTo(x * scaleX, y * scaleY);
    }
    g.stroke({ color: 0xe7b53e, width: 2, alpha: 0.92 });
    const start = stage.waypoints[0];
    const end = stage.waypoints[stage.waypoints.length - 1];
    g.circle(start[0] * scaleX, start[1] * scaleY, 3).fill({ color: 0x8fd7ff, alpha: 0.95 });
    g.circle(end[0] * scaleX, end[1] * scaleY, 3).fill({ color: 0xe5534b, alpha: 0.95 });
  }, [stage, width]);

  return <pixiGraphics draw={draw} x={7} y={30} />;
}

function StageButton({
  active,
  onPress,
  stage,
  width,
  x,
  y,
}: {
  active: boolean;
  onPress: () => void;
  stage: StageDef;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 90, 7).fill({ color: active ? 0x243450 : hovered ? 0x1e2a39 : 0x141a22, alpha: 0.96 });
    g.roundRect(0, 0, width, 90, 7).stroke({ color: active ? 0xe7b53e : hovered ? 0xbfdfff : 0x384452, width: active || hovered ? 2 : 1, alpha: 0.9 });
    if (active) g.circle(width - 14, 14, 5).fill({ color: 0xe7b53e, alpha: 0.95 });
  }, [active, hovered, width]);

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
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={`STAGE ${stage.id}`}
        x={8}
        y={8}
        style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 9, fontWeight: "bold" as const }}
      />
      <StagePreview stage={stage} width={width} />
      <pixiText
        eventMode="none"
        text={stage.name}
        x={8}
        y={64}
        style={{
          fill: 0xeef3fa,
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: width - 16,
        }}
      />
      <pixiText
        eventMode="none"
        text={stage.subtitle}
        x={8}
        y={78}
        style={{
          fill: 0x9fb2c7,
          fontFamily: FONT,
          fontSize: 9,
          wordWrap: true,
          wordWrapWidth: width - 16,
        }}
      />
    </pixiContainer>
  );
}

function NewRunStage({
  difficultyId,
  onCancel,
  onDifficulty,
  onStage,
  onStart,
  overlay,
  stageId,
}: {
  difficultyId: DifficultyId;
  onCancel: () => void;
  onDifficulty: (difficultyId: DifficultyId) => void;
  onStage: (stageId: number) => void;
  onStart: () => void;
  overlay: ReactNewRunOverlay;
  stageId: number;
}) {
  const width = 820;
  const height = 650;
  const diffW = 145;
  const diffGap = 8;
  const stageW = 146;
  const stageGap = 8;
  const selectedDifficulty = DIFFICULTIES.find((difficulty) => difficulty.id === difficultyId) ?? DIFFICULTIES[0];

  return (
    <pixiContainer>
      <PanelBg height={height} width={width} />
      <Header subtitle="난이도와 이번 런의 고정 맵을 선택하세요." title="새 게임" width={width} />
      <pixiText
        text="난이도"
        x={PADDING}
        y={80}
        style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const }}
      />
      {DIFFICULTIES.map((difficulty, index) => (
        <DifficultyButton
          active={difficulty.id === difficultyId}
          difficulty={difficulty}
          key={difficulty.id}
          onPress={() => onDifficulty(difficulty.id)}
          width={diffW}
          x={PADDING + index * (diffW + diffGap)}
          y={104}
        />
      ))}
      <pixiText
        text={`수동 목표: ${MANUAL_TARGET_HINTS[difficultyId] ?? "-"} / 시작 생명 ${selectedDifficulty.startLife}`}
        x={PADDING}
        y={188}
        style={{ fill: 0xf6d365, fontFamily: FONT, fontSize: 11, wordWrap: true, wordWrapWidth: width - PADDING * 2 }}
      />
      <pixiText
        text="이번 런 고정 맵 선택"
        x={PADDING}
        y={220}
        style={{ fill: 0x8fd7ff, fontFamily: FONT, fontSize: 12, fontWeight: "bold" as const }}
      />
      <pixiText
        text={`전체 ${STAGES.length}개 맵을 자유롭게 선택할 수 있습니다. 선택한 맵 하나로 1R부터 40R 최종 보스까지 진행합니다.`}
        x={PADDING}
        y={244}
        style={{ fill: 0x9fb2c7, fontFamily: FONT, fontSize: 11, wordWrap: true, wordWrapWidth: width - PADDING * 2 }}
      />
      {STAGES.map((stage, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        return (
          <StageButton
            active={stage.id === stageId}
            key={stage.id}
            onPress={() => onStage(stage.id)}
            stage={stage}
            width={stageW}
            x={PADDING + col * (stageW + stageGap)}
            y={276 + row * 98}
          />
        );
      })}
      {overlay.dismissable ? (
        <PixiButton label={t("common.cancel")} onPress={onCancel} width={112} x={width - PADDING - 232} y={height - 56} />
      ) : null}
      <PixiButton primary label="시작" onPress={onStart} width={112} x={width - PADDING - 112} y={height - 56} />
    </pixiContainer>
  );
}

export function PixiNewRunModal({ overlay }: { overlay: ReactNewRunOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DIFFICULTIES[0]?.id ?? "novice");
  const [stageId, setStageId] = useState(overlay.initialStageId);

  return (
    <PixiModalShell dismissable={overlay.dismissable} height={650} overlayId={overlay.id} width={820}>
      <NewRunStage
        difficultyId={difficultyId}
        onCancel={() => closeReactOverlay(overlay.id)}
        onDifficulty={setDifficultyId}
        onStage={setStageId}
        onStart={() => {
          closeReactOverlay(overlay.id);
          overlay.actions.start(difficultyId, stageId);
        }}
        overlay={overlay}
        stageId={stageId}
      />
    </PixiModalShell>
  );
}
