// 실의 모양: 두 핀 사이에 살짝 처진 2차 베지어 곡선(아트 계획서 3.7, 처짐 = 길이 × 0.05).
export interface Pt { x: number; y: number }
export interface Curve { p0: Pt; c: Pt; p1: Pt }

export const SAG_RATIO = 0.05;

// 처짐은 아래쪽으로만 생긴다. 세로에 가까운 실은 거의 처지지 않는다.
export function sagCurve(p0: Pt, p1: Pt): Curve {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  if (len === 0) return { p0, c: mid, p1 };
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const sag = SAG_RATIO * Math.abs(dx);   // 가운데가 처지는 거리. 조절점은 그 두 배만큼 옮긴다
  return { p0, c: { x: mid.x + nx * 2 * sag, y: mid.y + ny * 2 * sag }, p1 };
}

export function pointAt({ p0, c, p1 }: Curve, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

// 진행 방향의 각도(라디안)
export function angleAt({ p0, c, p1 }: Curve, t: number): number {
  const dx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
  const dy = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
  return Math.atan2(dy, dx);
}

export function pathD({ p0, c, p1 }: Curve): string {
  return `M${p0.x} ${p0.y} Q${c.x} ${c.y} ${p1.x} ${p1.y}`;
}

const STEPS = 64;

function lengthTable(curve: Curve): number[] {
  const table = [0];
  let prev = curve.p0;
  for (let i = 1; i <= STEPS; i++) {
    const p = pointAt(curve, i / STEPS);
    table.push(table[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  return table;
}

export function curveLength(curve: Curve): number {
  return lengthTable(curve)[STEPS];
}

// 실을 따라 같은 간격으로 놓는 장식(가시, 매듭)의 자리. 양 끝(핀 근처)은 margin만큼 비우고 가운데로 모은다.
export function evenSpots(curve: Curve, spacing: number, margin: number): { t: number; p: Pt; angle: number }[] {
  const table = lengthTable(curve);
  const total = table[STEPS];
  const usable = total - margin * 2;
  if (usable <= 0) return [];
  const count = Math.max(1, Math.floor(usable / spacing));
  const start = margin + (usable - (count - 1) * spacing) / 2;
  const spots = [];
  for (let k = 0; k < count; k++) {
    const target = start + k * spacing;
    let i = 1;
    while (i < STEPS && table[i] < target) i++;
    const t = (i - 1 + (target - table[i - 1]) / (table[i] - table[i - 1] || 1)) / STEPS;
    spots.push({ t, p: pointAt(curve, t), angle: angleAt(curve, t) });
  }
  return spots;
}

// 두 선분이 끝점이 아닌 곳에서 만나는지(보드 구도 검사용, 아트 계획서 4.5)
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
