import { useEffect, useMemo, useState } from 'react';
import { assetUrl, layout } from '../../lib/assets';
import { chapterRels, pairKey } from '../../lib/board';
import { boardLayout, edgeCurve, nodeAt, pinTagAnchor, SWATCH_W, type Measure } from '../../lib/boardLayout';
import { nodes, strings } from '../../lib/data';
import { pointAt } from '../../lib/stringPath';
import type { BoardEdge, Chapter } from '../../types';
import { EdgeStroke, RelSwatch } from './EdgeStroke';
import './Board.css';

// 관계 보드(L8, 조명 위): 실 → 핀 → 핀·실 이름표, 범례 카드. 모든 좌표는 무대 px.

function edgeName(edge: BoardEdge): string {
  const parts = [edge.label ?? strings.relations[edge.rel]];
  if (edge.fray) parts.push(strings.edgeMarks.fray);
  if (edge.mark === 'hotline') parts.push(strings.edgeMarks.hotline);
  return parts.join(' · ');
}

// 이름표 폭은 실제 글꼴로 잰다. 글꼴이 늦게 내려오면 다시 잰다.
const ctx = document.createElement('canvas').getContext('2d');
const measure: Measure = (text, px, bold) => {
  if (!ctx) return text.length * px;
  ctx.font = `${bold ? 700 : 400} ${px}px "Gowun Batang", serif`;
  return ctx.measureText(text).width;
};

function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    document.fonts.ready.then(bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return version;
}

export function Board({ chapter, edges }: { chapter: Chapter; edges: BoardEdge[] }) {
  const { stage } = layout;
  const fontsVersion = useFontsVersion();
  const { pinIds, labels } = useMemo(() => boardLayout(edges, measure, edgeName), [edges, fontsVersion]);
  const background = edges.filter((e) => e.background);
  const puzzle = edges.filter((e) => !e.background);
  const pin = nodes.pinSize;

  return (
    <>
      <svg className="board-svg" width={stage.w} height={stage.h} viewBox={`0 0 ${stage.w} ${stage.h}`} aria-hidden="true">
        <g opacity={0.35}>
          {background.map((e) => (
            <EdgeStroke key={pairKey(e.pair)} curve={edgeCurve(e)} rel={e.rel} background />
          ))}
        </g>
        {puzzle.map((e) => (
          <EdgeStroke key={pairKey(e.pair)} curve={edgeCurve(e)} rel={e.rel} fray={e.fray} hotline={e.mark === 'hotline'} />
        ))}
        {pinIds.map((id) => {
          const { x, y } = nodeAt(id);
          return (
            <g key={id}>
              <ellipse cx={x + 2} cy={y + 4} rx={pin * 0.45} ry={pin * 0.3} fill="rgba(42, 33, 24, 0.35)" />
              <image href={assetUrl('shared/pin-head.webp')} x={x - pin / 2} y={y - pin / 2} width={pin} height={pin} />
            </g>
          );
        })}
      </svg>

      {puzzle.map((e) => {
        const key = pairKey(e.pair);
        const p = pointAt(edgeCurve(e), labels.get(key)?.t ?? 0.5);
        return (
          <div key={key} className="edge-tag" style={{ left: p.x, top: p.y }}>
            <RelSwatch rel={e.rel} width={SWATCH_W} />
            <span>{edgeName(e)}</span>
          </div>
        );
      })}
      {pinIds.map((id) => {
        const a = pinTagAnchor(id);
        return (
          <div key={id} className="pin-tag" style={{ left: a.x, top: a.y, transform: `translate(${a.tx * 100}%, ${a.ty * 100}%)` }}>
            {nodeAt(id).name}
          </div>
        );
      })}

      <div className="legend-card" style={{ left: layout.legend.x, top: layout.legend.y, width: layout.legend.w }}>
        <div className="legend-title">{strings.legendTitle}</div>
        {chapterRels(chapter).map((rel) => (
          <div key={rel} className="legend-row">
            <RelSwatch rel={rel} />
            <span>{strings.relations[rel]}</span>
          </div>
        ))}
      </div>
    </>
  );
}
