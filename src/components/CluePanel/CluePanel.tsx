import { assetUrl, layout } from '../../lib/assets';
import { strings } from '../../lib/data';
import { useGame } from '../../store/gameStore';
import './CluePanel.css';

// 책상 위 단서 쪽지(모은 순서). ③단계에서 쪽지를 눌러 실을 건다.
const TAPES = ['shared/tape-1.webp', 'shared/tape-2.webp', 'shared/tape-3.webp'];

export function CluePanel() {
  const clues = useGame((s) => s.clues);
  const { x, y, w, h } = layout.hotspots.clues;
  return (
    <ul className="clue-tray" style={{ left: x, top: y, width: w, height: h }} aria-label={strings.labels.clues}>
      {clues.map((c, i) => (
        <li key={`${c.docId}:${c.clue}`} className="clue-slip" style={{ ['--tilt' as string]: `${i % 2 ? 1.2 : -1.2}deg` }}>
          <img className="clue-tape" src={assetUrl(TAPES[i % TAPES.length])} alt="" />
          {c.clue}
        </li>
      ))}
    </ul>
  );
}
