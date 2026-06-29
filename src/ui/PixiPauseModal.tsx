import { useMemo, useState, useSyncExternalStore } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { getLocale, onLocaleChange, t } from "../i18n";
import { closeReactOverlay, type ReactPauseOverlay } from "./reactOverlayBridge";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const MODAL_W = 360;
const MODAL_H = 388;
const BUTTON_W = 300;
const BUTTON_H = 42;

interface PauseAction {
  id: string;
  label: string;
  onPress: () => void;
}

function PauseButton({ action, x, y }: { action: PauseAction; x: number; y: number }) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, BUTTON_W, BUTTON_H, 7).fill({ color: hovered ? 0x1f3658 : 0x151b24, alpha: 0.96 });
    g.roundRect(0, 0, BUTTON_W, BUTTON_H, 7).stroke({ color: hovered ? 0x8fd7ff : 0x384452, width: hovered ? 2 : 1, alpha: 0.9 });
    g.rect(0, 0, 3, BUTTON_H).fill({ color: 0xe7b53e, alpha: 0.9 });
  }, [hovered]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={action.onPress}
      x={x}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        text={action.label}
        x={20}
        y={12}
        style={{
          fill: 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 14,
          fontWeight: "bold" as const,
          wordWrap: true,
          wordWrapWidth: BUTTON_W - 40,
        }}
      />
    </pixiContainer>
  );
}

function PixiPauseStage({ actions }: { actions: PauseAction[] }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, MODAL_W, MODAL_H, 12).fill({ color: 0x121820, alpha: 0.98 });
    g.roundRect(0, 0, MODAL_W, MODAL_H, 12).stroke({ color: 0x8fd7ff, width: 1, alpha: 0.85 });
    g.roundRect(1, 1, MODAL_W - 2, MODAL_H - 2, 11).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    g.rect(26, 60, MODAL_W - 52, 1).fill({ color: 0x384452, alpha: 0.9 });
  }, []);

  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      <pixiText
        anchor={{ x: 0.5, y: 0 }}
        text={t("pause.title")}
        x={MODAL_W / 2}
        y={24}
        style={{
          fill: 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 18,
          fontWeight: "bold" as const,
        }}
      />
      {actions.map((action, index) => (
        <PauseButton action={action} key={action.id} x={(MODAL_W - BUTTON_W) / 2} y={78 + index * 50} />
      ))}
    </pixiContainer>
  );
}

export function PixiPauseModal({ overlay }: { overlay: ReactPauseOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const actions: PauseAction[] = [
    { id: "resume", label: t("pause.resume"), onPress: overlay.actions.resume },
    { id: "save", label: t("pause.save"), onPress: overlay.actions.save },
    { id: "load", label: t("pause.load"), onPress: overlay.actions.load },
    { id: "options", label: t("pause.options"), onPress: overlay.actions.options },
    { id: "title", label: t("pause.toTitle"), onPress: overlay.actions.toTitle },
    { id: "quit", label: t("pause.quit"), onPress: overlay.actions.quit },
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeReactOverlay(overlay.id);
      }}
    >
      <div className="pixi-pause-modal">
        <Application width={MODAL_W} height={MODAL_H} backgroundAlpha={0} antialias>
          <PixiPauseStage actions={actions} />
        </Application>
      </div>
    </div>
  );
}
