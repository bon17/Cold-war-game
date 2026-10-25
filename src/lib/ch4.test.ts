import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useGame } from '../store/gameStore';
import { useSession } from '../store/sessionStore';
import { endBoard, pairKey } from './board';
import { chapterById } from './data';
import { nextAction } from './guide';
import { endsSession, goNextChapter, nextChapterId } from './session';

// 4장 「다시 얼어붙다」(2026-10-25 교사 결정): 문서 7개. 남북 대화 중단(실) → 개혁·개방 → 미중 수교(실)
// → 소련의 아프가니스탄 침공(실) → 대한항공 여객기 격추 → 서유럽 핵미사일 → 반쪽짜리 올림픽. 시계는 1984년 가까워짐.
const ch4 = chapterById('ch4');
const game = () => useGame.getState();
const edge = (key: string) => game().board.find((e) => pairKey(e.pair) === key);
const action = () => nextAction(chapterById(game().chapterId), game());
const read = (doc: string) => {
  game().openDocument(doc);
  game().closeDocument();
};

describe('4장', () => {
  beforeEach(() => useGame.setState(initialState('ch4')));

  it('3장 끝 보드에서 시작한다(미국–소련 대화 + 직통선)', () => {
    const sig = (b: typeof ch4.startBoard) => Object.fromEntries(b.map((e) => [pairKey(e.pair), [e.rel, e.mark ?? ''].join('/')]));
    expect(sig(ch4.startBoard)).toEqual(sig(endBoard(chapterById('ch3'))));
  });

  it('미국–중국은 수교·협력, 미국–소련과 남한–북한은 대립. 직통선 매듭은 남는다', () => {
    read('4-1');
    game().submitEdge('KR-NK', 'COLD');
    read('4-2');
    read('4-3');
    game().submitEdge('CN-US', 'NORMAL');
    read('4-4');
    game().submitEdge('SU-US', 'COLD');
    expect(edge('KR-NK')?.rel).toBe('COLD');
    expect(edge('CN-US')?.rel).toBe('NORMAL');
    expect(edge('SU-US')).toMatchObject({ rel: 'COLD', mark: 'hotline' });
    for (const doc of ['4-5', '4-6', '4-7']) read(doc);
    expect(action()).toEqual({ kind: 'report' });
  });

  it('5장이 아직 없어서 4장을 마치면 끝 화면(차시 끝 화면은 아님)', () => {
    expect(nextChapterId('ch3')).toBe('ch4');
    expect(endsSession('ch3')).toBe(false);
    expect(endsSession('ch4')).toBe(false);
    useSession.setState({ phase: 'result', name: '사장' });
    goNextChapter();
    expect(useSession.getState().phase).toBe('end');
  });
});
