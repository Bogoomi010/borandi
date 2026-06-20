import { beforeEach, describe, expect, it } from "vitest";
import { FINAL_STAGE } from "../data/stages";
import { FINAL_ROUND } from "../data/waves";
import { Game } from "../core/engine";
import {
  canUnlockNextStage,
  defaultNewRunStageId,
  initialNewRunStageId,
  loadProfile,
  maxSelectableStageId,
  playableStageId,
  profileRecordRun,
} from "./settings";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  length = 0;

  clear(): void {
    this.data.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
    this.length = this.data.size;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
    this.length = this.data.size;
  }
}

describe("프로필 맵 해금", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("해금 조건은 현재 열린 맵의 40라운드 최종 보스 클리어로만 참이다", () => {
    expect(canUnlockNextStage(true, FINAL_ROUND, 1, 1, true)).toBe(true);
    expect(canUnlockNextStage(true, FINAL_ROUND - 1, 1, 1, true)).toBe(false);
    expect(canUnlockNextStage(true, FINAL_ROUND + 1, 1, 1, true)).toBe(false);
    expect(canUnlockNextStage(false, FINAL_ROUND, 1, 1, true)).toBe(false);
    expect(canUnlockNextStage(true, FINAL_ROUND, 1, 1, false)).toBe(false);
    expect(canUnlockNextStage(true, FINAL_ROUND, 2, 1, true)).toBe(false);
    expect(canUnlockNextStage(true, FINAL_ROUND, FINAL_STAGE, FINAL_STAGE, true)).toBe(false);
  });

  it("게임 시작 맵은 현재 선택 권한 안에서만 확정된다", () => {
    expect(maxSelectableStageId(0)).toBe(1);
    expect(maxSelectableStageId(3.9)).toBe(3);
    expect(maxSelectableStageId(999)).toBe(FINAL_STAGE);
    expect(playableStageId(1, 3)).toBe(1);
    expect(playableStageId(3, 3)).toBe(3);
    expect(playableStageId(4, 3)).toBe(3);
    expect(playableStageId(999, FINAL_STAGE)).toBe(FINAL_STAGE);
    expect(playableStageId(0, 1)).toBe(1);
  });

  it("클리어 플래그가 있어도 40라운드 전이면 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND - 1, 1, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("40라운드 이후의 비정상 라운드 값으로는 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND + 1, 1, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("게임 시작 때 선택한 맵의 40라운드 최종 보스 클리어 후 다음 새 게임의 맵 선택 권한만 추가한다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 1, true);

    expect(unlocked).toBe(true);
    expect(loadProfile().unlockedStage).toBe(2);
  });

  it("해금 후에도 현재 판 맵을 바꾸는 값이 아니라 다음 새 게임에서 고를 수 있는 권한만 저장한다", () => {
    expect(profileRecordRun(true, "novice", FINAL_ROUND, 1, true)).toBe(true);

    const profile = loadProfile();
    expect(profile.unlockedStage).toBe(2);
    expect(maxSelectableStageId(profile.unlockedStage)).toBe(2);
    expect(playableStageId(1, profile.unlockedStage)).toBe(1);
    expect(playableStageId(2, profile.unlockedStage)).toBe(2);
  });

  it("맵 선택권이 늘어도 새 게임에서 맵을 고르기 전까지 특정 다음 맵으로 강제되지 않는다", () => {
    expect(profileRecordRun(true, "novice", FINAL_ROUND, 1, true)).toBe(true);
    const profile = loadProfile();

    expect(maxSelectableStageId(profile.unlockedStage)).toBe(2);
    expect(initialNewRunStageId(1, profile.unlockedStage)).toBe(1);
    expect(defaultNewRunStageId(1, profile.unlockedStage)).toBe(1);
    expect(playableStageId(2, profile.unlockedStage)).toBe(2);
  });

  it("40라운드 보스 클리어로 해금해도 현재 게임 객체의 맵은 바뀌지 않는다", () => {
    const game = new Game("MAP-PERMISSION", "novice", 1);
    game.state.cleared = true;
    game.state.round = FINAL_ROUND;
    game.state.bossKillSeconds[FINAL_ROUND] = 12.3;

    const unlocked = profileRecordRun(
      game.state.cleared,
      game.state.difficulty,
      game.state.round,
      game.state.stageId,
      game.state.bossKillSeconds[FINAL_ROUND] !== undefined,
    );

    expect(unlocked).toBe(true);
    expect(game.state.stageId).toBe(1);
    expect(loadProfile().unlockedStage).toBe(2);
  });

  it("새 게임 모달 기본 선택은 새로 해금된 다음 맵으로 자동 이동하지 않는다", () => {
    expect(defaultNewRunStageId(1, 2)).toBe(1);
    expect(defaultNewRunStageId(2, 2)).toBe(2);
    expect(defaultNewRunStageId(7, 3)).toBe(3);
    expect(defaultNewRunStageId(0, 4)).toBe(1);
  });

  it("새 게임 모달은 명시 선호값 없이 현재 선택 맵을 유지한다", () => {
    expect(initialNewRunStageId(1, 2)).toBe(1);
    expect(initialNewRunStageId(2, 2)).toBe(2);
    expect(initialNewRunStageId(3, 2)).toBe(2);
    expect(initialNewRunStageId(0, 2)).toBe(1);
  });

  it("40라운드에 도달해도 패배한 판이면 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(false, "novice", FINAL_ROUND, 1, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("40라운드 클리어 플래그가 있어도 최종 보스 처치 기록이 없으면 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 1, false);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("현재 해금된 맵을 건너뛴 클리어로는 뒤쪽 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 3, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("이미 클리어한 이전 맵을 다시 깨도 다음 다음 맵을 해금하지 않는다", () => {
    expect(profileRecordRun(true, "novice", FINAL_ROUND, 1, true)).toBe(true);

    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 1, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(2);
  });

  it("현재 선택 가능 맵을 새 게임에서 골라 40라운드까지 깨야 순서대로 다음 맵 권한이 추가된다", () => {
    expect(profileRecordRun(true, "novice", FINAL_ROUND, 1, true)).toBe(true);
    expect(profileRecordRun(true, "novice", FINAL_ROUND, 2, true)).toBe(true);

    expect(loadProfile().unlockedStage).toBe(3);
  });

  it("마지막 맵 클리어는 더 이상 해금할 맵이 없다", () => {
    for (let stageId = 1; stageId < FINAL_STAGE; stageId++) {
      expect(profileRecordRun(true, "novice", FINAL_ROUND, stageId, true)).toBe(true);
    }

    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, FINAL_STAGE, true);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(FINAL_STAGE);
  });
});
