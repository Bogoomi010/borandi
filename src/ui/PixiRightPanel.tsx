import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { bossOutlook } from "../core/advisor";
import type { GameState, MissionState } from "../core/types";
import { GRADE_LABEL } from "../core/types";
import { MISSION_BY_ID } from "../data/missions";
import { RELIC_BY_ID } from "../data/relics";
import { getRuntimeControls, type RuntimeSnapshot } from "../runtimeBridge";
import type { RightTab } from "../runtimeContext";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const TAB_H = 32;
const GAP = 8;
const PANEL_MIN_H = 120;

interface PixiRightPanelProps {
  runtime: RuntimeSnapshot | null;
}

const TABS: Array<{ id: RightTab; label: string }> = [
  { id: "mission", label: "미션" },
  { id: "boss", label: "보스" },
  { id: "log", label: "로그" },
];

function usePanelSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, viewportHeight: PANEL_MIN_H });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let raf = 0;
    let frames = 0;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      const parentRect = element.parentElement?.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        viewportHeight: Math.max(PANEL_MIN_H, Math.round(parentRect?.height ?? rect.height)),
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
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return { ref, size };
}

function estimateTextLines(text: string, width: number, fontSize = 11) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.72)));
  return Math.max(1, Math.ceil(Array.from(text).length / charsPerLine));
}

function missionBadge(state: GameState) {
  return state.missions.some((mission) => {
    if (mission.status !== "active") return false;
    const def = MISSION_BY_ID[mission.defId];
    return def.visibility === "visible" && def.expireRound !== undefined && def.expireRound - state.round <= 2;
  });
}

function bossBadge(state: GameState) {
  const outlook = bossOutlook(state);
  return !!outlook && outlook.roundsLeft <= 2;
}

function missionRewardText(mission: MissionState) {
  const def = MISSION_BY_ID[mission.defId];
  const rewards: string[] = [];
  if (def.reward.gold) rewards.push(`${def.reward.gold}골드`);
  if (def.reward.selector) rewards.push(`${GRADE_LABEL[def.reward.selector.grade]} 선택권`);
  if (def.reward.bossSlowResistReduction) rewards.push("보스 감속 저항 감소");
  if (def.reward.bossKillBonusGold) rewards.push(`보스 보너스 ${def.reward.bossKillBonusGold.gold}골드`);
  return rewards.join(", ");
}

function visibleMissions(state: GameState) {
  const order = { active: 0, done: 1, expired: 2 } as const;
  return [...state.missions]
    .sort((a, b) => order[a.status] - order[b.status])
    .filter((mission) => {
      const def = MISSION_BY_ID[mission.defId];
      return def.visibility !== "hidden" || mission.status === "done";
    });
}

function missionStatusLabel(mission: MissionState) {
  const def = MISSION_BY_ID[mission.defId];
  if (mission.status === "done") return "완료";
  if (mission.status === "expired") return "만료";
  return def.expireRound !== undefined ? `~${def.expireRound}R` : "";
}

function missionName(mission: MissionState) {
  const def = MISSION_BY_ID[mission.defId];
  return mission.status === "done" && def.visibility === "hidden"
    ? `[히든] ${def.desc.replace("(히든) ", "")}`
    : def.name;
}

function missionCardHeight(runtime: RuntimeSnapshot, mission: MissionState, width: number) {
  const def = MISSION_BY_ID[mission.defId];
  const inner = Math.max(120, width - 22);
  const descLines = estimateTextLines(def.desc, inner, 11);
  const rewardLines = estimateTextLines(`보상: ${missionRewardText(mission)}`, inner, 11);
  return 52 + descLines * 14 + rewardLines * 14 + (mission.status === "active" ? 15 : 0);
}

function relicRowHeight(desc: string, width: number) {
  return 36 + estimateTextLines(desc, Math.max(100, width - 58), 11) * 13;
}

function contentHeight(runtime: RuntimeSnapshot, width: number) {
  const inner = Math.max(220, width);
  let height = TAB_H + GAP + 8;

  if (runtime.activeTab === "mission") {
    const missions = visibleMissions(runtime.state);
    if (missions.length === 0) return height + 32;
    return height + missions.reduce((sum, mission) => sum + missionCardHeight(runtime, mission, inner) + GAP, 0);
  }

  if (runtime.activeTab === "boss") {
    const outlook = bossOutlook(runtime.state);
    height += outlook ? 132 : 30;
    const bossRecords = Object.keys(runtime.state.bossKillSeconds).length;
    if (bossRecords > 0) height += 30 + bossRecords * 20;
    if (runtime.state.relicIds.length > 0 || runtime.state.pendingRelicChoices.length > 0) {
      height += 30;
      if (runtime.state.relicIds.length === 0) height += 24;
      for (const id of runtime.state.relicIds) {
        const relic = RELIC_BY_ID[id];
        if (relic) height += relicRowHeight(relic.desc, inner) + 6;
      }
      if (runtime.state.pendingRelicChoices.length > 0) height += 40;
    }
    return height + 10;
  }

  return height + Math.max(28, runtime.state.log.slice(-60).length * 18) + 10;
}

function TabButton({
  active,
  badge,
  label,
  onPress,
  width,
  x,
}: {
  active: boolean;
  badge: boolean;
  label: string;
  onPress: () => void;
  width: number;
  x: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, TAB_H, 6).fill({ color: active ? 0x245fbd : hovered ? 0x1b2633 : 0x151b24, alpha: 0.94 });
    g.roundRect(0, 0, width, TAB_H, 6).stroke({ color: active ? 0x3f86e6 : hovered ? 0x6fb8ff : 0x384452, width: active || hovered ? 2 : 1, alpha: 0.9 });
    if (badge) {
      g.circle(width - 10, 8, 3).fill({ color: 0xe5534b, alpha: 1 });
      g.circle(width - 10, 8, 5).stroke({ color: 0xe5534b, width: 1, alpha: 0.5 });
    }
  }, [active, badge, hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPress}
      x={x}
      y={0}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        eventMode="none"
        text={label}
        x={width / 2}
        y={TAB_H / 2}
        style={{
          fill: active ? 0xffffff : 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function Tabs({ runtime, width }: { runtime: RuntimeSnapshot; width: number }) {
  const controls = getRuntimeControls();
  const badges: Record<RightTab, boolean> = {
    mission: missionBadge(runtime.state),
    boss: bossBadge(runtime.state),
    log: false,
  };
  const gap = 4;
  const tabWidth = Math.max(54, Math.floor((width - gap * (TABS.length - 1)) / TABS.length));

  return (
    <pixiContainer>
      {TABS.map((tab, index) => (
        <TabButton
          active={runtime.activeTab === tab.id}
          badge={badges[tab.id]}
          key={tab.id}
          label={tab.label}
          onPress={() => controls?.setActiveTab(tab.id)}
          width={tabWidth}
          x={index * (tabWidth + gap)}
        />
      ))}
    </pixiContainer>
  );
}

function MissionCard({
  height,
  mission,
  runtime,
  width,
  y,
}: {
  height: number;
  mission: MissionState;
  runtime: RuntimeSnapshot;
  width: number;
  y: number;
}) {
  const def = MISSION_BY_ID[mission.defId];
  const statusColor = mission.status === "done" ? 0x4fd18b : mission.status === "expired" ? 0x596575 : 0x8fd7ff;
  const reward = `보상: ${missionRewardText(mission)}`;
  const descLines = estimateTextLines(def.desc, Math.max(120, width - 22), 11);
  let cursor = 29;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const alpha = mission.status === "done" ? 0.68 : mission.status === "expired" ? 0.45 : 1;
    g.clear();
    g.roundRect(0, 0, width, height, 7).fill({ color: 0x121820, alpha: 0.92 * alpha });
    g.roundRect(0, 0, width, height, 7).stroke({ color: 0x384452, width: 1, alpha: 0.75 * alpha });
    g.rect(0, 0, 3, height).fill({ color: statusColor, alpha: 0.95 * alpha });
  }, [height, mission.status, statusColor, width]);

  const progressY = cursor + descLines * 14;
  const rewardY = progressY + (mission.status === "active" ? 15 : 0);
  cursor = rewardY;

  return (
    <pixiContainer y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={missionName(mission)}
        x={12}
        y={8}
        style={{
          fill: 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(80, width - 78),
        }}
      />
      <pixiText
        anchor={{ x: 1, y: 0 }}
        eventMode="none"
        text={missionStatusLabel(mission)}
        x={width - 10}
        y={9}
        style={{
          fill: statusColor,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        eventMode="none"
        text={def.desc}
        x={12}
        y={29}
        style={{
          fill: 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          wordWrap: true,
          wordWrapWidth: Math.max(120, width - 22),
        }}
      />
      {mission.status === "active" ? (
        <pixiText
          eventMode="none"
          text={`진행: ${runtime.missionProgress[mission.defId] ?? ""}`}
          x={12}
          y={progressY}
          style={{
            fill: 0x8fd7ff,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 11,
            wordWrap: true,
            wordWrapWidth: Math.max(120, width - 22),
          }}
        />
      ) : null}
      <pixiText
        eventMode="none"
        text={reward}
        x={12}
        y={cursor}
        style={{
          fill: 0xf6d365,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          wordWrap: true,
          wordWrapWidth: Math.max(120, width - 22),
        }}
      />
    </pixiContainer>
  );
}

function MissionTab({ runtime, width, y }: { runtime: RuntimeSnapshot; width: number; y: number }) {
  const missions = visibleMissions(runtime.state);
  let cursor = y;

  if (missions.length === 0) {
    return (
      <pixiText
        text="표시할 미션이 없습니다."
        x={0}
        y={cursor}
        style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 12 }}
      />
    );
  }

  return (
    <pixiContainer>
      {missions.map((mission) => {
        const height = missionCardHeight(runtime, mission, width);
        const itemY = cursor;
        cursor += height + GAP;
        return (
          <MissionCard
            height={height}
            key={mission.defId}
            mission={mission}
            runtime={runtime}
            width={width}
            y={itemY}
          />
        );
      })}
    </pixiContainer>
  );
}

function InfoRow({
  label,
  value,
  valueColor = 0xeef3fa,
  width,
  y,
}: {
  label: string;
  value: string;
  valueColor?: number;
  width: number;
  y: number;
}) {
  return (
    <pixiContainer y={y}>
      <pixiText
        text={label}
        x={0}
        y={0}
        style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 12 }}
      />
      <pixiText
        anchor={{ x: 1, y: 0 }}
        text={value}
        x={width}
        y={0}
        style={{
          fill: valueColor,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(80, width - 84),
        }}
      />
    </pixiContainer>
  );
}

function SectionTitle({ title, width, y }: { title: string; width: number; y: number }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 17, width, 1).fill({ color: 0x384452, alpha: 0.8 });
  }, [width]);

  return (
    <pixiContainer y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        text={title}
        x={0}
        y={0}
        style={{
          fill: 0x8fd7ff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 10,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function RelicRow({ desc, name, rarity, width, y }: { desc: string; name: string; rarity: string; width: number; y: number }) {
  const height = relicRowHeight(desc, width);
  const rarityColor = rarity === "legendary" ? 0xf6d365 : rarity === "rare" ? 0x8fd7ff : 0xc7d2df;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, height, 7).fill({ color: 0x151b24, alpha: 0.9 });
    g.roundRect(0, 0, width, height, 7).stroke({ color: rarityColor, width: 1, alpha: 0.65 });
    g.circle(16, 18, 8).fill({ color: rarityColor, alpha: 0.16 });
    g.circle(16, 18, 5).stroke({ color: rarityColor, width: 1, alpha: 0.9 });
  }, [height, rarityColor, width]);

  return (
    <pixiContainer y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        text="◆"
        x={16}
        y={18}
        style={{ fill: rarityColor, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 12 }}
      />
      <pixiText
        text={name}
        x={34}
        y={8}
        style={{
          fill: 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(100, width - 42),
        }}
      />
      <pixiText
        text={desc}
        x={34}
        y={25}
        style={{
          fill: 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          wordWrap: true,
          wordWrapWidth: Math.max(100, width - 42),
        }}
      />
    </pixiContainer>
  );
}

function PanelButton({ label, onPress, width, y }: { label: string; onPress: () => void; width: number; y: number }) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, 32, 6).fill({ color: hovered ? 0x2468c4 : 0x245fbd, alpha: 0.96 });
    g.roundRect(0, 0, width, 32, 6).stroke({ color: hovered ? 0xbfdfff : 0x3f86e6, width: hovered ? 2 : 1, alpha: 0.9 });
  }, [hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPress}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={0.5}
        text={label}
        x={width / 2}
        y={16}
        style={{
          fill: 0xffffff,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function BossTab({ runtime, width, y }: { runtime: RuntimeSnapshot; width: number; y: number }) {
  const state = runtime.state;
  const outlook = bossOutlook(state);
  const controls = getRuntimeControls();
  const nodes: ReactNode[] = [];
  let cursor = y;

  if (!outlook) {
    nodes.push(
      <pixiText
        key="none"
        text="남은 보스가 없습니다."
        x={0}
        y={cursor}
        style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 12 }}
      />,
    );
    cursor += 28;
  } else {
    const riskColor = outlook.risk === "ok" ? 0x4fd18b : outlook.risk === "warn" ? 0xe8a33d : 0xe5534b;
    const rows: Array<[string, string, number?]> = [
      ["다음 보스", `${outlook.name} (${outlook.round}R)`],
      ["남은 라운드", String(outlook.roundsLeft)],
      ["약점", outlook.weakness],
      ["예상 위험도", outlook.riskText, riskColor],
    ];
    rows.forEach(([label, value, color], index) => {
      nodes.push(<InfoRow key={`row-${label}`} label={label} value={value} valueColor={color} width={width} y={cursor + index * 22} />);
    });
    cursor += rows.length * 22;
    nodes.push(
      <pixiText
        key="hint"
        text={outlook.hint}
        x={0}
        y={cursor}
        style={{
          fill: 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          wordWrap: true,
          wordWrapWidth: width,
        }}
      />,
    );
    cursor += estimateTextLines(outlook.hint, width, 11) * 14 + 10;
  }

  const bossRecords = Object.entries(state.bossKillSeconds);
  if (bossRecords.length > 0) {
    nodes.push(<SectionTitle key="boss-record-title" title="보스 처치 기록" width={width} y={cursor} />);
    cursor += 28;
    for (const [round, seconds] of bossRecords) {
      nodes.push(<InfoRow key={`boss-${round}`} label={`${round}R`} value={`${seconds}초`} width={width} y={cursor} />);
      cursor += 20;
    }
    cursor += 6;
  }

  if (state.relicIds.length > 0 || state.pendingRelicChoices.length > 0) {
    nodes.push(<SectionTitle key="relic-title" title="보유 유물" width={width} y={cursor} />);
    cursor += 28;
    if (state.relicIds.length === 0) {
      nodes.push(
        <pixiText
          key="no-relic"
          text="아직 선택한 유물이 없습니다."
          x={0}
          y={cursor}
          style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 11 }}
        />,
      );
      cursor += 24;
    }
    for (const id of state.relicIds) {
      const relic = RELIC_BY_ID[id];
      if (!relic) continue;
      nodes.push(
        <RelicRow
          desc={relic.desc}
          key={id}
          name={relic.name}
          rarity={relic.rarity}
          width={width}
          y={cursor}
        />,
      );
      cursor += relicRowHeight(relic.desc, width) + 6;
    }
    if (state.pendingRelicChoices.length > 0) {
      nodes.push(
        <PanelButton
          key="relic-pending"
          label={`유물 선택 ${state.pendingRelicChoices.length}`}
          onPress={() => controls?.openRelicChoice()}
          width={Math.min(width, 160)}
          y={cursor}
        />,
      );
    }
  }

  return <pixiContainer>{nodes}</pixiContainer>;
}

function LogTab({ runtime, width, y }: { runtime: RuntimeSnapshot; width: number; y: number }) {
  const log = runtime.state.log.slice(-60).reverse();

  if (log.length === 0) {
    return (
      <pixiText
        text="아직 로그가 없습니다."
        x={0}
        y={y}
        style={{ fill: 0x9fb2c7, fontFamily: "Segoe UI, Malgun Gothic, sans-serif", fontSize: 12 }}
      />
    );
  }

  return (
    <pixiContainer>
      {log.map((event, index) => {
        const color = event.kind === "reward" || event.kind === "mission"
          ? 0xf6d365
          : event.kind === "boss"
            ? 0xe5534b
            : event.kind === "craft" || event.kind === "merge"
              ? 0x4fd18b
              : 0x9fb2c7;
        return (
          <pixiText
            key={`${event.round}-${event.kind}-${index}`}
            text={`[${event.round}R] ${event.text}`}
            x={0}
            y={y + index * 18}
            style={{
              fill: color,
              fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
              fontSize: 11,
              wordWrap: true,
              wordWrapWidth: width,
            }}
          />
        );
      })}
    </pixiContainer>
  );
}

function PixiRightPanelStage({ runtime, width }: { runtime: RuntimeSnapshot; width: number }) {
  const innerWidth = Math.max(1, width);
  const contentY = TAB_H + GAP + 4;

  return (
    <pixiContainer>
      <Tabs runtime={runtime} width={innerWidth} />
      {runtime.activeTab === "mission" ? <MissionTab runtime={runtime} width={innerWidth} y={contentY} /> : null}
      {runtime.activeTab === "boss" ? <BossTab runtime={runtime} width={innerWidth} y={contentY} /> : null}
      {runtime.activeTab === "log" ? <LogTab runtime={runtime} width={innerWidth} y={contentY} /> : null}
    </pixiContainer>
  );
}

export function PixiRightPanel({ runtime }: PixiRightPanelProps) {
  const { ref, size } = usePanelSize();
  const active = runtime?.scene === "game";

  const stageHeight = active ? Math.max(size.viewportHeight, contentHeight(runtime, size.width)) : size.viewportHeight;

  return (
    <div className="pixi-right-panel-surface" ref={ref} style={{ height: stageHeight }}>
      {active ? (
        <Application key={`${size.width}x${stageHeight}`} width={size.width} height={stageHeight} backgroundAlpha={0} antialias>
          <PixiRightPanelStage runtime={runtime} width={size.width} />
        </Application>
      ) : null}
    </div>
  );
}
