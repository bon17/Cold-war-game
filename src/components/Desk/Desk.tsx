import type { CSSProperties } from 'react';
import { assetUrl, layout, windowFor } from '../../lib/assets';
import type { Rect, RoomId } from '../../types';
import './Desk.css';

function place({ x, y, w, h }: Rect): CSSProperties {
  return { left: x, top: y, width: w, height: h };
}

// 메인 책상 화면의 그림 층. 순서는 아트 계획서 4.2(L0 방 → L1 창 안 → L2 창틀 → 벽 물건 → L4 보드 → L5 시계 테두리
// → L8 차트 종이와 시계 판 → 램프). 램프는 벽보다 앞에 놓인 물건이라 차트 종이 왼쪽 아래 모서리를 가린다(4.4).
// 조명 층(L7)은 M2에서 넣는다.
export function Desk({ room }: { room: RoomId }) {
  const win = windowFor(room);
  const { stage, board, clock, lamp, calendar } = layout;
  const bezel = { x: clock.cx - clock.r, y: clock.cy - clock.r, w: clock.r * 2, h: clock.r * 2 };
  const face = { x: clock.cx - clock.faceR, y: clock.cy - clock.faceR, w: clock.faceR * 2, h: clock.faceR * 2 };

  return (
    <>
      <img src={assetUrl(`rooms/${room}.webp`)} style={place({ x: 0, y: 0, w: stage.w, h: stage.h })} alt="" />
      <div className="desk-sky" style={place(win.pane)} />
      <img src={assetUrl(win.src)} style={place(win)} alt="" />
      <img className="desk-contain" src={assetUrl('shared/calendar.webp')} style={place(calendar)} alt="" />
      <img src={assetUrl(board.src)} style={place(board)} alt="" />
      <img src={assetUrl(clock.src)} style={place(bezel)} alt="" />
      <div
        className="desk-chart-paper"
        style={{ ...place(board.paper), ['--paper-grain' as string]: `url(${assetUrl('tex/paper-grain.webp')})` }}
      />
      <div className="desk-clock-face" style={place(face)} />
      <img src={assetUrl(lamp.src)} style={place(lamp)} alt="" />
    </>
  );
}
