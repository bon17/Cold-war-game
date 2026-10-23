import type { Chapter, ClockEntry, NodesData } from '../types';
import { endBoard, pairKey } from './board';

// 장 데이터 검사(기획서 10.3). 문제를 글로 모아 돌려준다. 빈 배열이면 통과.
// 문서는 장마다 3개 안팎. 프롤로그는 교사와 같이 하는 연습 장이라 5개(기획서 5.0 예외, 2026-10-23).
const MAX_DOCS = 4;
const MAX_DOCS_PROLOGUE = 5;
const BODY_LIMIT = 100;

export function validateChapter(
  chapter: Chapter,
  clock: ClockEntry[],
  nodes: NodesData,
  previous?: Chapter,
): string[] {
  const errors: string[] = [];
  const where = (s: string) => `${chapter.id} ${s}`;

  // 문서: 장마다 3개 안팎, 글자 수, 문장 수, 핵심 구절이 본문에 그대로 있는지(기획서 5.1, 2026-10-23 쉬운 흐름)
  const maxDocs = chapter.id === 'prologue' ? MAX_DOCS_PROLOGUE : MAX_DOCS;
  if (chapter.documents.length > maxDocs) errors.push(where(`문서 ${chapter.documents.length}개, 상한 ${maxDocs}개`));
  for (const doc of chapter.documents) {
    if (doc.body.length > BODY_LIMIT) errors.push(where(`${doc.id}: 본문 ${doc.body.length}자, 상한 ${BODY_LIMIT}자`));
    const sentences = doc.body.split(/(?<=[.?!])\s+/).filter(Boolean).length;
    const [min, max] = doc.type === 'flash' ? [1, 2] : [2, 3];
    if (sentences < min || sentences > max) errors.push(where(`${doc.id}: ${sentences}문장(${min}~${max}문장이어야 함)`));
    if (!doc.body.includes(doc.keyPhrase)) errors.push(where(`${doc.id}: 핵심 구절 '${doc.keyPhrase}'가 본문에 없음`));
  }
  const docIds = new Set(chapter.documents.map((d) => d.id));
  const pointIds = new Set(chapter.clock.map((p) => p.id));

  // 핀: 보드에 나오는 나라는 모두 nodes.json에 있어야 한다
  const usedNodes = [
    ...chapter.startBoard.flatMap((e) => e.pair),
    ...chapter.backgroundEdges.flatMap((e) => e.pair),
    ...chapter.edgeTasks.flatMap((t) => t.pair),
  ];
  for (const id of new Set(usedNodes)) {
    if (!nodes.nodes[id]) errors.push(where(`핀 ${id}의 좌표가 nodes.json에 없음`));
  }

  // 실 과제: 짝인 문서나 시계 지점이 있는지, 선택지 2개에 정답 포함, 문서 하나에 직접 실 하나
  const docsWithTask = new Set<string>();
  for (const task of chapter.edgeTasks) {
    const key = pairKey(task.pair);
    if (task.mode === 'reveal') {
      if (!task.point || !pointIds.has(task.point)) errors.push(where(`실 ${key}: 시계 지점 '${task.point ?? ''}'가 없음`));
      continue;
    }
    if (!task.doc || !docIds.has(task.doc)) errors.push(where(`실 ${key}: 문서 '${task.doc ?? ''}'가 없음`));
    if (task.mode === 'direct') {
      if (task.doc && docsWithTask.has(task.doc)) errors.push(where(`문서 ${task.doc}에 직접 실이 둘 이상`));
      if (task.doc) docsWithTask.add(task.doc);
      if (!task.options || task.options.length !== 2) errors.push(where(`실 ${key}: 선택지는 2개여야 함`));
      else if (!task.options.includes(task.to)) errors.push(where(`실 ${key}: 선택지에 정답 ${task.to}가 없음`));
    }
  }

  // 시계 지점: clock.json에 그 해가 있는지, 경로의 마지막이 그 해인지, 열어야 할 문서가 있는지
  const years = new Set(clock.map((c) => c.year));
  if (chapter.clock.length > 1) errors.push(where(`시계 지점 ${chapter.clock.length}개(장마다 한 번)`));
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
    // 천천히 읽는 시계 카드: 가리킬 물건 목록이 장(발표 이유 + 해설의 줄) 수와 같아야 한다
    const entry = clock.find((c) => c.year === point.year);
    if (point.story && entry) {
      const pages = entry.bulletin.reason.split('\n').length + point.explanation.split('\n').length;
      if (point.story.spots.length !== pages) errors.push(where(`${point.id}: 시계 카드 ${pages}장인데 spots는 ${point.story.spots.length}개`));
    }
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
