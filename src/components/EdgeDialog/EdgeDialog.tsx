import { useEffect, useMemo } from 'react';
import { pairKey, taskKey } from '../../lib/board';
import { chapterById, nodes, pinName, strings } from '../../lib/data';
import { currentDoc } from '../../lib/docFlow';
import { fmt } from '../../lib/format';
import { autoTasksFor, directTask, docForTask, optionOrder } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './EdgeDialog.css';

// 실 바꾸기 창(무대 밖, 실제 px). 문서를 다 읽으면 저절로 열리고, 반짝이는 실 이름표를 눌러도 열린다.
// 두 나라가 어떤 사이가 됐는지(관계 두 개 중 하나) 고르면(숫자 키 1~2) 바로 판정한다. 틀리면 문서의 핵심 구절을 다시 보여 준다.
// 맞히면 창에 '맞아요!'와 한 줄 설명, '다음 문서 보기'(다음 문서가 없으면 '확인')가 나온다(2026-10-23 교사 결정).
// 그 문서로 함께 바뀐 것(핀 이름, 새로 나타난 배경 실, 저절로 바뀐 실)도 같은 창에 한 줄씩 보여 준다(1장 1948년 정부 수립).
// '맞아요!' 창의 아래 단추: 다음 문서가 왔으면 '다음 문서 보기', 아니면 '확인'(중립 구역 창도 같이 쓴다)
export function SolvedFoot() {
  const { chapterId, done, readDocs, revealed, closeEdgeDialog, openDocument } = useGame();
  const next = currentDoc(chapterById(chapterId), revealed, readDocs, done);
  const fresh = next && !readDocs.includes(next.id) ? next : undefined;
  return (
    <div className="edge-dialog-foot">
      <span />
      {fresh ? (
        <button type="button" className="edge-dialog-close" onClick={() => openDocument(fresh.id)} autoFocus>
          {strings.board.dialog.nextDoc}
        </button>
      ) : (
        <button type="button" className="edge-dialog-close" onClick={closeEdgeDialog} autoFocus>
          {strings.board.dialog.ok}
        </button>
      )}
    </div>
  );
}

export function EdgeDialog() {
  const { chapterId, dialogEdge, event, done, board, readDocs, submitEdge, closeEdgeDialog, openDocument } = useGame();
  const chapter = chapterById(chapterId);
  const task = dialogEdge ? directTask(chapter, dialogEdge, readDocs) : undefined;
  const options = useMemo(() => (task ? optionOrder(chapter, task) : []), [chapter, task]);
  const wrong = event && event.kind === 'wrong' && event.key === dialogEdge ? event : null;
  const solved = !!(task && done[taskKey(chapter, task)]);

  useEffect(() => {
    if (!task || solved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdgeDialog();
      const n = Number(e.key);
      // 지워진(이미 틀린) 단추는 숫자 키로도 고를 수 없다
      if (n >= 1 && n <= options.length && options[n - 1] !== wrong?.rel) submitEdge(dialogEdge!, options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, solved, options, wrong, dialogEdge, submitEdge, closeEdgeDialog]);

  if (!task || !dialogEdge) return null;

  const [a, b] = task.pair.map((id: NodeId) => pinName(chapter, id));
  const doc = docForTask(chapter, task);

  if (solved) {
    const renamed = task.doc && chapter.nodeLabelsUntil === task.doc
      ? Object.entries(chapter.nodeLabels ?? {})
          .map(([id, from]) => fmt(strings.board.dialog.renamed, { from, to: nodes.nodes[id as NodeId]?.name ?? id }))
          .join(', ')
      : '';
    const appeared = chapter.backgroundEdges.filter((e) => e.appearAfterDoc && e.appearAfterDoc === task.doc && e.note);
    return (
      <div className="edge-dialog solved" role="dialog" aria-modal="false" aria-label={strings.board.result.ok} aria-live="polite">
        <div className="edge-dialog-title">{strings.board.result.ok}</div>
        <p className="edge-dialog-explain">{task.explanation}</p>
        {renamed && (
          <p className="edge-dialog-auto">
            <span>{strings.board.dialog.renamedTitle}:</span>
            <strong>{renamed}</strong>
          </p>
        )}
        {appeared.map((e) => {
          const [c, d] = e.pair.map((id: NodeId) => pinName(chapter, id));
          return (
            <p key={pairKey(e.pair)} className="edge-dialog-auto">
              <span>{strings.reveal.changedTitle}:</span>
              <RelSwatch rel={e.rel} width={48} />
              <strong>{c}–{d} {strings.relations[e.rel]}</strong>
              <span>{e.note}</span>
            </p>
          );
        })}
        {task.doc && autoTasksFor(chapter, task.doc).map((t) => {
          const [c, d] = t.pair.map((id: NodeId) => pinName(chapter, id));
          const rel = board.find((e) => pairKey(e.pair) === pairKey(t.pair))?.rel ?? t.to;
          return (
            <p key={pairKey(t.pair)} className="edge-dialog-auto">
              <span>{strings.reveal.changedTitle}:</span>
              <RelSwatch rel={rel} width={48} />
              <strong>{c}–{d} {strings.relations[rel]}</strong>
              <span>{t.explanation}</span>
            </p>
          );
        })}
        <SolvedFoot />
      </div>
    );
  }

  return (
    <div className="edge-dialog" role="dialog" aria-modal="false" aria-label={fmt(strings.board.dialog.title, { a, b })}>
      <div className="edge-dialog-title">{fmt(strings.board.dialog.title, { a, b })}</div>
      {doc && (
        <div className="edge-dialog-doc">
          <span>{fmt(strings.board.dialog.fromDoc, { title: doc.title })}</span>
          <button type="button" className="edge-dialog-reread" onClick={() => openDocument(doc.id)}>
            {strings.board.dialog.reread}
          </button>
        </div>
      )}

      <div className="edge-dialog-rels">
        {options.map((rel, i) => {
          // 2장 중국–소련: 종류는 같은 편 그대로, 금만 가는 선택지
          const frayed = !!task.fray && rel === task.to;
          return (
            <button
              key={rel}
              type="button"
              className={wrong?.rel === rel ? 'tried' : undefined}
              disabled={wrong?.rel === rel}
              onClick={() => submitEdge(dialogEdge, rel)}
            >
              <span className="rel-key">{i + 1}</span>
              <RelSwatch rel={rel} width={64} fray={frayed} />
              {frayed ? fmt(strings.board.dialog.frayOption, { rel: strings.relations[rel] }) : strings.relations[rel]}
            </button>
          );
        })}
      </div>

      <div className="edge-dialog-foot">
        <p className={`edge-dialog-message${wrong ? ' wrong' : ''}`} aria-live="polite">
          {wrong && doc ? (
            <>
              {strings.board.dialog.wrong} <mark className="key-quote">“{doc.keyPhrase}”</mark>
            </>
          ) : (
            strings.board.dialog.hint
          )}
        </p>
        <button type="button" className="edge-dialog-close" onClick={closeEdgeDialog}>
          {strings.board.dialog.close}
        </button>
      </div>
    </div>
  );
}
