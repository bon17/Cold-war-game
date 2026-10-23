import { layout } from '../../lib/assets';
import { stageToScreen } from '../../lib/stageFit';
import { strings } from '../../lib/data';
import { useStageFit } from '../Stage/Stage';
import './DeskLabels.css';

// 누를 수 있는 물건 아래의 작은 라벨(아트 계획서 4.7). 무대 밖 층에 실제 화면 px로 그린다.
// 위치는 무대 좌표로 정하고, 글자 크기는 무대 배율과 상관없이 18px이다. 자리는 M1에서 물건을 다 놓은 뒤 다시 맞춘다.
function ObjectLabel({ sx, sy, text }: { sx: number; sy: number; text: string }) {
  const p = stageToScreen(useStageFit(), sx, sy);
  return (
    <div className="object-label" style={{ left: p.x, top: p.y }}>
      {text}
    </div>
  );
}

export function DeskLabels() {
  const { calendar, clock } = layout;
  return (
    <>
      <ObjectLabel sx={calendar.x + calendar.w / 2} sy={calendar.y + calendar.h + 6} text={strings.labels.calendar} />
      <ObjectLabel sx={clock.cx} sy={clock.cy + clock.r + 6} text={strings.labels.clock} />
    </>
  );
}
