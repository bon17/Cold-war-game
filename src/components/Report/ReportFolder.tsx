import { assetUrl, layout } from '../../lib/assets';
import { chapterById, strings } from '../../lib/data';
import { nextAction } from '../../lib/guide';
import { useGame } from '../../store/gameStore';
import { TapHint } from '../Desk/TapHint';

// 책상 위 보고서철(그림). 시계 예측 지점이 열리면 빛나고, 누르면 보고서를 쓴다.
// 아직이면 무엇이 남았는지 '지금 할 일' 쪽지가 알려 준다.
export function ReportFolder() {
  const { chapterId, revealed, readDocs, done, reveal, openReport } = useGame();
  const chapter = chapterById(chapterId);
  const ready = nextAction(chapter, { readDocs, done, revealed, reveal }).kind === 'report';
  const { x, y, w, h } = layout.hotspots.report;
  return (
    <button
      type="button"
      className={`desk-object report-folder${ready ? ' ready' : ''}`}
      style={{ left: x, top: y, width: w, height: h }}
      aria-label={strings.labels.report}
      onClick={openReport}
    >
      <img src={assetUrl('shared/report-folder.webp')} alt="" width={w} height={h} />
      <span className="report-folder-label" style={{ left: w * 0.3, top: h * 0.27, width: w * 0.45 }}>
        {strings.labels.report}
      </span>
      {ready && <TapHint />}
    </button>
  );
}
