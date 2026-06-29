import { describe, expect, it } from "vitest";
import type { GameState } from "../core/types";
import {
  enemyAtBoardPoint,
  screenToBoard,
  unitAtBoardPoint,
  unitsInBoardBox,
} from "./boardHitTest";

function state(partial: { stageId: number; units: unknown[]; enemies: unknown[] }): GameState {
  return partial as unknown as GameState;
}

describe("boardHitTest", () => {
  it("maps screen coordinates into the fixed 960x560 board space", () => {
    expect(screenToBoard(500, 300, { left: 20, top: 20, width: 960, height: 560 })).toEqual({
      x: 480,
      y: 280,
    });
  });

  it("picks the topmost unit under a board point", () => {
    const s = state({
      stageId: 1,
      enemies: [],
      units: [
        { uid: 1, x: 100, y: 100 },
        { uid: 2, x: 106, y: 100 },
      ],
    });

    expect(unitAtBoardPoint(s, 104, 100)).toBe(2);
    expect(unitAtBoardPoint(s, 300, 300)).toBe(-1);
  });

  it("picks enemies by path position and boss radius", () => {
    const s = state({
      stageId: 1,
      units: [],
      enemies: [
        { eid: 1, dist: 0, isBoss: false },
        { eid: 2, dist: 0, isBoss: true },
      ],
    });

    expect(enemyAtBoardPoint(s, 120, 80)).toBe(2);
    expect(enemyAtBoardPoint(s, 160, 80)).toBe(-1);
  });

  it("returns units inside a drag-selection box", () => {
    const s = state({
      stageId: 1,
      enemies: [],
      units: [
        { uid: 1, x: 100, y: 100 },
        { uid: 2, x: 200, y: 200 },
        { uid: 3, x: 500, y: 500 },
      ],
    });

    expect(unitsInBoardBox(s, { x0: 220, y0: 220, x1: 90, y1: 90 })).toEqual([1, 2]);
  });
});
