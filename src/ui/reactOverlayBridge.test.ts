import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearReactOverlays,
  closeReactOverlay,
  getReactOverlays,
  openReactOverlay,
} from "./reactOverlayBridge";

afterEach(() => {
  clearReactOverlays();
});

describe("reactOverlayBridge", () => {
  it("clears overlays through the React overlay store instead of DOM mutation", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();

    openReactOverlay({
      kind: "selector",
      grade: "common",
      source: "test",
      candidates: [],
      onClose: firstClose,
      actions: { pick: vi.fn() },
    });
    openReactOverlay({
      kind: "relicChoice",
      source: "test",
      candidates: [],
      onClose: secondClose,
      actions: { pick: vi.fn() },
    });

    expect(getReactOverlays()).toHaveLength(2);
    expect(clearReactOverlays()).toBe(true);
    expect(getReactOverlays()).toHaveLength(0);
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(firstClose).toHaveBeenCalledTimes(1);
  });

  it("reports false when there is nothing to clear", () => {
    expect(clearReactOverlays()).toBe(false);
  });

  it("keeps single-overlay close behavior intact", () => {
    const onClose = vi.fn();
    const id = openReactOverlay({
      kind: "selector",
      grade: "rare",
      source: "test",
      candidates: [],
      onClose,
      actions: { pick: vi.fn() },
    });

    expect(closeReactOverlay(id)).toBe(true);
    expect(getReactOverlays()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
