// 씬 시스템: 타이틀 / 인게임 전환, 일시정지 메뉴, 옵션, 도감.
// 게임엔진의 씬 개념처럼 화면 단위를 분리한다.

import type { AppCtx } from "./ctx";
import { el, openModal, toast } from "./widgets";
import { openLoadModal, openNewRunModal, openSaveModal } from "./modals";
import { loadProfile, saveSettings } from "./settings";
import { UNITS } from "../data/units";
import { RECIPES } from "../data/recipes";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, GRADE_ORDER, type Grade } from "../core/types";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";
import { listSlots, isTauri } from "../save/saveApi";
import { APP_VERSION, DATA_VERSION } from "../data/version";
import { DIFFICULTIES, DIFFICULTY_BY_ID } from "../data/difficulty";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { STAGES } from "../data/stages";
import { t, setLocale, getLocale, LOCALES } from "../i18n";
import { applySprite } from "./uiSkin";

// ---------- 씬 전환 ----------

let titleFxStop: (() => void) | null = null;

// COMPONENT: GameScene - switches visible DOM from title screen to the in-game screen.
export function showGame(ctx: AppCtx) {
  ctx.scene = "game";
  document.getElementById("title-scene")!.classList.add("hidden");
  document.getElementById("game-scene")!.classList.remove("hidden");
  titleFxStop?.();
  titleFxStop = null;
}

// COMPONENT: TitleScene - switches visible DOM to the title screen and rebuilds its menu.
export function showTitle(ctx: AppCtx) {
  ctx.scene = "title";
  document.getElementById("game-scene")!.classList.add("hidden");
  const scene = document.getElementById("title-scene")!;
  scene.classList.remove("hidden");
  buildTitle(ctx);
  titleFxStop?.();
  titleFxStop = startTitleFx();
}

// ---------- 타이틀 화면 ----------

// COMPONENT: TitleMenu - creates the title logo, main menu buttons, continue state, and footer.
function buildTitle(ctx: AppCtx) {
  const root = document.getElementById("title-content")!;
  root.innerHTML = "";

  const inner = el("div", "title-inner");

  const logo = el("div", "title-logo");
  logo.appendChild(el("div", "title-kicker", "RIFT RANDOM DEFENSE"));
  const h1 = el("h1");
  h1.innerHTML = "차원 균열<br>랜덤 디펜스";
  logo.appendChild(h1);
  logo.appendChild(el("div", "title-sub", "새 게임 시작 때 전체 맵 자유 선택 · 1~40R 같은 맵 고정"));
  inner.appendChild(logo);

  const menu = el("div", "title-menu");
  const item = (label: string, cb: () => void, disabled = false, hint = "") => {
    const b = el("button", "title-btn") as HTMLButtonElement;
    b.appendChild(el("span", "", label));
    if (hint) b.appendChild(el("span", "title-btn-hint", hint));
    b.disabled = disabled;
    b.onclick = () => { ctx.audio.sfx("click"); cb(); };
    menu.appendChild(b);
    return b;
  };

  item("게임 시작", () => openNewRunModal(ctx, true));
  const contBtn = item("이어하기", () => void ctx.continueAutosave(), true, "");
  item("불러오기", () => openLoadModal(ctx));
  item("도감", () => openCollection(ctx));
  item("옵션", () => openOptionsOverlay(ctx));
  item("종료", () => quitApp());
  inner.appendChild(menu);

  // 자동 저장 여부 비동기 확인 → 이어하기 활성화
  void listSlots().then((slots) => {
    const auto = slots.find((m) => m.slotId === "autosave");
    if (auto && auto.dataVersion === DATA_VERSION) {
      contBtn.disabled = false;
      const hint = el("span", "title-btn-hint", `${auto.round}R`);
      contBtn.appendChild(hint);
    }
  }).catch(() => { /* noop */ });

  const profile = loadProfile();
  const foot = el("div", "title-foot");
  foot.textContent =
    `v${APP_VERSION} · data v${DATA_VERSION} · ${isTauri() ? "Desktop" : "Web"}` +
    (profile.runs > 0 ? ` · ${profile.runs}판 · 최고 ${profile.bestRound}R` : "");
  inner.appendChild(foot);

  root.appendChild(inner);
}

/** 타이틀 배경 파티클 (계열 색 균열 조각이 떠오른다) */
// COMPONENT: TitleBackgroundFx - draws the animated title background canvas.
function startTitleFx(): () => void {
  const canvas = document.getElementById("title-bg") as HTMLCanvasElement;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return () => undefined;
  let running = true;

  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const colors = Object.values(FAMILY_COLOR);
  interface P { x: number; y: number; vy: number; size: number; color: string; rot: number; vr: number; phase: number; }
  const parts: P[] = [];
  const spawn = (y?: number): P => ({
    x: Math.random() * canvas.width,
    y: y ?? canvas.height + 20,
    vy: 8 + Math.random() * 18,
    size: 3 + Math.random() * 9,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.6,
    phase: Math.random() * Math.PI * 2,
  });
  for (let i = 0; i < 46; i++) parts.push(spawn(Math.random() * canvas.height));

  let last = performance.now();
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    // 중앙 균열 광선
    const cx = canvas.width / 2;
    const grad = ctx2d.createRadialGradient(cx, canvas.height * 0.42, 10, cx, canvas.height * 0.42, canvas.width * 0.55);
    grad.addColorStop(0, "rgba(244,201,90,0.12)");
    grad.addColorStop(0.4, "rgba(217,139,58,0.06)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.y -= p.vy * dt;
      p.rot += p.vr * dt;
      p.phase += dt;
      if (p.y < -30) parts[i] = spawn();
      const alpha = 0.35 + Math.sin(p.phase * 2) * 0.2;
      ctx2d.save();
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(p.rot);
      ctx2d.globalAlpha = Math.max(0.08, alpha);
      ctx2d.fillStyle = p.color;
      ctx2d.beginPath();
      ctx2d.moveTo(0, -p.size);
      ctx2d.lineTo(p.size * 0.6, 0);
      ctx2d.lineTo(0, p.size);
      ctx2d.lineTo(-p.size * 0.6, 0);
      ctx2d.closePath();
      ctx2d.fill();
      ctx2d.restore();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return () => {
    running = false;
    window.removeEventListener("resize", resize);
  };
}

// ---------- 일시정지 메뉴 ----------

let pauseOpen = false;

// COMPONENT: PauseMenu - modal command menu shown from Esc during gameplay.
export function openPauseMenu(ctx: AppCtx) {
  if (pauseOpen || ctx.scene !== "game") return;
  pauseOpen = true;
  const wasPaused = ctx.paused;
  ctx.paused = true;
  ctx.refresh();

  const handle = openModal((body, close) => {
    body.classList.add("pause-menu");
    body.appendChild(el("h2", "", t("pause.title")));
    const item = (label: string, cb: () => void) => {
      const b = el("button", "title-btn", label);
      b.onclick = () => { ctx.audio.sfx("click"); cb(); };
      body.appendChild(b);
    };
    item(t("pause.resume"), () => close());
    item(t("pause.save"), () => { close(); openSaveModal(ctx); });
    item(t("pause.load"), () => { close(); openLoadModal(ctx); });
    item(t("pause.options"), () => openOptionsOverlay(ctx));
    item(t("pause.toTitle"), () => {
      close();
      ctx.autosave();
      ctx.goTitle();
    });
    item(t("pause.quit"), () => quitApp());
  });

  // 닫힐 때 재개 처리 (backdrop 제거 감시)
  const watch = window.setInterval(() => {
    if (!document.body.contains(handle.el)) {
      window.clearInterval(watch);
      pauseOpen = false;
      if (!wasPaused && ctx.scene === "game") {
        ctx.paused = false;
        ctx.refresh();
      }
    }
  }, 120);
}

// ---------- 옵션 ----------

// COMPONENT: OptionsOverlay - settings modal for audio, visuals, fullscreen, and gameplay defaults.
export function openOptionsOverlay(ctx: AppCtx) {
  openModal((body, close, setFrame) => {
    setFrame("popups.settings");
    body.appendChild(el("h2", "", t("options.title")));
    const s = ctx.settings;

    const apply = () => {
      saveSettings(s);
      ctx.audio.updateSettings(s);
      ctx.renderer.showLabels = s.highContrast;
      ctx.renderer.showDamage = s.showDamage;
      ctx.refresh();
    };

    const section = (label: string) => body.appendChild(el("h3", "opt-section", label));

    const slider = (label: string, get: () => number, set: (v: number) => void) => {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", label));
      const input = el("input") as HTMLInputElement;
      input.type = "range";
      input.min = "0"; input.max = "100";
      input.value = String(Math.round(get() * 100));
      const valLabel = el("span", "opt-val", `${input.value}%`);
      input.oninput = () => {
        set(Number(input.value) / 100);
        valLabel.textContent = `${input.value}%`;
        apply();
      };
      input.onchange = () => ctx.audio.sfx("click");
      row.appendChild(input);
      row.appendChild(valLabel);
      body.appendChild(row);
    };

    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", label));
      const btn = el("button", `opt-toggle ${get() ? "on" : ""}`, get() ? t("common.on") : t("common.off"));
      // 토글 스위치 이미지(controls.toggle.on/off). 에셋 있으면 텍스트 대신 이미지 표시(폴백 안전).
      const skinToggle = () => void applySprite(btn, get() ? "controls.toggle.on" : "controls.toggle.off", "contain");
      skinToggle();
      btn.onclick = () => {
        set(!get());
        btn.classList.toggle("on", get());
        btn.textContent = get() ? t("common.on") : t("common.off");
        skinToggle();
        ctx.audio.sfx("click");
        apply();
      };
      row.appendChild(btn);
      body.appendChild(row);
    };

    // 언어 선택 — 바꾸면 즉시 적용하고 모달을 새 언어로 다시 연다.
    {
      const langRow = el("div", "opt-row");
      langRow.appendChild(el("span", "opt-label", t("options.language")));
      const seg = el("div", "speed-btns");
      for (const loc of LOCALES) {
        const b = el("button", getLocale() === loc.id ? "active" : "", loc.label);
        b.onclick = () => {
          if (s.lang === loc.id) return;
          s.lang = loc.id;
          saveSettings(s);
          ctx.audio.sfx("click");
          setLocale(loc.id);
          close();
          openOptionsOverlay(ctx); // 새 언어로 다시 렌더
        };
        seg.appendChild(b);
      }
      langRow.appendChild(seg);
      body.appendChild(langRow);
    }

    section(t("options.audio"));
    slider(t("options.master"), () => s.master, (v) => { s.master = v; });
    slider(t("options.sfx"), () => s.sfx, (v) => { s.sfx = v; });
    slider(t("options.music"), () => s.music, (v) => { s.music = v; });

    section(t("options.graphics"));
    toggle(t("options.shake"), () => s.shake, (v) => { s.shake = v; });
    toggle(t("options.highContrast"), () => s.highContrast, (v) => { s.highContrast = v; });
    toggle(t("options.showDamage"), () => s.showDamage, (v) => { s.showDamage = v; });
    {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", t("options.fullscreen")));
      const btn = el("button", "opt-toggle", t("options.fullscreenBtn"));
      btn.onclick = () => { ctx.audio.sfx("click"); void toggleFullscreen(); };
      row.appendChild(btn);
      body.appendChild(row);
    }

    section(t("options.gameplay"));
    {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", t("options.defaultSpeed")));
      const seg = el("div", "speed-btns");
      for (const v of [1, 2, 3] as const) {
        const b = el("button", s.defaultSpeed === v ? "active" : "", `x${v}`);
        b.onclick = () => {
          s.defaultSpeed = v;
          seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          ctx.audio.sfx("click");
          apply();
        };
        seg.appendChild(b);
      }
      row.appendChild(seg);
      body.appendChild(row);
    }
    toggle(t("options.autoPause"), () => s.autoPause, (v) => { s.autoPause = v; });

    const row = el("div", "row-btns");
    const ok = el("button", "primary", t("common.close"));
    ok.onclick = () => { ctx.audio.sfx("click"); close(); };
    row.appendChild(ok);
    body.appendChild(row);
  });
}

// ---------- 도감 ----------

// COMPONENT: CollectionOverlay - profile/dex modal for discovered units and hidden recipes.
export function openCollection(ctx: AppCtx) {
  openModal((body, close) => {
    body.classList.add("collection");
    body.appendChild(el("h2", "", "도감"));
    const profile = loadProfile();

    const stats = el("div", "result-stats");
    const kv = (k: string, v: string) => {
      stats.appendChild(el("span", "k", k));
      stats.appendChild(el("span", "", v));
    };
    kv("플레이 횟수", String(profile.runs));
    kv("최고 도달", profile.bestRound > 0 ? `${profile.bestRound}R` : "-");
    kv("선택 가능 맵", `${STAGES.length}/${STAGES.length}`);
    for (const d of DIFFICULTIES) kv(`${d.name} 클리어`, String(profile.clears[d.id] ?? 0));
    kv("유닛 수집", `${profile.seenUnits.length}/${UNITS.length}`);
    kv("히든 조합 발견", `${profile.foundHiddenRecipes.length}/${RECIPES.filter((r) => r.visibility === "hidden").length}`);
    body.appendChild(stats);

    for (const grade of [...GRADE_ORDER].reverse()) {
      const units = UNITS.filter((u) => u.grade === grade);
      if (units.length === 0) continue;
      body.appendChild(el("h3", `grade-head grade-${grade}`, GRADE_LABEL[grade as Grade]));
      const grid = el("div", "dex-grid");
      for (const u of units) {
        const seen = profile.seenUnits.includes(u.id);
        const card = el("div", `dex-card ${seen ? "" : "unseen"}`);
        const chip = el("span", "shape");
        chip.style.cssText = seen
          ? `background:${FAMILY_COLOR[u.family]};border:2px solid ${GRADE_COLOR[u.grade]}`
          : `background:#222633;border:2px solid #333a4f`;
        card.appendChild(chip);
        const info = el("div", "dex-info");
        info.appendChild(el("div", "dex-name", seen ? u.name : "???"));
        info.appendChild(el("div", "dex-meta", seen
          ? `${FAMILY_LABEL[u.family]} · ${u.roles.map((r) => ROLE_LABEL[r]).join("/")} · 공격 ${u.attack} · 속도 ${u.attackSpeed}`
          : "아직 만나지 못했다"));
        if (seen && u.desc) info.appendChild(el("div", "dex-desc", u.desc));
        if (seen && u.skills && u.skills.length > 0) {
          const skText = u.skills.map((sk) => {
            const trig = sk.trigger.kind === "onAttack"
              ? `${Math.round(sk.trigger.chance * 100)}%`
              : `${sk.trigger.everySeconds}s`;
            return `${sk.name}(${trig})`;
          }).join(" · ");
          info.appendChild(el("div", "dex-skill", `⚡ ${skText}`));
        }
        card.appendChild(info);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    }

    if (profile.foundHiddenRecipes.length > 0) {
      body.appendChild(el("h3", "grade-head grade-hidden", "발견한 히든 조합"));
      for (const id of profile.foundHiddenRecipes) {
        const r = RECIPES.find((x) => x.id === id);
        if (r) body.appendChild(el("div", "dex-meta", `· ${id} → ${r.resultUnitId}`));
      }
    }

    const row = el("div", "row-btns");
    const ok = el("button", "primary", "닫기");
    ok.onclick = () => { ctx.audio.sfx("click"); close(); };
    row.appendChild(ok);
    body.appendChild(row);
  });
}

// ---------- 시스템 ----------

export function quitApp() {
  if (isTauri()) {
    try {
      void getCurrentWindow().close();
      return;
    } catch { /* fallthrough */ }
  }
  window.close();
  toast("브라우저 탭은 직접 닫아주세요", "warn");
}

export async function toggleFullscreen() {
  if (isTauri()) {
    try {
      const w = getCurrentWindow();
      const cur = await w.isFullscreen();
      await w.setFullscreen(!cur);
      return;
    } catch { /* fallthrough */ }
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("전체화면 전환 실패", "warn");
  }
}

export { DIFFICULTY_BY_ID };
