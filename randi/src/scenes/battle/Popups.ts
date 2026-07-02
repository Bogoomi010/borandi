import { Container, Graphics, Text } from "pixi.js";
import type { CraftableInfo, Game } from "../../core/engine";
import { gradeLabel } from "../../core/engine";
import type { Family } from "../../core/types";
import { UNIT_BY_ID } from "../../data/units";
import { UPGRADES } from "../../data/upgrades";
import { COLORS, FAMILY_COLORS, FAMILY_LABEL, GRADE_COLORS, VW, VH, font, fontBold } from "../../ui/theme";
import { UiButton, drawPanel, makeGradeStars, makePlaque } from "../../ui/widgets";
import { drawUnitToken } from "../../ui/tokens";

// ===== 조합 가능 알림 팝업 (Poly TD 갈색 패널) =====

export class RecipeToast extends Container {
  private game: Game;
  private sig = "";
  onCraft: (recipeId: string) => void = () => {};

  constructor(game: Game) {
    super();
    this.game = game;
    this.position.set(VW / 2, 120);
  }

  refresh(): void {
    const ready = this.game.readyCrafts().slice(0, 2);
    const sig = ready.map((c) => c.recipe.id).join("|") + `@${this.game.gold >= 0}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (ready.length === 0) return;

    const rowH = 64;
    const w = 470;
    const h = 30 + ready.length * rowH + 24;
    const bg = new Graphics();
    bg.roundRect(-w / 2, 0, w, h, 10).fill({ color: 0x151b24, alpha: 0.94 })
      .stroke({ color: 0xe7b53e, width: 1.2, alpha: 0.55 });
    bg.rect(-w / 2, 1, 3, h - 2).fill({ color: 0xe7b53e, alpha: 0.9 });
    this.addChild(bg);

    const title = new Text({ text: "✦ 조합 가능", style: fontBold(14, 0xffe2a8) });
    title.anchor.set(0.5, 0);
    title.position.set(0, 9);
    this.addChild(title);

    ready.forEach((info, i) => {
      const row = this.buildRow(info, w - 40);
      row.position.set(-w / 2 + 20, 32 + i * rowH);
      this.addChild(row);
    });

    const hintText = new Text({
      text: "선택한 유닛부터 재료로 사용됩니다.",
      style: font(11, { fill: 0x9fe085 }),
    });
    hintText.anchor.set(0.5, 0);
    hintText.position.set(0, h - 21);
    this.addChild(hintText);
  }

  private buildRow(info: CraftableInfo, w: number): Container {
    const row = new Container();
    let x = 0;
    // 재료들
    for (let k = 0; k < info.recipe.ingredients.length; k++) {
      const ing = info.recipe.ingredients[k];
      const def = UNIT_BY_ID[ing.unitId];
      for (let n = 0; n < ing.count; n++) {
        if (k > 0 || n > 0) {
          const plus = new Text({ text: "+", style: fontBold(16, 0x8fd06a) });
          plus.position.set(x, 16);
          row.addChild(plus);
          x += 16;
        }
        const tok = new Graphics();
        drawUnitToken(tok, def, 13);
        tok.position.set(x + 14, 24);
        row.addChild(tok);
        x += 30;
      }
    }
    const arrow = new Text({ text: "➜", style: fontBold(16, 0xffe2a8) });
    arrow.position.set(x + 4, 15);
    row.addChild(arrow);
    x += 28;
    const resTok = new Graphics();
    drawUnitToken(resTok, info.result, 16);
    resTok.position.set(x + 17, 24);
    row.addChild(resTok);
    const resName = new Text({
      text: `${info.result.name}`,
      style: fontBold(14, GRADE_COLORS[info.result.grade]),
    });
    resName.position.set(x + 38, 8);
    const cost = new Text({ text: `${info.recipe.cost.gold}G`, style: font(11, { fill: COLORS.textGold }) });
    cost.position.set(x + 38, 28);
    row.addChild(resName, cost);

    const btn = new UiButton({
      width: 92, height: 36, label: `조합`, tone: "primary", fontSize: 14,
      onClick: () => this.onCraft(info.recipe.id),
    });
    btn.position.set(w - 92, 6);
    row.addChild(btn);
    return row;
  }
}

// ===== 모달 공통 =====

function modalShell(w: number, h: number, title: string): { root: Container; panel: Container } {
  const root = new Container();
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x05070a, alpha: 0.7 });
  dim.eventMode = "static";
  root.addChild(dim);

  const panel = new Container();
  const bg = new Graphics();
  drawPanel(bg, { width: w, height: h, radius: 16, fill: 0x11161f, fillAlpha: 0.96 });
  bg.position.set(-w / 2, -h / 2);
  panel.addChild(bg);
  // 타이틀 명판을 상단 모서리에 겹쳐 얹는다 (콘솔 다이얼로그 문법)
  const plaque = makePlaque(title, 240, 18);
  plaque.position.set(0, -h / 2);
  panel.addChild(plaque);
  panel.position.set(VW / 2, VH / 2);
  root.addChild(panel);
  return { root, panel };
}

// ===== 레시피 도감 =====

export function buildRecipeBook(game: Game, onCraft: (id: string) => void, onClose: () => void): Container {
  const { root, panel } = modalShell(880, 560, "조합 레시피");
  const list = game.craftables();
  const cols = 2;
  list.forEach((info, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cell = new Container();
    const cw = 408, ch = 58;
    const g = new Graphics();
    const hiddenUnknown = info.recipe.visibility === "hidden" && !info.discovered;
    g.roundRect(0, 0, cw, ch, 9).fill(info.haveAll && info.unlocked ? 0x33402e : 0x1e222c)
      .stroke({ color: info.haveAll && info.unlocked ? 0x8fd06a : 0x4d5468, width: 1.5 });
    cell.addChild(g);

    let x = 12;
    for (const ing of info.recipe.ingredients) {
      const def = UNIT_BY_ID[ing.unitId];
      for (let n = 0; n < ing.count; n++) {
        const tok = new Graphics();
        if (hiddenUnknown) {
          tok.circle(0, 0, 11).fill(0x14161c).stroke({ color: 0x4d5468, width: 2 });
        } else {
          drawUnitToken(tok, def, 11);
        }
        tok.position.set(x + 11, ch / 2);
        cell.addChild(tok);
        x += 25;
      }
      x += 5;
    }
    const have = info.recipe.ingredients.map((ing) => `${game.countOf(ing.unitId)}/${ing.count}`).join(" ");
    const arrow = new Text({ text: "➜", style: fontBold(13, 0xc9a35c) });
    arrow.position.set(x + 2, ch / 2 - 9);
    cell.addChild(arrow);
    x += 22;
    const resTok = new Graphics();
    if (hiddenUnknown) {
      resTok.circle(0, 0, 14).fill(0x14161c).stroke({ color: 0x8a4a5a, width: 2 });
    } else {
      drawUnitToken(resTok, info.result, 14);
    }
    resTok.position.set(x + 14, ch / 2);
    cell.addChild(resTok);
    const name = new Text({
      text: hiddenUnknown ? "??? (히든)" : info.result.name,
      style: fontBold(13, hiddenUnknown ? 0x8a8f9a : GRADE_COLORS[info.result.grade]),
    });
    name.position.set(x + 33, 9);
    const meta = new Text({
      text: hiddenUnknown
        ? "특정 조합으로 발견"
        : `${info.recipe.cost.gold}G${info.recipe.minRound ? ` · ${info.recipe.minRound}R+` : ""} · 보유 ${have}`,
      style: font(10.5, { fill: COLORS.textDim }),
    });
    meta.position.set(x + 33, 30);
    cell.addChild(name, meta);

    if (info.haveAll && info.unlocked && info.canAfford && !hiddenUnknown) {
      const btn = new UiButton({
        width: 66, height: 32, label: "조합", tone: "primary", fontSize: 13,
        onClick: () => onCraft(info.recipe.id),
      });
      btn.position.set(cw - 76, ch / 2 - 16);
      cell.addChild(btn);
    }
    cell.position.set(-425 + col * (cw + 18), -222 + row * (ch + 10));
    panel.addChild(cell);
  });

  const close = new UiButton({ width: 130, height: 40, label: "닫기 (R)", fontSize: 14, onClick: onClose });
  close.position.set(-65, 560 / 2 - 58);
  panel.addChild(close);
  return root;
}

// ===== 보스 보상 선택 =====

export function buildSelectorModal(game: Game, onPick: (i: number) => void): Container {
  const offer = game.selectorOffer!;
  const { root, panel } = modalShell(720, 380, `보스 보상 — ${gradeLabel(offer.grade)} 유닛 선택`);
  offer.options.forEach((defId, i) => {
    const def = UNIT_BY_ID[defId];
    const card = new Container();
    const w = 208, h = 250;
    const g = new Graphics();
    g.roundRect(0, 0, w, h, 12).fill(0x1e222c).stroke({ color: GRADE_COLORS[def.grade], width: 2 });
    card.addChild(g);
    const tok = new Graphics();
    drawUnitToken(tok, def, 34);
    tok.position.set(w / 2, 72);
    card.addChild(tok);
    const stars = makeGradeStars(def.grade, 6);
    stars.position.set(w / 2 - stars.width / 2, 116);
    card.addChild(stars);
    const name = new Text({ text: def.name, style: fontBold(16, COLORS.textMain) });
    name.anchor.set(0.5, 0);
    name.position.set(w / 2, 134);
    const desc = new Text({
      text: def.desc,
      style: font(11, { fill: COLORS.textSub, wordWrap: true, wordWrapWidth: w - 28, align: "center", lineHeight: 16 }),
    });
    desc.anchor.set(0.5, 0);
    desc.position.set(w / 2, 162);
    card.addChild(name, desc);
    const btn = new UiButton({
      width: w - 40, height: 36, label: "영입", tone: "primary", fontSize: 14,
      onClick: () => onPick(i),
    });
    btn.position.set(20, h - 48);
    card.addChild(btn);
    card.position.set(-330 + i * (w + 24), -120);
    panel.addChild(card);
  });
  return root;
}

// ===== 결과 모달 =====

export function buildResultModal(
  game: Game,
  victory: boolean,
  unlockedNew: boolean,
  onRetry: () => void,
  onStageSelect: () => void,
): Container {
  const { root, panel } = modalShell(560, 400, victory ? "승  리 !" : "패  배");
  const icon = new Text({ text: victory ? "🏆" : "💀", style: fontBold(52, 0xffffff) });
  icon.anchor.set(0.5);
  icon.position.set(0, -104);
  panel.addChild(icon);

  const headline = new Text({
    text: victory
      ? `40라운드 최종 보스 격파!${unlockedNew ? "\n새로운 맵이 해금되었습니다." : ""}`
      : `${game.round}라운드에서 방어선이 무너졌습니다.`,
    style: fontBold(17, victory ? 0xffd77a : 0xff9a8a, { align: "center", lineHeight: 26 }),
  });
  headline.anchor.set(0.5, 0);
  headline.position.set(0, -66);
  panel.addChild(headline);

  const legendCount = game.units.filter((u) => {
    const g = UNIT_BY_ID[u.defId].grade;
    return g === "legend" || g === "hidden";
  }).length;
  const mins = Math.floor(game.time / 60);
  const stats = new Text({
    text: [
      `${game.stage.name} · ${game.difficulty.name}`,
      `도달 라운드  ${game.round}R      처치  ${game.totalKills}`,
      `보유 유닛  ${game.units.length}      전설 이상  ${legendCount}`,
      `플레이 시간  ${mins}분 ${Math.floor(game.time % 60)}초`,
    ].join("\n"),
    style: font(14, { fill: COLORS.textSub, align: "center", lineHeight: 26 }),
  });
  stats.anchor.set(0.5, 0);
  stats.position.set(0, 4);
  panel.addChild(stats);

  const retry = new UiButton({ width: 180, height: 46, label: "다시 도전", tone: "primary", fontSize: 16, onClick: onRetry });
  retry.position.set(-195, 128);
  const toSelect = new UiButton({ width: 180, height: 46, label: "스테이지 선택", fontSize: 15, onClick: onStageSelect });
  toSelect.position.set(15, 128);
  panel.addChild(retry, toSelect);
  return root;
}

// ===== 진영 강화 =====

export function buildUpgradeModal(
  game: Game,
  onBuy: (family: Family) => void,
  onClose: () => void,
): Container {
  const { root, panel } = modalShell(640, 470, "진영 강화");
  UPGRADES.forEach((up, i) => {
    const row = new Container();
    const w = 560, h = 52;
    const lv = game.famLevels[up.family];
    const cost = game.upgradeCostFor(up.family);
    const maxed = cost === null;
    const affordable = !maxed && game.gold >= cost;

    const g = new Graphics();
    g.roundRect(0, 0, w, h, 9).fill({ color: 0xffffff, alpha: 0.04 });
    g.roundRect(0, 0, 5, h, 3).fill(FAMILY_COLORS[up.family]);
    row.addChild(g);

    const name = new Text({ text: `${FAMILY_LABEL[up.family]} — ${up.name}`, style: fontBold(14, COLORS.textMain) });
    name.position.set(18, 8);
    const desc = new Text({ text: up.desc, style: font(11, { fill: COLORS.textDim }) });
    desc.position.set(18, 30);
    row.addChild(name, desc);

    // 레벨 핍
    const pips = new Graphics();
    for (let p = 0; p < up.maxLevel; p++) {
      pips.roundRect(300 + p * 16, 22, 11, 8, 2)
        .fill(p < lv ? FAMILY_COLORS[up.family] : 0x2a2f3a);
    }
    row.addChild(pips);

    const btn = new UiButton({
      width: 108, height: 38,
      label: maxed ? "MAX" : `${cost}G`,
      tone: maxed ? "normal" : "primary",
      fontSize: 14,
      onClick: () => { if (!maxed) onBuy(up.family); },
    });
    btn.setEnabled(affordable);
    btn.position.set(w - 116, 7);
    row.addChild(btn);

    row.position.set(-w / 2, -175 + i * 60);
    panel.addChild(row);
  });

  const goldText = new Text({ text: `보유 골드  ${game.gold}G`, style: fontBold(14, COLORS.textGold) });
  goldText.anchor.set(0.5);
  goldText.position.set(0, -192);
  panel.addChild(goldText);

  const close = new UiButton({ width: 130, height: 40, label: "닫기 (U)", fontSize: 14, onClick: onClose });
  close.position.set(-65, 470 / 2 - 52);
  panel.addChild(close);
  return root;
}

// ===== 일시정지 =====

export function buildPauseModal(onResume: () => void, onStageSelect: () => void, onTitle: () => void): Container {
  const { root, panel } = modalShell(380, 330, "일시 정지");
  const mk = (label: string, y: number, tone: "primary" | "normal", fn: () => void) => {
    const b = new UiButton({ width: 240, height: 48, label, tone, fontSize: 16, onClick: fn });
    b.position.set(-120, y);
    panel.addChild(b);
  };
  mk("계속하기 (ESC)", -70, "primary", onResume);
  mk("스테이지 선택", -8, "normal", onStageSelect);
  mk("타이틀로", 54, "normal", onTitle);
  const hint = new Text({
    text: "S 소환 · D 조합×3 · R 레시피 · U 강화 · X 판매 · Space 시작 · 1/2/3 배속 · M 음소거",
    style: font(11, { fill: COLORS.textDim }),
  });
  hint.anchor.set(0.5);
  hint.position.set(0, 130);
  panel.addChild(hint);
  return root;
}
