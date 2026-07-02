import { Container, Graphics, Text } from "pixi.js";
import type { Scene, SceneManager } from "./SceneManager";
import { createStageSelectScene } from "./StageSelectScene";
import { VW, VH, fontBold, font } from "../ui/theme";
import { UiButton } from "../ui/widgets";
import { RiftBackdrop } from "../ui/RiftBackdrop";

export function createTitleScene(mgr: SceneManager): Scene {
  const root = new Container();
  let time = 0;

  const backdrop = new RiftBackdrop({});
  root.addChild(backdrop);

  const logoBox = new Container();
  const eyebrow = new Text({
    text: "B O R A N D I  /  RANDOM DEFENSE",
    style: fontBold(13, 0xe7b53e, { letterSpacing: 6 }),
  });
  eyebrow.anchor.set(0.5);
  eyebrow.position.set(0, -86);

  const logo = new Text({
    text: "BORANDI",
    style: fontBold(64, 0xf6d365, {
      align: "center",
      lineHeight: 74,
      letterSpacing: 4,
      stroke: { color: 0x1a1205, width: 4 },
    }),
  });
  logo.anchor.set(0.5);
  logo.position.set(0, 12);

  const rule = new Graphics();
  rule.moveTo(-190, 96).lineTo(190, 96).stroke({ color: 0xe7b53e, width: 1.5, alpha: 0.5 });
  rule.poly([0, 88, 7, 96, 0, 104, -7, 96]).fill(0xe7b53e);
  rule.poly([-200, 92, -190, 96, -200, 100]).fill({ color: 0xe7b53e, alpha: 0.6 });
  rule.poly([200, 92, 190, 96, 200, 100]).fill({ color: 0xe7b53e, alpha: 0.6 });

  const tagline = new Text({
    text: "Choose a map, survive 40 rounds, and unlock the next battlefield.",
    style: font(14, { fill: 0x9fb2c7 }),
  });
  tagline.anchor.set(0.5);
  tagline.position.set(0, 122);

  logoBox.addChild(eyebrow, logo, rule, tagline);
  logoBox.position.set(VW / 2, 216);
  root.addChild(logoBox);

  const helpPanel = new Container();
  const hp = new Graphics();
  hp.roundRect(0, 0, 560, 232, 10).fill({ color: 0x151b24, alpha: 0.96 })
    .stroke({ color: 0x384452, width: 1.5 });
  hp.rect(0, 0, 3, 232).fill({ color: 0xe7b53e, alpha: 0.9 });

  const helpText = new Text({
    text: [
      "1. Spend gold to summon random units.",
      "2. Merge three matching units into a higher grade.",
      "3. Use hidden recipes to create stronger heroes.",
      "4. Defeat enemies before they reach the rift.",
      "5. Boss rounds are 10, 20, 30, and 40.",
      "6. Clearing round 40 unlocks the next map.",
    ].join("\n"),
    style: font(15, { fill: 0x9fb2c7, lineHeight: 30 }),
  });
  helpText.position.set(26, 22);
  helpPanel.addChild(hp, helpText);
  helpPanel.position.set(VW / 2 + 200, 400);
  helpPanel.visible = false;
  root.addChild(helpPanel);

  const toggleHelp = () => {
    helpPanel.visible = !helpPanel.visible;
  };

  const menu = new Container();
  const mkMenuButton = (label: string, hint: string, y: number, tone: "primary" | "normal", onClick: () => void) => {
    const b = new UiButton({ width: 300, height: 54, label, sub: hint, tone, fontSize: 17, onClick });
    b.position.set(-150, y);
    menu.addChild(b);
    return b;
  };
  mkMenuButton("Start Run", "Select battlefield", 0, "primary", () => mgr.goto(createStageSelectScene));
  mkMenuButton("How To Play", "Open rules", 66, "normal", toggleHelp);
  mkMenuButton("Quit", "Close window", 132, "normal", () => {
    window.close();
  });
  menu.position.set(VW / 2, 420);
  root.addChild(menu);

  const ver = new Text({ text: "v0.2.0 / rift rebuild", style: font(11, { fill: 0x687589 }) });
  ver.position.set(14, VH - 26);
  root.addChild(ver);

  return {
    root,
    update(dt: number) {
      time += dt;
      backdrop.update(dt);
      logoBox.y = 216 + Math.sin(time * 0.8) * 4;
    },
    destroy() {
      root.destroy({ children: true });
    },
  };
}
