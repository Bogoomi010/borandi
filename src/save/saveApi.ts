// 저장 계층: Tauri 환경이면 Rust command(SQLite), 아니면 localStorage fallback.
// 게임 판정 로직은 절대 여기 두지 않는다.

import type { DifficultyId, GameInput, ResultSummary } from "../core/types";
import { SCHEMA_VERSION, APP_VERSION, DATA_VERSION } from "../data/version";

export interface SaveRecord {
  schemaVersion: number;
  appVersion: string;
  dataVersion: string;
  savedAt: string;
  seed: string;
  difficulty: DifficultyId;
  stageId: number;
  stateChecksum: string;
  tick: number;
  round: number;
  life: number;
  maxGrade: string;
  inputHistory: GameInput[];
}

export interface SlotMeta {
  slotId: string; // "autosave" | "slot1" | "slot2" | "slot3"
  savedAt: string;
  seed: string;
  difficulty: string;
  stageId: number;
  round: number;
  life: number;
  maxGrade: string;
  dataVersion: string;
}

// Tauri API는 npm 패키지 대신 withGlobalTauri(window.__TAURI__)를 사용한다.
interface TauriGlobal {
  core: { invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> };
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const g = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__;
  return g.core.invoke<T>(cmd, args);
}

// ---------- localStorage fallback ----------

const LS_PREFIX = "rrd_";

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown) {
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
}

// ---------- 공개 API ----------

export async function saveSlot(slotId: string, record: SaveRecord): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("save_run_snapshot", { slotId, record });
  } else {
    lsSet(`save_${slotId}`, record);
  }
}

export async function loadSlot(slotId: string): Promise<SaveRecord | null> {
  if (isTauri()) {
    return await tauriInvoke<SaveRecord | null>("load_run_snapshot", { slotId });
  }
  return lsGet<SaveRecord>(`save_${slotId}`);
}

export async function listSlots(): Promise<SlotMeta[]> {
  if (isTauri()) {
    return await tauriInvoke<SlotMeta[]>("list_save_slots");
  }
  const out: SlotMeta[] = [];
  for (const slotId of ["autosave", "slot1", "slot2", "slot3"]) {
    const r = lsGet<SaveRecord>(`save_${slotId}`);
    if (r) {
      out.push({
        slotId, savedAt: r.savedAt, seed: r.seed, difficulty: r.difficulty,
        stageId: r.stageId ?? 1, round: r.round, life: r.life, maxGrade: r.maxGrade, dataVersion: r.dataVersion,
      });
    }
  }
  return out;
}

export async function deleteSlot(slotId: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("delete_save_slot", { slotId });
  } else {
    localStorage.removeItem(LS_PREFIX + `save_${slotId}`);
  }
}

export async function recordResult(summary: ResultSummary): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("record_run_result", { summary });
  } else {
    const list = lsGet<ResultSummary[]>("results") ?? [];
    list.unshift(summary);
    lsSet("results", list.slice(0, 20));
  }
}

export async function listResults(): Promise<ResultSummary[]> {
  if (isTauri()) {
    return await tauriInvoke<ResultSummary[]>("list_run_results");
  }
  return lsGet<ResultSummary[]>("results") ?? [];
}

/** 리포트 파일 쓰기. Tauri: 앱 데이터 폴더에 저장하고 경로 반환. 브라우저: 다운로드. */
export async function writeReport(filename: string, content: string): Promise<string> {
  if (isTauri()) {
    return await tauriInvoke<string>("write_run_report", { filename, content });
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function openAppDataDir(): Promise<void> {
  if (isTauri()) await tauriInvoke("open_app_data_dir");
}

export function makeSaveRecord(args: {
  seed: string; difficulty: DifficultyId; stageId: number; stateChecksum: string;
  tick: number; round: number; life: number; maxGrade: string;
  inputHistory: GameInput[];
}): SaveRecord {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    savedAt: new Date().toISOString(),
    ...args,
  };
}
