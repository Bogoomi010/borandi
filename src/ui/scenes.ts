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
import { DIFFICULTY_BY_ID } from "../data/difficulty";
import { getCurrentWindow } from "@tauri-apps/api/window";

// ---------- 씬 전환 ----------

let titleFxStop: (() => void) | null = null;

export function showGame(ctx: AppCtx) {
  ctx.scene = "game";
  document.getElementById("title-scene")!.classList.add("hidden");
  document.getElementById("game-scene")!.classList.remove("hidden");
  titleFxStop?.();
  titleFxStop = null;
}

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

function buildTitle(ctx: AppCtx) {
  const root = document.getElementById("title-content")!;
  root.innerHTML = "";

  const inner = el("div", "title-inner");

  const logo = el("div", "title-logo");
  logo.appendChild(el("div", "title-kicker", "RIFT RANDOM DEFENSE"));
  const h1 = el("h1");
  h1.innerHTML = "차원 균열<br>랜덤 디펜스";
  logo.appendChild(h1);
  logo.appendChild(el("div", "title-sub", "랜덤 소환 · 조합 · 미션 · 보스 — 40라운드를 버텨라"));
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
    grad.addColorStop(0, "rgba(255,95,162,0.10)");
    grad.addColorStop(0.4, "rgba(176,123,255,0.05)");
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

export function openPauseMenu(ctx: AppCtx) {
  if (pauseOpen || ctx.scene !== "game") return;
  pauseOpen = true;
  const wasPaused = ctx.paused;
  ctx.paused = true;
  ctx.refresh();

  const handle = openModal((body, close) => {
    body.classList.add("pause-menu");
    body.appendChild(el("h2", "", "일시정지"));
    const item = (label: string, cb: () => void) => {
      const b = el("button", "title-btn", label);
      b.onclick = () => { ctx.audio.sfx("click"); cb(); };
      body.appendChild(b);
    };
    item("계속하기", () => close());
    item("수동 저장", () => { close(); openSaveModal(ctx); });
    item("불러오기", () => { close(); openLoadModal(ctx); });
    item("옵션", () => openOptionsOverlay(ctx));
    item("타이틀로", () => {
      close();
      ctx.autosave();
      ctx.goTitle();
    });
    item("게임 종료", () => quitApp());
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

export function openOptionsOverlay(ctx: AppCtx) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "옵션"));
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
      const btn = el("button", `opt-toggle ${get() ? "on" : ""}`, get() ? "켜짐" : "꺼짐");
      btn.onclick = () => {
        set(!get());
        btn.classList.toggle("on", get());
        btn.textContent = get() ? "켜짐" : "꺼짐";
        ctx.audio.sfx("click");
        apply();
      };
      row.appendChild(btn);
      body.appendChild(row);
    };

    section("오디오");
    slider("마스터 볼륨", () => s.master, (v) => { s.master = v; });
    slider("효과음", () => s.sfx, (v) => { s.sfx = v; });
    slider("배경 음악", () => s.music, (v) => { s.music = v; });

    section("그래픽");
    toggle("피격 화면 흔들림", () => s.shake, (v) => { s.shake = v; });
    toggle("고대비 모드 (유닛 계열 표시)", () => s.highContrast, (v) => { s.highContrast = v; });
    toggle("데미지 숫자 표시", () => s.showDamage, (v) => { s.showDamage = v; });
    {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", "전체화면"));
      const btn = el("button", "opt-toggle", "전환");
      btn.onclick = () => { ctx.audio.sfx("click"); void toggleFullscreen(); };
      row.appendChild(btn);
      body.appendChild(row);
    }

    section("게임플레이");
    {
      const row = el("div", "opt-row");
      row.appendChild(el("span", "opt-label", "기본 배속"));
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
    toggle("창 비활성 시 자동 일시정지", () => s.autoPause, (v) => { s.autoPause = v; });

    const row = el("div", "row-btns");
    const ok = el("button", "primary", "닫기");
    ok.onclick = () => { ctx.audio.sfx("click"); close(); };
    row.appendChild(ok);
    body.appendChild(row);
  });
}

// ---------- 도감 ----------

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
    kv("입문 클리어", String(profile.clears["novice"] ?? 0));
    kv("보통 클리어", String(profile.clears["normal"] ?? 0));
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
