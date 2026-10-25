import type { BoardEdge, Chapter, EdgeTask, Pair, Rel } from '../types';

// 두 나라 순서와 상관없이 같은 실을 가리키는 키
export function pairKey([a, b]: Pair): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// 실 과제의 키(끝난 과제 done, 틀린 횟수 wrong). 대개 쌍의 키와 같고, 같은 장에서 같은 쌍을 두 번째로 바꾸는 과제에만
// 문서 ID를 붙인다(1장 남한–북한: 1948 대립 'KR-NK' → 1950 전쟁 'KR-NK@1-5'). 실 바꾸기 창과 보드는 쌍의 키를 쓴다.
export function taskKey(chapter: Pick<Chapter, 'edgeTasks'>, task: EdgeTask): string {
  const key = pairKey(task.pair);
  const first = chapter.edgeTasks.find((t) => pairKey(t.pair) === key);
  return first === task ? key : `${key}@${task.doc ?? task.point}`;
}

export interface DocState { readDocs: string[]; done: Record<string, unknown> }

// 문서를 마쳤는지: 짝인 실을 바꿨으면, 실이 없는 문서는 읽었으면. 핀 이름, 내려가는 실, 배경 실이 이것을 따른다.
export function docFinished(chapter: Chapter, docId: string, s: DocState): boolean {
  const task = chapter.edgeTasks.find((t) => t.mode === 'direct' && t.doc === docId);
  return task ? !!s.done[taskKey(chapter, task)] : s.readDocs.includes(docId);
}

// 이 문서를 마치면 보드에서 내려가는 실(startBoard의 untilDoc)
export function endingAt(chapter: Chapter, docId: string): Set<string> {
  return new Set(chapter.startBoard.filter((e) => e.untilDoc === docId).map((e) => pairKey(e.pair)));
}

// 배경 실: appearAfterDoc이 있으면 그 문서를 마친 뒤에 나타난다(1장 1948년 정부 수립 → 미국–남한, 중국군 참전 → 북한–중국)
export function backgroundFor(chapter: Chapter, s: DocState): BoardEdge[] {
  return chapter.backgroundEdges
    .filter((e) => !e.appearAfterDoc || docFinished(chapter, e.appearAfterDoc, s))
    .map((e) => ({ pair: e.pair, rel: e.rel, weakened: e.weakened, background: true }));
}

// 장 시작 보드: 배경 실(문서를 마쳐야 나타나는 것은 빼고) + startBoard
export function startEdges(chapter: Chapter): BoardEdge[] {
  const puzzle: BoardEdge[] = chapter.startBoard.map((e) => ({ ...e }));
  return [...backgroundFor(chapter, { readDocs: [], done: {} }), ...puzzle];
}

// 실 과제 하나를 적용한 실. 종류가 바뀌면 균열과 덮어쓴 이름표는 사라지고, 직통선 매듭은 남는다(기획서 5.2).
export function applyTask(prev: BoardEdge | undefined, task: EdgeTask): BoardEdge {
  const changed = prev ? prev.rel !== task.to : true;
  const next: BoardEdge = { pair: prev?.pair ?? task.pair, rel: task.to };
  const label = task.label ?? (changed ? undefined : prev?.label);
  if (label) next.label = label;
  if (task.fray || (!changed && prev?.fray)) next.fray = true;
  if (prev?.mark) next.mark = prev.mark;
  return next;
}

// 이번 장에서 바뀐 실(보고서, 본샘일보 1면). 과제 순서(대개 연도 순)로 늘어놓고, 두 번 바뀐 실은 한 번만 넣는다.
export function changedEdges(chapter: Chapter, board: BoardEdge[], done: Record<string, unknown>): BoardEdge[] {
  const keys = new Set(chapter.edgeTasks.filter((t) => done[taskKey(chapter, t)]).map((t) => pairKey(t.pair)));
  return [...keys]
    .map((key) => board.find((e) => pairKey(e.pair) === key))
    .filter((e): e is BoardEdge => !!e);
}

// 그 장에 나오는 실 종류(범례 카드). 보드, 배경 실, 바뀌는 실, 선택지에 나오는 것을 정해진 순서로.
const REL_ORDER: Rel[] = ['ALLY', 'COLD', 'WAR', 'TALK', 'NORMAL', 'OCCUPY'];

export function chapterRels(chapter: Chapter): Rel[] {
  const used = new Set<Rel>();
  chapter.startBoard.forEach((e) => used.add(e.rel));
  chapter.backgroundEdges.forEach((e) => used.add(e.rel));
  chapter.edgeTasks.forEach((t) => {
    used.add(t.to);
    t.options?.forEach((r) => used.add(r));
  });
  return REL_ORDER.filter((r) => used.has(r));
}

// 장이 끝났을 때의 보드(다음 장 startBoard와 같아야 한다, 기획서 10.3). 배경 실과 장 중간에 내려간 실은 뺀다.
export function endBoard(chapter: Chapter): Chapter['startBoard'] {
  const board = new Map<string, BoardEdge>(chapter.startBoard.filter((e) => !e.untilDoc).map((e) => [pairKey(e.pair), { ...e }]));
  for (const task of chapter.edgeTasks) {
    const key = pairKey(task.pair);
    board.set(key, applyTask(board.get(key), task));
  }
  for (const point of chapter.clock) {
    if (point.annotateEdge) {
      const key = pairKey(point.annotateEdge.pair);
      const prev = board.get(key);
      if (prev) board.set(key, { ...prev, mark: point.annotateEdge.mark });
    }
  }
  return [...board.values()];
}
