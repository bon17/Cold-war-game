import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../../lib/assets';
import { chapterLabel } from '../../lib/chapterLabel';
import { chapterById, chapters, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { chapterAchievements, chapterStars, grade } from '../../lib/scoring';
import { startWithCode } from '../../lib/session';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store/gameStore';
import { useSession, type ArchiveEntry } from '../../store/sessionStore';
import type { Rel } from '../../types';
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

// 장 표지: 3초 뒤 저절로, 누르면 바로(기획서 8.3)
export function CoverScreen() {
  const { phase, setPhase } = useSession();
  const chapter = chapterById(useGame((s) => s.chapterId));
  const hasHandover = !!chapter.handover;
  const next = () => setPhase(hasHandover ? 'handover' : 'desk');
  useEffect(() => {
    if (phase !== 'cover') return;
    const timer = window.setTimeout(() => setPhase(hasHandover ? 'handover' : 'desk'), COVER_MS);
    return () => window.clearTimeout(timer);
  }, [phase, hasHandover, setPhase]);
  if (phase !== 'cover') return null;
  return (
    <button type="button" className="cover-screen" onClick={next} aria-label={strings.cover.tap}>
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

// 인계 메모(아트 계획서 2.7 ①): 빈칸 하나를 관계 3개 중에서 고른다. 정답은 바로 보여 준다. 점수와 무관, 건너뛸 수 있다.
export function HandoverMemo() {
  const { phase, setPhase } = useSession();
  const chapter = chapterById(useGame((s) => s.chapterId));
  const [picked, setPicked] = useState<Rel | null>(null);
  const memo = chapter.handover;
  if (phase !== 'handover' || !memo) return null;

  // 정답이 늘 같은 자리에 오지 않게 가운데에 둔다
  const wrong = memo.options.filter((r) => r !== memo.answer);
  const options = [wrong[0], memo.answer, ...wrong.slice(1)];
  const blank = picked ? strings.relations[memo.answer] : '　　　';

  return (
    <>
    {/* 메모를 보는 동안 책상은 보이기만 하고 눌리지 않게 막는다 */}
    <div className="handover-block" />
    <div className="handover-card" role="dialog" aria-label={strings.handover.envelope}>
      <div className="handover-head">{strings.handover.envelope}</div>
      <div className="handover-lines">
        {memo.lines.map((line, i) => {
          const [before, after] = line.split('{blank}');
          return (
            <p key={i}>
              {before}
              {after !== undefined && (
                <>
                  <span className={`handover-blank${picked ? ' filled' : ''}`}>{blank}</span>
                  {after}
                </>
              )}
            </p>
          );
        })}
        <div className="handover-sign">— {memo.signature}</div>
      </div>
      {!picked ? (
        <>
          <div className="handover-q">{strings.handover.intro}</div>
          <div className="handover-options">
            {options.map((r) => (
              <button key={r} type="button" className="big-button" onClick={() => setPicked(r)}>
                {strings.relations[r]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className={`handover-result${picked === memo.answer ? ' right' : ''}`} aria-live="polite">
          {picked === memo.answer ? strings.handover.right : fmt(strings.handover.wrong, { answer: strings.relations[memo.answer] })}
        </p>
      )}
      <div className="handover-foot">
        <button type="button" className={picked ? 'reveal-ok' : 'quiet-button'} onClick={() => setPhase('desk')} autoFocus={!!picked}>
          {picked ? strings.handover.go : strings.handover.skip}
        </button>
      </div>
    </div>
    </>
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
    [s.edges, s.reason, s.extra].forEach((on, i) => on && window.setTimeout(sfx.stamp, 500 + i * 450));
  }, [phase, chapter, game, s, finishChapter]);

  if (phase !== 'result') return null;
  const g = grade(stars);
  const rows = [
    [s.edges, strings.result.star1],
    [s.reason, strings.result.star2],
    [s.extra, strings.result.star3],
  ] as const;
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
