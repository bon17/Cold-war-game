import { strings } from '../../lib/data';
import { useGame } from '../../store/gameStore';
import './Report.css';

// 시계 설명 카드(기획서 5.4): 이 시계는 실제 시각이 아니다.
export function AboutClock() {
  const { aboutClock, setAboutClock } = useGame();
  if (!aboutClock) return null;
  return (
    <div className="reveal-backdrop" onClick={(e) => e.target === e.currentTarget && setAboutClock(false)}>
      <div className="reveal-card explanation" role="dialog" aria-modal="true" aria-label={strings.clock.aboutTitle}>
        <div className="reveal-card-title">{strings.clock.aboutTitle}</div>
        <p>{strings.clock.about}</p>
        <button type="button" className="reveal-ok" onClick={() => setAboutClock(false)} autoFocus>
          {strings.reveal.ok}
        </button>
      </div>
    </div>
  );
}
