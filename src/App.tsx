import { useEffect, useSyncExternalStore } from "react";
import { getRuntimeControls, getRuntimeSnapshot, subscribeRuntimeSnapshot } from "./runtimeBridge";
import { PixiActionbar } from "./ui/PixiActionbar";
import { PixiBoard } from "./ui/PixiBoard";
import { PixiMenubar } from "./ui/PixiMenubar";
import { PixiRightPanel } from "./ui/PixiRightPanel";
import { PixiTitleBackground } from "./ui/PixiTitleBackground";
import { PixiTitleScene } from "./ui/PixiTitleScene";
import { PixiTopbar } from "./ui/PixiTopbar";
import { PixiToastHost } from "./ui/PixiToastHost";
import { PixiModalHost } from "./ui/PixiModalHost";

let gameRuntimeStarted = false;

function startGameRuntime() {
  if (gameRuntimeStarted) return;
  gameRuntimeStarted = true;
  void import("./gameRuntime");
}

export function App() {
  useEffect(() => {
    startGameRuntime();
  }, []);

  useEffect(() => {
    const preventEvents = ["contextmenu", "selectstart", "dragstart", "drop"] as const;
    const preventDefault = (event: Event) => event.preventDefault();
    for (const eventName of preventEvents) {
      window.addEventListener(eventName, preventDefault, { capture: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      getRuntimeControls()?.handleGlobalKeyDown({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        targetTagName: event.target instanceof HTMLElement ? event.target.tagName : undefined,
        preventDefault: () => event.preventDefault(),
      });
    };

    const unlockAudio = () => {
      const controls = getRuntimeControls();
      if (!controls) return;
      controls.unlockAudio();
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };

    const handleWindowBlur = () => {
      getRuntimeControls()?.handleWindowBlur();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      for (const eventName of preventEvents) {
        window.removeEventListener(eventName, preventDefault, { capture: true });
      }
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const runtime = useSyncExternalStore(
    subscribeRuntimeSnapshot,
    getRuntimeSnapshot,
    getRuntimeSnapshot,
  );
  const pixiBoardActive = runtime?.scene === "game";
  const activeScene = runtime?.scene ?? "title";

  return (
    <div id="app" className={pixiBoardActive ? "pixi-board-active" : ""}>
      <div id="title-scene" className={`scene${activeScene === "title" ? "" : " hidden"}`}>
        <PixiTitleBackground active={activeScene === "title"} />
        <div id="title-content">
          <PixiTitleScene runtime={runtime} />
        </div>
      </div>
      <div id="game-scene" className={`scene${activeScene === "game" ? "" : " hidden"}`}>
        <div id="menubar">
          <PixiMenubar runtime={runtime} />
        </div>
        <div id="topbar">
          <PixiTopbar runtime={runtime} />
        </div>
        <div id="middle">
          <div id="board-wrap">
            {runtime ? (
              <div className="pixi-board-layer">
                <PixiBoard
                  revision={runtime.revision}
                  state={runtime.state}
                  selectedUids={runtime.selectedUids}
                  selectBox={runtime.selectBox}
                  attackMoveMode={runtime.attackMoveMode}
                  paused={runtime.paused}
                  dpsVisible={runtime.dpsVisible}
                  showLabels={runtime.showLabels}
                  showDamage={runtime.showDamage}
                />
              </div>
            ) : null}
          </div>
          <div id="right-panel" className={runtime?.rightPanelCollapsed ? "collapsed" : ""}>
            <PixiRightPanel runtime={runtime} />
          </div>
        </div>
        <div id="actionbar">
          <div id="action-controls">
            <PixiActionbar runtime={runtime} />
          </div>
        </div>
      </div>
      <PixiToastHost />
      <PixiModalHost />
    </div>
  );
}
