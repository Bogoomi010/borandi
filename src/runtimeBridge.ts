import type { GameState } from "./core/types";
import type { BoardBox } from "./board/boardHitTest";
import type { RightTab } from "./runtimeContext";

export type MenuCommand =
  | "newRun"
  | "restartSeed"
  | "save"
  | "load"
  | "exportReport"
  | "toTitle"
  | "quit"
  | "toggleRightPanel"
  | "fullscreen"
  | "sim100"
  | "balanceGate"
  | "manualProof"
  | "openDataDir"
  | "shortcuts"
  | "collection"
  | "options"
  | "about";

export interface RuntimeSnapshot {
  revision: number;
  scene: "title" | "game";
  paused: boolean;
  saveStatus: "idle" | "saving" | "saved" | "failed";
  enemyLimit: number;
  ownedUnitCount: number;
  unitCap: number;
  dpsVisible: boolean;
  rightPanelCollapsed: boolean;
  activeTab: RightTab;
  missionProgress: Readonly<Record<string, string>>;
  state: GameState;
  selectedUids: ReadonlySet<number>;
  selectBox: BoardBox | null;
  attackMoveMode: boolean;
  showLabels: boolean;
  showDamage: boolean;
}

interface RuntimeSnapshotInput {
  scene: RuntimeSnapshot["scene"];
  paused: boolean;
  saveStatus: RuntimeSnapshot["saveStatus"];
  enemyLimit: number;
  ownedUnitCount: number;
  unitCap: number;
  dpsVisible: boolean;
  rightPanelCollapsed: boolean;
  activeTab: RightTab;
  missionProgress: Record<string, string>;
  state: GameState;
  selectedUids: Iterable<number>;
  selectBox: BoardBox | null;
  attackMoveMode: boolean;
  showLabels: boolean;
  showDamage: boolean;
}

export interface RuntimeControls {
  act: (type: string, payload?: Record<string, unknown>) => boolean;
  autosave: () => void;
  togglePause: () => void;
  clearSelection: () => void;
  confirmSell: (unitIds: number[], refund: number) => void;
  toggleDps: () => void;
  advanceWave: () => void;
  openUpgrade: () => void;
  openManualProofGuide: () => void;
  openSelector: () => void;
  openRelicChoice: () => void;
  setActiveTab: (tab: "mission" | "boss" | "log") => void;
  menuCommand: (command: MenuCommand) => void;
  continueAutosave: () => Promise<boolean>;
  boardPointerDown: (input: BoardPointerInput) => void;
  boardPointerMove: (input: BoardPointerInput) => void;
  boardPointerUp: (input: BoardPointerInput) => void;
  boardPointerCancel: () => void;
  handleGlobalKeyDown: (input: RuntimeKeyInput) => void;
  unlockAudio: () => void;
  handleWindowBlur: () => void;
}

export interface BoardPointerInput {
  x: number;
  y: number;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface RuntimeKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  targetTagName?: string;
  preventDefault: () => void;
}

let revision = 0;
let snapshot: RuntimeSnapshot | null = null;
let controls: RuntimeControls | null = null;
const listeners = new Set<() => void>();

export function publishRuntimeSnapshot(input: RuntimeSnapshotInput) {
  snapshot = {
    revision: ++revision,
    scene: input.scene,
    paused: input.paused,
    saveStatus: input.saveStatus,
    enemyLimit: input.enemyLimit,
    ownedUnitCount: input.ownedUnitCount,
    unitCap: input.unitCap,
    dpsVisible: input.dpsVisible,
    rightPanelCollapsed: input.rightPanelCollapsed,
    activeTab: input.activeTab,
    missionProgress: { ...input.missionProgress },
    state: input.state,
    selectedUids: new Set(input.selectedUids),
    selectBox: input.selectBox ? { ...input.selectBox } : null,
    attackMoveMode: input.attackMoveMode,
    showLabels: input.showLabels,
    showDamage: input.showDamage,
  };

  for (const listener of listeners) listener();
}

export function registerRuntimeControls(nextControls: RuntimeControls) {
  controls = nextControls;
}

export function getRuntimeControls() {
  return controls;
}

export function getRuntimeSnapshot() {
  return snapshot;
}

export function subscribeRuntimeSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
