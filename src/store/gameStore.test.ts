import { beforeEach, describe, expect, it } from 'vitest';
import { endBoard, pairKey } from '../lib/board';
import { chapterById, chapters } from '../lib/data';
import type { Chapter } from '../types';
import { hasClue, initialState, useGame } from './gameStore';

const game = () => useGame.getState();
const edge = (key: string) => game().board.find((e) => pairKey(e.pair) === key);
const pick = (docId: string, clue: string) => {
  game().collectClue(docId, clue);
  game().selectClue({ docId, clue });
};

describe('게임 상태: 문서와 단서', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  it('문서를 열면 읽은 것으로 남고, 다시 열어도 한 번만 남는다', () => {
    game().openDocument('3-2');
    game().closeDocument();
    game().openDocument('3-2');
    expect(game().readDocs).toEqual(['3-2']);
    expect(game().openDocId).toBe('3-2');
  });

  it('같은 단서를 두 번 눌러도 쪽지는 하나', () => {
    game().collectClue('3-6', '공동 성명');
    game().collectClue('3-6', '공동 성명');
    game().collectClue('3-6', '적십자 회담');
    expect(game().clues).toHaveLength(2);
    expect(hasClue(game().clues, '3-6', '적십자 회담')).toBe(true);
    expect(hasClue(game().clues, '3-5', '적십자 회담')).toBe(false);
  });
});

describe('실 걸기(기획서 5.2)', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  it('단서 없이 실을 고르면 "먼저 단서"만 알린다', () => {
    game().submitEdge('CN-SU', 'COLD');
    expect(game().event?.kind).toBe('needClue');
    expect(edge('CN-SU')?.rel).toBe('ALLY');
  });

  it('맞는 단서 + 맞는 종류: 실이 바뀌고 균열이 사라진다', () => {
    pick('3-3', '국경 충돌');
    game().submitEdge('CN-SU', 'COLD');
    expect(edge('CN-SU')).toEqual({ pair: ['CN', 'SU'], rel: 'COLD' });
    expect(game().done['CN-SU']).toEqual({ wrong: 0, helped: false });
    expect(game().selectedClue).toBeNull();
    expect(game().event).toMatchObject({ kind: 'ok', key: 'CN-SU', helped: false, allDone: false });
  });

  it('틀린 단서와 틀린 종류를 구분하고, 두 번째부터 힌트, 세 번째에 도움받아 걸림', () => {
    pick('3-5', '미국 선수단');
    game().submitEdge('CN-SU', 'COLD');
    expect(game().event).toMatchObject({ kind: 'wrong', reason: 'evidence', hint: false });
    pick('3-3', '국경 충돌');
    game().submitEdge('CN-SU', 'TALK');
    expect(game().event).toMatchObject({ kind: 'wrong', reason: 'rel', hint: true, rel: 'TALK' });
    expect(edge('CN-SU')?.rel).toBe('ALLY');
    game().submitEdge('CN-SU', 'ALLY');
    expect(game().event).toMatchObject({ kind: 'ok', key: 'CN-SU', helped: true });
    expect(edge('CN-SU')?.rel).toBe('COLD');
    expect(game().done['CN-SU']).toEqual({ wrong: 3, helped: true });
  });

  it('직접 실 4개를 다 걸면 allDone이고, 보드는 장 끝 보드와 같다(직통선 매듭 남음)', () => {
    pick('3-3', '국경 충돌');
    game().submitEdge('CN-SU', 'COLD');
    pick('3-5', '미국 선수단');
    game().submitEdge('CN-US', 'TALK');
    pick('3-6', '적십자 회담');
    game().submitEdge('KR-NK', 'TALK');
    pick('3-7', '전략 무기 제한');
    game().submitEdge('SU-US', 'TALK');
    expect(game().event).toMatchObject({ kind: 'ok', allDone: true });
    const norm = (b: { pair: [string, string] }[]) => b.map((e) => JSON.stringify({ ...e, pair: pairKey(e.pair as never) })).sort();
    expect(norm(game().board)).toEqual(norm(endBoard(chapterById('ch3'))));
    expect(edge('SU-US')?.mark).toBe('hotline');
  });

  it('과제가 없는 실(남한–소련)은 아무 일도 없다', () => {
    pick('3-3', '국경 충돌');
    game().submitEdge('KR-SU', 'TALK');
    expect(edge('KR-SU')?.rel).toBe('COLD');
    expect(game().wrong['KR-SU']).toBeUndefined();
  });
});

describe('자동 실(3장에는 없어서 4-1 같은 시험용 장으로 확인)', () => {
  const test: Chapter = {
    ...chapterById('ch3'),
    id: 'test-auto',
    documents: [{ id: 'T-1', type: 'flash', tier: 'core', year: 1973, title: '남북 대화 중단', body: '남북 대화 중단.', clues: ['대화 중단'], autoOpen: true }],
    startBoard: [{ pair: ['KR', 'NK'], rel: 'TALK' }],
    edgeTasks: [{ pair: ['KR', 'NK'], from: 'TALK', to: 'COLD', mode: 'auto', year: 1973, evidence: ['대화 중단'], explanation: '대화가 멈췄다.' }],
  };

  beforeEach(() => {
    if (!chapters.some((c) => c.id === test.id)) chapters.push(test);
    useGame.setState(initialState('test-auto'));
  });

  it('트리거 단서를 칠하면 실이 저절로 바뀌고 auto로 기록된다', () => {
    game().collectClue('T-1', '대화 중단');
    expect(edge('KR-NK')?.rel).toBe('COLD');
    expect(game().done['KR-NK']).toEqual({ wrong: 0, helped: false, auto: true });
    expect(game().event).toMatchObject({ kind: 'auto', key: 'KR-NK' });
  });
});
