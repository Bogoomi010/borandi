import { describe, expect, it } from "vitest";
import { Game, replay } from "./engine";
import { stateChecksum } from "./checksum";
import { Rng } from "./rng";
import { UNITS, UNIT_BY_ID } from "../data/units";
import { RELICS, RELIC_BY_ID } from "../data/relics";
import { RECIPES } from "../data/recipes";
import { MISSIONS } from "../data/missions";
import { BOSS_ROUND_LIST, FINAL_ROUND, WAVES } from "../data/waves";
import { STAGES } from "../data/stages";
import { DIFFICULTIES, SUMMON_TABLE, PITY_TABLE, PITY_THRESHOLD } from "../data/difficulty";
import { playFullRun, playOneRound } from "../sim/autoPlayer";

describe("rng", () => {
  it("같은 시드는 같은 수열을 만든다", () => {
    const a = new Rng("TEST");
    const b = new Rng("TEST");
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it("다른 시드는 다른 수열을 만든다", () => {
    const a = new Rng("TEST1");
    const b = new Rng("TEST2");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("데이터 무결성 (QA 체크리스트)", () => {
  it("소환 확률 합이 100이다", () => {
    expect(Object.values(SUMMON_TABLE).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(PITY_TABLE).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("요구 난이도 5종이 정의되어 있다", () => {
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(["novice", "normal", "intermediate", "expert", "master"]);
  });
  it("상위 난이도일수록 적 누적 허용치가 줄어든다", () => {
    const limits = DIFFICULTIES.map((d) => d.enemyLimit);
    expect(limits).toEqual([...limits].sort((a, b) => b - a));
  });
  it("조합식에 존재하지 않는 유닛 ID가 없다", () => {
    for (const r of RECIPES) {
      expect(UNIT_BY_ID[r.resultUnitId], `result ${r.resultUnitId}`).toBeDefined();
      for (const ing of r.ingredients) {
        if (ing.unitId) expect(UNIT_BY_ID[ing.unitId], `ing ${ing.unitId}`).toBeDefined();
      }
    }
  });
  it("유닛 ID가 중복되지 않는다", () => {
    const ids = UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("웨이브가 1~40 라운드 모두 존재한다", () => {
    expect(WAVES.length).toBe(FINAL_ROUND);
    for (let r = 1; r <= FINAL_ROUND; r++) {
      expect(WAVES.find((w) => w.round === r), `round ${r}`).toBeDefined();
    }
  });
  it("보스 라운드는 10/20/30/40이다", () => {
    const bossRounds = WAVES.filter((w) => w.type === "boss").map((w) => w.round);
    expect(bossRounds).toEqual(BOSS_ROUND_LIST);
  });
  it("새 게임에서 선택할 수 있는 서로 다른 15개 맵이 있다", () => {
    expect(STAGES.length).toBe(15);
    const shapes = new Set(STAGES.map((s) => JSON.stringify(s.waypoints)));
    expect(shapes.size).toBe(15);
    for (const stage of STAGES) {
      expect(stage.waypoints.length).toBeGreaterThanOrEqual(4);
      expect(stage.decorations.length).toBeGreaterThanOrEqual(4);
    }
  });
  it("미션 ID가 중복되지 않는다", () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("보스 유물 ID가 중복되지 않고 모든 설명이 배포용 문구를 가진다", () => {
    const ids = RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const relic of RELICS) {
      expect(RELIC_BY_ID[relic.id]).toBe(relic);
      expect(relic.name.length).toBeGreaterThan(0);
      expect(relic.desc.length).toBeGreaterThan(8);
    }
  });
});

describe("소환", () => {
  it("같은 시드에서 같은 소환 결과가 나온다", () => {
    const a = new Game("SEED1", "novice");
    const b = new Game("SEED1", "novice");
    for (let i = 0; i < 5; i++) {
      a.dispatch("summon");
      b.dispatch("summon");
    }
    expect(a.state.units.map((u) => u.defId)).toEqual(b.state.units.map((u) => u.defId));
  });
  it("골드가 부족하면 소환이 실패한다", () => {
    const g = new Game("SEED1", "novice");
    g.state.gold = 5;
    expect(g.dispatch("summon").ok).toBe(false);
  });
  it("연속 일반 보정: 임계값 도달 후 희귀 이상 확정", () => {
    const g = new Game("PITY", "novice");
    g.state.gold = 999999;
    // 강제로 연속 일반 카운트를 임계값으로 설정
    g.state.summonStats.consecutiveCommon = PITY_THRESHOLD;
    g.dispatch("summon");
    const last = g.state.units[g.state.units.length - 1];
    expect(UNIT_BY_ID[last.defId].grade).not.toBe("common");
    expect(g.state.summonStats.pityTriggered).toBe(1);
  });
});

describe("조합", () => {
  function give(g: Game, defId: string, n: number) {
    for (let i = 0; i < n; i++) {
      const x = 130 + g.state.units.length * 30, y = 30;
      g.state.units.push({
        uid: g.state.nextUid++, defId, locked: false,
        x, y, acquiredRound: 1, totalDamage: 0, cooldown: 0,
        state: "idle", order: { kind: "none" }, anchorX: x, anchorY: y,
      });
    }
  }

  it("지정 조합이 재료를 소비하고 결과를 만든다", () => {
    const g = new Game("CRAFT", "novice");
    give(g, "ember_scout", 2);
    give(g, "rift_eye", 1);
    g.state.gold = 100;
    const res = g.dispatch("craft", { recipeId: "recipe_flame_mage" });
    expect(res.ok).toBe(true);
    expect(g.state.units.filter((u) => u.defId === "flame_mage").length).toBe(1);
    expect(g.state.units.filter((u) => u.defId === "ember_scout").length).toBe(0);
    expect(g.state.gold).toBe(140);
  });

  it("전설 지휘 보너스는 5전설 이상부터 공격 배율을 준다", () => {
    const g = new Game("LEGEND-COMMAND", "intermediate");
    give(g, "solar_avatar", 4);
    expect(g.legendCommandAttackMult()).toBe(1);

    give(g, "chrono_marshal", 1);
    expect(g.legendCommandAttackMult()).toBeCloseTo(1.08);

    give(g, "titan_slayer", 4);
    expect(g.legendCommandAttackMult()).toBeCloseTo(1.24);
  });

  it("중급자는 5전설 이상부터 전설 지휘 누적 한도 보너스를 받는다", () => {
    const g = new Game("INTERMEDIATE-LIMIT-COMMAND", "intermediate");
    const baseLimit = g.diff.enemyLimit;
    give(g, "solar_avatar", 4);
    expect(g.legendCommandEnemyLimitBonus()).toBe(0);
    expect(g.enemyLimit()).toBe(baseLimit);

    give(g, "chrono_marshal", 1);
    expect(g.legendCommandEnemyLimitBonus()).toBe(12);
    expect(g.enemyLimit()).toBe(baseLimit + 12);
  });

  it("일반 난이도는 1~2전설부터 지휘 보너스를 받는다", () => {
    const g = new Game("NORMAL-COMMAND", "normal");
    const baseLimit = g.diff.enemyLimit;
    expect(g.legendCommandAttackMult()).toBe(1);
    expect(g.legendCommandEnemyLimitBonus()).toBe(0);
    expect(g.enemyLimit()).toBe(baseLimit);

    give(g, "solar_avatar", 1);
    expect(g.legendCommandAttackMult()).toBeCloseTo(1.12);
    expect(g.legendCommandEnemyLimitBonus()).toBe(6);
    expect(g.enemyLimit()).toBe(baseLimit + 6);

    give(g, "chrono_marshal", 3);
    expect(g.legendCommandAttackMult()).toBeCloseTo(1.2);
  });

  it("잠금 유닛은 조합 재료로 소비되지 않는다", () => {
    const g = new Game("LOCK", "novice");
    give(g, "ember_scout", 2);
    give(g, "rift_eye", 1);
    g.state.units.forEach((u) => { u.locked = true; });
    g.state.gold = 100;
    const res = g.dispatch("craft", { recipeId: "recipe_flame_mage" });
    expect(res.ok).toBe(false);
    expect(g.state.units.length).toBe(3);
  });

  it("3합성: 같은 계열 일반 3기 → 같은 계열 희귀", () => {
    const g = new Game("MERGE", "novice");
    give(g, "ember_scout", 3);
    const uids = g.state.units.map((u) => u.uid);
    const res = g.dispatch("merge3", { unitIds: uids });
    expect(res.ok).toBe(true);
    expect(g.state.units.length).toBe(1);
    const d = UNIT_BY_ID[g.state.units[0].defId];
    expect(d.grade).toBe("rare");
    expect(d.family).toBe("flame");
  });

  it("잠금 유닛은 판매되지 않는다", () => {
    const g = new Game("SELL", "novice");
    give(g, "ember_scout", 1);
    g.state.units[0].locked = true;
    const res = g.dispatch("sell", { unitIds: [g.state.units[0].uid] });
    expect(res.ok).toBe(false);
    expect(g.state.units.length).toBe(1);
  });
});

describe("전투/리플레이 재현성", () => {
  it("새 게임에서 선택한 맵은 40라운드 보스까지 바뀌지 않고 리플레이에도 유지된다", () => {
    const stageId = 4;
    const game = new Game("STAGE-STAYS", "novice", stageId);
    const observedStageIds = [game.state.stageId];
    const bossCheckpointStages = new Map<number, number>();
    while (game.state.phase !== "ended") {
      const roundBeforePlay = game.state.round;
      playOneRound(game);
      observedStageIds.push(game.state.stageId);
      if (game.state.bossKillSeconds[roundBeforePlay] !== undefined) {
        bossCheckpointStages.set(roundBeforePlay, game.state.stageId);
      }
    }
    const replayed = replay("STAGE-STAYS", "novice", stageId, game.state.inputHistory);

    expect(new Set(observedStageIds)).toEqual(new Set([stageId]));
    expect(Object.keys(game.state.bossKillSeconds).map(Number).sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
    expect([...bossCheckpointStages.entries()]).toEqual([
      [10, stageId],
      [20, stageId],
      [30, stageId],
      [40, stageId],
    ]);
    expect(game.state.stageId).toBe(stageId);
    expect(game.state.round).toBe(FINAL_ROUND);
    expect(game.state.bossKillSeconds[FINAL_ROUND]).toBeDefined();
    expect(replayed.state.stageId).toBe(stageId);
    expect(replayed.state.round).toBe(FINAL_ROUND);
    expect(replayed.state.bossKillSeconds[FINAL_ROUND]).toBeDefined();
    expect(replayed.state.round).toBe(game.state.round);
    expect(replayed.state.cleared).toBe(game.state.cleared);
  }, 30000);

  it("라운드 중 맵 변경 시도가 있어도 이번 판 시작 맵으로 되돌린다", () => {
    const stageId = 4;
    const game = new Game("STAGE-LOCKED", "novice", stageId);

    game.state.stageId = 9;
    playOneRound(game);
    expect(game.state.stageId).toBe(stageId);

    game.state.stageId = 12;
    const summary = game.resultSummary();
    expect(summary.stageId).toBe(stageId);
    expect(game.state.stageId).toBe(stageId);
  }, 30000);

  it("자동 플레이 한 판의 입력 기록을 리플레이하면 같은 체크섬이 나온다", () => {
    const game = new Game("REPLAY-1", "novice");
    playFullRun(game);
    const originalChecksum = stateChecksum(game.state);
    const replayed = replay("REPLAY-1", "novice", game.state.stageId, game.state.inputHistory);
    expect(stateChecksum(replayed.state)).toBe(originalChecksum);
    expect(replayed.state.round).toBe(game.state.round);
    expect(replayed.state.cleared).toBe(game.state.cleared);
  }, 30000);

  it("같은 시드 자동 플레이 두 판은 같은 결과를 만든다", () => {
    const a = new Game("SAME", "novice");
    const b = new Game("SAME", "novice");
    playFullRun(a);
    playFullRun(b);
    expect(stateChecksum(a.state)).toBe(stateChecksum(b.state));
  }, 30000);

  it("자동 플레이가 10라운드 이상 도달한다 (밸런스 스모크)", () => {
    let reached10 = 0;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const g = new Game(`SMOKE-${i}`, "novice");
      playFullRun(g);
      if (g.state.round >= 10) reached10++;
    }
    expect(reached10 / n).toBeGreaterThanOrEqual(0.8);
  }, 60000);

  it("보스 처치 후 유물 3택을 받고 선택 입력은 리플레이된다", () => {
    const game = new Game("RELIC-REPLAY", "novice");
    while (game.state.phase !== "ended" && game.state.bossKillSeconds[10] === undefined) {
      playOneRound(game);
    }

    expect(game.state.bossKillSeconds[10]).toBeDefined();
    expect(game.state.pendingRelicChoices.length).toBe(1);
    const choice = game.state.pendingRelicChoices[0];
    expect(choice.candidateIds.length).toBe(3);

    const relicId = choice.candidateIds[0];
    const res = game.dispatch("pickRelic", { choiceId: choice.id, relicId });
    expect(res.ok).toBe(true);
    expect(game.state.relicIds).toEqual([relicId]);
    expect(game.state.pendingRelicChoices.length).toBe(0);

    const replayed = replay(
      "RELIC-REPLAY",
      "novice",
      game.state.stageId,
      game.state.inputHistory,
      game.state.tick,
    );
    expect(replayed.state.relicIds).toEqual(game.state.relicIds);
    expect(stateChecksum(replayed.state)).toBe(stateChecksum(game.state));
  }, 30000);
});

describe("phase 규칙", () => {
  function give(g: Game, defId: string, n: number): number[] {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const uid = g.state.nextUid++;
      const x = 130 + g.state.units.length * 30, y = 30;
      g.state.units.push({
        uid, defId, locked: false, x, y, acquiredRound: 1,
        totalDamage: 0, cooldown: 0, state: "idle", order: { kind: "none" }, anchorX: x, anchorY: y,
      });
      ids.push(uid);
    }
    return ids;
  }

  it("전투 중에도 3합성/조합/판매가 가능하다 (준비 단계 전용 해제)", () => {
    const g = new Game("PHASE", "novice");
    const trio = give(g, "ember_scout", 3); // 같은 등급 3기
    g.dispatch("startWave");
    expect(g.state.phase).toBe("wave");
    expect(g.dispatch("merge3", { unitIds: trio }).ok).toBe(true);

    const sellId = give(g, "ember_scout", 1);
    expect(g.dispatch("sell", { unitIds: sellId }).ok).toBe(true);

    give(g, "ember_scout", 2); give(g, "rift_eye", 1);
    g.state.gold = 100;
    expect(g.dispatch("craft", { recipeId: "recipe_flame_mage" }).ok).toBe(true);
  });
  it("전투 중에도 소환은 가능하다", () => {
    const g = new Game("PHASE2", "novice");
    g.dispatch("startWave");
    const res = g.dispatch("summon");
    expect(res.ok).toBe(true);
  });
});
