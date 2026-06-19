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

  const payload = {
    url,
    generatedAt: new Date().toISOString(),
    scenarios: results,
  };
  if (outPath) {
    const dir = dirname(outPath);
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`JSON 리포트 저장: ${outPath}`);
  }
} finally {
  await browser.close();
}
