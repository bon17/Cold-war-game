import { useEffect, useMemo, useState } from 'react';
import { Board, type BoardPlay } from './components/Board/Board';
import { BoardNote } from './components/Board/BoardNote';
import { CalendarYear, Clock } from './components/Clock/Clock';
import { CluePanel } from './components/CluePanel/CluePanel';
import { Desk } from './components/Desk/Desk';
import { DeskLabels } from './components/Desk/DeskLabels';
import { DocStack } from './components/Desk/DocStack';
import { DocumentViewer } from './components/DocumentViewer/DocumentViewer';
import { EdgeDialog } from './components/EdgeDialog/EdgeDialog';
import { AboutClock } from './components/Report/AboutClock';
import { ClockReveal } from './components/Report/ClockReveal';
import { ReportFolder } from './components/Report/ReportFolder';
import { ReportForm } from './components/Report/ReportForm';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import { backgroundFor, pairKey } from './lib/board';
import { chapterById, strings } from './lib/data';
import { useGame } from './store/gameStore';

// M1: 3장 체험판. ①보드 ②문서 읽기와 단서 ③실 걸기 ④보고서와 시계 공개. 시작 화면·표지·창밖·저장은 ⑤에서.
const ANIM_MS = 700;

export default function App() {
  const { chapterId, readDocs, board, done, selectedClue, event, openEdgeDialog } = useGame();
  const chapter = chapterById(chapterId);
  const edges = useMemo(() => [...backgroundFor(chapter, readDocs), ...board], [chapter, readDocs, board]);

  const [anim, setAnim] = useState<BoardPlay['anim']>();
  useEffect(() => {
    if (!event || (event.kind !== 'ok' && event.kind !== 'wrong')) return;
    setAnim({ key: event.key, kind: event.kind, rel: event.kind === 'wrong' ? event.rel : undefined, id: event.id });
    const timer = window.setTimeout(() => setAnim(undefined), ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  const play: BoardPlay = useMemo(() => {
    const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct').map((t) => pairKey(t.pair));
    return {
      pending: new Set(direct.filter((k) => !done[k])),
      armed: !!selectedClue,
      helped: new Set(Object.keys(done).filter((k) => done[k].helped)),
      anim,
      onPick: (key) => openEdgeDialog(key),
    };
  }, [chapter, done, selectedClue, anim, openEdgeDialog]);

  return (
    <div data-chapter={chapter.id}>
      <Stage
        backdrop={assetUrl(`rooms/${chapter.room}-blur.webp`)}
        overlay={
          <>
            <DeskLabels />
            <BoardNote />
            <EdgeDialog />
            <DocumentViewer />
            <ReportForm />
            <ClockReveal />
            <AboutClock />
          </>
        }
      >
        <Desk room={chapter.room} front={<><DocStack /><CluePanel /><ReportFolder /></>}>
          <Clock />
          <CalendarYear />
          <Board chapter={chapter} edges={edges} play={play} />
        </Desk>
      </Stage>
      <div className="rotate-notice">{strings.rotateDevice}</div>
    </div>
  );
}
