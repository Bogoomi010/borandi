# 빈 템플릿으로 재생성해야 할 이미지 목록

게임은 수치·텍스트를 **런타임(DOM/i18n)** 으로 그린다. 따라서 이미지에 글자/숫자/예시값이
구워진 에셋은 그대로 깔면 런타임 텍스트와 겹친다. 아래 이미지들을 **글자/숫자 없는 빈 템플릿**
(프레임·배경·아이콘만)으로 재생성하면, 적용 코드가 이미 준비돼 있으므로 바로 활성화된다.

> **중요:** 빈 템플릿은 글자가 없으므로 **언어 변형(`_ko/_jp/_en/_cn`)이 필요 없다.**
> 컴포넌트당 **베이스 1장**(글자 없는 버전)만 만들면 된다. 기존 4언어 변형은 삭제 가능.
> (고정 라벨 버튼류 — 아래 "유지" 항목 — 만 언어 변형을 그대로 둔다.)

---

## A. 게이지/바 (숫자 베이크 → 빈 바 프레임 + 빈 채움으로)

채움(fill)은 코드가 너비/색으로 그린다. 프레임만, 숫자 없이.

- `meters/hp-bar.png` (현재 "1,284 / 1,284")
- `meters/hp-gauge.png` (현재 "75%")
- `meters/mp-bar.png` (현재 "640 / 640")
- `meters/dark-energy-bar.png` (현재 "320 / 1,000")
- `meters/boss-hp-bar.png` (현재 "22,450 / 45,000")
- `meters/progress-bar.png` (현재 "63%")
- `meters/damage-panel.png` (현재 "DAMAGE METER" 타이틀)
- `meters/damage-row.png` (현재 이름·수치·% 예시)

## B. 유닛 리스트/카드 (이름·레벨·수량·별 베이크)

- `units/capacity-bar.png` (현재 "12 / 40")
- `units/count-badge.png` (현재 "99")
- `units/card-normal.png` / `card-rare.png` / `card-legendary.png` / `card-selected.png`
  (초상화·이름·레벨·별·수량 전부 → 빈 카드 프레임만)
- `units/list-panel.png` (현재 "UNITS" 헤더 → 빈 패널)
- `units/filter-tabs.png` (현재 "ALL" 등 라벨 → 아이콘 슬롯만)
- `units/tag-chip.png` (현재 "Frontline" → 빈 칩)
- `units/element-icons.png` (아이콘 아래 "ICE/FIRE…" 라벨 제거 → 아이콘만)
- `units/btn-equip-small.png` (현재 "EQUIP" → 빈 버튼; 또는 i18n 텍스트로)

## C. 선택 유닛 상세 (수치·태그 베이크)

- `unit-detail/attack-power.png` (현재 "540")
- `unit-detail/stat-item.png` (현재 "ATK 975")
- `unit-detail/effect-value-badge.png` (현재 "12s")
- `unit-detail/tag-badges.png` (현재 "Beast/Light/…" → 빈 배지)
- `unit-detail/panel.png` (전체 합성본: 540·스탯 → 빈 패널 배경)
- `unit-detail/grade-frame.png` (별 5개 고정 → 별 없는 프레임만; 별은 코드로)

## D. 미션 (진행/보상 수치 베이크)

- `mission/card-active.png` / `card-completed.png` (제목·진행·보상 텍스트 → 빈 카드)
- `mission/round-limit-badge.png` (현재 "10" → 빈 배지)
- `mission/progress-plate.png` (현재 "Progress 2/4")
- `mission/reward-plate.png` (현재 "12,000 / 350 XP" → 아이콘만, 값 비움)

## E. 보스 패널 (이름·레벨·HP 베이크)

- `boss/info-panel.png` (NECROMANCER·LV·HP·타입 → 빈 패널)
- `boss/card.png` (이름·LV·100% → 빈 카드)
- `boss/reward-preview.png` ("POSSIBLE REWARDS"·값 → 빈 보상 슬롯)

## F. 팝업 (예시 문구 베이크)

- `popups/confirm.png` ("Are you sure?", CANCEL/CONFIRM → 빈 다이얼로그 프레임)
- `popups/reward.png` ("REWARD"·값·CLAIM → 빈 보상 프레임)
- `popups/settings.png` ("SETTINGS"·MUSIC… → 빈 설정 프레임)
- `popups/tooltip.png` (예시 스킬 설명 → 빈 말풍선)
- `popups/boss-warning.png` / `boss-warning-banner.png` ("BOSS APPROACHING!" → 빈 경고 프레임; 문구는 i18n)

## G. 범용/탭 버튼 (플레이스홀더 라벨 베이크)

게임 라벨과 안 맞는 더미 텍스트. 빈 버튼 프레임(상태별)으로.

- `buttons/generic-normal.png` / `generic-hover.png` / `generic-pressed.png` (현재 "BUTTON")
- `buttons/tab-normal.png` / `tab-selected.png` (현재 "UNITS")
- `buttons/right-tab-normal.png` / `right-tab-selected.png` (현재 "INFO/MISSION/RELICS")
- `buttons/primary.png` (현재 "BATTLE") / `buttons/secondary.png` (현재 "DEFEND")
- `buttons/label-shortcut.png` (현재 "1 Summon Unit") / `buttons/label-cost.png` (현재 "120/250")
- `buttons/actionbar.png` (현재 "Round 15" 등 → 빈 바)
- `buttons/action-disabled.png` (현재 "SUMMON" 회색 → 빈 비활성 버튼)

## H. 상단바 컨트롤 (상태 변형 부족 — 추가 생성 필요)

- `topbar/status-bar.png` (아이콘·속도 합성 → 빈 바)
- `topbar/speed-x1.png` / `speed-x2.png` / `speed-x3.png` — **각 속도의 일반+선택 2종 세트 필요**
  (현재 x1·x2 일반본 + x3-selected만 있어 활성/비활성 표현 불가)
- `topbar/btn-pause.png` — **재생(▶)/일시정지(⏸) 2종 필요** (현재 일시정지 글리프만)
- `topbar/header-icons.png` — 6아이콘 합본 → 개별 PNG로 분리(슬라이스)

## I. 슬롯 (수량/쿨다운 숫자 베이크)

- `slots/item.png` (현재 "25" 수량 → 빈 아이템 슬롯)
- `slots/cooldown-overlay.png` (현재 "5.2" → 숫자 없는 쿨다운 스윕만)

---

## 그대로 둘 것 (수정 불필요)

이미 적용됐거나, 고정 라벨/무텍스트라 문제 없음:

- **적용 완료**: `buttons/action-*_<lang>`(고정 라벨, 언어 변형 유지), `unit-detail/portrait-frame`,
  `unit-detail/stat-grid`, `unit-detail/attack-type-magic|physical_<lang>`, `slots/skill`,
  `controls/toggle-on|off`, `controls/cursor`, `frames/panel-main`(모달)
- **무텍스트 클린(필요시 적용 가능)**: `frames/nineslice-*`, `frames/panel-small`, `frames/badge`,
  `frames/corner`, `frames/divider`, `slots/skill-selected|equipment|relic|effect|empty|locked|relic-panel-small`,
  `meters/damage-bar-green|blue|orange`(채움색), `mission/title-banner`, `mission/completed-badge`,
  `unit-detail/name-plate|effect-slot|effect-slot-grid|effect-icons|bonus-tag-strip`,
  `units/grade-badges|filter-btn-normal|selected|selected-card-frame`,
  `topbar/badge-*|save-indicator|divider-tiny|speed-group`, `battlefield/*`(캔버스 작업 필요), `fx/glow-set`
