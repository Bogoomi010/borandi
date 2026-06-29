import type { GameState, MissionState } from "../core/types";
import type { RuntimeSnapshot } from "../runtimeBridge";
import { bossOutlook } from "../core/advisor";
import { GRADE_LABEL } from "../core/types";
import { MISSION_BY_ID } from "../data/missions";
import { RELIC_BY_ID } from "../data/relics";
import { getRuntimeControls } from "../runtimeBridge";
import type { RightTab } from "../runtimeContext";

interface ReactRightPanelProps {
  runtime: RuntimeSnapshot | null;
}

const TABS: Array<{ id: RightTab; label: string }> = [
  { id: "mission", label: "미션" },
  { id: "boss", label: "보스" },
  { id: "log", label: "로그" },
];

function missionBadge(state: GameState) {
  return state.missions.some((mission) => {
    if (mission.status !== "active") return false;
    const def = MISSION_BY_ID[mission.defId];
    return def.visibility === "visible" && def.expireRound !== undefined && def.expireRound - state.round <= 2;
  });
}

function bossBadge(state: GameState) {
  const outlook = bossOutlook(state);
  return !!outlook && outlook.roundsLeft <= 2;
}

function missionRewardText(mission: MissionState) {
  const def = MISSION_BY_ID[mission.defId];
  const rewards: string[] = [];
  if (def.reward.gold) rewards.push(`${def.reward.gold}골드`);
  if (def.reward.selector) rewards.push(`${GRADE_LABEL[def.reward.selector.grade]} 선택권`);
  if (def.reward.bossSlowResistReduction) rewards.push("보스 감속 저항 감소");
  if (def.reward.bossKillBonusGold) rewards.push(`보스 보너스 ${def.reward.bossKillBonusGold.gold}골드`);
  return rewards.join(", ");
}

function MissionTab({ runtime }: { runtime: RuntimeSnapshot }) {
  const order = { active: 0, done: 1, expired: 2 } as const;
  const missions = [...runtime.state.missions].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      {missions.map((mission) => {
        const def = MISSION_BY_ID[mission.defId];
        if (def.visibility === "hidden" && mission.status !== "done") return null;

        const statusLabel = mission.status === "done"
          ? "완료"
          : mission.status === "expired"
            ? "만료"
            : def.expireRound !== undefined ? `~${def.expireRound}R` : "";
        const name = mission.status === "done" && def.visibility === "hidden"
          ? `[히든] ${def.desc.replace("(히든) ", "")}`
          : def.name;

        return (
          <div
            className={`mission-item ${mission.status === "done" ? "done" : mission.status === "expired" ? "expired" : "active"}`}
            key={mission.defId}
          >
            <div className="head">
              <span className="mname">{name}</span>
              <span className="badge">{statusLabel}</span>
            </div>
            <div className="cond">{def.desc}</div>
            {mission.status === "active" ? (
              <div className="prog">진행: {runtime.missionProgress[mission.defId] ?? ""}</div>
            ) : null}
            <div className="rew">보상: {missionRewardText(mission)}</div>
          </div>
        );
      })}
    </>
  );
}

function InfoRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

function BossTab({ runtime }: { runtime: RuntimeSnapshot }) {
  const state = runtime.state;
  const outlook = bossOutlook(state);
  const controls = getRuntimeControls();

  return (
    <div className="boss-info">
      {!outlook ? (
        <div>남은 보스가 없습니다.</div>
      ) : (
        <>
          <InfoRow label="다음 보스" value={`${outlook.name} (${outlook.round}R)`} />
          <InfoRow label="남은 라운드" value={String(outlook.roundsLeft)} />
          <InfoRow label="약점" value={outlook.weakness} />
          <InfoRow
            label="예상 위험도"
            value={outlook.riskText}
            className={outlook.risk === "ok" ? "risk-ok" : outlook.risk === "warn" ? "risk-warn" : "risk-bad"}
          />
          <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4 }}>{outlook.hint}</div>
        </>
      )}

      {Object.entries(state.bossKillSeconds).length > 0 ? (
        <>
          <div className="panel-title">보스 처치 기록</div>
          {Object.entries(state.bossKillSeconds).map(([round, seconds]) => (
            <InfoRow key={round} label={`${round}R`} value={`${seconds}초`} />
          ))}
        </>
      ) : null}

      {state.relicIds.length > 0 || state.pendingRelicChoices.length > 0 ? (
        <>
          <div className="panel-title">보유 유물</div>
          {state.relicIds.length === 0 ? <div className="meta">아직 선택한 유물이 없습니다.</div> : null}
          {state.relicIds.map((id) => {
            const relic = RELIC_BY_ID[id];
            if (!relic) return null;
            const mark = relic.theme === "prism" ? "◆" : relic.theme === "guard" ? "◆" : "◆";
            return (
              <div className={`relic-row relic-${relic.rarity}`} key={id}>
                <span className="relic-mark">{mark}</span>
                <span>
                  <strong>{relic.name}</strong>
                  <small>{relic.desc}</small>
                </span>
              </div>
            );
          })}
          {state.pendingRelicChoices.length > 0 ? (
            <button className="craft-btn" onClick={() => controls?.openRelicChoice()} type="button">
              유물 선택 {state.pendingRelicChoices.length}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function LogTab({ runtime }: { runtime: RuntimeSnapshot }) {
  const log = runtime.state.log.slice(-60);

  return (
    <div className="log-list">
      {log.map((event, index) => {
        const className = event.kind === "reward" || event.kind === "mission"
          ? "evt-gold"
          : event.kind === "boss"
            ? "evt-danger"
            : event.kind === "craft" || event.kind === "merge" ? "evt-ok" : "";
        return (
          <div className={className} key={`${event.round}-${event.kind}-${index}`}>
            [{event.round}R] {event.text}
          </div>
        );
      })}
    </div>
  );
}

export function ReactRightPanel({ runtime }: ReactRightPanelProps) {
  if (!runtime || runtime.scene !== "game") return null;

  const state = runtime.state;
  const controls = getRuntimeControls();
  const badges: Record<RightTab, boolean> = {
    mission: missionBadge(state),
    boss: bossBadge(state),
    log: false,
  };

  return (
    <>
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            className={runtime.activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => controls?.setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {badges[tab.id] ? <span className="dot" /> : null}
          </button>
        ))}
      </div>
      {runtime.activeTab === "mission" ? <MissionTab runtime={runtime} /> : null}
      {runtime.activeTab === "boss" ? <BossTab runtime={runtime} /> : null}
      {runtime.activeTab === "log" ? <LogTab runtime={runtime} /> : null}
    </>
  );
}
