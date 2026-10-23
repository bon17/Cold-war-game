import { useState } from 'react';
import { pairKey } from '../../lib/board';
import { nextCheckpoint } from '../../lib/clockFlow';
import { chapterById, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { useGame, type Report } from '../../store/gameStore';
import type { BoardEdge, NodeId } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import './Report.css';

// 보고서(기획서 5.3): ① 자정에 가까워졌을까/멀어졌을까(도장 두 개) ② 가장 큰 이유가 된 실 하나 → 내기.
// 판정은 방향만 본다. 분 단위 숫자는 맞히지 않아도 된다.
export function edgeTitle(edge: BoardEdge): string {
  const [a, b] = edge.pair.map((id: NodeId) => nodes.nodes[id]?.name ?? id);
  return fmt(strings.report.edgeName, { a, b });
}

export function ReportForm() {
  const { chapterId, revealed, reportOpen, board, closeReport, submitReport } = useGame();
  const [direction, setDirection] = useState<Report['direction'] | null>(null);
  const [edge, setEdge] = useState<string | null>(null);
  const point = nextCheckpoint(chapterById(chapterId), revealed);
  if (!reportOpen || !point) return null;

  const stamp = (value: Report['direction'], title: string, sub: string, arrow: string) => (
    <button
      type="button"
      className={`report-stamp ${value}${direction === value ? ' on' : ''}`}
      aria-pressed={direction === value}
      onClick={() => setDirection(value)}
    >
      <span className="report-stamp-arrow" aria-hidden="true">{arrow}</span>
      <span className="report-stamp-title">{title}</span>
      <span className="report-stamp-sub">{sub}</span>
    </button>
  );

  return (
    <div className="report-backdrop">
      <div className="report-card" role="dialog" aria-modal="true" aria-label={fmt(strings.report.title, { year: point.year })}>
        <div className="report-title">{fmt(strings.report.title, { year: point.year })}</div>

        <div className="report-q">{fmt(strings.report.q1, { year: point.year })}</div>
        <div className="report-stamps">
          {stamp('closer', strings.report.closer, strings.report.closerSub, '▲')}
          {stamp('farther', strings.report.farther, strings.report.fartherSub, '▼')}
        </div>

        <div className="report-q">{strings.report.q2}</div>
        <div className="report-edges">
          {board.map((e) => {
            const key = pairKey(e.pair);
            return (
              <button
                key={key}
                type="button"
                className={`report-edge${edge === key ? ' on' : ''}`}
                aria-pressed={edge === key}
                onClick={() => setEdge(key)}
              >
                <RelSwatch rel={e.rel} width={40} />
                <span>{edgeTitle(e)}</span>
                <span className="report-edge-rel">{e.label ?? strings.relations[e.rel]}</span>
              </button>
            );
          })}
        </div>

        <div className="report-foot">
          <button type="button" className="report-close" onClick={closeReport}>
            {strings.report.close}
          </button>
          <button
            type="button"
            className="report-submit"
            disabled={!direction || !edge}
            onClick={() => direction && edge && submitReport({ direction, edge })}
          >
            {strings.report.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
