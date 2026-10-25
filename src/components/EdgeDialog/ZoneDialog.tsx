import { useEffect } from 'react';
import { ZONE_KEY } from '../../lib/board';
import { chapterById, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { useGame } from '../../store/gameStore';
import { SolvedFoot } from './EdgeDialog';
import './EdgeDialog.css';

// 2장 '어느 편도 아닌 나라' 칸 고르기 창(기획서 5.2, 2026-10-25 쉬운 흐름). 실 바꾸기 창과 같은 모양과 순서:
// 문서를 다 읽으면 저절로 열리고, 둘 중 하나를 고르면(숫자 키 1~2) 바로 판정한다. 맞히면 보드 왼쪽 위에 칸이 열린다.
export function ZoneDialog() {
  const { chapterId, dialogEdge, event, done, submitZone, closeEdgeDialog, openDocument } = useGame();
  const zone = dialogEdge === ZONE_KEY ? chapterById(chapterId).zone : undefined;
  const wrong = event && event.kind === 'wrong' && event.key === ZONE_KEY ? event.option : undefined;
  const solved = !!done[ZONE_KEY];

  useEffect(() => {
    if (!zone || solved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdgeDialog();
      const option = zone.options[Number(e.key) - 1];
      if (option && option !== wrong) submitZone(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zone, solved, wrong, submitZone, closeEdgeDialog]);

  if (!zone) return null;
  const doc = chapterById(chapterId).documents.find((d) => d.id === zone.doc);

  if (solved) {
    return (
      <div className="edge-dialog solved" role="dialog" aria-modal="false" aria-label={strings.board.result.ok} aria-live="polite">
        <div className="edge-dialog-title">{strings.board.result.ok}</div>
        <p className="edge-dialog-explain">{zone.explanation}</p>
        <SolvedFoot />
      </div>
    );
  }

  return (
    <div className="edge-dialog" role="dialog" aria-modal="false" aria-label={zone.question}>
      <div className="edge-dialog-title">{zone.question}</div>
      {doc && (
        <div className="edge-dialog-doc">
          <span>{fmt(strings.board.dialog.fromDoc, { title: doc.title })}</span>
          <button type="button" className="edge-dialog-reread" onClick={() => openDocument(doc.id)}>
            {strings.board.dialog.reread}
          </button>
        </div>
      )}

      <div className="edge-dialog-rels">
        {zone.options.map((option, i) => (
          <button
            key={option}
            type="button"
            className={wrong === option ? 'tried' : undefined}
            disabled={wrong === option}
            onClick={() => submitZone(option)}
          >
            <span className="rel-key">{i + 1}</span>
            {option}
          </button>
        ))}
      </div>

      <div className="edge-dialog-foot">
        <p className={`edge-dialog-message${wrong ? ' wrong' : ''}`} aria-live="polite">
          {wrong && doc ? (
            <>
              {strings.board.dialog.wrong} <mark className="key-quote">“{doc.keyPhrase}”</mark>
            </>
          ) : (
            strings.board.dialog.zoneHint
          )}
        </p>
        <button type="button" className="edge-dialog-close" onClick={closeEdgeDialog}>
          {strings.board.dialog.close}
        </button>
      </div>
    </div>
  );
}
