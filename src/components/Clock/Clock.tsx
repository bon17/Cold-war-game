import { layout } from '../../lib/assets';
import { strings } from '../../lib/data';
import { clockText } from '../../lib/clockFlow';
import { useGame } from '../../store/gameStore';
import './Clock.css';

// 벽시계 판·바늘·명판(L8, 코드 SVG). 실제 시각이 아니라 '자정까지 몇 분'을 보여 주는 상징 시계(기획서 5.4).
// 분침은 붉은색(빨강 독점, 아트 계획서 3.5). 초침만 늘 움직인다. 누르면 시계 설명 카드.
// appear: 프롤로그 끝에 시계가 처음 걸릴 때(위에서 살짝 내려오며 나타남)
export function Clock({ appear = false }: { appear?: boolean }) {
  const { clockShown, setAboutClock, reveal } = useGame();
  const { cx, cy, faceR, plaque } = layout.clock;
  const R = faceR;
  const m = clockShown.minutes;
  const minuteDeg = (60 - m) * 6;
  const hourDeg = 330 + (60 - m) * 0.5;
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <>
      <button
        type="button"
        className={`clock-face${appear ? ' clock-appear' : ''}`}
        style={{ left: cx - R, top: cy - R, width: R * 2, height: R * 2 }}
        aria-label={`${strings.clock.open}: ${clockText(m)}`}
        onClick={() => !reveal && setAboutClock(true)}
      >
        <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} aria-hidden="true">
          <circle cx={R} cy={R} r={R - 1} fill="var(--clock-face)" stroke="var(--string-outline)" strokeWidth={2} />
          {ticks.map((i) => {
            const big = i % 5 === 0;
            const a = (i * 6 * Math.PI) / 180;
            const r1 = R - 8;
            const r2 = R - (big ? 22 : 14);
            return (
              <line
                key={i}
                x1={R + Math.sin(a) * r1}
                y1={R - Math.cos(a) * r1}
                x2={R + Math.sin(a) * r2}
                y2={R - Math.cos(a) * r2}
                stroke="var(--string-outline)"
                strokeWidth={big ? 4 : 1.5}
                strokeLinecap="round"
              />
            );
          })}
          <g className="clock-hand" style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: `${R}px ${R}px` }}>
            <line x1={R} y1={R + 10} x2={R} y2={R - R * 0.5} stroke="var(--string-outline)" strokeWidth={8} strokeLinecap="round" />
          </g>
          <g className="clock-hand" style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: `${R}px ${R}px` }}>
            <line x1={R} y1={R + 14} x2={R} y2={R - R * 0.8} stroke="var(--string-war)" strokeWidth={5} strokeLinecap="round" />
          </g>
          <g className="clock-second" style={{ transformOrigin: `${R}px ${R}px` }}>
            <line x1={R} y1={R + 16} x2={R} y2={R - R * 0.86} stroke="var(--string-outline)" strokeWidth={1.5} strokeLinecap="round" />
          </g>
          <circle cx={R} cy={R} r={7} fill="var(--brass)" stroke="var(--string-outline)" strokeWidth={1.5} />
        </svg>
      </button>
      <div className={`clock-plaque${appear ? ' clock-appear' : ''}`} style={{ left: plaque.x, top: plaque.y, width: plaque.w, height: plaque.h }}>
        <span key={m} className="clock-plaque-text">{clockText(m)}</span>
      </div>
    </>
  );
}

// 일력의 연도(무대 px 40). 바늘 공개 때 함께 넘어간다.
export function CalendarYear() {
  const year = useGame((s) => s.clockShown.year);
  const { x, y, w, h } = layout.calendar;
  return (
    <div className="calendar-year" style={{ left: x, top: y + h * 0.42, width: w * 0.92 }}>
      <span key={year}>{year}</span>
    </div>
  );
}
