import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { APP_VERSION, DATA_VERSION } from "../data/version";
import { getLocale, onLocaleChange, t } from "../i18n";
import { loadProfile } from "../profile/settings";
import { isTauri, listSlots } from "../save/saveApi";
import { getRuntimeControls, type MenuCommand, type RuntimeSnapshot } from "../runtimeBridge";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface PixiTitleSceneProps {
  runtime: RuntimeSnapshot | null;
}

interface AutosaveState {
  available: boolean;
  round: number | null;
}

interface TitleAction {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  command?: MenuCommand;
  onPress?: () => void;
}

function useSurfaceSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

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

function TitleButton({
  action,
  height,
  width,
  x,
  y,
}: {
  action: TitleAction;
  height: number;
  width: number;
  x: number;
  y: number;
}) {
  const [hovered, setHovered] = useState(false);
  const disabled = !!action.disabled;
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    const alpha = disabled ? 0.38 : 1;
    g.clear();
    g.roundRect(0, 0, width, height, 7).fill({ color: hovered && !disabled ? 0x1f3658 : 0x151b24, alpha: 0.94 * alpha });
    g.roundRect(0, 0, width, height, 7).stroke({ color: hovered && !disabled ? 0x6fb8ff : 0x384452, width: hovered && !disabled ? 2 : 1, alpha: 0.9 * alpha });
    g.rect(0, 0, 3, height).fill({ color: 0xe7b53e, alpha: 0.9 * alpha });
    if (hovered && !disabled) {
      g.roundRect(1, 1, width - 2, height - 2, 6).stroke({ color: 0xffffff, width: 1, alpha: 0.13 });
    }
  }, [disabled, height, hovered, width]);

  return (
    <pixiContainer
      cursor={disabled ? "default" : "pointer"}
      eventMode={disabled ? "none" : "static"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={() => {
        if (!disabled) action.onPress?.();
      }}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={action.label}
        x={20}
        y={14}
        style={{
          fill: disabled ? 0x718091 : 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 15,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: Math.max(40, width - 92),
        }}
      />
      {action.hint ? (
        <pixiText
          anchor={{ x: 1, y: 0 }}
          eventMode="none"
          text={action.hint}
          x={width - 18}
          y={16}
          style={{
            fill: disabled ? 0x718091 : 0x8fd7ff,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 11,
            fontWeight: "bold" as const,
          }}
        />
      ) : null}
    </pixiContainer>
  );
}

function PixiTitleStage({
  actions,
  footer,
  height,
  width,
}: {
  actions: TitleAction[];
  footer: string;
  height: number;
  width: number;
}) {
  const buttonWidth = Math.max(260, Math.min(340, width - 48));
  const buttonHeight = 46;
  const centerX = width / 2;
  const logoY = Math.max(42, Math.min(146, height * 0.16));
  const menuHeight = actions.length * buttonHeight + (actions.length - 1) * 10;
  const menuY = Math.max(282, Math.min(height - menuHeight - 58, height * 0.5));
  const menuX = centerX - buttonWidth / 2;

  return (
    <pixiContainer>
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        text="RIFT RANDOM DEFENSE"
        x={centerX}
        y={logoY}
        style={{
          fill: 0xe7b53e,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 13,
          fontWeight: "bold" as const,
        }}
      />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        text={"차원 균열\n랜덤 디펜스"}
        x={centerX}
        y={logoY + 36}
        style={{
          align: "center" as const,
          fill: 0xf6d365,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 64,
          fontWeight: "800" as const,
          lineHeight: 72,
          stroke: { color: 0x1a1205, width: 3 },
        }}
      />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        text="새 게임 시작 전 전체 맵 자유 선택 / 1~40R 고정 진행"
        x={centerX}
        y={logoY + 186}
        style={{
          align: "center" as const,
          fill: 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 14,
          wordWrap: true,
          wordWrapWidth: Math.max(240, Math.min(620, width - 44)),
        }}
      />
      {actions.map((action, index) => (
        <TitleButton
          action={action}
          height={buttonHeight}
          key={action.id}
          width={buttonWidth}
          x={menuX}
          y={menuY + index * (buttonHeight + 10)}
        />
      ))}
      <pixiText
        anchor={{ x: 0.5, y: 1 }}
        text={footer}
        x={centerX}
        y={height - 28}
        style={{
          align: "center" as const,
          fill: 0x687589,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 11,
          wordWrap: true,
          wordWrapWidth: Math.max(240, width - 48),
        }}
      />
    </pixiContainer>
  );
}

export function PixiTitleScene({ runtime }: PixiTitleSceneProps) {
  const controls = getRuntimeControls();
  const { ref, size } = useSurfaceSize();
  const [autosave, setAutosave] = useState<AutosaveState>({ available: false, round: null });
  const [loadingContinue, setLoadingContinue] = useState(false);
  const profile = useMemo(() => loadProfile(), []);
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);

  useEffect(() => {
    let cancelled = false;
    if (runtime?.scene !== "title") {
      return () => {
        cancelled = true;
      };
    }

    void listSlots()
      .then((slots) => {
        if (cancelled) return;
        const auto = slots.find((slot) => slot.slotId === "autosave");
        setAutosave({
          available: !!auto && auto.dataVersion === DATA_VERSION,
          round: auto && auto.dataVersion === DATA_VERSION ? auto.round : null,
        });
      })
      .catch(() => {
        if (!cancelled) setAutosave({ available: false, round: null });
      });

    return () => {
      cancelled = true;
    };
  }, [runtime?.revision, runtime?.scene]);

  const active = runtime?.scene === "title";

  const actions: TitleAction[] = [
    {
      id: "new",
      label: "게임 시작",
      onPress: () => controls?.menuCommand("newRun"),
    },
    {
      id: "continue",
      label: loadingContinue ? "불러오는 중" : "이어하기",
      hint: autosave.round !== null ? `${autosave.round}R` : undefined,
      disabled: !autosave.available || loadingContinue,
      onPress: () => {
        setLoadingContinue(true);
        const promise = controls?.continueAutosave();
        if (!promise) {
          setLoadingContinue(false);
          return;
        }
        void promise.finally(() => setLoadingContinue(false));
      },
    },
    { id: "load", label: t("menu.load"), onPress: () => controls?.menuCommand("load") },
    { id: "collection", label: t("menu.collection"), onPress: () => controls?.menuCommand("collection") },
    { id: "options", label: t("menu.options"), onPress: () => controls?.menuCommand("options") },
    { id: "quit", label: t("menu.quit"), onPress: () => controls?.menuCommand("quit") },
  ];

  const footer = `v${APP_VERSION} / data v${DATA_VERSION} / ${isTauri() ? "Desktop" : "Web"}${
    profile.runs > 0 ? ` / ${profile.runs}회 / 최고 ${profile.bestRound}R` : ""
  }`;

  return (
    <div className="pixi-title-surface" ref={ref}>
      {active ? (
        <Application key={`${size.width}x${size.height}`} width={size.width} height={size.height} backgroundAlpha={0} antialias>
          <PixiTitleStage actions={actions} footer={footer} height={size.height} width={size.width} />
        </Application>
      ) : null}
    </div>
  );
}
