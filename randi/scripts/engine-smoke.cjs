// 오프라인 엔진 스모크 테스트 (vitest 없이 node:assert로 실행)
// 사용: tsc --module commonjs --outDir dist-test 후  node scripts/engine-smoke.cjs
const assert = require("node:assert");
const path = require("node:path");

const dist = path.join(__dirname, "..", "dist-test");
const { Game, TICK } = require(path.join(dist, "core/engine.js"));
const { STAGES } = require(path.join(dist, "data/stages.js"));
const { DIFFICULTIES } = require(path.join(dist, "data/difficulty.js"));
const { UNIT_BY_ID, unitsOfGrade } = require(path.join(dist, "data/units.js"));
const { RECIPES } = require(path.join(dist, "data/recipes.js"));
const { WAVES, FINAL_ROUND } = require(path.join(dist, "data/waves.js"));

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; }
}
const runSeconds = (g, s) => { for (let i = 0; i < Math.round(s / TICK); i++) g.tick(); };

console.log("[데이터]");
ok("레시피 무결성", () => {
  for (const r of RECIPES) {
    assert(UNIT_BY_ID[r.resultUnitId], r.id);
    for (const ing of r.ingredients) assert(UNIT_BY_ID[ing.unitId], r.id);
  }
});
ok("웨이브 1~40 커버", () => {
  assert.strictEqual(WAVES.length, FINAL_ROUND);
  WAVES.forEach((w, i) => assert.strictEqual(w.round, i + 1));
});
ok("전 스테이지 슬롯 수 충분", () => {
  for (const s of STAGES) {
    const g = new Game(1, s, DIFFICULTIES[0]);
    assert(g.slots.length > 30, `${s.id}: ${g.slots.length}`);
    console.log(`     ${s.id}: slots=${g.slots.length}, pathLen=${Math.round(g.path.total)}`);
  }
});

console.log("[경제/조합]");
ok("소환·판매 흐름", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  const g0 = g.gold;
  assert(g.summon().ok);
  assert.strictEqual(g.gold, g0 - g.summonCost);
  const gold1 = g.gold;
  assert(g.sell(g.units[0].uid));
  assert(g.gold > gold1);
});
ok("3조합 → 다음 등급", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  const target = unitsOfGrade("common")[0];
  for (let i = 0; i < 3; i++) g.makeUnit ? null : null;
  // private 우회
  const mk = Object.getPrototypeOf(g).constructor.prototype;
  void mk;
  for (let i = 0; i < 3; i++) g["makeUnit"](target.id, g.freeSlots()[0].id);
  assert.strictEqual(g.countOf(target.id), 3);
  const r = g.merge3(g.units[0].uid);
  assert(r.ok);
  assert.strictEqual(g.units.length, 1);
  assert.strictEqual(UNIT_BY_ID[g.units[0].defId].grade, "rare");
});
ok("레시피 조합", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  const recipe = RECIPES[0];
  for (const ing of recipe.ingredients) {
    for (let i = 0; i < ing.count; i++) g["makeUnit"](ing.unitId, g.freeSlots()[0].id);
  }
  g.gold = recipe.cost.gold + 10;
  const r = g.craft(recipe.id);
  assert(r.ok, r.reason);
  assert.strictEqual(g.units[0].defId, recipe.resultUnitId);
  assert.strictEqual(g.gold, 10);
});

console.log("[전투 흐름]");
ok("준비시간 후 자동 라운드 시작 + 스폰", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  runSeconds(g, 15);
  assert.strictEqual(g.round, 1);
  runSeconds(g, 3);
  assert(g.enemies.length > 0);
});
ok("유닛 20기로 초반 라운드 클리어 (입문자)", () => {
  const g = new Game(11, STAGES[0], DIFFICULTIES[0]);
  g.gold = 100000;
  for (let i = 0; i < 20; i++) g.summon();
  g.gold = 0;
  g.startRound();
  runSeconds(g, 90);
  assert(g.totalKills > 0, "no kills");
  assert(g.gold > 0, "no gold income");
  assert(g.phase !== "defeat", "defeated");
  console.log(`     90s 후: round=${g.round}, kills=${g.totalKills}, gold=${g.gold}, phase=${g.phase}`);
});
ok("무방비면 패배", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  g.startRound();
  runSeconds(g, 600);
  assert.strictEqual(g.phase, "defeat");
});
ok("10R 보스 → 보상 셀렉터", () => {
  const g = new Game(23, STAGES[0], DIFFICULTIES[0]);
  for (let i = 0; i < 8; i++) {
    g["makeUnit"]("titan_slayer", g.freeSlots()[0].id);
    g["makeUnit"]("solar_avatar", g.freeSlots()[0].id);
  }
  for (let guard = 0; guard < 40000 && g.round < 10; guard++) {
    g.tick();
    if (g.phase === "prep" && g.prepTimer > 0.5) g.startRound();
  }
  assert.strictEqual(g.round, 10);
  for (let guard = 0; guard < 40000 && !g.selectorOffer; guard++) {
    g.tick();
    if (g.phase === "defeat") break;
  }
  assert(g.selectorOffer, "no selector offer");
  const before = g.units.length;
  assert(g.chooseSelector(0).ok);
  assert.strictEqual(g.units.length, before + 1);
});
ok("전설 12기로 40R 완주 시도 (입문자, 장기 시뮬)", () => {
  const g = new Game(5, STAGES[0], DIFFICULTIES[0]);
  const legends = unitsOfGrade("legend");
  for (let i = 0; i < 12; i++) g["makeUnit"](legends[i % legends.length].id, g.freeSlots()[0].id);
  let guard = 0;
  while (g.phase !== "victory" && g.phase !== "defeat" && guard++ < 400000) {
    g.tick();
    if (g.phase === "prep" && g.prepTimer > 0.5) { g.selectorOffer && g.chooseSelector(0); g.startRound(); }
    if (g.selectorOffer) g.chooseSelector(0);
  }
  console.log(`     결과: phase=${g.phase}, round=${g.round}, kills=${g.totalKills}, ${Math.round(g.time / 60)}분`);
  assert.strictEqual(g.phase, "victory");
});

console.log("[강화]");
ok("진영 강화 구매/비용/최대레벨", () => {
  const g = new Game(42, STAGES[0], DIFFICULTIES[0]);
  g.gold = 100000;
  const c0 = g.upgradeCostFor("flame");
  assert(c0 > 0);
  assert(g.buyUpgrade("flame").ok);
  assert.strictEqual(g.famLevels.flame, 1);
  assert(g.upgradeCostFor("flame") > c0, "cost should grow");
  for (let i = 0; i < 20; i++) g.buyUpgrade("flame");
  assert.strictEqual(g.famLevels.flame, 8, "max level 8");
  assert.strictEqual(g.upgradeCostFor("flame"), null);
  g.gold = 10;
  assert.strictEqual(g.buyUpgrade("frost").ok, false);
});
ok("화염 강화가 실제 피해를 올린다", () => {
  const nearSlot = (g) => {
    let best = null, bd = 1e9;
    for (const s of g.freeSlots()) {
      for (let i = 0; i < g.path.points.length; i += 8) {
        const q = g.path.points[i];
        const d = Math.hypot(q.x - s.x, q.y - s.y);
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  };
  const mk = (lv) => {
    const g = new Game(7, STAGES[0], DIFFICULTIES[0]);
    g.gold = 1000000;
    for (let i = 0; i < lv; i++) g.buyUpgrade("flame");
    g["makeUnit"]("ember_scout", nearSlot(g).id);
    g.startRound();
    for (let i = 0; i < 1200; i++) g.tick();
    return g.units[0] ? g.units[0].damageDealt : 0;
  };
  const base = mk(0), boosted = mk(8);
  assert(base > 0, "base unit never attacked");
  // 라운드당 적 물량이 한정되어 총 피해 비율은 공격력 배율(1.96x)보다 압축된다
  assert(boosted > base * 1.2, `expected boost: ${base} -> ${boosted}`);
});

console.log("[결정론]");
ok("같은 시드 = 같은 결과", () => {
  const run = (seed) => {
    const g = new Game(seed, STAGES[0], DIFFICULTIES[0]);
    g.gold = 5000;
    for (let i = 0; i < 12; i++) g.summon();
    g.startRound();
    for (let i = 0; i < 4000; i++) g.tick();
    return JSON.stringify({ gold: g.gold, r: g.round, k: g.totalKills, u: g.units.map((x) => x.defId).sort() });
  };
  assert.strictEqual(run(1234), run(1234));
  assert.notStrictEqual(run(1234), run(4321));
});

console.log(`\n${passed} tests passed${process.exitCode ? " (일부 실패)" : ""}`);
