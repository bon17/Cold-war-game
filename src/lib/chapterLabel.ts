import { strings } from './data';
import { fmt } from './format';
import type { Chapter } from '../types';

// 'ch3' → '3장', 'prologue' → '프롤로그'. 데이터가 아직 없는 장도 id만으로 부를 수 있다.
export function chapterLabel(chapter: Pick<Chapter, 'id'>): string {
  if (chapter.id === 'prologue') return strings.chapterLabels.prologue;
  if (chapter.id === 'epilogue') return strings.chapterLabels.epilogue;
  return fmt(strings.chapterLabels.numbered, { n: chapter.id.replace(/\D/g, '') });
}
