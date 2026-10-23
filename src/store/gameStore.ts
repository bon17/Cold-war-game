import { create } from 'zustand';
import { applyTask, pairKey } from '../lib/board';
import { isUnlocked, nextCheckpoint, nextPredict, revealPath, minutesOf } from '../lib/clockFlow';
import { chapterById, chapters } from '../lib/data';
import { currentDoc } from '../lib/docFlow';
import { autoTasksFor, directTask, judge, revealTasksFor, taskForDoc } from '../lib/validateEdge';
import type { BoardEdge, Chapter, EdgeTask, Rel } from '../types';

// 게임 진행 상태(기획서 3장, 2026-10-23 쉬운 흐름): 문서 읽기 → 그 문서와 짝인 실 바꾸기(둘 중 하나) → 3번 → 시계 예측.

// 실을 바꾼 결과. 화면(보드 알림, 실 흔들림)이 이 기록을 보고 움직인다.
export type BoardEvent =
  | { kind: 'reportLocked' }
  | { kind: 'ok'; key: string; allDone: boolean }
  | { kind: 'auto'; key: string }
  | { kind: 'wrong'; key: string; rel: Rel };

export interface EdgeResult { wrong: number; auto?: boolean }

// 시계 공개 순서(기획서 8.1): 바늘 → 해설(발표 이유, 저절로 바뀐 실) → 본샘일보 1면(예측만)
export type RevealStep = 'needle' | 'explanation' | 'newspaper';
export interface Report { direction: 'closer' | 'farther' }

interface GameState {
  chapterId: string;
  readDocs: string[];              // 연 문서
  openDocId: string | null;        // 확대 보기로 열려 있는 문서
  openDocFresh: boolean;           // 그 문서를 이번에 처음 열었는지(실이 없는 문서도 처음에는 '다 읽었어요'를 보여 준다)
  board: BoardEdge[];              // 지금 보드의 퍼즐 실(배경 실은 장 데이터와 읽은 문서로 계산)
  wrong: Record<string, number>;   // 실마다 틀린 횟수
  done: Record<string, EdgeResult>;// 끝난 실 과제(별, 도전 과제 perfect-board에 쓴다)
  event: (BoardEvent & { id: number }) | null;
  dialogEdge: string | null;       // 실 바꾸기 창이 열린 실(맞힌 뒤에도 '맞아요!'와 '다음 문서 보기'를 보여 주려고 열어 둔다)
  clockShown: { minutes: number; year: number };   // 벽시계와 일력에 보이는 값
  revealed: string[];              // 끝난 시계 지점
  reports: Record<string, Report>; // 시계 지점마다 낸 보고서
  reportOpen: boolean;
  reveal: { pointId: string; step: RevealStep } | null;
  achievements: string[];
  aboutClock: boolean;             // 시계 설명 카드
  table: { focus: string | null } | null;   // 표로 보기(실 이력표). focus: 강조할 실
  openDocument: (docId: string) => void;
  closeDocument: () => void;       // 다 읽었으면 짝인 실의 바꾸기 창을 연다
  finishDocument: () => void;      // '다 읽었어요': 실이 없는 문서면 다음 문서를 바로 열고, 아니면 닫는다
  openEdgeDialog: (key: string) => void;
  closeEdgeDialog: () => void;
  submitEdge: (key: string, rel: Rel) => void;
  openReport: () => void;
  closeReport: () => void;
  submitReport: (report: Report) => void;
  advanceReveal: () => void;
  setClockShown: (minutes: number, year: number) => void;
  setAboutClock: (open: boolean) => void;
  openTable: (focus?: string) => void;
  closeTable: () => void;
}

let eventId = 0;
const stamp = (e: BoardEvent) => ({ ...e, id: ++eventId });

function setEdge(board: BoardEdge[], task: EdgeTask): BoardEdge[] {
  const key = pairKey(task.pair);
  const prev = board.find((e) => pairKey(e.pair) === key);
  const next = applyTask(prev, task);
  return prev ? board.map((e) => (e === prev ? next : e)) : [...board, next];
}

// 저절로 바뀌는 실들을 한꺼번에 적용한다(이미 끝난 실은 건너뜀)
function applyAuto(s: Pick<GameState, 'board' | 'done' | 'event'>, tasks: EdgeTask[]) {
  let { board, done, event } = s;
  for (const task of tasks) {
    const key = pairKey(task.pair);
    if (done[key]) continue;
    board = setEdge(board, task);
    done = { ...done, [key]: { wrong: 0, auto: true } };
    event = stamp({ kind: 'auto', key });
  }
  return { board, done, event };
}

function allDirectDone(chapter: Chapter, done: Record<string, EdgeResult>): boolean {
  return chapter.edgeTasks.filter((t) => t.mode === 'direct').every((t) => done[pairKey(t.pair)]);
}

export function initialState(chapterId: string) {
  const chapter = chapterById(chapterId);
  return {
    chapterId,
    readDocs: [],
    openDocId: null,
    openDocFresh: false,
    board: chapter.startBoard.map((e) => ({ ...e })),
    wrong: {},
    done: {},
    event: null,
    dialogEdge: null,
    clockShown: { minutes: minutesOf(chapter.startClock ?? {}), year: Number(chapter.period.slice(0, 4)) },
    revealed: [],
    reports: {},
    reportOpen: false,
    reveal: null,
    achievements: [],
    aboutClock: false,
    table: null,
  };
}

type Snapshot = Pick<GameState, 'chapterId' | 'revealed' | 'readDocs' | 'done'>;

// 열려 있는 공개(show) 지점이 있으면 시작한다. 예측(predict) 지점은 학생이 보고서를 내야 시작된다.
function showToStart(s: Snapshot): GameState['reveal'] {
  const chapter = chapterById(s.chapterId);
  const point = nextCheckpoint(chapter, s.revealed);
  if (point && point.mode === 'show' && isUnlocked(chapter, point, s.readDocs, s.done)) return { pointId: point.id, step: 'needle' };
  return null;
}

// 처음에는 첫 장(프롤로그)의 빈 책상. 타이틀 화면 뒤로 흐리게 보이는 방이 이것이다.
export const useGame = create<GameState>((set, get) => ({
  ...initialState(chapters[0].id),

  openDocument: (docId) => {
    const s = get();
    const first = !s.readDocs.includes(docId);
    const auto = first ? applyAuto(s, autoTasksFor(chapterById(s.chapterId), docId)) : {};
    set({ ...auto, openDocId: docId, openDocFresh: first, dialogEdge: null, readDocs: first ? [...s.readDocs, docId] : s.readDocs });
  },

  closeDocument: () => {
    const s = get();
    const task = s.openDocId ? taskForDoc(chapterById(s.chapterId), s.openDocId) : undefined;
    const key = task ? pairKey(task.pair) : null;
    set({ openDocId: null, openDocFresh: false, dialogEdge: key && !s.done[key] ? key : null, reveal: s.reveal ?? showToStart(s) });
  },

  // 실이 없는 문서(프롤로그 P-2)에서 '다 읽었어요'를 누르면 닫지 않고 다음 문서로 넘어간다(2026-10-23 교사 의견).
  // 마지막 문서였으면 닫는다(그러면 시계 공개가 열린다).
  finishDocument: () => {
    const s = get();
    const chapter = chapterById(s.chapterId);
    const next = currentDoc(chapter, s.revealed, s.readDocs, s.done);
    if (s.openDocId && !taskForDoc(chapter, s.openDocId) && next && !s.readDocs.includes(next.id)) {
      get().openDocument(next.id);
      return;
    }
    get().closeDocument();
  },

  openEdgeDialog: (key) => set({ dialogEdge: key }),

  closeEdgeDialog: () => set({ dialogEdge: null }),

  submitEdge: (key, rel) => {
    const s = get();
    const chapter = chapterById(s.chapterId);
    const task = directTask(chapter, key);
    if (!task || s.done[key]) return;
    if (judge(task, rel)) {
      const done = { ...s.done, [key]: { wrong: s.wrong[key] ?? 0 } };
      set({
        board: setEdge(s.board, task),
        done,
        event: stamp({ kind: 'ok', key, allDone: allDirectDone(chapter, done) }),
      });
      return;
    }
    // 틀리면 창은 그대로 두고 핵심 구절을 힌트로 보여 준다(선택지가 둘이라 다음에는 맞힌다)
    set({ wrong: { ...s.wrong, [key]: (s.wrong[key] ?? 0) + 1 }, event: stamp({ kind: 'wrong', key, rel }) });
  },

  openReport: () => {
    const s = get();
    const chapter = chapterById(s.chapterId);
    const point = nextCheckpoint(chapter, s.revealed);
    if (s.reveal || !nextPredict(chapter, s.revealed)) return;
    // 아직 문서·실이 남았으면 무엇이 남았는지 알려 준다
    if (!point || point.mode !== 'predict' || !isUnlocked(chapter, point, s.readDocs, s.done)) {
      set({ event: stamp({ kind: 'reportLocked' }) });
      return;
    }
    set({ reportOpen: true, dialogEdge: null });
  },

  closeReport: () => set({ reportOpen: false }),

  submitReport: (report) => {
    const s = get();
    const point = nextCheckpoint(chapterById(s.chapterId), s.revealed);
    if (!point || point.mode !== 'predict') return;
    set({ reports: { ...s.reports, [point.id]: report }, reportOpen: false, reveal: { pointId: point.id, step: 'needle' } });
  },

  advanceReveal: () => {
    const s = get();
    if (!s.reveal) return;
    const chapter = chapterById(s.chapterId);
    const point = chapter.clock.find((p) => p.id === s.reveal!.pointId)!;
    if (s.reveal.step === 'needle') {
      // 바늘이 멈추면 과학자들이 든 이유와 함께 그 지점의 실이 저절로 바뀐다
      const last = revealPath(point).pop()!;
      set({
        ...applyAuto(s, revealTasksFor(chapter, point.id)),
        clockShown: { minutes: minutesOf(last), year: last.year },
        reveal: { pointId: point.id, step: 'explanation' },
      });
      return;
    }
    if (s.reveal.step === 'explanation' && point.mode === 'predict') {
      set({ reveal: { pointId: point.id, step: 'newspaper' } });
      return;
    }
    const after = { ...s, revealed: [...s.revealed, point.id] };
    set({ revealed: after.revealed, reveal: showToStart(after) });
  },

  setClockShown: (minutes, year) => set({ clockShown: { minutes, year } }),

  setAboutClock: (open) => set({ aboutClock: open }),

  openTable: (focus) => set({ table: { focus: focus ?? null } }),

  closeTable: () => set({ table: null }),
}));
