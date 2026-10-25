import { useEffect, useMemo, useRef, useState } from 'react';
import { layout } from '../../lib/assets';
import { clockEntry, clockText, minutesOf } from '../../lib/clockFlow';
import { strings } from '../../lib/data';
import { stageToScreen } from '../../lib/stageFit';
import type { ClockCheckpoint, Spot } from '../../types';
import { useStageFit } from '../Stage/Stage';
import './Report.css';

// 나눠 읽는 시계 카드(2026-10-23 교사 결정, 프롤로그 끝): 중2가 다 읽도록
// ① 한 장에 한두 문장을 큰 글씨로. 글은 한 번에 나오고 '다음'은 잠깐 뒤에 생긴다
//    (교사 의견: 문장이 하나씩 나오거나 '다음'을 오래 기다리게 하면 너무 늦다)
// ② 그 장이 말하는 화면의 물건(벽시계, 바늘, 보드의 실)을 빛낸다
// ③ 끝에 확인 질문 하나. 틀리면 그 문장을 다시 보여 주고 다시 고른다
// 카드는 화면 아래에 두어 보드와 시계가 가려지지 않게 한다.
const READY_AFTER_MS = 800;   // 장이 바뀐 뒤 '다음'까지(잘못 두 번 눌러 건너뛰지 않게)

export function StoryCard({ point, onDone }: { point: ClockCheckpoint; onDone: () => void }) {
  const story = point.story!;
  const entry = clockEntry(point.year);
  const pages = useMemo(
    () => [...entry.bulletin.reason.split('\n'), ...point.explanation.split('\n')],
    [entry, point],
  );
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(false);  // '다음' 단추
  const [checking, setChecking] = useState(false);
  const [tried, setTried] = useState(false);  // 확인 질문에서 한 번 틀림
  const [right, setRight] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ready) nextRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (checking) return;
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), READY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [page, checking]);

  // 빛낼 물건: 이 장이 가리키는 것. 확인 질문에서 틀리면 보드와 바늘
  const spots = new Set<Spot>(checking ? (tried && !right ? ['board', 'hand'] : []) : (story.spots[page] ?? []));

  const next = () => {
    if (page + 1 < pages.length) setPage(page + 1);
    else setChecking(true);
  };
  const options = [story.check.wrong, story.check.answer];

  return (
    <div className="reveal-backdrop story">
      <Spotlights spots={spots} minutes={minutesOf(entry)} />
      <div className="reveal-card story-card" role="dialog" aria-modal="true" aria-label={entry.bulletin.headline}>
        <div className="story-head">
          <span className="bulletin-headline">{entry.bulletin.headline}</span>
          <span className="reveal-minutes">{clockText(minutesOf(entry))}</span>
        </div>

        {!checking && (
          <>
            <p key={page} className="story-text story-sentence" aria-live="polite">
              {pages[page]}
            </p>
            <div className="story-foot">
              <span className="story-dots" aria-label={`${page + 1}/${pages.length}`}>
                {pages.map((_, i) => (i <= page ? '●' : '○')).join(' ')}
              </span>
              <button ref={nextRef} type="button" className="reveal-ok" onClick={next} disabled={!ready} style={{ visibility: ready ? 'visible' : 'hidden' }}>
                {strings.reveal.next}
              </button>
            </div>
          </>
        )}

        {checking && (
          <>
            <p className="story-text story-question">{story.check.question}</p>
            <div className="story-options">
              {options.map((o) => {
                const isWrong = o === story.check.wrong;
                return (
                  <button
                    key={o}
                    type="button"
                    className={isWrong && tried ? 'tried' : right && !isWrong ? 'right' : undefined}
                    disabled={right || (isWrong && tried)}
                    onClick={() => (isWrong ? setTried(true) : setRight(true))}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            <p className={`story-check-message${tried && !right ? ' wrong' : ''}`} aria-live="polite">
              {right ? `${strings.reveal.checkRight} ${story.check.hint}` : tried ? <>{strings.reveal.checkWrong} <mark className="key-quote">“{story.check.hint}”</mark></> : ''}
            </p>
            {right && (
              <button type="button" className="reveal-ok" onClick={onDone} autoFocus>
                {strings.reveal.ok}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 화면 물건을 빛내는 테두리(실제 px). 무대 좌표를 화면 좌표로 바꿔 그린다.
function Spotlights({ spots, minutes }: { spots: Set<Spot>; minutes: number }) {
  const fit = useStageFit();
  const { clock, board } = layout;
  const at = (x: number, y: number) => stageToScreen(fit, x, y);
  const c = at(clock.cx, clock.cy);
  const r = (clock.r + 8) * fit.scale;
  const angle = ((60 - minutes) * 6 * Math.PI) / 180;
  const len = clock.faceR * 0.8 * fit.scale;
  const p = at(board.paper.x, board.paper.y);
  return (
    <>
      {spots.has('board') && (
        <div
          className="spot spot-box"
          style={{ left: p.x - 6, top: p.y - 6, width: board.paper.w * fit.scale + 12, height: board.paper.h * fit.scale + 12 }}
        />
      )}
      {spots.has('clock') && <div className="spot spot-ring" style={{ left: c.x - r, top: c.y - r, width: r * 2, height: r * 2 }} />}
      {spots.has('hand') && (
        <svg className="spot spot-svg" width="100%" height="100%" aria-hidden="true">
          <line x1={c.x} y1={c.y} x2={c.x + Math.sin(angle) * len} y2={c.y - Math.cos(angle) * len} />
        </svg>
      )}
    </>
  );
}
