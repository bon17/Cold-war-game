import { strings } from './data';
import { fmt } from './format';
import type { Chapter } from '../types';

// 'ch3' → '3장', 'prologue' → '프롤로그'
export function chapterLabel(chapter: Chapter): string {
  if (chapter.id === 'prologue') return strings.chapterLabels.prologue;
  if (chapter.id === 'epilogue') return strings.chapterLabels.epilogue;
  return fmt(strings.chapterLabels.numbered, { n: chapter.id.replace(/\D/g, '') });
}
