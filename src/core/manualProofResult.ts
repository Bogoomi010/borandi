import type { ResultSummary } from "./types";
import { FINAL_ROUND } from "../data/waves";

export interface ManualProofCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export function manualProofResultTarget(r: ResultSummary): string {
  const targetLength = (r.wallSeconds ?? 0) >= 12 * 60;
  const finalRound = r.reachedRound >= FINAL_ROUND;
  if (!targetLength) return "12분 이상 진행된 판만 수동 목표 증거로 인정됩니다.";
  if (r.difficultyId === "novice" && r.cleared && finalRound && r.legendOrBetterCount === 0) {
    return "입문자 무전설 40R 클리어 증거";
  }
  if (r.difficultyId === "normal" && r.cleared && finalRound && r.legendOrBetterCount >= 1 && r.legendOrBetterCount <= 2) {
    return "일반 1~2전설 40R 클리어 증거";
  }
  if (r.difficultyId === "intermediate" && r.cleared && finalRound && r.legendOrBetterCount >= 5) {
    return "중급자 5전설 이상 40R 클리어 증거";
  }
  if (r.difficultyId === "expert" && !r.cleared && finalRound && r.legendOrBetterCount <= 5) {
    return "고수 5전설 이하 40R 실패 증거";
  }
  if (r.difficultyId === "expert" && r.cleared && finalRound && r.legendOrBetterCount >= 6) {
    return "고수 6전설 이상 40R 클리어 증거";
  }
  if (r.difficultyId === "master" && !r.cleared) {
    return "초고수 실패 기록 증거";
  }
  return "수동 플레이 시간에는 포함되지만 목표 결과 증거 조건과는 다릅니다.";
}

export function manualProofResultLogNote(r: ResultSummary): string {
  const result = r.cleared ? "clear" : "loss";
  return `${manualProofResultTarget(r)} · ${r.difficulty} ${result}, ${r.legendOrBetterCount}전설 이상`;
}

export function manualProofResultChecklist(r: ResultSummary): ManualProofCheck[] {
  const playedMinutes = (r.wallSeconds ?? 0) / 60;
  const finalRound = r.reachedRound >= FINAL_ROUND;
  const result = r.cleared ? "클리어" : "패배";
  const checks: ManualProofCheck[] = [
    {
      label: "12분 이상 실제 플레이",
      ok: (r.wallSeconds ?? 0) >= 12 * 60,
      detail: `${playedMinutes.toFixed(1)}분`,
    },
  ];
  if (r.difficultyId !== "master") {
    checks.push({
      label: "40R 최종 보스 구간",
      ok: finalRound,
      detail: `${r.reachedRound}R`,
    });
  }
  switch (r.difficultyId) {
    case "novice":
      checks.push(
        { label: "입문자 결과", ok: r.cleared && finalRound, detail: result },
        { label: "전설 없이 진행", ok: r.legendOrBetterCount === 0, detail: `${r.legendOrBetterCount}전설+` },
      );
      break;
    case "normal":
      checks.push(
        { label: "일반 결과", ok: r.cleared && finalRound, detail: result },
        { label: "전설 1~2개", ok: r.legendOrBetterCount >= 1 && r.legendOrBetterCount <= 2, detail: `${r.legendOrBetterCount}전설+` },
      );
      break;
    case "intermediate":
      checks.push(
        { label: "중급자 결과", ok: r.cleared && finalRound, detail: result },
        { label: "전설 5개 이상", ok: r.legendOrBetterCount >= 5, detail: `${r.legendOrBetterCount}전설+` },
      );
      break;
    case "expert":
      if (r.legendOrBetterCount <= 5) {
        checks.push({ label: "고수 5전설 이하 40R 실패", ok: !r.cleared && finalRound, detail: `${result}, ${r.legendOrBetterCount}전설+` });
      } else {
        checks.push({ label: "고수 6전설 이상 40R 클리어", ok: r.cleared && finalRound, detail: `${result}, ${r.legendOrBetterCount}전설+` });
      }
      break;
    case "master":
      checks.push(
        { label: "초고수 실패 기록", ok: !r.cleared, detail: result },
      );
      break;
  }
  return checks;
}
