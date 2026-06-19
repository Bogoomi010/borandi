Original prompt: 완성된 에셋으로 게임 스테이지를 최대 15스테이지까지 구성한다. 각기 다른 맵의 형태를 지닌다. 필요한 에셋이 있으면 추가 생성하여 사용한다. 완성되고 정상적으로 게임 플레이가 되는것까지 확인 후 종료한다.

## Progress

- Added the dark fantasy village tileset asset sheet in the previous commit.
- Current task: wire that completed asset into playable game stages, up to 15 distinct stage maps, then verify gameplay.

## Notes

- Project uses Vite + TypeScript; per AGENTS instructions use `yarn` for build/test commands.
- Added `src/data/stages.ts` with 15 distinct stage maps, names, ground themes, paths, and decorations.
- Reworked path helpers and board rendering to use per-stage paths and draw decorations from the generated dark fantasy tileset PNG.
- Corrected stage semantics after user clarification: the player now selects one map at run start, plays a 40-round arc on that fixed map, and unlocks the next map only after clearing the round 40 boss.
- Hardened the profile unlock rule so even a bad caller cannot unlock the next map before a cleared run reaches the 40-round final boss condition; added focused tests for pre-40 clear flags, 40R clears, and 40R losses.
- Restored wave progression to 40 rounds with bosses at 10/20/30/40; boss rounds now require the boss kill before round completion.
- Added `stageId` to game state, save metadata, replay/checksum, result summaries, and render_game_to_text.
- Added map selection and lock display to the new game modal; profile stores `unlockedStage`.
- Added five difficulties for balance testing: beginner, normal, intermediate, expert, and master.
- Added simulation controls for max grade and max legend count so balance checks can verify "no legend", "2 legends", and "5 legends" constraints.
- Tuned difficulty HP/economy/unit-cap/enemy-limit values and late-grade unit stats using automated play matrices:
  - Beginner clears with hero-and-below only: 30/30 clears.
  - Normal needs legend help: 0 legends 2/30 clears, 2 legends 10/30 clears.
  - Intermediate rejects low legend counts but clears with enough scaling: 2 legends 4/30 clears, 5 legends 15/30 clears, unrestricted average 14.7 legends 30/30 clears.
  - Expert needs more than the intermediate legend budget: 5 legends 0/30 clears, unrestricted average 13.8 legends 19/30 clears.
  - Master is intentionally severe in balanced autoplay: unrestricted 0/30 clears.
- Improved the autoplay balance harness so legendary crafting and legend-limit pruning prefer a useful spread of legend units instead of stacking/saving only one high boss-damage recipe.
- Added `yarn balance` as a repeatable 30-seed five-difficulty balance gate matching the current target bands.
- Added `yarn balance --json=...` for storing scenario reports and pass/fail gate results as machine-readable evidence.
- Added an in-game `Tools > 5난이도 밸런스 게이트` modal that reuses the same gate logic and can export Markdown/JSON reports.
- Added deterministic testing hooks: `window.render_game_to_text`, `window.advanceTime(ms)`, and DEV-only `window.__randi_dev` for browser playtests.
- Added `difficulty` and `round` to `render_game_to_text` so browser playtests can verify the selected difficulty and current run state directly.
- Re-ran the 30-seed five-difficulty balance gate on the current tree; all gates passed with 입문자 100.0%, 일반 0전설 6.7%, 일반 2전설 33.3%, 중급자 2전설 13.3%, 중급자 5전설 50.0%, 중급자 제한 없음 100.0%, 고수 5전설 0.0%, 고수 제한 없음 63.3%, 초고수 제한 없음 0.0%.
- Verified the browser new-game UI starts all five difficulties and that `render_game_to_text` reports the expected difficulty id/name, stage, round, gold, life, and enemy limit.
- Extended DEV-only `window.__randi_dev.newRun` to support `newRun(seed, difficulty, stageId)` while preserving the old `newRun(seed, stageId)` shape, so browser playtests can jump directly into any of the five difficulties.
- Ran a short browser direct-play loop on all five difficulties using summon/startWave/advanceTime. With the same early actions, 입문자 reached 3R with pressure 0/100, 일반 41/54, 중급자 34/52, 고수 41/46, and 초고수 ended at 3R with pressure 39/32. This supports the current early-game difficulty separation but is still not a substitute for the requested 2-hour manual pass.
- Added `unitSummary` and `boss` to `render_game_to_text`, including grade counts, legend-or-better count, max grade, boss kills, and boss failed rounds, so browser playtests can inspect whether runs match the legend-count balance targets.
- Verified the new browser state fields with targeted DEV-spawn checks: normal with 2 legends reported `legendOrBetter: 2`, intermediate with 5 legends reported `legendOrBetter: 5`, and master with no legends reported `legendOrBetter: 0` while ending early at 40/32 pressure.
- Added `yarn browser-balance` as a Playwright-backed browser runtime playtest harness. With a running `yarn dev` server, it starts target difficulty scenarios through DEV hooks, advances real browser game time, records JSON, and can capture screenshots.
- Latest browser-balance smoke reached 11R after the 10R boss with 입문자/전설 없음, 일반/전설 2개, 중급자/전설 5개, and 고수/전설 5개. Boss kill times separated difficulty feel: 입문자 8.5s, 일반 131.8s, 중급자 16.2s, 고수 66.4s. 초고수/전설 없음 ended at 3R with 39/32 pressure.
- Upgraded `yarn browser-balance` from a report-only smoke into a pass/fail browser gate. It now exits nonzero if the browser runtime no longer proves the five early-play criteria, and writes `passed` plus per-gate details into JSON.
- Latest browser-balance gate passed all 5 checks: 입문자 no-legend reached 11R after 10R boss, normal 2-legend reached 11R, intermediate 5-legend reached 11R, expert 5-legend had a first-boss kill at least 2x slower than intermediate, and master no-legend collapsed by 3R at 39/32 pressure.
- Added browser-balance negative-control scenarios for normal 2-hero and intermediate 2-legend. Latest 7-gate run passed: normal 2-hero collapsed at 7R with 68/54 pressure while normal 2-legend reached 11R; intermediate 2-legend reached 11R but killed the 10R boss in 134.5s versus 16.2s for 5 legends.
- Added `yarn browser-direct`, a Playwright-backed browser sampler that does not DEV-spawn fixed units. It starts target difficulty runs through the DEV new-run hook, then repeatedly uses the real action path for summon, selector picks, 3-merge, craft, upgrade, startWave, and advanceTime to gather longer direct-play balance evidence.
- Added DEV-only `window.__randi_dev.balanceSnapshot()` so browser balance tooling can read craftable recipes, selector candidates, upgrade costs, unit grades, and unit scores without mutating game state.
- Latest `yarn browser-direct --seeds=1` observation: 입문자/무전설 cleared 40R with 0/100 pressure, 일반/0전설 failed at 40R with 60/54 pressure, 일반/2전설 failed at 39R with 77/54 pressure, 중급자/2전설 failed at 37R, 중급자/5전설 cleared 40R, 고수/5전설 failed at 40R, 고수/제한 없음 failed at 40R with lower pressure, and 초고수/제한 없음 failed at 32R. This is useful browser-runtime direct-play evidence, but the normal-difficulty single seed is noisy and still needs broader manual/playtest coverage.
- Latest `yarn balance --json=output/current-balance.json` 30-seed gate passed all 5 target bands: 입문자/전설 없음 100.0%, 일반 0전설 6.7% vs 2전설 33.3%, 중급자 2전설 13.3% vs 5전설 50.0% and unrestricted 100.0%, 고수 5전설 0.0% vs unrestricted 63.3%, 초고수 unrestricted 0.0%.
- `yarn browser-direct` now records per-run and total simulated play seconds in JSON. Latest `yarn browser-direct --seeds=2` covered 16 browser-runtime direct-play runs and 555.9 minutes / 9.27 hours of simulated game time: 입문자/무전설 2/2 clears, 일반/0전설 0/2 clears, 일반/2전설 0/2 clears but higher average round and lower pressure than 0전설, 중급자/2전설 1/2 clears, 중급자/5전설 1/2 clears, 고수/5전설 0/2 clears, 고수/unrestricted 1/2 clears, 초고수/unrestricted 0/2 clears. The intermediate two-seed direct sampler remains noisy; rely on `yarn balance` for the 30-seed target-band gate.
- Tightened the intermediate balance gate to better match "전설 5개 이상": 중급자/2전설 must now stay at or below 15% clear rate, and 중급자/5전설 must clear at least 30%p more often than 2전설. Latest `yarn balance --json=output/current-balance.json` still passed with 중급자/2전설 13.3%, 중급자/5전설 50.0%, and 중급자/unrestricted 100.0%.
- Added `yarn balance-audit`, which reads the `yarn balance`, `yarn browser-balance`, and `yarn browser-direct` JSON outputs and prints a single requirement-by-requirement Markdown audit. It explicitly marks the requested real 2-hour manual play session as MISSING so automated evidence is not mistaken for full completion.
- Extended `yarn balance-audit` with `--manual=...` support and added `docs/manual-balance-playlog.example.json`; the manual item passes only when logged sessions cover all five difficulties and total at least 120 minutes.
- Latest `yarn balance-audit --out=output/balance-audit.md` loaded all three JSON sources and reported PASS for five difficulties, novice no-legend, normal 0-vs-2 legend, intermediate 2-vs-5 legend, expert 5-legend-vs-open, master difficulty, browser 10R gates, and browser direct automated samples. It reported MISSING only for the real 2-hour human manual play session.
- Latest checks passed: `yarn test`, `yarn build`, `yarn check`, `yarn balance`, `yarn browser-balance`, `yarn browser-direct --seeds=1`, `yarn browser-direct --seeds=2`, `yarn balance-audit`, and the web game Playwright smoke client against the local dev server.
- Tightened map progression again after clarification: a 40R clear only unlocks the next map when the cleared map is exactly the current unlocked frontier, so bypassed/locked map clears cannot skip the intended map-by-map progression.
- Tightened the normal-difficulty balance target to include a 1-legend scenario, then softened only normal difficulty slightly. Latest `yarn balance --json=output/current-balance.json` passed with 입문자/전설 없음 100.0%, 일반 0전설 20.0% vs 1전설 40.0% vs 2전설 56.7%, 중급자 2전설 13.3% vs 5전설 50.0% and unrestricted 100.0%, 고수 5전설 0.0% vs unrestricted 63.3%, 초고수 unrestricted 0.0%.
- Softened expert slightly after browser-direct showed unrestricted expert was too brittle under real input automation; the 30-seed gate still passed with 고수 5전설 0.0% vs unrestricted 63.3%, and targeted browser-direct expert seeds passed with 5전설 0/2 clears vs unrestricted 1/2 clears.
- Browser-direct now reuses the same seed index across compared scenarios, so 0/1/2 legend and 2/5 legend comparisons are less polluted by unrelated RNG differences. Targeted browser-direct checks passed for normal 0/1/2 legend, intermediate 2/5 legend, and expert 5-legend/open comparisons, but the full 2-seed strict browser-direct sweep remains noisy and should be treated as auxiliary evidence rather than the primary gate.
- Added `yarn manual-playlog` so real human play sessions can be appended to `output/manual-balance-playlog.json` with difficulty, time, result, stage, round, legend count, and notes; `yarn balance-audit --manual=...` can then evaluate the requested 120-minute / five-difficulty manual evidence.
- Result summaries now include difficulty id, legend/hidden counts, wall-clock session duration, and a ready-to-run `yarn manual-playlog` command in the result modal/report, so a human playtest can be logged immediately after each run.
- `yarn balance-audit --manual=...` now checks manual logs for the actual target outcomes, not just time: novice no-legend clear, normal 1-2 legend clear, intermediate 5+ legend clear, expert 5-or-fewer legend loss plus 6+ legend clear, and master loss.
- Manual target auditing now requires 40R evidence for manual clear rows and for the expert 5-or-fewer legend failure case, so an early or mislabeled clear cannot satisfy the requested 40-round balance proof.
- `yarn balance-audit` now audits browser-direct JSON by target scenario and per-difficulty observation, instead of accepting any nonzero simulated browser-direct time as sufficient automated direct-input evidence.
- Browser-direct selection now receives unit roles from the DEV balance snapshot and scores legend choices with family/role diversity bonuses, so 5-legend samples are less likely to waste the higher legend budget on redundant roles.
- Latest browser-direct strict pass after role-diverse legend selection: 입문자/무전설 cleared 40R, 일반/0전설 failed 38R while 1전설 and 2전설 cleared 40R, 중급자/2전설 failed 40R while 5전설 cleared 40R, 고수/5전설 failed 40R while unrestricted cleared 40R with 14 legends, and 초고수/unrestricted failed at 3R.
- Latest 30-seed `yarn balance` gate still passed after the browser-direct tooling change: 입문자 100.0%, 일반 0/1/2전설 20.0%/40.0%/56.7%, 중급자 2전설 13.3% vs 5전설 50.0%, 고수 5전설 0.0% vs unrestricted 63.3%, 초고수 0.0%.

## TODO

- The requested "about 2 hours of direct play" balance pass is still not completed; current evidence is automated autoplay plus short browser UI/playtest smoke checks.
