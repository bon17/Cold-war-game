import { useEffect, useMemo, useState } from 'react';
import { Board, type BoardPlay } from './components/Board/Board';
import { BoardNote } from './components/Board/BoardNote';
import { BoardTable } from './components/Board/BoardTable';
import { CalendarYear, Clock } from './components/Clock/Clock';
import { Desk } from './components/Desk/Desk';
import { DeskLabels } from './components/Desk/DeskLabels';
import { DocStack } from './components/Desk/DocStack';
import { DocumentViewer } from './components/DocumentViewer/DocumentViewer';
import { EdgeDialog } from './components/EdgeDialog/EdgeDialog';
import { ZoneDialog } from './components/EdgeDialog/ZoneDialog';
import { AboutClock } from './components/Report/AboutClock';
import { ClockReveal } from './components/Report/ClockReveal';
import { ReportFolder } from './components/Report/ReportFolder';
import { ReportForm } from './components/Report/ReportForm';
import { CoverScreen, EndScreen, MissionCard, NoticeCard, ResultCard, WindowScene } from './components/Screens/ChapterScreens';
import { FinaleScene, LetterScene, Montage, WritingScreen } from './components/Screens/EpilogueScreens';
import { TitleScreen } from './components/Screens/TitleScreen';
import { Stage } from './components/Stage/Stage';
import { assetUrl } from './lib/assets';
import { backgroundFor, docFinished, pairKey, taskKey, ZONE_KEY } from './lib/board';
import { clockHung, hasPredict } from './lib/clockFlow';
import { chapterById, strings } from './lib/data';
import { autoOpenDoc } from './lib/docFlow';
import { nextAction } from './lib/guide';
import { startAutosave } from './lib/session';
import { setSoundEnabled, sfx } from './lib/sound';
import { useGame } from './store/gameStore';
import { useSession } from './store/sessionStore';

// 체험판(프롤로그~에필로그). 타이틀 → 이름 → (고지) → 표지 → 할 일 카드 → 책상(문서 → 실 바꾸기 → 보고서 → 시계) → 창밖 → 근무 평정표 → 끝
// 에필로그는 시계 뒤 80년의 창 → 서랍 속 편지 → 쓰기 화면 → 마지막 매듭 → 끝 화면(근무 평정표 없음).
// 프롤로그는 보고서 없이 문서 5개를 마치면 시계가 처음 걸리고, 별이 없어 근무 평정표를 건너뛴다.
const ANIM_MS = 700;
// 실을 찾다가 이만큼 지나도 못 찾으면 찾는 실(새 실이면 두 핀)을 반짝여 돕는다(2026-10-26 교사 결정)
const SEEK_HINT_MS = 10000;
// 장의 마지막 일을 마친 뒤 창밖 장면까지 잠깐 쉬는 시간(마지막 보드를 볼 수 있게)
const WINDOW_PAUSE_MS = 1200;

// 상태 변화에 맞춰 효과음을 낸다(소리를 끄면 sound.ts가 아무것도 내지 않는다)
function useSoundEffects() {
  useEffect(() => {
    const offSession = useSession.subscribe((s) => setSoundEnabled(!!s.sound && s.lampOn));
    const offGame = useGame.subscribe((s, prev) => {
      if (s.openDocId && s.openDocId !== prev.openDocId) sfx.paper();
      if (s.event && s.event !== prev.event) {
        if (s.event.kind === 'ok' || s.event.kind === 'auto') {
          const key = s.event.key;
          const rel = s.board.find((e) => pairKey(e.pair) === key)?.rel;
          if (rel) sfx.ting(rel);
        } else if (s.event.kind === 'wrong') sfx.wrong();
      }
      if (s.reveal?.step !== prev.reveal?.step) {
        if (s.reveal?.step === 'explanation') sfx.telegram();
        if (s.reveal?.step === 'newspaper') sfx.print();
      }
      if (s.reveal?.step === 'needle' && s.clockShown.minutes !== prev.clockShown.minutes) sfx.tick();
      if (Object.keys(s.reports).length > Object.keys(prev.reports).length) sfx.stamp();
      if (s.event && s.event !== prev.event && s.event.kind === 'ok' && s.event.allDone) window.setTimeout(sfx.chime, 400);
    });
    return () => {
      offSession();
      offGame();
    };
  }, []);
}

export default function App() {
  const { chapterId, readDocs, board, done, event, revealed, reveal, dialogEdge, openDocId, openEdgeDialog, openTable, missEdge } = useGame();
  const phase = useSession((s) => s.phase);
  const setPhase = useSession((s) => s.setPhase);
  const chapter = chapterById(chapterId);
  const progress = useMemo(() => ({ readDocs, done }), [readDocs, done]);
  const edges = useMemo(() => {
    // 에필로그 남북 실: 종류(대화)는 그대로 두고 흰 실과 '지금은?' 이름표로 보여 준다
    const ep = chapter.epilogueBoard;
    const shown = ep ? board.map((e) => (pairKey(e.pair) === pairKey(ep.pair) ? { ...e, undyed: true, label: ep.label } : e)) : board;
    return [...backgroundFor(chapter, progress), ...shown];
  }, [chapter, progress, board]);

  useEffect(() => startAutosave(), []);
  useSoundEffects();

  // 장 시작에 저절로 여는 속보(4-1 같은 문서)
  const openDocument = useGame((s) => s.openDocument);
  useEffect(() => {
    if (phase !== 'desk' || reveal) return;
    const doc = autoOpenDoc(chapter, readDocs, revealed, done);
    if (doc) openDocument(doc.id);
  }, [phase, reveal, chapter, readDocs, revealed, done, openDocument]);

  // 시계 지점과 문서를 모두 마치면(5장은 예측 뒤에 오는 문서까지) 잠깐 마지막 보드를 보여 준 뒤 창밖 장면으로
  useEffect(() => {
    const docsDone = chapter.documents.every((d) => docFinished(chapter, d.id, { readDocs, done }));
    if (phase !== 'desk' || reveal || dialogEdge || revealed.length !== chapter.clock.length || !docsDone) return;
    const timer = window.setTimeout(() => setPhase('window'), WINDOW_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reveal, dialogEdge, revealed, readDocs, done, chapter, setPhase]);

  const [anim, setAnim] = useState<BoardPlay['anim']>();
  useEffect(() => {
    if (!event || (event.kind !== 'ok' && event.kind !== 'wrong' && event.kind !== 'miss') || !event.key) return;
    // 찾는 실이 아닌 실을 누르면 그 실이 살짝 흔들린다
    setAnim({ key: event.key, kind: event.kind === 'ok' ? 'ok' : 'wrong', rel: event.kind === 'wrong' ? event.rel : undefined, id: event.id });
    const timer = window.setTimeout(() => setAnim(undefined), ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  // 실 찾기(1장부터): 문서를 읽고 바꿀 실이 남았는데 창이 닫혀 있으면 학생이 그 실을 보드에서 찾아 누른다.
  // 보드에 아직 없는 실(1장 1-2 남한–북한, 1-4 중국–소련, 1-6 미국–중국)은 두 나라 핀을 차례로 눌러 잇는다.
  const action = useMemo(() => nextAction(chapter, { readDocs, done, revealed, reveal }), [chapter, readDocs, done, revealed, reveal]);
  const seekKey =
    !chapter.tutorial && action.kind === 'edge' && action.key !== ZONE_KEY && !dialogEdge && !openDocId && phase === 'desk' ? action.key : undefined;
  const [seekHint, setSeekHint] = useState(false);
  useEffect(() => {
    setSeekHint(false);
    if (!seekKey) return;
    const timer = window.setTimeout(() => setSeekHint(true), SEEK_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [seekKey]);
  const seek = useMemo(() => {
    if (!seekKey) return undefined;
    const task = chapter.edgeTasks.find((t) => t.mode === 'direct' && pairKey(t.pair) === seekKey)!;
    return { key: seekKey, pair: task.pair, hint: seekHint, newThread: !board.some((e) => pairKey(e.pair) === seekKey) };
  }, [seekKey, seekHint, chapter, board]);

  const play: BoardPlay = useMemo(() => {
    // 문서를 읽고 아직 바꾸지 않은 실만 누를 수 있게 빛나고, 이번 장에서 바뀌지 않는 실은 흐리게 그린다
    const pending = chapter.edgeTasks
      .filter((t) => t.mode === 'direct' && t.doc && readDocs.includes(t.doc) && !done[taskKey(chapter, t)])
      .map((t) => pairKey(t.pair));
    // 장 중간에 내려가는 실(1장 점령 실)도 바뀌는 실로 친다
    const changing = new Set([
      ...chapter.edgeTasks.map((t) => pairKey(t.pair)),
      ...chapter.startBoard.filter((e) => e.untilDoc).map((e) => pairKey(e.pair)),
    ]);
    const zoneRead = !!chapter.zone && readDocs.includes(chapter.zone.doc);
    return {
      pending: new Set(pending),
      zone: zoneRead ? (done[ZONE_KEY] ? 'done' : 'pending') : undefined,
      // '여기를 누르세요'는 책상 화면에서, 문서와 실 바꾸기 창을 닫은 뒤에(읽는 동안 문서 위로 비치지 않게)
      // 실 찾기에서는 오래 못 찾을 때만
      hint: action.kind === 'edge' && !dialogEdge && !openDocId && phase === 'desk' && (!seek || seek.hint) ? action.key : undefined,
      seek,
      // 에필로그는 남북 흰 실만 밝고 나머지는 1992년의 빛바랜 기록으로 흐리게(2026-10-26 교사 의견)
      faint: new Set(
        chapter.epilogueBoard
          ? board.map((e) => pairKey(e.pair)).filter((k) => k !== pairKey(chapter.epilogueBoard!.pair))
          : board.map((e) => pairKey(e.pair)).filter((k) => !changing.has(k)),
      ),
      anim,
      onPick: (key) => openEdgeDialog(key),
      // 실을 찾는 중에 다른 실을 누르면 '문서에 나온 두 나라를 찾아보세요'
      onInfo: (key) => (seek ? missEdge(key) : openTable(key)),
      onPins: (a, b) => (seek && pairKey([a, b]) === seek.key ? openEdgeDialog(seek.key) : missEdge()),
      onTable: () => openTable(),
    };
  }, [chapter, readDocs, done, board, dialogEdge, openDocId, anim, openEdgeDialog, openTable, missEdge, phase, action, seek]);

  const atDesk = phase === 'desk';
  const hung = clockHung(chapter, revealed, reveal);
  const appearing = hung && chapter.startClock === null && revealed.length === 0;
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
                <ZoneDialog />
                <DocumentViewer />
                <ReportForm />
                <ClockReveal />
                <AboutClock />
                <BoardTable />
              </>
            )}
            <MissionCard />
            <TitleScreen />
            <NoticeCard />
            <CoverScreen />
            {chapter.finale ? <Montage /> : <WindowScene />}
            <LetterScene />
            <WritingScreen />
            <FinaleScene edges={edges} />
            <ResultCard />
            <EndScreen />
          </>
        }
      >
        <Desk
          room={chapter.room}
          wallClock={hung ? (appearing ? 'appear' : 'hung') : 'nail'}
          front={<><DocStack />{hasPredict(chapter) && <ReportFolder />}</>}
        >
          {hung && <Clock appear={appearing} />}
          <CalendarYear />
          <Board chapter={chapter} edges={edges} play={play} progress={progress} />
        </Desk>
      </Stage>
      <div className="rotate-notice">{strings.rotateDevice}</div>
    </div>
  );
}
