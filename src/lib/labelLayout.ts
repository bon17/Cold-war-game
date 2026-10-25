// 실 이름표 자리 찾기(아트 계획서 4.5 '이름표 규칙'). 이름표는 실 가운데(t = 0.5)에서 시작하고,
// 다른 이름표·핀·핀 이름표·범례 카드와 겹치면 t = 0.2~0.8 사이에서 가운데에 가까운 자리부터 찾는다. 이름표 사이는 8 무대 px 이상 띄운다.
// nodes.json의 edgeLabelT에 값을 적으면 그 자리를 그대로 쓴다(손으로 고정).
import { pointAt, type Curve } from './stringPath';

export interface Box { x: number; y: number; w: number; h: number }

export interface LabelRequest {
  key: string;   // 이 실의 키. 자기 실은 '가리는 실'에서 뺀다
  curve: Curve;
  w: number;
  h: number;
  fixedT?: number;
  avoid?: [number, number][];   // 이 구간에는 놓지 않는다(균열, 직통선 매듭이 가려지지 않게)
}

export const LABEL_GAP = 8;
// 다른 실을 가리는 것은 겹침보다 가볍게 친다(어쩔 수 없을 때는 허용). 배경 실은 흐려서 더 가볍게.
// 이름표끼리 겹치는 것은 글을 못 읽게 되므로 가장 무겁게 친다(겹친 넓이 × OVERLAP_WEIGHT, 2026-10-25 1장 끝 보드).
const OVERLAP_WEIGHT = 10;
const STRING_POINTS = 24;
const STRING_COST = 300;
const BACKGROUND_STRING_COST = 60;

export interface StringObstacle { key: string; curve: Curve; background?: boolean }

function pointsInside(box: Box, curve: Curve): number {
  let n = 0;
  for (let i = 1; i < STRING_POINTS; i++) {
    const p = pointAt(curve, i / STRING_POINTS);
    if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) n++;
  }
  return n;
}
const CANDIDATES = [0.5, 0.42, 0.58, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8];

function boxAt(curve: Curve, t: number, w: number, h: number): Box {
  const p = pointAt(curve, t);
  return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

function overlapArea(a: Box, b: Box, gap: number): number {
  const ox = Math.min(a.x + a.w + gap, b.x + b.w) - Math.max(a.x, b.x - gap);
  const oy = Math.min(a.y + a.h + gap, b.y + b.h) - Math.max(a.y, b.y - gap);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

function outsideArea(box: Box, bounds: Box): number {
  const inside = overlapArea(box, bounds, 0);
  return box.w * box.h - inside;
}

// 짧은 실부터 자리를 잡는다(짧은 실은 옮길 여지가 적다).
export function placeLabels(
  requests: LabelRequest[],
  obstacles: Box[],
  bounds: Box,
  strings: StringObstacle[] = [],
): Map<string, { t: number; box: Box }> {
  const placed = new Map<string, { t: number; box: Box }>();
  const taken: Box[] = [...obstacles];
  const order = [...requests].sort((a, b) => length(a.curve) - length(b.curve));

  for (const req of order) {
    if (req.fixedT !== undefined) {
      const box = boxAt(req.curve, req.fixedT, req.w, req.h);
      placed.set(req.key, { t: req.fixedT, box });
      taken.push(box);
      continue;
    }
    let best: { t: number; box: Box; cost: number } | undefined;
    for (const t of CANDIDATES) {
      if (req.avoid?.some(([a, b]) => t >= a && t <= b)) continue;
      const box = boxAt(req.curve, t, req.w, req.h);
      const cost = taken.reduce((sum, o) => sum + overlapArea(box, o, LABEL_GAP), 0) * OVERLAP_WEIGHT
        + outsideArea(box, bounds) * 4
        + strings.filter((s) => s.key !== req.key).reduce(
          (sum, s) => sum + pointsInside(box, s.curve) * (s.background ? BACKGROUND_STRING_COST : STRING_COST), 0);
      if (!best || cost < best.cost) best = { t, box, cost };
      if (cost === 0) break;
    }
    if (best) {
      placed.set(req.key, { t: best.t, box: best.box });
      taken.push(best.box);
    }
  }
  return placed;
}

function length({ p0, p1 }: Curve): number {
  return Math.hypot(p1.x - p0.x, p1.y - p0.y);
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return overlapArea(a, b, gap) > 0;
}
