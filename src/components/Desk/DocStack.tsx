import { assetUrl, layout } from '../../lib/assets';
import { chapterById, strings } from '../../lib/data';
import { availableDocs } from '../../lib/docFlow';
import { nextAction } from '../../lib/guide';
import { useGame } from '../../store/gameStore';
import { TapHint } from './TapHint';

// 책상 위 문서 더미(그림). 누르면 지금 읽을 문서를 연다(다 읽었으면 마지막 문서). 읽을 차례면 빛난다.
export function DocStack() {
  const { chapterId, readDocs, done, revealed, reveal, openDocument } = useGame();
  const chapter = chapterById(chapterId);
  const action = nextAction(chapter, { readDocs, done, revealed, reveal });
  const docs = availableDocs(chapter, revealed, readDocs, done);
  const target = action.kind === 'doc' ? action.docId : docs[docs.length - 1]?.id;
  const { x, y, w, h } = layout.hotspots.docs;
  const next = action.kind === 'doc';

  return (
    <button
      type="button"
      className={`desk-object${next ? ' next' : ''}`}
      style={{ left: x, top: y, width: w, height: h }}
      aria-label={strings.labels.docs}
      onClick={() => target && openDocument(target)}
    >
      <img src={assetUrl('shared/docs-stack.webp')} alt="" width={w} height={h} />
      {next && <TapHint />}
    </button>
  );
}
