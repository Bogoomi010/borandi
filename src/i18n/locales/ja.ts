// 日本語辞書
import type { I18nKey } from "./en";

const ja: Record<I18nKey, string> = {
  "common.confirm": "決定",
  "common.cancel": "キャンセル",
  "common.close": "閉じる",
  "common.on": "オン",
  "common.off": "オフ",
  "common.language": "言語",

  "menu.game": "ゲーム",
  "menu.view": "表示",
  "menu.tools": "ツール",
  "menu.help": "ヘルプ",

  "menu.newRun": "ニューゲーム",
  "menu.restartSeed": "同じシードで再開",
  "menu.save": "手動セーブ…",
  "menu.save.hint": "スロット3個",
  "menu.load": "ロード…",
  "menu.exportReport": "リザルトレポート出力",
  "menu.toTitle": "タイトルへ",
  "menu.quit": "ゲーム終了",

  "menu.toggleRightPanel": "右パネル開閉",
  "menu.fullscreen": "全画面切替",

  "menu.sim100": "100シードシミュレーション…",
  "menu.balanceGate": "5難易度バランスゲート…",
  "menu.manualProof": "手動バランス検証…",
  "menu.openDataDir": "アプリデータフォルダを開く",

  "menu.shortcuts": "ショートカット / ルール",
  "menu.collection": "図鑑",
  "menu.options": "オプション",
  "menu.about": "情報",

  "toast.reportSaved": "レポート保存: {path}",
  "toast.reportFailed": "レポート保存に失敗しました",

  "options.title": "オプション",
  "options.audio": "オーディオ",
  "options.graphics": "グラフィック",
  "options.gameplay": "ゲームプレイ",
  "options.master": "マスター音量",
  "options.sfx": "効果音",
  "options.music": "BGM",
  "options.shake": "被弾時の画面シェイク",
  "options.highContrast": "高コントラスト（ユニット属性表示）",
  "options.showDamage": "ダメージ数値表示",
  "options.fullscreen": "全画面",
  "options.fullscreenBtn": "切替",
  "options.defaultSpeed": "デフォルト速度",
  "options.autoPause": "ウィンドウ非アクティブ時に自動停止",
  "options.language": "言語",

  "pause.title": "ポーズ",
  "pause.resume": "続ける",
  "pause.save": "手動セーブ",
  "pause.load": "ロード",
  "pause.options": "オプション",
  "pause.toTitle": "タイトルへ",
  "pause.quit": "ゲーム終了",
};

export default ja;
