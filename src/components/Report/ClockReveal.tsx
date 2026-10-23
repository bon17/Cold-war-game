import { useEffect, useState } from 'react';
import { layout } from '../../lib/assets';
import { changedEdges, pairKey } from '../../lib/board';
import { clockEntry, isFirstHang, minutesOf, revealPath } from '../../lib/clockFlow';
import { chapterById, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { stageToScreen } from '../../lib/stageFit';
import { revealTasksFor } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { Chapter, ClockCheckpoint, ClockEntry } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import { useStageFit } from '../Stage/Stage';
import { edgeTitle } from './ReportForm';
import './Report.css';

// 시계 공개(기획서 5.4, 8.3): 바늘 → 해설 카드 → 본샘일보 1면(예측만). 카드는 '확인'을 눌러야 넘어가고 건너뛸 수 없다.
// 바늘은 한 칸씩 끊어 움직이고, 거쳐 가는 해마다 캡션과 함께 약 2.5초 머문다.
const STEP_MS = 130;
const HOLD_MS = 2500;
const PRINT_MS = 2000;

// 이 지점 공개 전에 시계가 가리키던 분(앞 지점의 마지막 값, 첫 지점이면 장 시작 값)
function minutesBefore(chapter: Chapter, point: ClockCheckpoint): number {
  const i = chapter.clock.indexOf(point);
  if (i <= 0) return minutesOf(chapter.startClock ?? {});
  return minutesOf(revealPath(chapter.clock[i - 1]).pop()!);
}

export function ClockReveal() {
  const { chapterId, reveal, reports, board, done, advanceReveal, setClockShown } = useGame();
  const chapter = chapterById(chapterId);
  const point = reveal ? chapter.clock.find((p) => p.id === reveal.pointId) : undefined;
  const fit = useStageFit();
  const [caption, setCaption] = useState<ClockEntry | null>(null);
  const [printed, setPrinted] = useState(false);

  // 바늘 단계: 경로의 해마다 한 칸씩 움직이고 캡션을 보여 준 뒤 저절로 다음으로
  useEffect(() => {
    if (!point || reveal?.step !== 'needle') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let t = 0;
    // 처음 걸리는 시계(프롤로그)는 바늘을 돌리지 않고 그 값으로 건다
    let cur = isFirstHang(chapter, point) ? minutesOf(revealPath(point)[0]) : useGame.getState().clockShown.minutes;
    for (const entry of revealPath(point)) {
      const target = minutesOf(entry);
      const startMinutes = cur;
      at(t, () => {
        setCaption(null);
        setClockShown(startMinutes, entry.year);
      });
      if (reduce) {
        cur = target;
      } else {
        while (cur !== target) {
          cur += Math.sign(target - cur);
          t += STEP_MS;
          const m = cur;
          at(t, () => setClockShown(m, entry.year));
        }
      }
      at(t + 150, () => {
        setClockShown(target, entry.year);
        setCaption(entry);
      });
      t += 150 + HOLD_MS;
    }
    at(t, () => {
      setCaption(null);
      advanceReveal();
    });
    return () => timers.forEach(window.clearTimeout);
  }, [chapter, point, reveal?.step, setClockShown, advanceReveal]);

  // 1면: 인쇄 연출 뒤에 '확인'
  useEffect(() => {
    if (reveal?.step !== 'newspaper') return;
    setPrinted(false);
    const timer = window.setTimeout(() => setPrinted(true), PRINT_MS);
    return () => window.clearTimeout(timer);
  }, [reveal?.step]);

  if (!point || !reveal) return null;

  const entry = clockEntry(point.year);
  const report = reports[point.id];
  const ok = (
    <button type="button" className="reveal-ok" onClick={advanceReveal} autoFocus>
      {strings.reveal.ok}
    </button>
  );

  if (reveal.step === 'needle') {
    const p = stageToScreen(fit, layout.clock.cx, layout.clock.plaque.y + layout.clock.plaque.h + 14);
    return (
      <div className="reveal-dim">
        {caption && (
          <div className="reveal-caption" style={{ left: p.x, top: p.y }} aria-live="polite">
            {fmt(strings.reveal.caption, { year: caption.year, caption: caption.caption })}
          </div>
        )}
      </div>
    );
  }

  let card;
  if (reveal.step === 'explanation') {
    const after = minutesOf(entry);
    const before = minutesBefore(chapter, point);
    const moved = after > before ? 'farther' : after < before ? 'closer' : 'same';
    const same = report && report.direction === point.direction;
    const changed = revealTasksFor(chapter, point.id);
    // 처음 걸리는 시계(1947년 회보 표지)는 발표 전보가 아니고 바늘이 움직이지도 않았다
    const first = isFirstHang(chapter, point);
    const [lead, ...rest] = entry.bulletin.reason.split('\n');
    card = (
      <div className="reveal-card explanation" role="dialog" aria-modal="true" aria-label={entry.bulletin.headline}>
        {!first && <div className="bulletin-from">{strings.reveal.from}</div>}
        <div className="bulletin-headline">{entry.bulletin.headline}</div>
        <div className="reveal-minutes">{fmt(strings.clock.plaque, { n: after })}</div>
        <p>{!first && <><strong>{strings.reveal.moved[moved]}</strong> </>}{lead}</p>
        {rest.map((line, i) => <p key={i}>{line}</p>)}
        {report && <div className={`reveal-compare${same ? ' same' : ' different'}`}>{same ? strings.reveal.same : strings.reveal.different}</div>}
        <p>{point.explanation}</p>
        {changed.map((t) => {
          const e = board.find((x) => pairKey(x.pair) === pairKey(t.pair));
          return (
            <div key={pairKey(t.pair)} className="reveal-changed">
              <span>{strings.reveal.changedTitle}:</span>
              <RelSwatch rel={e?.rel ?? t.to} width={48} />
              <span>
                {edgeTitle(chapter, t)} {strings.relations[e?.rel ?? t.to]}
              </span>
            </div>
          );
        })}
        {ok}
      </div>
    );
  } else if (reveal.step === 'newspaper' && report) {
    const headline = fmt(report.direction === 'closer' ? strings.newspaper.headlineCloser : strings.newspaper.headlineFarther, {
      year: point.year,
    });
    const list = changedEdges(chapter, board, done)
      .map((e) => `${edgeTitle(chapter, e)} ${e.label ?? strings.relations[e.rel]}`)
      .join(' · ');
    const wrong = report.direction !== point.direction;
    card = (
      <div className={`reveal-card newspaper${printed ? ' printed' : ''}`} role="dialog" aria-modal="true" aria-label={headline}>
        <div className="paper-masthead">{strings.newspaper.masthead}</div>
        <div className="paper-dateline">{fmt(strings.newspaper.dateline, { year: point.year })}</div>
        <h2 className="paper-headline">{headline}</h2>
        {list && <p className="paper-sub">{fmt(strings.newspaper.sub, { list })}</p>}
        <div className="paper-byline">{strings.newspaper.byline}</div>
        {wrong && (
          <div className="paper-correction">
            <strong>{strings.newspaper.correctionTitle}</strong>{' '}
            {fmt(strings.newspaper.correction, {
              year: point.year,
              n: minutesOf(entry),
              result: point.direction === 'closer' ? strings.newspaper.resultCloser : strings.newspaper.resultFarther,
            })}
            {point.wrongNote && ` ${point.wrongNote}`}
          </div>
        )}
        {printed && ok}
      </div>
    );
  }

  return <div className="reveal-backdrop">{card}</div>;
}

