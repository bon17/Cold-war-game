import { useMemo } from 'react';
import { Board } from './components/Board/Board';
import { CluePanel } from './components/CluePanel/CluePanel';
import { Desk } from './components/Desk/Desk';
import { DeskLabels } from './components/Desk/DeskLabels';
import { DocStack } from './components/Desk/DocStack';
import { DocumentViewer } from './components/DocumentViewer/DocumentViewer';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import { startEdges } from './lib/board';
import { chapterById, strings } from './lib/data';
import { useGame } from './store/gameStore';

// M1: 3장 체험판. ①보드 ②문서 읽기와 단서. 실 걸기·보고서는 다음 단계에서 붙인다.
export default function App() {
  const chapter = chapterById(useGame((s) => s.chapterId));
  const edges = useMemo(() => startEdges(chapter), [chapter]);
  return (
    <div data-chapter={chapter.id}>
      <Stage
        backdrop={assetUrl(`rooms/${chapter.room}-blur.webp`)}
        overlay={
          <>
            <DeskLabels />
            <DocumentViewer />
          </>
        }
      >
        <Desk room={chapter.room} front={<><DocStack /><CluePanel /></>}>
          <Board chapter={chapter} edges={edges} />
        </Desk>
      </Stage>
      <div className="rotate-notice">{strings.rotateDevice}</div>
    </div>
  );
}
