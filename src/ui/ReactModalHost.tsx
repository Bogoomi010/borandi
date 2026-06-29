import { Fragment, useEffect, useReducer, useState, useSyncExternalStore, type ReactNode } from "react";
import { FAMILY_LABEL, GRADE_LABEL, ROLE_LABEL, type Grade } from "../core/types";
import { LOCALES, getLocale, onLocaleChange, t } from "../i18n";
import { DIFFICULTIES } from "../data/difficulty";
import { FINAL_STAGE, STAGES, stageById } from "../data/stages";
import { RECIPES } from "../data/recipes";
import { UNITS } from "../data/units";
import { UPGRADES, upgradeCost } from "../data/upgrades";
import type { SlotMeta } from "../save/saveApi";
import { getRuntimeSnapshot, subscribeRuntimeSnapshot } from "../runtimeBridge";
import { FAMILY_COLOR, GRADE_COLOR } from "./boardPalette";
import {
  closeReactOverlay,
  closeTopReactOverlay,
  getReactOverlays,
  subscribeReactOverlays,
  type ReactCollectionOverlay,
  type ReactAboutOverlay,
  type ReactBalanceGateOverlay,
  type ReactConfirmOverlay,
  type ReactHelpOverlay,
  type ReactManualProofOverlay,
  type ReactNewRunOverlay,
  type ReactOptionsOverlay,
  type ReactOverlay,
  type ReactPauseOverlay,
  type ReactRelicChoiceOverlay,
  type ReactResultOverlay,
  type ReactUpgradeOverlay,
  type ReactLoadOverlay,
  type ReactSaveOverlay,
  type ReactSelectorOverlay,
  type ReactSimulationOverlay,
} from "./reactOverlayBridge";
import { pushReactToast } from "./reactToastBridge";

function ModalFrame({ overlay, children }: { overlay: ReactOverlay; children: ReactNode }) {
  const overlays = useSyncExternalStore(subscribeReactOverlays, getReactOverlays, getReactOverlays);
  const top = overlays[overlays.length - 1];
  const isTop = top?.id === overlay.id;
  const dismissable = overlay.kind === "newRun"
    ? overlay.dismissable
    : overlay.kind !== "selector" && overlay.kind !== "relicChoice" && overlay.kind !== "result";

  const skinClass = overlay.kind === "options"
    ? "modal--settings"
    : overlay.kind === "selector" || overlay.kind === "relicChoice"
      ? "modal--reward"
      : "modal--panel";
  const classes = [
    "modal",
    skinClass,
    overlay.kind === "pause" ? "pause-menu" : "",
    overlay.kind === "collection" ? "collection" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (dismissable && event.target === event.currentTarget && isTop) closeReactOverlay(overlay.id);
      }}
    >
      <div className={classes}>
        {children}
      </div>
    </div>
  );
}

function ReactSelectorModal({ overlay }: { overlay: ReactSelectorOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>🎁 {GRADE_LABEL[overlay.grade as Grade]} 선택권</h2>
      <h3>출처: {overlay.source} · 1기를 선택하세요</h3>
      <div className="choice-grid">
        {overlay.candidates.map((unit) => (
          <button
            className="choice-btn"
            key={unit.id}
            onClick={() => {
              closeReactOverlay(overlay.id);
              overlay.actions.pick(unit.id);
            }}
            type="button"
          >
            <span
              style={{
                width: 26,
                height: 26,
                background: FAMILY_COLOR[unit.family],
                border: `3px solid ${GRADE_COLOR[unit.grade]}`,
                borderRadius: 6,
                display: "inline-block",
              }}
            />
            <span className="cname">{unit.name}</span>
            <span className="cdesc">
              {FAMILY_LABEL[unit.family]} · {unit.roles.map((role) => ROLE_LABEL[role]).join("/")}
              {"\n"}공격 {unit.attack} · 속도 {unit.attackSpeed}
            </span>
            {unit.desc ? <span className="cdesc">{unit.desc}</span> : null}
          </button>
        ))}
      </div>
      <div className="row-btns">
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">나중에 선택</button>
      </div>
    </ModalFrame>
  );
}

const RELIC_RARITY_LABEL = {
  rare: "희귀",
  epic: "영웅",
  legend: "전설",
} as const;

function relicMark(theme: string): string {
  if (theme === "prism") return "◇";
  if (theme === "guard") return "◆";
  return "✦";
}

function ReactRelicChoiceModal({ overlay }: { overlay: ReactRelicChoiceOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>보스 유물 선택</h2>
      <div className="modal-note">{overlay.source} · 이번 런 동안 유지되는 유물 1개를 고르세요.</div>
      <div className="choice-grid relic-choice-grid">
        {overlay.candidates.map((relic) => (
          <button
            className={`choice-btn relic-card relic-${relic.rarity}`}
            key={relic.id}
            onClick={() => {
              closeReactOverlay(overlay.id);
              overlay.actions.pick(relic.id);
            }}
            type="button"
          >
            <span className="relic-mark">{relicMark(relic.theme)}</span>
            <span className="cname">{relic.name}</span>
            <span className="badge">{RELIC_RARITY_LABEL[relic.rarity]}</span>
            <span className="cdesc">{relic.desc}</span>
          </button>
        ))}
      </div>
      <div className="row-btns">
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">나중에 선택</button>
      </div>
    </ModalFrame>
  );
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString();
}

function SlotMetaText({ meta, includeLife }: { meta: SlotMeta; includeLife?: boolean }) {
  const stage = stageById(meta.stageId ?? 1);
  return (
    <div className="meta">
      {stage.name} · {meta.round}R
      {includeLife ? ` · 라이프 ${meta.life}` : ""} · {meta.difficulty} · 시드 {meta.seed}
      {includeLife ? ` · v${meta.dataVersion}` : ""} · {formatSavedAt(meta.savedAt)}
    </div>
  );
}

function useSlots(listSlots: () => Promise<SlotMeta[]>) {
  const [slots, setSlots] = useState<SlotMeta[] | null>(null);
  const [error, setError] = useState(false);

  const reload = () => {
    setError(false);
    void listSlots()
      .then((next) => setSlots(next))
      .catch(() => {
        setSlots([]);
        setError(true);
      });
  };

  useEffect(() => {
    reload();
  }, [listSlots]);

  return { slots, error, reload };
}

function ReactSaveModal({ overlay }: { overlay: ReactSaveOverlay }) {
  const { slots, error } = useSlots(overlay.actions.listSlots);

  return (
    <ModalFrame overlay={overlay}>
      <h2>수동 저장</h2>
      {slots === null ? <div className="meta">슬롯을 읽는 중입니다.</div> : null}
      {error ? <div className="result-hint">슬롯 목록을 읽지 못했습니다.</div> : null}
      {["slot1", "slot2", "slot3"].map((slotId) => {
        const meta = slots?.find((item) => item.slotId === slotId);
        return (
          <button
            className="slot-card"
            key={slotId}
            onClick={async () => {
              if (await overlay.actions.save(slotId)) closeReactOverlay(overlay.id);
            }}
            type="button"
          >
            <span>
              <span>슬롯 {slotId.slice(-1)}</span>
              {meta ? <SlotMetaText meta={meta} /> : <span className="meta">비어 있음</span>}
            </span>
          </button>
        );
      })}
      <div className="row-btns">
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">닫기</button>
      </div>
    </ModalFrame>
  );
}

function LoadSlotCard({
  meta,
  onLoad,
  onDelete,
}: {
  meta: SlotMeta;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="slot-card" onClick={onLoad} role="button" tabIndex={0}>
      <span>
        <span>{meta.slotId === "autosave" ? "자동 저장" : `슬롯 ${meta.slotId.slice(-1)}`}</span>
        <SlotMetaText includeLife meta={meta} />
      </span>
      <button
        className="del"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        type="button"
      >
        삭제
      </button>
    </div>
  );
}

function ReactLoadModal({ overlay }: { overlay: ReactLoadOverlay }) {
  const { slots, error, reload } = useSlots(overlay.actions.listSlots);
  const autosave = slots?.find((slot) => slot.slotId === "autosave");
  const manual = slots?.filter((slot) => slot.slotId !== "autosave") ?? [];

  const loadSlot = async (slotId: string) => {
    if (await overlay.actions.load(slotId)) closeReactOverlay(overlay.id);
  };

  const deleteSlot = async (slotId: string) => {
    await overlay.actions.delete(slotId);
    reload();
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>불러오기</h2>
      {slots === null ? <div className="meta">슬롯을 읽는 중입니다.</div> : null}
      {error ? <div className="result-hint">슬롯 목록을 읽지 못했습니다.</div> : null}
      {slots && slots.length === 0 ? <div>저장된 슬롯이 없습니다.</div> : null}

      {autosave ? (
        <>
          <h3>자동 저장</h3>
          <LoadSlotCard
            meta={autosave}
            onDelete={() => void deleteSlot(autosave.slotId)}
            onLoad={() => void loadSlot(autosave.slotId)}
          />
        </>
      ) : null}

      {manual.length > 0 ? (
        <>
          <h3>수동 슬롯</h3>
          {manual.map((meta) => (
            <LoadSlotCard
              key={meta.slotId}
              meta={meta}
              onDelete={() => void deleteSlot(meta.slotId)}
              onLoad={() => void loadSlot(meta.slotId)}
            />
          ))}
        </>
      ) : null}

      <div className="row-btns">
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">닫기</button>
      </div>
    </ModalFrame>
  );
}

const MANUAL_TARGET_HINTS: Record<string, string> = {
  novice: "무전설 40R 클리어",
  normal: "1~2전설 40R 클리어 / 무전설 경계 확인",
  intermediate: "5전설 이상 40R 클리어 / 2전설 경계 확인",
  expert: "5전설 이하 실패 / 6전설 이상 40R 클리어 / 제한 없음 성장 확인",
  master: "실패 기록 / 추가 실패 확인",
};

function stageMinimapUrl(stageId: number): string {
  return `/stage-minimaps/stage-${String(stageId).padStart(2, "0")}.svg`;
}

function ReactNewRunModal({ overlay }: { overlay: ReactNewRunOverlay }) {
  const [difficultyId, setDifficultyId] = useState(DIFFICULTIES[0]?.id ?? "novice");
  const [stageId, setStageId] = useState(overlay.initialStageId);

  return (
    <ModalFrame overlay={overlay}>
      <h2>새 게임</h2>

      <h3>난이도</h3>
      <div className="choice-grid difficulty-choice-grid">
        {DIFFICULTIES.map((difficulty) => (
          <button
            className={`choice-btn difficulty-choice ${difficulty.id === difficultyId ? "selected" : ""}`}
            key={difficulty.id}
            onClick={() => setDifficultyId(difficulty.id)}
            type="button"
          >
            <span className="cname">{difficulty.name}</span>
            <span className="difficulty-tooltip">
              <span className="tooltip-title">{difficulty.name} 난이도</span>
              <span>수동 목표: {MANUAL_TARGET_HINTS[difficulty.id] ?? "-"}</span>
              <span>
                보유 {difficulty.unitCap}기 · 적 체력 x{difficulty.enemyHpMult} ·
                누적 {difficulty.enemyLimit} · 시작 {difficulty.startGold}골드
              </span>
            </span>
          </button>
        ))}
      </div>

      <h3>이번 런 고정 맵 선택</h3>
      <div className="modal-note map-rule-note">
        전체 {STAGES.length}개 맵을 자유롭게 선택할 수 있습니다. 선택한 맵 하나로 1R부터 40R 최종 보스까지 진행합니다.
      </div>
      <div className="stage-card-grid">
        {STAGES.map((stage) => (
          <button
            className={`stage-card ${stage.id === stageId ? "selected" : ""}`}
            key={stage.id}
            onClick={() => setStageId(stage.id)}
            type="button"
          >
            <img className="stage-thumb" src={stageMinimapUrl(stage.id)} alt={`${stage.name} 미니맵`} loading="lazy" />
            <span className="stage-card-body">
              <span className="stage-card-no">STAGE {stage.id}</span>
              <span className="stage-card-name">{stage.name}</span>
              <span className="stage-card-sub">{stage.subtitle}</span>
            </span>
            <span className="stage-card-check">✓</span>
          </button>
        ))}
      </div>
      <div className="result-hint">
        스테이지 진행 중 맵 전환은 없습니다. 새 게임 시작 때 선택한 맵 하나가 이번 런의 전체 40라운드 맵입니다.
      </div>

      <div className="row-btns">
        {overlay.dismissable ? (
          <button onClick={() => closeReactOverlay(overlay.id)} type="button">취소</button>
        ) : null}
        <button
          className="primary"
          onClick={() => {
            closeReactOverlay(overlay.id);
            overlay.actions.start(difficultyId, stageId);
          }}
          type="button"
        >
          시작
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactPauseModal({ overlay }: { overlay: ReactPauseOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>{t("pause.title")}</h2>
      <button className="title-btn" onClick={overlay.actions.resume} type="button">{t("pause.resume")}</button>
      <button className="title-btn" onClick={overlay.actions.save} type="button">{t("pause.save")}</button>
      <button className="title-btn" onClick={overlay.actions.load} type="button">{t("pause.load")}</button>
      <button className="title-btn" onClick={overlay.actions.options} type="button">{t("pause.options")}</button>
      <button className="title-btn" onClick={overlay.actions.toTitle} type="button">{t("pause.toTitle")}</button>
      <button className="title-btn" onClick={overlay.actions.quit} type="button">{t("pause.quit")}</button>
    </ModalFrame>
  );
}

function OptionSection({ label }: { label: string }) {
  return <h3 className="opt-section">{label}</h3>;
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="opt-row">
      <span className="opt-label">{label}</span>
      <input
        max="100"
        min="0"
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
        type="range"
        value={percent}
      />
      <span className="opt-val">{percent}%</span>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="opt-row">
      <span className="opt-label">{label}</span>
      <button className={`opt-toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)} type="button">
        {value ? t("common.on") : t("common.off")}
      </button>
    </div>
  );
}

function ReactOptionsModal({ overlay }: { overlay: ReactOptionsOverlay }) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const settings = overlay.settings;

  const update = (change: () => void) => {
    change();
    overlay.actions.apply();
    rerender();
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>{t("options.title")}</h2>
      <div className="opt-row">
        <span className="opt-label">{t("options.language")}</span>
        <div className="speed-btns">
          {LOCALES.map((locale) => (
            <button
              className={getLocale() === locale.id ? "active" : ""}
              key={locale.id}
              onClick={() => {
                overlay.actions.setLanguage(locale.id);
                rerender();
              }}
              type="button"
            >
              {locale.label}
            </button>
          ))}
        </div>
      </div>

      <OptionSection label={t("options.audio")} />
      <SliderRow label={t("options.master")} value={settings.master} onChange={(value) => update(() => { settings.master = value; })} />
      <SliderRow label={t("options.sfx")} value={settings.sfx} onChange={(value) => update(() => { settings.sfx = value; })} />
      <SliderRow label={t("options.music")} value={settings.music} onChange={(value) => update(() => { settings.music = value; })} />

      <OptionSection label={t("options.graphics")} />
      <ToggleRow label={t("options.shake")} value={settings.shake} onChange={(value) => update(() => { settings.shake = value; })} />
      <ToggleRow label={t("options.highContrast")} value={settings.highContrast} onChange={(value) => update(() => { settings.highContrast = value; })} />
      <ToggleRow label={t("options.showDamage")} value={settings.showDamage} onChange={(value) => update(() => { settings.showDamage = value; })} />
      <div className="opt-row">
        <span className="opt-label">{t("options.fullscreen")}</span>
        <button className="opt-toggle" onClick={overlay.actions.toggleFullscreen} type="button">
          {t("options.fullscreenBtn")}
        </button>
      </div>

      <OptionSection label={t("options.gameplay")} />
      <div className="opt-row">
        <span className="opt-label">{t("options.defaultSpeed")}</span>
        <div className="speed-btns">
          {[1, 2, 3].map((speed) => (
            <button
              className={settings.defaultSpeed === speed ? "active" : ""}
              key={speed}
              onClick={() => update(() => { settings.defaultSpeed = speed as 1 | 2 | 3; })}
              type="button"
            >
              x{speed}
            </button>
          ))}
        </div>
      </div>
      <ToggleRow label={t("options.autoPause")} value={settings.autoPause} onChange={(value) => update(() => { settings.autoPause = value; })} />

      <div className="row-btns">
        <button className="primary" onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactCollectionModal({ overlay }: { overlay: ReactCollectionOverlay }) {
  const hiddenTotal = RECIPES.filter((recipe) => recipe.visibility === "hidden").length;

  return (
    <ModalFrame overlay={overlay}>
      <h2>{t("menu.collection")}</h2>
      <div className="result-stats">
        <span className="k">플레이 횟수</span><span>{overlay.profile.runs}</span>
        <span className="k">최고 라운드</span><span>{overlay.profile.bestRound > 0 ? `${overlay.profile.bestRound}R` : "-"}</span>
        <span className="k">선택 가능 맵</span><span>{FINAL_STAGE}/{FINAL_STAGE}</span>
        {DIFFICULTIES.map((difficulty) => (
          <Fragment key={difficulty.id}>
            <span className="k">{difficulty.name} 클리어</span>
            <span>{overlay.profile.clears[difficulty.id] ?? 0}</span>
          </Fragment>
        ))}
        <span className="k">유닛 수집</span><span>{overlay.profile.seenUnits.length}/{UNITS.length}</span>
        <span className="k">숨겨진 조합 발견</span><span>{overlay.profile.foundHiddenRecipes.length}/{hiddenTotal}</span>
      </div>

      {overlay.unitsByGrade.map(({ grade, units }) => (
        <section key={grade}>
          <h3 className={`grade-head grade-${grade}`}>{GRADE_LABEL[grade as Grade]}</h3>
          <div className="dex-grid">
            {units.map(({ unit, seen }) => (
              <div className={`dex-card ${seen ? "" : "unseen"}`} key={unit.id}>
                <span
                  className="shape"
                  style={{
                    background: seen ? FAMILY_COLOR[unit.family] : "#222633",
                    border: `2px solid ${seen ? GRADE_COLOR[unit.grade] : "#333a4f"}`,
                  }}
                />
                <div className="dex-info">
                  <div className="dex-name">{seen ? unit.name : "???"}</div>
                  <div className="dex-meta">
                    {seen
                      ? `${FAMILY_LABEL[unit.family]} · ${unit.roles.map((role) => ROLE_LABEL[role]).join("/")} · 공격 ${unit.attack} · 속도 ${unit.attackSpeed}`
                      : "아직 만나지 못했습니다"}
                  </div>
                  {seen && unit.desc ? <div className="dex-desc">{unit.desc}</div> : null}
                  {seen && unit.skills && unit.skills.length > 0 ? (
                    <div className="dex-skill">
                      기술 {unit.skills.map((skill) => {
                        const trigger = skill.trigger.kind === "onAttack"
                          ? `${Math.round(skill.trigger.chance * 100)}%`
                          : `${skill.trigger.everySeconds}s`;
                        return `${skill.name}(${trigger})`;
                      }).join(" · ")}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {overlay.hiddenRecipes.length > 0 ? (
        <>
          <h3 className="grade-head grade-hidden">발견한 숨겨진 조합</h3>
          {overlay.hiddenRecipes.map((recipe) => (
            <div className="dex-meta" key={recipe.id}>· {recipe.id} → {recipe.resultUnitId}</div>
          ))}
        </>
      ) : null}

      <div className="row-btns">
        <button className="primary" onClick={() => closeTopReactOverlay()} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function upgradeEffectText(stat: string, effectPerLevel: number, level: number) {
  if (stat === "killGold") return `5 kills +${level} gold -> +${level + 1} gold`;
  return `+${Math.round(effectPerLevel * 100 * level)}% -> +${Math.round(effectPerLevel * 100 * (level + 1))}%`;
}

function ReactUpgradeModal({ overlay }: { overlay: ReactUpgradeOverlay }) {
  const runtime = useSyncExternalStore(subscribeRuntimeSnapshot, getRuntimeSnapshot, getRuntimeSnapshot);
  const state = runtime?.state;

  return (
    <ModalFrame overlay={overlay}>
      <h2>Family upgrades</h2>
      <div className="modal-note" style={{ color: "var(--gold)" }}>
        Gold: {state?.gold ?? 0}
      </div>
      {UPGRADES.map((upgrade) => {
        const level = state?.upgrades[upgrade.id] ?? 0;
        const cost = upgradeCost(upgrade, level);
        const maxed = level >= upgrade.maxLevel;
        const disabled = !state || maxed || state.gold < cost;
        return (
          <div className="slot-card" key={upgrade.id}>
            <div>
              <div>{upgrade.name} - Lv.{level}/{upgrade.maxLevel}</div>
              <div className="meta">{upgradeEffectText(upgrade.stat, upgrade.effectPerLevel, level)}</div>
            </div>
            <button
              className="craft-btn"
              disabled={disabled}
              onClick={() => overlay.actions.buy(upgrade.id)}
              type="button"
            >
              {maxed ? "Max" : `${cost}G`}
            </button>
          </div>
        );
      })}
      <div className="row-btns">
        <button className="primary" onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

const HELP_ROWS: Array<[string, string]> = [
  ["Space", "Start next round / pause during combat"],
  ["Z", "Summon"],
  ["X", "Merge three selected units"],
  ["Delete / Backspace", "Sell selected units"],
  ["A + Left click", "Attack move"],
  ["S", "Hold position"],
  ["L", "Toggle selected unit lock"],
  ["Q / W / E", "Speed x1 / x2 / x3"],
  ["Ctrl + 1-9", "Save selected group"],
  ["1-9", "Select saved group"],
  ["Esc", "Cancel attack move / close modal / pause menu"],
];

function ReactHelpModal({ overlay }: { overlay: ReactHelpOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>Shortcuts</h2>
      <table className="kv-table">
        <tbody>
          {HELP_ROWS.map(([key, description]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Rules</h3>
      <div>
        Summon, merge, hidden recipes, sell, and upgrades are available during combat unless the run has ended.
        Locked units are protected from sell and recipe material consumption.
      </div>
      <div className="row-btns">
        <button className="primary" onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactAboutModal({ overlay }: { overlay: ReactAboutOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>Rift Random Defense</h2>
      <div>Original 2D random defense MVP prototype.</div>
      <div className="meta">App v{overlay.version} / Data v{overlay.dataVersion}</div>
      <div className="meta">Runtime: {overlay.runtimeLabel}</div>
      <div className="row-btns">
        {overlay.canOpenDataDir ? (
          <button onClick={overlay.actions.openDataDir} type="button">
            Open data folder
          </button>
        ) : null}
        <button className="primary" onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactConfirmModal({ overlay }: { overlay: ReactConfirmOverlay }) {
  return (
    <ModalFrame overlay={overlay}>
      <h2>{overlay.title}</h2>
      <div>{overlay.message}</div>
      <div className="row-btns">
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.cancel")}
        </button>
        <button
          className={overlay.danger ? "danger" : "primary"}
          onClick={() => {
            closeReactOverlay(overlay.id);
            overlay.actions.confirm();
          }}
          type="button"
        >
          {overlay.confirmLabel}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactSimulationModal({ overlay }: { overlay: ReactSimulationOverlay }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("Ready.");

  const run = async () => {
    setRunning(true);
    setOutput("Running...");
    try {
      setOutput(await overlay.actions.run());
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    if (!output || output === "Ready." || output === "Running...") return;
    try {
      const path = await overlay.actions.save(output);
      pushReactToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushReactToast("Save failed.", "danger");
    }
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>Auto Simulation (100 seeds)</h2>
      <div>Runs the current data version through 100 auto-play seeds.</div>
      <pre className="report">{output}</pre>
      <div className="row-btns">
        <button className="primary" disabled={running} onClick={() => void run()} type="button">
          {running ? "Running..." : "Run"}
        </button>
        <button disabled={running || output === "Ready." || output === "Running..."} onClick={() => void save()} type="button">
          Save report
        </button>
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactBalanceGateModal({ overlay }: { overlay: ReactBalanceGateOverlay }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("Ready.");
  const [result, setResult] = useState<{ markdown: string; json: string } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setOutput("Running...");
    try {
      const next = await overlay.actions.run(setOutput);
      setResult(next);
      setOutput(next.markdown);
    } finally {
      setRunning(false);
    }
  };

  const saveMarkdown = async () => {
    if (!result) return;
    try {
      const path = await overlay.actions.saveMarkdown(result.markdown);
      pushReactToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushReactToast("Save failed.", "danger");
    }
  };

  const saveJson = async () => {
    if (!result) return;
    try {
      const path = await overlay.actions.saveJson(result.json);
      pushReactToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushReactToast("Save failed.", "danger");
    }
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>5-Difficulty Balance Gate</h2>
      <div>Runs the full 30-seed automatic balance gate across all configured scenarios.</div>
      <pre className="report">{output}</pre>
      <div className="row-btns">
        <button className="primary" disabled={running} onClick={() => void run()} type="button">
          {running ? "Running..." : "Run"}
        </button>
        <button disabled={running || !result} onClick={() => void saveMarkdown()} type="button">
          Save Markdown
        </button>
        <button disabled={running || !result} onClick={() => void saveJson()} type="button">
          Save JSON
        </button>
        <button onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ReactManualProofModal({ overlay }: { overlay: ReactManualProofOverlay }) {
  const copyText = async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushReactToast(okMessage, "ok");
    } catch {
      pushReactToast("Copy failed.", "warn");
    }
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>Manual Proof Guide</h2>
      <div className={overlay.intro.className}>{overlay.intro.text}</div>

      {overlay.sections.map((section) => (
        <Fragment key={section.title}>
          <h3>{section.title}</h3>
          {section.note ? <div className={section.note.className}>{section.note.text}</div> : null}
          {section.commands.map((command) => (
            <pre className="report" key={`${section.title}-${command}`}>{command}</pre>
          ))}
        </Fragment>
      ))}

      <h3>Evidence version</h3>
      <pre className="report">DATA_VERSION {overlay.dataVersion}</pre>

      {overlay.currentTarget ? (
        <>
          <h3>Current target status</h3>
          <table className="kv-table">
            <tbody>
              {[
                ["Difficulty", overlay.currentTarget.difficulty],
                ["Legend / hidden", overlay.currentTarget.legends],
                ["Target", overlay.currentTarget.label],
                ["Condition", overlay.currentTarget.status],
              ].map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={overlay.currentTarget.state === "warn" ? "result-hint" : "modal-note"}>
            {overlay.currentTarget.note}
          </div>
        </>
      ) : null}

      {overlay.finishReadiness ? (
        <>
          <h3>Current finish readiness</h3>
          <div className={overlay.finishReadiness.ready ? "result-proof-ok" : "result-hint"}>
            {overlay.finishReadiness.ready
              ? "Current run meets the minimum manual proof save requirements."
              : `Not ready: ${overlay.finishReadiness.blockers.join(", ")}`}
          </div>
        </>
      ) : null}

      <h3>Workflow</h3>
      <ol className="modal-note">
        {overlay.workflow.map((step) => <li key={step}>{step}</li>)}
      </ol>

      <h3>Result fields</h3>
      <table className="kv-table">
        <tbody>
          {overlay.resultFields.map((row) => (
            <tr key={row.field}>
              <td>{row.field}</td>
              <td>{row.source}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Required target sessions</h3>
      <table className="kv-table">
        <tbody>
          {overlay.balanceTargets.map((row) => (
            <tr key={`${row.difficulty}-${row.target}`}>
              <td>{row.difficulty}</td>
              <td>{row.target}</td>
              <td>{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Required boundary observations</h3>
      <table className="kv-table">
        <tbody>
          {overlay.balanceObservations.map((row) => (
            <tr key={`${row.difficulty}-${row.target}`}>
              <td>{row.difficulty}</td>
              <td>{row.target}</td>
              <td>{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="tool-group">
        <summary>
          Command copy tools
          <span className="summary-note"> manual proof commands</span>
        </summary>
        <div className="tool-body">
          {overlay.commandGroups.map((group) => (
            <Fragment key={group.label}>
              <div className="btn-group-label">{group.label}</div>
              <div className="btn-group">
                {group.commands.map((command) => (
                  <button
                    key={command.label}
                    onClick={() => void copyText(command.text, command.okMessage)}
                    type="button"
                  >
                    {command.label}
                  </button>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </details>

      <div className="row-btns">
        <button className="primary" onClick={() => closeReactOverlay(overlay.id)} type="button">
          {t("common.close")}
        </button>
      </div>
    </ModalFrame>
  );
}

function ResultStats({ overlay }: { overlay: ReactResultOverlay }) {
  const summary = overlay.summary;
  const stats: Array<[string, string]> = [
    ["Seed", summary.seed],
    ["Stage", `${summary.stageId}. ${summary.stageName}`],
    ["Difficulty", summary.difficulty],
    ["Best grade", GRADE_LABEL[summary.maxGrade]],
    ["Legend / hidden", `${summary.legendCount} / ${summary.hiddenCount}`],
    ["Play time", `${((summary.wallSeconds ?? 0) / 60).toFixed(1)}m`],
    ["Manual proof", overlay.proofTarget],
    ["Missions", `${summary.missionsDone}/${summary.missionsTotal}`],
    ["Craft / merge", `${summary.craftCount} / ${summary.merge3Count}`],
    ["Pity", String(summary.pityTriggered)],
  ];

  return (
    <div className="result-stats">
      {stats.map(([key, value]) => (
        <Fragment key={key}>
          <span className="k">{key}</span>
          <span>{value}</span>
        </Fragment>
      ))}
    </div>
  );
}

function ReactResultModal({ overlay }: { overlay: ReactResultOverlay }) {
  const summary = overlay.summary;
  const proofPassed = overlay.proofChecks.every((check) => check.ok);

  const copyText = async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushReactToast(okMessage, "ok");
    } catch {
      pushReactToast("Copy failed.", "warn");
    }
  };

  const exportReport = async () => {
    try {
      const path = await overlay.actions.exportReport();
      pushReactToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushReactToast("Report save failed.", "danger");
    }
  };

  const exportJson = async () => {
    try {
      const path = await overlay.actions.exportJson();
      pushReactToast(`Saved ${path}`, "ok", 4000);
    } catch {
      pushReactToast("JSON save failed.", "danger");
    }
  };

  return (
    <ModalFrame overlay={overlay}>
      <h2>{summary.cleared ? "Final boss cleared" : `Defeated at round ${summary.reachedRound}`}</h2>
      <div className={proofPassed ? "result-proof-ok" : "result-hint"}>
        {proofPassed
          ? `Manual proof complete: ${overlay.proofTarget}`
          : `Manual proof incomplete: ${overlay.proofTarget}`}
      </div>

      <ResultStats overlay={overlay} />

      {summary.topDealers.length > 0 ? (
        <>
          <h3>Top dealers</h3>
          <table className="kv-table">
            <tbody>
              {summary.topDealers.map((dealer) => (
                <tr key={`${dealer.name}-${dealer.damage}`}>
                  <td>{dealer.name} ({GRADE_LABEL[dealer.grade]})</td>
                  <td>{dealer.damage.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h3>Manual proof checklist</h3>
      <table className="kv-table">
        <tbody>
          {overlay.proofChecks.map((check) => (
            <tr key={check.label}>
              <td>{check.ok ? "OK" : "Missing"}</td>
              <td>{check.label}</td>
              <td>{check.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {summary.failHint ? <div className="result-hint">{summary.failHint}</div> : null}

      <details className="tool-group">
        <summary>
          Report and manual proof tools
          <span className="summary-note"> export, copy, and validation commands</span>
        </summary>
        <div className="tool-body">
          <div className="btn-group-label">Exports</div>
          <div className="btn-group">
            <button onClick={() => void exportReport()} type="button">Report (.md)</button>
            <button onClick={() => void exportJson()} type="button">{overlay.exportJsonLabel}</button>
            <button onClick={() => void copyText(overlay.manualResultJson, overlay.copyJsonOkMessage)} type="button">
              {overlay.copyJsonLabel}
            </button>
          </div>
          {overlay.commandGroups.map((group) => (
            <Fragment key={group.label}>
              <div className="btn-group-label">{group.label}</div>
              <div className="btn-group">
                {group.commands.map((command) => (
                  <button
                    key={command.label}
                    onClick={() => void copyText(command.text, command.okMessage)}
                    type="button"
                  >
                    {command.label}
                  </button>
                ))}
              </div>
              {group.commands.map((command) => (
                <Fragment key={`${group.label}-${command.label}-pre`}>
                  <h3>{command.label}</h3>
                  <pre className="report">{command.text}</pre>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </details>

      <div className="row-btns">
        <button onClick={() => { closeReactOverlay(overlay.id); overlay.actions.toTitle(); }} type="button">
          Title
        </button>
        <button onClick={() => { closeReactOverlay(overlay.id); overlay.actions.restartSeed(); }} type="button">
          Same seed
        </button>
        <button className="primary" onClick={() => { closeReactOverlay(overlay.id); overlay.actions.newRun(); }} type="button">
          New run
        </button>
      </div>
    </ModalFrame>
  );
}

function renderOverlay(overlay: ReactOverlay) {
  if (overlay.kind === "pause") return <ReactPauseModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "options") return <ReactOptionsModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "newRun") return <ReactNewRunModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "selector") return <ReactSelectorModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "relicChoice") return <ReactRelicChoiceModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "save") return <ReactSaveModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "load") return <ReactLoadModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "upgrade") return <ReactUpgradeModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "help") return <ReactHelpModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "about") return <ReactAboutModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "confirm") return <ReactConfirmModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "simulation") return <ReactSimulationModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "balanceGate") return <ReactBalanceGateModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "manualProof") return <ReactManualProofModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "result") return <ReactResultModal key={overlay.id} overlay={overlay} />;
  return <ReactCollectionModal key={overlay.id} overlay={overlay} />;
}

export function ReactModalHost() {
  const overlays = useSyncExternalStore(subscribeReactOverlays, getReactOverlays, getReactOverlays);

  return (
    <div className="modal-host" id="modal-root">
      {overlays.map(renderOverlay)}
    </div>
  );
}
