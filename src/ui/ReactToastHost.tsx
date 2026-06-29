import { useSyncExternalStore } from "react";
import { getReactToasts, subscribeReactToasts } from "./reactToastBridge";

export function ReactToastHost() {
  const toasts = useSyncExternalStore(subscribeReactToasts, getReactToasts, getReactToasts);

  return (
    <div className="toast-host" id="toast-root">
      {toasts.map((toast) => (
        <div className={`toast ${toast.kind === "info" ? "" : toast.kind}`} key={toast.id}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
