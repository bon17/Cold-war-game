import { useEffect, useMemo } from 'react';
import { chapterById, pinName, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { directTask, docForTask, optionOrder } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './EdgeDialog.css';

// 실 바꾸기 창(무대 밖, 실제 px). 문서를 다 읽으면 저절로 열리고, 반짝이는 실 이름표를 눌러도 열린다.
// 관계 두 개 중 하나를 고르면(숫자 키 1~2) 바로 판정한다. 틀리면 문서의 핵심 구절을 다시 보여 준다.
export function EdgeDialog() {
  const { chapterId, dialogEdge, event, submitEdge, closeEdgeDialog, openDocument } = useGame();
  const chapter = chapterById(chapterId);
  const task = dialogEdge ? directTask(chapter, dialogEdge) : undefined;
  const options = useMemo(() => (task ? optionOrder(chapter, task) : []), [chapter, task]);
  const wrong = event && event.kind === 'wrong' && event.key === dialogEdge ? event : null;

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdgeDialog();
      const n = Number(e.key);
      // 지워진(이미 틀린) 단추는 숫자 키로도 고를 수 없다
      if (n >= 1 && n <= options.length && options[n - 1] !== wrong?.rel) submitEdge(dialogEdge!, options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, options, wrong, dialogEdge, submitEdge, closeEdgeDialog]);

  if (!task || !dialogEdge) return null;

  const [a, b] = task.pair.map((id: NodeId) => pinName(chapter, id));
  const doc = docForTask(chapter, task);

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
        {options.map((rel, i) => (
          <button
            key={rel}
            type="button"
            className={wrong?.rel === rel ? 'tried' : undefined}
            disabled={wrong?.rel === rel}
            onClick={() => submitEdge(dialogEdge, rel)}
          >
            <span className="rel-key">{i + 1}</span>
            <RelSwatch rel={rel} width={64} />
            {strings.relations[rel]}
          </button>
        ))}
      </div>

      <div className="edge-dialog-foot">
        <p className={`edge-dialog-message${wrong ? ' wrong' : ''}`} aria-live="polite">
          {wrong && doc && (
            <>
              {strings.board.dialog.wrong} <mark className="key-quote">“{doc.keyPhrase}”</mark>
            </>
          )}
        </p>
        <button type="button" className="edge-dialog-close" onClick={closeEdgeDialog}>
          {strings.board.dialog.close}
        </button>
      </div>
    </div>
  );
}
