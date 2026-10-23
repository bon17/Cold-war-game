// 실 걸기 판정(기획서 5.2 '직접 실 조작'): 실 종류와 근거 단서가 모두 맞아야 실이 걸린다.
import { pairKey } from './board';
import type { Chapter, EdgeTask, Rel } from '../types';

export type Verdict = 'ok' | 'wrongEvidence' | 'wrongRel';

// 같은 실에서 두 번 틀리면 힌트, 세 번째로 틀리면 정답 실이 '도움받아 걸림'으로 자동으로 걸린다.
export const HINT_AFTER_WRONG = 2;
export const HELP_AFTER_WRONG = 3;

export function judge(task: EdgeTask, clue: string, rel: Rel): Verdict {
  if (!task.evidence.includes(clue)) return 'wrongEvidence';
  if (rel !== task.to) return 'wrongRel';
  return 'ok';
}

// 학생이 직접 거는 실 과제(그 쌍에 있으면)
export function directTask(chapter: Chapter, key: string): EdgeTask | undefined {
  return chapter.edgeTasks.find((t) => t.mode === 'direct' && pairKey(t.pair) === key);
}

// 이 단서를 칠하면 함께 바뀌는 자동 실(기획서 5.2 '자동')
export function autoTasksFor(chapter: Chapter, clue: string): EdgeTask[] {
  return chapter.edgeTasks.filter((t) => t.mode === 'auto' && t.evidence.includes(clue));
}

// 그 실의 근거가 들어 있는 문서(힌트에 쓴다)
export function evidenceDoc(chapter: Chapter, task: EdgeTask) {
  return chapter.documents.find((d) => d.clues.some((c) => task.evidence.includes(c)));
}

// 화면에 보여 줄 선택지 순서. 데이터의 options는 정답이 앞에 오기 쉬워서, 정답 자리를 실마다 돌려 가며 놓는다
// (그 장의 직접 실 순서대로 ②, ①, ③, ② …). 같은 실은 언제나 같은 순서라 다시 열어도 자리가 바뀌지 않는다.
export function optionOrder(chapter: Chapter, task: EdgeTask): Rel[] {
  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  const i = Math.max(0, direct.indexOf(task));
  const wrong = (task.options ?? []).filter((r) => r !== task.to);
  const order = [...wrong];
  order.splice((i * 2 + 1) % (wrong.length + 1), 0, task.to);
  return order;
}
