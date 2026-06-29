import { useMemo, useSyncExternalStore } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { getToasts, subscribeToasts, type ToastKind, type ToastMessage } from "./toastBridge";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

const TOAST_H = 36;
const TOAST_GAP = 6;
const MAX_W = 520;
const MIN_W = 220;

function toastColor(kind: ToastKind) {
  if (kind === "warn") return 0xe8a33d;
  if (kind === "danger") return 0xe5534b;
  if (kind === "ok") return 0x4fd18b;
  return 0x8fd7ff;
}

function toastWidth(toasts: readonly ToastMessage[]) {
  const maxText = Math.max(0, ...toasts.map((toast) => Array.from(toast.text).length));
  return Math.min(MAX_W, Math.max(MIN_W, maxText * 7 + 36));
}

function PixiToastRow({ toast, width, y }: { toast: ToastMessage; width: number; y: number }) {
  const accent = toastColor(toast.kind);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, width, TOAST_H, 7).fill({ color: 0x1a1f28, alpha: 0.96 });
    g.roundRect(0, 0, width, TOAST_H, 7).stroke({ color: accent, width: 1, alpha: 0.82 });
    g.rect(0, 0, 3, TOAST_H).fill({ color: accent, alpha: 0.9 });
  }, [accent, width]);

  return (
    <pixiContainer y={y}>
      <pixiGraphics draw={draw} />
      <pixiText
        text={toast.text}
        x={16}
        y={10}
        style={{
          fill: 0xeef3fa,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          wordWrap: true,
          wordWrapWidth: Math.max(80, width - 30),
        }}
      />
    </pixiContainer>
  );
}

function PixiToastStage({ toasts, width }: { toasts: readonly ToastMessage[]; width: number }) {
  return (
    <pixiContainer>
      {toasts.map((toast, index) => (
        <PixiToastRow key={toast.id} toast={toast} width={width} y={index * (TOAST_H + TOAST_GAP)} />
      ))}
    </pixiContainer>
  );
}

export function PixiToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const width = toastWidth(toasts);
  const height = toasts.length > 0 ? toasts.length * TOAST_H + (toasts.length - 1) * TOAST_GAP : 0;

  return (
    <div className="pixi-toast-host" id="toast-root" style={{ height, width }}>
      {toasts.length > 0 ? (
        <Application key={`${width}x${height}`} width={width} height={height} backgroundAlpha={0} antialias>
          <PixiToastStage toasts={toasts} width={width} />
        </Application>
      ) : null}
    </div>
  );
}
