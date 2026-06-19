Original prompt: 완성된 에셋으로 게임 스테이지를 최대 15스테이지까지 구성한다. 각기 다른 맵의 형태를 지닌다. 필요한 에셋이 있으면 추가 생성하여 사용한다. 완성되고 정상적으로 게임 플레이가 되는것까지 확인 후 종료한다.

## Progress

- Added the dark fantasy village tileset asset sheet in the previous commit.
- Current task: wire that completed asset into playable game stages, up to 15 distinct stage maps, then verify gameplay.

## Notes

- Project uses Vite + TypeScript; per AGENTS instructions use `yarn` for build/test commands.
- Added `src/data/stages.ts` with 15 distinct stage maps, names, ground themes, paths, and decorations.
- Reworked path helpers and board rendering to use per-stage paths and draw decorations from the generated dark fantasy tileset PNG.
- Corrected stage semantics after user clarification: the player now selects one map at run start, plays a 40-round arc on that fixed map, and unlocks the next map only after clearing the round 40 boss.
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
- Latest checks passed: `yarn build`, `yarn test`, `yarn check`, balance matrix simulations with `yarn sim`, and Playwright browser UI/state checks.

## TODO

- The requested "about 2 hours of direct play" balance pass is still not completed; current evidence is automated autoplay plus short browser UI/playtest smoke checks.
