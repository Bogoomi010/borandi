import type { DifficultyId } from "./types";

export const MANUAL_PROOF_TARGET_SECONDS = 12 * 60;

export function manualProofRemainingSeconds(elapsedSeconds: number): number {
  return Math.max(0, MANUAL_PROOF_TARGET_SECONDS - Math.max(0, Math.floor(elapsedSeconds)));
}

export function manualProofReadyAt(startedAt: string): string | null {
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return null;
  return new Date(startedAtMs + MANUAL_PROOF_TARGET_SECONDS * 1000).toISOString();
}

export interface ManualProofTargetStatus {
  label: string;
  status: string;
  state: "ok" | "wait" | "warn";
}

export function manualProofTargetFor(difficulty: DifficultyId, legendOrBetter: number): ManualProofTargetStatus {
  switch (difficulty) {
    case "novice":
      return legendOrBetter === 0
        ? { label: "입문자 무전설 40R 클리어", status: "무전설 유지", state: "ok" }
        : { label: "입문자 무전설 40R 클리어", status: `전설 ${legendOrBetter} - 목표 초과`, state: "warn" };
    case "normal":
      if (legendOrBetter === 0) return { label: "일반 1~2전설 40R 클리어", status: "전설 1~2 필요", state: "wait" };
      return legendOrBetter <= 2
        ? { label: "일반 1~2전설 40R 클리어", status: `${legendOrBetter}전설 유지`, state: "ok" }
        : { label: "일반 1~2전설 40R 클리어", status: `전설 ${legendOrBetter} - 목표 초과`, state: "warn" };
    case "intermediate":
      return legendOrBetter >= 5
        ? { label: "중급자 5전설 이상 40R 클리어", status: "5전설+ 충족", state: "ok" }
        : { label: "중급자 5전설 이상 40R 클리어", status: `전설 ${legendOrBetter}/5`, state: "wait" };
    case "expert":
      return legendOrBetter <= 5
        ? { label: "고수 5전설 이하 실패", status: "5전설 이하 실패 목표", state: "wait" }
        : { label: "고수 6전설 이상 40R 클리어", status: "6전설+ 클리어 목표", state: "ok" };
    case "master":
      return { label: "초고수 실패 기록", status: "실패 기록 목표", state: "wait" };
  }
}
