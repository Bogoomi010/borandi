// 영어 사전 (i18n 키의 원본 소스). 이 객체의 키가 곧 I18nKey 타입이 된다.
// 다른 언어 사전은 Record<I18nKey, string>으로 강제되어 키 누락이 컴파일 에러가 된다.

export const en = {
  // 공용
  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.on": "On",
  "common.off": "Off",
  "common.language": "Language",

  // 메뉴바 타이틀
  "menu.game": "Game",
  "menu.view": "View",
  "menu.tools": "Tools",
  "menu.help": "Help",

  // Game 메뉴
  "menu.newRun": "New Run",
  "menu.restartSeed": "Restart Same Seed",
  "menu.save": "Manual Save…",
  "menu.save.hint": "3 slots",
  "menu.load": "Load…",
  "menu.exportReport": "Export Result Report",
  "menu.toTitle": "To Title",
  "menu.quit": "Quit Game",

  // View 메뉴
  "menu.toggleRightPanel": "Toggle Right Panel",
  "menu.fullscreen": "Toggle Fullscreen",

  // Tools 메뉴
  "menu.sim100": "100-Seed Simulation…",
  "menu.balanceGate": "5-Difficulty Balance Gate…",
  "menu.manualProof": "Manual Balance Proof…",
  "menu.openDataDir": "Open App Data Folder",

  // Help 메뉴
  "menu.shortcuts": "Shortcuts / Rules",
  "menu.collection": "Collection",
  "menu.options": "Options",
  "menu.about": "About",

  // 토스트
  "toast.reportSaved": "Report saved: {path}",
  "toast.reportFailed": "Failed to save report",

  // 옵션
  "options.title": "Options",
  "options.audio": "Audio",
  "options.graphics": "Graphics",
  "options.gameplay": "Gameplay",
  "options.master": "Master Volume",
  "options.sfx": "Sound Effects",
  "options.music": "Background Music",
  "options.shake": "Screen Shake on Hit",
  "options.highContrast": "High Contrast (show unit element)",
  "options.showDamage": "Show Damage Numbers",
  "options.fullscreen": "Fullscreen",
  "options.fullscreenBtn": "Toggle",
  "options.defaultSpeed": "Default Speed",
  "options.autoPause": "Auto-pause when window inactive",
  "options.language": "Language",

  // 일시정지 메뉴
  "pause.title": "Paused",
  "pause.resume": "Continue",
  "pause.save": "Manual Save",
  "pause.load": "Load",
  "pause.options": "Options",
  "pause.toTitle": "To Title",
  "pause.quit": "Quit Game",
} as const;

export type I18nKey = keyof typeof en;
export default en;
