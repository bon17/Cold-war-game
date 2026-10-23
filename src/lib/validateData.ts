import type { Chapter, ClockEntry, NodesData } from '../types';
import { endBoard, pairKey } from './board';

// 장 데이터 검사(기획서 10.3). 문제를 글로 모아 돌려준다. 빈 배열이면 통과.
export function validateChapter(
  chapter: Chapter,
  clock: ClockEntry[],
  nodes: NodesData,
  previous?: Chapter,
): string[] {
  const errors: string[] = [];
  const where = (s: string) => `${chapter.id} ${s}`;

  // 문서: 단서가 본문에 그대로 있는지, 글자 수, 문장 수(기획서 5.1)
  const allClues = new Set<string>();
  for (const doc of chapter.documents) {
    const limit = doc.id.includes('+') ? 160 : 120;
    if (doc.body.length > limit) errors.push(where(`${doc.id}: 본문 ${doc.body.length}자, 상한 ${limit}자`));
    const sentences = doc.body.split(/(?<=[.?!])\s+/).filter(Boolean).length;
    const [min, max] = doc.type === 'flash' ? [1, 2] : [2, 4];
    if (sentences < min || sentences > max) errors.push(where(`${doc.id}: ${sentences}문장(${min}~${max}문장이어야 함)`));
    for (const clue of doc.clues) {
      if (!doc.body.includes(clue)) errors.push(where(`${doc.id}: 단서 '${clue}'가 본문에 없음`));
      allClues.add(clue);
    }
  }
  const docIds = new Set(chapter.documents.map((d) => d.id));

  // 핀: 보드에 나오는 나라는 모두 nodes.json에 있어야 한다
  const usedNodes = [
    ...chapter.startBoard.flatMap((e) => e.pair),
    ...chapter.backgroundEdges.flatMap((e) => e.pair),
    ...chapter.edgeTasks.flatMap((t) => t.pair),
  ];
  for (const id of new Set(usedNodes)) {
    if (!nodes.nodes[id]) errors.push(where(`핀 ${id}의 좌표가 nodes.json에 없음`));
  }

  // 실 과제: 근거 단서가 문서에 있는지, 선택지 3개에 정답 포함
  for (const task of chapter.edgeTasks) {
    const key = pairKey(task.pair);
    for (const clue of task.evidence) {
      if (!allClues.has(clue)) errors.push(where(`실 ${key}: 근거 '${clue}'가 어느 문서의 단서에도 없음`));
    }
    if (task.mode === 'direct') {
      if (!task.options || task.options.length !== 3) errors.push(where(`실 ${key}: 선택지는 3개여야 함`));
      else if (!task.options.includes(task.to)) errors.push(where(`실 ${key}: 선택지에 정답 ${task.to}가 없음`));
    }
  }

  // 시계 지점: clock.json에 그 해가 있는지, 경로의 마지막이 그 해인지, 열어야 할 문서가 있는지
  const years = new Set(clock.map((c) => c.year));
  const boardKeys = new Set([
    ...chapter.startBoard.map((e) => pairKey(e.pair)),
    ...chapter.edgeTasks.map((t) => pairKey(t.pair)),
  ]);
  for (const point of chapter.clock) {
    if (!years.has(point.year)) errors.push(where(`${point.id}: clock.json에 ${point.year}년이 없음`));
    for (const y of point.pathYears ?? []) {
      if (!years.has(y)) errors.push(where(`${point.id}: 경로의 ${y}년이 clock.json에 없음`));
    }
    if (point.pathYears && point.pathYears[point.pathYears.length - 1] !== point.year) {
      errors.push(where(`${point.id}: 경로의 마지막 해가 ${point.year}가 아님`));
    }
    for (const id of point.unlockAfterDocs ?? []) {
      if (!docIds.has(id)) errors.push(where(`${point.id}: 문서 ${id}가 없음`));
    }
    for (const pair of point.bestEdges ?? []) {
      if (!boardKeys.has(pairKey(pair))) errors.push(where(`${point.id}: 근거 실 ${pairKey(pair)}가 보드에 없음`));
    }
  }

  // 인계 메모: 빈칸이 한 곳, 정답이 선택지에 있음
  if (chapter.handover) {
    const blanks = chapter.handover.lines.join('\n').split('{blank}').length - 1;
    if (blanks !== 1) errors.push(where(`인계 메모: 빈칸 {blank}가 ${blanks}곳(1곳이어야 함)`));
    if (!chapter.handover.options.includes(chapter.handover.answer)) errors.push(where('인계 메모: 선택지에 정답이 없음'));
  }

  // 앞 장의 끝 보드 = 이 장의 시작 보드
  if (previous) {
    const norm = (board: Chapter['startBoard']) =>
      board.map((e) => JSON.stringify([pairKey(e.pair), e.rel, !!e.fray, e.mark ?? '', e.label ?? ''])).sort().join('\n');
    if (norm(endBoard(previous)) !== norm(chapter.startBoard)) {
      errors.push(where(`startBoard가 ${previous.id}의 끝 보드와 다름`));
    }
  }

  return errors;
}
