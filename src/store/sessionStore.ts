import { create } from 'zustand';

// 화면 흐름과 이름·소리·장별 별(기획서 8.1). 게임 진행(문서, 실, 시계)은 gameStore에 있다.
export type Phase =
  | 'title'      // 타이틀: 소리 켜기/끄기 → 램프 켜기
  | 'start'      // 이름 입력, 처음부터 / 이어하기 / 막 시작 코드
  | 'notice'     // 허구 고지(처음부터일 때, '확인'을 눌러야 넘어감)
  | 'cover'      // 장 표지(3초 자동)
  | 'handover'   // 인계 메모(2차시 시작, 3장)
  | 'desk'       // 메인 책상
  | 'window'     // 창밖 장면
  | 'result'     // 근무 평정표
  | 'end';       // 체험판 끝

export interface ArchiveEntry { chapterId: string; pointId: string; year: number; direction: string; edge: string }

interface SessionState {
  phase: Phase;
  sound: boolean | null;                      // null = 아직 고르지 않음
  lampOn: boolean;                            // 첫 클릭(소리 허락 + 전체 화면)
  name: string | null;
  stars: Record<string, number | null>;       // 장마다 별(끝내지 않은 장은 null = '–')
  achievements: string[];
  archive: ArchiveEntry[];                    // 틀린 판단 기록(기록 보관소, M4)
  setPhase: (phase: Phase) => void;
  setSound: (on: boolean) => void;
  turnLampOn: () => void;
  setPlayer: (p: { name: string; stars: Record<string, number | null>; achievements: string[]; archive: ArchiveEntry[] }) => void;
  finishChapter: (chapterId: string, stars: number, achievements: string[], archive: ArchiveEntry[]) => void;
}

export const useSession = create<SessionState>((set) => ({
  phase: 'title',
  sound: null,
  lampOn: false,
  name: null,
  stars: {},
  achievements: [],
  archive: [],
  setPhase: (phase) => set({ phase }),
  setSound: (sound) => set({ sound }),
  turnLampOn: () => set({ lampOn: true, phase: 'start' }),
  setPlayer: (p) => set({ ...p }),
  // 별은 장마다 더 높은 값을 남긴다(막 시작 코드로 다시 해도 기록이 줄지 않게, 기획서 5.10)
  finishChapter: (chapterId, stars, achievements, archive) =>
    set((s) => ({
      stars: { ...s.stars, [chapterId]: Math.max(stars, s.stars[chapterId] ?? 0) },
      achievements: [...new Set([...s.achievements, ...achievements])],
      archive: [...s.archive, ...archive],
    })),
}));
