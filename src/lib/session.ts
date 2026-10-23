// 시작하기, 이어하기, 막 시작 코드, 자동 저장(기획서 5.9·5.10). 두 상태(게임, 화면 흐름)를 한 기록으로 묶는다.
import { useGame, initialState } from '../store/gameStore';
import { useSession, type Phase } from '../store/sessionStore';
import { chapters } from './data';
import { deleteSlot, findSlot, normalizeName, saveSlot } from './save';
import type { SaveSlot } from '../types';

// 저장해 두는 게임 진행(열려 있는 창, 알림 같은 화면 상태는 빼고)
const PROGRESS_KEYS = ['chapterId', 'readDocs', 'board', 'wrong', 'done', 'clockShown', 'revealed', 'reports', 'achievements', 'reveal'] as const;
type Progress = { phase: Phase; game: Partial<ReturnType<typeof useGame.getState>> };

// 막 시작 코드: 띄어쓰기는 무시하고 그 장의 code와 비교한다. 코드는 각 장 데이터에만 있다.
export function chapterForCode(code: string): string | undefined {
  const key = code.replace(/\s+/g, '');
  return chapters.find((c) => c.code === key)?.id;
}

export function firstChapterId(): string {
  return chapters[0].id;
}

function startChapter(chapterId: string, keepAchievements: string[]) {
  useGame.setState({ ...initialState(chapterId), achievements: keepAchievements });
}

// 처음부터: 그 이름의 기록을 지우고 첫 장부터(체험판에는 3장만 있다)
export function startFresh(name: string) {
  const n = normalizeName(name);
  deleteSlot(n);
  useSession.getState().setPlayer({ name: n, stars: {}, achievements: [], archive: [] });
  startChapter(firstChapterId(), []);
  useSession.getState().setPhase('notice');
}

// 막 시작 코드: 그 장을 처음부터. 별·도전 과제·기록 보관소는 지우지 않는다(기획서 5.10)
export function startWithCode(name: string, chapterId: string) {
  const n = normalizeName(name);
  const slot = findSlot(n);
  useSession.getState().setPlayer({
    name: n,
    stars: slot?.stars ?? {},
    achievements: slot?.achievements ?? [],
    archive: (slot?.archive as never[]) ?? [],
  });
  startChapter(chapterId, slot?.achievements ?? []);
  useSession.getState().setPhase('cover');
}

// 이어하기: 마지막 저장 지점부터
export function resume(slot: SaveSlot) {
  const p = (slot.progress ?? {}) as Progress;
  useSession.getState().setPlayer({ name: slot.name, stars: slot.stars, achievements: slot.achievements, archive: (slot.archive as never[]) ?? [] });
  useGame.setState({ ...initialState(slot.chapterId), ...(p.game ?? {}) });   // 공개 도중이었으면 그 단계부터
  const phase: Phase = !p.phase || p.phase === 'title' || p.phase === 'start' || p.phase === 'notice' ? 'cover' : p.phase;
  useSession.getState().setPhase(phase);
}

export function snapshot(): SaveSlot | null {
  const s = useSession.getState();
  if (!s.name || s.phase === 'title' || s.phase === 'start') return null;
  const g = useGame.getState();
  const game = Object.fromEntries(PROGRESS_KEYS.map((k) => [k, g[k]]));
  return {
    name: s.name,
    updatedAt: Date.now(),
    chapterId: g.chapterId,
    progress: { phase: s.phase, game },
    stars: s.stars,
    achievements: [...new Set([...s.achievements, ...g.achievements])],
    archive: s.archive,
  };
}

// 상태가 바뀌면 잠시 뒤 저장한다(문서, 실, 보고서, 장 끝 모두 여기에 걸린다)
export function startAutosave(delayMs = 400): () => void {
  let timer: number | undefined;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const slot = snapshot();
      if (slot) saveSlot(slot);
    }, delayMs);
  };
  const offGame = useGame.subscribe(schedule);
  const offSession = useSession.subscribe(schedule);
  return () => {
    window.clearTimeout(timer);
    offGame();
    offSession();
  };
}
