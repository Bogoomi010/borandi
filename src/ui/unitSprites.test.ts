import { describe, expect, it } from "vitest";
import { UNITS } from "../data/units";
import { UNIT_SPRITE_ASSET_IDS, UNIT_SPRITES } from "./unitSprites";

describe("unit sprite assets", () => {
  it("모든 캐릭터에 스프라이트 에셋 프로필이 적용된다", () => {
    const unitIds = UNITS.map((unit) => unit.id).sort();
    const spriteIds = [...UNIT_SPRITE_ASSET_IDS].sort();

    expect(spriteIds).toEqual(unitIds);
    for (const id of unitIds) expect(UNIT_SPRITES[id]).toBeDefined();
  });
});
