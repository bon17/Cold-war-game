import { useState } from 'react';
import { chapterLabel } from '../../lib/chapterLabel';
import { chapterById, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { findSlot, normalizeName } from '../../lib/save';
import { chapterForCode, resume, startFresh, startWithCode } from '../../lib/session';
import { setSoundEnabled, sfx, unlockAudio } from '../../lib/sound';
import { useSession } from '../../store/sessionStore';
import type { SaveSlot } from '../../types';
import './Screens.css';

// 타이틀(기획서 8.1): 어둠 속 방 → 소리 켜기/끄기(크게) → 램프 켜기(첫 클릭: 소리 허락 + 전체 화면) → 이름 입력
export function TitleScreen() {
  const { phase, sound, setSound, turnLampOn } = useSession();
  if (phase !== 'title' && phase !== 'start') return null;

  const lightLamp = () => {
    unlockAudio();
    setSoundEnabled(!!sound);
    sfx.lamp();
    try {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      // 전체 화면을 막은 브라우저에서는 그냥 진행한다
    }
    turnLampOn();
  };

  return (
    <div className={`title-screen${phase === 'start' ? ' lit' : ''}`}>
      <div className="title-panel">
        <div className="title-logo">
          <div className="title-logo-top">{strings.titleScreen.logoTop}</div>
          <div className="title-logo-bottom">{strings.titleScreen.logoBottom}</div>
          <div className="title-trial">{strings.titleScreen.trial}</div>
        </div>

        {phase === 'title' && sound === null && (
          <div className="title-sound">
            <div className="title-question">{strings.titleScreen.soundQuestion}</div>
            <div className="title-sound-buttons">
              <button type="button" className="big-button" onClick={() => setSound(true)}>
                {strings.titleScreen.soundOn}
                <span>{strings.titleScreen.soundOnNote}</span>
              </button>
              <button type="button" className="big-button" onClick={() => setSound(false)}>
                {strings.titleScreen.soundOff}
              </button>
            </div>
          </div>
        )}
        {phase === 'title' && sound !== null && (
          <button type="button" className="big-button lamp-button" onClick={lightLamp} autoFocus>
            {strings.titleScreen.lamp}
            <span>{strings.titleScreen.lampNote}</span>
          </button>
        )}
        {phase === 'start' && <StartForm />}
      </div>

      <div className="title-notices">
        <p>{strings.notices.fiction}</p>
        <p>{strings.notices.ai}</p>
      </div>
    </div>
  );
}

type Ask = { kind: 'resume'; slot: SaveSlot } | { kind: 'fresh1' } | { kind: 'fresh2' } | null;

function totalStars(slot: SaveSlot): number {
  return Object.values(slot.stars).reduce<number>((a, b) => a + (b ?? 0), 0);
}

function StartForm() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [ask, setAsk] = useState<Ask>(null);
  const n = normalizeName(name);

  const needName = () => {
    if (n) return false;
    setMessage(strings.startScreen.needName);
    return true;
  };
  const onFresh = () => {
    if (needName()) return;
    if (findSlot(n)) setAsk({ kind: 'fresh1' });
    else startFresh(n);
  };
  const onResume = () => {
    if (needName()) return;
    const slot = findSlot(n);
    if (slot) setAsk({ kind: 'resume', slot });
    else setMessage(strings.startScreen.noRecord);
  };
  const onCode = () => {
    if (needName()) return;
    const id = chapterForCode(code);
    if (id) startWithCode(n, id);
    else setMessage(strings.startScreen.badCode);
  };

  if (ask) {
    let text = '';
    let yes = () => {};
    let yesLabel = strings.startScreen.freshYes;
    if (ask.kind === 'resume') {
      const ch = chapterById(ask.slot.chapterId);
      text = fmt(strings.startScreen.resumeAsk, {
        name: ask.slot.name,
        chapter: `${chapterLabel(ch)} ${ch.title}`,
        stars: totalStars(ask.slot),
      });
      yes = () => resume(ask.slot);
      yesLabel = strings.startScreen.resumeYes;
    } else if (ask.kind === 'fresh1') {
      text = strings.startScreen.freshAsk1;
      yes = () => setAsk({ kind: 'fresh2' });
    } else {
      text = strings.startScreen.freshAsk2;
      yes = () => startFresh(n);
    }
    return (
      <div className="start-form" role="alertdialog" aria-label={text}>
        <p className="start-ask">{text}</p>
        <div className="start-row">
          <button type="button" className="big-button" onClick={yes} autoFocus>{yesLabel}</button>
          <button type="button" className="big-button quiet" onClick={() => setAsk(null)}>{strings.startScreen.cancel}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="start-form" onSubmit={(e) => e.preventDefault()}>
      <label className="start-label" htmlFor="player-name">{strings.startScreen.nameLabel}</label>
      <input
        id="player-name"
        className="start-input"
        value={name}
        autoComplete="off"
        autoFocus
        onChange={(e) => {
          setName(e.target.value);
          setMessage('');
        }}
      />
      <p className="start-hint">{strings.startScreen.nameHint}</p>
      <div className="start-row">
        <button type="button" className="big-button" onClick={onFresh}>{strings.startScreen.fresh}</button>
        <button type="button" className="big-button" onClick={onResume}>{strings.startScreen.resume}</button>
      </div>
      <label className="start-label" htmlFor="start-code">{strings.startScreen.codeLabel}</label>
      <div className="start-row">
        <input
          id="start-code"
          className="start-input code"
          value={code}
          autoComplete="off"
          onChange={(e) => {
            setCode(e.target.value);
            setMessage('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && onCode()}
        />
        <button type="button" className="big-button" onClick={onCode}>{strings.startScreen.codeStart}</button>
      </div>
      <p className="start-hint">{strings.startScreen.codeHint}</p>
      <p className="start-message" aria-live="polite">{message}</p>
    </form>
  );
}
