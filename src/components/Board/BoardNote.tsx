import { useEffect, useState } from 'react';
import { pairKey, ZONE_KEY } from '../../lib/board';
import { hasPredict, nextPredict } from '../../lib/clockFlow';
import { chapterById, pinName, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { docProgress, nextAction } from '../../lib/guide';
import { stageToScreen } from '../../lib/stageFit';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { useStageFit } from '../Stage/Stage';
import './BoardNote.css';

// '지금 할 일' 쪽지(무대 밖, 실제 px). 책상 왼쪽 아래, 문서 더미 밑에 늘 떠 있다(기획서 1.2 '뭘 해야 할지 모름' 대책).
// 한 줄: 지금 할 일 | 진행 막대(문서와 실 ●●○, 시계 예측 ○). 칸이 커서 책상을 가린다는 교사 의견(2026-10-25)으로 한 줄로 줄였다.
// 실이 저절로 바뀌면 잠깐 그 실의 한 줄 설명을 보여 준다(이때만 줄이 바뀔 수 있다).
const RESULT_MS = 9000;
const MISS_MS = 3500;   // 실을 찾다가 다른 실을 눌렀을 때 '문서에 나온 두 나라를 찾아보세요'
const NOTE_LEFT = 40;
const NOTE_Y = 945;
const NOTE_RIGHT = 1040; // 보고서철(x 1060) 앞까지

export function BoardNote() {
  const { chapterId, board, done, event, openDocId, dialogEdge, readDocs, revealed, reveal, reportOpen, aboutClock } = useGame();
  const chapter = chapterById(chapterId);
  const fit = useStageFit();
  const [resultId, setResultId] = useState<number | null>(null);

  useEffect(() => {
    // 맞힌 실의 설명은 실 바꾸기 창에 나온다(2026-10-23). 쪽지에는 저절로 바뀐 실과 '아직 남았어요'만
    if (!event || (event.kind !== 'auto' && event.kind !== 'reportLocked' && event.kind !== 'miss')) return;
    setResultId(event.id);
    const timer = window.setTimeout(() => setResultId(null), event.kind === 'miss' ? MISS_MS : RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  if (openDocId || dialogEdge || reveal || reportOpen || aboutClock) return null;

  const g = strings.board.guide;
  const name = (id: NodeId) => pinName(chapter, id);
  const state = { readDocs, done, revealed, reveal };
  const action = nextAction(chapter, state);
  const progress = docProgress(chapter, state);
  const clockDone = !nextPredict(chapter, revealed);

  let text: string;
  let kind = 'guide';
  if (event && event.id === resultId && event.kind === 'auto') {
    const task = chapter.edgeTasks.find((t) => pairKey(t.pair) === event.key)!;
    const [a, b] = task.pair.map(name);
    text = `${fmt(strings.board.result.auto, { a, b })} ${task.explanation}`;
    kind = 'ok';
  } else if (event && event.id === resultId && event.kind === 'miss') {
    text = g.miss;
  } else if (event && event.id === resultId && event.kind === 'reportLocked') {
    text = fmt(g.reportLocked, { n: progress.total - progress.done });
  } else if (action.kind === 'doc') text = g.readDoc;
  else if (action.kind === 'edge') {
    // 1장부터는 반짝이지 않는 실을 찾아 누르고, 보드에 아직 없는 실은 두 핀을 이어 건다(2026-10-26)
    const fresh = !board.some((e) => pairKey(e.pair) === action.key);
    text = action.key === ZONE_KEY ? g.pickZone : chapter.tutorial ? g.pickEdge : fresh ? g.tieEdge : g.findEdge;
  }
  else if (action.kind === 'report') {
    text = g.reportReady;
    kind = 'ok';
  } else text = g.reportDone;

  const p = stageToScreen(fit, NOTE_LEFT, NOTE_Y);
  return (
    <div
      className={`board-note ${kind}`}
      style={{ left: p.x, top: p.y, maxWidth: (NOTE_RIGHT - NOTE_LEFT) * fit.scale }}
      aria-live="polite"
    >
      <div className="board-note-text">
        {kind === 'guide' && <span className="board-note-chip">{g.title}</span>}
        {text}
      </div>
      <div className="board-note-progress">
        <span>
          {g.progressDocs}{' '}
          <span className="board-note-dots" aria-label={`${progress.done}/${progress.total}`}>
            {Array.from({ length: progress.total }, (_, i) => (i < progress.done ? '●' : '○')).join('')}
          </span>
        </span>
        {hasPredict(chapter) && (
          <span>
            {g.progressClock} <span className="board-note-dots">{clockDone ? '●' : '○'}</span>
          </span>
        )}
      </div>
    </div>
  );
}
