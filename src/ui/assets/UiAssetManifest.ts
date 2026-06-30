import actionDisabledUrl from "../../assets/ui/buttons/action-disabled.png?url";
import actionbarUrl from "../../assets/ui/buttons/actionbar.png?url";
import genericHoverUrl from "../../assets/ui/buttons/generic-hover.png?url";
import genericNormalUrl from "../../assets/ui/buttons/generic-normal.png?url";
import genericPressedUrl from "../../assets/ui/buttons/generic-pressed.png?url";
import labelCostUrl from "../../assets/ui/buttons/label-cost.png?url";
import labelShortcutUrl from "../../assets/ui/buttons/label-shortcut.png?url";
import primaryUrl from "../../assets/ui/buttons/primary.png?url";
import rightTabNormalUrl from "../../assets/ui/buttons/right-tab-normal.png?url";
import rightTabSelectedUrl from "../../assets/ui/buttons/right-tab-selected.png?url";
import roundStartHoverUrl from "../../assets/ui/buttons/round-start-hover.png?url";
import roundStartNormalUrl from "../../assets/ui/buttons/round-start-normal.png?url";
import secondaryUrl from "../../assets/ui/buttons/secondary.png?url";
import battlefieldFrameUrl from "../../assets/ui/battlefield/frame.png?url";
import cornerUrl from "../../assets/ui/frames/corner.png?url";
import dividerUrl from "../../assets/ui/frames/divider.png?url";
import frameBadgeUrl from "../../assets/ui/frames/badge.png?url";
import panelMainUrl from "../../assets/ui/frames/nineslice-main.png?url";
import panelSmallUrl from "../../assets/ui/frames/nineslice-small.png?url";
import missionActiveUrl from "../../assets/ui/mission/card-active.png?url";
import missionCompletedUrl from "../../assets/ui/mission/card-completed.png?url";
import missionProgressUrl from "../../assets/ui/mission/progress-plate.png?url";
import missionRewardUrl from "../../assets/ui/mission/reward-plate.png?url";
import bossWarningBannerUrl from "../../assets/ui/popups/boss-warning-banner.png?url";
import confirmPopupUrl from "../../assets/ui/popups/confirm.png?url";
import slotLockedUrl from "../../assets/ui/slots/locked.png?url";
import slotRelicUrl from "../../assets/ui/slots/relic.png?url";
import slotSkillSelectedUrl from "../../assets/ui/slots/skill-selected.png?url";
import slotSkillUrl from "../../assets/ui/slots/skill.png?url";
import topbarBadgeBossUrl from "../../assets/ui/topbar/badge-next-boss.png?url";
import topbarBadgeDifficultyUrl from "../../assets/ui/topbar/badge-difficulty.png?url";
import topbarBadgeEnemyUrl from "../../assets/ui/topbar/badge-enemy.png?url";
import topbarBadgeGoldUrl from "../../assets/ui/topbar/badge-gold.png?url";
import topbarBadgeMapUrl from "../../assets/ui/topbar/badge-map.png?url";
import topbarBadgeRoundUrl from "../../assets/ui/topbar/badge-round.png?url";
import topbarBossIconUrl from "../../assets/ui/topbar/header-icon-next-boss.png?url";
import topbarDifficultyIconUrl from "../../assets/ui/topbar/header-icon-difficulty.png?url";
import topbarEnemyIconUrl from "../../assets/ui/topbar/header-icon-enemy.png?url";
import topbarGoldIconUrl from "../../assets/ui/topbar/header-icon-gold.png?url";
import topbarMapIconUrl from "../../assets/ui/topbar/header-icon-map.png?url";
import topbarPauseUrl from "../../assets/ui/topbar/btn-pause.png?url";
import topbarPlayUrl from "../../assets/ui/topbar/btn-play.png?url";
import topbarRoundIconUrl from "../../assets/ui/topbar/header-icon-round.png?url";
import topbarSpeedGroupUrl from "../../assets/ui/topbar/speed-group.png?url";
import topbarSpeedX1SelectedUrl from "../../assets/ui/topbar/speed-x1-selected.png?url";
import topbarSpeedX1Url from "../../assets/ui/topbar/speed-x1.png?url";
import topbarSpeedX2SelectedUrl from "../../assets/ui/topbar/speed-x2-selected.png?url";
import topbarSpeedX2Url from "../../assets/ui/topbar/speed-x2.png?url";
import topbarSpeedX3SelectedUrl from "../../assets/ui/topbar/speed-x3-selected.png?url";
import topbarSpeedX3Url from "../../assets/ui/topbar/speed-x3.png?url";
import topbarStatusUrl from "../../assets/ui/topbar/status-bar.png?url";
import iconDamageUrl from "../../assets/ui/icon-damage.svg?url";
import iconGoldUrl from "../../assets/ui/icon-gold.svg?url";
import iconMergeUrl from "../../assets/ui/icon-merge.svg?url";
import iconPassiveUrl from "../../assets/ui/icon-passive.svg?url";
import iconSellUrl from "../../assets/ui/icon-sell.svg?url";
import iconSkillUrl from "../../assets/ui/icon-skill.svg?url";
import iconSpeedUrl from "../../assets/ui/icon-speed.svg?url";
import iconSummonUrl from "../../assets/ui/icon-summon.svg?url";
import iconTargetUrl from "../../assets/ui/icon-target.svg?url";
import iconUpgradeUrl from "../../assets/ui/icon-upgrade.svg?url";
import type { UiTextureKey } from "../skin/UiTextureKeys";

export const UI_ASSET_MANIFEST: Record<UiTextureKey, string> = {
  "button.generic.normal": genericNormalUrl,
  "button.generic.hover": genericHoverUrl,
  "button.generic.pressed": genericPressedUrl,
  "button.generic.disabled": actionDisabledUrl,
  "button.primary": primaryUrl,
  "button.secondary": secondaryUrl,
  "button.roundStart.normal": roundStartNormalUrl,
  "button.roundStart.hover": roundStartHoverUrl,
  "button.rightTab.normal": rightTabNormalUrl,
  "button.rightTab.selected": rightTabSelectedUrl,
  "button.keycap": labelShortcutUrl,
  "button.cost": labelCostUrl,
  "frame.actionbar": actionbarUrl,
  "frame.topbar": topbarStatusUrl,
  "frame.panel": panelMainUrl,
  "frame.panelSmall": panelSmallUrl,
  "frame.corner": cornerUrl,
  "frame.divider": dividerUrl,
  "frame.badge": frameBadgeUrl,
  "frame.battlefield": battlefieldFrameUrl,
  "mission.card.active": missionActiveUrl,
  "mission.card.done": missionCompletedUrl,
  "mission.progress": missionProgressUrl,
  "mission.reward": missionRewardUrl,
  "popup.confirm": confirmPopupUrl,
  "popup.banner": bossWarningBannerUrl,
  "slot.skill": slotSkillUrl,
  "slot.skill.selected": slotSkillSelectedUrl,
  "slot.locked": slotLockedUrl,
  "slot.relic": slotRelicUrl,
  "topbar.badge.map": topbarBadgeMapUrl,
  "topbar.badge.round": topbarBadgeRoundUrl,
  "topbar.badge.enemy": topbarBadgeEnemyUrl,
  "topbar.badge.gold": topbarBadgeGoldUrl,
  "topbar.badge.difficulty": topbarBadgeDifficultyUrl,
  "topbar.badge.boss": topbarBadgeBossUrl,
  "topbar.icon.map": topbarMapIconUrl,
  "topbar.icon.round": topbarRoundIconUrl,
  "topbar.icon.enemy": topbarEnemyIconUrl,
  "topbar.icon.gold": topbarGoldIconUrl,
  "topbar.icon.difficulty": topbarDifficultyIconUrl,
  "topbar.icon.boss": topbarBossIconUrl,
  "topbar.speed.group": topbarSpeedGroupUrl,
  "topbar.speed.x1": topbarSpeedX1Url,
  "topbar.speed.x1.selected": topbarSpeedX1SelectedUrl,
  "topbar.speed.x2": topbarSpeedX2Url,
  "topbar.speed.x2.selected": topbarSpeedX2SelectedUrl,
  "topbar.speed.x3": topbarSpeedX3Url,
  "topbar.speed.x3.selected": topbarSpeedX3SelectedUrl,
  "topbar.pause": topbarPauseUrl,
  "topbar.play": topbarPlayUrl,
  "icon.summon": iconSummonUrl,
  "icon.merge": iconMergeUrl,
  "icon.sell": iconSellUrl,
  "icon.upgrade": iconUpgradeUrl,
  "icon.relic": iconPassiveUrl,
  "icon.dps": iconDamageUrl,
  "icon.start": iconTargetUrl,
  "icon.speed": iconSpeedUrl,
  "icon.gold": iconGoldUrl,
  "icon.warning": iconSkillUrl,
};
