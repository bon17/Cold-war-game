import { describe, expect, it } from 'vitest';
import { chapterRels, endBoard, pairKey, startEdges } from './board';
import { chapterById, chapters, clock, nodes } from './data';
import { segmentsCross } from './stringPath';
import { validateChapter } from './validateData';

describe('장 데이터 검사(validateData)', () => {
  for (const chapter of chapters) {
    it(`${chapter.id}: 문서 수·글자 수·문장 수·핵심 구절·실·시계·핀이 규칙에 맞다`, () => {
      const index = chapters.indexOf(chapter);
      expect(validateChapter(chapter, clock, nodes, chapters[index - 1])).toEqual([]);
    });
  }
});

describe('3장 보드', () => {
  const ch3 = chapterById('ch3');

  it('시작 보드에 중국–소련 균열과 미국–소련 직통선 매듭이 있다', () => {
    const edges = startEdges(ch3);
    expect(edges.find((e) => pairKey(e.pair) === 'CN-SU')).toMatchObject({ rel: 'ALLY', fray: true });
    expect(edges.find((e) => pairKey(e.pair) === 'SU-US')).toMatchObject({ rel: 'COLD', mark: 'hotline' });
    expect(edges.filter((e) => e.background)).toHaveLength(4);
  });

  it('끝 보드: 중국–소련은 대립이 되며 균열이 사라지고, 직통선 매듭은 남는다', () => {
    const end = new Map(endBoard(ch3).map((e) => [pairKey(e.pair), e]));
    expect(end.get('CN-SU')).toEqual({ pair: ['CN', 'SU'], rel: 'COLD' });
    expect(end.get('SU-US')).toMatchObject({ rel: 'TALK', mark: 'hotline' });
    expect(end.get('CN-US')?.rel).toBe('TALK');
    expect(end.get('KR-NK')?.rel).toBe('TALK');
  });

  it('범례에는 같은 편, 대립, 대화만 나온다', () => {
    expect(chapterRels(ch3)).toEqual(['ALLY', 'COLD', 'TALK']);
  });

  it('시작 배치에서 실끼리 서로 교차하지 않는다(아트 계획서 4.5)', () => {
    const at = (id: keyof typeof nodes.nodes) => nodes.nodes[id]!;
    const edges = startEdges(ch3);
    const crossings: string[] = [];
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i].pair.map(at);
        const [c, d] = edges[j].pair.map(at);
        if (segmentsCross(a, b, c, d)) crossings.push(`${pairKey(edges[i].pair)} × ${pairKey(edges[j].pair)}`);
      }
    }
    expect(crossings).toEqual([]);
  });
});
