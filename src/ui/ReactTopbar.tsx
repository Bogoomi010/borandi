import { getRuntimeControls, type RuntimeSnapshot } from "../runtimeBridge";
import { DIFFICULTY_BY_ID } from "../data/difficulty";
import { stageById } from "../data/stages";
import { BOSS_ROUND_LIST, FINAL_ROUND } from "../data/waves";

interface ReactTopbarProps {
  runtime: RuntimeSnapshot | null;
}

function Stat({
  label,
  value,
  valueClass = "",
  icon,
  onClick,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`stat ${onClick ? "clickable" : ""}`} data-icon={icon} onClick={onClick}>
      <span className="label">{label}</span>
      <span className={`value ${valueClass}`}>{value}</span>
    </div>
  );
}

export function ReactTopbar({ runtime }: ReactTopbarProps) {
  if (!runtime) return null;

  const controls = getRuntimeControls();
  const s = runtime.state;
  const stage = stageById(s.stageId);
  const diff = DIFFICULTY_BY_ID[s.difficulty];
  const nextBoss = BOSS_ROUND_LIST.find((r) => r >= s.round);
  const saveText = {
    idle: "",
    saving: "저장 중...",
    saved: "저장됨",
    failed: "저장 실패",
  }[runtime.saveStatus];

  return (
    <>
      <Stat label="맵" value={`${stage.id}. ${stage.name}`} icon="target" />
      <Stat label="라운드" value={`${Math.min(s.round, FINAL_ROUND)}/${FINAL_ROUND}`} icon="speed" />
      <Stat label="적" value={`${s.enemies.length}/${runtime.enemyLimit}`} valueClass="life" icon="damage" />
      <Stat label="골드" value={String(s.gold)} valueClass="gold" icon="gold" />
      <Stat label="난이도" value={diff.name} icon="attack" />
      {nextBoss !== undefined ? (
        <Stat label="다음 보스" value={`${nextBoss}R (${nextBoss - s.round}라운드 후)`} valueClass="boss" icon="target" />
      ) : null}

      {s.pendingSelectors.length > 0 ? (
        <button className="pill-btn" onClick={() => controls?.openSelector()}>
          선택권 {s.pendingSelectors.length}
        </button>
      ) : null}
      {s.pendingRelicChoices.length > 0 ? (
        <button className="pill-btn" onClick={() => controls?.openRelicChoice()}>
          유물 {s.pendingRelicChoices.length}
        </button>
      ) : null}

      <div className="spacer" />

      <div className="speed-btns">
        {([1, 2, 3] as const).map((speed) => (
          <button
            key={speed}
            className={s.speed === speed ? "active" : ""}
            onClick={() => controls?.act("setSpeed", { speed })}
          >
            x{speed}
          </button>
        ))}
      </div>

      <button className="pill-btn" title={runtime.paused ? "재개" : "일시정지"} onClick={() => controls?.togglePause()}>
        {runtime.paused ? "재개" : "일시정지"}
      </button>

      <span
        id="save-status"
        className={runtime.saveStatus === "failed" ? "failed" : ""}
        onClick={runtime.saveStatus === "failed" ? () => controls?.autosave() : undefined}
      >
        {saveText}
      </span>
    </>
  );
}
