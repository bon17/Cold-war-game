import { create } from 'zustand';

// 게임 진행 상태. 저장(localStorage)과 장 이동은 M1 ⑤단계에서 붙인다.
export interface CollectedClue { docId: string; clue: string }

interface GameState {
  chapterId: string;
  readDocs: string[];              // 연 핵심 문서(열면 읽은 것, 기획서 5.1)
  clues: CollectedClue[];          // 모은 단서(모은 순서)
  openDocId: string | null;        // 확대 보기로 열려 있는 문서
  openDocument: (docId: string) => void;
  closeDocument: () => void;
  collectClue: (docId: string, clue: string) => void;
}

export const useGame = create<GameState>((set) => ({
  chapterId: 'ch3',
  readDocs: [],
  clues: [],
  openDocId: null,
  openDocument: (docId) =>
    set((s) => ({
      openDocId: docId,
      readDocs: s.readDocs.includes(docId) ? s.readDocs : [...s.readDocs, docId],
    })),
  closeDocument: () => set({ openDocId: null }),
  collectClue: (docId, clue) =>
    set((s) => (s.clues.some((c) => c.docId === docId && c.clue === clue) ? s : { clues: [...s.clues, { docId, clue }] })),
}));

export function hasClue(clues: CollectedClue[], docId: string, clue: string): boolean {
  return clues.some((c) => c.docId === docId && c.clue === clue);
}
