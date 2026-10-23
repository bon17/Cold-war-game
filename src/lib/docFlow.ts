// 문서 도착 규칙(기획서 5.1): revealAfter가 있는 문서는 그 시계 지점이 끝난 뒤에 도착하고(5-8),
// autoOpen 문서는 장 시작에 저절로 열린다(4-1).
import type { Chapter, Doc } from '../types';

export function availableDocs(chapter: Chapter, revealed: string[]): Doc[] {
  return chapter.documents.filter((d) => !d.revealAfter || revealed.includes(d.revealAfter));
}

export function autoOpenDoc(chapter: Chapter, readDocs: string[], revealed: string[]): Doc | undefined {
  return availableDocs(chapter, revealed).find((d) => d.autoOpen && !readDocs.includes(d.id));
}
