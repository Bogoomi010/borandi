// 캔버스 전투판 렌더러 — 에셋 없이 도형과 색으로만 표현한다.
// 등급 = 테두리 색 + 도형, 계열 = 채움 색.

import { BOARD_H, BOARD_W, PATH_LENGTH, WAYPOINTS, posAtDist } from "../core/path";
import type { GameState, Grade } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { waveForRound } from "../data/waves";
import { alien1Walk } from "./sprites";
import { UNIT_SPRITES, type Facing } from "./unitSprites";

const GRADE_COLOR: Record<Grade, string> = {
  common: "#9aa1b5", rare: "#4cc3ff", hero: "#b07bff",
  legend: "#ffb347", hidden: "#ff5fa2",
};
const FAMILY_COLOR: Record<string, string> = {
  flame: "#ff6b4a", frost: "#56c8ff", storm: "#ffe14d",
  iron: "#b8c0cc", void: "#b07bff", forest: "#6fdd8b",
};

const FAMILY_INITIAL: Record<string, string> = {
  flame: "화", frost: "서", storm: "폭", iron: "강", void: "공", forest: "숲",
};

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  selectedUids = new Set<number>();
  /** 고대비 모드: 유닛 위 계열 이니셜 표시 */
  showLabels = false;
  /** 적 피격 데미지 숫자 표시 */
  showDamage = true;
  /** 적 eid별 직전 프레임 HP (데미지 숫자 산출용, 렌더 전용·결정론 무관) */
  private enemyHp = new Map<number, number>();
  /** 떠오르는 데미지 숫자 */
  private floaters: { x: number; y: number; amount: number; born: number }[] = [];
  /** 라운드 종료 후 다음 라운드 자동 시작까지 남은 초 (null이면 표시 안 함) */
  autoStartIn: number | null = null;
  /** 드래그 다중 선택 박스 (보드 좌표, 없으면 null) */
  selectBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** 공격 이동(A) 대기 모드 — 커서 표시용 */
  attackMoveMode = false;
  /** 유닛 좌우 방향 추적 (이동 방향 기반, 스프라이트 facing용) */
  private unitFacing = new Map<number, { x: number; face: Facing }>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context 없음");
    this.ctx = ctx;
  }

  /** 런 전환 시 렌더 전용 상태 초기화 (이전 런의 데미지 숫자/HP 잔재 제거) */
  resetFx() {
    this.enemyHp.clear();
    this.floaters.length = 0;
  }

  /** 화면 좌표 → 논리 보드 좌표 */
  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * BOARD_W,
      y: ((clientY - rect.top) / rect.height) * BOARD_H,
    };
  }

  /** 화면 좌표에 있는 유닛 uid (없으면 -1). 위에 그려진(나중에 추가된) 유닛 우선. */
  unitAt(state: GameState, clientX: number, clientY: number): number {
    const { x, y } = this.toBoard(clientX, clientY);
    for (let i = state.units.length - 1; i >= 0; i--) {
      const u = state.units[i];
      if (Math.hypot(u.x - x, u.y - y) < 16) return u.uid;
    }
    return -1;
  }

  /** 화면 좌표에 있는 적 eid (없으면 -1). 보스 우선·위에 그려진 적 우선. */
  enemyAt(state: GameState, clientX: number, clientY: number): number {
    const { x, y } = this.toBoard(clientX, clientY);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const p = posAtDist(e.dist);
      const r = e.isBoss ? 48 : 26;
      if (Math.hypot(p.x - x, p.y - y) <= r) return e.eid;
    }
    return -1;
  }

  /** 박스(보드 좌표) 안에 들어온 유닛 uid 목록 */
  unitsInBox(state: GameState, box: { x0: number; y0: number; x1: number; y1: number }): number[] {
    const minX = Math.min(box.x0, box.x1), maxX = Math.max(box.x0, box.x1);
    const minY = Math.min(box.y0, box.y1), maxY = Math.max(box.y0, box.y1);
    return state.units
      .filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY)
      .map((u) => u.uid);
  }

  draw(state: GameState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

    // 경로 (사각형 닫힌 루프)
    ctx.lineWidth = 34;
    ctx.strokeStyle = "#1d2230";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0][0], WAYPOINTS[0][1]);
    for (let i = 1; i < WAYPOINTS.length; i++) ctx.lineTo(WAYPOINTS[i][0], WAYPOINTS[i][1]);
    ctx.closePath(); // 루프 닫기
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2c3350";
    ctx.stroke();

    // 진행 방향 화살표
    ctx.fillStyle = "#3a4263";
    for (let d = 200; d < PATH_LENGTH; d += 300) {
      const p = posAtDist(d);
      const p2 = posAtDist(d + 8);
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 유닛
    for (const u of state.units) {
      const def = UNIT_BY_ID[u.defId];
      const s = { x: u.x, y: u.y };
      const selected = this.selectedUids.has(u.uid);
      const justFired = u.cooldown > 0 && u.cooldown > 1 / def.attackSpeed - 0.12;

      // 사거리 표시 (선택 시)
      if (selected) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, def.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(91,140,255,.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // 이동/공격 목적지 안내선
        const o = u.order;
        if (o.kind === "move" || o.kind === "attackMove") {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(o.cx, o.cy); // 우클릭한 명령 지점(대형 슬롯이 아닌)으로 정확히 표시
          ctx.strokeStyle = o.kind === "attackMove" ? "rgba(229,83,75,.5)" : "rgba(108,221,139,.5)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          // 명령 지점 마커
          ctx.fillStyle = o.kind === "attackMove" ? "rgba(229,83,75,.8)" : "rgba(108,221,139,.8)";
          ctx.beginPath();
          ctx.arc(o.cx, o.cy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 선택 표시: 발밑 초록 셀렉션 링
      if (selected) {
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 9, 13, 5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "#6cdd8b";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 좌우 방향 추적 (이동 방향)
      const prevF = this.unitFacing.get(u.uid);
      let face: Facing = prevF?.face ?? "east";
      if (prevF) {
        const dx = u.x - prevF.x;
        if (dx > 0.4) face = "east"; else if (dx < -0.4) face = "west";
      }
      this.unitFacing.set(u.uid, { x: u.x, face });

      // 스프라이트가 등록된 유닛은 애니메이션으로, 아니면 도형으로 표현
      const sprite = UNIT_SPRITES[def.id];
      const drew = sprite
        ? sprite.draw(ctx, s.x, s.y, u.state, face, state.time, u.uid * 2, 96)
        : false;

      if (!drew) {
        ctx.fillStyle = FAMILY_COLOR[def.family];
        ctx.strokeStyle = selected ? "#ffffff" : GRADE_COLOR[def.grade];
        ctx.lineWidth = selected ? 3 : 2;
        this.drawGradeShape(s.x, s.y, def.grade, justFired ? 13 : 11);
        ctx.fill();
        ctx.stroke();

        if (this.showLabels) {
          ctx.fillStyle = "#0b0d12";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(FAMILY_INITIAL[def.family], s.x, s.y + 3);
          ctx.textAlign = "left";
        }
      }

      // 상태/잠금 마커
      if (u.state === "hold") {
        ctx.fillStyle = "#ffd54a";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("H", s.x, s.y - 11);
        ctx.textAlign = "left";
      }
      if (u.locked) {
        ctx.fillStyle = "#ffd54a";
        ctx.font = "9px sans-serif";
        ctx.fillText("L", s.x + 8, s.y - 9);
      }
    }

    // 적 — 외계인 걷기 스프라이트로 표현 (등급/상태는 크기·틴트로 구분)
    // 직전 프레임 HP를 비교해 데미지 숫자를 띄운다(렌더 전용, 게임 상태 불변).
    const prevHp = this.enemyHp;
    this.enemyHp = new Map();
    let boss: GameState["enemies"][number] | null = null;
    for (const e of state.enemies) {
      const p = posAtDist(e.dist);
      if (e.isBoss) boss = e;
      const slowed = e.slows.length > 0;
      const stunned = e.stunUntil > state.time;
      const size = e.isBoss ? 96 : 52;
      const r = size / 2;

      if (this.showDamage) {
        const prev = prevHp.get(e.eid);
        if (prev !== undefined && e.hp < prev - 0.5) {
          this.floaters.push({
            x: p.x + ((e.eid % 5) - 2) * 4,
            y: p.y - r * 0.6,
            amount: prev - e.hp,
            born: state.time,
          });
          if (this.floaters.length > 80) this.floaters.shift();
        }
        this.enemyHp.set(e.eid, e.hp);
      }

      // 진행 방향: 살짝 앞 지점과 비교해 좌우 반전 결정
      const ahead = posAtDist(e.dist + 4);
      const faceLeft = ahead.x < p.x - 0.01;

      // 상태/속성 틴트 (우선순위: 기절 > 둔화 > 장갑 > 보스)
      let tint: string | undefined;
      let tintAlpha = 0.45;
      if (stunned) tint = "#ffe14d";
      else if (slowed) tint = "#56c8ff";
      else if (e.armor > 0) { tint = "#b8c0cc"; tintAlpha = 0.35; }
      else if (e.isBoss) { tint = "#ff5a6a"; tintAlpha = 0.3; }

      // 발밑 그림자 (접지감) — 발이 p.y에 정렬되므로 바로 아래에 깐다
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + r * 0.08, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (alien1Walk.loaded) {
        alien1Walk.draw(ctx, p.x, p.y, state.time, e.eid * 3, size, faceLeft, tint, tintAlpha);
      } else {
        // 스프라이트 로드 전 폴백: 기존 도형 표현
        ctx.beginPath();
        ctx.arc(p.x, p.y, e.isBoss ? 18 : 8, 0, Math.PI * 2);
        ctx.fillStyle = e.isBoss ? "#a13d4e" : e.armor > 0 ? "#6b7384" : "#c75d54";
        ctx.fill();
        ctx.strokeStyle = stunned ? "#ffe14d" : slowed ? "#56c8ff" : "#2a2030";
        ctx.lineWidth = stunned || slowed ? 2.5 : 1.5;
        ctx.stroke();
      }

      // 체력바 (스프라이트 머리 위)
      const w = e.isBoss ? 44 : 20;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const barY = p.y - size * 0.58 - 6; // 캐릭터 머리 위
      ctx.fillStyle = "#000a";
      ctx.fillRect(p.x - w / 2, barY, w, 4);
      ctx.fillStyle = ratio > 0.5 ? "#4cc38a" : ratio > 0.25 ? "#e8a33d" : "#e5534b";
      ctx.fillRect(p.x - w / 2, barY, w * ratio, 4);
    }

    // 데미지 숫자 — 떠오르며 페이드 (0.85초). 게임 시간(state.time) 기준.
    if (this.showDamage && this.floaters.length > 0) {
      ctx.textAlign = "center";
      ctx.font = "bold 12px sans-serif";
      this.floaters = this.floaters.filter((f) => {
        const age = state.time - f.born;
        if (age < 0 || age > 0.85) return false;
        ctx.globalAlpha = Math.max(0, 1 - age / 0.85);
        ctx.fillStyle = "#ffe14d";
        ctx.fillText(`-${Math.round(f.amount).toLocaleString()}`, f.x, f.y - age * 34);
        return true;
      });
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    } else if (this.floaters.length > 0) {
      this.floaters.length = 0; // 옵션 끄면 즉시 정리
    }

    // 보스 체력바 (상단)
    if (boss) {
      const wave = waveForRound(state.round);
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = "#000c";
      ctx.fillRect(BOARD_W / 2 - 220, 8, 440, 22);
      ctx.fillStyle = "#a13d4e";
      ctx.fillRect(BOARD_W / 2 - 218, 10, 436 * ratio, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${wave.enemyName}  ${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`,
        BOARD_W / 2, 23,
      );
      ctx.textAlign = "left";
    }

    // 라운드 사이 휴식 카운트다운 (Space/버튼으로 바로 시작)
    if (state.phase !== "ended" && this.autoStartIn !== null) {
      const secs = Math.ceil(this.autoStartIn);
      ctx.fillStyle = "rgba(255,209,74,.95)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${state.round}라운드 시작까지 ${secs}초 (Space로 바로 시작)`, BOARD_W / 2, BOARD_H - 14);
      ctx.textAlign = "left";
    }

    // 공격 이동(A) 모드 안내
    if (this.attackMoveMode) {
      ctx.fillStyle = "rgba(229,83,75,.95)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("공격 이동: 목표 지점을 좌클릭하세요 (Esc 취소)", BOARD_W / 2, 44);
      ctx.textAlign = "left";
    }

    // 다중 선택 박스
    if (this.selectBox) {
      const b = this.selectBox;
      const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      const w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      ctx.fillStyle = "rgba(108,221,139,.12)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(108,221,139,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
  }

  private drawGradeShape(x: number, y: number, grade: Grade, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    switch (grade) {
      case "common":
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        break;
      case "rare":
        ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
        break;
      case "hero":
        this.polygon(x, y, r, 5);
        break;
      case "legend":
        this.polygon(x, y, r, 6);
        break;
      case "hidden":
        this.star(x, y, r);
        break;
    }
  }

  private polygon(x: number, y: number, r: number, n: number) {
    const ctx = this.ctx;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  private star(x: number, y: number, r: number) {
    const ctx = this.ctx;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
}

export { GRADE_COLOR, FAMILY_COLOR };
