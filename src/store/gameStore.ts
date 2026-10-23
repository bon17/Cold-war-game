import { create } from 'zustand';
import { applyTask, pairKey } from '../lib/board';
import { isUnlocked, nextCheckpoint, nextPredict, revealPath, minutesOf } from '../lib/clockFlow';
import { chapterById } from '../lib/data';
import { autoTasksFor, directTask, HELP_AFTER_WRONG, HINT_AFTER_WRONG, judge } from '../lib/validateEdge';
import type { BoardEdge, Chapter, EdgeTask, Rel } from '../types';

// 게임 진행 상태. 저장(localStorage)과 장 이동은 M1 ⑤단계에서 붙인다.
export interface CollectedClue { docId: string; clue: string }

// 실을 건 결과. 화면(보드 알림, 실 흔들림)이 이 기록을 보고 움직인다.
export type BoardEvent =
  | { kind: 'needClue' }
  | { kind: 'reportLocked' }
  | { kind: 'ok'; key: string; helped: boolean; allDone: boolean }
  | { kind: 'auto'; key: string }
  | { kind: 'wrong'; key: string; rel: Rel; reason: 'evidence' | 'rel'; hint: boolean };

export interface EdgeResult { wrong: number; helped: boolean; auto?: boolean }

// 시계 공개 순서(기획서 8.1): 발표 전보 → 바늘 → 해설(예측이면 비교 한 줄 포함) → 본샘일보 1면(예측만) → 보너스 질문
export type RevealStep = 'bulletin' | 'needle' | 'explanation' | 'newspaper' | 'bonus';
export interface Report { direction: 'closer' | 'farther'; edge: string }

interface GameState {
  chapterId: string;
  readDocs: string[];              // 연 문서(핵심 문서는 열면 읽은 것, 기획서 5.1)
  clues: CollectedClue[];          // 모은 단서(모은 순서)
  openDocId: string | null;        // 확대 보기로 열려 있는 문서
  board: BoardEdge[];              // 지금 보드의 퍼즐 실(배경 실은 장 데이터와 읽은 문서로 계산)
  selectedClue: CollectedClue | null;
  wrong: Record<string, number>;   // 실마다 틀린 횟수
  done: Record<string, EdgeResult>;// 끝난 실 과제(별 ①, 도전 과제 perfect-board에 쓴다)
  event: (BoardEvent & { id: number }) | null;
  dialogEdge: string | null;       // 실 걸기 창이 열린 실
  clockShown: { minutes: number; year: number };   // 벽시계와 일력에 보이는 값
  revealed: string[];              // 끝난 시계 지점
  reports: Record<string, Report>; // 시계 지점마다 낸 보고서
  reportOpen: boolean;
  reveal: { pointId: string; step: RevealStep } | null;
  bonus: { edge: string; correct: boolean } | null;
  achievements: string[];
  aboutClock: boolean;             // 시계 설명 카드
  table: { focus: string | null } | null;   // 표로 보기(실 이력표). focus: 강조할 실
  openDocument: (docId: string) => void;
  closeDocument: () => void;
  collectClue: (docId: string, clue: string) => void;
  selectClue: (clue: CollectedClue | null) => void;
  openEdgeDialog: (key: string, clue?: CollectedClue) => void;
  closeEdgeDialog: () => void;
  submitEdge: (key: string, rel: Rel) => void;  // 고른 단서 + 실 + 종류로 판정
  openReport: () => void;
  closeReport: () => void;
  submitReport: (report: Report) => void;
  advanceReveal: () => void;
  setClockShown: (minutes: number, year: number) => void;
  answerBonus: (edge: string) => void;
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

function allDirectDone(chapter: Chapter, done: Record<string, EdgeResult>): boolean {
  return chapter.edgeTasks.filter((t) => t.mode === 'direct').every((t) => done[pairKey(t.pair)]);
}

export function initialState(chapterId: string) {
  const chapter = chapterById(chapterId);
  return {
    chapterId,
    readDocs: [],
    clues: [],
    openDocId: null,
    board: chapter.startBoard.map((e) => ({ ...e })),
    selectedClue: null,
    wrong: {},
    done: {},
    event: null,
    dialogEdge: null,
    clockShown: { minutes: minutesOf(chapter.startClock ?? {}), year: Number(chapter.period.slice(0, 4)) },
    revealed: [],
    reports: {},
    reportOpen: false,
    reveal: null,
    bonus: null,
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
  if (point && point.mode === 'show' && isUnlocked(chapter, point, s.readDocs, s.done)) return { pointId: point.id, step: 'bulletin' };
  return null;
}

export const useGame = create<GameState>((set, get) => ({
  ...initialState('ch3'),

  openDocument: (docId) =>
    set((s) => ({
      openDocId: docId,
      readDocs: s.readDocs.includes(docId) ? s.readDocs : [...s.readDocs, docId],
    })),

  closeDocument: () => set((s) => ({ openDocId: null, reveal: s.reveal ?? showToStart(s) })),

  collectClue: (docId, clue) => {
    const s = get();
    if (s.clues.some((c) => c.docId === docId && c.clue === clue)) return;
    const chapter = chapterById(s.chapterId);
    let { board, done } = s;
    let event = s.event;
    for (const task of autoTasksFor(chapter, clue)) {
      const key = pairKey(task.pair);
      if (done[key]) continue;
      board = setEdge(board, task);
      done = { ...done, [key]: { wrong: 0, helped: false, auto: true } };
      event = stamp({ kind: 'auto', key });
    }
    set({ clues: [...s.clues, { docId, clue }], board, done, event });
  },

  selectClue: (clue) => set({ selectedClue: clue }),

  openEdgeDialog: (key, clue) => set((s) => ({ dialogEdge: key, selectedClue: clue ?? s.selectedClue })),

  closeEdgeDialog: () => set({ dialogEdge: null }),

  submitEdge: (key, rel) => {
    const s = get();
    const chapter = chapterById(s.chapterId);
    const task = directTask(chapter, key);
    if (!task || s.done[key]) return;
    if (!s.selectedClue) {
      set({ event: stamp({ kind: 'needClue' }) });
      return;
    }
    const verdict = judge(task, s.selectedClue.clue, rel);
    if (verdict === 'ok') {
      const done = { ...s.done, [key]: { wrong: s.wrong[key] ?? 0, helped: false } };
      set({
        board: setEdge(s.board, task),
        done,
        selectedClue: null,
        dialogEdge: null,
        event: stamp({ kind: 'ok', key, helped: false, allDone: allDirectDone(chapter, done) }),
      });
      return;
    }
    const wrong = (s.wrong[key] ?? 0) + 1;
    if (wrong >= HELP_AFTER_WRONG) {
      const done = { ...s.done, [key]: { wrong, helped: true } };
      set({
        wrong: { ...s.wrong, [key]: wrong },
        board: setEdge(s.board, task),
        done,
        selectedClue: null,
        dialogEdge: null,
        event: stamp({ kind: 'ok', key, helped: true, allDone: allDirectDone(chapter, done) }),
      });
      return;
    }
    set({
      wrong: { ...s.wrong, [key]: wrong },
      selectedClue: verdict === 'wrongEvidence' ? null : s.selectedClue,   // 단서가 틀리면 다른 쪽지를 고르게 비운다
      event: stamp({
        kind: 'wrong',
        key,
        rel,
        reason: verdict === 'wrongEvidence' ? 'evidence' : 'rel',
        hint: wrong >= HINT_AFTER_WRONG,
      }),
    });
  },

  openReport: () => {
    const s = get();
    const chapter = chapterById(s.chapterId);
    const point = nextCheckpoint(chapter, s.revealed);
    if (s.reveal || !nextPredict(chapter, s.revealed)) return;
    // 앞에 공개 지점이 남았거나 문서·실이 남았으면 무엇이 남았는지 알려 준다
    if (!point || point.mode !== 'predict' || !isUnlocked(chapter, point, s.readDocs, s.done)) {
      set({ event: stamp({ kind: 'reportLocked' }) });
      return;
    }
    set({ reportOpen: true, dialogEdge: null, selectedClue: null });
  },

  closeReport: () => set({ reportOpen: false }),

  submitReport: (report) => {
    const s = get();
    const point = nextCheckpoint(chapterById(s.chapterId), s.revealed);
    if (!point || point.mode !== 'predict') return;
    set({ reports: { ...s.reports, [point.id]: report }, reportOpen: false, reveal: { pointId: point.id, step: 'bulletin' } });
  },

  advanceReveal: () => {
    const s = get();
    if (!s.reveal) return;
    const chapter = chapterById(s.chapterId);
    const point = chapter.clock.find((p) => p.id === s.reveal!.pointId)!;
    const isLastPredict = point.mode === 'predict' && chapter.clock.filter((p) => p.mode === 'predict').pop() === point;
    const next: Record<RevealStep, RevealStep | null> = {
      bulletin: 'needle',
      needle: 'explanation',
      explanation: point.mode === 'predict' ? 'newspaper' : null,
      newspaper: chapter.bonusQuestion && isLastPredict ? 'bonus' : null,
      bonus: null,
    };
    const step = next[s.reveal.step];
    if (step) {
      set({ reveal: { pointId: point.id, step } });
      return;
    }
    const last = revealPath(point).pop()!;
    const after = { ...s, revealed: [...s.revealed, point.id] };
    set({ revealed: after.revealed, clockShown: { minutes: minutesOf(last), year: last.year }, reveal: showToStart(after) });
  },

  setClockShown: (minutes, year) => set({ clockShown: { minutes, year } }),

  answerBonus: (edge) => {
    const s = get();
    const q = chapterById(s.chapterId).bonusQuestion;
    if (!q || s.bonus) return;
    const correct = edge === pairKey(q.answer);
    const achievements = correct && q.achievement && !s.achievements.includes(q.achievement)
      ? [...s.achievements, q.achievement]
      : s.achievements;
    set({ bonus: { edge, correct }, achievements });
  },

  setAboutClock: (open) => set({ aboutClock: open }),

  openTable: (focus) => set({ table: { focus: focus ?? null } }),

  closeTable: () => set({ table: null }),
}));

export function hasClue(clues: CollectedClue[], docId: string, clue: string): boolean {
  return clues.some((c) => c.docId === docId && c.clue === clue);
}
