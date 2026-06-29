import type { Locale } from "../i18n";
import type { DifficultyId, Grade, RelicDef, ResultSummary, UnitDef } from "../core/types";
import type { ManualProofFinishReadiness } from "../core/manualProof";
import type { ManualProofCheck } from "../core/manualProofResult";
import type { Settings, Profile } from "../profile/settings";
import type { SlotMeta } from "../save/saveApi";

export interface ReactPauseOverlay {
  id: number;
  kind: "pause";
  onClose?: () => void;
  actions: {
    resume: () => void;
    save: () => void;
    load: () => void;
    options: () => void;
    toTitle: () => void;
    quit: () => void;
  };
}

export interface ReactOptionsOverlay {
  id: number;
  kind: "options";
  settings: Settings;
  actions: {
    apply: () => void;
    setLanguage: (locale: Locale) => void;
    toggleFullscreen: () => void;
  };
}

export interface ReactCollectionUnit {
  unit: UnitDef;
  seen: boolean;
}

export interface ReactCollectionOverlay {
  id: number;
  kind: "collection";
  profile: Profile;
  unitsByGrade: Array<{
    grade: UnitDef["grade"];
    units: ReactCollectionUnit[];
  }>;
  hiddenRecipes: Array<{
    id: string;
    resultUnitId: string;
  }>;
}

export interface ReactNewRunOverlay {
  id: number;
  kind: "newRun";
  dismissable: boolean;
  initialStageId: number;
  actions: {
    start: (difficultyId: DifficultyId, stageId: number) => void;
  };
}

export interface ReactSelectorOverlay {
  id: number;
  kind: "selector";
  grade: Grade;
  source: string;
  candidates: UnitDef[];
  onClose?: () => void;
  actions: {
    pick: (unitId: string) => void;
  };
}

export interface ReactRelicChoiceOverlay {
  id: number;
  kind: "relicChoice";
  source: string;
  candidates: RelicDef[];
  onClose?: () => void;
  actions: {
    pick: (relicId: string) => void;
  };
}

export interface ReactSaveOverlay {
  id: number;
  kind: "save";
  actions: {
    listSlots: () => Promise<SlotMeta[]>;
    save: (slotId: string) => Promise<boolean>;
  };
}

export interface ReactLoadOverlay {
  id: number;
  kind: "load";
  actions: {
    listSlots: () => Promise<SlotMeta[]>;
    load: (slotId: string) => Promise<boolean>;
    delete: (slotId: string) => Promise<void>;
  };
}

export interface ReactUpgradeOverlay {
  id: number;
  kind: "upgrade";
  actions: {
    buy: (upgradeId: string) => boolean;
  };
}

export interface ReactHelpOverlay {
  id: number;
  kind: "help";
}

export interface ReactAboutOverlay {
  id: number;
  kind: "about";
  version: string;
  dataVersion: string;
  runtimeLabel: string;
  canOpenDataDir: boolean;
  actions: {
    openDataDir: () => void;
  };
}

export interface ReactConfirmOverlay {
  id: number;
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  actions: {
    confirm: () => void;
  };
}

export interface ReactSimulationOverlay {
  id: number;
  kind: "simulation";
  actions: {
    run: () => Promise<string>;
    save: (content: string) => Promise<string>;
  };
}

export interface ReactBalanceGateOverlay {
  id: number;
  kind: "balanceGate";
  actions: {
    run: (onProgress: (text: string) => void) => Promise<{ markdown: string; json: string }>;
    saveMarkdown: (markdown: string) => Promise<string>;
    saveJson: (json: string) => Promise<string>;
  };
}

export interface ReactResultCommand {
  label: string;
  text: string;
  okMessage: string;
}

export interface ReactManualProofOverlay {
  id: number;
  kind: "manualProof";
  dataVersion: string;
  intro: {
    className: string;
    text: string;
  };
  currentTarget?: {
    difficulty: string;
    legends: string;
    label: string;
    status: string;
    state: "ok" | "wait" | "warn";
    note: string;
  };
  sections: Array<{
    title: string;
    note?: {
      className: string;
      text: string;
    };
    commands: string[];
  }>;
  workflow: string[];
  resultFields: Array<{
    field: string;
    source: string;
    value: string;
  }>;
  balanceTargets: Array<{
    difficulty: string;
    target: string;
    length: string;
  }>;
  balanceObservations: Array<{
    difficulty: string;
    target: string;
    length: string;
  }>;
  commandGroups: Array<{
    label: string;
    commands: ReactResultCommand[];
  }>;
  finishReadiness?: ManualProofFinishReadiness;
}

export interface ReactResultOverlay {
  id: number;
  kind: "result";
  summary: ResultSummary;
  proofTarget: string;
  proofChecks: ManualProofCheck[];
  manualResultJson: string;
  exportJsonLabel: string;
  copyJsonLabel: string;
  copyJsonOkMessage: string;
  commandGroups: Array<{
    label: string;
    commands: ReactResultCommand[];
  }>;
  actions: {
    exportReport: () => Promise<string>;
    exportJson: () => Promise<string>;
    toTitle: () => void;
    restartSeed: () => void;
    newRun: () => void;
  };
}

export type ReactOverlay =
  | ReactPauseOverlay
  | ReactOptionsOverlay
  | ReactCollectionOverlay
  | ReactNewRunOverlay
  | ReactSelectorOverlay
  | ReactRelicChoiceOverlay
  | ReactSaveOverlay
  | ReactLoadOverlay
  | ReactUpgradeOverlay
  | ReactHelpOverlay
  | ReactAboutOverlay
  | ReactConfirmOverlay
  | ReactSimulationOverlay
  | ReactBalanceGateOverlay
  | ReactManualProofOverlay
  | ReactResultOverlay;
export type ReactOverlayInput =
  | Omit<ReactPauseOverlay, "id">
  | Omit<ReactOptionsOverlay, "id">
  | Omit<ReactCollectionOverlay, "id">
  | Omit<ReactNewRunOverlay, "id">
  | Omit<ReactSelectorOverlay, "id">
  | Omit<ReactRelicChoiceOverlay, "id">
  | Omit<ReactSaveOverlay, "id">
  | Omit<ReactLoadOverlay, "id">
  | Omit<ReactUpgradeOverlay, "id">
  | Omit<ReactHelpOverlay, "id">
  | Omit<ReactAboutOverlay, "id">
  | Omit<ReactConfirmOverlay, "id">
  | Omit<ReactSimulationOverlay, "id">
  | Omit<ReactBalanceGateOverlay, "id">
  | Omit<ReactManualProofOverlay, "id">
  | Omit<ReactResultOverlay, "id">;

let nextId = 1;
let overlays: ReactOverlay[] = [];
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

export function openReactOverlay(overlay: ReactOverlayInput): number {
  const id = nextId++;
  overlays = [...overlays, { ...overlay, id } as ReactOverlay];
  publish();
  return id;
}

export function closeReactOverlay(id: number): boolean {
  const overlay = overlays.find((item) => item.id === id);
  if (!overlay) return false;
  overlays = overlays.filter((item) => item.id !== id);
  publish();
  if ("onClose" in overlay) overlay.onClose?.();
  return true;
}

export function closeTopReactOverlay(): boolean {
  const overlay = overlays[overlays.length - 1];
  if (!overlay) return false;
  return closeReactOverlay(overlay.id);
}

export function clearReactOverlays(): boolean {
  if (overlays.length === 0) return false;
  const closed = overlays;
  overlays = [];
  publish();
  for (let i = closed.length - 1; i >= 0; i -= 1) {
    const overlay = closed[i];
    if ("onClose" in overlay) overlay.onClose?.();
  }
  return true;
}

export function anyReactOverlayOpen(): boolean {
  return overlays.length > 0;
}

export function getReactOverlays(): readonly ReactOverlay[] {
  return overlays;
}

export function subscribeReactOverlays(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
