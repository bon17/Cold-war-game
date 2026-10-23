import { useEffect, useState } from 'react';
import { pairKey } from '../../lib/board';
import { nextPredict } from '../../lib/clockFlow';
import { chapterById, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { docProgress, nextAction } from '../../lib/guide';
import { stageToScreen } from '../../lib/stageFit';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { useStageFit } from '../Stage/Stage';
import './BoardNote.css';

// '지금 할 일' 쪽지(무대 밖, 실제 px). 책상 가운데에 늘 떠 있다(기획서 1.2 '뭘 해야 할지 모름' 대책).
// 위: 지금 할 일 한 줄 / 아래: 진행 막대(문서와 실 ●●○, 시계 예측 ○). 실이 바뀌면 잠깐 그 실의 한 줄 설명을 보여 준다.
const RESULT_MS = 9000;
const NOTE_CENTER = { x: 745, y: 905 };
const NOTE_WIDTH = 560;

export function BoardNote() {
  const { chapterId, done, event, openDocId, dialogEdge, readDocs, revealed, reveal, reportOpen, aboutClock } = useGame();
  const chapter = chapterById(chapterId);
  const fit = useStageFit();
  const [resultId, setResultId] = useState<number | null>(null);

  useEffect(() => {
    if (!event || (event.kind !== 'ok' && event.kind !== 'auto' && event.kind !== 'reportLocked')) return;
    setResultId(event.id);
    const timer = window.setTimeout(() => setResultId(null), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  if (openDocId || dialogEdge || reveal || reportOpen || aboutClock) return null;

  const g = strings.board.guide;
  const name = (id: NodeId) => nodes.nodes[id]?.name ?? id;
  const state = { readDocs, done, revealed, reveal };
  const action = nextAction(chapter, state);
  const progress = docProgress(chapter, state);
  const clockDone = !nextPredict(chapter, revealed);

  let text: string;
  let kind = 'guide';
  if (event && event.id === resultId && (event.kind === 'ok' || event.kind === 'auto')) {
    const task = chapter.edgeTasks.find((t) => pairKey(t.pair) === event.key)!;
    const [a, b] = task.pair.map(name);
    text = event.kind === 'auto'
      ? `${fmt(strings.board.result.auto, { a, b })} ${task.explanation}`
      : `${strings.board.result.ok} ${task.explanation}`;
    kind = 'ok';
  } else if (event && event.id === resultId && event.kind === 'reportLocked') {
    text = fmt(g.reportLocked, { n: progress.total - progress.done });
  } else if (action.kind === 'doc') text = g.readDoc;
  else if (action.kind === 'edge') text = g.pickEdge;
  else if (action.kind === 'report') {
    text = g.reportReady;
    kind = 'ok';
  } else text = g.reportDone;

  const p = stageToScreen(fit, NOTE_CENTER.x, NOTE_CENTER.y);
  return (
    <div
      className={`board-note ${kind}`}
      style={{ left: p.x, top: p.y, width: Math.max(360, NOTE_WIDTH * fit.scale) }}
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
        <span>
          {g.progressClock} <span className="board-note-dots">{clockDone ? '●' : '○'}</span>
        </span>
      </div>
    </div>
  );
}
