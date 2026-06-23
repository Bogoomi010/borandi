// 상단 상태바 / 좌측 보유 유닛 / 우측 탭 / 하단 액션바 렌더링

import type { AppCtx, RightTab } from "./ctx";
import { el, toast, confirmModal } from "./widgets";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, GRADE_ORDER, type Grade } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { RELIC_BY_ID } from "../data/relics";
import { analyzeRecipes, bossOutlook } from "../core/advisor";
import { MISSION_BY_ID } from "../data/missions";
import { waveForRound, FINAL_ROUND, BOSS_ROUND_LIST } from "../data/waves";
import { stageById } from "../data/stages";
import { UPGRADES, upgradeCost } from "../data/upgrades";
import { SUMMON_COST, SELL_REFUND, DIFFICULTY_BY_ID } from "../data/difficulty";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";
import { openManualProofGuideModal, openRelicChoiceModal, openSelectorModal } from "./modals";
import { dpsVisible, toggleDps } from "./dpsMeter";
import { skinActionButton, applyNineSlice, applySpriteLocalized, skinByFile } from "./uiSkin";

// ---------- 상단 상태바 ----------

// COMPONENT: Topbar - updates round, enemy count, gold, difficulty, speed, pause, and save status.
export function renderTopbar(ctx: AppCtx) {
  const root = document.getElementById("topbar")!;
  root.innerHTML = "";
  const s = ctx.game.state;
  const diff = DIFFICULTY_BY_ID[s.difficulty];

  const stat = (label: string, value: string, cls = "", iconFile?: string, onClick?: () => void) => {
    const d = el("div", `stat ${onClick ? "clickable" : ""}`);
    const lab = el("span", "label", label);
    // 헤더 아이콘 이미지로 라벨 대체(있으면). 없으면 텍스트 라벨 유지.
    if (iconFile) { lab.classList.add("stat-icon"); lab.title = label; void skinByFile(lab, iconFile); }
    d.appendChild(lab);
    d.appendChild(el("span", `value ${cls}`, value));
    if (onClick) {
      d.title = "수동 밸런스 증거 안내 열기";
      d.onclick = onClick;
    }
    return d;
  };

  const stage = stageById(s.stageId);
  root.appendChild(stat("맵", `${stage.id}. ${stage.name}`, "", "topbar/header-icon-map.png"));
  root.appendChild(stat("라운드", `${Math.min(s.round, FINAL_ROUND)}/${FINAL_ROUND}`, "", "topbar/header-icon-round.png"));
  root.appendChild(stat("적", `${s.enemies.length}/${ctx.game.enemyLimit()}`, "life", "topbar/header-icon-enemy.png"));
  root.appendChild(stat("골드", String(s.gold), "gold", "topbar/header-icon-gold.png"));
  root.appendChild(stat("난이도", diff.name, "", "topbar/header-icon-difficulty.png"));

  const nextBoss = BOSS_ROUND_LIST.find((r) => r >= s.round);
  if (nextBoss !== undefined) {
    root.appendChild(stat("다음 보스", `${nextBoss}R (${nextBoss - s.round}라운드 후)`, "boss", "topbar/header-icon-next-boss.png"));
  }

  if (s.pendingSelectors.length > 0) {
    const btn = el("button", "pill-btn", `🎁 선택권 ${s.pendingSelectors.length}`);
    btn.onclick = () => openSelectorModal(ctx);
    root.appendChild(btn);
  }
  if (s.pendingRelicChoices.length > 0) {
    const btn = el("button", "pill-btn", `✦ 유물 ${s.pendingRelicChoices.length}`);
    btn.onclick = () => openRelicChoiceModal(ctx);
    root.appendChild(btn);
  }

  root.appendChild(el("div", "spacer"));

  // 속도 — 상태별 이미지(일반/선택). 텍스트는 이미지에 베이크되어 있어 숨김(CSS).
  const speed = el("div", "speed-btns");
  for (const v of [1, 2, 3] as const) {
    const active = s.speed === v;
    const b = el("button", active ? "active" : "", `x${v}`);
    void skinByFile(b, `topbar/speed-x${v}${active ? "-selected" : ""}.png`);
    b.onclick = () => { ctx.act("setSpeed", { speed: v }); };
    speed.appendChild(b);
  }
  root.appendChild(speed);

  // 일시정지/재개 — 상태별 아이콘(▶/⏸).
  const pause = el("button", "pill-btn", ctx.paused ? "▶ 재개" : "⏸ 일시정지");
  pause.title = ctx.paused ? "재개" : "일시정지";
  void skinByFile(pause, ctx.paused ? "topbar/btn-play.png" : "topbar/btn-pause.png");
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

// ---------- 우측: 조합/미션/보스/로그 탭 ----------

// COMPONENT: RightPanel - owns the right-side tab shell and delegates to mission/boss/log tabs.
export function renderRightPanel(ctx: AppCtx) {
  const root = document.getElementById("right-panel")!;
  root.innerHTML = "";
  const s = ctx.game.state;

  const tabs = el("div", "tabs");
  const defs: Array<{ id: RightTab; label: string; badge: boolean }> = [
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
    case "mission": renderMissionTab(ctx, root); break;
    case "boss": renderBossTab(ctx, root); break;
    case "log": renderLogTab(ctx, root); break;
  }
}

// COMPONENT: RecipeTab - lists craftable and near-craftable recipes plus craft buttons.
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

void renderRecipeTab;

function recipeUsesUnit(recipe: ReturnType<typeof analyzeRecipes>[number]["recipe"], defId: string): boolean {
  const def = UNIT_BY_ID[defId];
  return recipe.ingredients.some((ing) => {
    if (ing.unitId) return ing.unitId === defId;
    if (ing.grade && ing.grade !== def.grade) return false;
    if (ing.family && ing.family !== def.family) return false;
    return !!ing.grade || !!ing.family;
  });
}

// COMPONENT: RecipeSuggestions - shows only immediately craftable recipes related to selected units.
export function renderRecipeSuggestions(ctx: AppCtx) {
  const root = document.getElementById("recipe-suggestions");
  if (!root) return;
  root.innerHTML = "";

  const s = ctx.game.state;
  const selectedUnits = s.units.filter((u) => ctx.renderer.selectedUids.has(u.uid));
  const selectedDefIds = new Set(selectedUnits.map((u) => u.defId));
  if (selectedDefIds.size === 0) {
    root.classList.add("hidden");
    return;
  }

  const related = analyzeRecipes(s).filter((st) => {
    return [...selectedDefIds].some((defId) => recipeUsesUnit(st.recipe, defId));
  });

  const mergeDefs = selectedUnits.map((u) => UNIT_BY_ID[u.defId]);
  const mergeGrade = mergeDefs[0]?.grade;
  const canShowMerge = selectedUnits.length === 3;
  const canMerge = canShowMerge &&
    mergeGrade !== undefined &&
    mergeGrade !== "legend" &&
    mergeGrade !== "hidden" &&
    !selectedUnits.some((u) => u.locked) &&
    mergeDefs.every((d) => d.grade === mergeGrade);

  if (related.length === 0 && !canShowMerge) {
    root.classList.add("hidden");
    return;
  }

  root.classList.remove("hidden");
  const craftableCount = related.filter((st) =>
    st.tier === "ok" &&
    st.goldShort === 0 &&
    (st.recipe.minRound === undefined || s.round >= st.recipe.minRound),
  ).length + (canMerge ? 1 : 0);
  root.appendChild(el("div", "rs-title", craftableCount > 0 ? "조합 가능" : "조합 후보"));

  const iconList = el("div", "rs-icon-list");

  if (canShowMerge && mergeGrade) {
    const wrap = el("div", "rs-icon-wrap");
    const icon = el("button", `rs-unit-icon ${canMerge ? "" : "disabled"}`) as HTMLButtonElement;
    icon.type = "button";
    icon.title = "3합성";
    const portrait = el("span", "rs-unit-portrait merge-portrait", "3");
    const sameFamily = mergeDefs.every((d) => d.family === mergeDefs[0].family);
    portrait.style.cssText = `background:${sameFamily ? FAMILY_COLOR[mergeDefs[0].family] : "#2b3348"};border-color:${GRADE_COLOR[mergeGrade]};border-radius:8px`;
    icon.appendChild(portrait);
    icon.appendChild(el("span", "rs-unit-name", "3합성"));
    wrap.appendChild(icon);

    const popup = el("div", "rs-popover");
    const head = el("div", "head");
    const nextGrade = GRADE_ORDER[GRADE_ORDER.indexOf(mergeGrade) + 1];
    head.appendChild(el("span", `badge grade-${mergeGrade}`, GRADE_LABEL[mergeGrade]));
    head.appendChild(el("span", "rname", "3합성"));
    if (nextGrade) head.appendChild(el("span", `badge grade-${nextGrade}`, `${GRADE_LABEL[nextGrade]} 획득`));
    popup.appendChild(head);
    popup.appendChild(el("div", "mats", mergeDefs.map((d) => d.name).join(" + ")));
    popup.appendChild(el("div", "why", sameFamily ? "같은 계열 다음 등급 유닛으로 합성" : "다음 등급 무작위 유닛으로 합성"));
    if (selectedUnits.some((u) => u.locked)) popup.appendChild(el("div", "why warn", "잠금 유닛 포함"));
    if (!mergeDefs.every((d) => d.grade === mergeGrade)) popup.appendChild(el("div", "why warn", "같은 등급 3기가 필요"));
    if (mergeGrade === "legend" || mergeGrade === "hidden") popup.appendChild(el("div", "why warn", "이 등급은 3합성 불가"));
    const btn = el("button", "craft-btn", canMerge ? "합성" : "불가") as HTMLButtonElement;
    btn.disabled = !canMerge;
    btn.onclick = () => {
      if (ctx.act("merge3", { unitIds: selectedUnits.map((u) => u.uid) })) {
        ctx.renderer.selectedUids.clear();
        ctx.refresh();
      }
    };
    popup.appendChild(btn);
    wrap.appendChild(popup);
    iconList.appendChild(wrap);
  }

  for (const st of related.slice(0, 8)) {
    const d = UNIT_BY_ID[st.recipe.resultUnitId];
    const roundLocked = st.recipe.minRound !== undefined && s.round < st.recipe.minRound;
    const canCraft = st.tier === "ok" && st.goldShort === 0 && !roundLocked;
    const wrap = el("div", "rs-icon-wrap");

    const icon = el("button", `rs-unit-icon ${canCraft ? "" : "disabled"}`) as HTMLButtonElement;
    icon.type = "button";
    icon.title = d.name;
    const portrait = el("span", "rs-unit-portrait");
    portrait.style.cssText = `background:${FAMILY_COLOR[d.family]};border-color:${GRADE_COLOR[d.grade]};border-radius:${d.grade === "common" ? "50%" : "7px"}`;
    icon.appendChild(portrait);
    icon.appendChild(el("span", "rs-unit-name", d.name));
    wrap.appendChild(icon);

    const popup = el("div", "rs-popover");
    const head = el("div", "head");
    head.appendChild(el("span", `badge grade-${d.grade}`, GRADE_LABEL[d.grade]));
    head.appendChild(el("span", "rname", st.resultName));
    head.appendChild(el("span", "badge", `${st.recipe.cost.gold}G`));
    popup.appendChild(head);

    const mats = el("div", "mats");
    const parts: string[] = [];
    for (const ing of st.recipe.ingredients) {
      const label = ing.unitId ? UNIT_BY_ID[ing.unitId].name : `${ing.grade ?? ""}${ing.family ?? ""}`;
      parts.push(`${label} x${ing.count}`);
    }
    mats.textContent = parts.join(" + ");
    popup.appendChild(mats);
    if (d.desc) popup.appendChild(el("div", "why", d.desc));
    if (roundLocked) {
      popup.appendChild(el("div", "why warn", `${st.recipe.minRound}R부터 제작 가능`));
    }
    if (st.goldShort > 0) {
      popup.appendChild(el("div", "why warn", `골드 ${st.goldShort} 부족`));
    }
    if (st.missing.length > 0) {
      popup.appendChild(el("div", "why warn", `부족: ${st.missing.map((m) => `${m.label} x${m.count}`).join(", ")}`));
    }
    if (st.needsLocked) {
      popup.appendChild(el("div", "why warn", "잠금 유닛을 해제해야 제작 가능"));
    }

    const btn = el("button", "craft-btn", canCraft ? "제작" : "불가") as HTMLButtonElement;
    btn.disabled = !canCraft;
    btn.onclick = () => ctx.act("craft", { recipeId: st.recipe.id });
    popup.appendChild(btn);
    wrap.appendChild(popup);
    iconList.appendChild(wrap);
  }
  root.appendChild(iconList);
}

// COMPONENT: MissionTab - lists active, completed, and expired mission progress.
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

// COMPONENT: BossTab - shows the next boss forecast, risk, weakness, and kill history.
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
  if (s.relicIds.length > 0 || s.pendingRelicChoices.length > 0) {
    box.appendChild(el("div", "panel-title", "보유 유물"));
    if (s.relicIds.length === 0) {
      box.appendChild(el("div", "meta", "아직 선택한 유물이 없습니다."));
    }
    for (const id of s.relicIds) {
      const relic = RELIC_BY_ID[id];
      if (!relic) continue;
      const item = el("div", `relic-row relic-${relic.rarity}`);
      item.appendChild(el("span", "relic-mark", relic.theme === "prism" ? "◇" : relic.theme === "guard" ? "◆" : "✦"));
      const text = el("span");
      text.appendChild(el("strong", "", relic.name));
      text.appendChild(el("small", "", relic.desc));
      item.appendChild(text);
      box.appendChild(item);
    }
    if (s.pendingRelicChoices.length > 0) {
      const pick = el("button", "craft-btn", `유물 선택 ${s.pendingRelicChoices.length}`);
      pick.onclick = () => openRelicChoiceModal(ctx);
      box.appendChild(pick);
    }
  }
  root.appendChild(box);
}

// COMPONENT: LogTab - renders recent game log events in reverse chronological order.
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

// COMPONENT: UnitDetail - renders the selected unit combat HUD over the field.
export function renderUnitDetail(ctx: AppCtx) {
  const root = document.getElementById("unit-detail");
  if (!root) return;
  root.innerHTML = "";
  const s = ctx.game.state;
  const selUids = [...ctx.renderer.selectedUids];
  const selected = s.units.filter((u) => ctx.renderer.selectedUids.has(u.uid));

  if (selected.length === 0) {
    root.classList.add("hidden");
    root.classList.remove("multi");
    return;
  }
  root.classList.remove("hidden", "empty", "multi");

  const stat = (k: string, v: string, emphasis = false, icon = "") => {
    const c = el("div", `ud-stat ${emphasis ? "emphasis" : ""}`);
    if (icon) c.appendChild(el("span", `ui-icon icon-${icon}`, ""));
    c.appendChild(el("span", "k", k));
    c.appendChild(el("span", "v", v));
    return c;
  };

  const slot = (label: string, active = true, icon = active ? "passive" : "") => {
    const d = el("div", `ud-slot ${active ? "active" : ""}`);
    if (icon) d.appendChild(el("span", `ui-icon icon-${icon}`, ""));
    d.appendChild(el("span", "ud-slot-label", label));
    d.title = label;
    // 슬롯 프레임(빈 슬롯 템플릿, 글자 없음). 라벨은 DOM으로 위에 렌더.
    void applyNineSlice(d, active ? "slots.skill" : "slots.empty", { slice: 28, width: 9, fill: false });
    return d;
  };

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

    root.classList.add("multi");

    const portrait = el("div", "ud-portrait multi");
    portrait.appendChild(el("span", "ud-portrait-count", String(selected.length)));
    portrait.appendChild(el("span", "ud-portrait-label", "선택"));
    root.appendChild(portrait);

    const main = el("div", "ud-main");
    const head = el("div", "ud-head");
    head.appendChild(el("span", "ud-name", `${selected.length}기 선택`));
    head.appendChild(el("span", "badge", gradeText));
    main.appendChild(head);

    const power = el("div", "ud-power");
    power.appendChild(el("span", "ui-icon icon-attack", ""));
    power.appendChild(el("span", "label", "합계 공격력"));
    power.appendChild(el("span", "value", String(totalAtk)));
    main.appendChild(power);

    const stats = el("div", "ud-stats");
    stats.appendChild(stat("누적피해", Math.round(totalDmg).toLocaleString(), true, "damage"));
    const merge3 = selUids.length === 3 ? "3합성 가능" : "—";
    stats.appendChild(stat("3합성", merge3, false, "merge"));
    stats.appendChild(stat("선택 수", `${selected.length}기`, false, "target"));
    main.appendChild(stats);
    root.appendChild(main);

    const slots = el("div", "ud-slots");
    for (const [g, n] of [...byGrade.entries()].sort((a, b) => GRADE_ORDER.indexOf(b[0]) - GRADE_ORDER.indexOf(a[0])).slice(0, 4)) {
      slots.appendChild(slot(`${GRADE_LABEL[g]} ${n}`, true, "skill"));
    }
    while (slots.childElementCount < 4) slots.appendChild(slot("빈 슬롯", false));
    root.appendChild(slots);
    return;
  }

  // 단일 선택 → 상세
  const u = selected[0];
  const d = UNIT_BY_ID[u.defId];
  root.style.setProperty("--unit-color", FAMILY_COLOR[d.family]);
  root.style.setProperty("--grade-color", GRADE_COLOR[d.grade]);

  const shape = el("div", "ud-portrait");
  shape.style.borderRadius = d.grade === "common" ? "50%" : "12px";
  shape.appendChild(el("span", "ud-portrait-mark", d.name.slice(0, 1)));
  shape.appendChild(el("span", "ud-portrait-family", FAMILY_LABEL[d.family]));
  if (u.locked) shape.appendChild(el("span", "ud-lock", "잠금"));
  // 캐릭터 이미지 placeholder: 빈 금색 포트레이트 프레임을 테두리로 입힌다.
  // (안의 색/이니셜은 임시 스탠드인 — 추후 유닛 캐릭터 이미지를 넣으면 됨)
  void applyNineSlice(shape, "unit-detail.portrait-frame", { slice: 40, width: 14, fill: false });
  root.appendChild(shape);

  const main = el("div", "ud-main");

  const head = el("div", "ud-head");
  head.appendChild(el("span", "ud-name", d.name));
  head.appendChild(el("span", `badge grade-${d.grade}`, GRADE_LABEL[d.grade]));
  head.appendChild(el("span", "ud-sub", `${FAMILY_LABEL[d.family]} · ${d.roles.map((r) => ROLE_LABEL[r]).join("/")}`));
  main.appendChild(head);

  const power = el("div", "ud-power");
  power.appendChild(el("span", "ui-icon icon-attack", ""));
  power.appendChild(el("span", "label", "공격력"));
  power.appendChild(el("span", "value", String(d.attack)));
  const typeEl = el("span", "type", ATTACK_TYPE_LABEL[d.attackType]);
  // 공격 타입 배지(고정 라벨, 언어별 이미지). magic/physical만 에셋 존재 → 나머지는 텍스트 유지.
  const atKey = d.attackType === "magic" ? "unit-detail.attack-type.magic"
    : d.attackType === "physical" ? "unit-detail.attack-type.physical" : null;
  if (atKey) { typeEl.classList.add("type-skinned"); void applySpriteLocalized(typeEl, atKey); }
  power.appendChild(typeEl);
  main.appendChild(power);

  const stats = el("div", "ud-stats");
  stats.appendChild(stat("공격속도", `${d.attackSpeed.toFixed(2)}/s`, false, "speed"));
  stats.appendChild(stat("사거리", String(d.range), false, "range"));
  stats.appendChild(stat("타겟", TARGETING_LABEL[d.targeting], false, "target"));
  stats.appendChild(stat("누적딜", Math.round(u.totalDamage).toLocaleString(), true, "damage"));
  // 스탯 그리드 프레임(빈 격자, 글자 없음) — 수치는 위에 DOM으로 렌더되어 충돌 없음.
  void applyNineSlice(stats, "unit-detail.stat-grid", { slice: 34, width: 12, fill: false });
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

  const slots = el("div", "ud-slots");
  // 액티브 스킬을 우선 노출 (아이콘 + 발동률 + 설명 툴팁)
  for (const sk of (d.skills ?? []).slice(0, 4)) {
    const cell = el("div", "ud-slot active skill-slot");
    void applyNineSlice(cell, "slots.skill", { slice: 28, width: 9, fill: false });
    cell.appendChild(el("span", `ui-icon icon-${sk.icon}`, ""));
    const rate = sk.trigger.kind === "onAttack"
      ? `${Math.round(sk.trigger.chance * 100)}%`
      : `${sk.trigger.everySeconds}s`;
    const label = el("span", "ud-slot-label", sk.name);
    label.appendChild(el("span", "ud-slot-rate", rate));
    cell.appendChild(label);
    cell.title = `${sk.name} — ${sk.desc}`;
    slots.appendChild(cell);
  }
  // 남는 칸은 패시브/역할로 채움
  const fillerLabels = [...chips, ...d.roles.map((r) => ROLE_LABEL[r])];
  for (let i = 0; slots.childElementCount < 4 && i < fillerLabels.length; i++) {
    const label = fillerLabels[i];
    slots.appendChild(slot(label, true, chips.includes(label) ? "passive" : "skill"));
  }
  while (slots.childElementCount < 4) slots.appendChild(slot("빈 슬롯", false));
  root.appendChild(slots);
}

// ---------- 하단 액션바 ----------

// COMPONENT: Actionbar - builds summon, merge, sell, upgrade, phase, and next-wave controls.
export function renderActionbar(ctx: AppCtx) {
  const root = document.getElementById("action-controls")!;
  root.innerHTML = "";
  const s = ctx.game.state;
  const sel = [...ctx.renderer.selectedUids];
  const ended = s.phase === "ended";

  const btn = (label: string, sub: string, opts: {
    disabled?: boolean; primary?: boolean; danger?: boolean; title?: string; icon?: string;
    onClick: () => void;
  }) => {
    const b = el("button", `action-btn ${opts.primary ? "primary" : ""} ${opts.danger ? "danger" : ""}`);
    skinActionButton(b, opts.icon); // 언어별 완성 버튼 이미지 배경 (에셋 없으면 no-op)
    if (opts.icon) b.appendChild(el("span", `ui-icon icon-${opts.icon}`, ""));
    b.appendChild(el("span", "alabel", label));
    b.appendChild(el("span", "sub", sub));
    b.disabled = !!opts.disabled;
    // 이미지 스킨 시 DOM 텍스트는 숨겨지므로, 라벨+설명을 툴팁으로 보존한다.
    b.title = opts.title || `${label}${sub ? " · " + sub : ""}`;
    b.onclick = opts.onClick;
    return b;
  };

  // 소환
  root.appendChild(btn("소환 [Z]", `${SUMMON_COST}골드`, {
    disabled: ended || s.gold < SUMMON_COST || ctx.game.ownedUnitCount() >= ctx.game.diff.unitCap,
    title: ctx.game.ownedUnitCount() >= ctx.game.diff.unitCap ? "보유칸이 가득 차 소환할 수 없습니다." : "",
    icon: "summon",
    onClick: () => ctx.act("summon"),
  }));

  // 3합성
  const canMergeCount = sel.length === 3;
  root.appendChild(btn("3합성 [X]", canMergeCount ? "선택 3기 합성" : `${sel.length}/3 선택`, {
    disabled: ended || !canMergeCount,
    title: "같은 등급 3기를 선택하세요",
    icon: "merge",
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
    icon: "sell",
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
    icon: "upgrade",
    onClick: () => openUpgradeModal(ctx),
  }));

  const relicSub = s.pendingRelicChoices.length > 0
    ? `${s.pendingRelicChoices.length}개 선택 대기`
    : s.relicIds.length > 0 ? `${s.relicIds.length}개 보유` : "보스 보상";
  root.appendChild(btn("유물", relicSub, {
    disabled: ended || (s.pendingRelicChoices.length === 0 && s.relicIds.length === 0),
    icon: "passive",
    onClick: () => {
      if (s.pendingRelicChoices.length > 0) openRelicChoiceModal(ctx);
      else {
        ctx.activeTab = "boss";
        ctx.refresh();
      }
    },
  }));

  root.appendChild(btn("수동증거", "시작마커/목표", {
    disabled: ended,
    onClick: () => openManualProofGuideModal(ctx),
  }));

  // DPS 미터 토글
  const dpsBtn = btn("DPS [V]", dpsVisible() ? "켜짐" : "꺼짐", {
    icon: "damage",
    onClick: () => { toggleDps(ctx); renderActionbar(ctx); },
  });
  if (dpsVisible()) dpsBtn.classList.add("primary");
  root.appendChild(dpsBtn);

  root.appendChild(el("div", "gap"));

  const inBreak = s.breakTicks > 0;
  const alive = s.enemies.length;
  const limit = ctx.game.enemyLimit();
  const phaseText = s.phase === "ended"
    ? (s.cleared ? "클리어!" : "게임 종료")
    : inBreak
      ? `${s.round}라운드 대기 — 적 ${alive}/${limit}`
      : `${s.round}라운드 진행 중 — 적 ${alive}/${limit}`;
  root.appendChild(el("div", "", phaseText)).id = "phase-label";

  // 진행 버튼 — 휴식 중에만 "다음 라운드 시작"
  if (inBreak && !ended) {
    const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
    const sub = s.pendingRelicChoices.length > 0
      ? "✦ 유물 선택!"
      : s.pendingSelectors.length > 0
        ? "🎁 선택권 확인!"
      : wave.type === "boss" ? "⚠ 보스 라운드" : `${wave.enemyName} x${wave.count}`;
    root.appendChild(btn(`${s.round}라운드 시작 [Space]`, sub, {
      primary: true,
      icon: "skill",
      onClick: () => {
        if (s.pendingRelicChoices.length > 0) openRelicChoiceModal(ctx);
        else if (s.pendingSelectors.length > 0) openSelectorModal(ctx);
        else ctx.advanceWave();
      },
    }));
  }
}

// COMPONENT: UpgradeModal - renders family upgrade purchase controls inside a modal.
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
