// 실 바꾸기(기획서 5.2): 문서를 읽고 나면 그 문서와 짝인 실이 어떻게 바뀌었는지 둘 중 하나를 고른다.
import { pairKey } from './board';
import type { Chapter, EdgeTask, Rel } from '../types';

export function judge(task: EdgeTask, rel: Rel): boolean {
  return rel === task.to;
}

// 학생이 직접 바꾸는 실 과제(그 쌍에 있으면)
export function directTask(chapter: Chapter, key: string): EdgeTask | undefined {
  return chapter.edgeTasks.find((t) => t.mode === 'direct' && pairKey(t.pair) === key);
}

// 이 문서를 읽고 나서 학생이 바꿀 실
export function taskForDoc(chapter: Chapter, docId: string): EdgeTask | undefined {
  return chapter.edgeTasks.find((t) => t.mode === 'direct' && t.doc === docId);
}

// 이 문서를 열면 저절로 바뀌는 실(기획서 5.2 '자동', 4-1 속보)
export function autoTasksFor(chapter: Chapter, docId: string): EdgeTask[] {
  return chapter.edgeTasks.filter((t) => t.mode === 'auto' && t.doc === docId);
}

// 이 시계 지점을 공개할 때 저절로 바뀌는 실(3장 미국–소련: 과학자들이 든 이유)
export function revealTasksFor(chapter: Chapter, pointId: string): EdgeTask[] {
  return chapter.edgeTasks.filter((t) => t.mode === 'reveal' && t.point === pointId);
}

// 그 실과 짝인 문서(틀렸을 때 핵심 구절을 다시 보여 준다)
export function docForTask(chapter: Chapter, task: EdgeTask) {
  return chapter.documents.find((d) => d.id === task.doc);
}

// 화면에 보여 줄 선택지 순서. 데이터의 options는 정답이 한쪽에 몰리기 쉬워서, 정답 자리를 실마다 돌려 가며 놓는다
// (선택지 2개면 그 장의 직접 실 순서대로 ②, ①, ② …). 같은 실은 언제나 같은 순서라 다시 열어도 자리가 바뀌지 않는다.
export function optionOrder(chapter: Chapter, task: EdgeTask): Rel[] {
  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  const i = Math.max(0, direct.indexOf(task));
  const wrong = (task.options ?? []).filter((r) => r !== task.to);
  const order = [...wrong];
  order.splice((i + 1) % (wrong.length + 1), 0, task.to);
  return order;
}
