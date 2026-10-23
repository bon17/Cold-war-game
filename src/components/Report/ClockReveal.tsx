import { useEffect, useState } from 'react';
import { layout } from '../../lib/assets';
import { pairKey } from '../../lib/board';
import { clockEntry, minutesOf, revealPath } from '../../lib/clockFlow';
import { chapterById, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { stageToScreen } from '../../lib/stageFit';
import { useGame } from '../../store/gameStore';
import type { ClockEntry } from '../../types';
import { RelSwatch } from '../Board/EdgeStroke';
import { useStageFit } from '../Stage/Stage';
import { edgeTitle } from './ReportForm';
import './Report.css';

// 시계 공개(기획서 5.4, 8.3). 발표 전보·해설·정정 보도는 '확인'을 눌러야 넘어가고 건너뛸 수 없다.
// 바늘은 한 칸씩 끊어 움직이고, 거쳐 가는 해마다 캡션과 함께 약 2.5초 머문다.
const STEP_MS = 130;
const HOLD_MS = 2500;
const PRINT_MS = 2000;

export function ClockReveal() {
  const { chapterId, reveal, reports, bonus, board, advanceReveal, setClockShown, answerBonus } = useGame();
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
    let cur = useGame.getState().clockShown.minutes;
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
  }, [point, reveal?.step, setClockShown, advanceReveal]);

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
  const name = (key: string) => {
    const e = board.find((x) => pairKey(x.pair) === key);
    return e ? edgeTitle(e) : key;
  };

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
  if (reveal.step === 'bulletin') {
    card = (
      <div className="reveal-card bulletin" role="dialog" aria-modal="true" aria-label={entry.bulletin.headline}>
        <div className="bulletin-from">{strings.reveal.from}</div>
        <div className="bulletin-headline">{entry.bulletin.headline}</div>
        <p className="bulletin-body">{entry.bulletin.reason}</p>
        {ok}
      </div>
    );
  } else if (reveal.step === 'explanation') {
    const same = report && report.direction === point.direction;
    const notBest = report && point.bestEdges && !point.bestEdges.some((pair) => pairKey(pair) === report.edge);
    const note = report && point.edgeNotes?.find((n) => pairKey(n.pair) === report.edge)?.note;
    card = (
      <div className="reveal-card explanation" role="dialog" aria-modal="true" aria-label={strings.reveal.explanationTitle}>
        {report && <div className={`reveal-compare${same ? ' same' : ' different'}`}>{same ? strings.reveal.same : strings.reveal.different}</div>}
        <div className="reveal-card-title">{strings.reveal.explanationTitle}</div>
        <p>{point.explanation}</p>
        {note && <p className="reveal-note">{note}</p>}
        {notBest && point.bestEdges && (
          <p className="reveal-note">{fmt(strings.reveal.bestEdge, { edge: name(pairKey(point.bestEdges[0])) })}</p>
        )}
        {ok}
      </div>
    );
  } else if (reveal.step === 'newspaper' && report) {
    const headline = fmt(report.direction === 'closer' ? strings.newspaper.headlineCloser : strings.newspaper.headlineFarther, {
      year: point.year,
      edge: name(report.edge),
    });
    const wrong = report.direction !== point.direction;
    card = (
      <div className={`reveal-card newspaper${printed ? ' printed' : ''}`} role="dialog" aria-modal="true" aria-label={headline}>
        <div className="paper-masthead">{strings.newspaper.masthead}</div>
        <div className="paper-dateline">{fmt(strings.newspaper.dateline, { year: point.year })}</div>
        <h2 className="paper-headline">{headline}</h2>
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
  } else if (reveal.step === 'bonus' && chapter.bonusQuestion) {
    const q = chapter.bonusQuestion;
    const answerKey = pairKey(q.answer);
    const [a, b] = q.answer.map((id) => nodes.nodes[id]?.name ?? id);
    // 질문이 묻는 실(about) 자신은 선택지에서 뺀다
    const choices = board.filter((e) => !q.about || pairKey(e.pair) !== pairKey(q.about));
    card = (
      <div className="reveal-card bonus" role="dialog" aria-modal="true" aria-label={strings.bonus.title}>
        <div className="reveal-card-title">{strings.bonus.title}</div>
        <p className="bonus-prompt">{q.prompt}</p>
        <div className="report-edges">
          {choices.map((e) => {
            const key = pairKey(e.pair);
            const state = bonus ? (key === answerKey ? ' right' : key === bonus.edge ? ' picked' : '') : '';
            return (
              <button key={key} type="button" className={`report-edge${state}`} disabled={!!bonus} onClick={() => answerBonus(key)}>
                <RelSwatch rel={e.rel} width={40} />
                <span>{edgeTitle(e)}</span>
              </button>
            );
          })}
        </div>
        {bonus && (
          <>
            <p className="reveal-note">
              {bonus.correct ? strings.bonus.correct : fmt(strings.bonus.wrong, { a, b })}{' '}
              {q.explanation}
            </p>
            {ok}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="reveal-backdrop">
      {card}
    </div>
  );
}
