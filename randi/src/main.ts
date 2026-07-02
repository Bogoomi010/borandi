import { Application } from "pixi.js";
import { SceneManager } from "./scenes/SceneManager";
import { createTitleScene } from "./scenes/TitleScene";

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    background: 0x0b0d12,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  });
  document.getElementById("app")!.appendChild(app.canvas);

  const mgr = new SceneManager(app);
  mgr.goto(createTitleScene);

  // 테스트/자동화 훅
  (window as unknown as Record<string, unknown>).__randi = { app, mgr };
}

void boot();
