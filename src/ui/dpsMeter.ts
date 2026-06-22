// 실시간 유닛별 DPS 미터 (토글 오버레이) — 렌더 전용, 게임 상태 불변.
// totalDamage 누적값을 인게임 시간(state.time)으로 미분해 DPS를 산출하고 EMA로 평활화한다.

import type { AppCtx } from "./ctx";
import { type Grade } from "../core/types";
import { el } from "./widgets";
import { UNIT_BY_ID } from "../data/units";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";

let visible = false;
let lastTime = 0;
const stats = new Map<number, { last: number; dps: number; total: number }>();

export function dpsVisible() { return visible; }

/** 런 전환 시 누적 표본 초기화 */
export function resetDps() {
  stats.clear();
  lastTime = 0;
}

export function toggleDps(ctx: AppCtx) {
  visible = !visible;
  const root = document.getElementById("dps-meter");
  if (root) root.classList.toggle("hidden", !visible);
  if (visible) renderDpsMeter(ctx);
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

interface DpsRow { uid: number; name: string; family: string; grade: Grade; dps: number; total: number; skill: number }

export function renderDpsMeter(ctx: AppCtx) {
  const root = document.getElementById("dps-meter");
  if (!root) return;
  if (!visible) { root.classList.add("hidden"); return; }
  root.classList.remove("hidden");

  const s = ctx.game.state;
  const t = s.time;
  const dt = t - lastTime;
  lastTime = t;

  const alive = new Set<number>();
  const rows: DpsRow[] = [];
  for (const u of s.units) {
    alive.add(u.uid);
    const st = stats.get(u.uid) ?? { last: u.totalDamage, dps: 0, total: u.totalDamage };
    const delta = u.totalDamage - st.last;
    st.last = u.totalDamage;
    st.total = u.totalDamage;
    if (dt > 0.0001) {
      const inst = Math.max(0, delta) / dt;
      const k = Math.min(1, dt / 1.2); // 약 1.2초 시정수 EMA
      st.dps = st.dps + (inst - st.dps) * k;
    }
    stats.set(u.uid, st);
    const def = UNIT_BY_ID[u.defId];
    rows.push({ uid: u.uid, name: def.name, family: def.family, grade: def.grade, dps: st.dps, total: st.total, skill: u.skillDamage });
  }
  for (const uid of [...stats.keys()]) if (!alive.has(uid)) stats.delete(uid);

  rows.sort((a, b) => b.dps - a.dps || b.total - a.total);
  const top = rows.slice(0, 8);
  const maxDps = Math.max(1, ...top.map((r) => r.dps));
  const teamDps = rows.reduce((a, r) => a + r.dps, 0);
  const teamTotal = rows.reduce((a, r) => a + r.total, 0);

  root.innerHTML = "";
  const head = el("div", "dps-head");
  head.appendChild(el("span", "dps-title", "DPS 미터"));
  head.appendChild(el("span", "dps-team", `팀 ${fmt(teamDps)}/s`));
  root.appendChild(head);

  if (top.length === 0 || teamTotal === 0) {
    root.appendChild(el("div", "dps-empty", "전투가 시작되면 표시됩니다"));
    return;
  }

  const list = el("div", "dps-list");
  for (const r of top) {
    const share = teamTotal > 0 ? r.total / teamTotal : 0;
    const rowEl = el("div", "dps-row");
    const dot = el("span", "dps-dot");
    dot.style.cssText = `background:${FAMILY_COLOR[r.family] ?? "#caa"};border-color:${GRADE_COLOR[r.grade] ?? "#caa"}`;
    rowEl.appendChild(dot);

    const mid = el("div", "dps-mid");
    const nameRow = el("div", "dps-name-row");
    nameRow.appendChild(el("span", "dps-name", r.name));
    nameRow.appendChild(el("span", "dps-val", `${fmt(r.dps)}/s`));
    mid.appendChild(nameRow);

    const bar = el("div", "dps-bar");
    const fill = el("div", "dps-fill");
    fill.style.width = `${Math.round((r.dps / maxDps) * 100)}%`;
    fill.style.background = GRADE_COLOR[r.grade] ?? "var(--accent)";
    bar.appendChild(fill);
    mid.appendChild(bar);

    const sub = el("div", "dps-sub");
    const skillPct = r.total > 0 ? Math.round((r.skill / r.total) * 100) : 0;
    sub.appendChild(el("span", "", `누적 ${fmt(r.total)} · 스킬 ${skillPct}%`));
    sub.appendChild(el("span", "", `${Math.round(share * 100)}%`));
    mid.appendChild(sub);

    rowEl.appendChild(mid);
    list.appendChild(rowEl);
  }
  root.appendChild(list);
}
