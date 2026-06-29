import type { RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls } from "../runtimeBridge";
import { SUMMON_COST, SELL_REFUND } from "../data/difficulty";
import { UNIT_BY_ID } from "../data/units";
import { FINAL_ROUND, waveForRound } from "../data/waves";

interface ReactActionbarProps {
  runtime: RuntimeSnapshot | null;
}

interface ActionButtonProps {
  label: string;
  sub?: string;
  icon?: string;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  title?: string;
  onClick: () => void;
}

function ActionButton({
  label,
  sub = "",
  icon,
  disabled,
  primary,
  danger,
  title,
  onClick,
}: ActionButtonProps) {
  const className = [
    "action-btn",
    primary ? "primary" : "",
    danger ? "danger" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      className={className}
      disabled={disabled}
      title={title || `${label}${sub ? ` · ${sub}` : ""}`}
      onClick={onClick}
      type="button"
    >
      {icon ? <span className={`ui-icon icon-${icon}`} /> : null}
      <span className="alabel">{label}</span>
      <span className="sub">{sub}</span>
    </button>
  );
}

function phaseLabel(runtime: RuntimeSnapshot) {
  const s = runtime.state;
  const ended = s.phase === "ended";
  const inBreak = s.breakTicks > 0;
  const alive = s.enemies.length;
  const limit = runtime.enemyLimit;

  if (ended) return s.cleared ? "클리어" : "게임 종료";
  if (inBreak) return `${s.round}라운드 대기 중 · ${alive}/${limit}`;
  return `${s.round}라운드 진행 중 · ${alive}/${limit}`;
}

function nextWaveSub(runtime: RuntimeSnapshot) {
  const s = runtime.state;
  if (s.pendingRelicChoices.length > 0) return "유물 선택 대기";
  if (s.pendingSelectors.length > 0) return "선택권 확인";

  const wave = waveForRound(Math.min(s.round, FINAL_ROUND));
  return wave.type === "boss" ? "보스 라운드" : `${wave.enemyName} x${wave.count}`;
}

export function ReactActionbar({ runtime }: ReactActionbarProps) {
  if (!runtime || runtime.scene !== "game") return null;

  const controls = getRuntimeControls();
  const s = runtime.state;
  const ended = s.phase === "ended";
  const selectedIds = [...runtime.selectedUids];
  const canMergeCount = selectedIds.length === 3;
  const inBreak = s.breakTicks > 0;

  let refund = 0;
  for (const uid of selectedIds) {
    const unit = s.units.find((candidate) => candidate.uid === uid);
    if (unit) refund += SELL_REFUND[UNIT_BY_ID[unit.defId].grade];
  }

  const relicSub = s.pendingRelicChoices.length > 0
    ? `${s.pendingRelicChoices.length}개 선택 대기`
    : s.relicIds.length > 0
      ? `${s.relicIds.length}개 보유`
      : "보스 보상";

  return (
    <>
      <ActionButton
        label="소환 [Z]"
        sub={`${SUMMON_COST}골드`}
        disabled={ended || s.gold < SUMMON_COST || runtime.ownedUnitCount >= runtime.unitCap}
        title={runtime.ownedUnitCount >= runtime.unitCap ? "보유 유닛 수가 가득 찼습니다." : undefined}
        icon="summon"
        onClick={() => controls?.act("summon")}
      />
      <ActionButton
        label="3합성 [X]"
        sub={canMergeCount ? "선택 3기 합성" : `${selectedIds.length}/3 선택`}
        disabled={ended || !canMergeCount}
        title="같은 등급 3기를 선택하세요."
        icon="merge"
        onClick={() => {
          if (!controls?.act("merge3", { unitIds: selectedIds })) return;
          controls.clearSelection();
        }}
      />
      <ActionButton
        label="판매 [Del]"
        sub={selectedIds.length > 0 ? `${selectedIds.length}기 +${refund}G` : "유닛 선택"}
        disabled={ended || selectedIds.length === 0}
        danger
        icon="sell"
        onClick={() => controls?.confirmSell(selectedIds, refund)}
      />
      <ActionButton
        label="업그레이드"
        sub="계열 강화"
        disabled={ended}
        icon="upgrade"
        onClick={() => controls?.openUpgrade()}
      />
      <ActionButton
        label="유물"
        sub={relicSub}
        disabled={ended || (s.pendingRelicChoices.length === 0 && s.relicIds.length === 0)}
        icon="passive"
        onClick={() => {
          if (s.pendingRelicChoices.length > 0) controls?.openRelicChoice();
          else controls?.setActiveTab("boss");
        }}
      />
      <ActionButton
        label="수동증거"
        sub="시작마커/목표"
        disabled={ended}
        onClick={() => controls?.openManualProofGuide()}
      />
      <ActionButton
        label="DPS [V]"
        sub={runtime.dpsVisible ? "켜짐" : "꺼짐"}
        primary={runtime.dpsVisible}
        icon="damage"
        onClick={() => controls?.toggleDps()}
      />

      <div className="gap" />
      <div id="phase-label">{phaseLabel(runtime)}</div>

      {inBreak && !ended ? (
        <ActionButton
          label={`${s.round}라운드 시작 [Space]`}
          sub={nextWaveSub(runtime)}
          primary
          icon="skill"
          onClick={() => {
            if (s.pendingRelicChoices.length > 0) controls?.openRelicChoice();
            else if (s.pendingSelectors.length > 0) controls?.openSelector();
            else controls?.advanceWave();
          }}
        />
      ) : null}
    </>
  );
}
