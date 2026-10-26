import { useEffect, useState } from 'react';
import { assetUrl, layout } from '../../lib/assets';
import { edgeCurve, nodeAt, pinTagAnchor } from '../../lib/boardLayout';
import { chapterById, nodes, pinName, pinSide, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { pathD, pointAt } from '../../lib/stringPath';
import { useGame, type FlashItem } from '../../store/gameStore';
import type { BoardEdge, NodeId } from '../../types';
import { useStageFit } from '../Stage/Stage';
import { EdgeStroke, RelSwatch } from './EdgeStroke';
import './ChangeSpotlight.css';

// 실이 바뀌는 순간을 조명으로 비춘다(2026-10-26 교사 의견: 한꺼번에 바뀌면 그냥 바뀌어 놓친다, 깜빡임이 늦고 알아채기 전에 넘어간다).
// 학생이 실을 고르면 그 실부터, 바로 이어서 함께 바뀐 실이 하나씩: 보드의 나머지가 어두워지고, 예전 실이 사라지며
// 새 실이 한쪽 핀에서 다른 핀으로 그어지듯 걸린다. 화면 아래에 큰 설명 한 줄. 누르면 다음 실로 넘어간다.
// 다 보여 주면 '맞아요!' 창이 나온다. 문서나 시계 카드가 보드를 가리는 동안(paused)에는 기다렸다가 닫히면 보여 준다.
const MAIN_MS = 1900;   // 학생이 고른 실
const ITEM_MS = 2800;   // 함께 바뀐 실 하나
const DRAW_END_MS = 1250;   // 새 실이 다 그어지는 때(ChangeSpotlight.css의 애니메이션과 같게)

function relName(e: BoardEdge): string {
  const parts = [e.label ?? strings.relations[e.rel]];
  if (e.mark === 'hotline') parts.push(strings.edgeMarks.hotline);
  return parts.join(' · ');
}

export function ChangeSpotlight({ paused }: { paused: boolean }) {
  const { chapterId, flash, flashShown, flashDone, readDocs, done } = useGame();
  const chapter = chapterById(chapterId);
  const fit = useStageFit();
  const [step, setStep] = useState(0);
  const active = !!flash && flash.id !== flashShown && !paused;

  useEffect(() => {
    if (active) setStep(0);
  }, [active, flash?.id]);

  useEffect(() => {
    if (!active || !flash) return;
    const item = flash.items[step];
    if (!item) {
      flashDone(flash.id);
      return;
    }
    const ting = window.setTimeout(() => item.after && sfx.ting(item.after.rel), DRAW_END_MS);
    const next = window.setTimeout(() => setStep((n) => n + 1), item.main ? MAIN_MS : ITEM_MS);
    return () => {
      window.clearTimeout(ting);
      window.clearTimeout(next);
    };
  }, [active, flash, step, flashDone]);

  if (!active || !flash) return null;
  const item: FlashItem | undefined = flash.items[step];
  if (!item) return null;

  const progress = { readDocs, done };
  const name = (id: NodeId) => pinName(chapter, id, progress);
  const [a, b] = item.pair.map(name);
  const curve = edgeCurve((item.after ?? item.before)!);
  const mid = pointAt(curve, 0.5);
  const pin = nodes.pinSize;
  const maskId = `spot-mask-${flash.id}-${step}`;
  const after = item.after;
  const title = after ? `${fmt(strings.report.edgeName, { a, b })} ${relName(after)}` : fmt(strings.board.spot.removed, { a, b });

  return (
    <div className="spot-scene" onClick={() => setStep((n) => n + 1)} role="status" aria-live="polite">
      <div className="spot-shade" />
      <div
        className="spot-stage"
        style={{ width: layout.stage.w, height: layout.stage.h, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}
      >
        <svg key={`${flash.id}-${step}`} width={layout.stage.w} height={layout.stage.h} viewBox={`0 0 ${layout.stage.w} ${layout.stage.h}`}>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={layout.stage.w} height={layout.stage.h}>
              <path className="spot-draw" d={pathD(curve)} pathLength={1} stroke="white" strokeWidth={90} strokeLinecap="round" fill="none" />
            </mask>
          </defs>
          <path className="spot-glow" d={pathD(curve)} />
          {item.before && (
            <g className={after ? 'spot-old' : 'spot-old gone'}>
              <EdgeStroke curve={edgeCurve(item.before)} rel={item.before.rel} fray={item.before.fray} hotline={item.before.mark === 'hotline'} />
            </g>
          )}
          {after && (
            <g mask={`url(#${maskId})`}>
              <EdgeStroke curve={curve} rel={after.rel} fray={after.fray} hotline={after.mark === 'hotline'} />
            </g>
          )}
          {item.pair.map((id) => {
            const { x, y } = nodeAt(id);
            return <image key={id} href={assetUrl('shared/pin-head.webp')} x={x - pin / 2} y={y - pin / 2} width={pin} height={pin} />;
          })}
        </svg>
        {item.pair.map((id) => {
          const p = pinTagAnchor(id, pinSide(chapter, id, progress));
          return (
            <div key={id} className="pin-tag spot-pin" style={{ left: p.x, top: p.y, transform: `translate(${p.tx * 100}%, ${p.ty * 100}%)` }}>
              {name(id)}
            </div>
          );
        })}
        {after && (
          <div key={`tag-${flash.id}-${step}`} className="edge-tag spot-tag" style={{ left: mid.x, top: mid.y }}>
            <RelSwatch rel={after.rel} hotline={after.mark === 'hotline'} />
            <span>{relName(after)}</span>
          </div>
        )}
      </div>
      <div key={`cap-${flash.id}-${step}`} className={`spot-caption${item.main ? ' main' : ''}`}>
        <div className="spot-caption-head">
          <span className="spot-chip">{item.main ? strings.board.spot.main : strings.board.spot.together}</span>
          <strong>{title}</strong>
        </div>
        {!item.main && item.text && <p>{item.text}</p>}
        <span className="spot-count">
          {fmt(strings.board.spot.count, { n: step + 1, total: flash.items.length })} · {strings.board.spot.tap}
        </span>
      </div>
    </div>
  );
}
