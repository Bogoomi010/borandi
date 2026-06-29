import { getCurrentWindow } from "@tauri-apps/api/window";
import { DIFFICULTY_BY_ID } from "../data/difficulty";
import { RECIPES } from "../data/recipes";
import { UNITS } from "../data/units";
import { GRADE_ORDER } from "../core/types";
import { isTauri } from "../save/saveApi";
import { setLocale, type Locale } from "../i18n";
import type { AppCtx } from "../runtimeContext";
import { openLoadModal, openSaveModal } from "./overlayActions";
import { closeTopReactOverlay, openReactOverlay } from "./reactOverlayBridge";
import { loadProfile, saveSettings } from "../profile/settings";
import { toast } from "./uiFeedback";

let pauseOpen = false;

export function openPauseMenu(ctx: AppCtx) {
  if (pauseOpen || ctx.scene !== "game") return;
  pauseOpen = true;
  const wasPaused = ctx.paused;
  ctx.paused = true;
  ctx.refresh();

  const click = (cb: () => void) => {
    ctx.audio.sfx("click");
    cb();
  };

  openReactOverlay({
    kind: "pause",
    onClose: () => {
      pauseOpen = false;
      if (!wasPaused && ctx.scene === "game") {
        ctx.paused = false;
        ctx.refresh();
      }
    },
    actions: {
      resume: () => click(() => closeTopReactOverlay()),
      save: () => click(() => { closeTopReactOverlay(); openSaveModal(ctx); }),
      load: () => click(() => { closeTopReactOverlay(); openLoadModal(ctx); }),
      options: () => click(() => openOptionsOverlay(ctx)),
      toTitle: () => click(() => {
        closeTopReactOverlay();
        ctx.autosave();
        ctx.goTitle();
      }),
      quit: () => click(() => quitApp()),
    },
  });
}

export function openOptionsOverlay(ctx: AppCtx) {
  const s = ctx.settings;
  const apply = () => {
    saveSettings(s);
    ctx.audio.updateSettings(s);
    ctx.boardUi.showLabels = s.highContrast;
    ctx.boardUi.showDamage = s.showDamage;
    ctx.refresh();
  };

  openReactOverlay({
    kind: "options",
    settings: s,
    actions: {
      apply,
      setLanguage: (locale: Locale) => {
        if (s.lang === locale) return;
        s.lang = locale;
        saveSettings(s);
        ctx.audio.sfx("click");
        setLocale(locale);
        apply();
      },
      toggleFullscreen: () => {
        ctx.audio.sfx("click");
        void toggleFullscreen();
      },
    },
  });
}

export function openCollection(_ctx: AppCtx) {
  const profile = loadProfile();
  openReactOverlay({
    kind: "collection",
    profile,
    unitsByGrade: [...GRADE_ORDER].reverse().map((grade) => ({
      grade,
      units: UNITS
        .filter((unit) => unit.grade === grade)
        .map((unit) => ({ unit, seen: profile.seenUnits.includes(unit.id) })),
    })).filter((group) => group.units.length > 0),
    hiddenRecipes: profile.foundHiddenRecipes
      .map((id) => RECIPES.find((recipe) => recipe.id === id))
      .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe))
      .map((recipe) => ({ id: recipe.id, resultUnitId: recipe.resultUnitId })),
  });
}

export function quitApp() {
  if (isTauri()) {
    try {
      void getCurrentWindow().close();
      return;
    } catch {
      // Fall through to the browser behavior.
    }
  }
  window.close();
  toast("Close this browser tab manually.", "warn");
}

export async function toggleFullscreen() {
  if (isTauri()) {
    try {
      const w = getCurrentWindow();
      const cur = await w.isFullscreen();
      await w.setFullscreen(!cur);
      return;
    } catch {
      // Fall through to the browser fullscreen API.
    }
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen toggle failed.", "warn");
  }
}

export { DIFFICULTY_BY_ID };
