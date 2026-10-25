import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useGame } from '../store/gameStore';
import { useSession } from '../store/sessionStore';
import { backgroundFor, docFinished, endBoard, pairKey, ZONE_KEY } from './board';
import { chapterById } from './data';
import { nextAction } from './guide';
import { chapterAchievements, chapterStars } from './scoring';
import { endsSession, goNextChapter, resume } from './session';
import type { Rel } from '../types';

// 2장 「다른 길」(2026-10-25 교사 결정): 문서 6개. 정전(실) → 아시아·아프리카 회의 → 중소 균열(실) → 아프리카의 해
// → 비동맹 회의('어느 편도 아닌 나라' 칸) → 쿠바 위기. 시계는 1963년 멀어짐, 해설 때 미국–소련 실에 직통선 매듭.
const ch2 = chapterById('ch2');
const game = () => useGame.getState();
const rels = () => Object.fromEntries(game().board.map((e) => [pairKey(e.pair), e.rel]));
const action = () => nextAction(chapterById(game().chapterId), game());
const read = (doc: string) => {
  game().openDocument(doc);
  game().closeDocument();
};
const playAll = () => {
  read('2-1');
  game().submitEdge('KR-NK', 'COLD');
  read('2-2');
  read('2-3');
  game().submitEdge('CN-SU', 'ALLY');
  read('2-4');
  read('2-5');
  game().submitZone(ch2.zone!.answer);
  read('2-6');
};

describe('2장 데이터', () => {
  it('1장 끝 보드에서 시작해 3장 시작 보드로 끝난다', () => {
    const sig = (b: { pair: [string, string]; rel: Rel; fray?: boolean; mark?: string }[]) =>
      Object.fromEntries(b.map((e) => [pairKey(e.pair as never), [e.rel, !!e.fray, e.mark ?? ''].join('/')]));
    expect(sig(ch2.startBoard)).toEqual(sig(endBoard(chapterById('ch1'))));
    expect(sig(endBoard(ch2))).toEqual(sig(chapterById('ch3').startBoard));
  });

  it('1차시의 마지막 장이다(다음 장 3장은 2차시)', () => {
    expect(endsSession('ch2')).toBe(true);
    expect(endsSession('ch1')).toBe(false);
  });
});

describe('2장 흐름', () => {
  beforeEach(() => useGame.setState(initialState('ch2')));

  it('정전(2-1): 남한–북한을 대립으로 맞히면 미국–중국, 남한–중국도 함께 대립', () => {
    read('2-1');
    expect(game().dialogEdge).toBe('KR-NK');
    game().submitEdge('KR-NK', 'COLD');
    expect(rels()).toMatchObject({ 'KR-NK': 'COLD', 'CN-US': 'COLD', 'CN-KR': 'COLD' });
  });

  it("중소 갈등(2-3): '대립'은 틀리고, '같은 편(금이 감)'을 고르면 같은 편 그대로 균열이 생긴다", () => {
    read('2-1');
    game().submitEdge('KR-NK', 'COLD');
    read('2-2');
    read('2-3');
    game().submitEdge('CN-SU', 'COLD');
    expect(game().done['CN-SU']).toBeUndefined();
    game().submitEdge('CN-SU', 'ALLY');
    expect(game().done['CN-SU']).toEqual({ wrong: 1 });
    expect(game().board.find((e) => pairKey(e.pair) === 'CN-SU')).toMatchObject({ rel: 'ALLY', fray: true });
  });

  it("비동맹 회의(2-5): 문서를 닫으면 '어느 편도 아닌 나라' 고르기 창이 열리고, 맞혀야 문서를 마친다", () => {
    read('2-1');
    game().submitEdge('KR-NK', 'COLD');
    read('2-2');
    read('2-3');
    game().submitEdge('CN-SU', 'ALLY');
    read('2-4');
    game().openDocument('2-5');
    game().finishDocument();                 // '다 읽었어요': 고를 것이 있어 다음 문서로 넘어가지 않는다
    expect(game().openDocId).toBeNull();
    expect(game().dialogEdge).toBe(ZONE_KEY);
    expect(action()).toEqual({ kind: 'edge', key: ZONE_KEY });
    game().submitZone('미국 편이나 소련 편');
    expect(docFinished(ch2, '2-5', game())).toBe(false);
    expect(game().event).toMatchObject({ kind: 'wrong', key: ZONE_KEY, option: '미국 편이나 소련 편' });
    game().submitZone('어느 편도 아님');
    expect(game().done[ZONE_KEY]).toEqual({ wrong: 1 });
    expect(docFinished(ch2, '2-5', game())).toBe(true);
    expect(game().event).toMatchObject({ kind: 'ok', key: ZONE_KEY, allDone: true });
    expect(action()).toEqual({ kind: 'doc', docId: '2-6' });
  });

  it('쿠바 위기(2-6)까지 읽으면 보고서, 공개 때 미국–소련 실에 직통선 매듭이 생긴다', () => {
    playAll();
    expect(action()).toEqual({ kind: 'report' });
    game().openReport();
    game().submitReport({ direction: 'closer' });   // 일부러 틀리기(쿠바의 역설)
    game().advanceReveal();
    expect(game().board.find((e) => pairKey(e.pair) === 'SU-US')).toMatchObject({ rel: 'COLD', mark: 'hotline' });
    expect(game().clockShown).toEqual({ minutes: 12, year: 1963 });
  });

  it("별은 실 둘과 '어느 편도 아닌 나라' 칸, 완벽한 보드는 셋 다 한 번에", () => {
    playAll();
    const s = chapterStars(ch2, game());
    expect(s.rows.map((r) => (r.zone ? 'zone' : pairKey(r.task!.pair)))).toEqual(['KR-NK', 'CN-SU', 'zone']);
    expect(s.total).toBe(3);
    expect(chapterAchievements(ch2, game())).toEqual(['perfect-board']);
    expect(chapterAchievements(ch2, { done: { ...game().done, [ZONE_KEY]: { wrong: 1 } } })).toEqual([]);
  });

  it('배경 실은 처음부터 셋(미국–남한, 북한–소련, 북한–중국)', () => {
    expect(backgroundFor(ch2, game()).map((e) => pairKey(e.pair))).toEqual(['KR-US', 'NK-SU', 'CN-NK']);
  });
});

describe('1차시 끝', () => {
  beforeEach(() => {
    useGame.setState(initialState('ch2'));
    useSession.setState({ phase: 'result', name: '일장' });
  });

  it('2장을 마치면 3장으로 바로 가지 않고 끝 화면', () => {
    goNextChapter();
    expect(useSession.getState().phase).toBe('end');
    expect(game().chapterId).toBe('ch2');
  });

  it('끝 화면에서 저장된 기록으로 이어하면 3장 표지부터', () => {
    resume({ name: '일장', updatedAt: 0, chapterId: 'ch2', progress: { phase: 'end', game: {} }, stars: {}, achievements: [], archive: [] });
    expect(game().chapterId).toBe('ch3');
    expect(useSession.getState().phase).toBe('cover');
  });
});
