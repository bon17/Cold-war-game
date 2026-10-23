// 시계 지점(기획서 5.3·5.4): 언제 열리는지, 보고서를 쓰려면 무엇이 남았는지.
import { pairKey } from './board';
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
  const required = point.requireEdges
    ? point.requireEdges.map(pairKey)
    : chapter.edgeTasks.filter((t) => t.mode === 'direct').map((t) => pairKey(t.pair));
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
