// 선택권 / 결과 / 새 게임 / 저장 슬롯 / 시뮬레이션 모달

import type { AppCtx } from "./ctx";
import { el, openModal, toast } from "./widgets";
import { GRADE_LABEL, FAMILY_LABEL, ROLE_LABEL, type ResultSummary } from "../core/types";
import { UNIT_BY_ID } from "../data/units";
import { DIFFICULTIES } from "../data/difficulty";
import { randomSeed } from "../core/rng";
import { stateChecksum } from "../core/checksum";
import {
  deleteSlot, listSlots, loadSlot, makeSaveRecord, recordResult,
  saveSlot, writeReport, isTauri, openAppDataDir, type SlotMeta,
} from "../save/saveApi";
import { replay } from "../core/engine";
import { runSimulation, reportToMarkdown } from "../sim/runner";
import { FAMILY_COLOR, GRADE_COLOR } from "./board";

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

export function buildReportMarkdown(r: ResultSummary): string {
  const lines = [
    `# 차원 균열 랜덤 디펜스 결과`,
    ``,
    `- 결과: ${r.cleared ? "클리어 🎉" : "패배"}`,
    `- 도달 스테이지: ${r.reachedRound}`,
    `- 시드: \`${r.seed}\` / 난이도: ${r.difficulty} / 데이터 버전: ${r.dataVersion}`,
    `- 남은 라이프: ${r.life}`,
    `- 최고 등급: ${GRADE_LABEL[r.maxGrade]}`,
    `- 미션: ${r.missionsDone}/${r.missionsTotal}`,
    `- 조합 ${r.craftCount}회 · 3합성 ${r.merge3Count}회 · 보정 발동 ${r.pityTriggered}회`,
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
  ctx.audio.sfx(summary.cleared ? "victory" : "defeat");
  void recordResult(summary).catch(() => toast("결과 저장 실패", "danger"));

  openModal((body, close) => {
    body.appendChild(el("h2", "", summary.cleared ? "🎉 15스테이지 클리어!" : `${summary.reachedRound}스테이지에서 패배`));

    const grid = el("div", "result-stats");
    const kv = (k: string, v: string) => {
      grid.appendChild(el("span", "k", k));
      grid.appendChild(el("span", "", v));
    };
    kv("시드", summary.seed);
    kv("난이도", summary.difficulty);
    kv("최고 등급", GRADE_LABEL[summary.maxGrade]);
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

    const titleBtn = el("button", "", "타이틀로");
    titleBtn.onclick = () => { resetResultShown(); close(); ctx.goTitle(); };
    row.appendChild(titleBtn);

    const sameSeed = el("button", "", "같은 시드 재시작");
    sameSeed.onclick = () => { resultShown = false; close(); ctx.newRun(summary.seed, ctx.game.state.difficulty); };
    row.appendChild(sameSeed);

    const newBtn = el("button", "primary", "새 게임");
    newBtn.onclick = () => { resultShown = false; close(); openNewRunModal(ctx); };
    row.appendChild(newBtn);

    body.appendChild(row);
  }, false);
}

export function resetResultShown() { resultShown = false; }

// ---------- 새 게임 ----------

export function openNewRunModal(ctx: AppCtx, dismissable = true) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "새 게임"));

    body.appendChild(el("h3", "", "난이도"));
    let chosen = "novice";
    const diffRow = el("div", "choice-grid");
    const diffBtns: HTMLButtonElement[] = [];
    for (const d of DIFFICULTIES) {
      const b = el("button", "choice-btn") as HTMLButtonElement;
      b.appendChild(el("span", "cname", d.name));
      b.appendChild(el("span", "cdesc", `보유 ${d.unitCap}기 · 적 체력 x${d.enemyHpMult} · 시작 ${d.startGold}골드`));
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
      ctx.newRun(seed, chosen as "novice" | "normal");
    };
    row.appendChild(start);
    body.appendChild(row);
  }, dismissable);
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
        ? `${meta.round}R · ${meta.difficulty} · 시드 ${meta.seed} · ${new Date(meta.savedAt).toLocaleString()}`
        : "비어 있음"));
      card.appendChild(left);
      card.onclick = async () => {
        try {
          const s = ctx.game.state;
          await saveSlot(slotId, makeSaveRecord({
            seed: s.seed, difficulty: s.difficulty,
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
        `${meta.round}R · 라이프 ${meta.life} · ${meta.difficulty} · 시드 ${meta.seed} · v${meta.dataVersion} · ${new Date(meta.savedAt).toLocaleString()}`));
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
          const replayed = replay(rec.seed, rec.difficulty, rec.inputHistory, rec.tick);
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

// ---------- 도움말 ----------

export function openHelpModal() {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "단축키"));
    const table = el("table", "kv-table");
    const rows: Array<[string, string]> = [
      ["Space", "다음 스테이지 시작 / 진행 중 일시정지"],
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
