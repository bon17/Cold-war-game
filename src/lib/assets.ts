import layoutData from '../data/layout.json';
import type { Layout, RoomId, WindowLayout } from '../types';

export const layout = layoutData as Layout;

// 'shared/board.webp'나 '/assets/covers/cover-ch3.webp'를 배포 주소로 바꾼다.
// 하위 경로(GitHub Pages)에 올려도 찾을 수 있게 BASE_URL을 붙인다.
export function assetUrl(path: string): string {
  const rel = path.replace(/^\/?assets\//, '').replace(/^\//, '');
  return `${import.meta.env.BASE_URL}assets/${rel}`;
}

// 1980년대 방과 지금의 방은 금속 창틀이라 창 좌표가 다르다(eraOverrides).
export function windowFor(room: RoomId): WindowLayout {
  return layout.eraOverrides[room]?.window ?? layout.window;
}
