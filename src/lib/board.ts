import type { BoardEdge, Chapter, Pair, Rel } from '../types';

// 두 나라 순서와 상관없이 같은 실을 가리키는 키
export function pairKey([a, b]: Pair): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// 장 시작 보드: 배경 실(문서를 읽어야 나타나는 것은 빼고) + startBoard
export function startEdges(chapter: Chapter): BoardEdge[] {
  const background: BoardEdge[] = chapter.backgroundEdges
    .filter((e) => !e.appearAfterDoc)
    .map((e) => ({ pair: e.pair, rel: e.rel, weakened: e.weakened, background: true }));
  const puzzle: BoardEdge[] = chapter.startBoard.map((e) => ({ ...e }));
  return [...background, ...puzzle];
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

// 장이 끝났을 때의 보드(다음 장 startBoard와 같아야 한다, 기획서 10.3). 배경 실은 뺀다.
export function endBoard(chapter: Chapter): Chapter['startBoard'] {
  const board = new Map(chapter.startBoard.map((e) => [pairKey(e.pair), { ...e }]));
  for (const task of chapter.edgeTasks) {
    const key = pairKey(task.pair);
    const prev = board.get(key);
    const changed = prev ? prev.rel !== task.to : true;
    board.set(key, {
      ...prev,
      pair: prev?.pair ?? task.pair,
      rel: task.to,
      label: task.label ?? (changed ? undefined : prev?.label),
      fray: task.fray ? true : changed ? undefined : prev?.fray,   // 종류가 바뀌면 균열은 사라진다
    });
  }
  for (const point of chapter.clock) {
    if (point.annotateEdge) {
      const key = pairKey(point.annotateEdge.pair);
      const prev = board.get(key);
      if (prev) board.set(key, { ...prev, mark: point.annotateEdge.mark });
    }
  }
  return [...board.values()].map((e) => Object.fromEntries(
    Object.entries(e).filter(([, v]) => v !== undefined),
  ) as Chapter['startBoard'][number]);
}
