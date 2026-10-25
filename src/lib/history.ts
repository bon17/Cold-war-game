// 실 이력(아트 계획서 2.7 ②, 기획서 5.2): 플레이 기록이 아니라 장 데이터로 만든다.
// 지난 장의 과제는 모두, 지금 장의 과제는 끝난 것만 넣는다. 그래서 막 시작 코드로 들어와도 같은 이력이 나온다.
// 사이 장의 데이터가 아직 없으면(프롤로그 다음이 3장) 그 장의 시작 상태를 '장 시작'으로 넣어 빈 곳을 메운다.
import { pairKey, taskKey } from './board';
import type { Chapter, Rel } from '../types';

export interface HistoryStep { year: number | null; rel: Rel; label?: string; fray?: boolean; chapterTitle?: string }

export function edgeHistory(chapters: Chapter[], currentId: string, key: string, done: Record<string, unknown>): HistoryStep[] {
  const steps: HistoryStep[] = [];
  for (const ch of chapters) {
    const current = ch.id === currentId;
    const start = ch.startBoard.find((e) => pairKey(e.pair) === key);
    const last = steps[steps.length - 1];
    if (start && (!last || last.rel !== start.rel || last.label !== start.label || !!last.fray !== !!start.fray)) {
      steps.push({ year: null, rel: start.rel, label: start.label, fray: start.fray, chapterTitle: ch.title });
    }
    for (const t of ch.edgeTasks) {
      if (pairKey(t.pair) !== key) continue;
      if (!current || done[taskKey(ch, t)]) steps.push({ year: t.year, rel: t.to, label: t.label, fray: t.fray });
    }
    if (current) break;
  }
  return steps;
}
