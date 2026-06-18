// 전투판 경로와 유닛 배치 (논리 좌표계 960x560)
// 적 경로는 스테이지별 waypoint 루프를 따른다. 적은 끝에 닿으면 계속 순환한다.
// 아군 유닛은 공통 활동 영역 안에서만 움직인다.

import { stageForRound } from "../data/stages";

export const BOARD_W = 960;
export const BOARD_H = 560;

/** 아군 활동 영역을 정하기 위한 공통 외곽 */
export const FIELD = { left: 80, top: 70, right: 880, bottom: 490 };

export const WAYPOINTS: Array<[number, number]> = stageForRound(1).waypoints;

interface Segment { x: number; y: number; dx: number; dy: number; len: number; start: number; }

function buildSegments(waypoints: Array<[number, number]>): { segments: Segment[]; length: number } {
  const segments: Segment[] = [];
  let acc = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const [x1, y1] = waypoints[i];
    const [x2, y2] = waypoints[(i + 1) % waypoints.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len <= 0) continue;
    segments.push({ x: x1, y: y1, dx: (x2 - x1) / len, dy: (y2 - y1) / len, len, start: acc });
    acc += len;
  }
  return { segments, length: acc };
}

const pathCache = new Map<number, { segments: Segment[]; length: number }>();

function pathForRound(round: number): { segments: Segment[]; length: number } {
  const stage = stageForRound(round);
  const cached = pathCache.get(stage.id);
  if (cached) return cached;
  const built = buildSegments(stage.waypoints);
  pathCache.set(stage.id, built);
  return built;
}

/** 루프 한 바퀴 길이(둘레) */
export const PATH_LENGTH = pathForRound(1).length;

export function pathLengthForRound(round: number): number {
  return pathForRound(round).length;
}

export function waypointsForRound(round: number): Array<[number, number]> {
  return stageForRound(round).waypoints;
}

// ===== 배치/충돌 파라미터 =====
/** 적 경로 stroke 폭(px) — board 렌더러와 동일 */
export const PATH_WIDTH = 34;
/** 유닛 표시 반경(px) */
export const UNIT_RADIUS = 12;
/** 유닛이 경로(둘레)에서 안쪽으로 떨어져야 하는 여유 */
export const PATH_CLEARANCE = PATH_WIDTH / 2 + UNIT_RADIUS; // 29
/** 유닛 간 최소 중심 거리(겹침 방지) */
export const UNIT_MIN_DIST = 26;

/** 유닛이 머무를 수 있는 내부 영역 (둘레에서 clearance 안쪽) */
export const INNER = {
  left: FIELD.left + PATH_CLEARANCE,
  top: FIELD.top + PATH_CLEARANCE,
  right: FIELD.right - PATH_CLEARANCE,
  bottom: FIELD.bottom - PATH_CLEARANCE,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** 좌표를 아군 활동 영역(사각형 내부)으로 가둔다. 둘레/바깥으로 못 나간다. */
export function clampToField(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, INNER.left, INNER.right),
    y: clamp(y, INNER.top, INNER.bottom),
  };
}

/** 루프 거리(dist)에 해당하는 경로 좌표. dist는 스테이지 경로 둘레로 wrap된다. */
export function posAtDist(dist: number, round = 1): { x: number; y: number } {
  const path = pathForRound(round);
  let d = dist % path.length;
  if (d < 0) d += path.length;
  for (const s of path.segments) {
    if (d <= s.start + s.len) {
      const t = d - s.start;
      return { x: s.x + s.dx * t, y: s.y + s.dy * t };
    }
  }
  const first = stageForRound(round).waypoints[0];
  return { x: first[0], y: first[1] };
}

/** 유닛 기본 배치 앵커 (사각형 내부 격자) */
export const SLOTS: Array<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = [];
  const rows = [150, 230, 310, 390];
  for (const y of rows) {
    for (let i = 0; i < 12; i++) out.push({ x: 160 + i * 58, y });
  }
  return out;
})();
