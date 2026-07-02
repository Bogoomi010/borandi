import { Application, Container } from "pixi.js";
import { VW, VH } from "../ui/theme";

export interface Scene {
  readonly root: Container;
  update(dt: number): void;
  destroy(): void;
}

export type SceneFactory = (mgr: SceneManager) => Scene;

export class SceneManager {
  readonly app: Application;
  readonly stageRoot = new Container();
  private current: Scene | null = null;

  constructor(app: Application) {
    this.app = app;
    app.stage.addChild(this.stageRoot);
    const resize = () => {
      const sw = app.renderer.width / app.renderer.resolution;
      const sh = app.renderer.height / app.renderer.resolution;
      const scale = Math.min(sw / VW, sh / VH);
      this.stageRoot.scale.set(scale);
      this.stageRoot.position.set((sw - VW * scale) / 2, (sh - VH * scale) / 2);
    };
    app.renderer.on("resize", resize);
    resize();
    app.ticker.add((t) => {
      this.current?.update(t.deltaMS / 1000);
    });
  }

  goto(factory: SceneFactory): void {
    if (this.current) {
      this.stageRoot.removeChild(this.current.root);
      this.current.destroy();
      this.current = null;
    }
    const scene = factory(this);
    this.current = scene;
    this.stageRoot.addChild(scene.root);
  }
}
