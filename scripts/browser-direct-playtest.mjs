// Browser direct-play balance sampler.
// Requires a running dev server: yarn dev --host 127.0.0.1 --port 1421

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const url = String(args.url ?? "http://127.0.0.1:1421/");
const seeds = Math.max(1, Number(args.seeds ?? 6));
const maxRound = Math.max(1, Number(args["max-round"] ?? 40));
const stepMs = Math.max(250, Number(args["step-ms"] ?? 5000));
const outPath = typeof args.json === "string" && args.json !== "true" ? args.json : "";
const screenshotDir = typeof args.screenshots === "string" && args.screenshots !== "true" ? args.screenshots : "";
const codexLogPath = typeof args["codex-log"] === "string" && args["codex-log"] !== "true" ? args["codex-log"] : "";
const strict = args.strict === "true";
const CURRENT_DATA_VERSION = readCurrentDataVersion();
const selectedScenarioIds = typeof args.scenarios === "string" && args.scenarios !== "true"
  ? new Set(args.scenarios.split(",").map((s) => s.trim()).filter(Boolean))
  : null;

const GRADE_ORDER = ["common", "rare", "hero", "legend", "hidden"];
const SUMMON_COST = 20;

const PLAYTEST_SCOPE = [
  "DEV 스폰 고정 조건이 아니라 실제 소환/선택권/합성/조합/업그레이드 입력을 반복한다.",
  "브라우저 런타임의 실제 Game, render_game_to_text, advanceTime, ctx.act 경로를 사용한다.",
  "자동으로 누적한 시뮬레이션 플레이 시간을 기록하되, 요청된 2시간 수동 플레이를 대체하지 않는 보조 증거로 취급한다.",
];

function readCurrentDataVersion() {
  try {
    const source = readFileSync("src/data/version.ts", "utf8");
    return source.match(/export const DATA_VERSION = "([^"]+)"/)?.[1] ?? "";
  } catch {
    return "";
  }
}

const SCENARIOS = [
  {
    id: "noviceHero",
    label: "입문자 / 전설 없음 직접 플레이",
    difficulty: "novice",
    options: { maxGrade: "hero" },
    expectation: "전설을 전부 배제해도 40R 클리어권이어야 한다.",
  },
  {
    id: "normalNoLegend",
    label: "일반 / 전설 0개 직접 플레이",
    difficulty: "normal",
    options: { maxLegendCount: 0 },
    expectation: "무전설 일반은 불안정해야 한다.",
  },
  {
    id: "normalOneLegend",
    label: "일반 / 전설 최대 1개 직접 플레이",
    difficulty: "normal",
    options: { maxLegendCount: 1 },
    expectation: "전설 1개 조건이 무전설보다 좋아야 한다.",
  },
  {
    id: "normalTwoLegend",
    label: "일반 / 전설 최대 2개 직접 플레이",
    difficulty: "normal",
    options: { maxLegendCount: 2 },
    expectation: "전설 1~2개 조건이 무전설보다 분명히 좋아야 한다.",
  },
  {
    id: "intermediateTwoLegend",
    label: "중급자 / 전설 최대 2개 직접 플레이",
    difficulty: "intermediate",
    options: { maxLegendCount: 2 },
    expectation: "2전설 중급자는 부족해야 한다.",
  },
  {
    id: "intermediateFiveLegend",
    label: "중급자 / 전설 최대 5개 직접 플레이",
    difficulty: "intermediate",
    options: { maxLegendCount: 5 },
    expectation: "5전설 이상부터 중급자 클리어권에 들어가야 한다.",
  },
  {
    id: "expertFiveLegend",
    label: "고수 / 전설 최대 5개 직접 플레이",
    difficulty: "expert",
    options: { maxLegendCount: 5 },
    expectation: "고수는 중급자 5전설 예산만으로는 빡빡해야 한다.",
  },
  {
    id: "expertOpen",
    label: "고수 / 제한 없음 직접 플레이",
    difficulty: "expert",
    options: {},
    expectation: "고수는 5전설보다 더 높은 성장 조건에서 클리어권이어야 한다.",
  },
  {
    id: "masterOpen",
    label: "초고수 / 제한 없음 직접 플레이",
    difficulty: "master",
    options: {},
    expectation: "초고수는 제한 없이도 매우 어렵게 유지되어야 한다.",
  },
];

const scenarios = SCENARIOS.filter((s) => !selectedScenarioIds || selectedScenarioIds.has(s.id));

function rank(grade) {
  return GRADE_ORDER.indexOf(grade);
}

function assertHook(value, name) {
  if (!value) throw new Error(`missing browser playtest hook: ${name}`);
}

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function readSnapshot(page) {
  return page.evaluate(() => window.__randi_dev.balanceSnapshot());
}

async function clearModals(page) {
  await page.evaluate(() => {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  });
}

async function act(page, type, payload) {
  return page.evaluate(({ type, payload }) => window.__randi_dev.act(type, payload), { type, payload });
}

function countLegends(snap) {
  return snap.units.filter((u) => u.grade === "legend").length;
}

function shellArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function manualPlaylogCommand({ scenario, seed, simulatedSeconds, final, endedAt }) {
  const session = codexDirectSession({ scenario, seed, simulatedSeconds, final, endedAt });
  return [
    "yarn manual-playlog",
    "--source=codex-direct-playtest",
    `--difficulty=${shellArg(session.difficulty)}`,
    `--seconds=${session.seconds}`,
    `--result=${session.result}`,
    `--stage=${session.stage}`,
    `--round=${session.round}`,
    `--seed=${shellArg(session.seed)}`,
    `--legends=${session.legends}`,
    `--maxGrade=${shellArg(session.maxGrade)}`,
    `--dataVersion=${shellArg(session.dataVersion)}`,
    `--stateChecksum=${shellArg(session.stateChecksum)}`,
    `--endedAt=${shellArg(session.endedAt)}`,
    `--notes=${shellArg(session.notes)}`,
  ].join(" ");
}

function codexDirectSession({ scenario, seed, simulatedSeconds, final, endedAt }) {
  const result = final.cleared ? "clear" : "loss";
  const stage = final.stage?.current ?? 1;
  const legends = final.unitSummary.legendOrBetter;
  const maxGrade = final.unitSummary.maxGrade ?? "common";
  const notes = `Codex browser-direct ${scenario.id}: ${scenario.expectation}`;
  return {
    source: "codex-direct-playtest",
    difficulty: final.difficulty?.id ?? scenario.difficulty,
    seconds: Math.round(simulatedSeconds),
    minutes: Number((simulatedSeconds / 60).toFixed(2)),
    startedAt: new Date(new Date(endedAt).getTime() - Math.round(simulatedSeconds) * 1000).toISOString(),
    endedAt,
    result,
    stage,
    round: final.round,
    seed,
    legends,
    maxGrade,
    dataVersion: final.dataVersion,
    stateChecksum: final.stateChecksum,
    notes,
  };
}

function hasRole(unit, role) {
  return Array.isArray(unit.roles) && unit.roles.includes(role);
}

function isMajorUnit(unit) {
  return unit.grade === "legend" || unit.grade === "hidden";
}

function selectionScore(info, snap) {
  let score = info.score;
  if (!isMajorUnit(info)) return score;

  const majorUnits = snap.units.filter((u) => isMajorUnit(u) && u.uid !== info.uid);
  const sameFamilyCount = majorUnits.filter((u) => u.family === info.family).length;
  if (sameFamilyCount === 0) score += 90;
  else score -= sameFamilyCount * 140;

  const roleBonus = {
    waveClear: 110,
    bossKiller: 110,
    debuff: 80,
    hold: 80,
    finisher: 35,
    economy: 25,
  };
  for (const [role, bonus] of Object.entries(roleBonus)) {
    if (!hasRole(info, role)) continue;
    const sameRoleCount = majorUnits.filter((u) => hasRole(u, role)).length;
    if (sameRoleCount === 0) score += bonus;
    else score -= sameRoleCount * 45;
  }
  return score;
}

function legendKeepScore(unit, snap) {
  return selectionScore(unit, snap);
}

function allowedUnit(info, snap, options) {
  if (options.maxGrade && rank(info.grade) > rank(options.maxGrade)) return false;
  if (options.maxLegendCount !== undefined && info.grade === "legend") {
    return countLegends(snap) < options.maxLegendCount;
  }
  return true;
}

async function enforceLimits(page, options) {
  let snap = await readSnapshot(page);
  if (options.maxGrade) {
    const overCap = snap.units
      .filter((u) => rank(u.grade) > rank(options.maxGrade))
      .map((u) => u.uid);
    if (overCap.length > 0) await act(page, "sell", { unitIds: overCap });
  }

  snap = await readSnapshot(page);
  if (options.maxLegendCount !== undefined) {
    const legends = snap.units
      .filter((u) => u.grade === "legend")
      .sort((a, b) => legendKeepScore(b, snap) - legendKeepScore(a, snap) || b.score - a.score || a.uid - b.uid);
    const sell = legends.slice(options.maxLegendCount).map((u) => u.uid);
    if (sell.length > 0) await act(page, "sell", { unitIds: sell });
  }
}

async function claimSelectors(page, options) {
  for (let guard = 0; guard < 8; guard++) {
    const snap = await readSnapshot(page);
    const selector = snap.selectors[0];
    if (!selector) return;
    const candidates = selector.candidates.filter((c) => allowedUnit(c, snap, options));
    if (candidates.length === 0) return;
    candidates.sort((a, b) => selectionScore(b, snap) - selectionScore(a, snap) || rank(b.grade) - rank(a.grade));
    const ok = await act(page, "pickSelector", { selectorId: selector.id, unitId: candidates[0].id });
    if (!ok) return;
    await enforceLimits(page, options);
  }
}

function canMergeGrade(grade, snap, options) {
  const nextGrade = GRADE_ORDER[rank(grade) + 1];
  if (!nextGrade || nextGrade === "hidden") return false;
  if (options.maxGrade && rank(nextGrade) > rank(options.maxGrade)) return false;
  if (options.maxLegendCount !== undefined && nextGrade === "legend") {
    return countLegends(snap) < options.maxLegendCount;
  }
  return true;
}

async function doMerges(page, maxMerges, options) {
  for (let i = 0; i < maxMerges; i++) {
    const snap = await readSnapshot(page);
    if (snap.units.length < snap.unitCap * 0.7) return;
    let merged = false;
    for (const grade of ["common", "rare", "hero"]) {
      if (!canMergeGrade(grade, snap, options)) continue;
      const groups = new Map();
      for (const u of snap.units) {
        if (u.grade !== grade || u.locked) continue;
        const key = `${grade}:${u.family}`;
        groups.set(key, [...(groups.get(key) ?? []), u.uid]);
      }
      for (const uids of groups.values()) {
        if (uids.length >= 3) {
          merged = await act(page, "merge3", { unitIds: uids.slice(0, 3) });
          if (merged) break;
        }
      }
      if (merged) break;
      const all = [...groups.values()].flat();
      if (all.length >= 3) {
        merged = await act(page, "merge3", { unitIds: all.slice(0, 3) });
        if (merged) break;
      }
    }
    if (!merged) return;
  }
}

async function doCrafts(page, maxCrafts, options) {
  for (let i = 0; i < maxCrafts; i++) {
    const snap = await readSnapshot(page);
    const craftable = snap.craftable.filter((c) => allowedUnit(c.result, snap, options));
    if (craftable.length === 0) return;
    craftable.sort((a, b) => {
      const gradeDelta = rank(b.result.grade) - rank(a.result.grade);
      if (gradeDelta !== 0) return gradeDelta;
      if (!!a.reasonTag !== !!b.reasonTag) return a.reasonTag ? -1 : 1;
      const ownedA = snap.units.filter((u) => u.id === a.result.id).length;
      const ownedB = snap.units.filter((u) => u.id === b.result.id).length;
      if (ownedA !== ownedB) return ownedA - ownedB;
      return selectionScore(b.result, snap) - selectionScore(a.result, snap);
    });
    const ok = await act(page, "craft", { recipeId: craftable[0].id });
    if (!ok) return;
    await enforceLimits(page, options);
  }
}

async function doUpgrades(page, strategy) {
  const snap = await readSnapshot(page);
  if (snap.round < 10) return;
  const reserve = strategy === "conservative" ? 260 : 200;
  const upgrades = [...snap.upgrades]
    .filter((u) => u.level < u.maxLevel && u.ownedFamily > 0)
    .sort((a, b) => b.ownedFamily - a.ownedFamily || a.level - b.level || a.cost - b.cost);
  for (const up of upgrades.slice(0, 2)) {
    const latest = await readSnapshot(page);
    if (latest.gold >= up.cost + reserve) await act(page, "upgrade", { upgradeId: up.id });
  }
}

async function doPrep(page, options) {
  const strategy = options.strategy ?? "balanced";
  await enforceLimits(page, options);
  await claimSelectors(page, options);
  await doMerges(page, 5, options);
  await enforceLimits(page, options);
  await doCrafts(page, 4, options);

  const reserve = strategy === "aggressive" ? 0 : strategy === "conservative" ? 120 : 50;
  for (let guard = 0; guard < 60; guard++) {
    const snap = await readSnapshot(page);
    if (snap.gold < SUMMON_COST + reserve || snap.units.length >= snap.unitCap - 2) break;
    const ok = await act(page, "summon");
    if (!ok) break;
    await enforceLimits(page, options);
  }

  await doCrafts(page, 2, options);
  await doUpgrades(page, strategy);
  await doMerges(page, 2, options);
  await enforceLimits(page, options);
  await claimSelectors(page, options);
}

async function playScenarioSeed(page, scenario, seedIndex) {
  const seed = `DIRECT-${seedIndex}`;
  await clearModals(page);
  await page.evaluate(({ seed, difficulty }) => {
    window.__randi_dev.newRun(seed, difficulty, 1);
  }, { seed, difficulty: scenario.difficulty });
  await page.waitForTimeout(50);

  const samples = [];
  let lastRound = 0;
  let steps = 0;
  for (; steps < 900; steps++) {
    const snap = await readSnapshot(page);
    if (snap.phase === "ended" || snap.round > maxRound) break;
    if (snap.breakTicks > 0) {
      await doPrep(page, scenario.options);
      const latest = await readSnapshot(page);
      if (latest.enemyPressure === 0) await act(page, "startWave");
    }
    await page.evaluate((ms) => window.advanceTime(ms), stepMs);
    const state = await readState(page);
    if (state.round !== lastRound || state.mode === "ended" || state.round % 10 === 0) {
      lastRound = state.round;
      samples.push({
        step: steps,
        round: state.round,
        mode: state.mode,
        pressure: `${state.resources.enemyPressure}/${state.resources.enemyLimit}`,
        gold: state.resources.gold,
        maxGrade: state.unitSummary.maxGrade,
        legendOrBetter: state.unitSummary.legendOrBetter,
        bossKills: state.boss.kills,
        bossFails: state.boss.failedRounds,
      });
    }
    if (state.mode === "ended" || state.round > maxRound) break;
  }

  const finalState = await readState(page);
  const endedAt = new Date().toISOString();
  const final = {
    dataVersion: finalState.dataVersion,
    stateChecksum: finalState.stateChecksum,
    difficulty: finalState.difficulty,
    stage: finalState.stage,
    round: finalState.round,
    mode: finalState.mode,
    cleared: finalState.cleared,
    pressure: `${finalState.resources.enemyPressure}/${finalState.resources.enemyLimit}`,
    gold: finalState.resources.gold,
    unitSummary: finalState.unitSummary,
    boss: finalState.boss,
  };
  return {
    seed,
    steps,
    simulatedSeconds: steps * (stepMs / 1000),
    endedAt,
    final,
    codexDirectSession: codexDirectSession({
      scenario,
      seed,
      simulatedSeconds: steps * (stepMs / 1000),
      final,
      endedAt,
    }),
    codexDirectPlaylogCommand: manualPlaylogCommand({
      scenario,
      seed,
      simulatedSeconds: steps * (stepMs / 1000),
      final,
      endedAt,
    }),
    samples,
  };
}

function summarizeScenario(scenario, runs) {
  const clearCount = runs.filter((r) => r.final.cleared).length;
  const avgRound = runs.reduce((sum, r) => sum + r.final.round, 0) / runs.length;
  const avgLegend = runs.reduce((sum, r) => sum + r.final.unitSummary.legendOrBetter, 0) / runs.length;
  const totalSimulatedSeconds = runs.reduce((sum, r) => sum + r.simulatedSeconds, 0);
  const avgPressureRatio = runs.reduce((sum, r) => {
    const [current, limit] = r.final.pressure.split("/").map((v) => Number(v));
    return sum + current / Math.max(1, limit);
  }, 0) / runs.length;
  return {
    id: scenario.id,
    label: scenario.label,
    difficulty: scenario.difficulty,
    options: scenario.options,
    expectation: scenario.expectation,
    clearRate: clearCount / runs.length,
    avgRound,
    avgLegendOrBetter: avgLegend,
    totalSimulatedSeconds,
    avgSimulatedSeconds: totalSimulatedSeconds / runs.length,
    avgPressureRatio,
    runs,
  };
}

function codexDirectLog(results) {
  return {
    schemaVersion: 1,
    source: "manual-playlog",
    generatedBy: "browser-direct",
    generatedAt: new Date().toISOString(),
    dataVersion: CURRENT_DATA_VERSION,
    sessions: results.flatMap((scenario) => scenario.runs.map((run) => run.codexDirectSession)),
    pendingSessions: [],
  };
}

function scenarioById(results, id) {
  return results.find((r) => r.id === id);
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function evaluateObservations(results) {
  const novice = scenarioById(results, "noviceHero");
  const normalNoLegend = scenarioById(results, "normalNoLegend");
  const normalOneLegend = scenarioById(results, "normalOneLegend");
  const normalTwoLegend = scenarioById(results, "normalTwoLegend");
  const intermediateTwoLegend = scenarioById(results, "intermediateTwoLegend");
  const intermediateFiveLegend = scenarioById(results, "intermediateFiveLegend");
  const expertFiveLegend = scenarioById(results, "expertFiveLegend");
  const expertOpen = scenarioById(results, "expertOpen");
  const masterOpen = scenarioById(results, "masterOpen");
  const gates = [];

  if (novice) {
    gates.push({
      label: "입문자 직접 플레이 표본은 전설 없이 클리어권",
      pass: novice.clearRate >= 0.5 || novice.avgRound >= 39,
      detail: `${pct(novice.clearRate)}, 평균 ${novice.avgRound.toFixed(1)}R, 평균 전설 ${novice.avgLegendOrBetter.toFixed(1)}`,
    });
  }
  if (normalNoLegend && normalOneLegend && normalTwoLegend) {
    gates.push({
      label: "일반 직접 플레이 표본은 1~2전설 조건이 무전설보다 유리",
      pass: normalNoLegend.clearRate <= 0.5 &&
        (normalTwoLegend.clearRate > normalNoLegend.clearRate ||
          normalTwoLegend.avgRound >= normalNoLegend.avgRound + 1 ||
          normalTwoLegend.avgPressureRatio < normalNoLegend.avgPressureRatio),
      detail: `0전설 ${pct(normalNoLegend.clearRate)} ${normalNoLegend.avgRound.toFixed(1)}R 압박 ${pct(normalNoLegend.avgPressureRatio)}, 1전설 ${pct(normalOneLegend.clearRate)} ${normalOneLegend.avgRound.toFixed(1)}R 압박 ${pct(normalOneLegend.avgPressureRatio)}, 2전설 ${pct(normalTwoLegend.clearRate)} ${normalTwoLegend.avgRound.toFixed(1)}R 압박 ${pct(normalTwoLegend.avgPressureRatio)}`,
    });
  }
  if (intermediateTwoLegend && intermediateFiveLegend) {
    gates.push({
      label: "중급자 직접 플레이 표본은 5전설 조건이 2전설보다 유리",
      pass: intermediateFiveLegend.clearRate > intermediateTwoLegend.clearRate ||
        intermediateFiveLegend.avgRound >= intermediateTwoLegend.avgRound + 1 ||
        intermediateFiveLegend.avgPressureRatio < intermediateTwoLegend.avgPressureRatio,
      detail: `2전설 ${pct(intermediateTwoLegend.clearRate)} ${intermediateTwoLegend.avgRound.toFixed(1)}R 압박 ${pct(intermediateTwoLegend.avgPressureRatio)}, 5전설 ${pct(intermediateFiveLegend.clearRate)} ${intermediateFiveLegend.avgRound.toFixed(1)}R 압박 ${pct(intermediateFiveLegend.avgPressureRatio)}`,
    });
  }
  if (expertFiveLegend && expertOpen) {
    gates.push({
      label: "고수 직접 플레이 표본은 5전설보다 제한 없음이 유리",
      pass: expertOpen.clearRate > expertFiveLegend.clearRate ||
        expertOpen.avgRound >= expertFiveLegend.avgRound + 1 ||
        expertOpen.avgPressureRatio < expertFiveLegend.avgPressureRatio,
      detail: `5전설 ${pct(expertFiveLegend.clearRate)} ${expertFiveLegend.avgRound.toFixed(1)}R 압박 ${pct(expertFiveLegend.avgPressureRatio)}, 제한 없음 ${pct(expertOpen.clearRate)} ${expertOpen.avgRound.toFixed(1)}R 압박 ${pct(expertOpen.avgPressureRatio)}`,
    });
  }
  if (masterOpen) {
    gates.push({
      label: "초고수 직접 플레이 표본은 매우 어려움",
      pass: masterOpen.clearRate <= 0.1,
      detail: `${pct(masterOpen.clearRate)}, 평균 ${masterOpen.avgRound.toFixed(1)}R`,
    });
  }
  return gates;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url, { waitUntil: "networkidle" });
  const hooks = await page.evaluate(() => ({
    render: typeof window.render_game_to_text === "function",
    advance: typeof window.advanceTime === "function",
    dev: !!window.__randi_dev,
    newRun: typeof window.__randi_dev?.newRun === "function",
    act: typeof window.__randi_dev?.act === "function",
    balanceSnapshot: typeof window.__randi_dev?.balanceSnapshot === "function",
  }));
  assertHook(hooks.render, "render_game_to_text");
  assertHook(hooks.advance, "advanceTime");
  assertHook(hooks.dev, "__randi_dev");
  assertHook(hooks.newRun, "__randi_dev.newRun");
  assertHook(hooks.act, "__randi_dev.act");
  assertHook(hooks.balanceSnapshot, "__randi_dev.balanceSnapshot");

  const results = [];
  for (const scenario of scenarios) {
    const runs = [];
    for (let i = 0; i < seeds; i++) {
      const run = await playScenarioSeed(page, scenario, i);
      runs.push(run);
      console.log(`${scenario.label} #${i + 1}: ${run.final.mode} ${run.final.round}R, cleared ${run.final.cleared}, legends ${run.final.unitSummary.legendOrBetter}, pressure ${run.final.pressure}, simulated ${(run.simulatedSeconds / 60).toFixed(1)}m`);
    }
    const summary = summarizeScenario(scenario, runs);
    results.push(summary);
    if (screenshotDir) {
      mkdirSync(screenshotDir, { recursive: true });
      await clearModals(page);
      await page.screenshot({ path: `${screenshotDir}/${scenario.id}.png`, fullPage: true });
    }
  }

  const observations = evaluateObservations(results);
  console.log("");
  console.log("## 브라우저 직접 플레이 관찰");
  for (const gate of observations) {
    console.log(`${gate.pass ? "PASS" : "CHECK"} ${gate.label} (${gate.detail})`);
  }

  const payload = {
    url,
    generatedAt: new Date().toISOString(),
    dataVersion: CURRENT_DATA_VERSION,
    seeds,
    maxRound,
    stepMs,
    totalSimulatedSeconds: results.reduce((sum, r) => sum + r.totalSimulatedSeconds, 0),
    scope: PLAYTEST_SCOPE,
    scenarios: results,
    observations,
    passed: observations.every((g) => g.pass),
  };
  if (outPath) {
    const dir = dirname(outPath);
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`JSON 리포트 저장: ${outPath}`);
  }
  if (codexLogPath) {
    const dir = dirname(codexLogPath);
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(codexLogPath, JSON.stringify(codexDirectLog(results), null, 2), "utf8");
    console.log(`Codex 직접 조작 보조 로그 저장: ${codexLogPath}`);
  }
  if (strict && !payload.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
