// 샌드박스/CI 보조 검증 스크립트 (npm 의존성 없이 Node만으로 코어 로직 스모크 테스트)
// - src/core, src/data, src/sim 을 임시 폴더로 복사하며 상대 import에 .ts 확장자를 붙인 뒤
//   node --experimental-strip-types 로 실행한다.
// 정식 테스트는 `yarn test`(vitest)를 사용한다.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = "/tmp/randi-check";
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, "src"), { recursive: true });

for (const dir of ["core", "data", "sim"]) {
  cpSync(join(root, "src", dir), join(tmp, "src", dir), { recursive: true });
}

// 상대 import에 .ts 확장자 추가
function rewrite(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { rewrite(p); continue; }
    if (!p.endsWith(".ts")) continue;
    let code = readFileSync(p, "utf8");
    code = code.replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (m, a, spec, c) =>
      spec.endsWith(".ts") ? m : `${a}${spec}.ts${c}`);
    writeFileSync(p, code);
  }
}
rewrite(join(tmp, "src"));

writeFileSync(join(tmp, "main.ts"), `
import { Game, replay } from "./src/core/engine.ts";
import { stateChecksum } from "./src/core/checksum.ts";
import { playFullRun } from "./src/sim/autoPlayer.ts";
import { runSimulation, reportToMarkdown } from "./src/sim/runner.ts";
import { UNITS, UNIT_BY_ID } from "./src/data/units.ts";
import { RECIPES } from "./src/data/recipes.ts";
import { BOSS_ROUND_LIST, FINAL_ROUND, WAVES } from "./src/data/waves.ts";
import { DIFFICULTIES, SUMMON_TABLE, PITY_TABLE, PITY_THRESHOLD } from "./src/data/difficulty.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log((cond ? "  ok " : "  FAIL ") + name);
  if (!cond) failures++;
}

console.log("[1] 데이터 무결성");
check("소환 확률 합 100", Object.values(SUMMON_TABLE).reduce((a, b) => a + b, 0) === 100);
check("보정 확률 합 100", Object.values(PITY_TABLE).reduce((a, b) => a + b, 0) === 100);
check("난이도 5종", JSON.stringify(DIFFICULTIES.map((d) => d.id)) === JSON.stringify(["novice", "normal", "intermediate", "expert", "master"]));
check("상위 난이도 적 누적 허용치 감소",
  JSON.stringify(DIFFICULTIES.map((d) => d.enemyLimit)) === JSON.stringify([...DIFFICULTIES].map((d) => d.enemyLimit).sort((a, b) => b - a)));
check("조합식 유닛 ID 유효", RECIPES.every((r) =>
  UNIT_BY_ID[r.resultUnitId] && r.ingredients.every((i) => !i.unitId || UNIT_BY_ID[i.unitId])));
check("유닛 ID 중복 없음", new Set(UNITS.map((u) => u.id)).size === UNITS.length);
check("웨이브 40개", WAVES.length === FINAL_ROUND);
check("보스 라운드 10/20/30/40",
  JSON.stringify(WAVES.filter((w) => w.type === "boss").map((w) => w.round)) === JSON.stringify(BOSS_ROUND_LIST));

console.log("[2] 소환/보정");
{
  const a = new Game("SEED1", "novice");
  const b = new Game("SEED1", "novice");
  for (let i = 0; i < 5; i++) { a.dispatch("summon"); b.dispatch("summon"); }
  check("같은 시드 같은 소환", JSON.stringify(a.state.units.map(u => u.defId)) === JSON.stringify(b.state.units.map(u => u.defId)));
  const g = new Game("PITY", "novice");
  g.state.gold = 99999;
  g.state.summonStats.consecutiveCommon = PITY_THRESHOLD;
  g.dispatch("summon");
  const last = g.state.units[g.state.units.length - 1];
  check("보정 발동 시 희귀 이상", UNIT_BY_ID[last.defId].grade !== "common");
}

console.log("[3] 조합/잠금");
{
  const g = new Game("CRAFT", "novice");
  const give = (defId: string, n: number) => {
    for (let i = 0; i < n; i++) g.state.units.push({
      uid: g.state.nextUid++, defId, locked: false,
      x: 130 + g.state.units.length * 30, y: 30,
      acquiredRound: 1, totalDamage: 0, skillDamage: 0, cooldown: 0, skillCd: [], buffs: [],
      state: "idle", order: { kind: "none" }, anchorX: 130 + g.state.units.length * 30, anchorY: 30,
    });
  };
  give("ember_scout", 2); give("rift_eye", 1);
  g.state.gold = 100;
  const res = g.dispatch("craft", { recipeId: "recipe_flame_mage" });
  check("지정 조합 성공", res.ok && g.state.units.some(u => u.defId === "flame_mage"));
  check("첫 조합 미션 완료", g.state.missions.find(m => m.defId === "mission_first_recipe")!.status === "done");

  const g2 = new Game("LOCK", "novice");
  const give2 = (defId: string, n: number) => {
    for (let i = 0; i < n; i++) g2.state.units.push({
      uid: g2.state.nextUid++, defId, locked: true,
      x: 130 + g2.state.units.length * 30, y: 30,
      acquiredRound: 1, totalDamage: 0, skillDamage: 0, cooldown: 0, skillCd: [], buffs: [],
      state: "idle", order: { kind: "none" }, anchorX: 130 + g2.state.units.length * 30, anchorY: 30,
    });
  };
  give2("ember_scout", 2); give2("rift_eye", 1);
  g2.state.gold = 100;
  check("잠금 재료 보호", !g2.dispatch("craft", { recipeId: "recipe_flame_mage" }).ok);
}

console.log("[4] phase 규칙");
{
  const g = new Game("PHASE", "novice");
  g.dispatch("startWave");
  check("전투 중 3합성 명령 처리", !g.dispatch("merge3", { unitIds: [1, 2, 3] }).ok);
  check("전투 중 판매 명령 처리", !g.dispatch("sell", { unitIds: [1] }).ok);
  check("전투 중 소환 허용", g.dispatch("summon").ok);
}

console.log("[5] 풀런 결정론/리플레이");
{
  const a = new Game("FULL-1", "novice");
  playFullRun(a);
  console.log("    도달 라운드:", a.state.round, "클리어:", a.state.cleared, "tick:", a.state.tick);
  const ck = stateChecksum(a.state);
  const b = new Game("FULL-1", "novice");
  playFullRun(b);
  check("같은 시드 풀런 동일 체크섬", stateChecksum(b.state) === ck);
  const r = replay("FULL-1", "novice", a.state.stageId, a.state.inputHistory);
  check("리플레이 동일 체크섬", stateChecksum(r.state) === ck);
}

console.log("[6] 30시드 밸런스 스모크");
{
  const rep = runSimulation(30, "novice", "balanced");
  console.log(reportToMarkdown(rep).split("\\n").slice(0, 12).join("\\n"));
  check("10라운드 도달률 80%+", (30 - Object.entries(rep.deathRounds)
    .filter(([r]) => Number(r) < 10).reduce((a, [, n]) => a + n, 0)) / 30 >= 0.8);
}

console.log(failures === 0 ? "\\nALL OK" : "\\nFAILURES: " + failures);
process.exit(failures === 0 ? 0 : 1);
`);

execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", join(tmp, "main.ts")], {
  stdio: "inherit",
});
