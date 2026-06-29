import { useEffect, useSyncExternalStore } from "react";
import { getRuntimeControls, getRuntimeSnapshot, subscribeRuntimeSnapshot } from "./runtimeBridge";
import { PixiBoard } from "./ui/PixiBoard";
import { ReactActionbar } from "./ui/ReactActionbar";
import { ReactDpsMeter, ReactRecipeSuggestions, ReactUnitDetail } from "./ui/ReactBoardHud";
import { ReactMenubar } from "./ui/ReactMenubar";
import { ReactModalHost } from "./ui/ReactModalHost";
import { ReactRightPanel } from "./ui/ReactRightPanel";
import { ReactTitleBackground } from "./ui/ReactTitleBackground";
import { ReactTitleScene } from "./ui/ReactTitleScene";
import { ReactTopbar } from "./ui/ReactTopbar";
import { ReactToastHost } from "./ui/ReactToastHost";

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
        <ReactTitleBackground active={activeScene === "title"} />
        <div id="title-content">
          <ReactTitleScene runtime={runtime} />
        </div>
      </div>
      <div id="game-scene" className={`scene${activeScene === "game" ? "" : " hidden"}`}>
        <div id="menubar">
          <ReactMenubar runtime={runtime} />
        </div>
        <div id="topbar">
          <ReactTopbar runtime={runtime} />
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
                  showLabels={runtime.showLabels}
                  showDamage={runtime.showDamage}
                />
              </div>
            ) : null}
            <ReactUnitDetail runtime={runtime} />
            <ReactRecipeSuggestions runtime={runtime} />
            <ReactDpsMeter runtime={runtime} />
          </div>
          <div id="right-panel" className={runtime?.rightPanelCollapsed ? "collapsed" : ""}>
            <ReactRightPanel runtime={runtime} />
          </div>
        </div>
        <div id="actionbar">
          <div id="action-controls">
            <ReactActionbar runtime={runtime} />
          </div>
        </div>
      </div>
      <ReactToastHost />
      <ReactModalHost />
    </div>
  );
}
