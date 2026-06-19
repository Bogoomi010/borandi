import { beforeEach, describe, expect, it } from "vitest";
import { FINAL_ROUND } from "../data/waves";
import { loadProfile, profileRecordRun } from "./settings";

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

  it("클리어 플래그가 있어도 40라운드 전이면 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND - 1, 1);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("선택한 맵의 40라운드 최종 클리어 후 다음 맵을 해금한다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 1);

    expect(unlocked).toBe(true);
    expect(loadProfile().unlockedStage).toBe(2);
  });

  it("40라운드에 도달해도 패배한 판이면 다음 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(false, "novice", FINAL_ROUND, 1);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });

  it("현재 해금된 맵을 건너뛴 클리어로는 뒤쪽 맵을 해금하지 않는다", () => {
    const unlocked = profileRecordRun(true, "novice", FINAL_ROUND, 3);

    expect(unlocked).toBe(false);
    expect(loadProfile().unlockedStage).toBe(1);
  });
});
