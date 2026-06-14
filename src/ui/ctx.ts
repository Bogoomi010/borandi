import type { Game } from "../core/engine";
import type { BoardRenderer } from "./board";
import type { GameAudio } from "./audio";
import type { Settings } from "./settings";

export type RightTab = "recipe" | "mission" | "boss" | "log";
export type Scene = "title" | "game";

export interface AppCtx {
  game: Game;
  renderer: BoardRenderer;
  audio: GameAudio;
  settings: Settings;
  scene: Scene;
  paused: boolean;
  activeTab: RightTab;
  gradeFilter: string; // "all" | grade
  saveStatus: "idle" | "saving" | "saved" | "failed";
  /** 패널 다시 그리기 요청 */
  refresh: () => void;
  /** 새 게임 시작 (게임 씬으로 전환) */
  newRun: (seed: string, difficulty: "novice" | "normal") => void;
  /** 리플레이로 복원한 게임으로 교체 (불러오기) */
  adoptGame: (game: Game) => void;
  /** 액션 실행 + 효과음 + 실패 사유 토스트 */
  act: (type: string, payload?: Record<string, unknown>) => boolean;
  autosave: () => void;
  /** 정산 단계에서 다음 라운드로 넘어가 웨이브까지 바로 시작 (선택권이 있으면 prepare에서 멈춤) */
  advanceWave: () => void;
  /** 타이틀 화면으로 */
  goTitle: () => void;
  /** autosave 복구 시도. 성공 여부 반환 */
  continueAutosave: () => Promise<boolean>;
}
