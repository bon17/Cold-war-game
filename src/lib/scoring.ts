// 별과 등급(기획서 5.6). 장마다 별 3개: 실을 한 번에 맞힐 때마다 별 하나(실이 3개가 아니면 비율로).
// 시계 예측은 별과 상관없다. 2장과 4장의 반전은 일부러 틀리기 쉽게 만든 장치다.
import { pairKey } from './board';
import type { Chapter, EdgeTask } from '../types';

export interface ChapterProgress {
  done: Record<string, { wrong: number; auto?: boolean }>;
}

export interface Stars { rows: { task: EdgeTask; firstTry: boolean }[]; total: number }

export function chapterStars(chapter: Chapter, p: ChapterProgress): Stars {
  const rows = chapter.edgeTasks
    .filter((t) => t.mode === 'direct')
    .map((task) => ({ task, firstTry: p.done[pairKey(task.pair)]?.wrong === 0 }));
  const got = rows.filter((r) => r.firstTry).length;
  return { rows, total: rows.length === 0 ? 0 : Math.round((3 * got) / rows.length) };
}

// 등급: 끝낸 장의 별 비율(끝내지 않은 장은 null이고 계산에서 뺀다)
export type Grade = 'apprentice' | 'regular' | 'chief';

export function grade(stars: Record<string, number | null>): { grade: Grade; got: number; max: number } | null {
  const finished = Object.values(stars).filter((n): n is number => n !== null);
  if (finished.length === 0) return null;
  const got = finished.reduce((a, b) => a + b, 0);
  const max = finished.length * 3;
  const ratio = got / max;
  return { grade: ratio >= 0.85 ? 'chief' : ratio >= 0.5 ? 'regular' : 'apprentice', got, max };
}

// 도전 과제(기획서 5.7) 가운데 한 장 안에서 정해지는 것
export function chapterAchievements(chapter: Chapter, p: ChapterProgress): string[] {
  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  return direct.length > 0 && direct.every((t) => p.done[pairKey(t.pair)]?.wrong === 0) ? ['perfect-board'] : [];
}
