import { Container } from "pixi.js";
import type { Scene, SceneManager } from "./SceneManager";
import { createStageSelectScene } from "./StageSelectScene";
import { createTitleScene } from "./TitleScene";
import { Game, TICK } from "../core/engine";
import type { DifficultyDef, StageDef } from "../core/types";
import { loadProfile, recordResult } from "../profile";
import { RiftBackdrop } from "../ui/RiftBackdrop";
import { sfx, toggleMute } from "../audio/sfx";
import { UNIT_BY_ID } from "../data/units";
import { BoardView } from "./battle/BoardView";
import { TopHud, CenterStatus, LeftRoster, LogFeed } from "./battle/HudViews";
import { BottomPanel } from "./battle/BottomPanel";
import {
  RecipeToast, buildPauseModal, buildRecipeBook, buildResultModal,
  buildSelectorModal, buildUpgradeModal,
} from "./battle/Popups";

export interface BattleParams {
  stage: StageDef;
  difficulty: DifficultyDef;
  seed: number;
}

export function createBattleScene(mgr: SceneManager, params: BattleParams): Scene {
  const root = new Container();
  const game = new Game(params.seed, params.stage, params.difficulty);

  let speed = 1;
  let paused = false;
  let acc = 0;
  let selectedUid = 0;
  let modal: Container | null = null;
  let modalKind: "none" | "pause" | "recipes" | "selector" | "result" | "upgrades" = "none";
  let resultRecorded = false;
  let unlockedNew = false;

  // ===== 뷰 구성 =====
  // 메뉴와 동일한 '차원 균열' 배경. 글로우만 스테이지 악센트 색으로 물들인다.
  const sky = new RiftBackdrop({ glow: params.stage.theme.accent, count: 28, glowY: 0.46 });
  const board = new BoardView(game);
  const topHud = new TopHud(game, () => togglePause(), (s) => { speed = s; }, () => speed);
  const center = new CenterStatus(game, () => { game.startRound(); });
  const roster = new LeftRoster(game);
  const logFeed = new LogFeed();
  const recipeToast = new RecipeToast(game);
  const bottom = new BottomPanel(game, {
    onSummon: () => { game.summon(); },
    onMerge: () => doMerge(),
    onRecipe: () => toggleRecipeBook(),
    onSell: () => doSell(),
    onUpgrade: () => toggleUpgrades(),
  });
  bottom.getSelected = () => selectedUid;
  bottom.onPickDef = (defId) => {
    const u = game.units.find((x) => x.defId === defId);
    if (u) selectedUid = u.uid;
  };
  recipeToast.onCraft = (id) => { game.craft(id, selectedUid || undefined); };
  root.addChild(sky, board, recipeToast, topHud, center, roster, logFeed, bottom);

  // ===== 보드 입력 =====
  board.onUnitTap = (uid) => { selectedUid = selectedUid === uid ? 0 : uid; };
  board.onSlotTap = (slotId) => {
    if (selectedUid) game.moveUnit(selectedUid, slotId);
  };
  board.onGroundTap = () => { selectedUid = 0; };

  // ===== 행동 =====
  function doMerge(): void {
    if (selectedUid && game.unitByUid(selectedUid)) {
      const r = game.merge3(selectedUid);
      if (r.ok) selectedUid = 0;
      return;
    }
    const defs = game.mergeableDefs();
    if (defs.length > 0) {
      const u = game.units.find((x) => x.defId === defs[0]);
      if (u) game.merge3(u.uid);
    }
  }

  function doSell(): void {
    if (!selectedUid) return;
    game.sell(selectedUid);
    selectedUid = 0;
  }

  // ===== 모달 =====
  function closeModal(): void {
    if (modal) { root.removeChild(modal); modal.destroy({ children: true }); modal = null; }
    modalKind = "none";
  }

  function openModal(kind: typeof modalKind, view: Container): void {
    closeModal();
    modal = view;
    modalKind = kind;
    root.addChild(view);
  }

  function togglePause(): void {
    if (modalKind === "pause") { paused = false; closeModal(); return; }
    if (modalKind !== "none") return;
    paused = true;
    openModal("pause", buildPauseModal(
      () => { paused = false; closeModal(); },
      () => mgr.goto(createStageSelectScene),
      () => mgr.goto(createTitleScene),
    ));
  }

  function toggleUpgrades(): void {
    if (modalKind === "upgrades") { paused = false; closeModal(); return; }
    if (modalKind !== "none") return;
    paused = true;
    const open = (): void => {
      openModal("upgrades", buildUpgradeModal(
        game,
        (family) => {
          if (game.buyUpgrade(family).ok) {
            sfx.upgrade();
            open(); // 갱신된 비용/레벨로 다시 그림
          }
        },
        () => { paused = false; closeModal(); },
      ));
    };
    open();
  }

  function toggleRecipeBook(): void {
    if (modalKind === "recipes") { paused = false; closeModal(); return; }
    if (modalKind !== "none") return;
    paused = true;
    openModal("recipes", buildRecipeBook(
      game,
      (id) => {
        game.craft(id, selectedUid || undefined);
        paused = false;
        closeModal();
      },
      () => { paused = false; closeModal(); },
    ));
  }

  // ===== 키보드 =====
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    switch (e.code) {
      case "KeyS": if (modalKind === "none") game.summon(); break;
      case "KeyD": if (modalKind === "none") doMerge(); break;
      case "KeyX": if (modalKind === "none") doSell(); break;
      case "KeyR": toggleRecipeBook(); break;
      case "KeyU": toggleUpgrades(); break;
      case "KeyM": toggleMute(); break;
      case "Space":
        e.preventDefault();
        if (modalKind === "none") game.startRound();
        break;
      case "Digit1": speed = 1; break;
      case "Digit2": speed = 2; break;
      case "Digit3": speed = 3; break;
      case "Escape": togglePause(); break;
      default: break;
    }
  };
  window.addEventListener("keydown", onKey);

  // ===== 이벤트 → 로그/연출 =====
  function routeEvents(): void {
    const events = game.drainEvents();
    board.handleEvents(events);
    for (const ev of events) {
      switch (ev.type) {
        case "log":
          logFeed.push(ev.text ?? "", 0xcfd6e2);
          break;
        case "pity":
          logFeed.push(ev.text ?? "", 0x9fe085);
          sfx.warn();
          break;
        case "roundClear":
          logFeed.push(`— ${ev.amount}R 클리어 ${ev.text} —`, 0xffd77a);
          break;
        case "roundStart": sfx.roundStart(); break;
        case "summon":
          if (ev.unitDefId && UNIT_BY_ID[ev.unitDefId].grade !== "common") sfx.rareSummon();
          else sfx.summon();
          break;
        case "merge": sfx.merge(); break;
        case "craft": case "selectorReward": sfx.craft(); break;
        case "sell": sfx.sell(); break;
        case "kill": sfx.kill(); break;
        case "hit": if (ev.uid !== undefined && ev.amount === undefined) sfx.shot(); break;
        case "bossSpawn": sfx.bossWarn(); break;
        case "bossKill": sfx.bossKill(); break;
        case "defeat": case "victory":
          if (ev.type === "victory") sfx.victory(); else sfx.defeat();
          onGameEnd(ev.type === "victory");
          break;
        default: break;
      }
    }
    // 보스 보상 선택 모달
    if (game.selectorOffer && modalKind === "none") {
      paused = true;
      openModal("selector", buildSelectorModal(game, (i) => {
        game.chooseSelector(i);
        paused = false;
        closeModal();
      }));
    }
  }

  function onGameEnd(victory: boolean): void {
    if (resultRecorded) return;
    resultRecorded = true;
    const before = loadProfile();
    const after = recordResult(before, game.stage.id, game.difficulty.id, game.round, victory);
    unlockedNew = after.unlockedStages > before.unlockedStages;
    paused = true;
    openModal("result", buildResultModal(
      game, victory, unlockedNew,
      () => mgr.goto((m) => createBattleScene(m, { ...params, seed: (params.seed + 1) >>> 0 })),
      () => mgr.goto(createStageSelectScene),
    ));
  }

  return {
    root,
    update(dt: number) {
      sky.update(dt);
      if (!paused) {
        acc += Math.min(dt, 0.25) * speed;
        let ticks = 0;
        board.captureprev();
        while (acc >= TICK && ticks < 30) {
          game.tick();
          acc -= TICK;
          ticks++;
        }
        routeEvents();
      }
      // 선택 유닛이 사라졌으면 해제
      if (selectedUid && !game.unitByUid(selectedUid)) selectedUid = 0;
      board.selectedUid = selectedUid;
      board.render_(paused ? 1 : acc / TICK, dt);
      topHud.refresh();
      center.refresh();
      roster.refresh();
      recipeToast.refresh();
      bottom.refresh();
      logFeed.update(dt);
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      root.destroy({ children: true });
    },
  };
}
