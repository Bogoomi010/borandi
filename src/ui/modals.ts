// 선택권 / 결과 / 새 게임 / 저장 슬롯 / 시뮬레이션 모달

import type { AppCtx } from "./ctx";
import { el, openModal, toast } from "./widgets";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, type DifficultyId, type ResultSummary } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { DIFFICULTIES } from "../data/difficulty";
import { STAGES, stageById } from "../data/stages";
import { randomSeed } from "../core/rng";
import { stateChecksum } from "../core/checksum";
import {
  deleteSlot, listSlots, loadSlot, makeSaveRecord, recordResult,
  saveSlot, writeReport, isTauri, openAppDataDir, type SlotMeta,
} from "../save/saveApi";
import { replay } from "../core/engine";
import { runSimulation, reportToMarkdown } from "../sim/runner";
import {
  BALANCE_GATE_DEFAULT_SEEDS,
  BALANCE_SCENARIOS,
  balanceGateToJson,
  balanceGateToMarkdown,
  evaluateBalanceGate,
  type BalanceGateResult,
  type BalanceScenarioResult,
} from "../sim/balanceGate";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";
import { loadProfile } from "./settings";

// ---------- 선택권 ----------

let selectorOpen = false;

export function openSelectorModal(ctx: AppCtx) {
  const s = ctx.game.state;
  if (selectorOpen || s.pendingSelectors.length === 0) return;
  if (s.phase === "ended") return; // 게임은 항상 "wave"로 진행 — 종료 시에만 차단
  selectorOpen = true;
  ctx.audio.sfx("selector");
  const sel = s.pendingSelectors[0];

  openModal((body, close) => {
    body.appendChild(el("h2", "", `🎁 ${GRADE_LABEL[sel.grade]} 선택권`));
    body.appendChild(el("h3", "", `출처: ${sel.source} — 1기를 선택하세요`));
    const grid = el("div", "choice-grid");
    for (const id of sel.candidateIds) {
      const d = UNIT_BY_ID[id];
      const btn = el("button", "choice-btn");
      const shape = el("span");
      shape.style.cssText = `width:26px;height:26px;background:${FAMILY_COLOR[d.family]};border:3px solid ${GRADE_COLOR[d.grade]};border-radius:6px;display:inline-block`;
      btn.appendChild(shape);
      btn.appendChild(el("span", "cname", d.name));
      btn.appendChild(el("span", "cdesc",
        `${FAMILY_LABEL[d.family]} · ${d.roles.map((r) => ROLE_LABEL[r]).join("/")}\n공격 ${d.attack} · 속도 ${d.attackSpeed}`));
      if (d.desc) btn.appendChild(el("span", "cdesc", d.desc));
      btn.onclick = () => {
        const res = ctx.act("pickSelector", { selectorId: sel.id, unitId: id });
        selectorOpen = false;
        close();
        if (res && ctx.game.state.pendingSelectors.length > 0) {
          openSelectorModal(ctx);
        }
      };
      grid.appendChild(btn);
    }
    body.appendChild(grid);
    const row = el("div", "row-btns");
    const later = el("button", "", "나중에 선택");
    later.onclick = () => { selectorOpen = false; close(); };
    row.appendChild(later);
    body.appendChild(row);
  }, false);
}

// ---------- 결과 ----------

function shellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function manualPlaylogCommand(r: ResultSummary): string {
  const seconds = Math.max(1, Math.round(r.wallSeconds ?? 0));
  const result = r.cleared ? "clear" : "loss";
  const args = [
    "yarn manual-playlog",
    `--difficulty=${r.difficultyId}`,
    `--seconds=${seconds}`,
    `--result=${result}`,
    `--stage=${r.stageId}`,
    `--round=${r.reachedRound}`,
    `--seed=${shellArg(r.seed)}`,
    `--legends=${r.legendOrBetterCount}`,
    `--maxGrade=${r.maxGrade}`,
    `--dataVersion=${shellArg(r.dataVersion)}`,
    `--stateChecksum=${shellArg(r.stateChecksum)}`,
  ];
  if (r.manualStartedAt) args.push(`--startedAt=${shellArg(r.manualStartedAt)}`);
  if (r.playedAt) args.push(`--endedAt=${shellArg(r.playedAt)}`);
  args.push(`--notes=${shellArg(`${r.difficulty} ${result}, ${r.legendOrBetterCount}전설 이상`)}`);
  return args.join(" ");
}

function manualProofTarget(r: ResultSummary): string {
  const targetLength = (r.wallSeconds ?? 0) >= 12 * 60;
  const finalRound = r.reachedRound >= 40;
  if (!targetLength) return "12분 이상 진행된 판만 수동 목표 증거로 인정됩니다.";
  if (r.difficultyId === "novice" && r.cleared && finalRound && r.legendOrBetterCount === 0) {
    return "입문자 무전설 40R 클리어 증거";
  }
  if (r.difficultyId === "normal" && r.cleared && finalRound && r.legendOrBetterCount >= 1 && r.legendOrBetterCount <= 2) {
    return "일반 1~2전설 40R 클리어 증거";
  }
  if (r.difficultyId === "intermediate" && r.cleared && finalRound && r.legendOrBetterCount >= 5) {
    return "중급자 5전설 이상 40R 클리어 증거";
  }
  if (r.difficultyId === "expert" && !r.cleared && finalRound && r.legendOrBetterCount <= 5) {
    return "고수 5전설 이하 40R 실패 증거";
  }
  if (r.difficultyId === "expert" && r.cleared && finalRound && r.legendOrBetterCount >= 6) {
    return "고수 6전설 이상 40R 클리어 증거";
  }
  if (r.difficultyId === "master" && !r.cleared) {
    return "초고수 실패 기록 증거";
  }
  return "수동 플레이 시간에는 포함되지만 목표 결과 증거 조건과는 다릅니다.";
}

export function buildReportMarkdown(r: ResultSummary): string {
  const proofTarget = manualProofTarget(r);
  const lines = [
    `# 차원 균열 랜덤 디펜스 결과`,
    ``,
    `- 결과: ${r.cleared ? "클리어" : "패배"}`,
    `- 맵: ${r.stageId}. ${r.stageName}`,
    `- 도달 라운드: ${r.reachedRound}`,
    `- 시드: \`${r.seed}\` / 난이도: ${r.difficulty} / 데이터 버전: ${r.dataVersion}`,
    `- 상태 체크섬: \`${r.stateChecksum}\``,
    `- 남은 라이프: ${r.life}`,
    `- 최고 등급: ${GRADE_LABEL[r.maxGrade]}`,
    `- 전설/히든: ${r.legendCount}/${r.hiddenCount}`,
    `- 미션: ${r.missionsDone}/${r.missionsTotal}`,
    `- 조합 ${r.craftCount}회 · 3합성 ${r.merge3Count}회 · 보정 발동 ${r.pityTriggered}회`,
    ...(r.wallSeconds ? [`- 실제 플레이 시간: ${(r.wallSeconds / 60).toFixed(1)}분`] : []),
    ...(r.wallSeconds ? [`- 수동 증거 판정: ${proofTarget}`] : []),
    ``,
    `## 주요 딜러`,
    ``,
    ...r.topDealers.map((d, i) => `${i + 1}. ${d.name} (${GRADE_LABEL[d.grade]}) — 누적 피해 ${d.damage.toLocaleString()}`),
    ``,
    `## 보스`,
    ``,
    ...(r.bossKills.length > 0
      ? r.bossKills.map((b) => `- ${b.round}R 처치 (${b.seconds}초)`)
      : ["- 처치 기록 없음"]),
    ...(r.bossFails.length > 0 ? r.bossFails.map((b) => `- ${b}R 실패`) : []),
  ];
  if (r.failHint) {
    lines.push("", "## 개선 힌트", "", `- ${r.failHint}`);
  }
  if (r.wallSeconds) {
    lines.push("", "## 수동 플레이 로그", "", `- 판정: ${proofTarget}`, "", "```bash", manualPlaylogCommand(r), "```");
  }
  lines.push("", `played at ${r.playedAt}`);
  return lines.join("\n");
}

let resultShown = false;

export function maybeShowResult(ctx: AppCtx) {
  const s = ctx.game.state;
  if (s.phase !== "ended" || resultShown) return;
  resultShown = true;

  const summary = ctx.game.resultSummary();
  summary.playedAt = new Date().toISOString();
  summary.manualStartedAt = ctx.runStartedAt;
  const wallSeconds = Math.max(1, Math.round((performance.now() - ctx.runStartedAtMs) / 1000));
  summary.wallSeconds = wallSeconds;
  ctx.audio.sfx(summary.cleared ? "victory" : "defeat");
  void recordResult(summary).catch(() => toast("결과 저장 실패", "danger"));

  openModal((body, close) => {
    const proofTarget = manualProofTarget(summary);
    body.appendChild(el("h2", "", summary.cleared ? `${summary.stageName} 40라운드 클리어!` : `${summary.reachedRound}라운드에서 패배`));

    const grid = el("div", "result-stats");
    const kv = (k: string, v: string) => {
      grid.appendChild(el("span", "k", k));
      grid.appendChild(el("span", "", v));
    };
    kv("시드", summary.seed);
    kv("맵", `${summary.stageId}. ${summary.stageName}`);
    kv("난이도", summary.difficulty);
    kv("최고 등급", GRADE_LABEL[summary.maxGrade]);
    kv("전설/히든", `${summary.legendCount} / ${summary.hiddenCount}`);
    kv("실제 플레이", `${(wallSeconds / 60).toFixed(1)}분`);
    kv("수동 증거", proofTarget);
    kv("미션", `${summary.missionsDone}/${summary.missionsTotal}`);
    kv("조합/3합성", `${summary.craftCount} / ${summary.merge3Count}`);
    kv("보정 발동", `${summary.pityTriggered}회`);
    body.appendChild(grid);

    if (summary.topDealers.length > 0) {
      body.appendChild(el("h3", "", "주요 딜러"));
      const table = el("table", "kv-table");
      for (const d of summary.topDealers) {
        const tr = el("tr");
        tr.appendChild(el("td", "", `${d.name} (${GRADE_LABEL[d.grade]})`));
        tr.appendChild(el("td", "", d.damage.toLocaleString()));
        table.appendChild(tr);
      }
      body.appendChild(table);
    }

    if (summary.failHint) {
      body.appendChild(el("div", "result-hint", `💡 ${summary.failHint}`));
    }

    const row = el("div", "row-btns");
    const manualCommand = manualPlaylogCommand(summary);

    body.appendChild(el("h3", "", "수동 플레이 로그"));
    body.appendChild(el("pre", "report", manualCommand));

    const exportBtn = el("button", "", "리포트 내보내기 (.md)");
    exportBtn.onclick = async () => {
      try {
        const path = await writeReport(
          `randi-result-${summary.seed}-${Date.now()}.md`,
          buildReportMarkdown(summary),
        );
        toast(`리포트 저장: ${path}`, "ok", 4000);
      } catch {
        toast("리포트 저장 실패", "danger");
      }
    };
    row.appendChild(exportBtn);

    const copyLog = el("button", "", "로그 명령 복사");
    copyLog.onclick = async () => {
      try {
        await navigator.clipboard.writeText(manualCommand);
        toast("수동 플레이 로그 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 리포트에서 명령을 확인하세요", "warn");
      }
    };
    row.appendChild(copyLog);

    const titleBtn = el("button", "", "타이틀로");
    titleBtn.onclick = () => { resetResultShown(); close(); ctx.goTitle(); };
    row.appendChild(titleBtn);

    const sameSeed = el("button", "", "같은 시드 재시작");
    sameSeed.onclick = () => { resultShown = false; close(); ctx.newRun(summary.seed, ctx.game.state.difficulty, ctx.game.state.stageId); };
    row.appendChild(sameSeed);

    const newBtn = el("button", "primary", "새 게임");
    newBtn.onclick = () => { resultShown = false; close(); openNewRunModal(ctx); };
    row.appendChild(newBtn);

    body.appendChild(row);
  }, false);
}

export function resetResultShown() { resultShown = false; }

// ---------- 새 게임 ----------

const MANUAL_BALANCE_TARGETS: Array<{
  difficultyId: DifficultyId;
  difficulty: string;
  target: string;
  length: string;
}> = [
  { difficultyId: "novice", difficulty: "입문자", target: "무전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "normal", difficulty: "일반", target: "1~2전설 40R 클리어", length: "12분 이상" },
  { difficultyId: "intermediate", difficulty: "중급자", target: "5전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "5전설 이하 40R 실패", length: "12분 이상" },
  { difficultyId: "expert", difficulty: "고수", target: "6전설 이상 40R 클리어", length: "12분 이상" },
  { difficultyId: "master", difficulty: "초고수", target: "실패 기록", length: "12분 이상" },
];

function manualTargetHint(difficultyId: DifficultyId): string {
  return MANUAL_BALANCE_TARGETS
    .filter((target) => target.difficultyId === difficultyId)
    .map((target) => target.target)
    .join(" / ");
}

export function openNewRunModal(ctx: AppCtx, dismissable = true) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "새 게임"));

    const profile = loadProfile();
    const unlockedStage = Math.max(1, Math.min(profile.unlockedStage, STAGES.length));
    body.appendChild(el("h3", "", "난이도"));
    let chosen: DifficultyId = "novice";
    let chosenStage = unlockedStage;
    const diffRow = el("div", "choice-grid difficulty-choice-grid");
    const diffBtns: HTMLButtonElement[] = [];
    for (const d of DIFFICULTIES) {
      const b = el("button", "choice-btn") as HTMLButtonElement;
      b.appendChild(el("span", "cname", d.name));
      b.appendChild(el("span", "cdesc", `수동 목표: ${manualTargetHint(d.id)}`));
      b.appendChild(el("span", "cdesc", `보유 ${d.unitCap}기 · 적 체력 x${d.enemyHpMult} · 누적 ${d.enemyLimit} · 시작 ${d.startGold}골드`));
      if (d.id === chosen) b.style.borderColor = "var(--accent)";
      b.onclick = () => {
        chosen = d.id;
        diffBtns.forEach((x) => (x.style.borderColor = "var(--line)"));
        b.style.borderColor = "var(--accent)";
      };
      diffBtns.push(b);
      diffRow.appendChild(b);
    }
    body.appendChild(diffRow);

    body.appendChild(el("h3", "", "맵 선택 권한"));
    body.appendChild(el("div", "modal-note", "새 게임을 시작할 때 고른 맵 하나로 1~40R 최종 보스까지 진행합니다."));
    const stageRow = el("div", "choice-grid stage-choice-grid");
    const stageBtns: HTMLButtonElement[] = [];
    for (const stage of STAGES) {
      const b = el("button", "choice-btn stage-choice") as HTMLButtonElement;
      b.appendChild(el("span", "cname", `${stage.id}. ${stage.name}`));
      b.appendChild(el("span", "cdesc", `${stage.subtitle} · 라운드/보스마다 맵 변경 없음`));
      b.disabled = stage.id > unlockedStage;
      if (b.disabled) b.appendChild(el("span", "cdesc", `잠김: ${stage.id - 1}번 맵 40R 최종 보스 클리어 후 선택 가능`));
      if (stage.id === chosenStage) b.style.borderColor = "var(--accent)";
      b.onclick = () => {
        chosenStage = stage.id;
        stageBtns.forEach((x) => (x.style.borderColor = "var(--line)"));
        b.style.borderColor = "var(--accent)";
      };
      stageBtns.push(b);
      stageRow.appendChild(b);
    }
    body.appendChild(stageRow);

    const row = el("div", "row-btns");
    if (dismissable) {
      const cancel = el("button", "", "취소");
      cancel.onclick = close;
      row.appendChild(cancel);
    }
    const start = el("button", "primary", "시작");
    start.onclick = () => {
      const seed = randomSeed(); // 시드는 내부 RNG/재현성용으로 항상 무작위 생성
      close();
      resetResultShown();
      ctx.newRun(seed, chosen, chosenStage);
    };
    row.appendChild(start);
    body.appendChild(row);
  }, dismissable);
}

// ---------- 수동 밸런스 증거 ----------

export function openManualProofGuideModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "수동 밸런스 증거"));
    body.appendChild(el("div", "modal-note", "결과 화면의 로그 명령을 실행한 뒤, 아래 요약 명령으로 남은 증거를 확인합니다."));

    const summaryCommand = "yarn manual-playlog --summary";
    const summaryJsonCommand = "yarn --silent manual-playlog --summary --json";
    body.appendChild(el("h3", "", "상태 확인"));
    body.appendChild(el("pre", "report", summaryCommand));
    body.appendChild(el("pre", "report", summaryJsonCommand));

    body.appendChild(el("h3", "", "필수 목표 세션"));
    const table = el("table", "kv-table");
    for (const { difficulty, target, length } of MANUAL_BALANCE_TARGETS) {
      const tr = el("tr");
      tr.appendChild(el("td", "", difficulty));
      tr.appendChild(el("td", "", target));
      tr.appendChild(el("td", "", length));
      table.appendChild(tr);
    }
    body.appendChild(table);
    body.appendChild(el("div", "result-hint", "총 120분 이상, 각 난이도 최소 12분 이상이 함께 필요합니다."));
    body.appendChild(el("h3", "", "권장 플레이 순서"));
    body.appendChild(el(
      "div",
      "modal-note",
      "위 6개 목표 세션을 먼저 12분 이상씩 채우면 72분입니다. 이후 부족한 48분은 요약 명령의 다음 필요 항목을 보며 난이도별 최소 12분 조건과 총 120분 조건을 채웁니다.",
    ));

    const row = el("div", "row-btns");
    const copySummary = el("button", "", "요약 명령 복사");
    copySummary.onclick = async () => {
      try {
        await navigator.clipboard.writeText(summaryCommand);
        toast("수동 증거 요약 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copySummary);
    const copyJsonSummary = el("button", "", "JSON 명령 복사");
    copyJsonSummary.onclick = async () => {
      try {
        await navigator.clipboard.writeText(summaryJsonCommand);
        toast("수동 증거 JSON 명령을 복사했습니다", "ok");
      } catch {
        toast("복사 실패: 명령을 직접 선택하세요", "warn");
      }
    };
    row.appendChild(copyJsonSummary);
    const closeBtn = el("button", "primary", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

// ---------- 저장/불러오기 슬롯 ----------

export function openSaveModal(ctx: AppCtx) {
  openModal(async (body, close) => {
    body.appendChild(el("h2", "", "수동 저장"));
    const slots = await listSlots();
    for (const slotId of ["slot1", "slot2", "slot3"]) {
      const meta = slots.find((m) => m.slotId === slotId);
      const card = el("div", "slot-card");
      const left = el("div");
      left.appendChild(el("div", "", `슬롯 ${slotId.slice(-1)}`));
      left.appendChild(el("div", "meta", meta
        ? `${stageById(meta.stageId ?? 1).name} · ${meta.round}R · ${meta.difficulty} · 시드 ${meta.seed} · ${new Date(meta.savedAt).toLocaleString()}`
        : "비어 있음"));
      card.appendChild(left);
      card.onclick = async () => {
        try {
          const s = ctx.game.state;
          await saveSlot(slotId, makeSaveRecord({
            seed: s.seed, difficulty: s.difficulty, stageId: s.stageId,
            stateChecksum: stateChecksum(s),
            tick: s.tick, round: s.round, life: s.life,
            maxGrade: ctx.game.maxOwnedGrade(),
            inputHistory: s.inputHistory,
          }));
          toast(`슬롯에 저장했습니다`, "ok");
          close();
        } catch {
          toast("저장 실패: 권한 또는 디스크 상태를 확인하세요.", "danger");
        }
      };
      body.appendChild(card);
    }
    const row = el("div", "row-btns");
    const cancel = el("button", "", "닫기");
    cancel.onclick = close;
    row.appendChild(cancel);
    body.appendChild(row);
  });
}

export function openLoadModal(ctx: AppCtx) {
  openModal(async (body, close) => {
    body.appendChild(el("h2", "", "불러오기"));
    const slots = await listSlots();
    if (slots.length === 0) body.appendChild(el("div", "", "저장된 슬롯이 없습니다."));

    const renderSlot = (meta: SlotMeta) => {
      const card = el("div", "slot-card");
      const left = el("div");
      left.appendChild(el("div", "", meta.slotId === "autosave" ? "자동 저장" : `슬롯 ${meta.slotId.slice(-1)}`));
      left.appendChild(el("div", "meta",
        `${stageById(meta.stageId ?? 1).name} · ${meta.round}R · 라이프 ${meta.life} · ${meta.difficulty} · 시드 ${meta.seed} · v${meta.dataVersion} · ${new Date(meta.savedAt).toLocaleString()}`));
      card.appendChild(left);

      const delBtn = el("button", "del", "삭제");
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteSlot(meta.slotId);
        close();
        openLoadModal(ctx);
      };
      card.appendChild(delBtn);

      card.onclick = async () => {
        try {
          const rec = await loadSlot(meta.slotId);
          if (!rec) { toast("슬롯을 읽을 수 없습니다", "danger"); return; }
          if (rec.dataVersion !== ctx.game.state.dataVersion) {
            toast("현재 데이터 버전과 달라 불러올 수 없습니다.", "warn", 4000);
            return;
          }
          const replayed = replay(rec.seed, rec.difficulty, rec.stageId ?? 1, rec.inputHistory, rec.tick);
          if (stateChecksum(replayed.state) !== rec.stateChecksum) {
            toast("체크섬 불일치: 손상된 저장입니다.", "danger", 4000);
            return;
          }
          resetResultShown();
          ctx.adoptGame(replayed);
          toast(`${rec.round}R 저장을 불러왔습니다`, "ok");
          close();
        } catch {
          toast("불러오기 실패", "danger");
        }
      };
      return card;
    };

    const auto = slots.find((m) => m.slotId === "autosave");
    if (auto) {
      body.appendChild(el("h3", "", "자동 저장"));
      body.appendChild(renderSlot(auto));
    }
    const manual = slots.filter((m) => m.slotId !== "autosave");
    if (manual.length > 0) {
      body.appendChild(el("h3", "", "수동 슬롯"));
      for (const m of manual) body.appendChild(renderSlot(m));
    }

    const row = el("div", "row-btns");
    const cancel = el("button", "", "닫기");
    cancel.onclick = close;
    row.appendChild(cancel);
    body.appendChild(row);
  });
}

// ---------- 시뮬레이션 ----------

export function openSimModal(ctx: AppCtx) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "자동 시뮬레이션 (100시드)"));
    body.appendChild(el("div", "", "현재 데이터 버전 기준으로 자동 플레이 100판을 실행합니다. 수 초가 걸릴 수 있습니다."));
    const out = el("pre", "report", "대기 중…");
    body.appendChild(out);

    const row = el("div", "row-btns");
    const run = el("button", "primary", "실행") as HTMLButtonElement;
    run.onclick = () => {
      run.disabled = true;
      out.textContent = "실행 중…";
      // UI 멈춤 최소화를 위해 다음 프레임에 실행
      setTimeout(() => {
        const report = runSimulation(100, ctx.game.state.difficulty, "balanced");
        out.textContent = reportToMarkdown(report);
        run.disabled = false;
      }, 50);
    };
    row.appendChild(run);

    const exportBtn = el("button", "", "리포트 저장");
    exportBtn.onclick = async () => {
      if (!out.textContent || out.textContent.startsWith("대기")) return;
      try {
        const p = await writeReport(`randi-sim-${Date.now()}.md`, out.textContent);
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(exportBtn);

    const closeBtn = el("button", "", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

export function openBalanceGateModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "5난이도 밸런스 게이트"));
    body.appendChild(el("div", "", "현재 기준으로 30시드 자동 플레이 게이트를 실행합니다. 전체 난이도 조건을 확인하므로 시간이 걸릴 수 있습니다."));
    const out = el("pre", "report", "대기 중…");
    body.appendChild(out);
    let lastResult: BalanceGateResult | null = null;

    const row = el("div", "row-btns");
    const run = el("button", "primary", "실행") as HTMLButtonElement;
    run.onclick = () => {
      run.disabled = true;
      out.textContent = "실행 중…";
      const progress: string[] = [];
      const results: BalanceScenarioResult[] = [];
      const runNext = (index: number) => {
        if (index >= BALANCE_SCENARIOS.length) {
          lastResult = evaluateBalanceGate(BALANCE_GATE_DEFAULT_SEEDS, results);
          out.textContent = balanceGateToMarkdown(lastResult);
          run.disabled = false;
          return;
        }
        const scenario = BALANCE_SCENARIOS[index];
        out.textContent = `실행 중…\n${progress.join("\n")}\n${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label} 계산 중`;
        setTimeout(() => {
          const report = runSimulation(BALANCE_GATE_DEFAULT_SEEDS, scenario.difficulty, scenario.options);
          results.push({ scenario, report });
          progress.push(`${index + 1}/${BALANCE_SCENARIOS.length} ${scenario.label}: ${(report.clearRate * 100).toFixed(1)}% · 평균 ${report.avgReachedRound.toFixed(1)}R · 전설 ${report.avgLegendCount.toFixed(1)}`);
          out.textContent = `실행 중…\n${progress.join("\n")}`;
          runNext(index + 1);
        }, 20);
      };
      runNext(0);
    };
    row.appendChild(run);

    const saveMd = el("button", "", "Markdown 저장");
    saveMd.onclick = async () => {
      if (!lastResult) return;
      try {
        const p = await writeReport(`randi-balance-${Date.now()}.md`, balanceGateToMarkdown(lastResult));
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(saveMd);

    const saveJson = el("button", "", "JSON 저장");
    saveJson.onclick = async () => {
      if (!lastResult) return;
      try {
        const p = await writeReport(`randi-balance-${Date.now()}.json`, balanceGateToJson(lastResult));
        toast(`저장: ${p}`, "ok", 4000);
      } catch {
        toast("저장 실패", "danger");
      }
    };
    row.appendChild(saveJson);

    const closeBtn = el("button", "", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}

// ---------- 도움말 ----------

export function openHelpModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "단축키"));
    const table = el("table", "kv-table");
    const rows: Array<[string, string]> = [
      ["Space", "다음 라운드 시작 / 진행 중 일시정지"],
      ["Z", "소환"],
      ["X", "선택한 3기 합성"],
      ["Delete / Backspace", "선택 유닛 판매"],
      ["A → 좌클릭", "공격 이동"],
      ["S", "정지(Hold) — 제자리 대기"],
      ["L", "선택 유닛 잠금 토글"],
      ["Q / W / E", "속도 x1 / x2 / x3"],
      ["Ctrl + 1~9", "선택을 부대로 저장"],
      ["1~9", "저장된 부대 선택"],
      ["Esc", "공격이동 취소 / 모달 닫기 / 일시정지 메뉴"],
    ];
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("td", "", k));
      tr.appendChild(el("td", "", v));
      table.appendChild(tr);
    }
    body.appendChild(table);
    body.appendChild(el("h3", "", "규칙 요약"));
    body.appendChild(el("div", "",
      "소환·3합성·지정 조합·판매·업그레이드는 전투 중을 포함해 상시 가능합니다(게임 종료 후 제외). 잠금(🔒) 유닛은 판매와 조합 재료에서 보호됩니다. 조합/미션/보스 탭은 우측 패널의 탭을 클릭해 전환합니다."));
    const row = el("div", "row-btns");
    const ok = el("button", "primary", "닫기");
    ok.onclick = close;
    row.appendChild(ok);
    body.appendChild(row);
  });
}

export function openAboutModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "차원 균열 랜덤 디펜스"));
    body.appendChild(el("div", "", "오리지널 IP 기반 2D 랜덤 디펜스 MVP 프로토타입. 에셋 없이 도형과 색으로만 표현합니다."));
    body.appendChild(el("div", "", `실행 환경: ${isTauri() ? "Tauri 데스크탑" : "브라우저 (저장은 localStorage)"}`));
    const row = el("div", "row-btns");
    if (isTauri()) {
      const dir = el("button", "", "앱 데이터 폴더 열기");
      dir.onclick = () => void openAppDataDir();
      row.appendChild(dir);
    }
    const ok = el("button", "primary", "닫기");
    ok.onclick = close;
    row.appendChild(ok);
    body.appendChild(row);
  });
}
