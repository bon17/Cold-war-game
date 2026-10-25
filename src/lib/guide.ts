// 지금 할 일(기획서 5.0, 2026-10-23): 다음에 누를 곳 하나를 정한다. '지금 할 일' 쪽지와 반짝임·'여기를 누르세요'가 이것을 따른다.
import { docFinished, pairKey, ZONE_KEY } from './board';
import { isUnlocked, nextCheckpoint, nextPredict } from './clockFlow';
import { currentDoc } from './docFlow';
import { taskForDoc } from './validateEdge';
import type { Chapter } from '../types';

export type NextAction =
  | { kind: 'doc'; docId: string }      // 문서 더미를 눌러 새 문서 읽기
  | { kind: 'edge'; key: string }       // 읽은 문서와 짝인 실 바꾸기(2장 중립 구역이면 key가 ZONE_KEY)
  | { kind: 'report' }                  // 보고서철을 눌러 시계 예측
  | { kind: 'wait' }                    // 시계 공개 중이거나 열린 지점이 없음
  | { kind: 'done' };                   // 이 장의 시계 지점을 모두 마침

export interface GuideState {
  readDocs: string[];
  done: Record<string, unknown>;
  revealed: string[];
  reveal?: unknown;                     // 시계 공개 중이면 누를 곳이 없다
}

export function nextAction(chapter: Chapter, s: GuideState): NextAction {
  if (s.reveal) return { kind: 'wait' };
  const doc = currentDoc(chapter, s.revealed, s.readDocs, s.done);
  if (doc) {
    const task = taskForDoc(chapter, doc.id);
    if (s.readDocs.includes(doc.id) && task) return { kind: 'edge', key: pairKey(task.pair) };
    if (s.readDocs.includes(doc.id) && chapter.zone?.doc === doc.id) return { kind: 'edge', key: ZONE_KEY };
    return { kind: 'doc', docId: doc.id };
  }
  const point = nextCheckpoint(chapter, s.revealed);
  if (!point) return { kind: 'done' };
  const predict = nextPredict(chapter, s.revealed);
  if (predict && predict === point && isUnlocked(chapter, point, s.readDocs, s.done)) return { kind: 'report' };
  return { kind: 'wait' };
}

// 진행 막대: 실을 바꾼(실이 없으면 읽은) 문서 수 / 전체 문서 수
export function docProgress(chapter: Chapter, s: GuideState): { done: number; total: number } {
  const finished = chapter.documents.filter((d) => docFinished(chapter, d.id, s)).length;
  return { done: finished, total: chapter.documents.length };
}
