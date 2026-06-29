export type ToastKind = "info" | "warn" | "danger" | "ok";

export interface ReactToast {
  id: number;
  text: string;
  kind: ToastKind;
}

let nextToastId = 1;
let toasts: ReactToast[] = [];
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

export function pushReactToast(text: string, kind: ToastKind = "info", ms = 2600) {
  const id = nextToastId++;
  toasts = [...toasts, { id, text, kind }].slice(-4);
  publish();
  window.setTimeout(() => {
    toasts = toasts.filter((toast) => toast.id !== id);
    publish();
  }, ms);
}

export function getReactToasts(): readonly ReactToast[] {
  return toasts;
}

export function subscribeReactToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
