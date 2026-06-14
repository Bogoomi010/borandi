// 전투판 경로와 유닛 배치 (논리 좌표계 960x560)
// 적 경로 = 사각형 닫힌 루프(둘레). 적은 출발점에서 시계방향으로 계속 돈다(누수 없음).
// 아군 유닛은 사각형 "내부"에서만 돌아다니며 둘레의 적을 공격한다.

export const BOARD_W = 960;
export const BOARD_H = 560;

/** 적 루프 사각형 (둘레가 경로) */
export const FIELD = { left: 80, top: 70, right: 880, bottom: 490 };

/** 적 경로 waypoint — 사각형 시계방향, 닫힌 루프 (마지막→처음 자동 연결). 출발점=좌상단. */
export const WAYPOINTS: Array<[number, number]> = [
  [FIELD.left, FIELD.top],
  [FIELD.right, FIELD.top],
  [FIELD.right, FIELD.bottom],
  [FIELD.left, FIELD.bottom],
];

interface Segment { x: number; y: number; dx: number; dy: number; len: number; start: number; }

const SEGMENTS: Segment[] = [];
let acc = 0;
for (let i = 0; i < WAYPOINTS.length; i++) {
  const [x1, y1] = WAYPOINTS[i];
  const [x2, y2] = WAYPOINTS[(i + 1) % WAYPOINTS.length]; // 닫힌 루프
  const len = Math.hypot(x2 - x1, y2 - y1);
  SEGMENTS.push({ x: x1, y: y1, dx: (x2 - x1) / len, dy: (y2 - y1) / len, len, start: acc });
  acc += len;
}

/** 루프 한 바퀴 길이(둘레) */
export const PATH_LENGTH = acc;

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

/** 루프 거리(dist)에 해당하는 경로 좌표. dist는 둘레로 wrap된다. */
export function posAtDist(dist: number): { x: number; y: number } {
  let d = dist % PATH_LENGTH;
  if (d < 0) d += PATH_LENGTH;
  for (const s of SEGMENTS) {
    if (d <= s.start + s.len) {
      const t = d - s.start;
      return { x: s.x + s.dx * t, y: s.y + s.dy * t };
    }
  }
  return { x: WAYPOINTS[0][0], y: WAYPOINTS[0][1] };
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
