import { anyReactOverlayOpen, closeTopReactOverlay, openReactOverlay } from "./reactOverlayBridge";
import { pushReactToast, type ToastKind } from "./reactToastBridge";

export function toast(text: string, kind: ToastKind = "info", ms = 2600) {
  pushReactToast(text, kind, ms);
}

export function anyModalOpen(): boolean {
  return anyReactOverlayOpen();
}

export function closeTopModal() {
  closeTopReactOverlay();
}

export function confirmModal(title: string, message: string, confirmLabel: string, onConfirm: () => void, danger = false) {
  openReactOverlay({
    kind: "confirm",
    title,
    message,
    confirmLabel,
    danger,
    actions: {
      confirm: onConfirm,
    },
  });
}
