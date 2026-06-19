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
import { writeReport, openAppDataDir, isTauri } from "../save/saveApi";

interface MenuItem {
  label: string;
  hint?: string;
  disabled?: () => boolean;
  onClick: () => void;
}

export function renderMenubar(ctx: AppCtx) {
  const root = document.getElementById("menubar")!;
  root.innerHTML = "";

  const menus: Array<{ title: string; items: (MenuItem | "sep")[] }> = [
    {
      title: "Game",
      items: [
        { label: "새 게임", hint: "New Run", onClick: () => openNewRunModal(ctx) },
        { label: "같은 시드 재시작", onClick: () => ctx.newRun(ctx.game.state.seed, ctx.game.state.difficulty, ctx.game.state.stageId) },
        "sep",
        { label: "수동 저장…", hint: "슬롯 3개", onClick: () => openSaveModal(ctx) },
        { label: "불러오기…", onClick: () => openLoadModal(ctx) },
        "sep",
        {
          label: "결과 리포트 내보내기",
          onClick: async () => {
            const summary = ctx.game.resultSummary();
            summary.playedAt = new Date().toISOString();
            summary.manualStartedAt = ctx.runStartedAt;
            summary.wallSeconds = Math.max(1, Math.round((performance.now() - ctx.runStartedAtMs) / 1000));
            try {
              const p = await writeReport(`randi-run-${summary.seed}-${Date.now()}.md`, buildReportMarkdown(summary));
              toast(`리포트 저장: ${p}`, "ok", 4000);
            } catch {
              toast("리포트 저장 실패", "danger");
            }
          },
        },
        "sep",
        { label: "타이틀로", onClick: () => { ctx.autosave(); ctx.goTitle(); } },
        { label: "게임 종료", onClick: () => quitApp() },
      ],
    },
    {
      title: "View",
      items: [
        {
          label: "좌측 패널 접기/펴기",
          onClick: () => document.getElementById("left-panel")!.classList.toggle("collapsed"),
        },
        {
          label: "우측 패널 접기/펴기",
          onClick: () => document.getElementById("right-panel")!.classList.toggle("collapsed"),
        },
        "sep",
        { label: "전체화면 전환", hint: "F11", onClick: () => void toggleFullscreen() },
      ],
    },
    {
      title: "Tools",
      items: [
        { label: "100시드 시뮬레이션…", onClick: () => openSimModal(ctx) },
        { label: "5난이도 밸런스 게이트…", onClick: () => openBalanceGateModal() },
        { label: "수동 밸런스 증거…", onClick: () => openManualProofGuideModal(ctx) },
        "sep",
        {
          label: "앱 데이터 폴더 열기",
          disabled: () => !isTauri(),
          onClick: () => void openAppDataDir(),
        },
      ],
    },
    {
      title: "Help",
      items: [
        { label: "단축키 / 규칙", onClick: () => openHelpModal() },
        { label: "도감", onClick: () => openCollection(ctx) },
        { label: "옵션", hint: "Esc", onClick: () => openOptionsOverlay(ctx) },
        { label: "정보", onClick: () => openAboutModal() },
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
