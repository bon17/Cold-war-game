// 비공개 링크(claude.ai 페이지)에 올릴 페이지 파일과 함께 올릴 파일 목록을 만든다(docs/local-test.md 5장).
// 먼저 npm run assets → npm run build:link. 결과: dist-link/link-page.html, dist-link/link-files.json
// 페이지 파일은 claude.ai가 <!doctype>·<head>·<body>를 씌우므로 그 안에 들어갈 내용만 쓴다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIR = 'dist-link';
const html = readFileSync(join(DIR, 'index.html'), 'utf8');
const pick = (re) => {
  const m = html.match(re);
  if (!m) throw new Error(`dist-link/index.html에서 찾지 못함: ${re}`);
  return m[1];
};
const js = pick(/src="\.\/(static\/index-[^"]+\.js)"/);
const css = pick(/href="\.\/(static\/index-[^"]+\.css)"/);
const fonts = pick(/href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/);

const page = `<title>바늘과 실: 자정의 분석실</title>
<meta name="description" content="중2 역사 냉전 단원 수업용 웹 게임 체험판">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${fonts}">
<link rel="stylesheet" crossorigin href="./${css}">
<style>:root { color-scheme: dark; } body { background: #120d0a; }</style>
<div id="root"></div>
<script type="module" crossorigin src="./${js}"></script>
`;

// 올릴 파일: 코드 2개 + 그림 전부(약 4MB). 키는 페이지가 부르는 주소, 값은 저장소 안의 파일
const files = { [js]: join(DIR, js), [css]: join(DIR, css) };
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const path of walk(join(DIR, 'assets')).filter((p) => p.endsWith('.webp')).sort()) {
  files[relative(DIR, path)] = path;
}

writeFileSync(join(DIR, 'link-page.html'), page);
writeFileSync(join(DIR, 'link-files.json'), JSON.stringify(files, null, 1) + '\n');
console.log(`${DIR}/link-page.html, ${DIR}/link-files.json (파일 ${Object.keys(files).length}개)`);
