import cubaData from '../../data/maps/cuba.json';
import type { DocMap as DocMapData } from '../../types';

// 문서 옆 지도(2026-10-26 교사 의견: 쿠바 미사일 위기가 얼마나 위험했는지 지도로).
// 해안선은 Natural Earth 1:50m로 만든 코드 SVG(scripts/make-cuba-map.mjs). AI 그림은 해안선과 글자를 틀리기 쉬워 쓰지 않는다.
// 바다 이름은 넣지 않고, 나라 이름·거리 같은 글은 장 데이터(DocMap.labels)에서 온다. viewBox 600 단위, 글자 24단위(실제 약 18px).
interface MapGeo {
  width: number;
  height: number;
  lonMin: number;
  latMax: number;
  k: number;
  cos: number;
  land: { us: string; cuba: string; other: string };
  points: Record<'base' | 'washington' | 'keyWest' | 'cubaCoast', [number, number]>;
  labelAt: Record<'us' | 'mexico' | 'cuba' | 'florida', [number, number]>;
  rangeKm: number;
}
const geo = cubaData as unknown as MapGeo;

const project = ([lon, lat]: [number, number]) => ({ x: (lon - geo.lonMin) * geo.cos * geo.k, y: (geo.latMax - lat) * geo.k });

// 미사일 기지에서 거리 r km인 점들(대원 거리). 투영하면 찌그러진 원이 된다
function rangeRing([lon, lat]: [number, number], km: number): string {
  const R = 6371;
  const d = km / R;
  const rad = Math.PI / 180;
  const φ1 = lat * rad;
  const λ1 = lon * rad;
  const pts: string[] = [];
  for (let b = 0; b <= 360; b += 4) {
    const θ = b * rad;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    const p = project([λ2 / rad, φ2 / rad]);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function DocMap({ map }: { map: DocMapData }) {
  const L = map.labels;
  const base = project(geo.points.base);
  const dc = project(geo.points.washington);
  const kw = project(geo.points.keyWest);
  const coast = project(geo.points.cubaCoast);
  const at = (k: keyof MapGeo['labelAt']) => project(geo.labelAt[k]);
  const farMid = { x: (base.x + dc.x) / 2, y: (base.y + dc.y) / 2 };
  return (
    <figure className="doc-figure">
      <figcaption className="doc-figure-title">{map.title}</figcaption>
      <svg className="doc-map" viewBox={`0 0 ${geo.width} ${geo.height}`} role="img" aria-label={`${map.title} ${map.caption}`}>
        <defs>
          <clipPath id="doc-map-clip">
            <rect width={geo.width} height={geo.height} />
          </clipPath>
        </defs>
        <g clipPath="url(#doc-map-clip)">
          <rect className="map-sea" width={geo.width} height={geo.height} />
          <path className="map-land" d={geo.land.other} />
          <path className="map-land us" d={geo.land.us} />
          <path className="map-land cuba" d={geo.land.cuba} />
          <path className="map-range" d={rangeRing(geo.points.base, geo.rangeKm)} />
        </g>
        <line className="map-line far" x1={base.x} y1={base.y} x2={dc.x} y2={dc.y} />
        <line className="map-line near" x1={coast.x} y1={coast.y} x2={kw.x} y2={kw.y} />
        <text className="map-label country" x={at('us').x} y={at('us').y}>{L.us}</text>
        <text className="map-label country" x={at('mexico').x} y={at('mexico').y}>{L.mexico}</text>
        <text className="map-label country cuba" x={at('cuba').x} y={at('cuba').y}>{L.cuba}</text>
        <text className="map-label small" x={at('florida').x} y={at('florida').y}>{L.florida}</text>
        <text className="map-label distance" x={farMid.x + 10} y={farMid.y}>{L.far}</text>
        <text className="map-label distance near" x={kw.x + 12} y={(kw.y + coast.y) / 2 + 6}>{L.near}</text>
        <circle className="map-dc" cx={dc.x} cy={dc.y} r={7} />
        <text className="map-label small" x={dc.x + 12} y={dc.y + 6}>{L.washington}</text>
        <path className="map-base" d={`M${base.x},${base.y - 11}L${base.x + 10},${base.y + 7}L${base.x - 10},${base.y + 7}Z`} />
        <text className="map-label base" x={base.x - 14} y={base.y + 34}>{L.base}</text>
        <text className="map-label range" x={12} y={geo.height - 14}>{L.range}</text>
      </svg>
      <p className="doc-figure-caption">{map.caption}</p>
      <p className="doc-figure-source">{map.source}</p>
    </figure>
  );
}
