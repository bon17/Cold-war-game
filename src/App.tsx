import strings from './data/strings.ko.json';
import { Desk } from './components/Desk/Desk';
import { DeskLabels } from './components/Desk/DeskLabels';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import type { RoomId } from './types';

// M0: 3장 방의 빈 책상만 띄운다. M1에서 장 데이터(ch3.json의 room)로 바꾼다.
const ROOM: RoomId = 'room-1970s';
const CHAPTER = 'ch3';

export default function App() {
  return (
    <div data-chapter={CHAPTER}>
      <Stage backdrop={assetUrl(`rooms/${ROOM}-blur.webp`)} overlay={<DeskLabels />}>
        <Desk room={ROOM} />
      </Stage>
      <div className="rotate-notice">{strings.rotateDevice}</div>
    </div>
  );
}
