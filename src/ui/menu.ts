// 인앱 메뉴바 (Game / View / Tools / Help)
// 브라우저와 Tauri에서 동일하게 동작하도록 OS 네이티브 메뉴 대신 HTML 메뉴를 사용한다.

import type { AppCtx } from "./ctx";
import { el, toast } from "./widgets";
import {
  openHelpModal, openLoadModal, openNewRunModal,
  openSaveModal, openSimModal, buildReportMarkdown, openAboutModal,
  openBalanceGateModal, openManualProofGuideModal,
} from "./modals";
import { openCollection, openOptionsOverlay, toggleFullscreen, quitApp } from "./scenes";
import { writeReport, openAppDataDir, canOpenAppDataDir } from "../save/saveApi";
import { t } from "../i18n";

interface MenuItem {
  label: string;
  hint?: string;
  disabled?: () => boolean;
  onClick: () => void;
}

// COMPONENT: MenuBar - builds the Game/View/Tools/Help dropdowns in #menubar.
export function renderMenubar(ctx: AppCtx) {
  const root = document.getElementById("menubar")!;
  root.innerHTML = "";

  const menus: Array<{ title: string; items: (MenuItem | "sep")[] }> = [
    {
      title: t("menu.game"),
      items: [
        { label: t("menu.newRun"), onClick: () => openNewRunModal(ctx) },
        { label: t("menu.restartSeed"), onClick: () => ctx.newRun(ctx.game.state.seed, ctx.game.state.difficulty, ctx.game.state.stageId) },
        "sep",
        { label: t("menu.save"), hint: t("menu.save.hint"), onClick: () => openSaveModal(ctx) },
        { label: t("menu.load"), onClick: () => openLoadModal(ctx) },
        "sep",
        {
          label: t("menu.exportReport"),
          onClick: async () => {
            const summary = ctx.game.resultSummary();
            summary.playedAt = new Date().toISOString();
            summary.manualStartedAt = ctx.runStartedAt;
            summary.wallSeconds = Math.max(1, Math.round((performance.now() - ctx.runStartedAtMs) / 1000));
            try {
              const p = await writeReport(`randi-run-${summary.seed}-${Date.now()}.md`, buildReportMarkdown(summary));
              toast(t("toast.reportSaved", { path: p }), "ok", 4000);
            } catch {
              toast(t("toast.reportFailed"), "danger");
            }
          },
        },
        "sep",
        { label: t("menu.toTitle"), onClick: () => { ctx.autosave(); ctx.goTitle(); } },
        { label: t("menu.quit"), onClick: () => quitApp() },
      ],
    },
    {
      title: t("menu.view"),
      items: [
        {
          label: t("menu.toggleRightPanel"),
          onClick: () => document.getElementById("right-panel")!.classList.toggle("collapsed"),
        },
        "sep",
        { label: t("menu.fullscreen"), hint: "F11", onClick: () => void toggleFullscreen() },
      ],
    },
    {
      title: t("menu.tools"),
      items: [
        { label: t("menu.sim100"), onClick: () => openSimModal(ctx) },
        { label: t("menu.balanceGate"), onClick: () => openBalanceGateModal() },
        { label: t("menu.manualProof"), onClick: () => openManualProofGuideModal(ctx) },
        "sep",
        {
          label: t("menu.openDataDir"),
          disabled: () => !canOpenAppDataDir(),
          onClick: () => void openAppDataDir(),
        },
      ],
    },
    {
      title: t("menu.help"),
      items: [
        { label: t("menu.shortcuts"), onClick: () => openHelpModal() },
        { label: t("menu.collection"), onClick: () => openCollection(ctx) },
        { label: t("menu.options"), hint: "Esc", onClick: () => openOptionsOverlay(ctx) },
        { label: t("menu.about"), onClick: () => openAboutModal() },
      ],
    },
  ];

  let openDrop: HTMLElement | null = null;
  const closeDrop = () => { openDrop?.remove(); openDrop = null; };
  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("#menubar")) closeDrop();
  });

  for (const menu of menus) {
    const wrap = el("div", "menu-item");
    const btn = el("button", "", menu.title);
    btn.onclick = (e) => {
      e.stopPropagation();
      if (openDrop) { closeDrop(); return; }
      ctx.audio.sfx("click");
      const drop = el("div", "menu-drop");
      for (const item of menu.items) {
        if (item === "sep") { drop.appendChild(el("div", "sep")); continue; }
        const b = el("button");
        b.appendChild(el("span", "", item.label));
        if (item.hint) b.appendChild(el("span", "hint", item.hint));
        (b as HTMLButtonElement).disabled = item.disabled?.() ?? false;
        b.onclick = () => { closeDrop(); ctx.audio.sfx("click"); item.onClick(); };
        drop.appendChild(b);
      }
      wrap.appendChild(drop);
      openDrop = drop;
    };
    wrap.appendChild(btn);
    root.appendChild(wrap);
  }
}
