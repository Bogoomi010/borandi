# 동적 템플릿(빈 템플릿) 프로젝트 적용 계획

빈 템플릿은 **프레임/배경/아이콘만** 있고, 수치·텍스트는 게임이 런타임(DOM/캔버스)으로 그린다.
따라서 "프레임을 깔고 그 위에 기존 동적 콘텐츠를 얹는" 방식으로 적용한다. 텍스트 충돌 없음.

기술은 대상이 **DOM이냐 캔버스냐**로 갈린다:
- **DOM** → `applyNineSlice`(프레임 테두리) / `applySprite`(배경) + 기존 DOM 자식이 위에 렌더.
- **캔버스(`board.ts`)** → `drawNineSlice`(이미 구현됨) + 채움 사각형 + 텍스트를 직접 그림.

---

## 0. 선행 정리 (적용 전 확정할 것)

- **현재 미사용 템플릿** — 좌측 보유유닛 패널을 제거했으므로 다음은 적용 대상이 없음:
  `units/card-*`, `units/capacity-bar`, `units/count-badge`, `units/tag-chip`,
  `units/filter-tabs`, `units/list-panel`, `units/btn-equip-small`, `units/element-icons`(필터용).
  → 유닛 패널을 어딘가 재도입할지 결정 후 적용. (도감은 별도 `dex-card`라 미해당)
- **아직 텍스트 변형이 남은 프레임** — `frames/right-side-panel`, `frames/right-tabs`, `frames/log-entry`.
  빈 템플릿이 없어 우측 패널/탭/로그 적용은 보류(블랭크 생성 후).
- **바(bar) 내부 영역(inset) 값 필요** — 9-슬라이스 채움을 위해 각 바 이미지의 "채움이 들어갈
  내부 사각형"의 상/우/하/좌 여백 px를 한 번 측정해 매니페스트 `border`에 기록.

---

## 1단계 — 상단바 컨트롤 (DOM, 저위험·체감 큼)

`panels.ts :: renderTopbar`

- **속도 버튼** `topbar.speed.x1/x2/x3` + `*-selected` (이제 상태 세트 완비)
  → 각 버튼 배경 이미지를 상태(현재 `s.speed`)에 따라 일반/선택으로 교체, 텍스트 숨김.
- **일시정지/재개** `topbar.btn-pause` / `topbar.btn-play`
  → `ctx.paused`에 따라 두 이미지 토글.
- **헤더 아이콘** `topbar.header-icon-map/round/enemy/gold/difficulty/next-boss`
  → 각 `.stat` 라벨 자리에 해당 아이콘(개별 PNG)을 넣고, 값은 DOM 텍스트 유지.
- (선택) **상태바 배경** `topbar.status-bar` → `#topbar` 배경. 이전엔 합성본이라 어색했으나
  빈 바면 OK. 9-슬라이스로 끝장식만.

## 2단계 — 선택 유닛 상세 (DOM, 저위험)

`panels.ts :: renderUnitDetail`

- `unit-detail.panel` → `#unit-detail` 패널 배경(9-슬라이스 테두리).
- `unit-detail.attack-power` → 공격력 수치 플레이트 배경(값은 DOM).
- `unit-detail.stat-item` → 각 `.ud-stat` 셀 배경(아이콘·라벨·값은 DOM).
- `unit-detail.grade-frame` → 등급 엠블럼(별 개수는 코드로 그림 — 프레임만).
- `unit-detail.tag-badges` → `.ud-chip` 칩 배경.
- `unit-detail.effect-value-badge` → 효과 지속시간 배지 배경.
- (이미 적용됨: `stat-grid`, `attack-type`, `portrait-frame`, 슬롯)

## 3단계 — 우측 패널: 미션 / 보스 (DOM, 저위험)

`panels.ts :: MissionTab / BossTab`

- 미션: `mission.card-active` / `card-completed` → `.mission-item` 배경(상태 클래스로 분기).
  `round-limit-badge` → `.badge`, `progress-plate` → `.prog`, `reward-plate` → `.rew`.
- 보스: `boss.info-panel` / `card` / `reward-preview` → `.boss-info` 영역 배경.
- (선행: 우측 패널 컨테이너/탭 프레임은 0단계 블랭크 생성 후)

## 4단계 — 팝업/모달 (DOM, 저위험)

- `popups.confirm` → `widgets.ts :: confirmModal` 프레임.
- `popups.reward` → `modals.ts :: openSelectorModal`, `maybeShowResult`.
- `popups.settings` → `scenes.ts :: openOptionsOverlay`.
- `popups.tooltip` → 공용 툴팁. **현재 툴팁은 `title` 속성만 사용** → 이미지 말풍선을 쓰려면
  hover 툴팁 위젯을 신설해야 함(중간 작업).
- `popups.boss-warning` / `boss-warning-banner` → 보스 경고(현재 toast/캔버스). 문구는 i18n.

## 5단계 — DPS 미터 (DOM)

`dpsMeter.ts :: renderDpsMeter`

- `meters.damage-panel` → `#dps-meter` 패널 배경.
- `meters.damage-row` → 각 행 배경.
- `meters.damage-bar-green/blue/orange` → 기여도 순위별 채움(이미 색바 존재 — 프레임만 교체).

## 6단계 — 진행 바 / 액션바 배경 (DOM)

- `meters.progress-bar` → 라운드 진행 표시(현재 액션바 `#phase-label` 부근/topbar).
- `buttons.actionbar` → `#actionbar` 배경(빈 바면 9-슬라이스로 OK).
- `buttons.generic/tab/primary/secondary/label-*` → 메뉴·모달 버튼. 빈 프레임 위에 i18n 텍스트.

## 7단계 — 캔버스 바·전장 (board.ts, 중위험·작업량 큼)

`board.ts :: BoardRenderer.draw` — `fillRect`를 `drawNineSlice` + 채움으로 교체.

- **적 체력바** (519~526행): `meters.hp-gauge` 프레임 + 비율 채움.
- **보스 체력바** (593~605행): `meters.boss-hp-bar` 프레임(좌측 해골) + 비율 채움 + 수치 텍스트.
- `meters.dark-energy-bar` → 보스 특수 자원(있으면).
- `slots.cooldown-overlay` → 스킬 쿨다운 스윕(숫자는 코드).
- (전장 프레임/길/마커: `battlefield/*` — 캔버스 통합, 별도 단계)

각 바: `drawNineSlice(ctx, img, x,y,w,h, border)`로 프레임을 그린 뒤,
내부 사각형(= 0단계 inset)에 `ratio` 비율로 채움색 사각형, 그 위에 텍스트.

---

## 적용 순서 & 위험도 요약

| 단계 | 영역 | 기술 | 위험 | 비고 |
|---|---|---|---|---|
| 1 | 상단바 컨트롤 | DOM 이미지버튼 | 낮음 | 상태 세트 완비 |
| 2 | 유닛 상세 | DOM 프레임 | 낮음 | 일부 적용 완료 |
| 3 | 미션/보스 | DOM 프레임 | 낮음 | 우측 컨테이너는 블랭크 대기 |
| 4 | 팝업 | DOM 프레임 | 낮음(툴팁만 중간) | |
| 5 | DPS 미터 | DOM | 낮음 | |
| 6 | 진행바/액션바/버튼 | DOM | 낮음 | |
| 7 | 캔버스 바·전장 | canvas drawImage | 중간 | inset 측정 필요 |

## 공통 헬퍼 보강 (적용 전 1회)

- `uiSkin.ts`에 **상태형 이미지 버튼** 헬퍼 추가(예: `skinStateButton(elem, onKey, offKey, isOn)`).
- 각 바 이미지의 **inset(border)** 값을 매니페스트 `border` 필드에 측정·기록.
- 캔버스 바용 `loadUiImage` + `drawNineSlice`는 이미 존재 → 보스/적 바부터 시범 적용.

## 검증

- 단계별로 타입체크(`tsc`) + 로컬 `yarn dev` 스크린샷으로 시각 확인(샌드박스에선 미리보기 불가).
- 각 단계는 독립적·되돌리기 쉬움(헬퍼 호출 한두 줄). 단계 완료마다 보고.
