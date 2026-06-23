# UI 에셋 생성 프롬프트 (GPT 이미지 생성용)

오버뷰 시트와 동일한 스타일로 **개별 투명 PNG**를 GPT(gpt-image-1 / GPT-4o 이미지 생성)에게
뽑게 하는 프롬프트 모음. 결과물 파일명·배치 폴더는 [`ui-asset-catalog.md`](./ui-asset-catalog.md) /
[`src/ui/uiAssets.ts`](../src/ui/uiAssets.ts) 의 규칙과 1:1로 맞춰 두었다.

## 사용법

1. 아래 **STYLE BLOCK**(공통 스타일)을 먼저 복사한다.
2. 만들 컴포넌트의 **ITEM 프롬프트**를 그 아래에 붙여 한 번에 하나씩 생성한다.
3. 가능하면 보유 중인 **오버뷰 시트 이미지를 레퍼런스로 함께 첨부**한다("match this style").
4. 받은 PNG를 표시된 경로(`src/assets/ui/<category>/<파일명>`)에 저장 → 매니페스트의 해당 항목 `sliced: true`로 변경.

> 팁: 프롬프트는 영어가 이미지 모델에서 가장 안정적이라 영어로 작성했다. 한 컷에 한 컴포넌트만 요청해야 깔끔하게 나온다. 9-슬라이스 프레임/바는 "symmetric, tileable, even border" 지시가 중요하다.

---

## STYLE BLOCK (공통 — 항상 맨 앞에 붙일 것)

```
You are generating a single UI asset for a dark-fantasy tower-defense / gacha RPG game.

ART STYLE:
- Hand-painted semi-realistic mobile-game UI, in the style of high-end fantasy gacha RPGs
  and Warcraft-style interfaces. Crisp, clean edges; painterly metal texture.
- Frames and borders: weathered dark steel/iron combined with polished GOLD filigree on the
  edges and corners. Small faceted BLUE SAPPHIRE gems set at corners and edge midpoints.
- Panel fills: dark charcoal / near-black slate with a subtle stone texture and soft inner shadow.
- Lighting: light source from top-left, soft beveled edges, gentle inner glow.
- Accent colors by meaning: blue/cyan = normal & magic, gold = premium/selected,
  green = success/complete, red = danger/boss, purple = arcane/legendary/epic.

TECHNICAL REQUIREMENTS (must follow exactly):
- Fully TRANSPARENT background (PNG alpha). No drop shadow onto a background plate.
- Exactly ONE component, centered, with small even transparent padding around it.
- Do NOT bake in any text/numbers unless explicitly asked; leave empty space for it.
- Front-facing, orthographic, no perspective tilt. No watermark.
- Clean, production-ready game UI asset.
```

---

## 1. 시트 D — 공용 프레임 / 버튼 키트  → `src/assets/ui/frames`, `buttons`, `fx`

> 9-슬라이스 프레임은 반드시 "symmetric and tileable: straight middle edges, ornaments only in the corners, uniform border thickness"를 넣을 것.

```
[STYLE BLOCK]
Asset: a rectangular fantasy PANEL FRAME, 9-slice ready.
- Ornate gold corners with a blue sapphire gem in each corner and one centered on the top edge.
- Dark slate interior fill. Edges straight and uniform thickness so it tiles when stretched.
- Square-ish, 512x512, generous empty interior.
Save as: frames/panel-main.png   (key: frame.panel.main)
```

같은 STYLE BLOCK 기준으로 아래도 동일 방식(한 컷씩):

- `frames/panel-small.png` (frame.panel.small) — "smaller, lighter version of the main panel frame, thinner gold, fewer gems."
- `frames/nineslice-main.png` (frame.nineslice.main) — "thin metallic outline-only frame, hollow center, blue gems at corners and edge midpoints, perfectly symmetric for 9-slice."
- `frames/nineslice-small.png` (frame.nineslice.small) — "even thinner outline-only frame, silver/steel with tiny blue gems."
- `frames/badge.png` (frame.badge) — "heraldic emblem badge: blue shield with crossed swords and a sapphire, gold wings, no text."
- `frames/divider.png` (frame.divider) — "horizontal ornamental divider bar, gold rod with a blue gem at center, tapering ends."
- `frames/corner.png` (frame.corner) — "single ornate gold L-shaped frame corner piece with a blue gem, for compositing 9-slice corners."
- `buttons/generic-normal.png` (btn.generic.normal) — "rectangular fantasy button, blue enamel face, gold beveled border, blue gem accents, empty face for label. 9-slice ready."
- `buttons/generic-hover.png` (btn.generic.hover) — "same button brighter, glowing cyan highlight edge (hover state)."
- `buttons/generic-pressed.png` (btn.generic.pressed) — "same button darker, pushed-in / inset look (pressed state)."
- `buttons/tab-normal.png` (btn.tab.normal) — "tab button, dark steel face with gold trim, unselected, empty for label."
- `buttons/tab-selected.png` (btn.tab.selected) — "tab button, bright blue active face with gold trim and a centered sapphire (selected)."
- `fx/glow-set.png` (fx.glow.set) — "three separate magical glow sprites side by side on transparent bg: (1) blue/cyan star burst, (2) orange fire burst, (3) cyan ground ripple ring."

---

## 2. 시트 E — 상단 상태바  → `src/assets/ui/topbar`

```
[STYLE BLOCK]
Asset: a long horizontal TOP STATUS BAR background, 9-slice ready.
- Dark polished metal bar with gold-and-steel ornate end caps, blue gems at the ends.
- Long straight middle so it tiles horizontally. Empty interior for icons/text.
- Wide aspect, ~1600x140.
Save as: topbar/status-bar.png   (key: topbar.bar)
```

- `topbar/badge-map.png … badge-next-boss.png` (topbar.badge.*) — "short rounded info-plate, dark fill with gold-steel frame and a [ICON] socket on the left; empty for value." → ICON을 각각 map scroll / blue gem(round) / red demon head(enemy) / gold crown coin(gold) / blue shield(difficulty) / golden horned boss crest(next boss)로 바꿔 6개 생성.
- `topbar/speed-group.png` (topbar.speed.group) — "segmented control frame holding three slots, dark steel with gold trim."
- `topbar/speed-x1.png`, `speed-x2.png` (topbar.speed.x1/x2) — "small square dark button, gold border, empty face."
- `topbar/speed-x3-selected.png` (topbar.speed.x3-selected) — "small square button with bright GOLD glowing face (selected speed)."
- `topbar/btn-pause.png` (topbar.btn.pause) — "small square dark button showing a pause (two bars) glyph, gold border."
- `topbar/save-indicator.png` (topbar.save-indicator) — "small octagonal indicator with a blue diamond gem, soft glow."
- `topbar/divider-tiny.png` (topbar.divider.tiny) — "tiny vertical divider: thin gold line with a small blue gem at center."
- `topbar/header-icons.png` (topbar.icons.header-set) — "a row of 6 separate fantasy icons on transparent bg: map scroll, blue compass gem, red demon head, gold crown coin, blue gem shield, golden horned boss crest."

---

## 3. 시트 C — 하단 액션바  → `src/assets/ui/buttons`

```
[STYLE BLOCK]
Asset: a long horizontal BOTTOM ACTION BAR background, 9-slice ready.
- Heavy dark metal bar with a row of empty square item slots, large gold-steel end caps,
  a centered sapphire ornament on the top edge. Straight tileable middle.
- Very wide aspect, ~1800x180.
Save as: buttons/actionbar.png   (key: actionbar.bar)
```

- `buttons/action-summon.png … action-relic.png` (actionbar.btn.*) — "square fantasy action button, dark face with gold border and blue gem corners, a [ICON] in the center and an empty blue label strip at the bottom." → ICON: glowing blue ring(summon) / two orbs merging with arrow(merge) / gold coins(sell) / green up arrow(upgrade) / purple gem(relic).
- `buttons/action-dps-toggle.png` (actionbar.btn.dps-toggle) — "square button with crossed swords icon, label strip area (for 'DPS') empty."
- `buttons/round-start-normal.png` (actionbar.btn.round-start.normal) — "wide blue fantasy CTA button with gold border and a sapphire on top, empty for 'START ROUND'. 9-slice ready."
- `buttons/round-start-hover.png` (actionbar.btn.round-start.hover) — "same button with bright cyan glow (hover)."
- `buttons/label-shortcut.png` (actionbar.label.shortcut) — "small pill chip: left square key-cap slot + empty label area, dark with gold trim."
- `buttons/label-cost.png` (actionbar.label.cost) — "small cost chip with a blue mana gem icon and a gold coin icon, dark plate, empty numbers."
- `buttons/action-disabled.png` (actionbar.btn.disabled) — "the action button rendered fully greyed-out / desaturated (disabled state)."
- `buttons/primary.png` (btn.primary) — "large primary CTA button, bright blue face, ornate gold border, emblem on the left, empty for label. 9-slice ready."
- `buttons/secondary.png` (btn.secondary) — "large secondary CTA button, dark steel face with gold trim and crossed-swords emblem, empty for label."

---

## 4. 시트 B — 전장 / 데미지미터  → `src/assets/ui/battlefield`, `meters`

- `battlefield/frame.png` (battlefield.frame) — "large rectangular battlefield border frame, thick stone-and-gold ornate edges, blue banners and gem accents at corners, hollow center. 9-slice ready, ~900x600."
- `battlefield/road-border.png` (battlefield.road-border) — "a short straight stone-paved path tile segment with carved stone borders, top-down, tileable both ends."
- `battlefield/enemy-path-marker.png` (battlefield.enemy-path-marker) — "a row of red chevron arrows pointing right ending in a small red skull, direction marker."
- `battlefield/enemy-marker-normal.png` (battlefield.enemy-marker.normal) — "small round enemy map marker: red diamond with crossed swords and a skull."
- `battlefield/enemy-marker-elite.png` (battlefield.enemy-marker.elite) — "elite enemy marker: purple/gold version with a crowned skull and wings, more ornate."
- `battlefield/placement-node.png` (battlefield.placement-node) — "a glowing cyan circular placement target with a plus sign and four diamond nodes around it (translucent)."
- `battlefield/placed-unit-marker.png` (battlefield.placed-unit-marker) — "a gold-and-blue heraldic shield base marker for a placed unit, no glow."
- `battlefield/selected-unit-marker.png` (battlefield.selected-unit-marker) — "same shield marker but with a bright cyan selection glow halo."
- `meters/damage-panel.png` (meters.damage-panel) — "tall dark panel with gold-steel frame and a blue title banner on top reading nothing (empty), for a damage meter list. 9-slice ready."
- `meters/damage-row.png` (meters.damage-row) — "a horizontal list-row plate: small left portrait socket + empty text area, dark with thin gold trim."
- `meters/damage-bar-green.png / -blue.png / -orange.png` (meters.damage-bar.*) — "a horizontal progress bar with gold-steel frame and a glossy [COLOR] fill, empty/partial. 9-slice ready." → COLOR = green / blue / orange.
- `battlefield/mini-info-panel.png` (battlefield.mini-info-panel) — "small dark rounded tooltip panel with gold corner brackets, left portrait socket, empty for stats."
- `battlefield/wave-route-nodes.png` (battlefield.wave-route-nodes) — "5 separate progression node icons in a row: blue start banner, blue gem node (normal), gold skull medal (elite), purple ornate boss node, grey skull end node."

---

## 5. 시트 G — 보유 유닛 리스트  → `src/assets/ui/units`

- `units/list-panel.png` (units.list-panel) — "tall vertical roster panel, dark slate fill, gold-steel frame, blue title banner on top (empty). 9-slice ready."
- `units/capacity-bar.png` (units.capacity-bar) — "horizontal capacity bar: left helmet emblem, a blue fill progress bar, and a gold plus button on the right; empty numbers."
- `units/filter-tabs.png` (units.filter-tabs) — "a horizontal segmented filter tab strip with 7 dark slots, gold trim, empty (icons added later)."
- `units/filter-btn-normal.png / -selected.png` (units.filter-btn.*) — "small square grid-filter button, dark (normal) / bright blue with gold border (selected)."
- `units/card-normal.png` (units.card.normal) — "a unit roster card: left portrait frame, name area, star rating area, count badge corner; dark with subtle gold trim. 9-slice ready. No text."
- `units/card-selected.png` (units.card.selected) — "same card with a bright cyan glowing selection border."
- `units/card-rare.png` (units.card.rare) — "same card with a BLUE rarity border and faint blue inner glow."
- `units/card-legendary.png` (units.card.legendary) — "same card with a PURPLE legendary border and purple inner glow, more ornate."
- `units/element-icons.png` (units.element-icons) — "6 separate hexagonal element icons in a row: ice snowflake (cyan), fire flame (red), nature leaf (green), holy sun (gold), warrior crossed-swords (steel), arcane diamond (purple)."
- `units/grade-badges.png` (units.grade-badges) — "4 separate gem-shaped grade badges in a row: normal (dark steel), rare (blue), epic (purple), legendary (gold)."
- `units/count-badge.png` (units.count-badge) — "small dark rounded count badge with gold trim, empty number."
- `units/tag-chip.png` (units.tag-chip) — "small gold-bordered dark chip / tag label, empty text."
- `units/btn-equip-small.png` (units.btn.equip-small) — "small button with a sword icon and empty label area, gold trim."
- `units/selected-card-frame.png` (units.selected-card-frame) — "an animated-look glowing cyan rectangular selection frame overlay, hollow center, gem corners. 9-slice ready."

---

## 6. 시트 H — 선택 유닛 상세 패널  → `src/assets/ui/unit-detail`

- `unit-detail/panel.png` (unit-detail.panel) — "wide dark HUD panel, gold-steel frame, gem corners, hollow; sections for a portrait, name banner, big number, stat grid. 9-slice ready."
- `unit-detail/portrait-frame.png` (unit-detail.portrait-frame) — "ornate gold-and-blue square portrait frame, hollow center, gem corners."
- `unit-detail/name-plate.png` (unit-detail.name-plate) — "a blue ornate name banner ribbon with gold trim, empty for text. 9-slice ready."
- `unit-detail/grade-frame.png` (unit-detail.grade-frame) — "a purple gem emblem with gold frame above a row of 5 gold stars (grade display)."
- `unit-detail/attack-power.png` (unit-detail.attack-power) — "a dark rounded number plate with gold trim for a large attack-power value, empty."
- `unit-detail/attack-type-magic.png` (unit-detail.attack-type.magic) — "a small BLUE pill badge for 'Magic', empty text."
- `unit-detail/attack-type-physical.png` (unit-detail.attack-type.physical) — "a small RED pill badge for 'Physical', empty text."
- `unit-detail/stat-grid.png` (unit-detail.stat-grid) — "a 4x2 dark grid frame with gold-steel trim and gem corners, empty cells. 9-slice ready."
- `unit-detail/stat-item.png` (unit-detail.stat-item) — "a single small stat cell: icon slot on top, empty label and value, dark with gold trim."
- `unit-detail/tag-badges.png` (unit-detail.tag-badges) — "a row of 6 separate gold-bordered tag badges, dark fill, empty text."
- `unit-detail/effect-slot-grid.png` (unit-detail.effect-slot-grid) — "a horizontal strip of 4 empty effect slots with gold-steel trim and gem corners. 9-slice ready."
- `unit-detail/effect-slot.png` (unit-detail.effect-slot) — "a single square buff/effect slot, dark with gold trim and blue gem corners, empty."
- `unit-detail/effect-icons.png` (unit-detail.effect-icons) — "6 separate round effect icons in a row: arcane (purple), water drop (blue), nature leaf (green), fire (red), shield (gold), wave/ripple (cyan)."
- `unit-detail/effect-value-badge.png` (unit-detail.effect-value-badge) — "a tiny dark badge with gold trim for a duration value, empty text."
- `unit-detail/bonus-tag-strip.png` (unit-detail.bonus-tag-strip) — "a thin horizontal gold connector strip with blue gem nodes along it. 9-slice ready."

---

## 7. 시트 A — 우측 패널 / 미션 / 보스  → `frames`, `buttons`, `mission`, `boss`, `slots`

- `frames/right-side-panel.png` (right.side-panel) — "tall right-side panel, dark slate, gold-steel frame, three stacked blue section title banners (INFO/MISSION/RELICS empty). 9-slice ready."
- `frames/right-tabs.png` (right.tabs) — "a horizontal 3-segment tab bar, dark with gold trim, empty."
- `buttons/right-tab-normal.png / -selected.png` (right.tab-btn.*) — "a wide tab button, dark steel (normal) / bright blue with gold trim and gem (selected), empty for label."
- `mission/card-active.png` (mission.card.active) — "a mission card: blue title banner top, body area with rows for limit/progress, a progress bar, reward row; dark with gold trim. 9-slice ready. No text."
- `mission/card-completed.png` (mission.card.completed) — "same mission card tinted GREEN with a green title banner and check accent (completed)."
- `mission/title-banner.png` (mission.title-banner) — "a blue ornate title banner with gold trim and a sapphire center, empty. 9-slice ready."
- `mission/round-limit-badge.png` (mission.round-limit-badge) — "a circular gold-rimmed dark badge for a round-limit number, empty."
- `mission/progress-plate.png` (mission.progress-plate) — "a dark rounded plate with gold trim for 'Progress: x/y', empty. 9-slice ready."
- `mission/reward-plate.png` (mission.reward-plate) — "a dark rounded plate showing a gold coin icon and a blue XP icon with empty value areas, gold trim."
- `mission/completed-badge.png` (mission.completed-badge) — "a green shield badge with a white check mark, gold trim."
- `boss/info-panel.png` (boss.info-panel) — "a wide dark boss info panel: left boss portrait area, name/level area, rows for type/weakness/resistance, a red HP bar; gold-steel frame. 9-slice ready. No text."
- `boss/card.png` (boss.card) — "a boss preview card: left necromancer portrait, name/level area, a purple progress bar; dark with gold trim. No text."
- `boss/reward-preview.png` (boss.reward-preview) — "a 'possible rewards' panel with 3 empty reward slots (purple gem / gold coin / blue XP), dark with gold trim and a small banner top."
- `frames/log-entry.png` (log.entry) — "a single horizontal log row: left icon socket (crossed swords), empty text area, gold corner brackets, blue gem accent. 9-slice ready."
- `slots/relic-panel-small.png` (relic.panel-small) — "a small panel holding 2 empty relic slots, dark with gold trim."

---

## 8. 시트 F — 슬롯 / 게이지 / 팝업  → `slots`, `meters`, `popups`, `controls`

- `slots/skill.png` (slots.skill) — "a square skill slot with gold-steel frame and blue gem corners, dark interior with a faint blue spell swirl, empty."
- `slots/skill-selected.png` (slots.skill-selected) — "same skill slot with a bright GOLD ornate selected frame and glow."
- `slots/cooldown-overlay.png` (slots.cooldown-overlay) — "a semi-transparent dark square overlay with a cyan radial sweep (cooldown), empty center for a number."
- `slots/item.png` (slots.item) — "a square item slot with a red potion icon and an empty quantity corner, gold trim."
- `slots/equipment.png` (slots.equipment) — "a square equipment slot with a sword icon, gold trim, dark interior."
- `slots/relic.png` (slots.relic) — "a square relic slot with a gold ring + purple gem icon, ornate gold trim."
- `slots/effect.png` (slots.effect) — "a square buff/effect slot with a green swirl icon, gold trim."
- `slots/empty.png` (slots.empty) — "an empty square slot, dark interior with simple steel-gold frame."
- `slots/locked.png` (slots.locked) — "a locked square slot, dark with a grey padlock icon and steel frame."
- `meters/hp-bar.png` (meters.hp-bar) — "a horizontal RED HP bar with gold-steel frame, glossy fill, empty numbers. 9-slice ready."
- `meters/hp-gauge.png` (meters.hp-gauge) — "a horizontal red HP gauge styled for a percentage, gold trim. 9-slice ready."
- `meters/mp-bar.png` (meters.mp-bar) — "a horizontal BLUE mana bar, gold-steel frame, glossy fill. 9-slice ready."
- `meters/dark-energy-bar.png` (meters.dark-energy-bar) — "a horizontal PURPLE dark-energy bar, ominous glow, gold-steel frame. 9-slice ready."
- `meters/boss-hp-bar.png` (meters.boss-hp-bar) — "a long wide RED boss HP bar with a horned demon skull emblem on the left end, ornate steel-gold frame. 9-slice ready."
- `meters/progress-bar.png` (meters.progress-bar) — "a generic horizontal BLUE progress bar with gold-steel frame, empty percent. 9-slice ready."
- `popups/tooltip.png` (popups.tooltip) — "a dark rounded tooltip box with gold corner brackets, a blue title bar on top, and a downward pointer tail; empty. 9-slice ready."
- `popups/confirm.png` (popups.confirm) — "a small parchment-and-gold confirm dialog frame with ornate corners, empty body and two button areas. 9-slice ready."
- `popups/reward.png` (popups.reward) — "a reward popup frame: blue 'REWARD' title banner, parchment body with 3 reward slots, a claim button area; ornate gold corners. No text."
- `popups/boss-warning.png` (popups.boss-warning) — "a dark red alarm popup frame with a horned demon skull on top, ominous red glow, ornate dark corners, empty body."
- `popups/boss-warning-banner.png` (popups.boss-warning-banner) — "a long horizontal red alert banner with a golden horned demon skull on the left, glowing embers, stone-gold end caps, empty center for 'BOSS APPROACHING'. 9-slice ready."
- `popups/settings.png` (popups.settings) — "a settings popup frame: blue 'SETTINGS' title banner, parchment/dark body with rows of sliders and a dropdown, ornate gold corners. No text."
- `controls/checkbox-unchecked.png / -checked.png` (controls.checkbox.*) — "a square checkbox, gold-steel frame, empty (unchecked) / with a cyan check mark (checked)."
- `controls/toggle-off.png / -on.png` (controls.toggle.*) — "a pill toggle switch: dark with knob left (off) / blue with gold knob right (on)."
- `controls/cursor.png` (controls.cursor) — "a fantasy mouse cursor arrow made of gold and blue steel with a small sapphire, pointing top-left, small."

---

## 9. 일관성 체크리스트 (생성 후)

- [ ] 모든 PNG **배경 투명**인지 (배경 플레이트/그림자 없음).
- [ ] 같은 그룹(버튼/카드/바)끼리 **테두리 두께·골드 톤·젬 색**이 통일됐는지.
- [ ] 9-슬라이스 항목은 **모서리만 장식, 가운데 변은 직선/균일** → 늘려도 안 깨지는지.
- [ ] 텍스트/숫자가 **구워지지 않았는지**(런타임에 올림).
- [ ] 파일명이 매니페스트 `file` 값과 **정확히 일치**하는지 → 일치해야 `uiSkin.ts`가 자동 인식.
- [ ] 저장 후 매니페스트 항목 `sliced: true`로 변경.
