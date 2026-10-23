import { useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl, layout } from '../../lib/assets';
import { pairKey } from '../../lib/board';
import { chapterById, strings } from '../../lib/data';
import { useGame, type CollectedClue } from '../../store/gameStore';
import './CluePanel.css';

// 책상 위 단서 쪽지(모은 순서). 누르면 고르고(다시 누르면 놓음), 실 이름표로 끌어다 놓으면 그 실의 실 걸기 창이 열린다.
// 실을 거는 데 쓰인 쪽지는 흐려지고 ✓가 붙는다.
const TAPES = ['shared/tape-1.webp', 'shared/tape-2.webp', 'shared/tape-3.webp'];
const DRAG_START_PX = 8;

export function CluePanel() {
  const { chapterId, clues, selectedClue, done, selectClue, openEdgeDialog } = useGame();
  const chapter = chapterById(chapterId);
  const { x, y, w, h } = layout.hotspots.clues;
  const drag = useRef<{ clue: CollectedClue; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; text: string } | null>(null);

  const used = new Set(
    chapter.edgeTasks.filter((t) => done[pairKey(t.pair)] && !done[pairKey(t.pair)].helped).flatMap((t) => t.evidence),
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, clue: CollectedClue) => {
    drag.current = { clue, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_START_PX) return;
    d.moved = true;
    setGhost({ x: e.clientX, y: e.clientY, text: d.clue.clue });
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d?.moved) return;
    suppressClick.current = true;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-edge-key]');
    if (target?.dataset.edgeKey) openEdgeDialog(target.dataset.edgeKey, d.clue);
  };

  return (
    <>
      <ul className="clue-tray" style={{ left: x, top: y, width: w, height: h }} aria-label={strings.labels.clues}>
        {clues.map((c, i) => {
          const on = selectedClue?.docId === c.docId && selectedClue.clue === c.clue;
          return (
            <li key={`${c.docId}:${c.clue}`} className="clue-slip-item" style={{ ['--tilt' as string]: `${i % 2 ? 1.2 : -1.2}deg` }}>
              <button
                type="button"
                className={`clue-slip${on ? ' on' : ''}${used.has(c.clue) ? ' used' : ''}`}
                aria-pressed={on}
                onPointerDown={(e) => onPointerDown(e, c)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => { drag.current = null; setGhost(null); }}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  selectClue(on ? null : c);
                }}
              >
                <img className="clue-tape" src={assetUrl(TAPES[i % TAPES.length])} alt="" draggable={false} />
                {c.clue}
                {used.has(c.clue) && <span className="clue-used"> ✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {ghost && createPortal(<div className="clue-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.text}</div>, document.body)}
    </>
  );
}
