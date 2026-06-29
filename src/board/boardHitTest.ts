import { BOARD_H, BOARD_W, posAtDist } from "../core/path";
import type { GameState } from "../core/types";

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BoardBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function screenToBoard(clientX: number, clientY: number, rect: BoardRect): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * BOARD_W,
    y: ((clientY - rect.top) / rect.height) * BOARD_H,
  };
}

export function unitAtBoardPoint(state: GameState, x: number, y: number): number {
  for (let i = state.units.length - 1; i >= 0; i--) {
    const u = state.units[i];
    if (Math.hypot(u.x - x, u.y - y) < 16) return u.uid;
  }
  return -1;
}

export function enemyAtBoardPoint(state: GameState, x: number, y: number): number {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const p = posAtDist(e.dist, state.stageId);
    const r = e.isBoss ? 48 : 26;
    if (Math.hypot(p.x - x, p.y - y) <= r) return e.eid;
  }
  return -1;
}

export function unitsInBoardBox(state: GameState, box: BoardBox): number[] {
  const minX = Math.min(box.x0, box.x1);
  const maxX = Math.max(box.x0, box.x1);
  const minY = Math.min(box.y0, box.y1);
  const maxY = Math.max(box.y0, box.y1);
  return state.units
    .filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY)
    .map((u) => u.uid);
}
