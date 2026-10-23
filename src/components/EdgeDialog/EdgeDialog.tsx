import { useEffect, useMemo } from 'react';
import { pairKey } from '../../lib/board';
import { chapterById, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { directTask, evidenceDoc, optionOrder } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './EdgeDialog.css';

// 실 걸기 창(무대 밖, 실제 px). 바꿀 실의 이름표를 누르면 열린다.
// ① 근거 단서 쪽지 고르기 → ② 관계 고르기(선택지 3개, 숫자 키 1~3). 관계를 고르면 바로 판정한다.
// 틀리면 창 안에 까닭을 알려 주고(두 번째부터 힌트), 맞거나 세 번째로 틀리면 창을 닫는다.
export function EdgeDialog() {
  const { chapterId, dialogEdge, clues, selectedClue, event, done, selectClue, submitEdge, closeEdgeDialog } = useGame();
  const chapter = chapterById(chapterId);
  const task = dialogEdge ? directTask(chapter, dialogEdge) : undefined;
  const options = useMemo(() => (task ? optionOrder(chapter, task) : []), [chapter, task]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdgeDialog();
      const n = Number(e.key);
      if (selectedClue && n >= 1 && n <= options.length) submitEdge(dialogEdge!, options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, options, dialogEdge, selectedClue, submitEdge, closeEdgeDialog]);

  if (!task || !dialogEdge) return null;

  // 이미 다른 실을 거는 데 쓴 쪽지는 빼서 고를 것을 줄인다(다 빠지면 모두 보여 줌)
  const used = new Set(
    chapter.edgeTasks.filter((t) => done[pairKey(t.pair)] && !done[pairKey(t.pair)].helped).flatMap((t) => t.evidence),
  );
  const unused = clues.filter((c) => !used.has(c.clue));
  const choices = unused.length > 0 ? unused : clues;

  const name = (id: NodeId) => nodes.nodes[id]?.name ?? id;
  const [a, b] = task.pair.map(name);
  const last = event && event.kind === 'wrong' && event.key === dialogEdge ? event : null;
  let message = '';
  if (last) {
    message = last.reason === 'evidence' ? fmt(strings.board.dialog.wrongEvidence, { a, b }) : strings.board.dialog.wrongRel;
    if (last.hint) {
      const hint = last.reason === 'evidence'
        ? fmt(strings.board.dialog.hintEvidence, { title: evidenceDoc(chapter, task)?.title ?? '' })
        : fmt(strings.board.dialog.hintRel, { clue: selectedClue?.clue ?? '' });
      message += ` ${hint}`;
    }
  }

  return (
    <div className="edge-dialog" role="dialog" aria-modal="false" aria-label={fmt(strings.board.dialog.title, { a, b })}>
      <div className="edge-dialog-title">{fmt(strings.board.dialog.title, { a, b })}</div>

      <div className="edge-dialog-step">{strings.board.dialog.step1}</div>
      {clues.length === 0 ? (
        <p className="edge-dialog-empty">{strings.board.dialog.noClues}</p>
      ) : (
        <div className="edge-dialog-clues">
          {choices.map((c) => {
            const on = selectedClue?.docId === c.docId && selectedClue.clue === c.clue;
            return (
              <button
                key={`${c.docId}:${c.clue}`}
                type="button"
                className={`dialog-clue${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => selectClue(on ? null : c)}
              >
                {c.clue}
              </button>
            );
          })}
        </div>
      )}

      <div className={`edge-dialog-step${selectedClue ? '' : ' locked'}`}>
        {selectedClue ? strings.board.dialog.step2 : strings.board.dialog.step2Locked}
      </div>
      <div className="edge-dialog-rels">
        {options.map((rel, i) => (
          <button key={rel} type="button" disabled={!selectedClue} onClick={() => submitEdge(dialogEdge, rel)}>
            <span className="rel-key">{i + 1}</span>
            <RelSwatch rel={rel} width={48} />
            {strings.relations[rel]}
          </button>
        ))}
      </div>

      <div className="edge-dialog-foot">
        <p className={`edge-dialog-message${last ? ' wrong' : ''}`} aria-live="polite">
          {message}
        </p>
        <button type="button" className="edge-dialog-close" onClick={closeEdgeDialog}>
          {strings.board.dialog.close}
        </button>
      </div>
    </div>
  );
}
