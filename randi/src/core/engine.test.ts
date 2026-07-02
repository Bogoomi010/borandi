import { describe, expect, it } from "vitest";
import { Game, TICK } from "./engine";
import { STAGES } from "../data/stages";
import { DIFFICULTIES } from "../data/difficulty";
import { UNIT_BY_ID, unitsOfGrade } from "../data/units";
import { RECIPES } from "../data/recipes";
import { FINAL_ROUND, WAVES } from "../data/waves";

const stage = STAGES[0];
const novice = DIFFICULTIES[0];

function newGame(seed = 42): Game {
  return new Game(seed, stage, novice);
}

function runSeconds(g: Game, seconds: number): void {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n; i++) g.tick();
}

describe("데이터 무결성", () => {
  it("레시피 재료/결과가 모두 존재하는 유닛이다", () => {
    for (const r of RECIPES) {
      expect(UNIT_BY_ID[r.resultUnitId], r.id).toBeDefined();
      for (const ing of r.ingredients) expect(UNIT_BY_ID[ing.unitId], r.id).toBeDefined();
    }
  });

  it("웨이브가 1~40라운드를 모두 덮는다", () => {
    expect(WAVES.length).toBe(FINAL_ROUND);
    for (let r = 1; r <= FINAL_ROUND; r++) {
      expect(WAVES[r - 1].round).toBe(r);
    }
  });

  it("모든 스테이지에 충분한 배치 슬롯이 생성된다", () => {
    for (const s of STAGES) {
      for (const d of DIFFICULTIES) {
        const g = new Game(1, s, d);
        expect(g.slots.length, `${s.id}`).toBeGreaterThanOrEqual(d.unitCap - 10);
        expect(g.slots.length, `${s.id}`).toBeGreaterThan(30);
      }
    }
  });
});

describe("소환/판매/경제", () => {
  it("소환은 골드를 소모하고 유닛을 배치한다", () => {
    const g = newGame();
    const gold0 = g.gold;
    const r = g.summon();
    expect(r.ok).toBe(true);
    expect(g.gold).toBe(gold0 - g.summonCost);
    expect(g.units.length).toBe(1);
  });

  it("골드 부족 시 소환 실패", () => {
    const g = newGame();
    g.gold = 5;
    expect(g.summon().ok).toBe(false);
  });

  it("판매는 등급별 환급 골드를 지급한다", () => {
    const g = newGame();
    g.summon();
    const u = g.units[0];
    const gold0 = g.gold;
    g.sell(u.uid);
    expect(g.units.length).toBe(0);
    expect(g.gold).toBeGreaterThan(gold0);
  });

  it("연속 일반 보정(pity) 후에는 희귀 이상이 나온다", () => {
    const g = newGame(7);
    g.gold = 100000;
    let sawPityNonCommon = false;
    let commonStreak = 0;
    for (let i = 0; i < 60; i++) {
      const r = g.summon();
      const grade = UNIT_BY_ID[r.defId!].grade;
      if (commonStreak >= 10) {
        expect(grade).not.toBe("common");
        sawPityNonCommon = true;
      }
      commonStreak = grade === "common" ? commonStreak + 1 : 0;
    }
    // 60회 안에 pity가 발동할 확률은 사실상 1
    expect(sawPityNonCommon || commonStreak < 10).toBe(true);
  });
});

describe("조합", () => {
  it("같은 유닛 3개 → 다음 등급 1개", () => {
    const g = newGame();
    const target = unitsOfGrade("common")[0];
    // 강제로 3개 배치
    for (let i = 0; i < 3; i++) {
      const free = g.freeSlots()[0];
      (g as unknown as { makeUnit: (d: string, s: number) => unknown }).makeUnit(target.id, free.id);
    }
    expect(g.countOf(target.id)).toBe(3);
    const anchor = g.units[0];
    const r = g.merge3(anchor.uid);
    expect(r.ok).toBe(true);
    expect(g.units.length).toBe(1);
    expect(UNIT_BY_ID[g.units[0].defId].grade).toBe("rare");
  });

  it("레시피 조합은 재료와 골드를 소모하고 결과를 생성한다", () => {
    const g = newGame();
    const recipe = RECIPES[0];
    for (const ing of recipe.ingredients) {
      for (let i = 0; i < ing.count; i++) {
        const free = g.freeSlots()[0];
        (g as unknown as { makeUnit: (d: string, s: number) => unknown }).makeUnit(ing.unitId, free.id);
      }
    }
    g.gold = recipe.cost.gold + 10;
    const r = g.craft(recipe.id);
    expect(r.ok).toBe(true);
    expect(g.units.length).toBe(1);
    expect(g.units[0].defId).toBe(recipe.resultUnitId);
    expect(g.gold).toBe(10);
  });

  it("재료 부족이면 레시피 실패", () => {
    const g = newGame();
    g.gold = 100000;
    const r = g.craft(RECIPES[0].id);
    expect(r.ok).toBe(false);
  });
});

describe("라운드/전투 흐름", () => {
  it("준비 시간이 끝나면 자동으로 1R이 시작된다", () => {
    const g = newGame();
    runSeconds(g, 15);
    expect(g.round).toBe(1);
    expect(g.phase).toBe("combat");
    runSeconds(g, 3);
    expect(g.enemies.length).toBeGreaterThan(0);
  });

  it("유닛이 있으면 1R을 클리어하고 골드를 얻는다 (입문자)", () => {
    const g = newGame(11);
    g.gold = 100000;
    for (let i = 0; i < 20; i++) g.summon();
    g.gold = 0;
    g.startRound();
    runSeconds(g, 90);
    expect(g.round).toBeGreaterThanOrEqual(1);
    expect(g.totalKills).toBeGreaterThan(0);
    expect(g.gold).toBeGreaterThan(0);
    expect(g.phase).not.toBe("defeat");
  });

  it("유닛이 없으면 적이 쌓여 패배한다", () => {
    const g = newGame();
    g.startRound();
    runSeconds(g, 600);
    expect(g.phase).toBe("defeat");
  });

  it("보스 라운드(10R) 도달 및 보상 선택 흐름", () => {
    const g = newGame(23);
    // 강한 유닛 강제 배치
    for (let i = 0; i < 8; i++) {
      const free = g.freeSlots()[0];
      (g as unknown as { makeUnit: (d: string, s: number) => unknown }).makeUnit("titan_slayer", free.id);
      const free2 = g.freeSlots()[0];
      (g as unknown as { makeUnit: (d: string, s: number) => unknown }).makeUnit("solar_avatar", free2.id);
    }
    for (let guard = 0; guard < 20000 && g.round < 10; guard++) {
      g.tick();
      if (g.phase === "prep" && g.prepTimer > 0.5) g.startRound();
    }
    expect(g.round).toBe(10);
    // 보스 처치까지 진행
    for (let guard = 0; guard < 20000 && !g.selectorOffer; guard++) {
      g.tick();
      if (g.phase === "defeat") break;
    }
    expect(g.selectorOffer).not.toBeNull();
    const before = g.units.length;
    const r = g.chooseSelector(0);
    expect(r.ok).toBe(true);
    expect(g.units.length).toBe(before + 1);
    expect(UNIT_BY_ID[r.defId!].grade).toBe("rare");
  });
});

describe("결정론", () => {
  it("같은 시드는 같은 결과를 낸다", () => {
    const run = (seed: number): string => {
      const g = new Game(seed, stage, novice);
      g.gold = 5000;
      for (let i = 0; i < 12; i++) g.summon();
      g.startRound();
      for (let i = 0; i < 4000; i++) g.tick();
      return JSON.stringify({
        gold: g.gold,
        round: g.round,
        kills: g.totalKills,
        units: g.units.map((u) => u.defId).sort(),
        enemies: g.enemies.length,
      });
    };
    expect(run(1234)).toBe(run(1234));
    expect(run(1234)).not.toBe(run(4321));
  });
});
