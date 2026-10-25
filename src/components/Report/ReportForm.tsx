import { changedEdges, pairKey } from '../../lib/board';
import { nextCheckpoint } from '../../lib/clockFlow';
import { chapterById, pinName, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { useGame, type Report } from '../../store/gameStore';
import type { BoardEdge, Chapter, NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './Report.css';

// 보고서(기획서 5.3): 이번 장에서 바뀐 실을 보여 주고, 시계가 자정에 가까워졌을까/멀어졌을까 도장 하나를 누르면 바로 낸다.
// 판정은 방향만 본다. 분 단위 숫자는 맞히지 않아도 된다.
export function edgeTitle(chapter: Chapter, edge: Pick<BoardEdge, 'pair'>): string {
  const [a, b] = edge.pair.map((id: NodeId) => pinName(chapter, id));
  return fmt(strings.report.edgeName, { a, b });
}

export function ReportForm() {
  const { chapterId, revealed, reportOpen, board, done, closeReport, submitReport } = useGame();
  const chapter = chapterById(chapterId);
  const point = nextCheckpoint(chapter, revealed);
  if (!reportOpen || !point) return null;

  const changed = changedEdges(chapter, board, done);
  const stamp = (value: Report['direction'], title: string, sub: string, arrow: string) => (
    <button type="button" className={`report-stamp ${value}`} onClick={() => submitReport({ direction: value })}>
      <span className="report-stamp-arrow" aria-hidden="true">{arrow}</span>
      <span className="report-stamp-title">{title}</span>
      <span className="report-stamp-sub">{sub}</span>
    </button>
  );

  return (
    <div className="report-backdrop">
      <div className="report-card" role="dialog" aria-modal="true" aria-label={fmt(strings.report.title, { year: point.year })}>
        <div className="report-title">{fmt(strings.report.title, { year: point.year })}</div>

        {changed.length > 0 && (
          <>
            <div className="report-q small">{strings.report.changed}</div>
            <div className="report-edges">
              {changed.map((e) => (
                <span key={pairKey(e.pair)} className="report-edge">
                  <RelSwatch rel={e.rel} width={40} />
                  <span>{edgeTitle(chapter, e)}</span>
                  <span className="report-edge-rel">
                    {e.label ?? strings.relations[e.rel]}
                    {e.fray && ` · ${strings.edgeMarks.fray}`}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="report-q">{fmt(strings.report.q, { year: point.year })}</div>
        {point.hint && <p className="report-hint">{point.hint}</p>}
        <div className="report-stamps">
          {stamp('closer', strings.report.closer, strings.report.closerSub, '▲')}
          {stamp('farther', strings.report.farther, strings.report.fartherSub, '▼')}
        </div>

        <div className="report-foot">
          <button type="button" className="report-close" onClick={closeReport}>
            {strings.report.close}
          </button>
        </div>
      </div>
    </div>
  );
}
