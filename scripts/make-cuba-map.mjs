// 2장 2-6 「쿠바 미사일 위기」 지도의 해안선 데이터(src/data/maps/cuba.json)를 만든다(2026-10-26 교사 의견: 지도로 위험을 보여 주자).
// 지도는 AI 그림이 아니라 공개 자료 Natural Earth 1:50m(world-atlas 2.0.2의 TopoJSON)로 만든다(아트 계획서: 지도는 코드 SVG).
// 두 꾸러미는 이 프로젝트의 의존성이 아니다. 다시 만들 때만 다른 폴더에 받아서 쓴다:
//   npm install world-atlas@2.0.2 topojson-client@3.1.0  (다른 폴더에서)
//   node scripts/make-cuba-map.mjs <그 폴더>/node_modules/world-atlas <그 폴더>/node_modules/topojson-client src/data/maps/cuba.json
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [atlasDir, topoDir, out] = process.argv.slice(2);
const topo = JSON.parse(readFileSync(`${atlasDir}/countries-50m.json`, 'utf8'));
const { feature } = await import(pathToFileURL(`${topoDir}/dist/topojson-client.js`).href);

const box = { lonMin: -100, lonMax: -68, latMin: 15, latMax: 42 };
const lat0 = 28.5;
const cos = Math.cos((lat0 * Math.PI) / 180);
const W = 600;
const k = W / ((box.lonMax - box.lonMin) * cos);
const H = Math.round((box.latMax - box.latMin) * k);
const px = ([lon, lat]) => [(lon - box.lonMin) * cos * k, (box.latMax - lat) * k];
const pad = 2;
const inBox = ([lon, lat]) => lon > box.lonMin - pad && lon < box.lonMax + pad && lat > box.latMin - pad && lat < box.latMax + pad;

const ids = { us: ['840'], cuba: ['192'], other: ['484', '044', '332', '214', '388', '320', '084', '340', '222', '558'] };
const fc = feature(topo, topo.objects.countries);
const pathFor = (codes) => {
  let d = '';
  for (const f of fc.features.filter((f) => codes.includes(String(f.id).padStart(3, '0')))) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        if (!ring.some(inBox)) continue;
        // 1.5px보다 가까운 점은 건너뛴다(지도가 작아 모양은 그대로)
        let lx = Infinity, ly = Infinity;
        const pts = [];
        for (const c of ring) {
          const [x, y] = px(c).map((v) => Math.round(v));
          if (Math.hypot(x - lx, y - ly) < 1.5) continue;
          pts.push(`${x},${y}`);
          lx = x;
          ly = y;
        }
        if (pts.length > 2) d += `M${pts.join('L')}Z`;
      }
    }
  }
  return d;
};
const data = {
  source: 'Natural Earth 1:50m(공개 자료), world-atlas 2.0.2로 변환. 위도 28.5도 기준 등장방형 투영',
  width: W, height: H, lonMin: box.lonMin, latMax: box.latMax, k: Math.round(k * 1000) / 1000, cos: Math.round(cos * 100000) / 100000,
  land: { us: pathFor(ids.us), cuba: pathFor(ids.cuba), other: pathFor(ids.other) },
};
writeFileSync(out, JSON.stringify(data));
const hav = (a, b) => {
  const r = Math.PI / 180, R = 6371;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
console.log('size', W, H, 'bytes', JSON.stringify(data).length);
console.log('base→DC km', Math.round(hav([-83.05, 22.72], [-77.04, 38.9])), 'havana→DC', Math.round(hav([-82.38, 23.13], [-77.04, 38.9])), 'keywest→cuba coast', Math.round(hav([-81.78, 24.555], [-81.6, 23.15])));
