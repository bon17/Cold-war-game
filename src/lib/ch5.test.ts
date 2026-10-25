import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useGame } from '../store/gameStore';
import { useSession } from '../store/sessionStore';
import { endBoard, pairKey } from './board';
import { chapterById, oldPinName, pinName } from './data';
import { availableDocs } from './docFlow';
import { nextAction } from './guide';
import { goNextChapter } from './session';

// 5장 「장벽이 무너지다」(2026-10-25 교사 결정): 문서 7개. 미국–소련은 대화 → 협력으로 두 번 바뀌고,
// 소련이 무너지는 문서(5-6)를 마치면 소련 핀이 '러시아'가 된다. 한소·한중 수교(5-7)는 그다음, 보고서 앞에 온다
// (2026-10-25 교사 결정: 예측 뒤에 오면 장이 끝난 것 같다가 다시 시작하는 느낌이었다).
const ch5 = chapterById('ch5');
const game = () => useGame.getState();
const edge = (key: string) => game().board.find((e) => pairKey(e.pair) === key);
const action = () => nextAction(chapterById(game().chapterId), game());
const read = (doc: string) => {
  game().openDocument(doc);
  game().closeDocument();
};
const playTo56 = () => {
  read('5-1');
  game().submitEdge('SU-US', 'TALK');
  read('5-2');
  read('5-3');
  game().submitEdge('CN-SU', 'NORMAL');
  read('5-4');
  read('5-5');
  game().submitEdge('KR-NK', 'TALK');
  read('5-6');
  game().submitEdge('SU-US', 'NORMAL');
};

describe('5장', () => {
  beforeEach(() => useGame.setState(initialState('ch5')));

  it('4장 끝 보드에서 시작한다', () => {
    const sig = (b: typeof ch5.startBoard) => Object.fromEntries(b.map((e) => [pairKey(e.pair), [e.rel, e.mark ?? ''].join('/')]));
    expect(sig(ch5.startBoard)).toEqual(sig(endBoard(chapterById('ch4'))));
  });

  it("소련 핀은 5-6을 마치면 '러시아'. 그 문서의 질문까지는 '소련'", () => {
    expect(pinName(ch5, 'SU', game())).toBe('소련');
    read('5-1');
    game().submitEdge('SU-US', 'TALK');
    expect(edge('SU-US')).toMatchObject({ rel: 'TALK', mark: 'hotline' });
    read('5-2');
    read('5-3');
    game().submitEdge('CN-SU', 'NORMAL');
    expect(edge('CN-SU')).toMatchObject({ rel: 'NORMAL', label: '관계 정상화' });
    read('5-4');
    read('5-5');
    game().submitEdge('KR-NK', 'TALK');
    read('5-6');
    expect(pinName(ch5, 'SU', game(), '5-6')).toBe('소련');   // 질문: 미국–소련
    expect(oldPinName(ch5, 'SU', game())).toBeUndefined();
    game().submitEdge('SU-US', 'NORMAL');
    expect(pinName(ch5, 'SU', game())).toBe('러시아');
    expect(oldPinName(ch5, 'SU', game())).toBe('소련');      // 보드 이름표 위에 줄 그어 붙이는 옛 이름
    expect(oldPinName(ch5, 'US', game())).toBeUndefined();
    expect(edge('SU-US')).toMatchObject({ rel: 'NORMAL', label: '협력', mark: 'hotline' });
    expect(pinName(ch5, 'SU')).toBe('러시아');               // 장 끝(보고서, 근무 평정표)
  });

  it('5-7은 5-6 다음, 보고서 앞에 온다. 맞히면 남한–중국도 수교·협력. 시계 공개가 장의 마지막', () => {
    playTo56();
    expect(action()).toEqual({ kind: 'doc', docId: '5-7' });
    read('5-7');
    expect(game().dialogEdge).toBe('KR-SU');
    expect(pinName(ch5, 'SU', game(), '5-7')).toBe('러시아');   // 질문: 남한–러시아
    game().submitEdge('KR-SU', 'NORMAL');
    expect(edge('CN-KR')?.rel).toBe('NORMAL');
    expect(action()).toEqual({ kind: 'report' });
    game().openReport();
    game().submitReport({ direction: 'farther' });
    game().advanceReveal();
    game().advanceReveal();
    game().advanceReveal();
    expect(game().clockShown).toEqual({ minutes: 17, year: 1991 });
    expect(availableDocs(ch5, game().revealed, game().readDocs, game().done).every((d) => game().readDocs.includes(d.id))).toBe(true);
    expect(action()).toEqual({ kind: 'done' });
    const rels = Object.fromEntries(game().board.map((e) => [pairKey(e.pair), e.rel]));
    expect(rels).toEqual({ 'SU-US': 'NORMAL', 'CN-US': 'NORMAL', 'CN-SU': 'NORMAL', 'KR-NK': 'TALK', 'KR-SU': 'NORMAL', 'CN-KR': 'NORMAL' });
  });

  it('에필로그가 아직 없어서 5장을 마치면 끝 화면', () => {
    useSession.setState({ phase: 'result', name: '오장' });
    goNextChapter();
    expect(useSession.getState().phase).toBe('end');
  });
});
