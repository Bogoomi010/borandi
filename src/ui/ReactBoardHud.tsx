import { useRef, type CSSProperties, type ReactNode } from "react";
import type { RuntimeSnapshot } from "../runtimeBridge";
import type { UnitDef } from "../core/types";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL } from "../core/types";
import { analyzeRecipes } from "../core/advisor";
import { UNIT_BY_ID } from "../data/units";
import { FAMILY_COLOR, GRADE_COLOR } from "./boardPalette";
import { getRuntimeControls } from "../runtimeBridge";

interface RuntimeProps {
  runtime: RuntimeSnapshot | null;
}

const ATTACK_TYPE_LABEL: Record<string, string> = {
  physical: "물리",
  magic: "마법",
  pierce: "관통",
  true: "고정",
};

const TARGETING_LABEL: Record<string, string> = {
  first: "선두",
  last: "후미",
  highestHp: "최대체력",
  lowestHp: "최소체력",
};

function passiveChips(def: UnitDef): string[] {
  const chips: string[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  if (def.splashRadius) chips.push(`스플래시 ${def.splashRadius}`);
  if (def.slowPct) chips.push(`감속 ${pct(def.slowPct)}/${def.slowDuration ?? 0}s`);
  if (def.stunChance) chips.push(`기절 ${pct(def.stunChance)}`);
  if (def.bossDamageBonus) chips.push(`보스 +${pct(def.bossDamageBonus)}`);
  if (def.armorBreakPct) chips.push(`방깎 ${pct(def.armorBreakPct)}`);
  if (def.damageAmpPct) chips.push(`피해증폭 ${pct(def.damageAmpPct)}`);
  if (def.killGoldBonus) chips.push(`처치골드 +${def.killGoldBonus}`);
  if (def.executePct) chips.push(`처형 ${pct(def.executePct)}`);
  return chips;
}

function Stat({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`ud-stat ${emphasis ? "emphasis" : ""}`}>
      {icon ? <span className={`ui-icon icon-${icon}`} /> : null}
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

function Slot({ label, active = true, icon = active ? "passive" : "" }: { label: string; active?: boolean; icon?: string }) {
  return (
    <div className={`ud-slot ${active ? "active" : ""}`} title={label}>
      {icon ? <span className={`ui-icon icon-${icon}`} /> : null}
      <span className="ud-slot-label">{label}</span>
    </div>
  );
}

export function ReactUnitDetail({ runtime }: RuntimeProps) {
  const selected = runtime
    ? runtime.state.units.filter((unit) => runtime.selectedUids.has(unit.uid))
    : [];

  if (!runtime || runtime.scene !== "game" || selected.length !== 1) {
    return <div id="unit-detail" className="hidden" />;
  }

  const unit = selected[0];
  const def = UNIT_BY_ID[unit.defId];
  const chips = passiveChips(def);
  const style = {
    "--unit-color": FAMILY_COLOR[def.family],
    "--grade-color": GRADE_COLOR[def.grade],
  } as CSSProperties;
  const slots: ReactNode[] = [];

  for (const skill of (def.skills ?? []).slice(0, 4)) {
    const rate = skill.trigger.kind === "onAttack"
      ? `${Math.round(skill.trigger.chance * 100)}%`
      : `${skill.trigger.everySeconds}s`;
    slots.push(
      <div className="ud-slot active skill-slot" key={`skill-${skill.name}`} title={`${skill.name} · ${skill.desc}`}>
        <span className={`ui-icon icon-${skill.icon}`} />
        <span className="ud-slot-label">
          {skill.name}
          <span className="ud-slot-rate">{rate}</span>
        </span>
      </div>,
    );
  }

  const fillerLabels = [...chips, ...def.roles.map((role) => ROLE_LABEL[role])];
  for (let index = 0; slots.length < 4 && index < fillerLabels.length; index++) {
    const label = fillerLabels[index];
    slots.push(
      <Slot
        active
        icon={chips.includes(label) ? "passive" : "skill"}
        key={`filler-${label}`}
        label={label}
      />,
    );
  }
  while (slots.length < 4) slots.push(<Slot active={false} key={`empty-${slots.length}`} label="빈 슬롯" />);

  return (
    <div id="unit-detail" style={style}>
      <div className="ud-portrait" style={{ borderRadius: def.grade === "common" ? "50%" : 12 }}>
        <span className="ud-portrait-mark">{def.name.slice(0, 1)}</span>
        <span className="ud-portrait-family">{FAMILY_LABEL[def.family]}</span>
        {unit.locked ? <span className="ud-lock">잠금</span> : null}
      </div>

      <div className="ud-main">
        <div className="ud-head">
          <span className="ud-name">{def.name}</span>
          <span className={`badge grade-${def.grade}`}>{GRADE_LABEL[def.grade]}</span>
          <span className="ud-sub">{FAMILY_LABEL[def.family]} · {def.roles.map((role) => ROLE_LABEL[role]).join("/")}</span>
        </div>

        <div className="ud-power">
          <span className="ui-icon icon-attack" />
          <span className="label">공격력</span>
          <span className="value">{def.attack}</span>
          <span className="type">{ATTACK_TYPE_LABEL[def.attackType]}</span>
        </div>

        <div className="ud-stats">
          <Stat icon="speed" label="공격속도" value={`${def.attackSpeed.toFixed(2)}/s`} />
          <Stat icon="range" label="사거리" value={String(def.range)} />
          <Stat icon="target" label="타겟" value={TARGETING_LABEL[def.targeting]} />
          <Stat emphasis icon="damage" label="누적딜" value={Math.round(unit.totalDamage).toLocaleString()} />
        </div>

        {chips.length > 0 ? (
          <div className="ud-chips">
            {chips.map((chip) => <span className="ud-chip" key={chip}>{chip}</span>)}
          </div>
        ) : def.desc ? (
          <div className="ud-desc">{def.desc}</div>
        ) : null}
      </div>

      <div className="ud-slots">{slots}</div>
    </div>
  );
}

function recipeUsesUnit(recipe: ReturnType<typeof analyzeRecipes>[number]["recipe"], defId: string): boolean {
  const def = UNIT_BY_ID[defId];
  return recipe.ingredients.some((ingredient) => {
    if (ingredient.unitId) return ingredient.unitId === defId;
    if (ingredient.grade && ingredient.grade !== def.grade) return false;
    if (ingredient.family && ingredient.family !== def.family) return false;
    return !!ingredient.grade || !!ingredient.family;
  });
}

function materialText(recipe: ReturnType<typeof analyzeRecipes>[number]["recipe"]) {
  return recipe.ingredients.map((ingredient) => {
    const label = ingredient.unitId ? UNIT_BY_ID[ingredient.unitId].name : `${ingredient.grade ?? ""}${ingredient.family ?? ""}`;
    return `${label} x${ingredient.count}`;
  }).join(" + ");
}

function fmtNumber(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(Math.round(value));
}

interface DpsStat {
  last: number;
  dps: number;
  total: number;
}

export function ReactDpsMeter({ runtime }: RuntimeProps) {
  const statsRef = useRef(new Map<number, DpsStat>());
  const lastTimeRef = useRef(0);
  const runKeyRef = useRef("");

  if (!runtime || runtime.scene !== "game" || !runtime.dpsVisible) {
    return <div id="dps-meter" className="hidden" />;
  }

  const state = runtime.state;
  const runKey = `${state.seed}:${state.difficulty}:${state.stageId}`;
  if (runKeyRef.current !== runKey || state.time < lastTimeRef.current) {
    statsRef.current.clear();
    lastTimeRef.current = 0;
    runKeyRef.current = runKey;
  }

  const dt = state.time - lastTimeRef.current;
  lastTimeRef.current = state.time;

  const alive = new Set<number>();
  const rows = state.units.map((unit) => {
    alive.add(unit.uid);
    const stat = statsRef.current.get(unit.uid) ?? { last: unit.totalDamage, dps: 0, total: unit.totalDamage };
    const delta = unit.totalDamage - stat.last;
    stat.last = unit.totalDamage;
    stat.total = unit.totalDamage;
    if (dt > 0.0001) {
      const instant = Math.max(0, delta) / dt;
      const k = Math.min(1, dt / 1.2);
      stat.dps = stat.dps + (instant - stat.dps) * k;
    }
    statsRef.current.set(unit.uid, stat);
    const def = UNIT_BY_ID[unit.defId];
    return {
      uid: unit.uid,
      name: def.name,
      family: def.family,
      grade: def.grade,
      dps: stat.dps,
      total: stat.total,
      skill: unit.skillDamage,
    };
  });

  for (const uid of [...statsRef.current.keys()]) {
    if (!alive.has(uid)) statsRef.current.delete(uid);
  }

  rows.sort((a, b) => b.dps - a.dps || b.total - a.total);
  const top = rows.slice(0, 8);
  const maxDps = Math.max(1, ...top.map((row) => row.dps));
  const teamDps = rows.reduce((sum, row) => sum + row.dps, 0);
  const teamTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div id="dps-meter">
      <div className="dps-head">
        <span className="dps-title">DPS 미터</span>
        <span className="dps-team">팀 {fmtNumber(teamDps)}/s</span>
      </div>
      {top.length === 0 || teamTotal === 0 ? (
        <div className="dps-empty">전투가 시작되면 표시됩니다.</div>
      ) : (
        <div className="dps-list">
          {top.map((row) => {
            const share = teamTotal > 0 ? row.total / teamTotal : 0;
            const skillPct = row.total > 0 ? Math.round((row.skill / row.total) * 100) : 0;
            return (
              <div className="dps-row" key={row.uid}>
                <span
                  className="dps-dot"
                  style={{
                    background: FAMILY_COLOR[row.family] ?? "#caa",
                    borderColor: GRADE_COLOR[row.grade] ?? "#caa",
                  }}
                />
                <div className="dps-mid">
                  <div className="dps-name-row">
                    <span className="dps-name">{row.name}</span>
                    <span className="dps-val">{fmtNumber(row.dps)}/s</span>
                  </div>
                  <div className="dps-bar">
                    <div
                      className="dps-fill"
                      style={{
                        width: `${Math.round((row.dps / maxDps) * 100)}%`,
                        background: GRADE_COLOR[row.grade] ?? "var(--accent)",
                      }}
                    />
                  </div>
                  <div className="dps-sub">
                    <span>누적 {fmtNumber(row.total)} · 스킬 {skillPct}%</span>
                    <span>{Math.round(share * 100)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ReactRecipeSuggestions({ runtime }: RuntimeProps) {
  const controls = getRuntimeControls();
  const selectedUnits = runtime
    ? runtime.state.units.filter((unit) => runtime.selectedUids.has(unit.uid))
    : [];

  if (!runtime || runtime.scene !== "game" || selectedUnits.length !== 1) {
    return <div id="recipe-suggestions" className="hidden" />;
  }

  const selectedDefId = selectedUnits[0].defId;
  const related = analyzeRecipes(runtime.state)
    .filter((status) => recipeUsesUnit(status.recipe, selectedDefId))
    .slice(0, 8);

  if (related.length === 0) return <div id="recipe-suggestions" className="hidden" />;

  const craftableCount = related.filter((status) =>
    status.tier === "ok" &&
    status.goldShort === 0 &&
    (status.recipe.minRound === undefined || runtime.state.round >= status.recipe.minRound),
  ).length;

  return (
    <div id="recipe-suggestions">
      <div className="rs-title">{craftableCount > 0 ? "조합 가능" : "조합 후보"}</div>
      <div className="rs-icon-list">
        {related.map((status) => {
          const def = UNIT_BY_ID[status.recipe.resultUnitId];
          const roundLocked = status.recipe.minRound !== undefined && runtime.state.round < status.recipe.minRound;
          const canCraft = status.tier === "ok" && status.goldShort === 0 && !roundLocked;
          const warnings = [
            roundLocked ? `${status.recipe.minRound}R부터 제작 가능` : "",
            status.goldShort > 0 ? `골드 ${status.goldShort} 부족` : "",
            status.missing.length > 0 ? `부족 ${status.missing.map((missing) => `${missing.label} x${missing.count}`).join(", ")}` : "",
            status.needsLocked ? "잠금 유닛을 해제해야 제작 가능" : "",
          ].filter(Boolean);

          return (
            <div className="rs-icon-wrap" key={status.recipe.id}>
              <button className={`rs-unit-icon ${canCraft ? "" : "disabled"}`} title={def.name} type="button">
                <span
                  className="rs-unit-portrait"
                  style={{
                    background: FAMILY_COLOR[def.family],
                    borderColor: GRADE_COLOR[def.grade],
                    borderRadius: def.grade === "common" ? "50%" : 7,
                  }}
                />
                <span className="rs-unit-name">{def.name}</span>
              </button>
              <div className="rs-popover">
                <div className="head">
                  <span className={`badge grade-${def.grade}`}>{GRADE_LABEL[def.grade]}</span>
                  <span className="rname">{status.resultName}</span>
                  <span className="badge">{status.recipe.cost.gold}G</span>
                </div>
                <div className="mats">{materialText(status.recipe)}</div>
                {def.desc ? <div className="why">{def.desc}</div> : null}
                {warnings.map((warning) => <div className="why warn" key={warning}>{warning}</div>)}
                {status.reasonTag ? <div className="why">{status.reasonTag}</div> : null}
                <button
                  className="craft-btn"
                  disabled={!canCraft}
                  onClick={() => controls?.act("craft", { recipeId: status.recipe.id })}
                  type="button"
                >
                  {canCraft ? "제작" : "불가"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
