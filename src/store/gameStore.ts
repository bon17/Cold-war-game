import { create } from 'zustand';
import { applyTask, pairKey } from '../lib/board';
import { chapterById } from '../lib/data';
import { autoTasksFor, directTask, HELP_AFTER_WRONG, HINT_AFTER_WRONG, judge } from '../lib/validateEdge';
import type { BoardEdge, Chapter, EdgeTask, Rel } from '../types';

// 게임 진행 상태. 저장(localStorage)과 장 이동은 M1 ⑤단계에서 붙인다.
export interface CollectedClue { docId: string; clue: string }

// 실을 건 결과. 화면(보드 알림, 실 흔들림)이 이 기록을 보고 움직인다.
export type BoardEvent =
  | { kind: 'needClue' }
  | { kind: 'ok'; key: string; helped: boolean; allDone: boolean }
  | { kind: 'auto'; key: string }
  | { kind: 'wrong'; key: string; rel: Rel; reason: 'evidence' | 'rel'; hint: boolean };

export interface EdgeResult { wrong: number; helped: boolean; auto?: boolean }

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
  openDocument: (docId: string) => void;
  closeDocument: () => void;
  collectClue: (docId: string, clue: string) => void;
  selectClue: (clue: CollectedClue | null) => void;
  openEdgeDialog: (key: string, clue?: CollectedClue) => void;
  closeEdgeDialog: () => void;
  submitEdge: (key: string, rel: Rel) => void;  // 고른 단서 + 실 + 종류로 판정
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
  };
}

export const useGame = create<GameState>((set, get) => ({
  ...initialState('ch3'),

  openDocument: (docId) =>
    set((s) => ({
      openDocId: docId,
      readDocs: s.readDocs.includes(docId) ? s.readDocs : [...s.readDocs, docId],
    })),

  closeDocument: () => set({ openDocId: null }),

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
}));

export function hasClue(clues: CollectedClue[], docId: string, clue: string): boolean {
  return clues.some((c) => c.docId === docId && c.clue === clue);
}
