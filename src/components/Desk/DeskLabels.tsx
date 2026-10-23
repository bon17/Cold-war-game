import { layout } from '../../lib/assets';
import { chapterById, strings } from '../../lib/data';
import { fmt } from '../../lib/format';
import { stageToScreen } from '../../lib/stageFit';
import { nextAction } from '../../lib/guide';
import { useGame } from '../../store/gameStore';
import { useStageFit } from '../Stage/Stage';
import './DeskLabels.css';

// 누를 수 있는 물건 옆의 작은 라벨(아트 계획서 4.7). 무대 밖 층에 실제 화면 px로 그린다.
// 위치는 무대 좌표로 정하고, 글자 크기는 무대 배율과 상관없이 18px이다. 자리는 M1에서 물건을 다 놓은 뒤 다시 맞춘다.
type Align = 'center' | 'left' | 'right';

function ObjectLabel({ sx, sy, text, align = 'center', badge }: { sx: number; sy: number; text: string; align?: Align; badge?: string }) {
  const p = stageToScreen(useStageFit(), sx, sy);
  const shift = { center: '-50%', left: '0', right: '-100%' }[align];
  return (
    <div className="object-label" style={{ left: p.x, top: p.y, transform: `translate(${shift}, -50%)` }}>
      {text}
      {badge && <span className="object-label-badge">{badge}</span>}
    </div>
  );
}

export function DeskLabels() {
  const { chapterId, readDocs, done, revealed, reveal } = useGame();
  const unread = nextAction(chapterById(chapterId), { readDocs, done, revealed, reveal }).kind === 'doc' ? 1 : 0;
  const { calendar, clock, hotspots } = layout;
  const docs = hotspots.docs;
  return (
    <>
      <ObjectLabel sx={calendar.x + calendar.w / 2} sy={calendar.y + calendar.h + 20} text={strings.labels.calendar} />
      <ObjectLabel sx={clock.cx} sy={clock.cy - clock.r - 16} text={strings.labels.clock} />
      <ObjectLabel sx={hotspots.report.x + hotspots.report.w / 2} sy={hotspots.report.y - 14} text={strings.labels.report} />
      <ObjectLabel
        sx={docs.x + docs.w + 10}
        sy={docs.y + docs.h / 2}
        align="left"
        text={strings.labels.docs}
        badge={unread > 0 ? fmt(strings.docs.unread, { n: unread }) : undefined}
      />
    </>
  );
}
