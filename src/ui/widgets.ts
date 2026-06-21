// 토스트/모달 공통 위젯

// COMPONENT: Toast - transient notification stack mounted under #toast-root.
export function toast(text: string, kind: "info" | "warn" | "danger" | "ok" = "info", ms = 2600) {
  const root = document.getElementById("toast-root")!;
  const el = document.createElement("div");
  el.className = `toast ${kind === "info" ? "" : kind}`;
  el.textContent = text;
  root.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
  while (root.children.length > 4) root.firstChild?.remove();
}

export interface ModalHandle { close: () => void; el: HTMLElement; }

function modalRoot(): HTMLElement {
  const root = document.getElementById("modal-root")!;
  if (root.parentElement !== document.body) document.body.appendChild(root);
  return root;
}

/** 모달 열기. dismissable=false면 배경 클릭/Esc로 닫히지 않음 */
// COMPONENT: ModalShell - shared backdrop and modal container mounted under #modal-root.
export function openModal(build: (body: HTMLElement, close: () => void) => void, dismissable = true): ModalHandle {
  const root = modalRoot();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal";
  backdrop.appendChild(modal);
  const close = () => backdrop.remove();
  if (dismissable) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
  }
  build(modal, close);
  root.appendChild(backdrop);
  return { close, el: backdrop };
}

export function anyModalOpen(): boolean {
  return (document.getElementById("modal-root")?.children.length ?? 0) > 0;
}

export function closeTopModal() {
  const root = modalRoot();
  root.lastElementChild?.remove();
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function confirmModal(title: string, message: string, confirmLabel: string, onConfirm: () => void, danger = false) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", title));
    body.appendChild(el("div", "", message));
    const row = el("div", "row-btns");
    const cancel = el("button", "", "취소");
    cancel.onclick = close;
    const okBtn = el("button", danger ? "danger" : "primary", confirmLabel);
    okBtn.onclick = () => { close(); onConfirm(); };
    row.append(cancel, okBtn);
    body.appendChild(row);
  });
}
