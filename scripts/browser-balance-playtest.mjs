// Browser balance playtest smoke.
// Requires a running dev server: yarn dev --host 127.0.0.1 --port 1421

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const url = String(args.url ?? "http://127.0.0.1:1421/");
const outPath = typeof args.json === "string" && args.json !== "true" ? args.json : "";
const screenshotDir = typeof args.screenshots === "string" && args.screenshots !== "true" ? args.screenshots : "";

const LEGENDS = ["solar_avatar", "chrono_marshal", "titan_slayer", "ancient_world_tree"];
const HEROES = ["phoenix_archmage", "glacier_warden", "tempest_blademaster", "fortress_breaker", "abyss_oracle", "world_tree_sage"];

const scenarios = [
  {
    id: "noviceHeroOnly",
    label: "입문자 / 전설 없음",
    difficulty: "novice",
    units: HEROES,
    targetRound: 11,
  },
  {
    id: "normalTwoLegend",
    label: "일반 / 전설 2개",
    difficulty: "normal",
    units: LEGENDS.slice(0, 2),
    targetRound: 11,
  },
  {
    id: "normalTwoHero",
    label: "일반 / 영웅 2개",
    difficulty: "normal",
    units: HEROES.slice(0, 2),
    targetRound: 11,
  },
  {
    id: "intermediateTwoLegend",
    label: "중급자 / 전설 2개",
    difficulty: "intermediate",
    units: LEGENDS.slice(0, 2),
    targetRound: 11,
  },
  {
    id: "intermediateFiveLegend",
    label: "중급자 / 전설 5개",
    difficulty: "intermediate",
    units: [...LEGENDS, LEGENDS[0]],
    targetRound: 11,
  },
  {
    id: "expertFiveLegend",
    label: "고수 / 전설 5개",
    difficulty: "expert",
    units: [...LEGENDS, LEGENDS[0]],
    targetRound: 11,
  },
  {
    id: "masterNoLegend",
    label: "초고수 / 전설 없음",
    difficulty: "master",
    summonCount: 4,
    targetRound: 5,
  },
];

function assertHook(value, name) {
  if (!value) throw new Error(`missing browser playtest hook: ${name}`);
}

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function runScenario(page, scenario) {
  await page.evaluate(({ difficulty, id }) => {
    window.__randi_dev.newRun(`BROWSER-${id}`, difficulty, 1);
  }, scenario);
  await page.waitForTimeout(80);

  for (const defId of scenario.units ?? []) {
    const ok = await page.evaluate((unitId) => window.__randi_dev.act("devSpawn", { defId: unitId }), defId);
    if (!ok) throw new Error(`${scenario.id}: devSpawn failed for ${defId}`);
  }
  for (let i = 0; i < (scenario.summonCount ?? 0); i++) {
    await page.evaluate(() => window.__randi_dev.act("summon"));
  }

  const samples = [];
  await page.evaluate(() => window.__randi_dev.act("startWave"));
  for (let step = 0; step < 80; step++) {
    await page.evaluate(() => window.advanceTime(5000));
    const state = await readState(page);
    if (step % 4 === 0 || state.mode === "ended" || state.round >= scenario.targetRound) {
      samples.push({
        step,
        round: state.round,
        mode: state.mode,
        pressure: `${state.resources.enemyPressure}/${state.resources.enemyLimit}`,
        legendOrBetter: state.unitSummary.legendOrBetter,
        maxGrade: state.unitSummary.maxGrade,
        bossKills: state.boss.kills,
        bossFails: state.boss.failedRounds,
      });
    }
    if (state.mode === "ended" || state.round >= scenario.targetRound) break;
    if (state.resources.breakTicks > 0) await page.evaluate(() => window.__randi_dev.act("startWave"));
  }

  const finalState = await readState(page);
  if (screenshotDir) {
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: `${screenshotDir}/${scenario.id}.png`, fullPage: true });
  }
  return {
    id: scenario.id,
    label: scenario.label,
    difficulty: finalState.difficulty,
    targetRound: scenario.targetRound,
    final: {
      round: finalState.round,
      mode: finalState.mode,
      pressure: `${finalState.resources.enemyPressure}/${finalState.resources.enemyLimit}`,
      unitSummary: finalState.unitSummary,
      boss: finalState.boss,
      cleared: finalState.cleared,
    },
    samples,
  };
}

function getScenario(results, id) {
  const result = results.find((r) => r.id === id);
  if (!result) throw new Error(`missing scenario result: ${id}`);
  return result;
}

function boss10Seconds(result) {
  const value = result.final.boss.kills["10"];
  return typeof value === "number" ? value : null;
}

function pressureParts(result) {
  const [current, limit] = result.final.pressure.split("/").map((v) => Number(v));
  return { current, limit };
}

function isWeakerEarlyRun(weak, strong) {
  const weakBoss10 = boss10Seconds(weak);
  const strongBoss10 = boss10Seconds(strong);
  const weakPressure = pressureParts(weak);
  const strongPressure = pressureParts(strong);
  if (weak.final.mode === "ended" && strong.final.mode !== "ended") return true;
  if (weak.final.round < strong.final.round) return true;
  if (weakBoss10 === null && strongBoss10 !== null) return true;
  if (weakBoss10 !== null && strongBoss10 !== null && weakBoss10 >= strongBoss10 * 1.5) return true;
  return weakPressure.current > strongPressure.current;
}

function evaluateGates(results) {
  const novice = getScenario(results, "noviceHeroOnly");
  const normal = getScenario(results, "normalTwoLegend");
  const normalWeak = getScenario(results, "normalTwoHero");
  const intermediateWeak = getScenario(results, "intermediateTwoLegend");
  const intermediate = getScenario(results, "intermediateFiveLegend");
  const expert = getScenario(results, "expertFiveLegend");
  const master = getScenario(results, "masterNoLegend");
  const intermediateBoss10 = boss10Seconds(intermediate);
  const expertBoss10 = boss10Seconds(expert);
  const masterPressure = pressureParts(master);

  return [
    {
      label: "입문자는 전설 없이도 10R 보스 이후까지 안정",
      pass: novice.final.round >= 11 &&
        novice.final.unitSummary.legendOrBetter === 0 &&
        boss10Seconds(novice) !== null &&
        novice.final.boss.failedRounds.length === 0,
      detail: `${novice.final.round}R, 전설 ${novice.final.unitSummary.legendOrBetter}, 10R 보스 ${boss10Seconds(novice) ?? "미처치"}s`,
    },
    {
      label: "일반은 전설 2개로 10R 보스 이후까지 진입",
      pass: normal.final.round >= 11 &&
        normal.final.unitSummary.legendOrBetter === 2 &&
        boss10Seconds(normal) !== null &&
        normal.final.boss.failedRounds.length === 0,
      detail: `${normal.final.round}R, 전설 ${normal.final.unitSummary.legendOrBetter}, 10R 보스 ${boss10Seconds(normal) ?? "미처치"}s`,
    },
    {
      label: "일반은 2영웅보다 2전설 조건이 명확히 유리",
      pass: normalWeak.final.unitSummary.legendOrBetter === 0 &&
        isWeakerEarlyRun(normalWeak, normal),
      detail: `2영웅 ${normalWeak.final.round}R ${normalWeak.final.pressure} 10R=${boss10Seconds(normalWeak) ?? "미처치"}, 2전설 ${normal.final.round}R ${normal.final.pressure} 10R=${boss10Seconds(normal) ?? "미처치"}`,
    },
    {
      label: "중급자는 2전설보다 5전설 조건이 명확히 유리",
      pass: intermediateWeak.final.unitSummary.legendOrBetter === 2 &&
        isWeakerEarlyRun(intermediateWeak, intermediate),
      detail: `2전설 ${intermediateWeak.final.round}R ${intermediateWeak.final.pressure} 10R=${boss10Seconds(intermediateWeak) ?? "미처치"}, 5전설 ${intermediate.final.round}R ${intermediate.final.pressure} 10R=${boss10Seconds(intermediate) ?? "미처치"}`,
    },
    {
      label: "중급자는 전설 5개로 10R 보스 이후까지 진입",
      pass: intermediate.final.round >= 11 &&
        intermediate.final.unitSummary.legendOrBetter >= 5 &&
        intermediateBoss10 !== null &&
        intermediate.final.boss.failedRounds.length === 0,
      detail: `${intermediate.final.round}R, 전설 ${intermediate.final.unitSummary.legendOrBetter}, 10R 보스 ${intermediateBoss10 ?? "미처치"}s`,
    },
    {
      label: "고수는 같은 5전설 조건에서도 중급보다 첫 보스 처치가 확연히 느림",
      pass: expert.final.round >= 11 &&
        expert.final.unitSummary.legendOrBetter >= 5 &&
        expertBoss10 !== null &&
        intermediateBoss10 !== null &&
        expertBoss10 >= intermediateBoss10 * 2,
      detail: `중급 ${intermediateBoss10 ?? "미처치"}s, 고수 ${expertBoss10 ?? "미처치"}s`,
    },
    {
      label: "초고수는 무전설 초반 플레이가 빠르게 붕괴",
      pass: master.final.mode === "ended" &&
        master.final.round <= master.targetRound &&
        master.final.unitSummary.legendOrBetter === 0 &&
        masterPressure.current >= masterPressure.limit,
      detail: `${master.final.round}R ${master.final.pressure}, 전설 ${master.final.unitSummary.legendOrBetter}`,
    },
  ];
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
  }));
  assertHook(hooks.render, "render_game_to_text");
  assertHook(hooks.advance, "advanceTime");
  assertHook(hooks.dev, "__randi_dev");
  assertHook(hooks.newRun, "__randi_dev.newRun");
  assertHook(hooks.act, "__randi_dev.act");

  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario(page, scenario);
    results.push(result);
    console.log(`${result.label}: ${result.final.mode} ${result.final.round}R, pressure ${result.final.pressure}, legends ${result.final.unitSummary.legendOrBetter}`);
  }
  const gates = evaluateGates(results);

  console.log("");
  console.log("## 브라우저 게이트");
  for (const gate of gates) {
    console.log(`${gate.pass ? "PASS" : "FAIL"} ${gate.label} (${gate.detail})`);
  }

  const payload = {
    url,
    generatedAt: new Date().toISOString(),
    scenarios: results,
    gates,
    passed: gates.every((g) => g.pass),
  };
  if (outPath) {
    const dir = dirname(outPath);
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`JSON 리포트 저장: ${outPath}`);
  }
  if (!payload.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
