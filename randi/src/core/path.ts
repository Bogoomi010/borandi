import type { SlotDef, StageDef, Vec2 } from "./types";

export interface LoopPath {
  /** 촘촘히 샘플링된 폐곡선 점들 */
  points: Vec2[];
  /** 누적 길이 (points[i]까지) */
  cum: number[];
  total: number;
  centroid: Vec2;
}

/** Catmull-Rom 폐곡선 스플라인을 균일 간격으로 샘플링 */
export function buildLoop(controls: Vec2[], step = 6): LoopPath {
  const n = controls.length;
  const raw: Vec2[] = [];
  const segs = 24;
  for (let i = 0; i < n; i++) {
    const p0 = controls[(i - 1 + n) % n];
    const p1 = controls[i];
    const p2 = controls[(i + 1) % n];
    const p3 = controls[(i + 2) % n];
    for (let j = 0; j < segs; j++) {
      const t = j / segs;
      const t2 = t * t, t3 = t2 * t;
      raw.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  // 균일 재샘플
  const points: Vec2[] = [];
  const cum: number[] = [];
  let acc = 0;
  let prev = raw[0];
  points.push(prev); cum.push(0);
  for (let i = 1; i <= raw.length; i++) {
    const cur = raw[i % raw.length];
    let d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    while (d >= step) {
      const t = step / d;
      prev = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      acc += step;
      points.push(prev); cum.push(acc);
      d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    }
    acc += d;
    prev = cur;
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { points, cum, total: acc, centroid: { x: cx, y: cy } };
}

/** 경로 위 dist(px) 지점의 좌표 */
export function pointAt(path: LoopPath, dist: number): Vec2 {
  const d = ((dist % path.total) + path.total) % path.total;
  const idx = Math.floor(d / (path.total / path.points.length));
  const i = Math.min(idx, path.points.length - 1);
  const a = path.points[i];
  const b = path.points[(i + 1) % path.points.length];
  const segLen = path.total / path.points.length;
  const t = (d - i * segLen) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 경로를 중심 방향으로 scale 배율로 축소/확대한 폐곡선 점 */
function scaledLoop(path: LoopPath, scale: number, count: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const p = pointAt(path, (i / count) * path.total + (scale * 137) % 29);
    out.push({
      x: path.centroid.x + (p.x - path.centroid.x) * scale,
      y: path.centroid.y + (p.y - path.centroid.y) * scale,
    });
  }
  return out;
}

/** 배치 슬롯 생성: 경로 안쪽 3링 + 바깥 1링 */
export function buildSlots(_stage: StageDef, path: LoopPath): SlotDef[] {
  const rings: { scale: number; count: number }[] = [
    { scale: 0.28, count: 8 },
    { scale: 0.50, count: 13 },
    { scale: 0.72, count: 18 },
    { scale: 1.30, count: 18 },
  ];
  const slots: SlotDef[] = [];
  let id = 0;
  for (const r of rings) {
    for (const p of scaledLoop(path, r.scale, r.count)) {
      // 경로와 너무 가까우면 제외
      let minD = Infinity;
      for (let i = 0; i < path.points.length; i += 6) {
        const q = path.points[i];
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < minD) minD = d;
      }
      if (minD < 42) continue;
      // 화면 밖 제외 (HUD 여백 고려)
      if (p.x < 70 || p.x > 1210 || p.y < 96 || p.y > 560) continue;
      slots.push({ id: id++, x: Math.round(p.x), y: Math.round(p.y) });
    }
  }
  return slots;
}
