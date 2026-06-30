import { useSyncExternalStore } from "react";
import { Application, extend } from "@pixi/react";
import { Container } from "pixi.js";
import { getToasts, subscribeToasts, type ToastKind, type ToastMessage } from "./toastBridge";
import { GameToastView } from "./components";
import type { GameUiTone } from "./skin/GameUiTokens";

extend({ Container });

const TOAST_H = 46;
const TOAST_GAP = 6;
const MAX_W = 520;
const MIN_W = 260;

function toastTone(kind: ToastKind): GameUiTone {
  if (kind === "warn") return "warning";
  if (kind === "danger") return "danger";
  if (kind === "ok") return "reward";
  return "normal";
}

function toastWidth(toasts: readonly ToastMessage[]) {
  const maxText = Math.max(0, ...toasts.map((toast) => Array.from(toast.text).length));
  return Math.min(MAX_W, Math.max(MIN_W, maxText * 7 + 36));
}

function PixiToastRow({ toast, width, y }: { toast: ToastMessage; width: number; y: number }) {
  return <GameToastView height={TOAST_H} text={toast.text} tone={toastTone(toast.kind)} width={width} y={y} />;
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
