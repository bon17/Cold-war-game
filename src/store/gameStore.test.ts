import { beforeEach, describe, expect, it } from 'vitest';
import { endBoard, pairKey } from '../lib/board';
import { chapterById, chapters } from '../lib/data';
import { nextAction } from '../lib/guide';
import type { Chapter } from '../types';
import { initialState, useGame } from './gameStore';

const game = () => useGame.getState();
const edge = (key: string) => game().board.find((e) => pairKey(e.pair) === key);
const action = () => nextAction(chapterById(game().chapterId), game());
// 3장: 문서와 짝인 실, 정답
const STEPS = [['3-3', 'CN-SU', 'COLD'], ['3-5', 'CN-US', 'TALK'], ['3-6', 'KR-NK', 'TALK']] as const;
const readAndChange = () => {
  for (const [doc, key, rel] of STEPS) {
    game().openDocument(doc);
    game().closeDocument();
    game().submitEdge(key, rel);
  }
};

describe('게임 상태: 문서 하나 → 실 하나(2026-10-23 쉬운 흐름)', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  it('시작: 시계 7분, 일력 1968년, 할 일은 첫 문서 읽기', () => {
    expect(game().clockShown).toEqual({ minutes: 7, year: 1968 });
    expect(action()).toEqual({ kind: 'doc', docId: '3-3' });
  });

  it('문서를 열면 읽은 것으로 남고, 다시 열어도 한 번만 남는다', () => {
    game().openDocument('3-3');
    game().openDocument('3-3');
    expect(game().readDocs).toEqual(['3-3']);
    expect(game().openDocId).toBe('3-3');
  });

  it('1장부터는 문서를 닫아도 창이 저절로 열리지 않는다. 학생이 실을 찾아 누르면 열리고, 창에서 문서를 다시 보고 닫으면 다시 열린다', () => {
    game().openDocument('3-3');
    expect(game().dialogEdge).toBeNull();      // 읽는 동안에는 열지 않는다
    game().closeDocument();
    expect(game().openDocId).toBeNull();
    expect(game().dialogEdge).toBeNull();      // 2026-10-26: 학생이 보드에서 실을 찾는다
    expect(action()).toEqual({ kind: 'edge', key: 'CN-SU' });
    game().missEdge('CN-US');                  // 다른 실을 누르면
    expect(game().event).toMatchObject({ kind: 'miss', key: 'CN-US' });
    game().openEdgeDialog('CN-SU');            // 찾았다
    expect(game().dialogEdge).toBe('CN-SU');
    game().openDocument('3-3');                // 창의 '문서 다시 보기'
    expect(game().dialogEdge).toBeNull();
    game().closeDocument();
    expect(game().dialogEdge).toBe('CN-SU');   // 이미 찾은 실이라 다시 연다
  });

  it('맞으면 실이 바뀌고(균열은 사라짐) 다음 문서가 할 일이 된다', () => {
    game().openDocument('3-3');
    game().closeDocument();
    game().openEdgeDialog('CN-SU');
    game().submitEdge('CN-SU', 'COLD');
    expect(edge('CN-SU')).toEqual({ pair: ['CN', 'SU'], rel: 'COLD' });
    expect(game().done['CN-SU']).toEqual({ wrong: 0 });
    expect(game().dialogEdge).toBe('CN-SU');   // 창은 '맞아요!'와 '다음 문서 보기'를 보여 주려고 열어 둔다
    expect(game().event).toMatchObject({ kind: 'ok', key: 'CN-SU', allDone: false });
    expect(action()).toEqual({ kind: 'doc', docId: '3-5' });
    game().openDocument('3-5');                 // '다음 문서 보기'
    expect(game().dialogEdge).toBeNull();
  });

  it('틀리면 창은 열린 채로 남고 틀린 횟수만 센다', () => {
    game().openDocument('3-3');
    game().closeDocument();
    game().openEdgeDialog('CN-SU');
    game().submitEdge('CN-SU', 'ALLY');
    expect(game().event).toMatchObject({ kind: 'wrong', key: 'CN-SU', rel: 'ALLY' });
    expect(game().dialogEdge).toBe('CN-SU');
    expect(edge('CN-SU')?.rel).toBe('ALLY');
    game().submitEdge('CN-SU', 'COLD');
    expect(game().done['CN-SU']).toEqual({ wrong: 1 });
  });

  it('이미 바꾼 실의 문서를 다시 읽고 닫으면 창이 열리지 않는다', () => {
    game().openDocument('3-3');
    game().closeDocument();
    game().submitEdge('CN-SU', 'COLD');
    game().openDocument('3-3');
    game().closeDocument();
    expect(game().dialogEdge).toBeNull();
  });

  it('과제가 없는 실(남한–소련)은 아무 일도 없다', () => {
    game().submitEdge('KR-SU', 'TALK');
    expect(edge('KR-SU')?.rel).toBe('COLD');
    expect(game().wrong['KR-SU']).toBeUndefined();
  });
});

describe('시계 예측과 공개(기획서 5.3·5.4)', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  it('보고서는 문서 3개를 읽고 실 3개를 바꿔야 열리고, 그 전에는 무엇이 남았는지 알린다', () => {
    game().openReport();
    expect(game().reportOpen).toBe(false);
    expect(game().event?.kind).toBe('reportLocked');
    readAndChange();
    expect(game().event).toMatchObject({ kind: 'ok', allDone: true });
    expect(action()).toEqual({ kind: 'report' });
    game().openReport();
    expect(game().reportOpen).toBe(true);
  });

  it('보고서 → 바늘 → 해설(미국–소련 실이 저절로 대화) → 1면 → 끝(12분, 1972년)', () => {
    readAndChange();
    game().openReport();
    game().submitReport({ direction: 'farther' });
    expect(game().reveal).toEqual({ pointId: 'ch3-c1', step: 'needle' });
    expect(edge('SU-US')?.rel).toBe('COLD');
    game().advanceReveal();
    expect(game().reveal?.step).toBe('explanation');
    expect(edge('SU-US')).toMatchObject({ rel: 'TALK', mark: 'hotline' });
    expect(game().done['SU-US']).toEqual({ wrong: 0, auto: true });
    expect(game().clockShown).toEqual({ minutes: 12, year: 1972 });
    game().advanceReveal();
    expect(game().reveal?.step).toBe('newspaper');
    game().advanceReveal();
    expect(game().reveal).toBeNull();
    expect(game().revealed).toEqual(['ch3-c1']);
    expect(game().reports['ch3-c1']).toEqual({ direction: 'farther' });
    expect(action()).toEqual({ kind: 'done' });
    // 장 끝 보드와 같다(직통선 매듭 남음)
    const norm = (b: { pair: [string, string] }[]) => b.map((e) => JSON.stringify({ ...e, pair: pairKey(e.pair as never) })).sort();
    expect(norm(game().board)).toEqual(norm(endBoard(chapterById('ch3'))));
  });
});

describe('자동 실(3장에는 없어서 4-1 같은 시험용 장으로 확인)', () => {
  const test: Chapter = {
    ...chapterById('ch3'),
    id: 'test-auto',
    documents: [{ id: 'T-1', type: 'flash', year: 1973, title: '남북 대화 중단', body: '남북 대화가 멈췄어요.', keyPhrase: '멈췄어요', autoOpen: true }],
    startBoard: [{ pair: ['KR', 'NK'], rel: 'TALK' }],
    edgeTasks: [{ pair: ['KR', 'NK'], from: 'TALK', to: 'COLD', mode: 'auto', year: 1973, doc: 'T-1', explanation: '대화가 멈췄어요.' }],
    clock: [],
  };

  beforeEach(() => {
    if (!chapters.some((c) => c.id === test.id)) chapters.push(test);
    useGame.setState(initialState('test-auto'));
  });

  it('그 문서를 열면 실이 저절로 바뀌고 auto로 기록된다', () => {
    game().openDocument('T-1');
    expect(edge('KR-NK')?.rel).toBe('COLD');
    expect(game().done['KR-NK']).toEqual({ wrong: 0, auto: true });
    expect(game().event).toMatchObject({ kind: 'auto', key: 'KR-NK' });
  });
});
