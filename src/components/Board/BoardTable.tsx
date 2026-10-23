import { useEffect } from 'react';
import { pairKey } from '../../lib/board';
import { chapterById, chapters, pinName, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { edgeHistory } from '../../lib/history';
import { useGame } from '../../store/gameStore';
import type { NodeId } from '../../types';
import { RelSwatch } from './EdgeStroke';
import './BoardTable.css';

// 표로 보기(아트 계획서 3.7): 두 나라, 지금 관계, 근거 문서, 이력. 실 이력표(2.7 ②)를 겸한다.
// 이력은 장 데이터로 만든다(지난 장은 모두, 지금 장은 끝난 과제만).
export function BoardTable() {
  const { chapterId, board, done, table, closeTable } = useGame();
  const chapter = chapterById(chapterId);

  useEffect(() => {
    if (!table) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeTable();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [table, closeTable]);

  if (!table) return null;
  const name = (id: NodeId) => pinName(chapter, id);

  return (
    <div className="reveal-backdrop" onClick={(e) => e.target === e.currentTarget && closeTable()}>
      <div className="board-table-card" role="dialog" aria-modal="true" aria-label={strings.boardTable.title}>
        <div className="board-table-title">{strings.boardTable.title}</div>
        <table className="board-table">
          <thead>
            <tr>
              <th>{strings.boardTable.pair}</th>
              <th>{strings.boardTable.rel}</th>
              <th>{strings.boardTable.evidence}</th>
              <th>{strings.boardTable.history}</th>
            </tr>
          </thead>
          <tbody>
            {board.map((e) => {
              const key = pairKey(e.pair);
              const [a, b] = e.pair.map(name);
              const task = chapter.edgeTasks.find((t) => pairKey(t.pair) === key);
              const evidence = done[key] && task?.doc ? chapter.documents.find((d) => d.id === task.doc)?.title : '';
              const history = edgeHistory(chapters, chapterId, key, done)
                .map((h) => `${h.year ?? strings.boardTable.start} ${h.label ?? strings.relations[h.rel]}`)
                .join(' → ');
              const marks = [e.fray && strings.edgeMarks.fray, e.mark === 'hotline' && strings.edgeMarks.hotline].filter(Boolean);
              return (
                <tr key={key} className={table.focus === key ? 'focus' : undefined}>
                  <td>{fmt(strings.report.edgeName, { a, b })}</td>
                  <td>
                    <span className="board-table-rel">
                      <RelSwatch rel={e.rel} width={40} />
                      {e.label ?? strings.relations[e.rel]}
                      {marks.length > 0 && ` · ${marks.join(' · ')}`}
                    </span>
                  </td>
                  <td>{evidence || '–'}</td>
                  <td>{history}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="reveal-ok" onClick={closeTable} autoFocus>
          {strings.boardTable.close}
        </button>
      </div>
    </div>
  );
}
