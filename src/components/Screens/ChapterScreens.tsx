import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../../lib/assets';
import { chapterLabel } from '../../lib/chapterLabel';
import { chapterById, chapters, nodes, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { chapterAchievements, chapterStars, grade } from '../../lib/scoring';
import { startWithCode } from '../../lib/session';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store/gameStore';
import { useSession, type ArchiveEntry } from '../../store/sessionStore';
import './Screens.css';

const COVER_MS = 3000;
const WINDOW_MS = 8000;
const WINDOW_SKIP_AFTER_MS = 1500;

// 허구 고지(기획서 13.2): '확인'을 눌러야 넘어간다
export function NoticeCard() {
  const { phase, setPhase } = useSession();
  if (phase !== 'notice') return null;
  return (
    <div className="screen-backdrop">
      <div className="screen-card notice">
        <p>{strings.notices.fiction}</p>
        <p>{strings.notices.windowRule}</p>
        <button type="button" className="reveal-ok" onClick={() => setPhase('cover')} autoFocus>
          {strings.notice.ok}
        </button>
      </div>
    </div>
  );
}

// 장 표지: 3초 뒤 저절로, 누르면 바로(기획서 8.3). 다음은 '할 일' 카드
export function CoverScreen() {
  const { phase, setPhase } = useSession();
  const chapter = chapterById(useGame((s) => s.chapterId));
  useEffect(() => {
    if (phase !== 'cover') return;
    const timer = window.setTimeout(() => setPhase('mission'), COVER_MS);
    return () => window.clearTimeout(timer);
  }, [phase, setPhase]);
  if (phase !== 'cover') return null;
  return (
    <button type="button" className="cover-screen" onClick={() => setPhase('mission')} aria-label={strings.cover.tap}>
      <img className="kenburns" src={assetUrl(chapter.cover.image)} alt={chapter.cover.alt} />
      <div className="cover-text">
        <div className="cover-chapter">{chapterLabel(chapter)}</div>
        <div className="cover-title">{chapter.title}</div>
        <div className="cover-question">{chapter.cover.question}</div>
      </div>
      <div className="cover-code">{fmt(strings.cover.code, { code: chapter.code })}</div>
    </button>
  );
}

// 이번 장에서 할 일(2026-10-23, 기획서 5.0): 시계와 실이 무엇인지, 이 장의 상황, 할 일 세 가지. 책상은 뒤에 보이기만 한다.
export function MissionCard() {
  const { phase, setPhase } = useSession();
  const chapter = chapterById(useGame((s) => s.chapterId));
  if (phase !== 'mission') return null;
  const m = strings.mission;
  return (
    <div className="screen-backdrop">
      <div className="screen-card mission" role="dialog" aria-modal="true" aria-label={m.title}>
        <div className="result-title">{m.title}</div>
        <div className="mission-room">
          <div className="mission-label">{m.roomTitle}</div>
          <p>{m.clockLine}</p>
          <p>{m.boardLine}</p>
        </div>
        {chapter.mission.lines.map((line, i) => (
          <p key={i} className="mission-line">{line}</p>
        ))}
        <div className="mission-label">{m.stepsTitle}</div>
        <ol className="mission-steps">
          {m.steps.map((step, i) => (
            <li key={i}>{fmt(step, { n: chapter.documents.length })}</li>
          ))}
        </ol>
        <button type="button" className="reveal-ok" onClick={() => setPhase('desk')} autoFocus>
          {m.go}
        </button>
      </div>
    </div>
  );
}

// 창밖 장면(기획서 5.5): 8초 이내, 캡션을 한 번 보여 준 뒤 넘어갈 수 있다. 'AI 일러스트 · 실제 사진 아님'
export function WindowScene() {
  const { phase, setPhase } = useSession();
  const chapter = chapterById(useGame((s) => s.chapterId));
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => {
    if (phase !== 'window') return;
    setCanSkip(false);
    const skip = window.setTimeout(() => setCanSkip(true), WINDOW_SKIP_AFTER_MS);
    const done = window.setTimeout(() => setPhase('result'), WINDOW_MS);
    return () => {
      window.clearTimeout(skip);
      window.clearTimeout(done);
    };
  }, [phase, setPhase]);
  if (phase !== 'window') return null;
  return (
    <div className="window-scene">
      <img className="kenburns slow" src={assetUrl(chapter.window.image)} alt={chapter.window.alt} />
      <p className="window-caption">{chapter.window.caption}</p>
      <div className="window-ai">{strings.notices.aiShort}</div>
      {canSkip && (
        <button type="button" className="window-skip" onClick={() => setPhase('result')}>
          {strings.windowScene.skip}
        </button>
      )}
    </div>
  );
}

// 근무 평정표(기획서 5.6): 별 도장 연출 뒤 '확인'
export function ResultCard() {
  const { phase, name, stars, finishChapter, setPhase } = useSession();
  const game = useGame();
  const chapter = chapterById(game.chapterId);
  const recorded = useRef<string | null>(null);
  const s = chapterStars(chapter, game);

  useEffect(() => {
    if (phase !== 'result' || recorded.current === chapter.id) return;
    recorded.current = chapter.id;
    const archive: ArchiveEntry[] = chapter.clock
      .filter((p) => p.mode === 'predict' && game.reports[p.id] && game.reports[p.id].direction !== p.direction)
      .map((p) => ({ chapterId: chapter.id, pointId: p.id, year: p.year, ...game.reports[p.id] }));
    finishChapter(chapter.id, s.total, [...game.achievements, ...chapterAchievements(chapter, game)], archive);
    s.rows.forEach((r, i) => r.firstTry && window.setTimeout(sfx.stamp, 500 + i * 450));
  }, [phase, chapter, game, s, finishChapter]);

  if (phase !== 'result') return null;
  const g = grade(stars);
  const rows = s.rows.map((r) => {
    const [a, b] = r.task.pair.map((id) => nodes.nodes[id]?.name ?? id);
    return [r.firstTry, fmt(r.firstTry ? strings.result.starFirst : strings.result.starAgain, { a, b })] as const;
  });
  return (
    <div className="screen-backdrop">
      <div className="screen-card result">
        <div className="result-title">{fmt(strings.result.title, { chapter: `${chapterLabel(chapter)} ${chapter.title}` })}</div>
        <div className="result-name">{fmt(strings.result.name, { name: name ?? '' })}</div>
        <ol className="result-rows">
          {rows.map(([on, text], i) => (
            <li key={i} className={on ? 'on' : ''} style={{ ['--delay' as string]: `${0.5 + i * 0.45}s` }}>
              <span className="result-star" aria-hidden="true">{on ? '★' : '☆'}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="result-others">
          {fmt(strings.result.othersLine, {
            list: Object.entries(stars)
              .filter(([id]) => id !== chapter.id)
              .map(([id, n]) => `${chapters.some((c) => c.id === id) ? chapterLabel(chapterById(id)) : id} ${n ?? '–'}`)
              .join(' · ') || strings.result.othersNone,
          })}
        </p>
        {g && <p className="result-grade">{fmt(strings.result.gradeLine, { grade: strings.result.grades[g.grade], got: g.got, max: g.max })}</p>}
        <button type="button" className="reveal-ok" onClick={() => setPhase('end')}>
          {strings.result.ok}
        </button>
      </div>
    </div>
  );
}

// 체험판 끝
export function EndScreen() {
  const { phase, name, setPhase } = useSession();
  const chapterId = useGame((s) => s.chapterId);
  if (phase !== 'end') return null;
  return (
    <div className="screen-backdrop">
      <div className="screen-card end">
        <div className="result-title">{strings.end.title}</div>
        <p>{fmt(strings.end.body, { name: name ?? '' })}</p>
        <div className="start-row">
          <button type="button" className="big-button" onClick={() => name && startWithCode(name, chapterId)}>
            {strings.end.again}
          </button>
          <button type="button" className="big-button quiet" onClick={() => setPhase('start')}>
            {strings.end.toTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
