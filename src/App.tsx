import { useEffect, useMemo, useState } from 'react';
import { Board, type BoardPlay } from './components/Board/Board';
import { BoardNote } from './components/Board/BoardNote';
import { BoardTable } from './components/Board/BoardTable';
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
import { CoverScreen, EndScreen, HandoverMemo, NoticeCard, ResultCard, WindowScene } from './components/Screens/ChapterScreens';
import { TitleScreen } from './components/Screens/TitleScreen';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import { backgroundFor, pairKey } from './lib/board';
import { chapterById, strings } from './lib/data';
import { autoOpenDoc } from './lib/docFlow';
import { startAutosave } from './lib/session';
import { setSoundEnabled, sfx } from './lib/sound';
import { useGame } from './store/gameStore';
import { useSession } from './store/sessionStore';

// M1: 3장 체험판. 타이틀 → 이름 → (고지) → 표지 → 인계 메모 → 책상(문서, 단서, 실, 보고서, 시계) → 창밖 → 근무 평정표 → 끝
const ANIM_MS = 700;

// 상태 변화에 맞춰 효과음을 낸다(소리를 끄면 sound.ts가 아무것도 내지 않는다)
function useSoundEffects() {
  useEffect(() => {
    const offSession = useSession.subscribe((s) => setSoundEnabled(!!s.sound && s.lampOn));
    const offGame = useGame.subscribe((s, prev) => {
      if (s.clues.length > prev.clues.length) sfx.highlight();
      if (s.openDocId && s.openDocId !== prev.openDocId) sfx.paper();
      if (s.event && s.event !== prev.event) {
        if (s.event.kind === 'ok' || s.event.kind === 'auto') {
          const key = s.event.key;
          const rel = s.board.find((e) => pairKey(e.pair) === key)?.rel;
          if (rel) sfx.ting(rel);
        } else if (s.event.kind === 'wrong') sfx.wrong();
      }
      if (s.reveal?.step !== prev.reveal?.step) {
        if (s.reveal?.step === 'bulletin') sfx.telegram();
        if (s.reveal?.step === 'newspaper') sfx.print();
      }
      if (s.reveal?.step === 'needle' && s.clockShown.minutes !== prev.clockShown.minutes) sfx.tick();
      if (Object.keys(s.reports).length > Object.keys(prev.reports).length) sfx.stamp();
      if (s.bonus?.correct && !prev.bonus) sfx.chime();
    });
    return () => {
      offSession();
      offGame();
    };
  }, []);
}

export default function App() {
  const { chapterId, readDocs, board, done, selectedClue, event, revealed, reveal, openEdgeDialog, openTable } = useGame();
  const phase = useSession((s) => s.phase);
  const setPhase = useSession((s) => s.setPhase);
  const chapter = chapterById(chapterId);
  const edges = useMemo(() => [...backgroundFor(chapter, readDocs), ...board], [chapter, readDocs, board]);

  useEffect(() => startAutosave(), []);
  useSoundEffects();

  // 장 시작에 저절로 여는 속보(4-1 같은 문서)
  const openDocument = useGame((s) => s.openDocument);
  useEffect(() => {
    if (phase !== 'desk' || reveal) return;
    const doc = autoOpenDoc(chapter, readDocs, revealed);
    if (doc) openDocument(doc.id);
  }, [phase, reveal, chapter, readDocs, revealed, openDocument]);

  // 시계 지점을 모두 마치면 창밖 장면으로
  useEffect(() => {
    if (phase === 'desk' && !reveal && revealed.length === chapter.clock.length) setPhase('window');
  }, [phase, reveal, revealed, chapter, setPhase]);

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
      onInfo: (key) => openTable(key),
      onTable: () => openTable(),
      hiddenLabel: phase === 'handover' && chapter.handover ? pairKey(chapter.handover.blankPair) : undefined,
    };
  }, [chapter, done, selectedClue, anim, openEdgeDialog, openTable, phase]);

  const atDesk = phase === 'desk';
  return (
    <div data-chapter={chapter.id}>
      <Stage
        backdrop={assetUrl(`rooms/${chapter.room}-blur.webp`)}
        overlay={
          <>
            {atDesk && (
              <>
                <DeskLabels />
                <BoardNote />
                <EdgeDialog />
                <DocumentViewer />
                <ReportForm />
                <ClockReveal />
                <AboutClock />
                <BoardTable />
              </>
            )}
            <HandoverMemo />
            <TitleScreen />
            <NoticeCard />
            <CoverScreen />
            <WindowScene />
            <ResultCard />
            <EndScreen />
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
