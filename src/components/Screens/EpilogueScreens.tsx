import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { assetUrl, layout } from '../../lib/assets';
import { pairKey } from '../../lib/board';
import { edgeCurve } from '../../lib/boardLayout';
import { clockText } from '../../lib/clockFlow';
import { chapterById, chapters, glossary, strings } from '../../lib/data';
import { edgeHistory } from '../../lib/history';
import { sfx } from '../../lib/sound';
import { angleAt, pathD, pointAt } from '../../lib/stringPath';
import { useGame } from '../../store/gameStore';
import { useSession } from '../../store/sessionStore';
import type { BoardEdge } from '../../types';
import { EdgeStroke } from '../Board/EdgeStroke';
import { useStageFit } from '../Stage/Stage';
import './Epilogue.css';

// 에필로그 끝맺음(2026-10-25 교사 결정, docs/drafts/epilogue.md). 시계 공개 뒤:
// 80년의 창(장마다 본 창밖 그림이 차례로) → 서랍 속 편지(1945년 7번 자리 당직자, 허구) → 쓰기 화면(답장) →
// 마지막 매듭(학생이 흰 실에 매듭을 짓는다) → 램프 꺼짐 → 끝 화면. 글은 모두 epilogue.json의 finale에 있다.

const FRAME_MS = 2600;          // 80년의 창: 그림 한 장
const LAST_FRAME_MS = 6000;     // 마지막 휴전선 그림은 더 오래
const MONTAGE_SKIP_AFTER_MS = 8000;
const TIED_MS = 3600;           // 매듭을 지은 뒤 글을 읽는 시간
const DARK_MS = 5000;           // 램프가 꺼진 뒤 흰 실과 숫자판만 남는 시간

function useEpilogue() {
  const chapter = chapterById(useGame((s) => s.chapterId));
  return { chapter, finale: chapter.finale };
}

// 80년의 창: 창밖 그림이 겹치며 바뀌고, 사람이 없는 휴전선 들판에서 멈춘다
export function Montage() {
  const { phase, setPhase } = useSession();
  const { finale } = useEpilogue();
  const [shown, setShown] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const frames = useMemo(
    () =>
      (finale?.montage.frames ?? []).map((f) => {
        const from = f.chapter ? chapterById(f.chapter).window : undefined;
        return { image: f.image ?? from?.image ?? '', alt: f.alt ?? from?.alt ?? '', caption: f.caption };
      }),
    [finale],
  );

  useEffect(() => {
    if (phase !== 'window' || !finale) return;
    setShown(0);
    setCanSkip(false);
    const timers = frames.map((_, i) => window.setTimeout(() => setShown(i), i * FRAME_MS));
    timers.push(window.setTimeout(() => setCanSkip(true), MONTAGE_SKIP_AFTER_MS));
    timers.push(window.setTimeout(() => setPhase('letter'), (frames.length - 1) * FRAME_MS + LAST_FRAME_MS));
    return () => timers.forEach(window.clearTimeout);
  }, [phase, finale, frames, setPhase]);

  if (phase !== 'window' || !finale || frames.length === 0) return null;
  const last = shown === frames.length - 1;
  return (
    <div className="window-scene montage">
      {frames.map((f, i) => (
        <img
          key={f.image}
          className={`montage-frame${i === shown ? ' on' : ''}`}
          src={assetUrl(f.image)}
          alt={i === shown ? f.alt : ''}
          aria-hidden={i !== shown}
        />
      ))}
      <div className="window-header">{finale.montage.title}</div>
      <div className="window-caption" aria-live="polite">
        <p className="window-caption-main">{frames[shown].caption}</p>
        {last && <p className="window-link">{finale.montage.lastLine}</p>}
      </div>
      <div className="window-ai">{strings.notices.aiShort}</div>
      {canSkip && (
        <button type="button" className="window-skip" onClick={() => setPhase('letter')}>
          {strings.windowScene.skip}
        </button>
      )}
    </div>
  );
}

// 서랍 속 편지: 봉투를 누르면 손글씨 편지가 펼쳐지고, '답장 쓰기'로 쓰기 화면
export function LetterScene() {
  const { phase, setPhase } = useSession();
  const { finale } = useEpilogue();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (phase === 'letter') setOpen(false);
  }, [phase]);
  if (phase !== 'letter' || !finale) return null;
  const l = finale.letter;
  return (
    <div className="screen-backdrop letter-backdrop">
      {open ? (
        <div className="letter-paper" role="dialog" aria-modal="true" aria-label={l.salutation}>
          <p className="letter-salutation">{l.salutation}</p>
          {l.lines.map((line, i) => (
            <p key={i} className="letter-line">{line}</p>
          ))}
          <p className="letter-signature">{l.signature}</p>
          <button type="button" className="reveal-ok letter-reply" onClick={() => setPhase('writing')} autoFocus>
            {l.reply}
          </button>
        </div>
      ) : (
        <div className="letter-found">
          <p>{l.found}</p>
          <button
            type="button"
            className="letter-envelope"
            onClick={() => {
              sfx.paper();
              setOpen(true);
            }}
            autoFocus
          >
            <img src={assetUrl('shared/envelope.webp')} alt="" />
            <span>{l.open}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// 쓰기 화면: 다음 당직자에게 남기는 인계 메모. 게임은 글을 저장하지 않는다(종이 활동지, 기획서 4.3)
export function WritingScreen() {
  const { phase, setPhase } = useSession();
  const { chapter, finale } = useEpilogue();
  const done = useGame((s) => s.done);
  const [word, setWord] = useState<string | null>(null);
  useEffect(() => {
    if (phase === 'writing') setWord(null);
  }, [phase]);
  if (phase !== 'writing' || !finale || !chapter.epilogueBoard) return null;
  const w = finale.writing;
  const ep = chapter.epilogueBoard;
  // 이 실의 이력은 장 데이터로 만든다(막 시작 코드로 들어와도 같다). 끝에 '지금은?'
  const history = [
    ...edgeHistory(chapters, chapter.id, pairKey(ep.pair), done)
      .filter((h) => h.year !== null)
      .map((h) => `${h.year} ${h.label ?? strings.relations[h.rel]}`),
    ep.label,
  ].join(' → ');
  const meaning = word ? glossary[word] : undefined;
  return (
    <div className="screen-backdrop">
      <div className="screen-card writing" role="dialog" aria-modal="true" aria-label={w.title}>
        <div className="result-title">{w.title}</div>
        <p className="writing-guide">{w.guide}</p>
        <p className="writing-question">{w.question}</p>
        <div className="writing-box">
          <div className="mission-label">{w.historyTitle}</div>
          <p className="writing-history">{history}</p>
        </div>
        <div className="writing-box">
          <div className="mission-label">{w.frameTitle}</div>
          <p className="writing-frame">{w.frame}</p>
        </div>
        <div className="mission-label">
          {w.wordsTitle} <span className="writing-hint">{w.wordsHint}</span>
        </div>
        <div className="writing-words">
          {w.words.map((x) => (
            <button
              key={x}
              type="button"
              className={`writing-word${glossary[x] ? ' has-meaning' : ''}${word === x ? ' on' : ''}`}
              onClick={() => setWord(word === x ? null : x)}
            >
              {x}
            </button>
          ))}
        </div>
        <p className="writing-meaning" aria-live="polite">{meaning ? `${word}: ${meaning}` : ' '}</p>
        <button type="button" className="reveal-ok" onClick={() => setPhase('finale')}>
          {w.done}
        </button>
      </div>
    </div>
  );
}

// 마지막 매듭의 단계: prompt(흰 실만 밝음) → tied(매듭) → dark(램프가 꺼지고 흰 실과 숫자판만)
type Step = 'prompt' | 'tied' | 'dark';
const useFinaleStep = create<{ step: Step; setStep: (s: Step) => void }>((set) => ({
  step: 'prompt',
  setStep: (step) => set({ step }),
}));

const UNDYED = '#f6f2e8';
const INK = 'var(--string-outline)';

// 실을 한 번 감아 묶은 매듭(실 위 가운데)
function Knot({ edge }: { edge: BoardEdge }) {
  const curve = edgeCurve(edge);
  const p = pointAt(curve, 0.5);
  const deg = (angleAt(curve, 0.5) * 180) / Math.PI;
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${deg}) scale(1.35)`}>
      <g className="finale-knot">
        <ellipse rx={13} ry={9} fill="none" stroke={INK} strokeWidth={9} />
        <ellipse rx={13} ry={9} fill="none" stroke={UNDYED} strokeWidth={5.5} />
        <path d="M 8 6 q 10 9 6 24" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
        <path d="M 8 6 q 10 9 6 24" fill="none" stroke={UNDYED} strokeWidth={4} strokeLinecap="round" />
        <circle r={6} fill={UNDYED} stroke={INK} strokeWidth={2} />
      </g>
    </g>
  );
}

// 마지막 매듭과 램프 꺼짐. 무대 위에 무대 좌표로 흰 실(누를 수 있음), 매듭, 숫자판을 다시 그리고 나머지는 어둡게 덮는다
export function FinaleScene({ edges }: { edges: BoardEdge[] }) {
  const { phase, setPhase } = useSession();
  const { finale } = useEpilogue();
  const minutes = useGame((s) => s.clockShown.minutes);
  const { step, setStep } = useFinaleStep();
  const fit = useStageFit();
  const edge = edges.find((e) => e.undyed);

  useEffect(() => {
    if (phase === 'finale') setStep('prompt');
  }, [phase, setStep]);
  useEffect(() => {
    if (phase !== 'finale' || step === 'prompt') return;
    const timer =
      step === 'tied'
        ? window.setTimeout(() => {
            sfx.lamp();
            setStep('dark');
          }, TIED_MS)
        : window.setTimeout(() => setPhase('end'), DARK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, step, setStep, setPhase]);

  if (phase !== 'finale' || !finale || !edge) return null;
  const tie = () => {
    if (step !== 'prompt') return;
    sfx.ting('NORMAL');
    setStep('tied');
  };
  const d = edgeCurve(edge);
  const { plaque } = layout.clock;
  return (
    <div className={`finale-scene ${step}`}>
      <div className="finale-shade" />
      <div
        className="finale-stage"
        style={{ width: layout.stage.w, height: layout.stage.h, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}
      >
        <svg width={layout.stage.w} height={layout.stage.h} viewBox={`0 0 ${layout.stage.w} ${layout.stage.h}`}>
          <g className={step === 'prompt' ? 'edge-undyed' : undefined}>
            <EdgeStroke curve={d} rel={edge.rel} undyed />
          </g>
          {step !== 'prompt' && <Knot edge={edge} />}
          {step === 'prompt' && (
            <path
              className="finale-hit"
              d={pathD(d)}
              onClick={tie}
              aria-hidden="true"
            />
          )}
        </svg>
        {step === 'dark' && (
          <div className="clock-plaque finale-plaque" style={{ left: plaque.x, top: plaque.y, width: plaque.w, height: plaque.h }}>
            <span className="clock-plaque-text">{clockText(minutes)}</span>
          </div>
        )}
      </div>
      {step !== 'dark' && (
        <div className="finale-text" aria-live="polite">
          {step === 'prompt' ? (
            <>
              <p>{finale.knot.prompt}</p>
              <button type="button" className="reveal-ok" onClick={tie} autoFocus>
                {finale.knot.button}
              </button>
            </>
          ) : (
            <p>{finale.knot.after}</p>
          )}
        </div>
      )}
    </div>
  );
}
