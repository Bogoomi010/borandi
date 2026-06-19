import { describe, expect, it } from "vitest";
import { MANUAL_PROOF_TARGET_SECONDS, manualProofRemainingSeconds, manualProofTargetFor } from "./manualProof";

describe("수동 증거 목표 표시", () => {
  it("12분 목표 시간을 고정한다", () => {
    expect(MANUAL_PROOF_TARGET_SECONDS).toBe(720);
  });

  it("12분 목표까지 남은 시간을 0 아래로 내리지 않는다", () => {
    expect(manualProofRemainingSeconds(0)).toBe(720);
    expect(manualProofRemainingSeconds(719.9)).toBe(1);
    expect(manualProofRemainingSeconds(720)).toBe(0);
    expect(manualProofRemainingSeconds(900)).toBe(0);
  });

  it("입문자는 전설이 없어야 목표 조건 유지로 표시한다", () => {
    expect(manualProofTargetFor("novice", 0)).toMatchObject({ status: "무전설 유지", state: "ok" });
    expect(manualProofTargetFor("novice", 1)).toMatchObject({ status: "전설 1 - 목표 초과", state: "warn" });
  });

  it("일반은 1~2전설 범위를 목표로 표시한다", () => {
    expect(manualProofTargetFor("normal", 0)).toMatchObject({ status: "전설 1~2 필요", state: "wait" });
    expect(manualProofTargetFor("normal", 2)).toMatchObject({ status: "2전설 유지", state: "ok" });
    expect(manualProofTargetFor("normal", 3)).toMatchObject({ status: "전설 3 - 목표 초과", state: "warn" });
  });

  it("중급자와 고수 조건을 전설 수에 맞춰 구분한다", () => {
    expect(manualProofTargetFor("intermediate", 4)).toMatchObject({ status: "전설 4/5", state: "wait" });
    expect(manualProofTargetFor("intermediate", 5)).toMatchObject({ status: "5전설+ 충족", state: "ok" });
    expect(manualProofTargetFor("expert", 5)).toMatchObject({ label: "고수 5전설 이하 40R 실패", state: "wait" });
    expect(manualProofTargetFor("expert", 6)).toMatchObject({ label: "고수 6전설 이상 40R 클리어", state: "ok" });
  });
});
