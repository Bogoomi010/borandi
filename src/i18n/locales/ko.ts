// 한국어 사전
import type { I18nKey } from "./en";

const ko: Record<I18nKey, string> = {
  "common.confirm": "확인",
  "common.cancel": "취소",
  "common.close": "닫기",
  "common.on": "켜짐",
  "common.off": "꺼짐",
  "common.language": "언어",

  "menu.game": "게임",
  "menu.view": "보기",
  "menu.tools": "도구",
  "menu.help": "도움말",

  "menu.newRun": "새 게임",
  "menu.restartSeed": "같은 시드 재시작",
  "menu.save": "수동 저장…",
  "menu.save.hint": "슬롯 3개",
  "menu.load": "불러오기…",
  "menu.exportReport": "결과 리포트 내보내기",
  "menu.toTitle": "타이틀로",
  "menu.quit": "게임 종료",

  "menu.toggleRightPanel": "우측 패널 접기/펴기",
  "menu.fullscreen": "전체화면 전환",

  "menu.sim100": "100시드 시뮬레이션…",
  "menu.balanceGate": "5난이도 밸런스 게이트…",
  "menu.manualProof": "수동 밸런스 증거…",
  "menu.openDataDir": "앱 데이터 폴더 열기",

  "menu.shortcuts": "단축키 / 규칙",
  "menu.collection": "도감",
  "menu.options": "옵션",
  "menu.about": "정보",

  "toast.reportSaved": "리포트 저장: {path}",
  "toast.reportFailed": "리포트 저장 실패",

  "options.title": "옵션",
  "options.audio": "오디오",
  "options.graphics": "그래픽",
  "options.gameplay": "게임플레이",
  "options.master": "마스터 볼륨",
  "options.sfx": "효과음",
  "options.music": "배경 음악",
  "options.shake": "피격 화면 흔들림",
  "options.highContrast": "고대비 모드 (유닛 계열 표시)",
  "options.showDamage": "데미지 숫자 표시",
  "options.fullscreen": "전체화면",
  "options.fullscreenBtn": "전환",
  "options.defaultSpeed": "기본 배속",
  "options.autoPause": "창 비활성 시 자동 일시정지",
  "options.language": "언어",

  "pause.title": "일시정지",
  "pause.resume": "계속하기",
  "pause.save": "수동 저장",
  "pause.load": "불러오기",
  "pause.options": "옵션",
  "pause.toTitle": "타이틀로",
  "pause.quit": "게임 종료",
};

export default ko;
