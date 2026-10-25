import type { Rel } from '../../types';
import { evenSpots, pathD, pointAt, angleAt, type Curve } from '../../lib/stringPath';

// 실 한 가닥. 색 + 무늬 + 잉크 외곽선(아트 계획서 3.7). 모든 숫자는 무대 px.
// 같은 편 = 이중선, 대립 = 홑실선, 전쟁 = 가시선, 대화 = 긴 파선, 수교·협력 = 매듭선, 점령 = 짧은 점선.

const COLOR: Record<Rel, string> = {
  ALLY: 'var(--string-ally)',
  COLD: 'var(--string-cold)',
  WAR: 'var(--string-war)',
  TALK: 'var(--string-talk)',
  NORMAL: 'var(--string-normal)',
  OCCUPY: 'var(--string-cold)',
};
const WIDTH: Record<Rel, number> = { ALLY: 7.5, COLD: 5, WAR: 6, TALK: 5, NORMAL: 5, OCCUPY: 4 };
const DASH: Partial<Record<Rel, string>> = { TALK: '18 10', OCCUPY: '4 8' };
const OUTLINE = 1.5;
const INK = 'var(--string-outline)';

interface EdgeStrokeProps {
  curve: Curve;
  rel: Rel;
  fray?: boolean;
  hotline?: boolean;
  background?: boolean;   // 배경 실: 굵기 80%, 투명도 55%(그룹에서), 빛 없음
  compact?: boolean;      // 범례·이름표 견본: 장식 간격을 좁힌다
}

export function EdgeStroke({ curve, rel, fray, hotline, background, compact }: EdgeStrokeProps) {
  const k = background ? 0.8 : 1;
  const w = WIDTH[rel] * k;
  const color = COLOR[rel];
  const d = pathD(curve);
  const dash = DASH[rel];
  const cap = dash ? 'butt' : 'round';
  const margin = compact ? 6 : 26;   // 핀 근처는 장식을 비운다

  return (
    <g fill="none">
      {!background && !compact && <path d={d} stroke={color} strokeWidth={w + 10} strokeOpacity={0.18} strokeLinecap="round" />}
      <path d={d} stroke={INK} strokeWidth={w + OUTLINE * 2} strokeDasharray={dash} strokeLinecap={cap} />
      <path d={d} stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap={cap} />
      {rel === 'ALLY' && <path d={d} stroke="var(--board-paper)" strokeWidth={2.5 * k} strokeLinecap={cap} />}
      {rel === 'WAR' && evenSpots(curve, compact ? 18 : 34, margin).map(({ p, angle }, i) => (
        <Barb key={i} x={p.x} y={p.y} angle={angle} size={14 * k} color={color} />
      ))}
      {rel === 'NORMAL' && evenSpots(curve, compact ? 22 : 46, margin).map(({ p }, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={6 * k} fill={color} stroke={INK} strokeWidth={OUTLINE} />
      ))}
      {fray && <Fray curve={curve} color={color} />}
      {hotline && <HotlineKnot curve={curve} color={color} />}
    </g>
  );
}

// 전쟁: 철조망 같은 X자 가시
function Barb({ x, y, angle, size, color }: { x: number; y: number; angle: number; size: number; color: string }) {
  const r = size / 2;
  const arms = [angle + Math.PI / 4, angle - Math.PI / 4].map((a) => `M${x - Math.cos(a) * r} ${y - Math.sin(a) * r} L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`).join(' ');
  return (
    <>
      <path d={arms} stroke={INK} strokeWidth={2.5 + OUTLINE * 2} strokeLinecap="round" />
      <path d={arms} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </>
  );
}

// 균열: 실 가운데에서 가닥이 풀려 짧은 털이 양쪽으로 튀어나온 모양
function Fray({ curve, color }: { curve: Curve; color: string }) {
  const hairs = [0.44, 0.47, 0.5, 0.53, 0.56].map((t, i) => {
    const p = pointAt(curve, t);
    const side = i % 2 === 0 ? 1 : -1;
    const a = angleAt(curve, t) + side * (Math.PI / 2 - 0.5);
    const len = 10 + (i % 3) * 3;
    return `M${p.x} ${p.y} L${p.x + Math.cos(a) * len} ${p.y + Math.sin(a) * len}`;
  }).join(' ');
  return (
    <>
      <path d={hairs} stroke={INK} strokeWidth={2 + OUTLINE * 2} strokeLinecap="round" />
      <path d={hairs} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

// 직통선 매듭: 실 위의 8자 매듭(색은 실과 같음)
function HotlineKnot({ curve, color }: { curve: Curve; color: string }) {
  const t = 0.3;
  const p = pointAt(curve, t);
  const a = angleAt(curve, t);
  const loops = [-1, 1].map((s) => ({ x: p.x + Math.cos(a) * 6 * s, y: p.y + Math.sin(a) * 6 * s }));
  return (
    <>
      {loops.map((c, i) => (
        <circle key={`o${i}`} cx={c.x} cy={c.y} r={7} stroke={INK} strokeWidth={3 + OUTLINE * 2} />
      ))}
      {loops.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={7} stroke={color} strokeWidth={3} />
      ))}
    </>
  );
}

// 범례 카드와 이름표 왼쪽의 짧은 견본. fray: '같은 편(금이 감)' 선택지(2장 중국–소련)
export function RelSwatch({ rel, width = 52, fray, hotline }: { rel: Rel; width?: number; fray?: boolean; hotline?: boolean }) {
  const h = 24;
  const curve = { p0: { x: 4, y: h / 2 }, c: { x: width / 2, y: h / 2 }, p1: { x: width - 4, y: h / 2 } };
  return (
    <svg className="rel-swatch" width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden="true">
      <EdgeStroke curve={curve} rel={rel} fray={fray} hotline={hotline} compact />
    </svg>
  );
}
