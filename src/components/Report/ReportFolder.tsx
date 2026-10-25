import { assetUrl, layout } from '../../lib/assets';
import { chapterById, strings } from '../../lib/data';
import { nextAction } from '../../lib/guide';
import { useGame } from '../../store/gameStore';
import { useSession } from '../../store/sessionStore';
import { TapHint } from '../Desk/TapHint';

// 책상 위 보고서철(그림). 시계 예측 지점이 열리면 빛나고, 누르면 보고서를 쓴다.
// 아직이면 무엇이 남았는지 '지금 할 일' 쪽지가 알려 준다.
export function ReportFolder() {
  const { chapterId, revealed, readDocs, done, reveal, dialogEdge, openDocId, openReport } = useGame();
  const chapter = chapterById(chapterId);
  const atDesk = useSession((s) => s.phase === 'desk');
  // 빛과 '여기를 누르세요'는 책상 화면에서, 문서와 '맞아요!' 창을 닫은 뒤에(마지막 문서를 읽는 동안 비치지 않게)
  const ready = atDesk && !dialogEdge && !openDocId && nextAction(chapter, { readDocs, done, revealed, reveal }).kind === 'report';
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
      {/* 표지의 빈 이름표 위에 타자로 친 것처럼. 자리는 그림의 이름표 가운데(비율), 기울기는 Desk.css(2026-10-25 교사 의견: 어색함) */}
      <span className="report-folder-label" style={{ left: w * 0.553, top: h * 0.374 }}>
        {strings.labels.report}
      </span>
      {ready && <TapHint />}
    </button>
  );
}
