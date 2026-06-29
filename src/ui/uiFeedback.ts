import { anyReactOverlayOpen, closeTopReactOverlay, openReactOverlay } from "./reactOverlayBridge";
import { pushToast, type ToastKind } from "./toastBridge";

export function toast(text: string, kind: ToastKind = "info", ms = 2600) {
  pushToast(text, kind, ms);
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
