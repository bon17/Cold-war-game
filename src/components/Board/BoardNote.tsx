import { useEffect, useState } from 'react';
import { layout } from '../../lib/assets';
import { pairKey } from '../../lib/board';
import { chapterById, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { stageToScreen } from '../../lib/stageFit';
import { evidenceDoc } from '../../lib/validateEdge';
import { isUnlocked, nextCheckpoint, nextPredict, remaining } from '../../lib/clockFlow';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { useStageFit } from '../Stage/Stage';
import './BoardNote.css';

// '지금 할 일' 쪽지(무대 밖, 실제 px). 보드와 단서 쪽지 사이 책상 위에 늘 떠 있다(기획서 1.2 '뭘 해야 할지 모름' 대책).
// 실이 걸리면 잠깐 그 실의 한 줄 설명을 보여 준다.
const RESULT_MS = 9000;
const NOTE_CENTER_X = 815;
const NOTE_WIDTH = 500;

export function BoardNote() {
  const { chapterId, clues, selectedClue, done, event, openDocId, dialogEdge, readDocs, revealed, reveal, reportOpen, aboutClock } = useGame();
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

  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  const allDone = direct.every((t) => done[pairKey(t.pair)]);
  const name = (id: NodeId) => nodes.nodes[id]?.name ?? id;
  const point = nextCheckpoint(chapter, revealed);
  const predict = nextPredict(chapter, revealed);
  const todo = () => {
    if (!predict) return '';
    const r = remaining(chapter, predict, readDocs, done);
    const parts = [
      r.docs.length > 0 && fmt(strings.board.guide.todoDocs, { n: r.docs.length }),
      r.edges.length > 0 && fmt(strings.board.guide.todoEdges, { n: r.edges.length }),
    ].filter(Boolean);
    return fmt(strings.board.guide.reportLocked, { todo: parts.join(', ') });
  };

  let text: string;
  let kind = 'guide';
  if (event && event.id === resultId && (event.kind === 'ok' || event.kind === 'auto')) {
    const task = chapter.edgeTasks.find((t) => pairKey(t.pair) === event.key)!;
    const [a, b] = task.pair.map(name);
    if (event.kind === 'auto') text = `${fmt(strings.board.result.auto, { a, b })} ${task.explanation}`;
    else if (event.helped) text = fmt(strings.board.result.helped, { title: evidenceDoc(chapter, task)?.title ?? '' });
    else text = `${strings.board.result.ok} ${task.explanation}`;
    kind = event.kind === 'ok' && event.helped ? 'helped' : 'ok';
  } else if (event && event.id === resultId && event.kind === 'reportLocked' && predict) text = todo();
  else if (!point) text = strings.board.guide.reportDone;
  else if (predict && point === predict && isUnlocked(chapter, predict, readDocs, done)) {
    text = strings.board.guide.reportReady;
    kind = 'ok';
  } else if (allDone) text = predict ? todo() : strings.board.guide.allDone;
  else if (selectedClue) text = fmt(strings.board.guide.clueSelected, { clue: selectedClue.clue });
  else if (clues.length === 0) text = strings.board.guide.readFirst;
  else text = strings.board.guide.pickEdge;

  // 문서 더미 라벨과 보고서 라벨 사이(무대 x 565~1065)에 둔다
  const p = stageToScreen(fit, NOTE_CENTER_X, layout.deskTopY + 75);
  return (
    <div
      className={`board-note ${kind}`}
      style={{ left: p.x, top: p.y, maxWidth: Math.max(300, NOTE_WIDTH * fit.scale) }}
      aria-live="polite"
    >
      {text}
    </div>
  );
}
