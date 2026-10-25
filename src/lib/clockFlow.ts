// 시계 지점(기획서 5.3·5.4): 언제 열리는지, 보고서를 쓰려면 무엇이 남았는지.
import { pairKey, taskKey } from './board';
import { clock } from './data';
import type { Chapter, ClockCheckpoint, ClockEntry } from '../types';

export function clockEntry(year: number): ClockEntry {
  const entry = clock.find((c) => c.year === year);
  if (!entry) throw new Error(`clock.json에 ${year}년이 없음`);
  return entry;
}

// 아직 끝나지 않은 첫 시계 지점(지점은 순서대로만 열린다)
export function nextCheckpoint(chapter: Chapter, revealed: string[]): ClockCheckpoint | undefined {
  return chapter.clock.find((p) => !revealed.includes(p.id));
}

// 아직 끝나지 않은 첫 예측 지점(보고서를 쓰는 지점)
export function nextPredict(chapter: Chapter, revealed: string[]): ClockCheckpoint | undefined {
  return chapter.clock.find((p) => p.mode === 'predict' && !revealed.includes(p.id));
}

// 그 지점을 열려면 남은 것. 핵심 문서는 앞 지점들의 문서까지 모두 읽어야 한다.
export function remaining(
  chapter: Chapter,
  point: ClockCheckpoint,
  readDocs: string[],
  done: Record<string, unknown>,
): { docs: string[]; edges: string[] } {
  const upto = chapter.clock.slice(0, chapter.clock.indexOf(point) + 1);
  const docs = [...new Set(upto.flatMap((p) => p.unlockAfterDocs ?? []))].filter((id) => !readDocs.includes(id));
  const listed = point.requireEdges?.map(pairKey);
  const required = chapter.edgeTasks
    .filter((t) => (listed ? listed.includes(pairKey(t.pair)) : t.mode === 'direct'))
    .map((t) => taskKey(chapter, t));
  const edges = required.filter((k) => !done[k]);
  return { docs, edges };
}

export function isUnlocked(chapter: Chapter, point: ClockCheckpoint, readDocs: string[], done: Record<string, unknown>): boolean {
  const r = remaining(chapter, point, readDocs, done);
  return r.docs.length === 0 && r.edges.length === 0;
}

// 공개 때 바늘이 거쳐 갈 값들(마지막이 그 지점의 해)
export function revealPath(point: ClockCheckpoint): ClockEntry[] {
  return (point.pathYears ?? [point.year]).map(clockEntry);
}

export function minutesOf(entry: { minutes?: number; seconds?: number }): number {
  return entry.minutes ?? (entry.seconds ?? 0) / 60;
}

// 이 장에 보고서를 쓰는 예측 지점이 있는지(프롤로그는 없다: 보고서철과 '시계 예측' 진행 표시를 숨긴다)
export function hasPredict(chapter: Chapter): boolean {
  return chapter.clock.some((p) => p.mode === 'predict');
}

// 벽에 시계가 걸려 있는지. 프롤로그는 못과 자국만 있다가 마지막 공개(1947) 때 처음 걸린다(아트 계획서 2.4).
export function clockHung(chapter: Chapter, revealed: string[], reveal: unknown): boolean {
  return chapter.startClock !== null || revealed.length > 0 || !!reveal;
}

// 시계가 처음 걸리는 공개. 바늘을 돌리지 않고 그 값으로 걸며, 해설 카드에서 '움직였다'를 말하지 않는다.
export function isFirstHang(chapter: Chapter, point: ClockCheckpoint): boolean {
  return chapter.startClock === null && chapter.clock.indexOf(point) === 0;
}
