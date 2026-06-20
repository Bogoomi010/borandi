import { describe, expect, it } from "vitest";
import {
  manualDryRunCommand,
  manualNextCommand,
  manualNextJsonCommand,
  manualPendingIdCommand,
  manualPlanCommand,
  manualPlanJsonCommand,
  manualPreflightCommand,
  manualPreflightJsonCommand,
  manualSheetCommand,
  manualStartCommand,
  manualStartId,
  manualStartNextCommand,
  manualSummaryCommand,
  manualSummaryJsonCommand,
  shellArg,
} from "./manualProofCommands";

describe("수동 증거 시작 명령", () => {
  const input = {
    difficultyId: "normal" as const,
    stageId: 3,
    seed: "SEED'X",
    startedAt: "2026-06-20T07:30:54.005Z",
    notes: "일반 1~2전설 40R 클리어",
  };

  it("start와 start-next가 같은 id와 startedAt을 사용한다", () => {
    const id = manualStartId(input.difficultyId, input.stageId, input.seed, input.startedAt);
    const start = manualStartCommand(input);
    const startNext = manualStartNextCommand(input);

    expect(start).toContain(`--id=${shellArg(id)}`);
    expect(startNext).toContain(`--id=${shellArg(id)}`);
    expect(start).toContain(`--startedAt=${shellArg(input.startedAt)}`);
    expect(startNext).toContain(`--startedAt=${shellArg(input.startedAt)}`);
    expect(start).toContain(`--seed=${shellArg(input.seed)}`);
    expect(startNext).toContain(`--seed=${shellArg(input.seed)}`);
  });

  it("start-next는 목표 노트를 직접 지정하지 않고 CLI가 다음 목표를 결정하게 한다", () => {
    const startNext = manualStartNextCommand(input);

    expect(startNext).toContain("yarn manual-playlog --start-next");
    expect(startNext).not.toContain("--notes=");
    expect(manualStartCommand(input)).toContain(`--notes=${shellArg(input.notes)}`);
  });

  it("shell 인자 escaping은 숫자 seed 같은 런타임 값도 문자열로 다룬다", () => {
    expect(shellArg(1554)).toBe("'1554'");
  });

  it("pending-id 명령은 같은 시작 id 저장 여부를 확인한다", () => {
    const id = manualStartId(input.difficultyId, input.stageId, input.seed, input.startedAt);
    const pending = manualPendingIdCommand(input);

    expect(pending).toBe(`yarn manual-playlog --pending-id=${shellArg(id)}`);
  });

  it("수동 proof 상태 명령 세트를 제공한다", () => {
    expect(manualPreflightCommand()).toBe("yarn manual-playlog --preflight");
    expect(manualPreflightJsonCommand()).toBe("yarn --silent manual-playlog --preflight-json");
    expect(manualNextCommand()).toBe("yarn manual-playlog --next");
    expect(manualNextJsonCommand()).toBe("yarn --silent manual-playlog --next-json");
    expect(manualSummaryCommand()).toBe("yarn manual-playlog --summary");
    expect(manualSummaryJsonCommand()).toBe("yarn --silent manual-playlog --summary-json");
    expect(manualPlanCommand()).toBe("yarn manual-playlog --plan");
    expect(manualPlanJsonCommand()).toBe("yarn --silent manual-playlog --plan-json");
    expect(manualSheetCommand()).toBe("yarn manual-playlog --sheet");
  });

  it("dry-run 명령은 로그 쓰기 전에 같은 결과 명령을 검증한다", () => {
    const command = "yarn manual-playlog --finish='run-1' --result=clear && yarn manual-playlog --next";

    expect(manualDryRunCommand("yarn manual-playlog --result=loss")).toBe("yarn manual-playlog --result=loss --dry-run");
    expect(manualDryRunCommand(command)).toBe("yarn manual-playlog --finish='run-1' --result=clear --dry-run && yarn manual-playlog --next");
  });
});
