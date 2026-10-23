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
const action = () => nextAction(prologue, game());
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

describe('실 이력: 사이 장이 아직 없을 때', () => {
  it('3장 미국–소련: 프롤로그 1945 같은 편 → 3장 시작 대립 → 1972 대화', () => {
    const steps = edgeHistory(chapters, 'ch3', 'SU-US', { 'SU-US': {} }).map((s) => [s.year, s.rel]);
    expect(steps).toEqual([[1945, 'ALLY'], [null, 'COLD'], [1972, 'TALK']]);
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
