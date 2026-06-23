# UI 에셋 카탈로그 & 적용 계획

게임용으로 제작한 UI 오버뷰 시트 **8장**의 모든 컴포넌트를 정리하고,
각 에셋을 게임 코드(`src/ui/`)의 어느 화면·렌더 함수에 적용할지 매핑한 문서다.

- **코드용 매니페스트**: [`src/ui/uiAssets.ts`](../src/ui/uiAssets.ts) — `getUiAsset(key)` / `uiAssetsByCategory()` / `uiAssetsBySheet()`로 조회
- **원본 시트**: `src/assets/ui/*.png` (오버뷰 시트 PNG 포함)
- **상태**: 개별 프로젝트용 PNG 129개 생성 완료. 아래 폴더 구조에 배치되어 있고 매니페스트는 `sliced: true`로 활성화됨.

---

## 1. 폴더 구조 (`src/assets/ui/`)

카테고리별로 분리해 import 경로와 책임을 명확히 한다. 디렉터리는 이미 생성해 두었다.

```
src/assets/ui/
├─ frames/        # 패널, 9-슬라이스, 코너, 디바이더, 배지 베이스, 우측 패널, 로그 엔트리
├─ buttons/       # 액션바·탭·범용·CTA 버튼, 라운드 시작, 라벨
├─ topbar/        # 상단 상태바, 정보 배지 6종, 속도 버튼, 일시정지, 헤더 아이콘
├─ units/         # 보유 유닛 카드, 필터, 속성/등급 아이콘, 용량 바
├─ unit-detail/   # 선택 유닛 상세 패널 부품
├─ mission/       # 미션 카드, 배너, 진행/보상 플레이트
├─ boss/          # 보스 정보/카드/보상 미리보기
├─ battlefield/   # 전장 프레임, 길 테두리, 적/유닛 마커, 웨이브 노드
├─ meters/        # 데미지미터, HP/MP/보스 바, 진행 바
├─ slots/         # 스킬/아이템/장비/유물/효과/빈/잠금 슬롯
├─ popups/        # 확인/보상/설정/툴팁/보스 경고
├─ controls/      # 체크박스, 토글, 커서
└─ fx/            # 글로우 등 이펙트
```

## 2. 네이밍 규칙

- **파일명**: `kebab-case`, 카테고리 폴더 안에서 의미만 (`action-summon.png`, `card-legendary.png`).
- **상태 변형**은 접미사로 구분: `-normal` / `-hover` / `-pressed` / `-selected` / `-disabled`.
- **코드 키**(매니페스트): 점 네임스페이스 `카테고리.컴포넌트[.변형]` (`actionbar.btn.summon`, `units.card.legendary`).
- **9-슬라이스 대상**(가변 크기로 늘려 쓰는 프레임/바)은 매니페스트 `nineSlice: true`로 표시.

---

## 3. 시트별 컴포넌트 → 적용 위치

표기: **컴포넌트** → 코드 키 → `적용 모듈 :: 렌더 함수` (용도)

### 시트 D — 공용 레이아웃 / 프레임·버튼 키트 (가장 먼저 적용)

거의 모든 패널·버튼이 여기서 파생되므로 **1순위로 교체**한다.

- Fantasy Main / Small Panel → `frame.panel.main` / `frame.panel.small` → `widgets.ts :: openModal`, `panels.ts :: renderRightPanel`
- Main / Small Nine-Slice Panel → `frame.nineslice.*` → `widgets.ts :: el()` 공용 가변 패널 베이스
- Button Normal / Hover / Pressed → `btn.generic.*` → `scenes.ts :: TitleMenu / PauseMenu / OptionsOverlay`
- Tab Button Normal / Selected → `btn.tab.*` → `panels.ts :: renderRightPanel` 탭
- Fantasy Badge / Divider / Frame Corner → `frame.badge` / `frame.divider` / `frame.corner` → 엠블럼·구분선·9슬라이스 코너
- Fantasy Glow Effect → `fx.glow.set` → `board.ts` 유닛 선택/스킬, `panels.ts` 버튼 강조

### 시트 E — 상단 상태바 → `panels.ts :: renderTopbar`

- Top Status Bar → `topbar.bar` (배경 9-슬라이스)
- Map / Round / Enemy Count / Gold / Difficulty / Next Boss Badge → `topbar.badge.*` (각 정보 칸)
- Speed Control Group + x1 / x2 / x3 Selected → `topbar.speed.*` (배속 토글)
- Pause Button → `topbar.btn.pause` (+ `scenes.ts :: openPauseMenu`)
- Save Status Indicator → `topbar.save-indicator` (자동저장 상태)
- Tiny Status Divider → `topbar.divider.tiny`
- Header Icon Set → `topbar.icons.header-set` (배지 아이콘 6종)

### 시트 C — 하단 액션바 → `panels.ts :: renderActionbar`

- Bottom Action Bar → `actionbar.bar` (배경, 슬롯 8칸 + 라운드)
- Summon / Merge / Sell / Upgrade / Relic → `actionbar.btn.*` (핵심 조작; Upgrade→`UpgradeModal`, Relic→`modals.ts :: openRelicChoiceModal`)
- DPS Toggle → `actionbar.btn.dps-toggle` → `dpsMeter.ts :: toggleDps`
- Round Start Normal / Hover → `actionbar.btn.round-start.*` (웨이브 시작)
- Shortcut / Cost Label → `actionbar.label.*` (단축키·비용 칩)
- Action Button Disabled → `actionbar.btn.disabled` (자원 부족 상태)
- Primary / Secondary Action Button → `btn.primary` / `btn.secondary` → `scenes.ts :: TitleMenu`, `modals.ts` CTA

### 시트 B — 전장 / 데미지미터 → `board.ts :: BoardRenderer`, `dpsMeter.ts`

- Battlefield Panel Frame → `battlefield.frame` (전장 외곽)
- Battleroad Border → `battlefield.road-border` (경로 타일)
- Enemy Path Marker → `battlefield.enemy-path-marker` (진행 화살표)
- Enemy Marker Normal / Elite → `battlefield.enemy-marker.*`
- Unit Placement Node → `battlefield.placement-node` (배치 가능 위치)
- Placed / Selected Unit Marker → `battlefield.placed-unit-marker` / `battlefield.selected-unit-marker`
- Damage Meter Panel / Row → `meters.damage-panel` / `meters.damage-row` → `dpsMeter.ts :: renderDpsMeter` (+ INFO 탭)
- Damage Meter Bar Green / Blue / Orange → `meters.damage-bar.*` (기여도 순위별)
- Mini Info Panel → `battlefield.mini-info-panel` (유닛 호버 툴팁)
- Wave Route Node Set → `battlefield.wave-route-nodes` (start/normal/elite/boss/end)

### 시트 G — 보유 유닛 리스트 → `panels.ts :: renderLeftPanel`

- Unit List Panel → `units.list-panel` (좌측 패널 배경)
- Unit Capacity Bar → `units.capacity-bar` (12/40 + 추가)
- Unit Filter Tabs + Button Normal / Selected → `units.filter-tabs`, `units.filter-btn.*`
- Unit Card Normal / Selected / Rare / Legendary → `units.card.*` (등급별 카드)
- Unit Element Icon Set → `units.element-icons` (속성 6종, 필터와 공유)
- Unit Grade Badge Set → `units.grade-badges` (등급 4종)
- Unit Count Badge → `units.count-badge` (보유 수)
- Unit Tag Chip → `units.tag-chip` (역할 칩)
- Equip Button Small → `units.btn.equip-small`
- Selected Unit Card Frame → `units.selected-card-frame` (선택 오버레이)

### 시트 H — 선택 유닛 상세 패널 → `panels.ts :: renderUnitDetail`

- Selected Unit Panel → `unit-detail.panel` (전체 HUD 배경)
- Portrait Frame / Name Plate / Grade Frame → `unit-detail.portrait-frame` / `name-plate` / `grade-frame`
- Attack Power Display → `unit-detail.attack-power` (대형 수치)
- Attack Type Badge Magic / Physical → `unit-detail.attack-type.*`
- Unit Stat Grid Frame / Stat Item Small → `unit-detail.stat-grid` / `stat-item` (ATK/DEF/HP/SPD …)
- Unit Tag Badge Set → `unit-detail.tag-badges`
- Unit Effect Slot Grid / Slot / Icon Set / Value Badge → `unit-detail.effect-*` (버프 표시)
- Bonus Tag Strip → `unit-detail.bonus-tag-strip`

### 시트 A — 우측 패널 / 미션 / 보스 → `panels.ts :: renderRightPanel`

- Right Side Panel / Tabs / Tab Button Normal·Selected → `right.side-panel`, `right.tabs`, `right.tab-btn.*`
- Mission Card Active / Completed → `mission.card.*` → `panels.ts :: MissionTab`
- Mission Title Banner / Round Limit Badge / Progress Plate / Reward Plate / Completed Badge → `mission.*`
- Boss Info Panel / Boss Card / Boss Reward Preview → `boss.*` → `panels.ts :: BossTab` (보상은 `modals.ts :: openRelicChoiceModal`와 공유)
- Log Entry → `log.entry` → `panels.ts :: LogTab`
- Relic Panel Small → `relic.panel-small` → `panels.ts :: renderRightPanel(RELICS)`

### 시트 F — 슬롯 / 게이지 / 팝업

- Skill / Selected Skill / Item / Equipment / Relic / Effect / Empty / Locked Slot → `slots.*` → `renderUnitDetail`, `Actionbar`, `modals.ts`
- Cooldown Overlay → `slots.cooldown-overlay` → `board.ts` / 스킬 슬롯 위 회전 오버레이
- HP Bar / HP Gauge / MP Bar / Dark Energy Bar / Boss HP Bar / Progress Bar → `meters.*` → `board.ts`, `renderUnitDetail`, `renderTopbar`
- Tooltip Box → `popups.tooltip` → `widgets.ts` 공용 툴팁
- Confirm Popup → `popups.confirm` → `widgets.ts :: confirmModal`
- Reward Popup → `popups.reward` → `modals.ts :: openSelectorModal`, `maybeShowResult`
- Boss Warning Popup → `popups.boss-warning`; 배너형은 `popups.boss-warning-banner`(시트 C) → `board.ts` 상단
- Settings Popup → `popups.settings` → `scenes.ts :: openOptionsOverlay`
- Checkbox Unchecked / Checked, Toggle Off / On → `controls.checkbox.*`, `controls.toggle.*` → `openOptionsOverlay`
- Fantasy Mouse Cursor → `controls.cursor` → 전역 CSS `body { cursor }`

---

## 4. 적용 로드맵 (권장 순서)

1. **공용 키트(시트 D)** — `frame.*`, `btn.generic.*`, `btn.tab.*`. 9-슬라이스 헬퍼를 `widgets.ts`에 먼저 추가하면 이후 전부 재사용.
2. **상시 노출 HUD** — 상단 상태바(E) → 하단 액션바(C) → 좌측 유닛 리스트(G). 플레이 중 항상 보이므로 체감 효과 큼.
3. **전장(B)** — 보드 프레임·마커·HP 바. `BoardRenderer`는 캔버스라 9-슬라이스 대신 직접 drawImage 처리 필요.
4. **상세/우측 패널(H, A)** — 선택 유닛 상세 + 미션/보스/로그 탭.
5. **팝업·컨트롤(F)** — 모달 셸, 확인/보상/설정 팝업, 체크박스/토글, 커서.
6. **이펙트(D fx)** — 글로우/하이라이트로 마감.

## 5. 슬라이스 작업 메모

현재 프로젝트용 개별 PNG는 생성되어 있다. 원본 오버뷰 시트에서 다시 뽑거나 GPT 이미지 생성 결과로 교체할 때는 두 경로 중 택1:

- (권장) 각 컴포넌트를 **투명 배경 개별 PNG**로 재export → 위 폴더에 파일명 규칙대로 저장 → 매니페스트 `sliced: true`.
- 또는 시트에서 좌표 기반으로 잘라내기. 이 경우 시트별 컴포넌트 바운딩박스(x,y,w,h)를 추가로 정리해야 하며, 9-슬라이스 항목은 늘어나지 않는 모서리 여백(border inset)도 함께 기록 필요.

> 캔버스 렌더(`board.ts`)에 쓰는 에셋(전장 프레임, 마커, HP 바, 보스 경고 배너)은 DOM CSS 9-슬라이스가 아니라 `drawImage` 9분할 로직이 필요하니, 슬라이스 시 모서리 inset 값을 같이 메모해 둘 것.
