import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoFlash } from '../../store/gameStore';
import { sfx } from '../../lib/sound';
import { assetUrl, layout } from '../../lib/assets';
import { chapterRels, pairKey, ZONE_KEY, type DocState } from '../../lib/board';
import { boardLayout, edgeCurve, nodeAt, pinTagAnchor, SWATCH_W, type Measure, type PinStyle } from '../../lib/boardLayout';
import { nodes, oldPinName, pinName, pinSide, strings } from '../../lib/data';
import { pointAt } from '../../lib/stringPath';
import type { BoardEdge, Chapter, NodeId, Pair, Rel, ZoneTask } from '../../types';
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
  onInfo: (key: string) => void;       // 그 밖의 실 → 실 이력표(표로 보기). 실을 찾는 중이면 '두 나라를 찾아보세요'
  // 실 찾기(1장부터, 2026-10-26): 바꿀 실도 반짝이지 않고 다른 실과 똑같이 보인다. 오래 못 찾으면(hint) 반짝인다.
  // 보드에 아직 없는 새 실(newThread)은 두 나라 핀을 차례로 눌러 잇는다(onPins)
  seek?: { key: string; pair: Pair; hint: boolean; newThread: boolean };
  onPins: (a: NodeId, b: NodeId) => void;
  flash?: AutoFlash | null;   // 함께 바뀐 실(저절로 바뀐 실, 내려간 실, 새 배경 실, 매듭)
  paused?: boolean;           // 문서·창·시계 카드가 보드를 가리는 동안에는 함께 바뀐 실 효과를 미룬다
  onFlashDone?: (id: number) => void;   // 바뀐 모습을 다 보여 줌(다음 문서를 열거나 창밖으로 넘어가도 된다)
  onTable: () => void;
  zone?: 'pending' | 'done';           // 2장 '어느 편도 아닌 나라' 칸: 문서를 읽었으면 빈 칸(누르면 고르기 창), 맞혔으면 나라 이름
}

// 2장 '어느 편도 아닌 나라' 칸: 차트 종이 왼쪽 위에 덧댄 천 띠(기획서 5.2, 아트 계획서 6.1)
function NeutralZone({ task, state, hint, onPick }: { task: ZoneTask; state: 'pending' | 'done'; hint: boolean; onPick: () => void }) {
  const { x, y, w, h } = layout.neutralZone;
  const style = { left: x, top: y, width: w, height: h };
  if (state === 'pending') {
    return (
      <button type="button" className={`neutral-zone pending${hint ? ' hinted' : ''}`} style={style} aria-label={task.question} onClick={onPick}>
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

// 함께 바뀐 실(2026-10-26 교사 의견: 한꺼번에 바뀌면 그냥 바뀌어 놓친다). 보드가 보일 때 바뀌기 전 모습을 잠깐 깜빡여
// 보여 준 뒤(before) 새 실로 바뀌며 빛나고 이름표에 '함께 바뀜'이 붙는다(after). 문서나 시계 카드가 가리면 닫힌 뒤에 한다.
const FLASH_BEFORE_MS = 1300;
const FLASH_HOLD_MS = 1900;    // 새 실을 보여 준 뒤 다음 문서를 열기까지
const FLASH_AFTER_MS = 4800;   // 새 실이 빛나는 시간(다음 문서 뒤에서도 이어진다)

function useAutoFlash(flash: AutoFlash | null | undefined, paused: boolean, onDone?: (id: number) => void) {
  const done = useRef(onDone);
  done.current = onDone;
  const [state, setState] = useState<{ id: number; stage: 'before' | 'after' } | null>(null);
  const started = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (!flash || paused || started.current === flash.id) return;
    started.current = flash.id;
    timers.current.forEach(window.clearTimeout);
    setState({ id: flash.id, stage: 'before' });
    timers.current = [
      window.setTimeout(() => {
        setState({ id: flash.id, stage: 'after' });
        sfx.ting('TALK');
      }, FLASH_BEFORE_MS),
      window.setTimeout(() => done.current?.(flash.id), FLASH_BEFORE_MS + FLASH_HOLD_MS),
      window.setTimeout(() => setState(null), FLASH_BEFORE_MS + FLASH_AFTER_MS),
    ];
  }, [flash, paused]);
  return flash && state && state.id === flash.id ? { flash, stage: state.stage } : null;
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
  const flashing = useAutoFlash(play?.flash, !!play?.paused, play?.onFlashDone);
  const edges = useMemo(() => {
    let list = anim?.kind === 'wrong' && anim.rel
      ? shown.map((e) => (pairKey(e.pair) === anim.key ? { ...e, rel: anim.rel!, fray: false } : e))
      : shown;
    // 함께 바뀐 실의 '바뀌기 전' 모습: 바뀐 실은 예전 모습으로, 새로 생긴 실(배경 실 포함)은 아직 감춘다
    if (flashing?.stage === 'before') {
      const keys = new Set(flashing.flash.keys);
      const bg = new Set(flashing.flash.backgrounds);
      list = list.filter((e) => (e.background ? !bg.has(pairKey(e.pair)) : !keys.has(pairKey(e.pair))));
      for (const key of flashing.flash.keys) {
        const old = flashing.flash.before[key];
        if (old) list = [...list, { ...old }];
      }
    }
    return list;
  }, [shown, anim, flashing]);
  const flashClass = (key: string, background = false) => {
    if (!flashing) return '';
    const hit = background ? flashing.flash.backgrounds.includes(key) : flashing.flash.keys.includes(key);
    return hit ? (flashing.stage === 'before' ? ' flash-old' : ' flash-new') : '';
  };
  const pins: PinStyle = useMemo(
    () => ({ text: (id) => pinName(chapter, id, progress), side: (id) => pinSide(chapter, id, progress) }),
    [chapter, progress],
  );
  const fresh = useFreshRename(chapter, progress);
  const seek = play?.seek;
  // 새 실 잇기: 처음 누른 핀(두 번째 핀을 누르면 잇는다)
  const [firstPin, setFirstPin] = useState<NodeId | null>(null);
  useEffect(() => setFirstPin(null), [seek?.key, seek?.newThread]);
  const zoneState = chapter.zone ? play?.zone : undefined;
  const obstacles = useMemo(() => (zoneState ? [layout.neutralZone] : []), [zoneState]);
  const { pinIds: edgePins, labels } = useMemo(() => boardLayout(edges, measure, edgeName, pins, obstacles), [edges, pins, obstacles, fontsVersion]);
  // 새 실을 이을 때는 아직 실이 없는 나라의 핀도 꽂아 둔다(1장 1-4 중국)
  const pinIds = seek?.newThread ? [...new Set([...edgePins, ...seek.pair])] : edgePins;
  const tieHint = seek?.newThread && seek.hint ? new Set<NodeId>(seek.pair) : new Set<NodeId>();
  const pickPin = (id: NodeId) => {
    if (!firstPin) setFirstPin(id);
    else if (firstPin === id) setFirstPin(null);
    else {
      play?.onPins(firstPin, id);
      setFirstPin(null);
    }
  };
  const animClass = (key: string) => (anim?.key === key ? (anim.kind === 'ok' ? ' settle' : ' shake') : '');
  const background = edges.filter((e) => e.background);
  const hotline = edges.find((e) => e.mark === 'hotline');
  const undyed = edges.some((e) => e.undyed);
  // 에필로그: 흰 실이 된 남북 실의 원래 종류(대화)는 범례에서 뺀다
  const rels = chapterRels(chapter).filter((r) => !undyed || edges.some((e) => !e.undyed && e.rel === r));
  const legendRows = rels.length + (hotline ? 1 : 0) + (undyed ? 1 : 0);
  const puzzle = edges.filter((e) => !e.background);
  const pin = nodes.pinSize;

  return (
    <>
      <svg className="board-svg" width={stage.w} height={stage.h} viewBox={`0 0 ${stage.w} ${stage.h}`} aria-hidden="true">
        {/* 배경 실은 연하게 그리되 실 종류(같은 편의 파란 이중선)는 알아보게 한다. 너무 흐리면 그냥 선으로 보였다(2026-10-25 교사 의견) */}
        <g opacity={0.55}>
          {background.map((e) => (
            <g key={pairKey(e.pair)} className={flashClass(pairKey(e.pair), true) || undefined}>
              <EdgeStroke curve={edgeCurve(e)} rel={e.rel} background />
            </g>
          ))}
        </g>
        {puzzle.map((e) => {
          const key = pairKey(e.pair);
          return (
            <g
              key={`${key}:${anim?.key === key ? anim.id : 0}`}
              className={`edge-g${animClass(key)}${e.undyed ? ' edge-undyed' : ''}${flashClass(key)}`}
              opacity={play?.faint.has(key) ? 0.4 : undefined}
            >
              <EdgeStroke curve={edgeCurve(e)} rel={e.rel} fray={e.fray} hotline={e.mark === 'hotline'} undyed={e.undyed} />
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
        const flashed = flashClass(key);
        const content = (
          <>
            <RelSwatch rel={e.rel} width={SWATCH_W} undyed={e.undyed} />
            <span>{edgeName(e)}</span>
            {flashed === ' flash-new' && <span className="flash-badge">{strings.board.flashBadge}</span>}
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
              className={`edge-tag${seek && !seek.hint ? '' : ' pending'}${play.hint === key ? ' hinted' : ''}${animClass(key)}`}
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
              className={`edge-tag${faint}${animClass(key)}${flashed}`}
              style={style}
              onClick={() => play.onInfo(key)}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={`${key}:${anim?.key === key ? anim.id : 0}`} className={`edge-tag${animClass(key)}${flashed}`} style={style}>
            {content}
          </div>
        );
      })}
      {pinIds.map((id) => {
        const a = pinTagAnchor(id, pins.side(id));
        const old = oldPinName(chapter, id, progress);
        const style = { left: a.x, top: a.y, transform: `translate(${a.tx * 100}%, ${a.ty * 100}%)` };
        if (seek?.newThread) {
          // 새 실 잇기: 핀 이름표가 단추가 된다. 처음 누른 핀은 표시해 두고, 오래 못 찾으면 이을 두 핀이 반짝인다
          return (
            <button
              key={id}
              type="button"
              className={`pin-tag pin-pick${firstPin === id ? ' picked' : ''}${tieHint.has(id) ? ' pending' : ''}${tieHint.has(id) && id === seek.pair[0] ? ' hinted' : ''}`}
              style={style}
              aria-pressed={firstPin === id}
              onClick={() => pickPin(id)}
            >
              {pins.text(id)}
              {tieHint.has(id) && id === seek.pair[0] && <TapHint />}
            </button>
          );
        }
        return (
          <div key={id} className={`pin-tag${fresh.has(id) ? ' fresh' : ''}`} style={style}>
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
      {chapter.epilogueBoard?.stamp && (
        // 에필로그: 이 보드는 1992년 기록(차트 종이 왼쪽 위 빈 곳, 2장 '어느 편도 아닌 나라' 칸 자리)
        <div className="board-stamp" style={{ left: layout.neutralZone.x + 12, top: layout.neutralZone.y + 14 }}>
          {chapter.epilogueBoard.stamp}
        </div>
      )}
      <div
        className={`legend-card${legendRows > 4 ? ' dense' : ''}`}
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
        {undyed && (
          <div className="legend-row">
            <RelSwatch rel="TALK" undyed />
            <span>{strings.legendUndyed}</span>
          </div>
        )}
      </div>
    </>
  );
}
