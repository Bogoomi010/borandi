import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls } from "../runtimeBridge";
import { APP_VERSION, DATA_VERSION } from "../data/version";
import { isTauri, listSlots } from "../save/saveApi";
import { loadProfile } from "../profile/settings";

interface ReactTitleSceneProps {
  runtime: RuntimeSnapshot | null;
}

interface AutosaveState {
  available: boolean;
  round: number | null;
}

export function ReactTitleScene({ runtime }: ReactTitleSceneProps) {
  const controls = getRuntimeControls();
  const [autosave, setAutosave] = useState<AutosaveState>({ available: false, round: null });
  const [loadingContinue, setLoadingContinue] = useState(false);
  const profile = loadProfile();

  useEffect(() => {
    let cancelled = false;
    if (runtime?.scene !== "title") return () => {
      cancelled = true;
    };

    void listSlots()
      .then((slots) => {
        if (cancelled) return;
        const auto = slots.find((slot) => slot.slotId === "autosave");
        setAutosave({
          available: !!auto && auto.dataVersion === DATA_VERSION,
          round: auto && auto.dataVersion === DATA_VERSION ? auto.round : null,
        });
      })
      .catch(() => {
        if (!cancelled) setAutosave({ available: false, round: null });
      });

    return () => {
      cancelled = true;
    };
  }, [runtime?.scene, runtime?.revision]);

  if (!runtime || runtime.scene !== "title") return null;

  return (
    <div className="title-inner">
      <div className="title-logo">
        <div className="title-kicker">RIFT RANDOM DEFENSE</div>
        <h1>
          차원 균열
          <br />
          랜덤 디펜스
        </h1>
        <div className="title-sub">새 게임 시작 전 전체 맵 자유 선택 · 1~40R 고정 진행</div>
      </div>

      <div className="title-menu">
        <button className="title-btn" onClick={() => controls?.menuCommand("newRun")} type="button">
          <span>게임 시작</span>
        </button>
        <button
          className="title-btn"
          disabled={!autosave.available || loadingContinue}
          onClick={() => {
            setLoadingContinue(true);
            void controls?.continueAutosave().finally(() => setLoadingContinue(false));
          }}
          type="button"
        >
          <span>이어하기</span>
          {autosave.round !== null ? <span className="title-btn-hint">{autosave.round}R</span> : null}
        </button>
        <button className="title-btn" onClick={() => controls?.menuCommand("load")} type="button">
          <span>불러오기</span>
        </button>
        <button className="title-btn" onClick={() => controls?.menuCommand("collection")} type="button">
          <span>도감</span>
        </button>
        <button className="title-btn" onClick={() => controls?.menuCommand("options")} type="button">
          <span>옵션</span>
        </button>
        <button className="title-btn" onClick={() => controls?.menuCommand("quit")} type="button">
          <span>종료</span>
        </button>
      </div>

      <div className="title-foot">
        v{APP_VERSION} · data v{DATA_VERSION} · {isTauri() ? "Desktop" : "Web"}
        {profile.runs > 0 ? ` · ${profile.runs}회 · 최고 ${profile.bestRound}R` : ""}
      </div>
    </div>
  );
}
