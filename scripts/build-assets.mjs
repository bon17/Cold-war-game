// npm run assets: art-src/의 고른 그림(번호 없는 <이름>.png)을 public/assets/의 WebP로 만든다.
// 규칙은 docs/art-direction.md 4.9(빌드 스크립트), 5.6(성능 예산), 6.1(파일 이름)을 따른다.
// 경고가 있어도 끝까지 만들고, 마지막에 경고를 모아 보여 준다.
//
// M0에서 하는 일: 투명 확인, 투명 여백과 옅은 번짐 자르기, layout.json 크기로 줄이기(비율 차이 3% 넘으면 경고),
// 창틀 유리 뚫기, 흐린 방 그림(레터박스용), 이음매 없는 종이 결 타일, WebP 변환(예산을 넘으면 품질을 낮춤), 목록 파일.
// M2에서 더할 일: 방 그림의 장별 그림자 색 굽기(@ch3)와 채도 낮춘 판(@ch3-desat).

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art-src';
const OUT = 'public/assets';
const KB = 1024;
const BUDGET = { full: 300 * KB, sprite: 120 * KB, total: 10 * KB * KB };
const RATIO_TOLERANCE = 0.03;
const ALPHA_MIN = 16;   // 이보다 옅은 픽셀은 번짐으로 보고 지운다(art-src/README.md의 번짐 기록)

const OPAQUE_GROUPS = ['rooms', 'windows', 'covers'];
const SPRITE_GROUP = 'shared';

const layout = JSON.parse(await readFile('src/data/layout.json', 'utf8'));
const nodes = JSON.parse(await readFile('src/data/nodes.json', 'utf8'));
const stage = layout.stage;

// 보드 가운데는 차트 종이(코드, 늘 맨 위)가 덮는다. 그 자리를 평균 색 하나로 칠하면 파일이 훨씬 작아진다.
// 종이 가장자리 그림자와 어긋나지 않게 안쪽으로 조금 들여서 칠한다.
const HIDDEN_INSET = 8;
function paperInside(board) {
  return {
    x: board.paper.x - board.x + HIDDEN_INSET,
    y: board.paper.y - board.y + HIDDEN_INSET,
    w: board.paper.w - HIDDEN_INSET * 2,
    h: board.paper.h - HIDDEN_INSET * 2,
  };
}

function paneInside(win) {
  return { x: win.pane.x - win.x, y: win.pane.y - win.y, w: win.pane.w, h: win.pane.h };
}

// 크기가 layout.json, nodes.json에 정해진 공용 그림. 나머지(책상 위 물건, 커서, 테이프)는 M1에서 자리를 정할 때까지 잘라 내기만 한다.
const metalWindow = layout.eraOverrides['room-1980s'].window;
const SPRITE_BOX = {
  board: { w: layout.board.w, h: layout.board.h, hidden: paperInside(layout.board) },
  'clock-bezel': { w: layout.clock.r * 2, h: layout.clock.r * 2 },
  lamp: { w: layout.lamp.w, h: layout.lamp.h },
  'frame-wood': { w: layout.window.w, h: layout.window.h, pane: paneInside(layout.window) },
  'frame-metal': { w: metalWindow.w, h: metalWindow.h, pane: paneInside(metalWindow) },
  calendar: { w: layout.calendar.w, h: layout.calendar.h },
  'pin-head': { w: nodes.pinSize, h: nodes.pinSize },
  'docs-stack': { w: layout.hotspots.docs.w, h: layout.hotspots.docs.h },
};

const warnings = [];
const manifest = [];

function warn(file, message) {
  warnings.push(`${file}: ${message}`);
}

// 고른 그림만: 번호 붙은 원본(<이름>_vNN.*)은 건너뛴다.
async function chosenPngs(group) {
  const dir = path.join(SRC, group);
  const names = await readdir(dir).catch(() => []);
  return names.filter((n) => /^[a-z0-9-]+\.png$/.test(n)).sort().map((n) => n.replace(/\.png$/, ''));
}

// 예산을 넘으면 품질을 한 단계씩 낮춰 다시 만든다. 가장 낮은 품질로도 넘으면 경고한다.
const QUALITY_STEPS = [80, 75, 70, 65, 60];

async function save(pipeline, rel, budget, webpOptions = {}) {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  let quality, info, size;
  for (quality of QUALITY_STEPS) {
    info = await pipeline.clone().webp({ quality, effort: 5, ...webpOptions }).toFile(file);
    ({ size } = await stat(file));
    if (!budget || size <= budget) break;
  }
  manifest.push({ path: rel, w: info.width, h: info.height, bytes: size, quality });
  if (budget && size > budget) warn(rel, `${Math.round(size / KB)}KB, 품질 ${quality}로도 예산 ${Math.round(budget / KB)}KB를 넘음`);
}

function ratioOff(w, h, box) {
  return Math.abs(w / h / (box.w / box.h) - 1);
}

async function buildOpaque(group, name) {
  const src = path.join(SRC, group, `${name}.png`);
  const { width, height } = await sharp(src).metadata();
  if (ratioOff(width, height, stage) > RATIO_TOLERANCE) warn(`${group}/${name}`, `비율 ${width}×${height}가 3:2와 다름`);
  const resized = sharp(src).resize(stage.w, stage.h, { fit: 'fill' });
  await save(resized, `${group}/${name}.webp`, BUDGET.full);
  if (group === 'rooms') {
    // 레터박스와 문서 집중 화면용 흐린 방(작게 만들어 늘려 쓴다)
    await save(sharp(src).resize(384, 256).blur(4), `${group}/${name}-blur.webp`);
  }
}

// 투명 그림을 알파 기준으로 잘라 낸다. 옅은 번짐(ALPHA_MIN 미만)은 지우고, 완전 투명한 곳의 숨은 색은 비운다.
async function trimSprite(src, rel) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];
  const corners = [alphaAt(0, 0), alphaAt(width - 1, 0), alphaAt(0, height - 1), alphaAt(width - 1, height - 1)];
  if (corners.some((a) => a !== 0)) warn(rel, '네 모서리가 투명하지 않음(바둑판 무늬나 배경색을 그려 넣었는지 확인)');

  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < ALPHA_MIN) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      } else {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error(`${rel}: 그림이 모두 투명함`);
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const buffer = await sharp(data, { raw: { width, height, channels: 4 } }).extract(box).png().toBuffer();
  return { buffer, width: box.width, height: box.height };
}

async function buildSprite(name) {
  const rel = `${SPRITE_GROUP}/${name}`;
  const trimmed = await trimSprite(path.join(SRC, SPRITE_GROUP, `${name}.png`), rel);
  const box = SPRITE_BOX[name];
  let pipeline = sharp(trimmed.buffer);
  if (box) {
    if (ratioOff(trimmed.width, trimmed.height, box) > RATIO_TOLERANCE) {
      warn(rel, `그린 비율 ${(trimmed.width / trimmed.height).toFixed(2)}가 layout.json 칸 ${box.w}×${box.h}(${(box.w / box.h).toFixed(2)})와 다름. 칸 안에 비율을 지켜 넣음. layout.json을 그림에 맞출 것`);
      pipeline = pipeline.resize(box.w, box.h, { fit: 'inside' });
    } else {
      pipeline = pipeline.resize(box.w, box.h, { fit: 'fill' });
    }
    if (box.hidden) {
      const resized = await pipeline.png().toBuffer();
      const { x, y, w, h } = box.hidden;
      const { channels } = await sharp(resized).extract({ left: x, top: y, width: w, height: h }).stats();
      const [r, g, b] = channels.map((c) => Math.round(c.mean));
      pipeline = sharp(resized).composite([{
        input: { create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 1 } } },
        left: x,
        top: y,
      }]);
    }
    if (box.pane) {
      // 창틀 유리 자리는 원본과 상관없이 투명하게 뚫는다(창 안의 하늘과 창밖 장면이 보이게)
      const resized = await pipeline.png().toBuffer();
      pipeline = sharp(resized).composite([{
        input: { create: { width: box.pane.w, height: box.pane.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } },
        left: box.pane.x,
        top: box.pane.y,
        blend: 'dest-out',
      }]);
    }
  }
  await save(pipeline, `${rel}.webp`, BUDGET.sprite, { alphaQuality: 90 });
}

// 종이 결: 256으로 줄인 뒤 좌우·상하로 뒤집어 붙여 이음매 없는 512 타일을 만든다.
async function buildPaperGrain() {
  const base = await sharp(path.join(SRC, 'tex', 'paper-grain.png')).resize(256, 256).png().toBuffer();
  const tile = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#000' } })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: await sharp(base).flop().toBuffer(), left: 256, top: 0 },
      { input: await sharp(base).flip().toBuffer(), left: 0, top: 256 },
      { input: await sharp(base).flip().flop().toBuffer(), left: 256, top: 256 },
    ])
    .png()
    .toBuffer();
  await save(sharp(tile), 'tex/paper-grain.webp', BUDGET.sprite);
}

await rm(OUT, { recursive: true, force: true });

for (const group of OPAQUE_GROUPS) {
  for (const name of await chosenPngs(group)) await buildOpaque(group, name);
}
for (const name of await chosenPngs(SPRITE_GROUP)) await buildSprite(name);
await buildPaperGrain();

const totalBytes = manifest.reduce((sum, f) => sum + f.bytes, 0);
if (totalBytes > BUDGET.total) warn('전체', `${(totalBytes / KB / KB).toFixed(1)}MB, 예산 10MB를 넘음`);
await writeFile(path.join(OUT, 'assets.manifest.json'), JSON.stringify({ totalBytes, files: manifest }, null, 2) + '\n');

console.log(`그림 ${manifest.length}개, 합계 ${(totalBytes / KB / KB).toFixed(2)}MB → ${OUT}/`);
if (warnings.length) {
  console.log(`\n경고 ${warnings.length}개`);
  for (const w of warnings) console.log(`- ${w}`);
}
