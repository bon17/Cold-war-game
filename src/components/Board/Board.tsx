import { useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl, layout } from '../../lib/assets';
import { chapterRels, pairKey, ZONE_KEY, type DocState } from '../../lib/board';
import { boardLayout, edgeCurve, nodeAt, pinTagAnchor, SWATCH_W, type Measure, type PinStyle } from '../../lib/boardLayout';
import { nodes, oldPinName, pinName, pinSide, strings } from '../../lib/data';
import { pointAt } from '../../lib/stringPath';
import type { BoardEdge, Chapter, NodeId, Rel, ZoneTask } from '../../types';
import { fmt } from '../../lib/format';
import { TapHint } from '../Desk/TapHint';
import { EdgeStroke, RelSwatch } from './EdgeStroke';
import './Board.css';

// 관계 보드(L8, 조명 위): 실 → 핀 → 핀·실 이름표, 범례 카드. 모든 좌표는 무대 px.

function edgeName(edge: BoardEdge): string {
  const parts = [edge.label ?? strings.relations[edge.rel]];
  if (edge.fray) parts.push(strings.edgeMarks.fray);
  if (edge.mark === 'hotline') parts.push(strings.edgeMarks.hotline);
  return parts.join(' · ');
}

// 실 바꾸기에 쓰는 것. 없으면 보기만 하는 보드.
export interface BoardPlay {
  pending: Set<string>;     // 문서를 읽고 바꿀 차례인 실: 이름표가 빛나는 점선 테두리 단추가 된다
  hint?: string;            // '여기를 누르세요'를 붙일 실
  faint: Set<string>;       // 이번 장에서 바뀌지 않는 실: 흐리게 그린다
  anim?: { key: string; kind: 'ok' | 'wrong'; rel?: Rel; id: number };   // 맞으면 출렁, 틀리면 고른 종류로 잠깐 보였다가 흔들리며 돌아감
  onPick: (key: string) => void;       // 바꿀 실 → 실 바꾸기 창
  onInfo: (key: string) => void;       // 그 밖의 실 → 실 이력표(표로 보기)
  onTable: () => void;
  zone?: 'pending' | 'done';           // 2장 '어느 편도 아닌 나라' 칸: 문서를 읽었으면 빈 칸(누르면 고르기 창), 맞혔으면 나라 이름
}

// 2장 '어느 편도 아닌 나라' 칸: 차트 종이 왼쪽 위에 덧댄 천 띠(기획서 5.2, 아트 계획서 6.1)
function NeutralZone({ task, state, hint, onPick }: { task: ZoneTask; state: 'pending' | 'done'; hint: boolean; onPick: () => void }) {
  const { x, y, w, h } = layout.neutralZone;
  const style = { left: x, top: y, width: w, height: h };
  if (state === 'pending') {
    return (
      <button type="button" className="neutral-zone pending" style={style} aria-label={task.question} onClick={onPick}>
        <span className="neutral-zone-title">{task.title}</span>
        <span className="neutral-zone-empty" aria-hidden="true">?</span>
        {hint && <TapHint />}
      </button>
    );
  }
  return (
    <div className="neutral-zone" style={style}>
      <span className="neutral-zone-title">{task.solvedTitle ?? task.title}</span>
      <ul className="neutral-zone-countries">
        {task.countries.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

// 5장 '소련 → 러시아': 이름이 바뀌는 순간 핀 이름표가 커졌다 돌아오고 핀 둘레에 빛 고리가 퍼진다(2026-10-25 교사 의견).
// '맞아요!' 창의 도장(0.9초)에 맞춰 시작한다(Board.css). 이미 바뀐 채로 열면(이어하기) 움직이지 않는다.
const RENAME_FRESH_MS = 5000;

function useFreshRename(chapter: Chapter, progress?: DocState): Set<NodeId> {
  const ids = (Object.keys(chapter.renameAfter?.labels ?? {}) as NodeId[]).filter((id) => oldPinName(chapter, id, progress)).join(',');
  const before = useRef(ids);
  const [fresh, setFresh] = useState('');
  useEffect(() => {
    const was = before.current;
    before.current = ids;
    if (!ids) {
      setFresh('');
      return;
    }
    if (ids === was) return;
    setFresh(ids);
    const timer = window.setTimeout(() => setFresh(''), RENAME_FRESH_MS);
    return () => window.clearTimeout(timer);
  }, [ids]);
  return useMemo(() => new Set(fresh ? (fresh.split(',') as NodeId[]) : []), [fresh]);
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

// progress: 읽은 문서와 끝난 실. 핀 이름이 장 중간에 바뀌는 장(1장 '38선 이남' → '남한')에서 지금 이름을 고른다.
export function Board({ chapter, edges: shown, play, progress }: { chapter: Chapter; edges: BoardEdge[]; play?: BoardPlay; progress?: DocState }) {
  const { stage } = layout;
  const fontsVersion = useFontsVersion();
  const anim = play?.anim;
  const edges = useMemo(
    () => (anim?.kind === 'wrong' && anim.rel
      ? shown.map((e) => (pairKey(e.pair) === anim.key ? { ...e, rel: anim.rel!, fray: false } : e))
      : shown),
    [shown, anim],
  );
  const pins: PinStyle = useMemo(
    () => ({ text: (id) => pinName(chapter, id, progress), side: (id) => pinSide(chapter, id, progress) }),
    [chapter, progress],
  );
  const fresh = useFreshRename(chapter, progress);
  const zoneState = chapter.zone ? play?.zone : undefined;
  const obstacles = useMemo(() => (zoneState ? [layout.neutralZone] : []), [zoneState]);
  const { pinIds, labels } = useMemo(() => boardLayout(edges, measure, edgeName, pins, obstacles), [edges, pins, obstacles, fontsVersion]);
  const animClass = (key: string) => (anim?.key === key ? (anim.kind === 'ok' ? ' settle' : ' shake') : '');
  const background = edges.filter((e) => e.background);
  const hotline = edges.find((e) => e.mark === 'hotline');
  const rels = chapterRels(chapter);
  const puzzle = edges.filter((e) => !e.background);
  const pin = nodes.pinSize;

  return (
    <>
      <svg className="board-svg" width={stage.w} height={stage.h} viewBox={`0 0 ${stage.w} ${stage.h}`} aria-hidden="true">
        {/* 배경 실은 연하게 그리되 실 종류(같은 편의 파란 이중선)는 알아보게 한다. 너무 흐리면 그냥 선으로 보였다(2026-10-25 교사 의견) */}
        <g opacity={0.55}>
          {background.map((e) => (
            <EdgeStroke key={pairKey(e.pair)} curve={edgeCurve(e)} rel={e.rel} background />
          ))}
        </g>
        {puzzle.map((e) => {
          const key = pairKey(e.pair);
          return (
            <g
              key={`${key}:${anim?.key === key ? anim.id : 0}`}
              className={`edge-g${animClass(key)}`}
              opacity={play?.faint.has(key) ? 0.4 : undefined}
            >
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
              {fresh.has(id) &&
                [0, 1, 2].map((i) => (
                  <circle key={i} className="pin-ring" cx={x} cy={y} r={pin * 0.6} style={{ animationDelay: `${0.9 + i * 0.45}s` }} />
                ))}
            </g>
          );
        })}
      </svg>

      {puzzle.map((e) => {
        const key = pairKey(e.pair);
        const p = pointAt(edgeCurve(e), labels.get(key)?.t ?? 0.5);
        const content = (
          <>
            <RelSwatch rel={e.rel} width={SWATCH_W} />
            <span>{edgeName(e)}</span>
          </>
        );
        const faint = play?.faint.has(key) ? ' faint' : '';
        const style = { left: p.x, top: p.y };
        if (play?.pending.has(key)) {
          const [a, b] = e.pair.map(pins.text);
          return (
            <button
              key={key}
              type="button"
              data-edge-key={key}
              className={`edge-tag pending${animClass(key)}`}
              style={style}
              aria-label={fmt(strings.board.dialog.title, { a, b })}
              onClick={() => play.onPick(key)}
            >
              {content}
              {play.hint === key && <TapHint />}
            </button>
          );
        }
        if (play) {
          return (
            <button
              key={`${key}:${anim?.key === key ? anim.id : 0}`}
              type="button"
              className={`edge-tag${faint}${animClass(key)}`}
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
        const a = pinTagAnchor(id, pins.side(id));
        const old = oldPinName(chapter, id, progress);
        return (
          <div
            key={id}
            className={`pin-tag${fresh.has(id) ? ' fresh' : ''}`}
            style={{ left: a.x, top: a.y, transform: `translate(${a.tx * 100}%, ${a.ty * 100}%)` }}
          >
            {old && <s className="pin-old">{old}</s>}
            {pins.text(id)}
          </div>
        );
      })}

      {play && chapter.zone && zoneState && (
        <NeutralZone task={chapter.zone} state={zoneState} hint={play.hint === ZONE_KEY} onPick={() => play.onPick(ZONE_KEY)} />
      )}
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
      <div
        className={`legend-card${rels.length + (hotline ? 1 : 0) > 4 ? ' dense' : ''}`}
        style={{ left: layout.legend.x, top: layout.legend.y, width: layout.legend.w }}
      >
        <div className="legend-title">{strings.legendTitle}</div>
        {rels.map((rel) => (
          <div key={rel} className="legend-row">
            <RelSwatch rel={rel} />
            <span>{strings.relations[rel]}</span>
          </div>
        ))}
        {hotline && (
          // 직통선 매듭은 2장 끝 시계 카드에서 생겨 끝까지 남는다. 다음 장에서 갑자기 생긴 것처럼 보이지 않게 범례에 둔다(2026-10-25 교사 결정)
          <div className="legend-row">
            <RelSwatch rel={hotline.rel} hotline />
            <span>{strings.legendHotline}</span>
          </div>
        )}
      </div>
    </>
  );
}
