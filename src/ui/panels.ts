// 상단 상태바 / 좌측 보유 유닛 / 우측 탭 / 하단 액션바 렌더링

import type { AppCtx, RightTab } from "./ctx";
import { el, toast, confirmModal } from "./widgets";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, GRADE_ORDER, type Grade } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { analyzeRecipes, bossOutlook } from "../core/advisor";
import { MISSION_BY_ID } from "../data/missions";
import { waveForRound, FINAL_ROUND, BOSS_ROUND_LIST } from "../data/waves";
import { stageById } from "../data/stages";
import { UPGRADES, upgradeCost } from "../data/upgrades";
import { SUMMON_COST, SELL_REFUND, DIFFICULTY_BY_ID } from "../data/difficulty";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";
import { openSelectorModal } from "./modals";

// ---------- 상단 상태바 ----------

const MANUAL_PROOF_TARGET_SECONDS = 12 * 60;

function clockText(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function renderTopbar(ctx: AppCtx) {
  const root = document.getElementById("topbar")!;
  root.innerHTML = "";
  const s = ctx.game.state;
  const diff = DIFFICULTY_BY_ID[s.difficulty];

  const stat = (label: string, value: string, cls = "") => {
    const d = el("div", "stat");
    d.appendChild(el("span", "label", label));
    d.appendChild(el("span", `value ${cls}`, value));
    return d;
  };

  const stage = stageById(s.stageId);
  root.appendChild(stat("맵", `${stage.id}. ${stage.name}`));
  root.appendChild(stat("맵 목표", "1~40R 고정", "mapgoal"));
  root.appendChild(stat("라운드", `${Math.min(s.round, FINAL_ROUND)}/${FINAL_ROUND}`));
  root.appendChild(stat("적 누적", `${s.enemies.length}/${diff.enemyLimit}`, "life"));
  root.appendChild(stat("골드", String(s.gold), "gold"));
  root.appendChild(stat("난이도", diff.name));
  const proofSeconds = Math.max(0, Math.floor((performance.now() - ctx.runStartedAtMs) / 1000));
  const proofText = proofSeconds >= MANUAL_PROOF_TARGET_SECONDS
    ? "12:00+ 충족"
    : `${clockText(proofSeconds)}/12:00`;
  root.appendChild(stat("수동증거", proofText, proofSeconds >= MANUAL_PROOF_TARGET_SECONDS ? "proof-ok" : "proof-wait"));
  root.appendChild(stat("시드", s.seed));

  const nextBoss = BOSS_ROUND_LIST.find((r) => r >= s.round);
  if (nextBoss !== undefined) {
    root.appendChild(stat("다음 보스", `${nextBoss}R (${nextBoss - s.round}라운드 후)`, "boss"));
  }

  if (s.pendingSelectors.length > 0) {
    const btn = el("button", "pill-btn", `🎁 선택권 ${s.pendingSelectors.length}`);
    btn.onclick = () => openSelectorModal(ctx);
    root.appendChild(btn);
  }

  root.appendChild(el("div", "spacer"));

  // 속도
  const speed = el("div", "speed-btns");
  for (const v of [1, 2, 3] as const) {
    const b = el("button", s.speed === v ? "active" : "", `x${v}`);
    b.onclick = () => { ctx.act("setSpeed", { speed: v }); };
    speed.appendChild(b);
  }
  root.appendChild(speed);

  const pause = el("button", "pill-btn", ctx.paused ? "▶ 재개" : "⏸ 일시정지");
  pause.onclick = () => { ctx.paused = !ctx.paused; ctx.refresh(); };
  root.appendChild(pause);

  const save = el("span", "");
  save.id = "save-status";
  const statusText = {
    idle: "", saving: "저장 중…", saved: "✓ 저장됨", failed: "⚠ 저장 실패 (클릭하여 재시도)",
  }[ctx.saveStatus];
  save.textContent = statusText;
  if (ctx.saveStatus === "failed") {
    save.className = "failed";
    save.onclick = () => ctx.autosave();
  }
  root.appendChild(save);
}

// ---------- 좌측: 보유 유닛 ----------

export function renderLeftPanel(ctx: AppCtx) {
  const root = document.getElementById("left-panel")!;
  root.innerHTML = "";
  const s = ctx.game.state;
  const cap = ctx.game.diff.unitCap;
  const pressure = s.units.length / cap;

  const title = el("div", "panel-title");
  title.appendChild(el("span", "", `보유 유닛 ${s.units.length}/${cap}`));
  root.appendChild(title);

  const bar = el("div", `cap-bar ${pressure >= 0.9 ? "full" : pressure >= 0.7 ? "warn" : ""}`);
  const fill = el("div");
  fill.style.width = `${Math.min(100, pressure * 100)}%`;
  bar.appendChild(fill);
  root.appendChild(bar);
  if (pressure >= 0.9) {
    root.appendChild(el("div", "", "⚠ 소환 전 정리가 필요합니다")).style.cssText =
      "color:var(--danger);font-size:11px";
  }

  // 등급 필터
  const filters = el("div", "filter-row");
  const options = ["all", ...GRADE_ORDER];
  for (const g of options) {
    const label = g === "all" ? "전체" : GRADE_LABEL[g as Grade];
    const b = el("button", ctx.gradeFilter === g ? "active" : "", label);
    b.onclick = () => { ctx.gradeFilter = g; ctx.refresh(); };
    filters.appendChild(b);
  }
  root.appendChild(filters);

  // 유닛 카드 — 동일 유닛은 한 카드로 묶고 보유 수량을 표시한다(과밀 방지).
  const list = el("div", "unit-list");

  // defId별 그룹화 (등급 내림차순 → defId)
  const groups = new Map<string, typeof s.units>();
  for (const u of s.units) {
    const arr = groups.get(u.defId);
    if (arr) arr.push(u);
    else groups.set(u.defId, [u]);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    const ga = GRADE_ORDER.indexOf(UNIT_BY_ID[a].grade);
    const gb = GRADE_ORDER.indexOf(UNIT_BY_ID[b].grade);
    if (ga !== gb) return gb - ga;
    return a.localeCompare(b);
  });

  const sel = ctx.renderer.selectedUids;
  for (const defId of groupKeys) {
    const d = UNIT_BY_ID[defId];
    if (ctx.gradeFilter !== "all" && d.grade !== ctx.gradeFilter) continue;
    const members = groups.get(defId)!;
    const uids = members.map((m) => m.uid);
    const selectedCount = uids.filter((id) => sel.has(id)).length;
    const lockedCount = members.filter((m) => m.locked).length;
    const allLocked = lockedCount === members.length;

    const card = el("div", `unit-card ${selectedCount > 0 ? "selected" : ""}`);

    const shape = el("span", "shape");
    shape.style.cssText = `display:inline-block;width:14px;height:14px;background:${FAMILY_COLOR[d.family]};border:2px solid ${GRADE_COLOR[d.grade]};border-radius:${d.grade === "common" ? "50%" : "3px"}`;
    card.appendChild(shape);

    const name = el("div", "uname");
    const titleRow = el("span", "");
    titleRow.appendChild(document.createTextNode(d.name));
    if (members.length > 1) titleRow.appendChild(el("span", "count", `×${members.length}`));
    name.appendChild(titleRow);
    const subText = selectedCount > 0 && selectedCount < members.length
      ? `${FAMILY_LABEL[d.family]} · ${selectedCount}/${members.length} 선택`
      : `${FAMILY_LABEL[d.family]} · ${d.roles.map((r) => ROLE_LABEL[r]).join("/")}`;
    name.appendChild(el("small", "", subText));
    card.appendChild(name);

    card.appendChild(el("span", `badge grade-${d.grade}`, GRADE_LABEL[d.grade]));

    const lock = el("button", `lock-btn ${lockedCount > 0 ? "locked" : ""}`, allLocked ? "🔒" : lockedCount > 0 ? "🔓*" : "🔓");
    lock.title = allLocked ? "스택 잠금 해제" : "스택 잠금 (판매/조합 보호)";
    lock.onclick = (e) => {
      e.stopPropagation();
      // 일부라도 풀려 있으면 전체 잠금, 모두 잠겨 있으면 전체 해제
      for (const m of members) {
        if (m.locked === allLocked) ctx.act("toggleLock", { unitId: m.uid });
      }
    };
    card.appendChild(lock);

    card.onclick = () => {
      // 스택 전체 선택 토글 (정밀 선택은 전장 캔버스 클릭/드래그 사용)
      if (selectedCount === members.length) {
        for (const id of uids) sel.delete(id);
      } else {
        for (const id of uids) sel.add(id);
      }
      ctx.refresh();
    };
    list.appendChild(card);
  }
  root.appendChild(list);
}

// ---------- 우측: 조합/미션/보스/로그 탭 ----------

export function renderRightPanel(ctx: AppCtx) {
  const root = document.getElementById("right-panel")!;
  root.innerHTML = "";
  const s = ctx.game.state;

  const tabs = el("div", "tabs");
  const defs: Array<{ id: RightTab; label: string; badge: boolean }> = [
    { id: "recipe", label: "조합", badge: analyzeRecipes(s).some((r) => r.tier === "ok" && r.goldShort === 0) },
    {
      id: "mission", label: "미션",
      badge: s.missions.some((m) => {
        if (m.status !== "active") return false;
        const def = MISSION_BY_ID[m.defId];
        return def.visibility === "visible" && def.expireRound !== undefined && def.expireRound - s.round <= 2;
      }),
    },
    { id: "boss", label: "보스", badge: (() => { const b = bossOutlook(s); return !!b && b.roundsLeft <= 2; })() },
    { id: "log", label: "로그", badge: false },
  ];
  for (const t of defs) {
    const b = el("button", ctx.activeTab === t.id ? "active" : "", t.label);
    if (t.badge) b.appendChild(el("span", "dot"));
    b.onclick = () => { ctx.activeTab = t.id; ctx.refresh(); };
    tabs.appendChild(b);
  }
  root.appendChild(tabs);

  switch (ctx.activeTab) {
    case "recipe": renderRecipeTab(ctx, root); break;
    case "mission": renderMissionTab(ctx, root); break;
    case "boss": renderBossTab(ctx, root); break;
    case "log": renderLogTab(ctx, root); break;
  }
}

function renderRecipeTab(ctx: AppCtx, root: HTMLElement) {
  const s = ctx.game.state;
  const statuses = analyzeRecipes(s);

  for (const st of statuses) {
    if (st.tier === "far" && !st.reasonTag) continue; // 너무 먼 조합은 숨겨 과밀 방지
    const d = UNIT_BY_ID[st.recipe.resultUnitId];
    const item = el("div", `recipe-item ${st.needsLocked && st.tier !== "ok" ? "lockwarn" : st.tier}`);

    const head = el("div", "head");
    head.appendChild(el("span", `badge grade-${d.grade}`, GRADE_LABEL[d.grade]));
    head.appendChild(el("span", "rname", st.resultName));
    head.appendChild(el("span", "badge", `${st.recipe.cost.gold}G`));
    item.appendChild(head);

    // 재료 표시
    const mats = el("div", "mats");
    const parts: string[] = [];
    for (const ing of st.recipe.ingredients) {
      const label = ing.unitId ? UNIT_BY_ID[ing.unitId].name : `${ing.grade ?? ""}${ing.family ?? ""}`;
      parts.push(`${label} x${ing.count}`);
    }
    mats.textContent = parts.join(" + ");
    item.appendChild(mats);

    if (st.missing.length > 0) {
      const miss = el("div", "mats");
      miss.innerHTML = `부족: <span class="miss">${st.missing.map((m) => `${m.label} x${m.count}`).join(", ")}</span>`;
      item.appendChild(miss);
    }
    if (st.needsLocked) {
      item.appendChild(el("div", "why", "⚠ 잠금 유닛을 풀면 재료가 충족됩니다"));
    }
    if (st.reasonTag) item.appendChild(el("div", "why", `· ${st.reasonTag}`));
    if (st.recipe.minRound && s.round < st.recipe.minRound) {
      item.appendChild(el("div", "mats", `${st.recipe.minRound}R부터 제작 가능`));
    }

    if (st.tier === "ok") {
      const btn = el("button", "craft-btn", "제작");
      btn.disabled = st.goldShort > 0 ||
        (st.recipe.minRound !== undefined && s.round < st.recipe.minRound);
      if (st.goldShort > 0) btn.textContent = `골드 ${st.goldShort} 부족`;
      btn.onclick = () => ctx.act("craft", { recipeId: st.recipe.id });
      item.appendChild(btn);
    }
    root.appendChild(item);
  }

  if (s.discoveredRecipeIds.length > 0) {
    root.appendChild(el("div", "panel-title", `발견한 히든 조합: ${s.discoveredRecipeIds.length}`));
  }
}

function renderMissionTab(ctx: AppCtx, root: HTMLElement) {
  const s = ctx.game.state;
  const order = { active: 0, done: 1, expired: 2 } as const;
  const missions = [...s.missions].sort((a, b) => order[a.status] - order[b.status]);

  for (const ms of missions) {
    const def = MISSION_BY_ID[ms.defId];
    if (def.visibility === "hidden" && ms.status !== "done") continue; // 히든은 달성 후 공개
    const item = el("div", `mission-item ${ms.status === "done" ? "done" : ms.status === "expired" ? "expired" : "active"}`);

    const head = el("div", "head");
    head.appendChild(el("span", "mname", ms.status === "done" && def.visibility === "hidden"
      ? `[히든] ${def.desc.replace("(히든) ", "")}` : def.name));
    const statusLabel = ms.status === "done" ? "완료" : ms.status === "expired" ? "만료" :
      def.expireRound !== undefined ? `~${def.expireRound}R` : "";
    head.appendChild(el("span", "badge", statusLabel));
    item.appendChild(head);

    item.appendChild(el("div", "cond", def.desc));
    if (ms.status === "active") {
      item.appendChild(el("div", "prog", `진행: ${ctx.game.missionProgress(ms.defId)}`));
    }

    const rewards: string[] = [];
    if (def.reward.gold) rewards.push(`${def.reward.gold}골드`);
    if (def.reward.selector) rewards.push(`${GRADE_LABEL[def.reward.selector.grade]} 선택권`);
    if (def.reward.bossSlowResistReduction) rewards.push("보스 감속 저항 감소");
    if (def.reward.bossKillBonusGold) rewards.push(`보스 보너스 ${def.reward.bossKillBonusGold.gold}골드`);
    item.appendChild(el("div", "rew", `보상: ${rewards.join(", ")}`));

    root.appendChild(item);
  }
}

function renderBossTab(ctx: AppCtx, root: HTMLElement) {
  const s = ctx.game.state;
  const outlook = bossOutlook(s);
  const box = el("div", "boss-info");
  if (!outlook) {
    box.appendChild(el("div", "", "남은 보스가 없습니다."));
  } else {
    const row = (k: string, v: string, cls = "") => {
      const r = el("div", "row");
      r.appendChild(el("span", "k", k));
      r.appendChild(el("span", cls, v));
      return r;
    };
    box.appendChild(row("다음 보스", `${outlook.name} (${outlook.round}R)`));
    box.appendChild(row("남은 라운드", String(outlook.roundsLeft)));
    box.appendChild(row("약점", outlook.weakness));
    box.appendChild(row("예상 위험도", outlook.riskText,
      outlook.risk === "ok" ? "risk-ok" : outlook.risk === "warn" ? "risk-warn" : "risk-bad"));
    const hint = el("div", "", outlook.hint);
    hint.style.cssText = "color:var(--text-dim);font-size:11px;margin-top:4px";
    box.appendChild(hint);

    // 처치 기록
    const kills = Object.entries(s.bossKillSeconds);
    if (kills.length > 0) {
      box.appendChild(el("div", "panel-title", "보스 처치 기록"));
      for (const [r, sec] of kills) box.appendChild(row(`${r}R`, `${sec}초`));
    }
  }
  root.appendChild(box);
}

function renderLogTab(ctx: AppCtx, root: HTMLElement) {
  const list = el("div", "log-list");
  const log = ctx.game.state.log.slice(-60);
  for (const evt of log) {
    const cls = evt.kind === "reward" || evt.kind === "mission" ? "evt-gold"
      : evt.kind === "boss" ? "evt-danger"
      : evt.kind === "craft" || evt.kind === "merge" ? "evt-ok" : "";
    list.appendChild(el("div", cls, `[${evt.round}R] ${evt.text}`));
  }
  root.appendChild(list);
}

// ---------- 하단: 선택 유닛 상세 패널 ----------

const ATTACK_TYPE_LABEL: Record<string, string> = {
  physical: "물리", magic: "마법", pierce: "관통", true: "고정",
};
const TARGETING_LABEL: Record<string, string> = {
  first: "선두", last: "후미", highestHp: "최대체력", lowestHp: "최소체력",
};

/** 유닛 패시브 효과를 짧은 칩 문자열 배열로 변환 */
function passiveChips(d: typeof UNIT_BY_ID[string]): string[] {
  const chips: string[] = [];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  if (d.splashRadius) chips.push(`스플래시 ${d.splashRadius}`);
  if (d.slowPct) chips.push(`감속 ${pct(d.slowPct)}/${d.slowDuration ?? 0}s`);
  if (d.stunChance) chips.push(`빙결 ${pct(d.stunChance)}`);
  if (d.bossDamageBonus) chips.push(`보스 +${pct(d.bossDamageBonus)}`);
  if (d.armorBreakPct) chips.push(`방깎 ${pct(d.armorBreakPct)}`);
  if (d.damageAmpPct) chips.push(`피해증폭 ${pct(d.damageAmpPct)}`);
  if (d.killGoldBonus) chips.push(`처치골드 +${d.killGoldBonus}`);
  if (d.executePct) chips.push(`처형 ${pct(d.executePct)}`);
  return chips;
}

export function renderUnitDetail(ctx: AppCtx) {
  const root = document.getElementById("unit-detail");
  if (!root) return;
  root.innerHTML = "";
  const s = ctx.game.state;
  const selUids = [...ctx.renderer.selectedUids];
  const selected = s.units.filter((u) => ctx.renderer.selectedUids.has(u.uid));

  if (selected.length === 0) {
    root.classList.add("empty");
    root.appendChild(el("div", "ud-hint", "유닛을 선택하면 상세 정보가 표시됩니다 (전장 클릭/드래그 또는 좌측 목록)"));
    return;
  }
  root.classList.remove("empty");

  // 여러 기 선택 → 요약
  if (selected.length > 1) {
    const totalAtk = selected.reduce((a, u) => a + UNIT_BY_ID[u.defId].attack, 0);
    const totalDmg = selected.reduce((a, u) => a + u.totalDamage, 0);
    const byGrade = new Map<Grade, number>();
    for (const u of selected) {
      const g = UNIT_BY_ID[u.defId].grade;
      byGrade.set(g, (byGrade.get(g) ?? 0) + 1);
    }
    const gradeText = [...byGrade.entries()]
      .sort((a, b) => GRADE_ORDER.indexOf(b[0]) - GRADE_ORDER.indexOf(a[0]))
      .map(([g, n]) => `${GRADE_LABEL[g]} ${n}`).join(" · ");

    const head = el("div", "ud-head");
    head.appendChild(el("span", "ud-name", `${selected.length}기 선택`));
    head.appendChild(el("span", "badge", gradeText));
    root.appendChild(head);

    const stats = el("div", "ud-stats");
    const stat = (k: string, v: string) => {
      const d = el("div", "ud-stat");
      d.appendChild(el("span", "k", k));
      d.appendChild(el("span", "v", v));
      stats.appendChild(d);
    };
    stat("합계 공격력", String(totalAtk));
    stat("합계 누적피해", Math.round(totalDmg).toLocaleString());
    const merge3 = selUids.length === 3 ? "3합성 가능" : "—";
    stat("3합성", merge3);
    root.appendChild(stats);
    return;
  }

  // 단일 선택 → 상세
  const u = selected[0];
  const d = UNIT_BY_ID[u.defId];

  const shape = el("div", "ud-portrait");
  shape.style.cssText = `background:${FAMILY_COLOR[d.family]};border:3px solid ${GRADE_COLOR[d.grade]};border-radius:${d.grade === "common" ? "50%" : "8px"}`;
  if (u.locked) shape.appendChild(el("span", "ud-lock", "🔒"));
  root.appendChild(shape);

  const main = el("div", "ud-main");

  const head = el("div", "ud-head");
  head.appendChild(el("span", "ud-name", d.name));
  head.appendChild(el("span", `badge grade-${d.grade}`, GRADE_LABEL[d.grade]));
  head.appendChild(el("span", "ud-sub", `${FAMILY_LABEL[d.family]} · ${d.roles.map((r) => ROLE_LABEL[r]).join("/")}`));
  main.appendChild(head);

  const stats = el("div", "ud-stats");
  const stat = (k: string, v: string) => {
    const c = el("div", "ud-stat");
    c.appendChild(el("span", "k", k));
    c.appendChild(el("span", "v", v));
    stats.appendChild(c);
  };
  stat("공격력", `${d.attack} (${ATTACK_TYPE_LABEL[d.attackType]})`);
  stat("공격속도", `${d.attackSpeed.toFixed(2)}/s`);
  stat("사거리", String(d.range));
  stat("타겟", TARGETING_LABEL[d.targeting]);
  stat("누적피해", Math.round(u.totalDamage).toLocaleString());
  main.appendChild(stats);

  const chips = passiveChips(d);
  if (chips.length > 0) {
    const row = el("div", "ud-chips");
    for (const c of chips) row.appendChild(el("span", "ud-chip", c));
    main.appendChild(row);
  } else if (d.desc) {
    main.appendChild(el("div", "ud-desc", d.desc));
  }

  root.appendChild(main);
}

// ---------- 하단 액션바 ----------

export function renderActionbar(ctx: AppCtx) {
  const root = document.getElementById("action-controls")!;
  root.innerHTML = "";
  const s = ctx.game.state;
  const sel = [...ctx.renderer.selectedUids];
  const ended = s.phase === "ended";

  const btn = (label: string, sub: string, opts: {
    disabled?: boolean; primary?: boolean; danger?: boolean; title?: string;
    onClick: () => void;
  }) => {
    const b = el("button", `action-btn ${opts.primary ? "primary" : ""} ${opts.danger ? "danger" : ""}`);
    b.appendChild(el("span", "", label));
    b.appendChild(el("span", "sub", sub));
    b.disabled = !!opts.disabled;
    if (opts.title) b.title = opts.title;
    b.onclick = opts.onClick;
    return b;
  };

  // 소환
  root.appendChild(btn("소환 [Z]", `${SUMMON_COST}골드`, {
    disabled: ended || s.gold < SUMMON_COST || s.units.length >= ctx.game.diff.unitCap,
    title: s.units.length >= ctx.game.diff.unitCap ? "보유칸이 가득 차 소환할 수 없습니다." : "",
    onClick: () => ctx.act("summon"),
  }));

  // 3합성
  const canMergeCount = sel.length === 3;
  root.appendChild(btn("3합성 [X]", canMergeCount ? "선택 3기 합성" : `${sel.length}/3 선택`, {
    disabled: ended || !canMergeCount,
    title: "같은 등급 3기를 선택하세요",
    onClick: () => {
      ctx.act("merge3", { unitIds: sel });
      ctx.renderer.selectedUids.clear();
    },
  }));

  // 판매
  let refund = 0;
  for (const uid of sel) {
    const u = s.units.find((x) => x.uid === uid);
    if (u) refund += SELL_REFUND[UNIT_BY_ID[u.defId].grade];
  }
  root.appendChild(btn("판매 [Del]", sel.length > 0 ? `${sel.length}기 +${refund}G` : "유닛 선택", {
    disabled: ended || sel.length === 0,
    onClick: () => {
      confirmModal("판매 확인", `선택한 ${sel.length}기를 판매하고 ${refund}골드를 받습니다.`, "판매", () => {
        ctx.act("sell", { unitIds: sel });
        ctx.renderer.selectedUids.clear();
      }, true);
    },
  }));

  // 업그레이드
  root.appendChild(btn("업그레이드", "계열 강화", {
    disabled: ended,
    onClick: () => openUpgradeModal(ctx),
  }));

  root.appendChild(el("div", "gap"));

  const inBreak = s.breakTicks > 0;
  const alive = s.enemies.length;
  const limit = DIFFICULTY_BY_ID[s.difficulty].enemyLimit;
  const phaseText = s.phase === "ended"
    ? (s.cleared ? "클리어!" : "게임 종료")
    : inBreak
      ? `${s.round}라운드 대기 — 적 ${alive}/${limit}`
      : `${s.round}라운드 진행 중 — 적 ${alive}/${limit}`;
  root.appendChild(el("div", "", phaseText)).id = "phase-label";

  // 진행 버튼 — 휴식 중에만 "다음 라운드 시작"
  if (inBreak && !ended) {
    const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
    const sub = s.pendingSelectors.length > 0
      ? "🎁 선택권 확인!"
      : wave.type === "boss" ? "⚠ 보스 라운드" : `${wave.enemyName} x${wave.count}`;
    root.appendChild(btn(`${s.round}라운드 시작 [Space]`, sub, {
      primary: true,
      onClick: () => {
        if (s.pendingSelectors.length > 0) openSelectorModal(ctx);
        else ctx.advanceWave();
      },
    }));
  }
}

function openUpgradeModal(ctx: AppCtx) {
  import("./widgets").then(({ openModal }) => {
    openModal((body, close) => {
      const render = () => {
        body.innerHTML = "";
        body.appendChild(el("h2", "", "계열 업그레이드"));
        const s = ctx.game.state;
        body.appendChild(el("div", "", `보유 골드: ${s.gold}`)).style.color = "var(--gold)";
        for (const up of UPGRADES) {
          const lv = s.upgrades[up.id] ?? 0;
          const cost = upgradeCost(up, lv);
          const row = el("div", "slot-card");
          const left = el("div");
          left.appendChild(el("div", "", `${up.name} — Lv.${lv}/${up.maxLevel}`));
          const effText = up.stat === "killGold"
            ? `5킬당 +${lv}골드 → +${lv + 1}골드`
            : `+${Math.round(up.effectPerLevel * 100 * lv)}% → +${Math.round(up.effectPerLevel * 100 * (lv + 1))}%`;
          left.appendChild(el("div", "meta", effText));
          row.appendChild(left);
          const buy = el("button", "craft-btn", lv >= up.maxLevel ? "최대" : `${cost}G`);
          (buy as HTMLButtonElement).disabled = lv >= up.maxLevel || s.gold < cost;
          buy.onclick = (e) => {
            e.stopPropagation();
            if (ctx.act("upgrade", { upgradeId: up.id })) render();
          };
          row.appendChild(buy);
          body.appendChild(row);
        }
        const btns = el("div", "row-btns");
        const closeBtn = el("button", "primary", "닫기");
        closeBtn.onclick = close;
        btns.appendChild(closeBtn);
        body.appendChild(btns);
      };
      render();
    });
  });
}

export { toast };
