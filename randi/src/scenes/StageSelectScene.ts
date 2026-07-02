import { Container, Graphics, Text } from "pixi.js";
import type { Scene, SceneManager } from "./SceneManager";
import { createTitleScene } from "./TitleScene";
import { createBattleScene } from "./BattleScene";
import { STAGES } from "../data/stages";
import { DIFFICULTIES } from "../data/difficulty";
import { buildLoop } from "../core/path";
import { loadProfile } from "../profile";
import { COLORS, VW, VH, font, fontBold } from "../ui/theme";
import { UiButton, chamfer, drawCornerBrackets, makePlaque } from "../ui/widgets";
import { RiftBackdrop } from "../ui/RiftBackdrop";
import type { StageDef } from "../core/types";

export function createStageSelectScene(mgr: SceneManager): Scene {
  const root = new Container();
  const profile = loadProfile();
  let diffIndex = Math.max(0, DIFFICULTIES.findIndex((d) => d.id === profile.lastDifficulty));
  if (diffIndex < 0) diffIndex = 0;
  let selected = Math.min(profile.unlockedStages - 1, STAGES.length - 1);
  let time = 0;

  // 배경: 메뉴와 동일한 '차원 균열' 테마
  const sky = new RiftBackdrop({ glowY: 0.36 });
  root.addChild(sky);

  // 제목 — 앵귤러 명판
  const title = makePlaque("스 테 이 지", 340, 24);
  title.position.set(VW / 2, 56);
  root.addChild(title);

  // ===== 난이도 선택 배지 =====
  const diffBox = new Container();
  const diffBg = new Graphics();
  const diffLabel = new Text({ text: "", style: fontBold(20, 0xf0dcb4) });
  diffLabel.anchor.set(0.5);
  const diffDesc = new Text({ text: "", style: font(12, { fill: COLORS.textDim }) });
  diffDesc.anchor.set(0.5);
  diffDesc.position.set(0, 30);
  const pips = new Container();
  pips.position.set(0, 52);
  const drawDiff = () => {
    const d = DIFFICULTIES[diffIndex];
    diffBg.clear();
    // 배너 형태
    diffBg.poly([-150, -22, 150, -22, 172, 0, 150, 22, -150, 22, -172, 0])
      .fill(0x211a24).stroke({ color: 0x6b4a52, width: 2 });
    diffLabel.text = d.name;
    diffDesc.text = `시작 골드 ${d.startGold} · 유닛 한도 ${d.unitCap} · 적 한계 ${d.enemyLimit}`;
    pips.removeChildren();
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const p = new Graphics();
      p.poly([0, -6, 5, 0, 0, 6, -5, 0]).fill(i <= diffIndex ? 0xd8455f : 0x3a3540)
        .stroke({ color: 0x14161c, width: 1 });
      p.position.set((i - (DIFFICULTIES.length - 1) / 2) * 20, 0);
      pips.addChild(p);
    }
    refreshCards();
  };
  const mkArrow = (dir: -1 | 1) => {
    const a = new Container();
    const g = new Graphics();
    g.poly([dir * 16, 0, -dir * 8, -13, -dir * 8, 13]).fill(0x8fd06a).stroke({ color: 0x3f6b2e, width: 2 });
    a.addChild(g);
    a.eventMode = "static";
    a.cursor = "pointer";
    a.on("pointerup", () => {
      diffIndex = (diffIndex + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
      drawDiff();
    });
    a.position.set(dir * 210, 0);
    return a;
  };
  diffBox.addChild(diffBg, diffLabel, diffDesc, pips, mkArrow(-1), mkArrow(1));
  diffBox.position.set(VW / 2, 136);
  root.addChild(diffBox);

  // ===== 맵 카드 =====
  const cardW = 216, cardH = 320;
  const gap = 26;
  const cards: Container[] = [];
  const cardArea = new Container();
  cardArea.position.set(VW / 2 - ((cardW + gap) * STAGES.length - gap) / 2, 218);
  root.addChild(cardArea);

  function buildCard(stage: StageDef, index: number): Container {
    const c = new Container();
    const locked = index >= profile.unlockedStages;
    const frame = new Graphics();
    c.addChild(frame);

    // 미니맵 프리뷰
    const preview = new Container();
    const pv = new Graphics();
    pv.roundRect(10, 10, cardW - 20, cardH - 96, 8).fill(stage.theme.groundDark);
    // 지면 패턴
    for (let i = 0; i < 14; i++) {
      const x = 20 + ((i * 83) % (cardW - 44));
      const y = 20 + ((i * 57) % (cardH - 122));
      pv.circle(x, y, 2 + (i % 3)).fill({ color: stage.theme.ground, alpha: 0.8 });
    }
    // 경로 축소 렌더
    const loop = buildLoop(stage.loop, 10);
    const sx = (cardW - 56) / 1280, sy = (cardH - 140) / 720;
    const s = Math.min(sx, sy) * 1.9;
    const ox = cardW / 2 - loop.centroid.x * s;
    const oy = (cardH - 96) / 2 + 10 - loop.centroid.y * s;
    const pts = loop.points.filter((_, i) => i % 4 === 0);
    pv.moveTo(pts[0].x * s + ox, pts[0].y * s + oy);
    for (const p of pts) pv.lineTo(p.x * s + ox, p.y * s + oy);
    pv.closePath().stroke({ color: stage.theme.path, width: 9, alpha: 0.95 });
    pv.moveTo(pts[0].x * s + ox, pts[0].y * s + oy);
    for (const p of pts) pv.lineTo(p.x * s + ox, p.y * s + oy);
    pv.closePath().stroke({ color: stage.theme.accent, width: 1.5, alpha: 0.5 });
    preview.addChild(pv);
    c.addChild(preview);

    // 이름/부제
    const name = new Text({ text: stage.name, style: fontBold(19, COLORS.textMain) });
    name.anchor.set(0.5, 0);
    name.position.set(cardW / 2, cardH - 76);
    const sub = new Text({ text: stage.subtitle, style: font(11, { fill: COLORS.textDim }) });
    sub.anchor.set(0.5, 0);
    sub.position.set(cardW / 2, cardH - 50);
    c.addChild(name, sub);

    // 기록
    const d = DIFFICULTIES[diffIndex];
    const key = `${stage.id}:${d.id}`;
    const best = profile.best[key] ?? 0;
    const clearedThis = profile.cleared[key];
    const record = new Text({
      text: clearedThis ? "★ 클리어" : best > 0 ? `최고 ${best}R` : "기록 없음",
      style: fontBold(12, clearedThis ? COLORS.textGold : best > 0 ? COLORS.textSub : COLORS.textDim),
    });
    record.anchor.set(0.5, 0);
    record.position.set(cardW / 2, cardH - 27);
    record.label = "record";
    c.addChild(record);

    // 잠금 오버레이
    if (locked) {
      const lock = new Graphics();
      lock.roundRect(4, 4, cardW - 8, cardH - 8, 10).fill({ color: 0x0b0d12, alpha: 0.72 });
      // 자물쇠
      lock.roundRect(cardW / 2 - 17, cardH / 2 - 12, 34, 28, 5).fill(0x8a8f9a);
      lock.moveTo(cardW / 2 - 10, cardH / 2 - 12).arcTo(cardW / 2 - 10, cardH / 2 - 34, cardW / 2, cardH / 2 - 34, 10)
        .arcTo(cardW / 2 + 10, cardH / 2 - 34, cardW / 2 + 10, cardH / 2 - 12, 10)
        .lineTo(cardW / 2 + 10, cardH / 2 - 12)
        .stroke({ color: 0x8a8f9a, width: 5 });
      lock.circle(cardW / 2, cardH / 2 + 2, 4.5).fill(0x2a2e38);
      const cond = new Text({ text: `이전 맵 40R 클리어 시 해금`, style: font(11, { fill: 0x9aa0ac }) });
      cond.anchor.set(0.5);
      cond.position.set(cardW / 2, cardH / 2 + 38);
      c.addChild(lock, cond);
    }

    const redrawFrame = (hover: boolean) => {
      const isSel = selected === index && !locked;
      frame.clear();
      if (isSel) {
        chamfer(frame, -5, -5, cardW + 10, cardH + 10, 16).stroke({ color: 0xf6d365, width: 5, alpha: 0.15 });
      }
      chamfer(frame, 0, 0, cardW, cardH, 13).fill(locked ? 0x10141c : 0x151b24);
      chamfer(frame, 0, 0, cardW, cardH, 13)
        .stroke({ color: isSel ? 0xf6d365 : hover && !locked ? 0x6fb8ff : 0x384452, width: isSel ? 2.5 : 1.5, alpha: 0.95 });
      if (!locked) {
        drawCornerBrackets(frame, cardW, cardH, 5, 12, isSel ? 0xf6d365 : 0xe7b53e, isSel ? 0.9 : 0.35);
      }
    };
    redrawFrame(false);
    (c as Container & { redrawFrame?: (h: boolean) => void }).label = `card-${index}`;
    c.eventMode = locked ? "none" : "static";
    c.cursor = locked ? "default" : "pointer";
    c.on("pointerover", () => redrawFrame(true));
    c.on("pointerout", () => redrawFrame(false));
    c.on("pointerup", () => {
      if (selected === index) { startRun(); return; }
      selected = index;
      rebuildCards();
    });
    c.position.set(index * (cardW + gap), 0);
    return c;
  }

  function rebuildCards(): void {
    cards.forEach((c) => c.destroy({ children: true }));
    cards.length = 0;
    cardArea.removeChildren();
    STAGES.forEach((s, i) => {
      const card = buildCard(s, i);
      cards.push(card);
      cardArea.addChild(card);
    });
  }

  function refreshCards(): void {
    rebuildCards();
  }

  rebuildCards();

  // ===== 하단 버튼 =====
  const back = new UiButton({
    width: 130, height: 44, label: "← 메인으로", fontSize: 15,
    onClick: () => mgr.goto(createTitleScene),
  });
  back.position.set(40, VH - 74);
  root.addChild(back);

  const startBtn = new UiButton({
    width: 260, height: 54, label: "출 정", sub: "선택한 맵 · 1~40R 고정", tone: "primary", fontSize: 20,
    onClick: () => startRun(),
  });
  startBtn.position.set(VW / 2 - 130, VH - 84);
  root.addChild(startBtn);

  const hint = new Text({
    text: "맵은 새 게임마다 하나를 골라 40라운드까지 고정됩니다. 40R 최종 보스를 잡으면 다음 맵이 해금됩니다.",
    style: font(12, { fill: COLORS.textDim }),
  });
  hint.anchor.set(0.5);
  hint.position.set(VW / 2, VH - 16);
  root.addChild(hint);

  function startRun(): void {
    const stage = STAGES[selected];
    const diff = DIFFICULTIES[diffIndex];
    const p = loadProfile();
    p.lastDifficulty = diff.id;
    localStorage.setItem("randi.profile.v1", JSON.stringify(p));
    const seed = (Date.now() % 0xffffffff) >>> 0;
    mgr.goto((m) => createBattleScene(m, { stage, difficulty: diff, seed }));
  }

  drawDiff();

  return {
    root,
    update(dt: number) {
      time += dt;
      sky.update(dt);
      title.y = 56 + Math.sin(time * 1.2) * 2;
    },
    destroy() { root.destroy({ children: true }); },
  };
}
