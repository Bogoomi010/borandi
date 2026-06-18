export type StageDecorationKind =
  | "cottage" | "stoneHouse" | "witchHut" | "rootHouse" | "manor"
  | "forge" | "crypt" | "deadTree" | "oak" | "rottenTree" | "soulTree"
  | "specialTree" | "thornBush" | "poisonBush" | "berryBush"
  | "grave" | "coffin" | "shrine" | "fenceWood" | "fenceIron" | "gate"
  | "market" | "well" | "cart" | "farmlandDead" | "farmlandSprouts" | "farmlandCursed"
  | "rocks" | "runeStone" | "mushrooms" | "web";

export interface StageDecoration {
  kind: StageDecorationKind;
  x: number;
  y: number;
  scale?: number;
}

export interface StageDef {
  id: number;
  name: string;
  subtitle: string;
  ground: "dirt" | "ash" | "grass" | "stone" | "corrupt" | "blood" | "rune";
  waypoints: Array<[number, number]>;
  decorations: StageDecoration[];
}

export const STAGES: StageDef[] = [
  {
    id: 1, name: "Rotten Crossroads", subtitle: "abandoned entry road", ground: "dirt",
    waypoints: [[80, 80], [880, 80], [880, 480], [80, 480]],
    decorations: [
      { kind: "cottage", x: 128, y: 154, scale: 0.72 }, { kind: "deadTree", x: 742, y: 168, scale: 0.78 },
      { kind: "fenceWood", x: 156, y: 418, scale: 0.9 }, { kind: "well", x: 450, y: 270, scale: 0.95 },
      { kind: "rocks", x: 708, y: 402, scale: 1.1 },
    ],
  },
  {
    id: 2, name: "Ashen Switchback", subtitle: "zig-zag through burnt soil", ground: "ash",
    waypoints: [[90, 96], [430, 96], [430, 206], [820, 206], [820, 462], [130, 462], [130, 332], [685, 332]],
    decorations: [
      { kind: "rottenTree", x: 220, y: 146, scale: 0.8 }, { kind: "farmlandDead", x: 542, y: 118, scale: 0.8 },
      { kind: "stoneHouse", x: 622, y: 346, scale: 0.72 }, { kind: "mushrooms", x: 350, y: 420, scale: 1.15 },
    ],
  },
  {
    id: 3, name: "Deadgrass Loop", subtitle: "wide village pasture", ground: "grass",
    waypoints: [[110, 100], [822, 100], [822, 226], [512, 226], [512, 462], [110, 462]],
    decorations: [
      { kind: "oak", x: 618, y: 284, scale: 0.82 }, { kind: "berryBush", x: 708, y: 138, scale: 1 },
      { kind: "cart", x: 250, y: 320, scale: 1 }, { kind: "fenceWood", x: 670, y: 430, scale: 0.9 },
    ],
  },
  {
    id: 4, name: "Lantern Witch Road", subtitle: "crooked hut approach", ground: "corrupt",
    waypoints: [[94, 472], [94, 104], [360, 104], [360, 360], [584, 360], [584, 128], [842, 128], [842, 472]],
    decorations: [
      { kind: "witchHut", x: 204, y: 186, scale: 0.76 }, { kind: "poisonBush", x: 704, y: 312, scale: 1 },
      { kind: "runeStone", x: 482, y: 174, scale: 1.15 }, { kind: "web", x: 794, y: 418, scale: 1.2 },
    ],
  },
  {
    id: 5, name: "Forge Bend", subtitle: "first guardian stage", ground: "stone",
    waypoints: [[82, 102], [842, 102], [842, 278], [666, 278], [666, 470], [250, 470], [250, 266], [82, 266]],
    decorations: [
      { kind: "forge", x: 364, y: 188, scale: 0.82 }, { kind: "fenceIron", x: 736, y: 374, scale: 0.95 },
      { kind: "rocks", x: 154, y: 400, scale: 1.1 }, { kind: "gate", x: 120, y: 148, scale: 0.86 },
    ],
  },
  {
    id: 6, name: "Rooted Hamlet", subtitle: "houses swallowed by roots", ground: "corrupt",
    waypoints: [[104, 108], [490, 108], [490, 214], [850, 214], [850, 458], [566, 458], [566, 346], [104, 346]],
    decorations: [
      { kind: "rootHouse", x: 168, y: 186, scale: 0.8 }, { kind: "deadTree", x: 672, y: 286, scale: 0.78 },
      { kind: "thornBush", x: 388, y: 398, scale: 1 }, { kind: "farmlandSprouts", x: 660, y: 118, scale: 0.82 },
    ],
  },
  {
    id: 7, name: "Crypt Spiral", subtitle: "mausoleum ring", ground: "rune",
    waypoints: [[100, 94], [850, 94], [850, 466], [118, 466], [118, 178], [760, 178], [760, 380], [250, 380], [250, 272], [640, 272]],
    decorations: [
      { kind: "crypt", x: 394, y: 126, scale: 0.82 }, { kind: "grave", x: 186, y: 306, scale: 1 },
      { kind: "coffin", x: 646, y: 398, scale: 0.92 }, { kind: "shrine", x: 746, y: 282, scale: 0.92 },
    ],
  },
  {
    id: 8, name: "Blood Market", subtitle: "ruined trade square", ground: "blood",
    waypoints: [[92, 124], [305, 124], [305, 438], [500, 438], [500, 124], [704, 124], [704, 438], [878, 438]],
    decorations: [
      { kind: "market", x: 384, y: 236, scale: 1 }, { kind: "cart", x: 162, y: 332, scale: 0.98 },
      { kind: "manor", x: 722, y: 174, scale: 0.72 }, { kind: "berryBush", x: 610, y: 358, scale: 1 },
    ],
  },
  {
    id: 9, name: "Soulfruit Grove", subtitle: "glowing cursed orchard", ground: "grass",
    waypoints: [[112, 454], [112, 110], [284, 110], [284, 454], [474, 454], [474, 110], [674, 110], [674, 454], [852, 454]],
    decorations: [
      { kind: "soulTree", x: 344, y: 170, scale: 0.82 }, { kind: "soulTree", x: 704, y: 202, scale: 0.76 },
      { kind: "poisonBush", x: 178, y: 214, scale: 0.9 }, { kind: "runeStone", x: 540, y: 318, scale: 1 },
    ],
  },
  {
    id: 10, name: "Noble Ruin", subtitle: "second guardian stage", ground: "stone",
    waypoints: [[98, 94], [850, 94], [850, 190], [650, 190], [650, 364], [850, 364], [850, 468], [98, 468], [98, 364], [300, 364], [300, 190], [98, 190]],
    decorations: [
      { kind: "manor", x: 390, y: 206, scale: 0.95 }, { kind: "fenceIron", x: 190, y: 412, scale: 0.92 },
      { kind: "shrine", x: 720, y: 246, scale: 0.88 }, { kind: "rocks", x: 536, y: 428, scale: 1.1 },
    ],
  },
  {
    id: 11, name: "Cursed Orchard", subtitle: "split lanes around old roots", ground: "corrupt",
    waypoints: [[90, 286], [220, 108], [410, 108], [532, 286], [410, 464], [220, 464], [90, 286], [870, 286], [740, 108], [570, 108], [532, 286], [570, 464], [740, 464]],
    decorations: [
      { kind: "specialTree", x: 424, y: 194, scale: 0.82 }, { kind: "thornBush", x: 162, y: 402, scale: 1 },
      { kind: "deadTree", x: 720, y: 178, scale: 0.72 }, { kind: "farmlandCursed", x: 624, y: 374, scale: 0.82 },
    ],
  },
  {
    id: 12, name: "Broken Palisade", subtitle: "fenced war camp", ground: "dirt",
    waypoints: [[108, 98], [852, 98], [852, 456], [740, 456], [740, 202], [610, 202], [610, 456], [470, 456], [470, 202], [334, 202], [334, 456], [108, 456]],
    decorations: [
      { kind: "fenceWood", x: 205, y: 150, scale: 1 }, { kind: "fenceIron", x: 668, y: 150, scale: 1 },
      { kind: "forge", x: 418, y: 284, scale: 0.7 }, { kind: "cart", x: 124, y: 320, scale: 0.94 },
    ],
  },
  {
    id: 13, name: "Mausoleum Fork", subtitle: "forked grave road", ground: "ash",
    waypoints: [[90, 280], [300, 100], [850, 100], [650, 280], [850, 460], [300, 460], [90, 280], [470, 280]],
    decorations: [
      { kind: "crypt", x: 500, y: 166, scale: 0.72 }, { kind: "grave", x: 288, y: 340, scale: 0.95 },
      { kind: "coffin", x: 690, y: 340, scale: 0.88 }, { kind: "web", x: 778, y: 166, scale: 1.15 },
    ],
  },
  {
    id: 14, name: "Rune Labyrinth", subtitle: "tight cursed maze", ground: "rune",
    waypoints: [[96, 96], [850, 96], [850, 176], [174, 176], [174, 258], [850, 258], [850, 340], [174, 340], [174, 464], [850, 464]],
    decorations: [
      { kind: "runeStone", x: 455, y: 212, scale: 1.2 }, { kind: "witchHut", x: 650, y: 298, scale: 0.7 },
      { kind: "poisonBush", x: 300, y: 400, scale: 0.92 }, { kind: "shrine", x: 748, y: 124, scale: 0.85 },
    ],
  },
  {
    id: 15, name: "Ancient Cursed Tree", subtitle: "final guardian stage", ground: "corrupt",
    waypoints: [[92, 102], [868, 102], [868, 458], [92, 458], [92, 188], [760, 188], [760, 372], [214, 372], [214, 280], [612, 280]],
    decorations: [
      { kind: "specialTree", x: 402, y: 152, scale: 1.05 }, { kind: "gate", x: 118, y: 390, scale: 0.95 },
      { kind: "soulTree", x: 698, y: 250, scale: 0.8 }, { kind: "shrine", x: 248, y: 160, scale: 0.9 },
      { kind: "runeStone", x: 570, y: 410, scale: 1.2 },
    ],
  },
];

export const FINAL_STAGE = STAGES.length;
export const BOSS_ROUNDS = [5, 10, 15] as const;

export function stageForRound(round: number): StageDef {
  const idx = Math.max(0, Math.min(STAGES.length - 1, round - 1));
  return STAGES[idx];
}
