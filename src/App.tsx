import { Board } from './components/Board/Board';
import { Desk } from './components/Desk/Desk';
import { DeskLabels } from './components/Desk/DeskLabels';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import { startEdges } from './lib/board';
import { chapterById, strings } from './lib/data';

// M1 1단계: 3장 시작 보드를 보여 준다. 읽기·실 걸기·보고서는 다음 단계에서 붙인다.
const chapter = chapterById('ch3');

export default function App() {
  return (
    <div data-chapter={chapter.id}>
      <Stage backdrop={assetUrl(`rooms/${chapter.room}-blur.webp`)} overlay={<DeskLabels />}>
        <Desk room={chapter.room}>
          <Board chapter={chapter} edges={startEdges(chapter)} />
        </Desk>
      </Stage>
      <div className="rotate-notice">{strings.rotateDevice}</div>
    </div>
  );
}
