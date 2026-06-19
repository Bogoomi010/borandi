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
- Added deterministic testing hooks: `window.render_game_to_text`, `window.advanceTime(ms)`, and DEV-only `window.__randi_dev` for browser playtests.
- Latest checks passed: `yarn build`, `yarn test`, `yarn check`, `yarn sim --seeds=10 --difficulty=novice --strategy=balanced`, `cargo test` in `src-tauri`, and the develop-web-game Playwright client plus full-page Playwright screenshots.

## TODO

- None for the current goal.
