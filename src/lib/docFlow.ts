// 문서 도착 규칙(기획서 5.1): 문서는 하나씩 온다. 앞 문서와 짝인 실을 바꿔야(실이 없으면 앞 문서를 읽어야) 다음 문서가 온다.
// revealAfter가 있는 문서는 그 시계 지점이 끝난 뒤에 오고(5-8), autoOpen 문서는 장 시작에 저절로 열린다(4-1).
import { docFinished } from './board';
import type { Chapter, Doc } from '../types';

export function availableDocs(chapter: Chapter, revealed: string[], readDocs: string[], done: Record<string, unknown>): Doc[] {
  const out: Doc[] = [];
  for (const doc of chapter.documents) {
    if (doc.revealAfter && !revealed.includes(doc.revealAfter)) break;
    out.push(doc);
    if (!docFinished(chapter, doc.id, { readDocs, done })) break;
  }
  return out;
}

// 지금 읽을 문서: 도착한 문서 가운데 아직 실을 바꾸지 않은(또는 읽지 않은) 것
export function currentDoc(chapter: Chapter, revealed: string[], readDocs: string[], done: Record<string, unknown>): Doc | undefined {
  const docs = availableDocs(chapter, revealed, readDocs, done);
  const last = docs[docs.length - 1];
  if (!last) return undefined;
  return docFinished(chapter, last.id, { readDocs, done }) ? undefined : last;
}

export function autoOpenDoc(chapter: Chapter, readDocs: string[], revealed: string[], done: Record<string, unknown>): Doc | undefined {
  return availableDocs(chapter, revealed, readDocs, done).find((d) => d.autoOpen && !readDocs.includes(d.id));
}
