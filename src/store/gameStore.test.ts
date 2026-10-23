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

describe('시계 공개와 보고서(기획서 5.3·5.4)', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  const readAll = () => {
    for (const id of ['3-2', '3-3', '3-5', '3-6', '3-7']) {
      game().openDocument(id);
      game().closeDocument();
      if (game().reveal) while (game().reveal) game().advanceReveal();
    }
  };
  const hangAll = () => {
    for (const [doc, clue, key] of [['3-3', '국경 충돌', 'CN-SU'], ['3-5', '미국 선수단', 'CN-US'], ['3-6', '공동 성명', 'KR-NK'], ['3-7', '전략 무기 제한', 'SU-US']] as const) {
      pick(doc, clue);
      game().submitEdge(key, key === 'CN-SU' ? 'COLD' : 'TALK');
    }
  };

  it('시작: 시계 12분, 일력 1964년', () => {
    expect(game().clockShown).toEqual({ minutes: 12, year: 1964 });
  });

  it('3-2를 읽고 닫으면 1968년 공개가 시작되고, 전보 → 바늘 → 해설 뒤 7분이 된다', () => {
    game().openDocument('3-2');
    expect(game().reveal).toBeNull();          // 읽는 동안에는 시작하지 않는다
    game().closeDocument();
    expect(game().reveal).toEqual({ pointId: 'ch3-c1', step: 'bulletin' });
    game().advanceReveal();
    expect(game().reveal?.step).toBe('needle');
    game().advanceReveal();
    expect(game().reveal?.step).toBe('explanation');
    game().advanceReveal();                     // 공개(show)에는 1면이 없다
    expect(game().reveal).toBeNull();
    expect(game().revealed).toEqual(['ch3-c1']);
    expect(game().clockShown).toEqual({ minutes: 7, year: 1968 });
  });

  it('보고서는 문서와 실을 다 마쳐야 열린다', () => {
    readAll();
    game().openReport();
    expect(game().reportOpen).toBe(false);
    hangAll();
    game().openReport();
    expect(game().reportOpen).toBe(true);
  });

  it('보고서 → 전보 → 바늘 → 해설 → 1면 → 보너스 → 끝(12분, 1972년)', () => {
    readAll();
    hangAll();
    game().openReport();
    game().submitReport({ direction: 'farther', edge: 'SU-US' });
    expect(game().reveal).toEqual({ pointId: 'ch3-c2', step: 'bulletin' });
    for (const step of ['needle', 'explanation', 'newspaper', 'bonus']) {
      game().advanceReveal();
      expect(game().reveal?.step).toBe(step);
    }
    game().answerBonus('CN-SU');
    expect(game().bonus).toEqual({ edge: 'CN-SU', correct: true });
    expect(game().achievements).toEqual(['enemy-of-enemy']);
    game().advanceReveal();
    expect(game().reveal).toBeNull();
    expect(game().revealed).toEqual(['ch3-c1', 'ch3-c2']);
    expect(game().clockShown).toEqual({ minutes: 12, year: 1972 });
    expect(game().reports['ch3-c2']).toEqual({ direction: 'farther', edge: 'SU-US' });
  });

  it('보너스를 틀리면 도전 과제는 없다', () => {
    readAll();
    hangAll();
    game().openReport();
    game().submitReport({ direction: 'closer', edge: 'KR-NK' });
    game().answerBonus('KR-NK');
    expect(game().bonus?.correct).toBe(false);
    expect(game().achievements).toEqual([]);
  });
});

describe('잠긴 보고서', () => {
  beforeEach(() => useGame.setState(initialState('ch3')));

  it('1968년 공개 전에 보고서철을 눌러도 무엇이 남았는지 알린다', () => {
    game().openReport();
    expect(game().reportOpen).toBe(false);
    expect(game().event?.kind).toBe('reportLocked');
  });
});
