import { useEffect, useMemo } from 'react';
import { pairKey, taskKey } from '../../lib/board';
import { chapterById, nodes, pinName, strings } from '../../lib/data';
import { currentDoc } from '../../lib/docFlow';
import { fmt } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { autoTasksFor, directTask, docForTask, optionOrder } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './EdgeDialog.css';

// 실 바꾸기 창(무대 밖, 실제 px). 문서를 다 읽으면 저절로 열리고, 반짝이는 실 이름표를 눌러도 열린다.
// 두 나라가 어떤 사이가 됐는지(관계 두 개 중 하나) 고르면(숫자 키 1~2) 바로 판정한다. 틀리면 문서의 핵심 구절을 다시 보여 준다.
// 맞히면 창에 '맞아요!'와 한 줄 설명, '다음 문서 보기'(다음 문서가 없으면 '확인')가 나온다(2026-10-23 교사 결정).
// 그 문서로 함께 바뀐 것(핀 이름, 새로 나타난 배경 실, 저절로 바뀐 실)도 같은 창에 한 줄씩 보여 준다(1장 1948년 정부 수립).
// 5장 '소련 → 러시아'는 작은 줄 대신 큰 칸으로: 옛 이름에 빨간 줄이 그어지고 새 이름이 도장처럼 찍힌다(2026-10-25 교사 의견).
// 도장이 찍히는 때(CSS 애니메이션 지연과 같게), 보드의 핀 이름표도 이때 커졌다 돌아온다(Board)
const RENAME_STAMP_MS = 900;

// '맞아요!' 창의 아래 단추: 다음 문서가 왔으면 '다음 문서 보기', 아니면 '확인'(중립 구역 창도 같이 쓴다)
// 함께 바뀐 실이 있으면 '다음 문서 보기'를 눌렀을 때 창을 닫고 보드에서 바뀌는 모습을 먼저 보여 준 뒤 문서를 연다
// (2026-10-26 교사 의견: 창이 보드 아래쪽을 가려 함께 바뀐 실을 놓친다)
export function SolvedFoot() {
  const { chapterId, done, readDocs, revealed, flash, flashShown, closeEdgeDialog, openDocument, queueDoc } = useGame();
  const next = currentDoc(chapterById(chapterId), revealed, readDocs, done);
  const fresh = next && !readDocs.includes(next.id) ? next : undefined;
  const unseen = !!flash && flash.id !== flashShown;
  return (
    <div className="edge-dialog-foot">
      <span />
      {fresh ? (
        <button type="button" className="edge-dialog-close" onClick={() => (unseen ? queueDoc(fresh.id) : openDocument(fresh.id))} autoFocus>
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
  const renameMoment = solved && !!task?.doc && chapter.renameAfter?.doc === task.doc;

  useEffect(() => {
    if (!renameMoment) return;
    const timer = window.setTimeout(() => sfx.stamp(), RENAME_STAMP_MS);
    return () => window.clearTimeout(timer);
  }, [renameMoment]);

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

  // 질문의 나라 이름: 임시 이름('38선 이남')은 이 문서를 마친 뒤의 이름(남한)으로, 나라가 바뀌는 이름(소련 → 러시아)은 지금 이름으로
  const progress = { readDocs, done };
  const name = (id: NodeId) => pinName(chapter, id, progress, task.doc);
  const [a, b] = task.pair.map(name);
  const doc = docForTask(chapter, task);

  if (solved) {
    // 이 문서로 바뀐 핀 이름: 1장 '38선 이남 → 남한'(임시 이름이 끝남), 5장 '소련 → 러시아'(새 이름이 생김)
    const base = (id: string) => nodes.nodes[id as NodeId]?.name ?? id;
    const renamed = (task.doc && chapter.nodeLabelsUntil === task.doc ? Object.entries(chapter.nodeLabels ?? {}) : [])
      .map(([id, from]) => fmt(strings.board.dialog.renamed, { from, to: base(id) }))
      .join(', ');
    const countries = renameMoment ? Object.entries(chapter.renameAfter!.labels).map(([id, to]) => [base(id), to!]) : [];
    const now = (id: NodeId) => pinName(chapter, id, progress);
    const appeared = chapter.backgroundEdges.filter((e) => e.appearAfterDoc && e.appearAfterDoc === task.doc && e.note);
    return (
      <div className="edge-dialog solved" role="dialog" aria-modal="false" aria-label={strings.board.result.ok} aria-live="polite">
        <div className="edge-dialog-title">{strings.board.result.ok}</div>
        <p className="edge-dialog-explain">{task.explanation}</p>
        {countries.map(([from, to]) => (
          <div key={to} className="rename-moment">
            <div className="rename-moment-title">{strings.board.dialog.countryRenamed}</div>
            <div className="rename-moment-names">
              <span className="rename-from">{from}</span>
              <span className="rename-arrow" aria-hidden="true">→</span>
              <span className="rename-to">{to}</span>
            </div>
            {chapter.renameAfter?.note && <p className="rename-moment-note">{chapter.renameAfter.note}</p>}
          </div>
        ))}
        {renamed && (
          <p className="edge-dialog-auto">
            <span>{strings.board.dialog.renamedTitle}:</span>
            <strong>{renamed}</strong>
          </p>
        )}
        {appeared.map((e) => {
          const [c, d] = e.pair.map(now);
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
          const [c, d] = t.pair.map(now);
          const edge = board.find((e) => pairKey(e.pair) === pairKey(t.pair));
          const rel = edge?.rel ?? t.to;
          return (
            <p key={pairKey(t.pair)} className="edge-dialog-auto">
              <span>{strings.reveal.changedTitle}:</span>
              <RelSwatch rel={rel} width={48} />
              <strong>{c}–{d} {edge?.label ?? strings.relations[rel]}</strong>
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
          // 2장 중국–소련: 종류는 같은 편 그대로, 금만 가는 선택지. 5장 '협력', '관계 정상화'처럼 이름표를 덮어쓰는 정답은 그 이름으로
          const frayed = !!task.fray && rel === task.to;
          const label = task.label && rel === task.to ? task.label : strings.relations[rel];
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
              {frayed ? fmt(strings.board.dialog.frayOption, { rel: label }) : label}
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
