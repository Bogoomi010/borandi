import { Container, Graphics, Text } from "pixi.js";
import type { Game } from "../../core/engine";
import { UNIT_BY_ID } from "../../data/units";
import { bossForRound } from "../../data/waves";
import { COLORS, VW, font, fontBold, GRADE_COLORS } from "../../ui/theme";
import {
  ResourceBadge, UiBar, chamfer, drawGoldIcon, drawSkullIcon, drawUnitCapIcon, drawWaveIcon,
} from "../../ui/widgets";
import { drawUnitToken } from "../../ui/tokens";
import { formatNum } from "./BoardView";

// ===== 상단 HUD =====

export class TopHud extends Container {
  private game: Game;
  private stageLabel: Text;
  private goldBadge: ResourceBadge;
  private killBadge: ResourceBadge;
  private capBadge: ResourceBadge;
  private enemyBadge: ResourceBadge;
  private enemyIconBg: Graphics;

  constructor(game: Game, onPause: () => void, onSpeed: (s: number) => void, getSpeed: () => number) {
    super();
    this.game = game;

    const bar = new Graphics();
    bar.rect(0, 0, VW, 52).fill({ color: 0x0b0d12, alpha: 0.55 });
    bar.rect(0, 51, VW, 1).fill({ color: 0xe7b53e, alpha: 0.16 });
    bar.rect(0, 52, VW, 1).fill({ color: 0x000000, alpha: 0.4 });
    this.addChild(bar);

    // 일시정지(메뉴) 버튼 — 오버레이 아이콘만
    const menuBtn = new Container();
    const mg = new Graphics();
    mg.roundRect(0, 0, 40, 32, 7).fill({ color: 0x000000, alpha: 0.01 });
    for (let i = 0; i < 3; i++) {
      mg.roundRect(10, 9 + i * 6, 20, 2.6, 1.3).fill(0xd8dde6)
        .stroke({ color: 0x0c0e14, width: 0.8, alpha: 0.6 });
    }
    menuBtn.addChild(mg);
    menuBtn.position.set(12, 10);
    menuBtn.eventMode = "static";
    menuBtn.cursor = "pointer";
    menuBtn.on("pointerup", onPause);
    this.addChild(menuBtn);

    // 배속 버튼 — 텍스트 없이 ▶ 화살표 개수로만 표현
    const speeds = [1, 2, 3];
    const speedBtns: { g: Graphics; v: number }[] = [];
    speeds.forEach((v, i) => {
      const c = new Container();
      const g = new Graphics();
      c.addChild(g);
      c.position.set(62 + i * 42, 10);
      c.eventMode = "static";
      c.cursor = "pointer";
      c.on("pointerup", () => { onSpeed(v); redrawSpeeds(); });
      this.addChild(c);
      speedBtns.push({ g, v });
    });
    const redrawSpeeds = () => {
      const cur = getSpeed();
      for (const b of speedBtns) {
        const active = b.v === cur;
        const g = b.g;
        g.clear();
        g.roundRect(0, 0, 38, 32, 7).fill({ color: 0xffffff, alpha: active ? 0.10 : 0.01 });
        for (let k = 0; k < b.v; k++) {
          const x0 = 19 - (b.v * 10 - 2) / 2 + k * 10;
          g.poly([x0, 10, x0 + 8, 16, x0, 22])
            .fill({ color: active ? 0xffe9a8 : 0x8a93a5, alpha: active ? 1 : 0.75 });
        }
      }
    };
    redrawSpeeds();

    // 중앙 스테이지명 — 앵귤러 명판
    const pill = new Graphics();
    const pw = 420, ph = 36, wing = 16;
    pill.poly([
      -pw / 2, 0, -pw / 2 + wing, -ph / 2, pw / 2 - wing, -ph / 2,
      pw / 2, 0, pw / 2 - wing, ph / 2, -pw / 2 + wing, ph / 2,
    ]).fill({ color: 0x10151d, alpha: 0.88 })
      .stroke({ color: 0xe7b53e, width: 1.2, alpha: 0.5 });
    pill.poly([-pw / 2 - 11, 0, -pw / 2 - 4, -4.5, -pw / 2 + 3, 0, -pw / 2 - 4, 4.5])
      .fill({ color: 0xe7b53e, alpha: 0.8 });
    pill.poly([pw / 2 + 11, 0, pw / 2 + 4, -4.5, pw / 2 - 3, 0, pw / 2 + 4, 4.5])
      .fill({ color: 0xe7b53e, alpha: 0.8 });
    const pillC = new Container();
    this.stageLabel = new Text({ text: "", style: fontBold(17, 0xeef2fa) });
    this.stageLabel.anchor.set(0.5);
    pillC.addChild(pill, this.stageLabel);
    pillC.position.set(VW / 2, 26);
    this.addChild(pillC);

    // 우측 재화들
    this.killBadge = new ResourceBadge(drawSkullIcon, "0/40", 96, fontBold(13, 0xd8dde6));
    this.goldBadge = new ResourceBadge(drawGoldIcon, "0", 92);
    this.capBadge = new ResourceBadge(drawUnitCapIcon, "0/0", 88, fontBold(13, 0xa9c1e8));
    this.enemyBadge = new ResourceBadge(drawWaveIcon, "0/0", 88, fontBold(13, 0x7fd0ff));
    this.enemyIconBg = new Graphics();
    this.killBadge.position.set(VW - 388, 13);
    this.goldBadge.position.set(VW - 286, 13);
    this.capBadge.position.set(VW - 188, 13);
    this.enemyBadge.position.set(VW - 94, 13);
    this.addChild(this.killBadge, this.goldBadge, this.capBadge, this.enemyBadge, this.enemyIconBg);
  }

  refresh(): void {
    const g = this.game;
    const roundPart = g.phase === "prep"
      ? `다음 ${g.nextRound}R 준비 중`
      : `${g.round}R — ${g.currentWave?.enemyName ?? ""}`;
    this.stageLabel.text = `${g.stage.name} (${g.difficulty.name})  ·  ${roundPart}`;
    this.killBadge.setValue(`${g.round}/40`);
    this.goldBadge.setValue(String(g.gold));
    this.capBadge.setValue(`${g.units.length}/${g.difficulty.unitCap}`);
    const alive = g.enemies.length;
    const limit = g.difficulty.enemyLimit;
    this.enemyBadge.setValue(`${alive}/${limit}`);
  }
}

// ===== 보스 HP 바 + 준비 타이머 =====

export class CenterStatus extends Container {
  private game: Game;
  private bossBox = new Container();
  private bossName: Text;
  private bossBar: UiBar;
  private bossHpText: Text;
  private bossTimerText: Text;
  private prepBox = new Container();
  private prepText: Text;

  constructor(game: Game, onStartNow: () => void) {
    super();
    this.game = game;

    // 보스 바 — 앵귤러 위협 명판
    const bg = new Graphics();
    bg.poly([
      -240, 21, -228, -4, 228, -4, 240, 21, 228, 44, -228, 44,
    ]).fill({ color: 0x140a0e, alpha: 0.82 })
      .stroke({ color: 0xd85560, width: 1.4, alpha: 0.6 });
    bg.poly([-250, 21, -242, 15, -236, 21, -242, 27]).fill({ color: 0xd85560, alpha: 0.85 });
    bg.poly([250, 21, 242, 15, 236, 21, 242, 27]).fill({ color: 0xd85560, alpha: 0.85 });
    this.bossName = new Text({ text: "", style: fontBold(14, 0xffb9b0) });
    this.bossName.anchor.set(0, 0.5);
    this.bossName.position.set(-226, 10);
    this.bossTimerText = new Text({ text: "", style: fontBold(12, 0xd8a355) });
    this.bossTimerText.anchor.set(1, 0.5);
    this.bossTimerText.position.set(226, 10);
    this.bossBar = new UiBar(452, 12, 0xe25555, 0x2a1216);
    this.bossBar.position.set(-226, 20);
    this.bossHpText = new Text({ text: "", style: fontBold(11, 0xffe3df) });
    this.bossHpText.anchor.set(0.5);
    this.bossHpText.position.set(0, 26.5);
    this.bossBox.addChild(bg, this.bossName, this.bossBar, this.bossHpText, this.bossTimerText);
    this.bossBox.visible = false;
    this.addChild(this.bossBox);

    // 준비 타이머
    const pg = new Graphics();
    pg.roundRect(-150, -2, 300, 42, 12).fill({ color: 0x0c1118, alpha: 0.5 });
    this.prepText = new Text({ text: "", style: fontBold(15, 0xaed6ff) });
    this.prepText.anchor.set(0.5);
    this.prepText.position.set(0, 12);
    const btn = new Text({ text: "▶ 바로 시작 (Space)", style: fontBold(12, 0x9fe085) });
    btn.anchor.set(0.5);
    btn.position.set(0, 30);
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerup", onStartNow);
    this.prepBox.addChild(pg, this.prepText, btn);
    this.prepBox.visible = false;
    this.addChild(this.prepBox);

    this.position.set(VW / 2, 62);
  }

  refresh(): void {
    const g = this.game;
    const boss = g.boss;
    if (boss) {
      this.bossBox.visible = true;
      this.prepBox.visible = false;
      const def = boss.bossId ? bossForRound(g.round) : undefined;
      this.bossName.text = `👑 ${boss.name}${g.bossEnraged ? " (광폭화!)" : ""}`;
      this.bossBar.setRatio(boss.hp / boss.maxHp, g.bossEnraged ? 0xff7a3c : 0xe25555);
      this.bossHpText.text = `${formatNum(boss.hp)} / ${formatNum(boss.maxHp)}`;
      const remain = Math.max(0, 60 - g.bossTimer);
      this.bossTimerText.text = g.bossEnraged ? "잔당 소환 중" : `광폭화까지 ${Math.ceil(remain)}s`;
      this.bossTimerText.style.fill = g.bossEnraged ? 0xff8a70 : 0xd8a355;
      if (def) void def;
    } else if (g.phase === "prep") {
      this.bossBox.visible = false;
      this.prepBox.visible = true;
      this.prepText.text = `${g.nextRound}R 시작까지 ${Math.max(0, Math.ceil(g.prepTimer))}초`;
    } else if (g.phase === "combat" && Number.isFinite(g.roundTimer) && g.roundTimer < 12 && g.enemies.length > 0) {
      // 시간 초과 임박 경고
      this.bossBox.visible = false;
      this.prepBox.visible = true;
      this.prepText.text = `⚠ ${Math.max(0, Math.ceil(g.roundTimer))}초 후 다음 웨이브 난입`;
    } else {
      this.bossBox.visible = false;
      this.prepBox.visible = false;
    }
  }
}

// ===== 좌측 전력 리스트 (딜 기여 순) =====

export class LeftRoster extends Container {
  private game: Game;
  private rows: Container[] = [];
  private bg = new Graphics();
  private title: Text;
  private lastSig = "";

  constructor(game: Game) {
    super();
    this.game = game;
    this.addChild(this.bg);
    this.title = new Text({ text: "전력 기여", style: fontBold(12, COLORS.textSub) });
    this.title.position.set(12, 8);
    this.addChild(this.title);
    this.position.set(14, 96);
  }

  refresh(): void {
    const g = this.game;
    const byDef = new Map<string, { dmg: number; kills: number; count: number }>();
    for (const u of g.units) {
      const cur = byDef.get(u.defId) ?? { dmg: 0, kills: 0, count: 0 };
      cur.dmg += u.damageDealt;
      cur.kills += u.kills;
      cur.count++;
      byDef.set(u.defId, cur);
    }
    const sorted = [...byDef.entries()].sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 7);
    const totalDmg = Math.max(1, [...byDef.values()].reduce((s, v) => s + v.dmg, 0));
    const sig = sorted.map(([id, v]) => `${id}:${v.count}:${Math.round(v.dmg / 500)}`).join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    for (const r of this.rows) r.destroy({ children: true });
    this.rows = [];
    if (sorted.length === 0) { this.bg.clear(); this.title.visible = false; return; }
    this.title.visible = true;

    const w = 196;
    const rowH = 27;
    const h = 30 + sorted.length * rowH + 6;
    this.bg.clear();
    chamfer(this.bg, 0, 0, w, h, 10).fill({ color: 0x0e131b, alpha: 0.58 })
      .stroke({ color: 0x384452, width: 1, alpha: 0.55 });
    this.bg.poly([0, 12, 2.5, 14, 2.5, h - 14, 0, h - 12]).fill({ color: 0xe7b53e, alpha: 0.55 });

    sorted.forEach(([defId, v], i) => {
      const def = UNIT_BY_ID[defId];
      const row = new Container();
      const tok = new Graphics();
      drawUnitToken(tok, def, 9);
      tok.position.set(16, rowH / 2);
      const name = new Text({ text: `${def.name}${v.count > 1 ? ` ×${v.count}` : ""}`, style: font(11, { fill: COLORS.textMain }) });
      name.position.set(30, 2);
      const bar = new Graphics();
      const ratio = v.dmg / totalDmg;
      bar.roundRect(30, 16, 120, 5, 2.5).fill(0x232834);
      bar.roundRect(30, 16, Math.max(3, 120 * ratio), 5, 2.5).fill(GRADE_COLORS[def.grade]);
      const pct = new Text({ text: `${Math.round(ratio * 100)}%`, style: font(10, { fill: COLORS.textDim }) });
      pct.anchor.set(1, 0);
      pct.position.set(w - 10, 12);
      row.addChild(tok, name, bar, pct);
      row.position.set(6, 28 + i * rowH);
      this.addChild(row);
      this.rows.push(row);
    });
  }
}

// ===== 로그 피드 =====

export class LogFeed extends Container {
  private lines: { t: Text; life: number }[] = [];

  constructor() {
    super();
    this.position.set(VW / 2, 508);
  }

  push(text: string, color = 0xcfd6e2): void {
    const t = new Text({
      text,
      style: font(13, { fill: color, stroke: { color: 0x0c0e14, width: 3 } }),
    });
    t.anchor.set(0.5, 1);
    this.addChild(t);
    this.lines.push({ t, life: 5.2 });
    if (this.lines.length > 5) {
      const old = this.lines.shift()!;
      old.t.destroy();
    }
    this.layout();
  }

  private layout(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      l.t.position.set(0, -(this.lines.length - 1 - i) * 20);
    }
  }

  update(dt: number): void {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.life -= dt;
      if (l.life <= 0) {
        l.t.destroy();
        this.lines.splice(i, 1);
        this.layout();
      } else if (l.life < 1) {
        l.t.alpha = l.life;
      }
    }
  }
}
