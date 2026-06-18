Original prompt: 완성된 에셋으로 게임 스테이지를 최대 15스테이지까지 구성한다. 각기 다른 맵의 형태를 지닌다. 필요한 에셋이 있으면 추가 생성하여 사용한다. 완성되고 정상적으로 게임 플레이가 되는것까지 확인 후 종료한다.

## Progress

- Added the dark fantasy village tileset asset sheet in the previous commit.
- Current task: wire that completed asset into playable game stages, up to 15 distinct stage maps, then verify gameplay.

## Notes

- Project uses Vite + TypeScript; per AGENTS instructions use `yarn` for build/test commands.
- Existing game is a round-based random defense. Treat rounds 1-15 as stages for this goal.
- Added `src/data/stages.ts` with 15 distinct stage maps, names, ground themes, paths, and decorations.
- Reworked path helpers and board rendering to use per-stage paths and draw decorations from the generated dark fantasy tileset PNG.
- Compressed waves/bosses/recipes/missions from the old 40-round arc into a 15-stage arc.
- Added deterministic testing hooks: `window.render_game_to_text`, `window.advanceTime(ms)`, and DEV-only `window.__randi_dev` for browser playtests.
- Verified browser gameplay visits stages 1 through 15 and only clears after the final boss is killed (`wave.killed=1`, `enemyPressure=0`, `cleared=true`).
- Final checks passed: `yarn build`, `yarn test`, `yarn check`, `yarn sim --seeds=30 --difficulty=novice --strategy=balanced`, and the develop-web-game Playwright client.

## TODO

- None for the current goal.
