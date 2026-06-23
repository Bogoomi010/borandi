// 简体中文词典
import type { I18nKey } from "./en";

const zh: Record<I18nKey, string> = {
  "common.confirm": "确定",
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.on": "开",
  "common.off": "关",
  "common.language": "语言",

  "menu.game": "游戏",
  "menu.view": "视图",
  "menu.tools": "工具",
  "menu.help": "帮助",

  "menu.newRun": "新游戏",
  "menu.restartSeed": "相同种子重开",
  "menu.save": "手动存档…",
  "menu.save.hint": "3个存档位",
  "menu.load": "读取…",
  "menu.exportReport": "导出结算报告",
  "menu.toTitle": "返回标题",
  "menu.quit": "退出游戏",

  "menu.toggleRightPanel": "折叠/展开右侧面板",
  "menu.fullscreen": "切换全屏",

  "menu.sim100": "100种子模拟…",
  "menu.balanceGate": "5难度平衡门…",
  "menu.manualProof": "手动平衡验证…",
  "menu.openDataDir": "打开应用数据文件夹",

  "menu.shortcuts": "快捷键 / 规则",
  "menu.collection": "图鉴",
  "menu.options": "选项",
  "menu.about": "关于",

  "toast.reportSaved": "报告已保存: {path}",
  "toast.reportFailed": "报告保存失败",

  "options.title": "选项",
  "options.audio": "音频",
  "options.graphics": "画面",
  "options.gameplay": "玩法",
  "options.master": "主音量",
  "options.sfx": "音效",
  "options.music": "背景音乐",
  "options.shake": "受击画面震动",
  "options.highContrast": "高对比度（显示单位属性）",
  "options.showDamage": "显示伤害数字",
  "options.fullscreen": "全屏",
  "options.fullscreenBtn": "切换",
  "options.defaultSpeed": "默认速度",
  "options.autoPause": "窗口失焦时自动暂停",
  "options.language": "语言",

  "pause.title": "暂停",
  "pause.resume": "继续",
  "pause.save": "手动存档",
  "pause.load": "读取",
  "pause.options": "选项",
  "pause.toTitle": "返回标题",
  "pause.quit": "退出游戏",
};

export default zh;
