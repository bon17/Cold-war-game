import { assetUrl, layout } from '../../lib/assets';
import { chapterById, strings } from '../../lib/data';
import { useGame } from '../../store/gameStore';

// 책상 위 문서 더미(그림). 누르면 아직 안 읽은 첫 핵심 문서를 연다(다 읽었으면 첫 문서).
export function DocStack() {
  const { chapterId, readDocs, openDocument } = useGame();
  const chapter = chapterById(chapterId);
  const core = chapter.documents.filter((d) => d.tier === 'core');
  const next = core.find((d) => !readDocs.includes(d.id)) ?? core[0];
  const { x, y, w, h } = layout.hotspots.docs;

  return (
    <button
      type="button"
      className="desk-object"
      style={{ left: x, top: y, width: w, height: h }}
      aria-label={strings.labels.docs}
      onClick={() => openDocument(next.id)}
    >
      <img src={assetUrl('shared/docs-stack.webp')} alt="" width={w} height={h} />
    </button>
  );
}
