import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': GitHub Pages처럼 하위 경로에 올려도 그림과 스크립트를 찾을 수 있게 한다.
// assetsDir 'static': 코드와 글꼴 파일을 그림 폴더(public/assets → dist/assets)와 섞지 않는다.
export default defineConfig({
  base: './',
  build: { assetsDir: 'static' },
  plugins: [react()],
});
