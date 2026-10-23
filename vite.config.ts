import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 미리보기 링크(npm run build:link, claude.ai 비공개 페이지)에서는 글꼴 파일 대신 구글 폰트를 쓴다.
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Nanum+Myeongjo:wght@400;800' +
  '&family=Nanum+Gothic+Coding:wght@400;700&family=Gaegu:wght@700&display=swap';

// base './': GitHub Pages처럼 하위 경로에 올려도 그림과 스크립트를 찾을 수 있게 한다.
// assetsDir 'static': 코드와 글꼴 파일을 그림 폴더(public/assets → dist/assets)와 섞지 않는다.
export default defineConfig(({ mode }) => {
  const link = mode === 'preview-link';
  return {
    base: './',
    build: { assetsDir: 'static' },
    resolve: { alias: link ? [{ find: /^\.\/styles\/fonts$/, replacement: './styles/fonts.link' }] : [] },
    plugins: [
      react(),
      {
        name: 'google-fonts-link',
        transformIndexHtml: (html) =>
          link ? html.replace('</head>', `    <link rel="stylesheet" href="${GOOGLE_FONTS}" />\n  </head>`) : html,
      },
    ],
  };
});
