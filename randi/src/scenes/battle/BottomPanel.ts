import { Container, Graphics, Text } from "pixi.js";
import type { Game } from "../../core/engine";
import { gradeLabel } from "../../core/engine";
import type { UnitDef } from "../../core/types";
import { UNIT_BY_ID } from "../../data/units";
import { SELL_REFUND } from "../../data/difficulty";
import {
  COLORS, FAMILY_LABEL, GRADE_COLORS, ROLE_LABEL, font, fontBold,
} from "../../ui/theme";
import { UiButton, chamfer, drawPanel, drawStatGlyph, makeGradeStars, makeKeycap } from "../../ui/widgets";
import { drawUnitToken } from "../../ui/tokens";

const PANEL_Y = 562;

export class BottomPanel extends Container {
  private game: Game;
  private detail = new Container();
  private inventory = new Container();
  private invSig = "";
  private detailSig = "";

  readonly summonBtn: UiButton;
  readonly mergeBtn: UiButton;
  readonly recipeBtn: UiButton;
  readonly sellBtn: UiButton;
  readonly upgradeBtn: UiButton;

  getSelected: () => number = () => 0;
  onPickDef: (defId: string) => void = () => {};

  constructor(
    game: Game,
    actions: {
      onSummon: () => void; onMerge: () => void; onRecipe: () => void;
      onSell: () => void; onUpgrade: () => void;
    },
  ) {
    super();
    this.game = game;

    // ===== 하단 전체 바 (반투명 오버레이) =====
    const back = new Graphics();
    back.rect(0, PANEL_Y - 6, 1280, 720 - PANEL_Y + 6).fill({ color: 0x0b0d12, alpha: 0.58 });
    back.rect(0, PANEL_Y - 6, 1280, 1).fill({ color: 0xffffff, alpha: 0.07 });
    this.addChild(back);

    // ===== 선택 유닛 상세 (좌) =====
    const detailBg = new Graphics();
    drawPanel(detailBg, { width: 486, height: 138, radius: 10 });
    detailBg.position.set(12, PANEL_Y + 4);
    this.addChild(detailBg);
    this.detail.position.set(12, PANEL_Y + 4);
    this.addChild(this.detail);

    // ===== 보유 유닛 (중) =====
    const invBg = new Graphics();
    drawPanel(invBg, { width: 446, height: 138, radius: 10 });
    invBg.position.set(508, PANEL_Y + 4);
    this.addChild(invBg);
    const invTitle = new Text({ text: "보유 유닛", style: fontBold(12, COLORS.textSub) });
    invTitle.position.set(520, PANEL_Y + 12);
    this.addChild(invTitle);
    this.inventory.position.set(508, PANEL_Y + 4);
    this.addChild(this.inventory);

    // ===== 액션 버튼 (우) — 오버레이 3행 2열 =====
    const bx = 966, bw = 148, bh = 42, gap = 6;
    this.summonBtn = new UiButton({
      width: bw, height: bh, label: "소환", sub: "20G", keycap: "S", tone: "good", fontSize: 15,
      onClick: actions.onSummon,
    });
    this.mergeBtn = new UiButton({
      width: bw, height: bh, label: "조합 ×3", sub: "-", keycap: "D", tone: "primary", fontSize: 14,
      onClick: actions.onMerge,
    });
    this.recipeBtn = new UiButton({
      width: bw, height: bh, label: "레시피", sub: "조합식", keycap: "R", tone: "normal", fontSize: 14,
      onClick: actions.onRecipe,
    });
    this.upgradeBtn = new UiButton({
      width: bw, height: bh, label: "강화", sub: "진영 강화", keycap: "U", tone: "normal", fontSize: 14,
      onClick: actions.onUpgrade,
    });
    this.sellBtn = new UiButton({
      width: bw, height: bh, label: "판매", sub: "-", keycap: "X", tone: "danger", fontSize: 15,
      onClick: actions.onSell,
    });
    const cells: [UiButton, number, number][] = [
      [this.summonBtn, 0, 0], [this.mergeBtn, 1, 0],
      [this.recipeBtn, 0, 1], [this.upgradeBtn, 1, 1],
      [this.sellBtn, 0, 2],
    ];
    for (const [btn, col, row] of cells) {
      btn.position.set(bx + col * (bw + gap), PANEL_Y + 6 + row * (bh + gap));
      this.addChild(btn);
    }
  }

  refresh(): void {
    this.refreshDetail();
    this.refreshInventory();
    this.refreshButtons();
  }

  private refreshButtons(): void {
    const g = this.game;
    const selected = g.unitByUid(this.getSelected());

    // 소환
    const canSummon = g.gold >= g.summonCost && g.units.length < g.difficulty.unitCap && g.freeSlots().length > 0;
    this.summonBtn.setEnabled(canSummon && g.phase !== "victory" && g.phase !== "defeat");
    this.summonBtn.setLabel("소환", `${g.summonCost}G  (${g.units.length}/${g.difficulty.unitCap})`);

    // 3조합
    if (selected) {
      const def = UNIT_BY_ID[selected.defId];
      const count = g.countOf(selected.defId);
      const can = count >= 3 && (def.grade === "common" || def.grade === "rare" || def.grade === "hero");
      this.mergeBtn.setEnabled(can);
      this.mergeBtn.setLabel("조합 ×3", `${def.name} ${count}/3`);
    } else {
      const mergeables = g.mergeableDefs();
      this.mergeBtn.setEnabled(mergeables.length > 0);
      this.mergeBtn.setLabel("조합 ×3", mergeables.length > 0 ? `가능 ${mergeables.length}종` : "유닛 선택");
    }

    // 레시피
    const ready = g.readyCrafts().length;
    this.recipeBtn.setLabel("레시피", ready > 0 ? `가능 ${ready}건!` : "조합식");
    this.recipeBtn.setTone(ready > 0 ? "primary" : "normal");

    // 강화: 살 수 있는 항목 수 표시
    const buyable = (["flame", "frost", "storm", "iron", "void", "forest"] as const)
      .filter((f) => { const c = g.upgradeCostFor(f); return c !== null && g.gold >= c; }).length;
    this.upgradeBtn.setLabel("강화", buyable > 0 ? `가능 ${buyable}종` : "진영 강화");
    this.upgradeBtn.setTone(buyable > 0 ? "good" : "normal");

    // 판매
    if (selected) {
      const def = UNIT_BY_ID[selected.defId];
      this.sellBtn.setEnabled(true);
      this.sellBtn.setLabel("판매", `+${SELL_REFUND[def.grade]}G`);
    } else {
      this.sellBtn.setEnabled(false);
      this.sellBtn.setLabel("판매", "유닛 선택");
    }
  }

  private refreshDetail(): void {
    const g = this.game;
    const sel = g.unitByUid(this.getSelected());
    const sig = sel ? `${sel.uid}:${Math.round(sel.damageDealt / 200)}:${sel.kills}` : "none";
    if (sig === this.detailSig) return;
    this.detailSig = sig;
    this.detail.removeChildren().forEach((c) => c.destroy({ children: true }));

    if (!sel) {
      const hint = new Text({
        text: "유닛을 선택하면 상세 정보가 표시됩니다.\n보드의 유닛을 클릭하세요. 선택 후 빈 칸을 클릭하면 이동합니다.",
        style: font(13, { fill: COLORS.textDim, lineHeight: 22 }),
      });
      hint.position.set(24, 46);
      this.detail.addChild(hint);
      return;
    }

    const def = UNIT_BY_ID[sel.defId];

    // 초상 — 등급 글로우 콘솔 프레임
    const portraitFrame = new Graphics();
    chamfer(portraitFrame, 14, 14, 96, 110, 10).fill(0x0c1017);
    portraitFrame.circle(62, 62, 36).fill({ color: GRADE_COLORS[def.grade], alpha: 0.13 });
    chamfer(portraitFrame, 14, 14, 96, 110, 10)
      .stroke({ color: GRADE_COLORS[def.grade], width: 2, alpha: 0.95 });
    chamfer(portraitFrame, 18, 18, 88, 102, 8)
      .stroke({ color: GRADE_COLORS[def.grade], width: 1, alpha: 0.28 });
    this.detail.addChild(portraitFrame);
    const tok = new Graphics();
    drawUnitToken(tok, def, 30);
    tok.position.set(62, 60);
    this.detail.addChild(tok);
    const stars = makeGradeStars(def.grade, 5.5);
    stars.position.set(62 - (5.5 * 2 + 3) * (starsCount(def) - 1) / 2 - 2, 104);
    this.detail.addChild(stars);

    // 이름 + 등급
    const name = new Text({ text: def.name, style: fontBold(19, COLORS.textMain) });
    name.position.set(124, 12);
    const grade = new Text({
      text: `${gradeLabel(def.grade)} · ${FAMILY_LABEL[def.family]} · ${def.roles.map((r) => ROLE_LABEL[r]).join("/")}`,
      style: fontBold(11.5, GRADE_COLORS[def.grade]),
    });
    grade.position.set(126, 38);
    this.detail.addChild(name, grade);

    // 스탯
    const stats: [string, string][] = [
      ["공격력", String(def.attack)],
      ["공격 속도", def.attackSpeed.toFixed(2)],
      ["사거리", String(def.range)],
      ["피해 유형", { physical: "물리", magic: "마법", pierce: "관통", true: "고정" }[def.attackType]],
    ];
    const glyphKinds: ("atk" | "aspd" | "range" | "type")[] = ["atk", "aspd", "range", "type"];
    stats.forEach(([k, v], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const kx = 126 + col * 120, ky = 60 + row * 22;
      const ic = new Graphics();
      drawStatGlyph(ic, glyphKinds[i], 0x687589);
      ic.scale.set(0.78);
      ic.position.set(kx + 6, ky + 8);
      const kt = new Text({ text: k, style: font(11, { fill: COLORS.textDim }) });
      kt.position.set(kx + 16, ky);
      const vt = new Text({ text: v, style: fontBold(12.5, COLORS.textMain) });
      vt.position.set(kx + 68, ky - 1);
      this.detail.addChild(ic, kt, vt);
    });

    // 누적 기여
    const contrib = new Text({
      text: `누적 피해 ${fmt(sel.damageDealt)} · 처치 ${sel.kills}`,
      style: font(10.5, { fill: COLORS.textDim }),
    });
    contrib.position.set(126, 106);
    this.detail.addChild(contrib);

    // 특성/스킬 아이콘
    const skillX = 372;
    const skillTitle = new Text({ text: "스킬", style: fontBold(11, COLORS.textSub) });
    skillTitle.position.set(skillX, 12);
    this.detail.addChild(skillTitle);
    const skills = def.skills ?? [];
    const passives = passiveSummary(def);
    let iy = 30;
    for (let i = 0; i < skills.length && i < 3; i++) {
      const sk = skills[i];
      const chip = new Container();
      const icon = new Graphics();
      // 룬 슬롯 프레임
      chamfer(icon, 0, 0, 26, 26, 6).fill(0x171226).stroke({ color: 0xe7b53e, width: 1.3, alpha: 0.9 });
      icon.poly([13, 2, 24, 13, 13, 24, 2, 13]).stroke({ color: 0xe7b53e, width: 0.8, alpha: 0.25 });
      drawSkillGlyph(icon, sk.icon);
      const lbl = new Text({
        text: sk.trigger.kind === "onAttack" ? `${Math.round(sk.trigger.chance * 100)}%` : `${sk.trigger.everySeconds}s`,
        style: fontBold(10, 0xffd77a),
      });
      lbl.position.set(31, 1);
      const nm = new Text({ text: sk.name, style: font(10, { fill: COLORS.textSub }) });
      nm.position.set(31, 13);
      chip.addChild(icon, lbl, nm);
      chip.position.set(skillX, iy);
      this.detail.addChild(chip);
      iy += 31;
    }
    if (skills.length === 0) {
      const pv = new Text({ text: passives || "특수 효과 없음", style: font(10.5, { fill: COLORS.textSub, wordWrap: true, wordWrapWidth: 104, lineHeight: 15 }) });
      pv.position.set(skillX, 30);
      this.detail.addChild(pv);
    } else if (passives) {
      const pv = new Text({ text: passives, style: font(9.5, { fill: COLORS.textDim, wordWrap: true, wordWrapWidth: 106 }) });
      pv.position.set(skillX, iy + 2);
      this.detail.addChild(pv);
    }
  }

  private refreshInventory(): void {
    const g = this.game;
    const byDef = new Map<string, number>();
    for (const u of g.units) byDef.set(u.defId, (byDef.get(u.defId) ?? 0) + 1);
    const entries = [...byDef.entries()].sort((a, b) => {
      const ga = gradeOrder(UNIT_BY_ID[a[0]].grade), gb = gradeOrder(UNIT_BY_ID[b[0]].grade);
      return gb - ga || a[0].localeCompare(b[0]);
    });
    const selDef = g.unitByUid(this.getSelected())?.defId ?? "";
    const sig = entries.map(([d, c]) => `${d}:${c}`).join("|") + "@" + selDef;
    if (sig === this.invSig) return;
    this.invSig = sig;
    this.inventory.removeChildren().forEach((c) => c.destroy({ children: true }));

    const cols = 8;
    entries.slice(0, 16).forEach(([defId, count], i) => {
      const def = UNIT_BY_ID[defId];
      const cell = new Container();
      const col = i % cols, row = Math.floor(i / cols);
      const bg = new Graphics();
      const isSel = defId === selDef;
      if (isSel) {
        chamfer(bg, -2.5, -2.5, 53, 53, 8).stroke({ color: 0xf6d365, width: 4, alpha: 0.22 });
      }
      chamfer(bg, 0, 0, 48, 48, 7).fill(isSel ? 0x27324c : 0x151b24)
        .stroke({ color: isSel ? 0xf6d365 : GRADE_COLORS[def.grade], width: isSel ? 2 : 1.3, alpha: 0.9 });
      const tok = new Graphics();
      drawUnitToken(tok, def, 14);
      tok.position.set(24, 22);
      cell.addChild(bg, tok);
      if (count > 1) {
        const badge = new Graphics();
        badge.circle(40, 40, 8.5).fill(0x14161c).stroke({ color: count >= 3 ? 0x9fe085 : 0x5a6170, width: 1.4 });
        const ct = new Text({ text: String(count), style: fontBold(10, count >= 3 ? 0x9fe085 : 0xd8dde6) });
        ct.anchor.set(0.5);
        ct.position.set(40, 40);
        cell.addChild(badge, ct);
      }
      cell.position.set(14 + col * 54, 28 + row * 54);
      cell.eventMode = "static";
      cell.cursor = "pointer";
      cell.on("pointerup", () => this.onPickDef(defId));
      this.inventory.addChild(cell);
    });

    if (entries.length === 0) {
      const empty = new Text({ text: "소환(S)으로 유닛을 확보하세요.", style: font(12, { fill: COLORS.textDim }) });
      empty.position.set(16, 62);
      this.inventory.addChild(empty);
    }
  }
}

function starsCount(def: UnitDef): number {
  return { common: 1, rare: 2, hero: 3, legend: 4, hidden: 5 }[def.grade];
}

function gradeOrder(g: UnitDef["grade"]): number {
  return { common: 0, rare: 1, hero: 2, legend: 3, hidden: 4 }[g];
}

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function passiveSummary(def: UnitDef): string {
  const parts: string[] = [];
  if (def.splashRadius) parts.push(`스플래시 ${def.splashRadius}`);
  if (def.slowPct) parts.push(`둔화 ${Math.round(def.slowPct * 100)}%`);
  if (def.stunChance) parts.push(`기절 ${Math.round(def.stunChance * 100)}%`);
  if (def.bossDamageBonus) parts.push(`보스딜 +${Math.round(def.bossDamageBonus * 100)}%`);
  if (def.armorBreakPct) parts.push(`방깎 ${Math.round(def.armorBreakPct * 100)}%`);
  if (def.damageAmpPct) parts.push(`피해증폭 ${Math.round(def.damageAmpPct * 100)}%`);
  if (def.killGoldBonus) parts.push(`처치골드 +${def.killGoldBonus}`);
  if (def.executePct) parts.push(`처형 ${Math.round(def.executePct * 100)}%`);
  return parts.join(" · ");
}

function drawSkillGlyph(g: Graphics, icon: "skill" | "damage" | "passive" | "summon"): void {
  const cx = 13, cy = 13;
  switch (icon) {
    case "damage":
      g.poly([cx - 6, cy + 6, cx + 2, cy - 8, cx + 1, cy - 1, cx + 7, cy - 4, cx - 1, cy + 8, cx, cy + 2])
        .fill(0xff9a5c);
      break;
    case "passive":
      g.circle(cx, cy, 6).stroke({ color: 0xb08cf0, width: 2 });
      g.circle(cx, cy, 2.4).fill(0xb08cf0);
      break;
    case "summon":
      g.circle(cx, cy - 3, 3.4).fill(0x9fd08a);
      g.roundRect(cx - 4.5, cy + 1, 9, 6, 2).fill(0x9fd08a);
      break;
    default: {
      // 별 모양
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 7 : 3;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.poly(pts).fill(0xffd77a);
      break;
    }
  }
}

export function keycapDeco(): Container {
  return makeKeycap("");
}
