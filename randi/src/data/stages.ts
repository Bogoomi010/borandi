import type { StageDef } from "../core/types";

// 보드 좌표계는 1280x720. 전투 필드는 상단 HUD(~88px)와 하단 패널(~170px)을 피한다.
const CX = 640;
const CY = 328;

function ellipse(rx: number, ry: number, n = 12, rot = 0): { x: number; y: number }[] {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    pts.push({ x: Math.round(CX + Math.cos(a) * rx), y: Math.round(CY + Math.sin(a) * ry) });
  }
  return pts;
}

export const STAGES: StageDef[] = [
  {
    id: "sky_island",
    name: "하늘 섬",
    subtitle: "떠 있는 초원의 원형 순환로",
    loop: ellipse(305, 196),
    theme: {
      ground: 0x39503a, groundDark: 0x2c3f2e, path: 0x8a7a5a, pathEdge: 0x5f5138,
      accent: 0x9fd08a, fog: 0x1c2820,
      skyTop: 0x2e5d8f, skyBottom: 0x8fc0e0, cloudAlpha: 0.16,
    },
  },
  {
    id: "under_dungeon",
    name: "지하 던전",
    subtitle: "각진 석조 회랑",
    loop: [
      { x: 320, y: 168 }, { x: 640, y: 148 }, { x: 960, y: 168 },
      { x: 1030, y: 330 }, { x: 960, y: 492 }, { x: 640, y: 516 },
      { x: 320, y: 492 }, { x: 250, y: 330 },
    ],
    theme: {
      ground: 0x33313e, groundDark: 0x272531, path: 0x59566b, pathEdge: 0x3d3a4d,
      accent: 0x9b7bf0, fog: 0x17151f,
      skyTop: 0x0f0c18, skyBottom: 0x2c2440, cloudAlpha: 0,
    },
  },
  {
    id: "mystic_shore",
    name: "신비한 해변",
    subtitle: "달빛 산호 물길",
    loop: [
      { x: 350, y: 205 }, { x: 610, y: 145 }, { x: 905, y: 190 },
      { x: 1015, y: 330 }, { x: 930, y: 470 }, { x: 640, y: 520 },
      { x: 355, y: 480 }, { x: 245, y: 340 },
    ],
    theme: {
      ground: 0x8b7f5c, groundDark: 0x6f6547, path: 0x4a8f9c, pathEdge: 0x33646f,
      accent: 0x66e0d5, fog: 0x233230,
      skyTop: 0x1e4a5c, skyBottom: 0x7ab8ae, cloudAlpha: 0.12,
    },
  },
  {
    id: "snow_forest",
    name: "눈 덮인 숲",
    subtitle: "얼어붙은 침엽수 순환로",
    loop: [
      { x: 640, y: 140 }, { x: 900, y: 210 }, { x: 1010, y: 330 },
      { x: 900, y: 452 }, { x: 640, y: 522 }, { x: 380, y: 452 },
      { x: 270, y: 330 }, { x: 380, y: 210 },
    ],
    theme: {
      ground: 0x8e9aa8, groundDark: 0x717d8c, path: 0xd7dee8, pathEdge: 0x9fabbd,
      accent: 0xbfe3ff, fog: 0x27313d,
      skyTop: 0x51708f, skyBottom: 0xc4d6e6, cloudAlpha: 0.22,
    },
  },
  {
    id: "endless_cross",
    name: "끝없는 갈림길",
    subtitle: "뒤틀린 협곡의 땅",
    loop: [
      { x: 400, y: 180 }, { x: 640, y: 250 }, { x: 880, y: 180 },
      { x: 1020, y: 300 }, { x: 900, y: 460 }, { x: 640, y: 400 },
      { x: 380, y: 460 }, { x: 258, y: 300 },
    ],
    theme: {
      ground: 0x4c4636, groundDark: 0x3b3629, path: 0x7d6d4e, pathEdge: 0x584c34,
      accent: 0xd8b45f, fog: 0x211d14,
      skyTop: 0x3a2418, skyBottom: 0xc08048, cloudAlpha: 0.10,
    },
  },
];

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
);
