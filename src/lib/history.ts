// 실 이력(아트 계획서 2.7 ②, 기획서 5.2): 플레이 기록이 아니라 장 데이터로 만든다.
// 지난 장의 과제는 모두, 지금 장의 과제는 끝난 것만 넣는다. 그래서 막 시작 코드로 들어와도 같은 이력이 나온다.
import { pairKey } from './board';
import type { Chapter, Rel } from '../types';

export interface HistoryStep { year: number | null; rel: Rel; label?: string; chapterTitle?: string }

export function edgeHistory(chapters: Chapter[], currentId: string, key: string, done: Record<string, unknown>): HistoryStep[] {
  const steps: HistoryStep[] = [];
  for (const ch of chapters) {
    const current = ch.id === currentId;
    if (steps.length === 0) {
      const start = ch.startBoard.find((e) => pairKey(e.pair) === key);
      if (start) steps.push({ year: null, rel: start.rel, label: start.label, chapterTitle: ch.title });
    }
    for (const t of ch.edgeTasks) {
      if (pairKey(t.pair) !== key) continue;
      if (!current || done[key]) steps.push({ year: t.year, rel: t.to, label: t.label });
    }
    if (current) break;
  }
  return steps;
}
