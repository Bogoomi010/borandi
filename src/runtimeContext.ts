import type { Game } from "./core/engine";
import type { DifficultyId } from "./core/types";
import type { GameAudio } from "./audio/gameAudio";
import type { BoardBox } from "./board/boardHitTest";
import type { Settings } from "./profile/settings";

export type RightTab = "mission" | "boss" | "log";
export type Scene = "title" | "game";

export interface BoardUiState {
  selectedUids: Set<number>;
  selectBox: BoardBox | null;
  attackMoveMode: boolean;
  autoStartIn: number | null;
  showLabels: boolean;
  showDamage: boolean;
}

export interface AppCtx {
  game: Game;
  boardUi: BoardUiState;
  audio: GameAudio;
  settings: Settings;
  scene: Scene;
  paused: boolean;
  activeTab: RightTab;
  saveStatus: "idle" | "saving" | "saved" | "failed";
  runStartedAt: string;
  runStartedAtMs: number;
  runEndedAt: string | null;
  runEndedAtMs: number | null;
  lastRunUnlockedNext: boolean;
  refresh: () => void;
  newRun: (seed: string, difficulty: DifficultyId, stageId?: number) => void;
  adoptGame: (game: Game) => void;
  act: (type: string, payload?: Record<string, unknown>) => boolean;
  autosave: () => void;
  advanceWave: () => void;
  goTitle: () => void;
  continueAutosave: () => Promise<boolean>;
}
