# GPT Pro용 Pixi 기반 게임 구조 개선 프롬프트

아래 프롬프트를 GPT Pro에 전달해서 현재 게임 구조를 설명하고, Pixi 기반으로 더 나은 구조를 제안받기 위한 용도로 사용한다.

```markdown
너는 TypeScript, React, PixiJS v8, @pixi/react, Tauri 데스크톱 게임 구조를 잘 아는 시니어 게임 클라이언트 아키텍트다.

내 프로젝트는 `rift-random-defense`라는 2D 랜덤 디펜스/RTS 조작형 게임이다. 현재 Vite + React + Tauri 기반이고, 최근 React UI를 일부 Pixi 기반 컴포넌트로 옮겼다. 하지만 아직 전체 구조는 React 루트가 앱을 감싸고, 게임 런타임과 Pixi 렌더링이 느슨하게 연결되어 있다. 이 프로젝트를 더 본격적인 Pixi 기반 게임 구조로 개선하고 싶다.

아래 설명을 기준으로 현재 구조를 분석하고, Pixi를 활용해 어떤 구조로 바꾸면 좋은지 최대한 구체적으로 제안해 달라. 단순 아이디어가 아니라 실제 리팩터링 방향, 모듈 경계, 단계별 마이그레이션 계획, 위험 요소, 테스트 전략까지 포함해 달라.

## 1. 프로젝트 개요

- 기술 스택:
  - Vite
  - React 19
  - TypeScript
  - Tauri v2
  - PixiJS v8
  - @pixi/react v8
  - Vitest
  - Playwright 기반 브라우저 플레이 테스트 스크립트
- 앱 진입점:
  - `src/main.tsx`
  - `src/App.tsx`
- 현재 앱 구조:
  - React가 `#root`에 `App`을 렌더링한다.
  - `App.tsx`는 `useEffect`에서 `gameRuntime.ts`를 동적으로 import해서 게임 런타임을 시작한다.
  - `useSyncExternalStore`로 `runtimeBridge.ts`의 런타임 스냅샷을 구독한다.
  - 실제 게임 화면의 주요 UI는 `PixiBoard`, `PixiTopbar`, `PixiActionbar`, `PixiRightPanel`, `PixiMenubar`, `PixiModalHost`, `PixiToastHost`, `PixiTitleScene`, `PixiTitleBackground` 같은 Pixi 컴포넌트로 나뉘어 있다.
- 현재 목표:
  - 게임 구조를 Pixi 중심으로 재설계하고 싶다.
  - 단, 게임 규칙 엔진의 결정성, 저장/리플레이 구조, 테스트 가능성은 반드시 유지하고 싶다.

## 2. 게임 장르와 플레이 방식

이 게임은 랜덤 디펜스와 RTS식 유닛 조작이 섞인 구조다.

기본 진행:

- 한 판은 시작할 때 선택한 하나의 맵으로 고정된다.
- 해당 맵에서 1라운드부터 40라운드까지 진행한다.
- 10, 20, 30, 40라운드가 보스 라운드다.
- 40라운드 최종 보스를 처치하면 클리어다.
- 적은 맵별 waypoint 루프 경로를 따라 계속 순환한다.
- 별도의 입구/출구 누수 개념보다는, 적이 누적되어 허용치 이상 쌓이면 방어선이 무너지는 방식이다.
- 난이도별 적 누적 허용치, 유닛 보유 한도, 시작 골드, 적 체력 배율, 골드 배율 등이 다르다.

전투/조작:

- 보드는 고정 좌표계 `960 x 560`을 사용한다.
- 적은 `dist`라는 경로 진행 거리로 위치를 표현하고, `posAtDist(dist, stageId)`로 실제 좌표를 계산한다.
- 유닛은 보드 내부 자유 좌표에 배치되고 이동한다.
- 유닛은 RTS처럼 선택, 박스 선택, 이동, 공격 이동, 지정 공격, 정지/hold 명령을 받을 수 있다.
- 명령이 없으면 자신의 anchor 주변에서 적을 자동 탐지/공격한다.
- 공격 이동 중에는 이동하면서 적을 발견하면 교전한다.
- 지정 공격은 특정 적을 추적하지만 leash 범위를 벗어나면 복귀한다.
- 전투 중에도 소환, 3합성, 조합, 판매, 업그레이드가 가능하다.

성장/경제:

- 소환 비용은 20골드다.
- 소환 확률은 일반/희귀/영웅/전설/히든 기준 `58 / 28 / 10 / 4 / 0`이다.
- 10회 연속 일반이 나오면 다음 소환은 희귀 이상 확정이다.
- 16라운드까지 영웅 이상이 없으면 영웅 선택권을 지급하는 보정이 있다.
- 같은 등급 3기를 합성하면 다음 등급 1기가 나온다.
- 같은 계열 3기를 합성하면 같은 계열 결과가 우선된다.
- 전설과 히든은 3합성으로 만들 수 없다.
- 지정 조합 레시피를 통해 상위 유닛과 히든 유닛을 만들 수 있다.
- 잠금 유닛은 조합/판매 재료로 소비되지 않는다.
- 유닛 계열은 `flame`, `frost`, `storm`, `iron`, `void`, `forest` 6종이다.
- 등급은 `common`, `rare`, `hero`, `legend`, `hidden`이다.
- 역할은 `waveClear`, `bossKiller`, `debuff`, `hold`, `finisher`, `economy` 등으로 정의된다.

콘텐츠 데이터:

- `src/data/units.ts`: 유닛 24종. 일반 6, 희귀 6, 영웅 6, 전설 4, 히든 2.
- `src/data/recipes.ts`: 조합식 17종.
- `src/data/missions.ts`: 미션 12종, 일부 히든 미션 포함.
- `src/data/waves.ts`: 1~40라운드 웨이브와 보스 정의.
- `src/data/stages.ts`: 15개 맵, 각 맵은 waypoint와 decoration을 가진다.
- `src/data/relics.ts`: 보스 보상 유물.
- `src/data/upgrades.ts`: 6개 계열 업그레이드.
- `src/data/difficulty.ts`: 5개 난이도 `novice`, `normal`, `intermediate`, `expert`, `master`.

## 3. 현재 핵심 코드 구조

### 3.1 `src/App.tsx`

현재 `App.tsx`는 React 앱의 최상위 구성 요소다.

하는 일:

- `gameRuntime.ts`를 한 번만 동적으로 import해서 게임 런타임을 시작한다.
- `runtimeBridge.ts`의 외부 스토어를 구독한다.
- `scene`이 `title`이면 타이틀 화면을 보여준다.
- `scene`이 `game`이면 게임 화면을 보여준다.
- 전체 화면 이벤트를 처리한다.
  - contextmenu/selectstart/dragstart/drop 방지
  - 전역 keydown을 runtime controls로 전달
  - 최초 pointer/key 입력으로 오디오 unlock
  - window blur 시 자동 일시정지 처리
- 현재 렌더링 구성:
  - 타이틀:
    - `PixiTitleBackground`
    - `PixiTitleScene`
  - 게임:
    - `PixiMenubar`
    - `PixiTopbar`
    - `PixiBoard`
    - `PixiRightPanel`
    - `PixiActionbar`
  - 전역:
    - `PixiToastHost`
    - `PixiModalHost`

현재 문제/한계:

- React가 전체 화면 레이아웃과 스냅샷 구독을 관리한다.
- `publishRuntimeSnapshot`이 자주 호출되면 React 컴포넌트들이 매 프레임 갱신된다.
- 여러 UI 조각이 각각 `@pixi/react`의 `<Application>`을 만들 가능성이 있다. 이 경우 Pixi Application/WebGL context가 여러 개가 되어 리소스 관리가 복잡해질 수 있다.
- Pixi를 쓰고 있지만 “하나의 게임 씬 그래프”라기보다 “React 컴포넌트 내부에 여러 Pixi 캔버스를 끼운 구조”에 가깝다.

### 3.2 `src/gameRuntime.ts`

이 파일은 현재 실제 런타임의 중심이다.

하는 일:

- `Game` 인스턴스를 생성하고 소유한다.
- 현재 scene, pause, active tab, save status, run start/end time 등을 관리한다.
- `BoardUiState`를 관리한다.
  - selectedUids
  - selectBox
  - attackMoveMode
  - autoStartIn
  - showLabels
  - showDamage
- `registerRuntimeControls`로 UI가 호출할 수 있는 명령 API를 등록한다.
- 게임 루프를 `requestAnimationFrame`으로 돌린다.
- 엔진은 고정 timestep `DT = 1 / 20`으로 진행한다.
- 누적 시간 accumulator를 사용해서 `game.advanceTick()`을 여러 번 호출한다.
- 매 프레임 또는 상태 변경 시 `publishRuntimeSnapshot`을 호출한다.
- 선택권/유물 선택권/결과 모달을 자동으로 연다.
- autosave를 예약한다.
- 오디오 효과음을 재생한다.
- 보드 포인터 입력을 처리한다.
  - 우클릭: 적이면 지정 공격, 빈 곳이면 이동
  - 좌클릭: 유닛 선택 또는 박스 선택
  - attackMoveMode일 때 좌클릭: 공격 이동 명령
- 키보드 입력을 처리한다.
  - `Esc`: 공격 이동 취소, 모달 닫기, 일시정지 메뉴
  - `Space`: 라운드 시작 또는 일시정지
  - `A`: 공격 이동 모드
  - `S`: 정지/hold
  - `Z`: 소환
  - `X`: 3합성
  - `Delete/Backspace`: 판매
  - `Q/W/E`: 속도 1/2/3
  - `L`: 잠금 토글
  - `Ctrl + 1~9`: 부대 지정
  - `1~9`: 부대 선택
- 테스트/자동화용 전역 API도 노출한다.
  - `render_game_to_text`
  - `advance_time`
  - 새 게임 시작/행동 dispatch 등

현재 문제/한계:

- `gameRuntime.ts`가 너무 많은 책임을 갖고 있다.
  - 게임 루프
  - 입력
  - 선택 상태
  - 모달 자동 오픈
  - 저장
  - 오디오
  - 스냅샷 발행
  - 테스트 API
- Pixi 렌더링 시스템과 런타임이 명확히 분리되어 있지 않다.
- 보드 입력이 Pixi DisplayObject 이벤트가 아니라 React DOM wrapper에서 좌표 변환으로 처리된다.
- 매 프레임 React 외부 스토어 스냅샷을 발행하는 구조는 Pixi 렌더러의 장점을 충분히 살리지 못한다.

### 3.3 `src/runtimeBridge.ts`

React/Pixi UI와 `gameRuntime.ts` 사이의 브리지다.

핵심 타입:

- `RuntimeSnapshot`
  - revision
  - scene
  - paused
  - saveStatus
  - enemyLimit
  - ownedUnitCount
  - unitCap
  - dpsVisible
  - rightPanelCollapsed
  - activeTab
  - missionProgress
  - state: GameState
  - selectedUids
  - selectBox
  - attackMoveMode
  - showLabels
  - showDamage
- `RuntimeControls`
  - act
  - autosave
  - togglePause
  - clearSelection
  - confirmSell
  - toggleDps
  - advanceWave
  - openUpgrade
  - openManualProofGuide
  - openSelector
  - openRelicChoice
  - setActiveTab
  - menuCommand
  - continueAutosave
  - boardPointerDown/Move/Up/Cancel
  - handleGlobalKeyDown
  - unlockAudio
  - handleWindowBlur

현재 구조:

- `publishRuntimeSnapshot`이 새 snapshot을 만들고 revision을 증가시킨다.
- `subscribeRuntimeSnapshot`으로 React가 구독한다.
- `registerRuntimeControls`로 runtime이 controls를 등록한다.

현재 장점:

- UI가 `Game` 엔진을 직접 조작하지 않고 controls를 통해 접근한다.
- React 외부 스토어라 테스트와 UI 분리가 어느 정도 되어 있다.

현재 문제:

- snapshot에 mutable `GameState` 객체가 그대로 들어간다.
- revision으로 변경을 알려 React를 강제로 갱신한다.
- Pixi renderer가 직접 game state를 효율적으로 읽는 구조가 아니라 React props로 내려받는 구조다.

### 3.4 `src/runtimeContext.ts`

런타임 내부 context 타입을 정의한다.

주요 타입:

- `Scene = "title" | "game"`
- `RightTab = "mission" | "boss" | "log"`
- `BoardUiState`
  - selectedUids
  - selectBox
  - attackMoveMode
  - autoStartIn
  - showLabels
  - showDamage
- `AppCtx`
  - game
  - boardUi
  - audio
  - settings
  - scene
  - paused
  - activeTab
  - saveStatus
  - runStartedAt/runEndedAt
  - refresh
  - newRun
  - adoptGame
  - act
  - autosave
  - advanceWave
  - goTitle
  - continueAutosave

현재 문제:

- context 타입 자체는 괜찮지만 구현이 `gameRuntime.ts` 한 파일에 몰려 있다.
- Pixi scene/controller와 app runtime/controller를 분리하면 더 명확해질 수 있다.

## 4. 순수 게임 엔진 구조

### 4.1 `src/core/types.ts`

게임 상태 타입과 데이터 모델이 정의되어 있다.

핵심 타입:

- `Grade`
- `Family`
- `Role`
- `AttackType`
- `Targeting`
- `SkillDef`
- `SkillEffect`
- `UnitDef`
- `RecipeDef`
- `MissionDef`
- `RelicDef`
- `WaveDef`
- `BossDef`
- `UpgradeDef`
- `DifficultyDef`
- `OwnedUnit`
- `EnemyState`
- `GameState`
- `GameInput`
- `ResultSummary`

중요한 설계:

- `GameInput`은 플레이어 입력 로그다.
- 저장은 스냅샷 전체 저장보다 입력 로그 리플레이에 가깝다.
- `GameState`에는 렌더 전용 상태도 일부 포함되어 있다.
  - `castFx`
  - `damageFx`
- 단, 테스트에서 Pixi 렌더 전용 이펙트 상태는 체크섬에 영향을 주지 않도록 검증한다.

### 4.2 `src/core/engine.ts`

게임 규칙 엔진의 중심이다.

핵심 상수:

- `TICK_RATE = 20`
- `DT = 1 / TICK_RATE`
- 적 기본 속도, 스폰 간격, 감속 cap, 유닛 이동 속도, 탐지 범위 보너스, leash 범위, 라운드 break tick 등이 정의되어 있다.

`Game` 클래스가 하는 일:

- 생성자:
  - seed, difficulty, stageId를 받아 `GameState`를 초기화한다.
  - RNG seed는 `DATA_VERSION:seed:difficulty:stageId` 기반이다.
  - 시작 phase는 `"wave"`이고 `breakTicks`를 둬서 1라운드 시작 전 준비 시간을 만든다.
- `dispatch(type, payload)`:
  - 플레이어 입력을 만들고 `execute`한다.
  - 성공한 입력만 `inputHistory`에 기록한다.
- `executeRecorded(input)`:
  - 리플레이용. 기록된 입력을 다시 실행하지만 history를 중복 기록하지 않는다.
- 주요 action:
  - summon
  - merge3
  - craft
  - sell
  - upgrade
  - toggleLock
  - startWave/nextRound
  - pickSelector
  - pickRelic
  - setSpeed
  - cmdMove
  - cmdAttackMove
  - cmdAttack
  - cmdStop
- 유닛 배치:
  - 기본 슬롯 `SLOTS` 중 빈 곳을 찾는다.
  - `resolvePlacement`로 필드 내부 clamp와 유닛 간 최소 거리 보정을 한다.
- RTS 명령:
  - `cmdMoveLike`
  - `cmdAttack`
  - `cmdStop`
  - `formationTargets`
  - `selectedUnits`
- 라운드 흐름:
  - `skipBreak`
  - `beginRoundSpawning`
  - `completeRound`
  - `endGame`
- 전투 tick:
  - `advanceTick`
  - `moveEnemies`
  - `tickUnits`
  - `fireAt`
  - `applySkill`
  - `applyDamage`
  - `tickDots`
  - `collectDead`
  - `onBossKilled`
- 미션:
  - `missionProgress`
  - `isMissionSatisfied`
  - `checkMissions`
  - `expireMissions`
  - `applyReward`
- 결과:
  - `maxOwnedGrade`
  - `failHint`
  - `resultSummary`
- 리플레이:
  - `replay(seed, difficulty, stageId, inputHistory, stopAtTick?, maxTicks?)`

매우 중요한 제약:

- 엔진은 결정적이어야 한다.
- 같은 `dataVersion + seed + difficulty + stageId + inputHistory`는 같은 결과를 만들어야 한다.
- RNG 호출 순서가 중요하다.
- 렌더링 로직이 엔진 결과에 영향을 주면 안 된다.
- Pixi 이펙트, 애니메이션, 보간, particles, 화면 흔들림은 절대 `stateChecksum`이나 게임 판정에 영향을 주면 안 된다.

### 4.3 `src/core/path.ts`

보드 좌표계와 경로 계산이 있다.

핵심:

- `BOARD_W = 960`
- `BOARD_H = 560`
- `FIELD = { left: 80, top: 70, right: 880, bottom: 490 }`
- `PATH_WIDTH = 34`
- `UNIT_RADIUS = 12`
- `UNIT_MIN_DIST = 26`
- `clampToField(x, y)`
- `posAtDist(dist, stageId)`
- `pathLengthForStage(stageId)`
- `waypointsForStage(stageId)`
- `SLOTS`

Pixi 개선 시 중요:

- 이 고정 보드 좌표계를 Pixi world coordinate로 그대로 유지하는 것이 좋다.
- 화면 크기/해상도 대응은 Pixi viewport scale로 해결하고, 엔진 좌표는 계속 960x560을 유지하는 편이 안전하다.

### 4.4 `src/board/boardHitTest.ts`

현재 보드 입력 hit test 유틸이다.

하는 일:

- DOM client 좌표를 960x560 보드 좌표로 변환한다.
- 유닛 클릭 판정.
- 적 클릭 판정.
- 드래그 박스 안 유닛 목록 계산.

현재 문제:

- Pixi DisplayObject hit area를 사용하지 않고, DOM wrapper에서 직접 좌표 변환한다.
- 향후 Pixi 중심 구조라면 이 로직을 `BoardInputSystem`으로 옮기거나, Pixi EventSystem + custom hitArea를 사용할 수 있다.
- 단, 현재 유틸은 테스트가 있으므로 로직 자체는 보존하면서 내부 사용 위치만 바꾸는 것이 안전하다.

## 5. 현재 Pixi UI 구조 분석

### 5.1 `src/ui/PixiBoard.tsx`

현재 가장 중요한 Pixi 렌더링 컴포넌트다.

주요 역할:

- `@pixi/react`의 `<Application width={BOARD_W} height={BOARD_H}>`를 생성한다.
- 보드 배경, 경로, 장식, 유닛, 적, 이펙트, 보스 HP, 선택 박스, HUD를 렌더링한다.
- Pixi 텍스처를 `Assets.load`로 로드한다.
- 스테이지 ground texture, decoration texture, enemy marker, path marker, unit marker, forest legendary animation frame들을 사용한다.
- 현재 모든 유닛 애니메이션은 forest legendary animation frame을 등급/계열 tint로 재사용하는 방식에 가깝다.
- `drawBackground`, `drawPath`, `drawDecorations`, `drawUnits`, `drawEnemies`, `drawCastFx`, `drawBossBar`, `drawOverlay` 같은 `Graphics` draw callback이 있다.
- 선택된 유닛의 detail HUD, recipe suggestion HUD, DPS HUD도 같은 Pixi board canvas 위에 그린다.
- Recipe HUD 안의 icon은 Pixi eventMode static으로 hover/tap을 처리한다.
- 보드 자체 입력은 `div.pixi-board-input-surface`의 React pointer event를 받아서 `getRuntimeControls()?.boardPointerDown/Move/Up`으로 넘긴다.

현재 장점:

- 보드 시각화 대부분이 Pixi로 옮겨져 있다.
- stage waypoint/path/decoration data를 직접 Pixi 렌더링에 활용한다.
- `castFx`, `damageFx`, selected range, boss bar, DPS HUD 등 게임다운 요소가 캔버스에 있다.

현재 한계:

- React props 변경에 따라 Pixi React reconciliation이 자주 발생한다.
- `revision` 의존성으로 Graphics를 다시 clear/draw한다.
- 다수의 Pixi Text/Graphics가 React render cycle에 묶여 있다.
- 유닛/적/데미지 텍스트의 DisplayObject pooling이 없다.
- projectiles/beams/trails/particles 같은 게임 연출 시스템이 구조화되어 있지 않다.
- static stage background를 RenderTexture로 캐싱하지 않는다.
- Pixi Application이 board에만 있고 topbar/actionbar/right panel/modal도 각각 별도 Application일 수 있다면, 전체 게임 UI가 하나의 Pixi scene으로 통합되어 있지 않다.

### 5.2 `src/ui/PixiTopbar.tsx`, `PixiActionbar.tsx`, `PixiRightPanel.tsx`, `PixiMenubar.tsx`

현재 상단 HUD, 하단 액션바, 우측 패널, 메뉴바도 Pixi 컴포넌트로 전환되어 있다.

특징:

- 각 컴포넌트는 runtime snapshot을 props로 받는다.
- 버튼/필/스탯/탭 등을 Pixi Graphics/Text로 그린다.
- `getRuntimeControls()`로 action을 호출한다.
- ResizeObserver로 DOM surface 크기를 측정하고 Pixi Application 크기를 맞춘다.

현재 한계:

- 각 UI 컴포넌트가 독립 Pixi Application을 만들면 context/texture/event 관리가 비효율적이다.
- HUD와 보드가 별도 Pixi stage면 z-index, modal, global transition, shared assets, postprocessing, input routing이 복잡해진다.
- 게임 UI 전체를 하나의 `GamePixiApp`으로 묶고 내부에 `BoardLayer`, `HudLayer`, `ModalLayer`, `ToastLayer`를 두는 방식이 더 Pixi스럽다.

### 5.3 `src/ui/PixiModalHost.tsx`, `src/ui/reactOverlayBridge.ts`, `src/ui/PixiSimpleModals.tsx`

오버레이 구조:

- 기존 이름은 `reactOverlayBridge`지만 실제 렌더링은 `PixiModalHost`가 담당한다.
- overlay store는 `openReactOverlay`, `closeReactOverlay`, `closeTopReactOverlay`, `clearReactOverlays`, `subscribeReactOverlays`로 동작한다.
- overlay kind:
  - pause
  - options
  - collection
  - newRun
  - selector
  - relicChoice
  - save
  - load
  - upgrade
  - help
  - about
  - confirm
  - simulation
  - balanceGate
  - manualProof
  - result
- `PixiModalHost`는 overlay kind에 따라 Pixi modal 컴포넌트를 렌더링한다.

현재 장점:

- 모달도 이미 Pixi 기반으로 대부분 이동했다.
- overlay store가 분리되어 있다.

현재 한계:

- 이름과 책임이 아직 React 중심 흔적을 가진다.
- 복잡한 save/load/result/manualProof 같은 모달은 텍스트와 스크롤, 긴 명령어, 복사 버튼 등 DOM이 더 적합할 수 있다.
- 완전 Pixi UI로 갈지, 게임 캔버스는 Pixi/복잡한 폼 모달은 React DOM으로 유지할지 전략 결정이 필요하다.

## 6. 저장, 리플레이, 테스트 구조

### 6.1 저장

`src/save/saveApi.ts`:

- Tauri 환경에서는 Rust command를 통해 SQLite에 저장한다.
- 브라우저 환경에서는 localStorage fallback을 사용한다.
- 저장 record에는 다음이 들어간다.
  - schemaVersion
  - appVersion
  - dataVersion
  - savedAt
  - seed
  - difficulty
  - stageId
  - stateChecksum
  - tick
  - round
  - life
  - maxGrade
  - inputHistory
- load 시에는 저장된 inputHistory를 `replay`로 복원하고 checksum을 검증한다.

Tauri command:

- `save_run_snapshot`
- `load_run_snapshot`
- `list_save_slots`
- `delete_save_slot`
- `record_run_result`
- `list_run_results`
- `write_run_report`
- `open_app_data_dir`

중요:

- Pixi 구조 변경 시에도 저장/로드는 inputHistory replay 기반을 유지해야 한다.
- renderer state나 Pixi object state를 저장하면 안 된다.

### 6.2 테스트

현재 테스트:

- `src/core/engine.test.ts`
  - RNG 결정성
  - 데이터 무결성
  - 소환/보정
  - 조합/합성
  - 전투/리플레이 재현성
  - Pixi 렌더 전용 이펙트가 checksum에 영향 없는지
  - 보스 유물 선택 리플레이
  - 전투 중 action 가능 여부
- `src/board/boardHitTest.test.ts`
  - screenToBoard
  - unitAtBoardPoint
  - enemyAtBoardPoint
  - unitsInBoardBox
- `src/ui/reactOverlayBridge.test.ts`
  - overlay store close/clear 동작
- scripts:
  - `yarn sim`
  - `yarn balance`
  - `yarn browser-balance`
  - `yarn browser-direct`
  - `yarn balance-proof`
  - `yarn manual-playlog`
  - `yarn balance-audit`

Pixi 구조 변경 시 반드시 유지해야 할 검증:

- `yarn build`
- core/board/ui store 관련 Vitest
- Playwright smoke:
  - 타이틀 표시
  - 새 게임 시작
  - 보드 canvas 표시
  - 유닛 선택/박스 선택
  - 우클릭 이동/공격 이동
  - 소환/합성/판매/업그레이드
  - selector/relic/result/pause/options/save/load 등 overlay 표시
  - Pixi canvas가 blank가 아닌지 screenshot/pixel check
- 저장/로드 replay checksum 검증

## 7. 현재 구조의 핵심 문제를 내 관점에서 정리

1. Pixi를 쓰고 있지만 아직 “Pixi 게임 앱”이 아니라 “React 앱 안에 Pixi 컴포넌트를 여러 개 넣은 구조”다.

2. `gameRuntime.ts`가 지나치게 많은 책임을 가진다.

3. 매 프레임 runtime snapshot 발행과 React reconciliation이 Pixi의 장점과 충돌한다.

4. 보드 렌더링은 Pixi지만 객체 풀링/레이어 시스템/렌더 텍스처 캐싱/이펙트 시스템이 아직 부족하다.

5. 입력 처리가 DOM pointer event 중심이라 Pixi scene graph와 통합되어 있지 않다.

6. UI 모달과 HUD를 어디까지 Pixi로 할지 명확한 전략이 필요하다.

7. 엔진은 결정성이 중요해서 Pixi 개선이 절대 core 판정에 영향을 주면 안 된다.

## 8. 내가 원하는 Pixi 개선 방향

아래 방향이 타당한지 검토하고, 더 나은 구조가 있다면 제안해 달라.

### 방향 A: 보수적 개선

- React shell은 유지한다.
- `PixiBoard`를 class 기반 또는 hook 기반 Pixi scene manager로 재구성한다.
- `@pixi/react`로 매 프레임 tree를 다시 만드는 대신, DisplayObject를 유지하고 state diff만 반영한다.
- 유닛/적/데미지 텍스트/이펙트는 object pool을 사용한다.
- static stage background/path/decorations는 RenderTexture로 캐시한다.
- HUD 일부는 계속 React/Pixi 컴포넌트로 유지한다.

### 방향 B: 균형형 개선

- React는 앱 root, Tauri/DOM integration, 복잡한 폼 모달 정도만 맡긴다.
- 게임 화면은 하나의 Pixi Application으로 통합한다.
- 하나의 Pixi stage 아래에 다음 레이어를 둔다.
  - TitleScene
  - GameScene
  - BoardLayer
  - StaticStageLayer
  - PathLayer
  - DecorationLayer
  - EnemyLayer
  - UnitLayer
  - ProjectileLayer
  - EffectLayer
  - SelectionLayer
  - HudLayer
  - ModalLayer 또는 DomModalBridge
  - ToastLayer
  - DebugLayer
- `gameRuntime.ts`는 `RuntimeApp`, `GameLoop`, `InputController`, `AudioController`, `SaveController`, `OverlayController`, `SnapshotStore`로 분리한다.
- Pixi scene은 runtime을 구독하거나 runtime에서 직접 `renderer.render(state, uiState, alpha)`를 호출한다.
- React snapshot 발행은 topbar/side panel 같은 DOM UI가 필요한 경우만 throttle한다.

### 방향 C: 공격적 개선

- React 의존을 최소화하고 거의 모든 UI를 Pixi Application 내부로 옮긴다.
- 자체 Pixi UI toolkit을 만든다.
  - Button
  - Toggle
  - Slider
  - Tabs
  - ScrollPanel
  - Modal
  - Tooltip
  - List
  - TextInput은 필요 시 DOM overlay 사용
- 모든 scene 전환과 modal/toast도 Pixi stage에서 처리한다.
- 단, 복잡한 텍스트 입력/복사/파일 저장 UI는 DOM과 섞을지 신중히 판단한다.

내가 선호하는 방향은 B다. 즉, 게임 화면은 단일 Pixi Application으로 통합하되, React를 완전히 제거하지는 않고 shell/복잡한 플랫폼 UI에 제한적으로 남기는 방식이다.

## 9. Pixi 기반 목표 아키텍처 제안 요청

다음 형태의 아키텍처를 제안해 달라.

### 9.1 모듈 분리

예시로 이런 파일 구조가 가능한지 검토해 달라.

```text
src/
  core/
    engine.ts
    types.ts
    path.ts
    checksum.ts
    advisor.ts
  data/
    units.ts
    recipes.ts
    missions.ts
    waves.ts
    stages.ts
    relics.ts
    upgrades.ts
    difficulty.ts
  runtime/
    RuntimeApp.ts
    GameLoop.ts
    RuntimeStore.ts
    InputController.ts
    SelectionController.ts
    OverlayController.ts
    SaveController.ts
    AudioController.ts
    TestHarness.ts
  pixi/
    PixiGameApp.ts
    assets/
      AssetManifest.ts
      TextureRegistry.ts
      AnimationRegistry.ts
    scenes/
      TitleScene.ts
      GameScene.ts
    layers/
      StaticStageLayer.ts
      PathLayer.ts
      DecorationLayer.ts
      EnemyLayer.ts
      UnitLayer.ts
      ProjectileLayer.ts
      EffectLayer.ts
      SelectionLayer.ts
      HudLayer.ts
      ModalLayer.ts
      ToastLayer.ts
      DebugLayer.ts
    ui/
      PixiButton.ts
      PixiPanel.ts
      PixiTextButton.ts
      PixiIconButton.ts
      PixiTabs.ts
      PixiScrollPanel.ts
      PixiTooltip.ts
    systems/
      EnemyViewSystem.ts
      UnitViewSystem.ts
      DamageTextSystem.ts
      CastFxSystem.ts
      SelectionRenderSystem.ts
      BoardInputSystem.ts
      CameraSystem.ts
      ResizeSystem.ts
  ui/
    ReactShell.tsx
    DomModalBridge.tsx
    maybe complex DOM-only modals
```

이 구조가 과한지, 또는 현재 프로젝트 규모에 더 적합한 축소 버전이 무엇인지 판단해 달라.

### 9.2 게임 루프 구조

현재는 `requestAnimationFrame` 안에서 accumulator로 `game.advanceTick()`을 호출한다. Pixi 기반으로 바꿀 때 다음 중 어떤 방식이 좋은지 제안해 달라.

1. 기존 rAF loop 유지 + Pixi renderer update 호출.
2. Pixi `app.ticker`를 loop host로 사용하되 core fixed timestep은 유지.
3. runtime loop와 Pixi ticker를 분리하고, renderer는 interpolation alpha만 받는다.

중요 조건:

- core tick은 계속 20Hz 고정이어야 한다.
- `game.state.speed` 1/2/3 배속은 engine tick 누적량에만 영향을 줘야 한다.
- 렌더러 animation time은 시각 효과용으로 별도 관리 가능하지만 게임 판정에 영향을 주면 안 된다.
- pause 시 engine tick은 멈추고, UI hover/모달 애니메이션은 계속 돌 수 있어야 한다.

### 9.3 상태 전달 구조

현재는 `publishRuntimeSnapshot`으로 React에 상태를 발행한다. 개선안을 제안해 달라.

내가 생각하는 요구사항:

- Pixi scene은 매 프레임 React props를 통해 전체 `GameState`를 받지 않았으면 좋겠다.
- renderer는 runtime이 소유한 `Game`과 `BoardUiState`를 읽되, 읽기 전용으로만 사용해야 한다.
- 엔진 mutation은 오직 `Game.dispatch()`와 `Game.advanceTick()`에서만 일어나야 한다.
- UI/HUD가 필요한 파생값은 selector 함수로 계산한다.
- React/DOM UI가 필요한 snapshot은 throttle하거나 dirty flag 기반으로만 발행한다.

가능한 구조:

- `RuntimeStore`
  - engine state reference
  - ui state
  - derived selectors
  - subscribe for coarse UI changes
- `PixiGameApp`
  - `update(dt, alpha)`에서 직접 runtime state를 읽고 layer systems를 update
- `ReactShell`
  - scene mount/unmount와 DOM-only modal bridge만 관리

### 9.4 Pixi 레이어와 렌더링 최적화

현재 `PixiBoard.tsx`는 Graphics draw callback을 많이 사용한다. 개선 방향을 제안해 달라.

원하는 개선:

- static layer:
  - stage background
  - ground texture
  - path
  - decoration shadows
  - decoration sprites
  - stage가 바뀔 때만 다시 생성
  - 가능하면 RenderTexture로 캐싱
- dynamic layer:
  - enemies
  - units
  - selection indicators
  - attack ranges
  - boss bar
  - damage text
  - cast effects
  - projectiles/trails
- object pooling:
  - enemy sprites
  - unit sprites
  - hp bars
  - damage texts
  - cast circles/particles
- texture atlas:
  - 현재 이미지 파일이 많은데, Pixi Asset manifest/atlas로 정리하는 방법 제안
- animation:
  - 현재는 일부 forest animation frame을 모든 유닛에 tint해서 쓰는 수준이다.
  - 유닛별/계열별 animation registry를 만들고, fallback sprite/tint 전략을 제안해 달라.
- effects:
  - attack impact
  - chain lightning
  - slow/stun/armor break/amp marker
  - boss warning
  - round start
  - summon/merge/craft animation
  - screen shake
  - particles
  - 단, 모두 render-only여야 한다.

### 9.5 입력 구조

현재 입력은 `gameRuntime.ts`에서 DOM pointer event를 받아 처리한다. Pixi 기반 구조에서는 다음을 제안해 달라.

- `BoardInputSystem`을 만들어 Pixi container에 eventMode/hitArea를 설정한다.
- world coordinate 변환은 Pixi container transform 기준으로 처리한다.
- 기존 `screenToBoard`, `unitAtBoardPoint`, `enemyAtBoardPoint`, `unitsInBoardBox` 테스트는 유지하거나 Pixi input system 테스트로 대체한다.
- pointer input과 keyboard input을 `InputController`로 분리한다.
- selection state는 `SelectionController`로 분리한다.
- command issuing은 `RuntimeApp.act()` 또는 `CommandBus`를 통해 한다.

반드시 유지할 UX:

- 좌클릭 유닛 선택
- 빈 곳 좌클릭 선택 해제
- Ctrl/Meta + 유닛 클릭: 같은 defId 유닛 전체 선택
- 드래그 박스 선택
- 우클릭 이동
- 우클릭 적 지정 공격
- A 후 좌클릭 공격 이동
- S 정지/hold
- Ctrl+1~9 부대 저장
- 1~9 부대 선택
- Esc 취소/모달/일시정지
- Space 라운드 시작/일시정지

### 9.6 UI 전략

이 프로젝트는 게임 UI가 꽤 많다.

현재 Pixi화된 UI:

- title
- menubar
- topbar
- actionbar
- right panel
- toast
- modal host
- pause/options/new run/selector/relic/save/load/upgrade/help/about/confirm/simulation/balance/manualProof/result/collection 등

질문:

- 전부 단일 Pixi Application 안으로 넣는 것이 좋은가?
- 아니면 보드/전투/HUD는 Pixi, 복잡한 긴 텍스트/명령어/저장 리스트/복사 UI는 DOM React로 남기는 것이 좋은가?
- Tauri 데스크톱 게임에서 접근성/IME/텍스트 복사/스크롤/긴 리포트 UI를 고려하면 어떤 절충이 좋은가?

내 선호:

- 핵심 게임 화면, HUD, 액션바, 우측 패널, 짧은 모달은 Pixi.
- save/load/result/manualProof처럼 긴 텍스트와 복사 버튼이 많은 모달은 DOM 유지도 가능.
- 단, 시각 스타일은 Pixi game UI와 일관되게 맞추고 싶다.

### 9.7 코드 변경 우선순위

아래 순서로 리팩터링하는 것이 맞는지 평가하고, 더 좋은 순서를 제안해 달라.

1. `gameRuntime.ts` 책임 분리
   - `RuntimeApp`
   - `GameLoop`
   - `InputController`
   - `SelectionController`
   - `OverlayController`
   - `SaveController`
   - `AudioController`
2. `PixiBoard.tsx`에서 렌더링 로직을 `pixi/layers`와 `pixi/systems`로 분리
3. 단일 Pixi Application 도입
4. 기존 `PixiTopbar`, `PixiActionbar`, `PixiRightPanel`을 단일 Pixi HUD layer로 통합
5. texture/asset registry 정리
6. object pooling 도입
7. render-only visual effect event queue 도입
8. DOM/React snapshot 발행 빈도 줄이기
9. Playwright screenshot/pixel smoke 강화
10. 기존 UI 컴포넌트 삭제 또는 compatibility wrapper 정리

## 10. 반드시 지켜야 하는 제약

- `src/core` 엔진에는 Pixi import를 넣지 말 것.
- 게임 판정, RNG, 입력 로그, replay, checksum 결정성을 깨지 말 것.
- `GameState`에 렌더러 전용 mutable Pixi 객체를 넣지 말 것.
- 저장 데이터에 Pixi view state를 넣지 말 것.
- UI 리팩터링으로 `Game.dispatch()` action contract를 깨지 말 것.
- `GameInput` 타입을 바꿔야 한다면 migration 계획과 테스트를 제시할 것.
- `BOARD_W = 960`, `BOARD_H = 560` world coordinate는 유지하는 방향이 우선이다.
- 스테이지 path/waypoint 기반 적 이동 구조는 유지한다.
- 기존 플레이 조작 UX는 유지한다.
- Tauri와 브라우저 dev 환경 모두 동작해야 한다.
- build/test/playwright smoke로 검증 가능한 방식이어야 한다.

## 11. 내가 GPT Pro에게 원하는 산출물

다음 항목을 모두 포함해서 답변해 달라.

1. 현재 구조에 대한 아키텍처 진단
   - 좋은 점
   - 위험한 점
   - Pixi를 제대로 활용하지 못하는 부분

2. 추천 목표 구조
   - 보수적/균형형/공격적 옵션 비교
   - 내 프로젝트에는 어떤 옵션이 가장 적합한지
   - 왜 그런지

3. 구체적인 파일/모듈 설계
   - 새로 만들 파일
   - 기존 파일에서 옮길 책임
   - 삭제하거나 compatibility wrapper로 남길 파일

4. 게임 루프 설계
   - fixed timestep 유지 방식
   - Pixi ticker/rAF 선택
   - pause/speed/interpolation 처리

5. 렌더링 레이어 설계
   - 각 레이어의 책임
   - static/dynamic 분리
   - RenderTexture 캐싱
   - object pooling
   - texture/animation registry

6. 입력 시스템 설계
   - pointer/keyboard/selection/command 분리
   - 기존 UX 유지 방법
   - 테스트 가능한 구조

7. UI 전략
   - 단일 Pixi Application으로 통합할 범위
   - DOM/React로 남기는 것이 좋은 범위
   - modal/toast/right panel 처리 방식

8. 단계별 마이그레이션 계획
   - PR 또는 commit 단위로 5~10단계
   - 각 단계의 검증 방법
   - 롤백 가능한 경계

9. 성능 목표
   - React re-render 감소
   - WebGL context 수 감소
   - DisplayObject pooling 기준
   - 60fps 유지 기준
   - 적/유닛/텍스트 수가 늘 때 병목 예측

10. 테스트 계획
    - Vitest
    - Playwright
    - screenshot/pixel validation
    - replay checksum
    - save/load
    - overlay smoke

11. 가능하면 코드 스켈레톤
    - `RuntimeApp`
    - `GameLoop`
    - `PixiGameApp`
    - `GameScene`
    - `UnitLayer`
    - `EnemyLayer`
    - `BoardInputSystem`
    - `ObjectPool`
    - `TextureRegistry`

## 12. 추가로 고려했으면 하는 개선 아이디어

- 전투 연출:
  - projectile/beams
  - impact flash
  - damage number pooling
  - chain lightning visualization
  - slow/stun/debuff visual marker
  - boss warning animation
  - wave start banner
  - summon/merge/craft animation
- 카메라/스케일:
  - 960x560 world를 유지하면서 responsive fit
  - devicePixelRatio 대응
  - Tauri window resize 대응
  - letterbox/pillarbox 처리
- 애셋:
  - 현재 개별 png/svg import가 많은데 manifest/atlas 관리
  - lazy loading
  - loading scene
  - fallback texture
- UI:
  - Pixi tooltip
  - Pixi scroll panel
  - keyboard focus
  - modal stack
  - command palette 또는 shortcut overlay
- 디버그:
  - FPS
  - tick time
  - display object count
  - texture count
  - current enemy/unit count
  - hit area overlay
  - path debug
- 개발 생산성:
  - 렌더 시스템별 단위 테스트 가능성
  - visual regression screenshot
  - deterministic replay + screenshot capture

## 13. 답변 형식

답변은 한국어로 해 달라.

가능하면 아래 형식으로 답해 달라.

1. 결론: 이 프로젝트에는 어떤 Pixi 구조가 맞는가
2. 현재 구조 진단
3. 목표 아키텍처
4. 새 파일 구조 제안
5. 게임 루프/상태 전달 설계
6. Pixi 레이어 설계
7. 입력 시스템 설계
8. UI/모달 전략
9. 단계별 리팩터링 계획
10. 테스트/검증 계획
11. 코드 스켈레톤
12. 리스크와 주의사항

특히 “엔진 결정성은 유지하면서 렌더링만 Pixi답게 바꾸는 방법”을 가장 중요하게 다뤄 달라.
```
