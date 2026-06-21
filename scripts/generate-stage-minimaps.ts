import { mkdirSync, writeFileSync } from "node:fs";
import { STAGES, type StageDef, type StageDecorationKind } from "../src/data/stages";

const OUT_DIR = "public/stage-minimaps";
const VIEW_W = 320;
const VIEW_H = 200;
const MAP_W = 960;
const MAP_H = 560;
const PAD = 14;

const GROUND_COLOR: Record<StageDef["ground"], { base: string; grid: string; tint: string }> = {
  dirt: { base: "#2a211a", grid: "#4d3d2c", tint: "#7b5a39" },
  ash: { base: "#25262a", grid: "#484a4f", tint: "#8a8d92" },
  grass: { base: "#1f2d20", grid: "#3f623e", tint: "#6f9f58" },
  stone: { base: "#252833", grid: "#515668", tint: "#8c93a6" },
  corrupt: { base: "#211b2b", grid: "#523d70", tint: "#8b5cc0" },
  blood: { base: "#2d1719", grid: "#633238", tint: "#b74e58" },
  rune: { base: "#161f2d", grid: "#2e5d7c", tint: "#50a4c8" },
};

const DECORATION_COLOR: Record<StageDecorationKind, string> = {
  cottage: "#c08a5a",
  stoneHouse: "#9da2aa",
  witchHut: "#9968b8",
  rootHouse: "#8b6a42",
  manor: "#bdc0c9",
  forge: "#d5763a",
  crypt: "#9b9fb0",
  deadTree: "#6d5a45",
  oak: "#5f9b4b",
  rottenTree: "#665c40",
  soulTree: "#60d0c8",
  specialTree: "#91d062",
  thornBush: "#6e9445",
  poisonBush: "#8dbc4a",
  berryBush: "#b84c70",
  grave: "#a4a6ad",
  coffin: "#8a5440",
  shrine: "#d3ca8a",
  fenceWood: "#9a7043",
  fenceIron: "#8b94a4",
  gate: "#b48a54",
  market: "#d39a4f",
  well: "#6aa0b8",
  cart: "#a66e3c",
  farmlandDead: "#6c5439",
  farmlandSprouts: "#6c9f45",
  farmlandCursed: "#7f4aa5",
  rocks: "#9a9488",
  runeStone: "#5fc2d8",
  mushrooms: "#d26ca3",
  web: "#d5d8de",
};

function sx(x: number): number {
  return Math.round((PAD + (x / MAP_W) * (VIEW_W - PAD * 2)) * 10) / 10;
}

function sy(y: number): number {
  return Math.round((PAD + (y / MAP_H) * (VIEW_H - PAD * 2)) * 10) / 10;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathData(stage: StageDef): string {
  return stage.waypoints
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${sx(x)} ${sy(y)}`)
    .join(" ");
}

function decorationRadius(kind: StageDecorationKind, scale = 1): number {
  const large = new Set<StageDecorationKind>(["manor", "market", "crypt", "witchHut", "forge", "rootHouse", "cottage", "stoneHouse"]);
  const tiny = new Set<StageDecorationKind>(["grave", "web", "mushrooms", "rocks", "runeStone"]);
  const base = large.has(kind) ? 8 : tiny.has(kind) ? 4.5 : 5.8;
  return Math.round(base * scale * 10) / 10;
}

function renderStage(stage: StageDef): string {
  const colors = GROUND_COLOR[stage.ground];
  const first = stage.waypoints[0];
  const last = stage.waypoints[stage.waypoints.length - 1];
  const gridLines = Array.from({ length: 7 }, (_, index) => {
    const x = Math.round((index + 1) * (VIEW_W / 8));
    const y = Math.round((index + 1) * (VIEW_H / 8));
    return `<path d="M ${x} 0 V ${VIEW_H} M 0 ${y} H ${VIEW_W}" stroke="${colors.grid}" stroke-opacity=".18" stroke-width="1"/>`;
  }).join("\n  ");
  const decorations = stage.decorations.map((item) => (
    `<circle cx="${sx(item.x)}" cy="${sy(item.y)}" r="${decorationRadius(item.kind, item.scale)}" fill="${DECORATION_COLOR[item.kind]}" fill-opacity=".82" stroke="#0b0e16" stroke-width="1.4"/>`
  )).join("\n  ");
  const waypoints = stage.waypoints.map(([x, y], index) => (
    `<circle cx="${sx(x)}" cy="${sy(y)}" r="${index === 0 || index === stage.waypoints.length - 1 ? 4.2 : 2.7}" fill="#f8f3d0" fill-opacity="${index === 0 || index === stage.waypoints.length - 1 ? ".95" : ".55"}"/>`
  )).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="${escapeXml(stage.name)} 미니맵">
  <rect width="${VIEW_W}" height="${VIEW_H}" rx="16" fill="${colors.base}"/>
  <rect x="7" y="7" width="${VIEW_W - 14}" height="${VIEW_H - 14}" rx="12" fill="${colors.tint}" fill-opacity=".08" stroke="${colors.tint}" stroke-opacity=".28"/>
  ${gridLines}
  ${decorations}
  <path d="${pathData(stage)}" fill="none" stroke="#05070b" stroke-opacity=".65" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${pathData(stage)}" fill="none" stroke="#d7c08a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${pathData(stage)}" fill="none" stroke="#fff1b8" stroke-opacity=".52" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${waypoints}
  <circle cx="${sx(first[0])}" cy="${sy(first[1])}" r="6.2" fill="#6ee0a0" stroke="#0b0e16" stroke-width="1.5"/>
  <circle cx="${sx(last[0])}" cy="${sy(last[1])}" r="6.2" fill="#e85c66" stroke="#0b0e16" stroke-width="1.5"/>
  <text x="14" y="184" fill="#f3f6ff" font-family="Arial, sans-serif" font-size="13" font-weight="700">${stage.id}. ${escapeXml(stage.name)}</text>
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const stage of STAGES) {
  const fileName = `stage-${String(stage.id).padStart(2, "0")}.svg`;
  writeFileSync(`${OUT_DIR}/${fileName}`, renderStage(stage), "utf8");
}

console.log(`generated ${STAGES.length} stage minimaps in ${OUT_DIR}`);
