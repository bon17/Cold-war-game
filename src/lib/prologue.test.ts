import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useGame } from '../store/gameStore';
import { chapterRels, endBoard, pairKey } from './board';
import { clockHung, hasPredict, isFirstHang } from './clockFlow';
import { chapterById, chapters, nodes, pinName, previousChapter } from './data';
import { nextAction } from './guide';
import { edgeHistory } from './history';
import { hasStars } from './scoring';
import { segmentsCross } from './stringPath';

// 프롤로그(2026-10-23 교사 결정): 문서 5개, 실 3개(미국–소련 같은 편, 점령 둘), 보고서 없이 끝에 시계가 처음 걸린다.
const prologue = chapterById('prologue');
const game = () => useGame.getState();
const action = () => nextAction(chapterById(game().chapterId), game());
const read = (doc: string) => {
  game().openDocument(doc);
  game().closeDocument();
};

describe('프롤로그 데이터', () => {
  it('첫 장이고, 앞 장이 없다', () => {
    expect(chapters[0].id).toBe('prologue');
    expect(previousChapter(prologue)).toBeUndefined();
  });

  it('시작 보드는 비어 있고, 끝 보드에는 같은 편 하나와 점령 둘', () => {
    expect(prologue.startBoard).toEqual([]);
    const end = new Map(endBoard(prologue).map((e) => [pairKey(e.pair), e.rel]));
    expect(Object.fromEntries(end)).toEqual({ 'SU-US': 'ALLY', 'NK-SU': 'OCCUPY', 'KR-US': 'OCCUPY' });
  });

  it('범례는 같은 편·대립(P-1의 선택지)·점령, 핀 이름은 38선 이남·이북', () => {
    expect(chapterRels(prologue)).toEqual(['ALLY', 'COLD', 'OCCUPY']);
    expect(pinName(prologue, 'KR')).toBe('38선 이남');
    expect(pinName(prologue, 'NK')).toBe('38선 이북');
    expect(pinName(prologue, 'US')).toBe('미국');
    expect(pinName(chapterById('ch3'), 'KR')).toBe('남한');
  });

  it('끝 보드에서 실끼리 교차하지 않는다', () => {
    const at = (id: keyof typeof nodes.nodes) => nodes.nodes[id]!;
    const edges = endBoard(prologue);
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i].pair.map(at);
        const [c, d] = edges[j].pair.map(at);
        expect(segmentsCross(a, b, c, d), `${pairKey(edges[i].pair)} × ${pairKey(edges[j].pair)}`).toBe(false);
      }
    }
  });

  it('보고서(예측)와 별이 없고, 시계는 처음 걸리는 공개 하나', () => {
    expect(hasPredict(prologue)).toBe(false);
    expect(hasStars(prologue)).toBe(false);
    expect(hasStars(chapterById('ch3'))).toBe(true);
    expect(isFirstHang(prologue, prologue.clock[0])).toBe(true);
    expect(isFirstHang(chapterById('ch3'), chapterById('ch3').clock[0])).toBe(false);
  });
});

describe('프롤로그 진행', () => {
  beforeEach(() => useGame.setState(initialState('prologue')));

  it('시작: 시계는 아직 없고 일력은 1945년', () => {
    expect(game().clockShown.year).toBe(1945);
    expect(clockHung(prologue, game().revealed, game().reveal)).toBe(false);
    expect(action()).toEqual({ kind: 'doc', docId: 'P-1' });
  });

  it('실이 없는 문서는 읽고 닫으면 바꾸기 창 없이 다음 문서가 온다', () => {
    read('P-1');
    expect(game().dialogEdge).toBe('SU-US');
    game().submitEdge('SU-US', 'ALLY');
    read('P-2');
    expect(game().dialogEdge).toBeNull();
    expect(action()).toEqual({ kind: 'doc', docId: 'P-3' });
  });

  it('문서 5개를 마치면 보고서 없이 1947년 시계가 걸리고, 끝나면 시계 지점이 끝난다', () => {
    read('P-1');
    game().submitEdge('SU-US', 'ALLY');
    read('P-2');
    read('P-3');
    game().submitEdge('NK-SU', 'OCCUPY');
    read('P-4');
    game().submitEdge('KR-US', 'OCCUPY');
    expect(game().reveal).toBeNull();          // 아직 P-5가 남았다
    read('P-5');
    expect(game().reveal).toEqual({ pointId: 'prologue-c1', step: 'needle' });
    expect(clockHung(prologue, game().revealed, game().reveal)).toBe(true);
    game().advanceReveal();
    expect(game().clockShown).toEqual({ minutes: 7, year: 1947 });
    expect(game().reveal?.step).toBe('explanation');
    game().advanceReveal();                    // 예측이 아니라 1면은 없다
    expect(game().reveal).toBeNull();
    expect(game().revealed).toEqual(['prologue-c1']);
    expect(Object.keys(game().reports)).toEqual([]);
  });
});

describe('실 이력: 장을 건너 이어진다', () => {
  it('3장 미국–소련: 프롤로그 1945 같은 편 → 1장 1947 대립 → 1972 대화', () => {
    const steps = edgeHistory(chapters, 'ch3', 'SU-US', { 'SU-US': {} }).map((s) => [s.year, s.rel]);
    expect(steps).toEqual([[1945, 'ALLY'], [1947, 'COLD'], [1972, 'TALK']]);
  });
});

describe('실이 없는 문서의 단추', () => {
  beforeEach(() => useGame.setState(initialState('prologue')));

  it('처음 열 때만 \'다 읽었어요\'(openDocFresh), 다시 열면 \'닫기\'', () => {
    read('P-1');
    game().submitEdge('SU-US', 'ALLY');
    game().openDocument('P-2');
    expect(game().openDocFresh).toBe(true);
    game().closeDocument();
    expect(game().openDocFresh).toBe(false);
    game().openDocument('P-2');
    expect(game().openDocFresh).toBe(false);
  });
});

describe("'다 읽었어요'로 다음 문서 넘기기(2026-10-23 교사 의견)", () => {
  beforeEach(() => useGame.setState(initialState('prologue')));

  it('실이 없는 문서는 닫지 않고 다음 문서를 바로 연다', () => {
    read('P-1');
    game().submitEdge('SU-US', 'ALLY');
    game().openDocument('P-2');
    game().finishDocument();
    expect(game().openDocId).toBe('P-3');
    expect(game().readDocs).toContain('P-3');
  });

  it('실이 있는 문서는 닫고 실 바꾸기 창을 연다', () => {
    game().openDocument('P-1');
    game().finishDocument();
    expect(game().openDocId).toBeNull();
    expect(game().dialogEdge).toBe('SU-US');
  });
});

describe('1장', () => {
  const ch1 = chapterById('ch1');
  beforeEach(() => useGame.setState(initialState('ch1')));

  it('프롤로그 다음 장이고, 시작 보드는 1948년 정부 수립으로 바뀐 실만 다르다', () => {
    expect(previousChapter(ch1)?.id).toBe('prologue');
    expect(pinName(ch1, 'KR')).toBe('남한');
    const start = new Map(ch1.startBoard.map((e) => [pairKey(e.pair), e.rel]));
    expect(Object.fromEntries(start)).toEqual({ 'SU-US': 'ALLY', 'KR-NK': 'COLD', 'KR-SU': 'COLD' });
  });

  it('중국군 참전(1-5): 미국–중국을 맞히면 남한–중국도 함께 전쟁이 된다(문서를 열 때가 아니라)', () => {
    for (const [doc, key, rel] of [['1-1', 'SU-US', 'COLD'], ['1-2'], ['1-3', 'CN-SU', 'ALLY'], ['1-4', 'KR-NK', 'WAR']] as const) {
      read(doc);
      if (key) game().submitEdge(key, rel);
    }
    game().openDocument('1-5');
    expect(game().done['CN-KR']).toBeUndefined();
    game().closeDocument();
    game().submitEdge('CN-US', 'WAR');
    expect(game().done['CN-KR']).toEqual({ wrong: 0, auto: true });
    expect(game().board.find((e) => pairKey(e.pair) === 'CN-KR')?.rel).toBe('WAR');
    expect(game().event).toMatchObject({ kind: 'ok', key: 'CN-US', allDone: true });
    read('1-6');
    expect(action()).toEqual({ kind: 'report' });
  });
});
