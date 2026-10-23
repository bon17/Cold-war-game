import { useEffect, useMemo, useState } from 'react';
import { assetUrl, layout } from '../../lib/assets';
import { chapterRels, pairKey } from '../../lib/board';
import { boardLayout, edgeCurve, nodeAt, pinTagAnchor, SWATCH_W, type Measure } from '../../lib/boardLayout';
import { nodes, strings } from '../../lib/data';
import { pointAt } from '../../lib/stringPath';
import type { BoardEdge, Chapter, Rel } from '../../types';
import { fmt } from '../../lib/format';
import { EdgeStroke, RelSwatch } from './EdgeStroke';
import './Board.css';

// 관계 보드(L8, 조명 위): 실 → 핀 → 핀·실 이름표, 범례 카드. 모든 좌표는 무대 px.

function edgeName(edge: BoardEdge, helped = false): string {
  const parts = [edge.label ?? strings.relations[edge.rel]];
  if (edge.fray) parts.push(strings.edgeMarks.fray);
  if (edge.mark === 'hotline') parts.push(strings.edgeMarks.hotline);
  if (helped) parts.push(strings.edgeMarks.helped);
  return parts.join(' · ');
}

// 실 걸기에 쓰는 것(③단계). 없으면 보기만 하는 보드.
export interface BoardPlay {
  pending: Set<string>;     // 직접 거는 과제가 남은 실: 이름표가 점선 테두리 단추가 된다
  armed: boolean;           // 단서 쪽지를 고른 상태: 점선 이름표가 살짝 빛난다
  helped: Set<string>;      // 도움받아 걸린 실
  anim?: { key: string; kind: 'ok' | 'wrong'; rel?: Rel; id: number };   // 맞으면 출렁, 틀리면 고른 종류로 잠깐 보였다가 흔들리며 돌아감
  onPick: (key: string) => void;       // 바꿀 실 → 실 걸기 창
  onInfo: (key: string) => void;       // 그 밖의 실 → 실 이력표(표로 보기)
  onTable: () => void;
  hiddenLabel?: string;                // 인계 메모 동안 가리는 실 이름표
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

export function Board({ chapter, edges: shown, play }: { chapter: Chapter; edges: BoardEdge[]; play?: BoardPlay }) {
  const { stage } = layout;
  const fontsVersion = useFontsVersion();
  const anim = play?.anim;
  const helped = play?.helped;
  const edges = useMemo(
    () => (anim?.kind === 'wrong' && anim.rel
      ? shown.map((e) => (pairKey(e.pair) === anim.key ? { ...e, rel: anim.rel!, fray: false } : e))
      : shown),
    [shown, anim],
  );
  const { pinIds, labels } = useMemo(
    () => boardLayout(edges, measure, (e) => edgeName(e, helped?.has(pairKey(e.pair)))),
    [edges, helped, fontsVersion],
  );
  const animClass = (key: string) => (anim?.key === key ? (anim.kind === 'ok' ? ' settle' : ' shake') : '');
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
        {puzzle.map((e) => {
          const key = pairKey(e.pair);
          return (
            <g key={`${key}:${anim?.key === key ? anim.id : 0}`} className={`edge-g${animClass(key)}`}>
              <EdgeStroke curve={edgeCurve(e)} rel={e.rel} fray={e.fray} hotline={e.mark === 'hotline'} />
            </g>
          );
        })}
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
        const hidden = play?.hiddenLabel === key;
        const content = hidden ? (
          <span className="edge-tag-hidden">?</span>
        ) : (
          <>
            <RelSwatch rel={e.rel} width={SWATCH_W} />
            <span>{edgeName(e, helped?.has(key))}</span>
          </>
        );
        const style = { left: p.x, top: p.y };
        if (play?.pending.has(key)) {
          const [a, b] = e.pair.map((id) => nodeAt(id).name);
          return (
            <button
              key={key}
              type="button"
              data-edge-key={key}
              className={`edge-tag pending${play.armed ? ' armed' : ''}${animClass(key)}`}
              style={style}
              aria-label={fmt(strings.board.dialog.title, { a, b })}
              onClick={() => play.onPick(key)}
            >
              {content}
            </button>
          );
        }
        if (play && !hidden) {
          return (
            <button
              key={`${key}:${anim?.key === key ? anim.id : 0}`}
              type="button"
              className={`edge-tag${animClass(key)}`}
              style={style}
              onClick={() => play.onInfo(key)}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={`${key}:${anim?.key === key ? anim.id : 0}`} className={`edge-tag${animClass(key)}`} style={style}>
            {content}
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

      {play && (
        <button
          type="button"
          className="board-table-tab"
          style={{ left: layout.board.x + layout.board.w - 30, top: layout.board.y + layout.board.h - 4 }}
          onClick={play.onTable}
        >
          {strings.boardTable.open}
        </button>
      )}
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
