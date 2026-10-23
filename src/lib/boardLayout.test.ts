import { describe, expect, it } from 'vitest';
import { layout } from './assets';
import { endBoard, pairKey, startEdges } from './board';
import { boardLayout, edgeCurve, type Measure, type PinStyle } from './boardLayout';
import { chapterById, pinName, pinSide, strings } from './data';
import { boxesOverlap, LABEL_GAP, type Box } from './labelLayout';
import { pointAt } from './stringPath';
import type { BoardEdge, Chapter } from '../types';

// 어림 글자 폭(고운바탕을 재어 조금 넉넉하게): 한글 0.9em, 공백 0.32em, 그 밖(가운뎃점 등) 0.46em, 굵은 글씨 3% 더
const measure: Measure = (text, px, bold) =>
  [...text].reduce((w, ch) => w + px * (/[가-힣]/.test(ch) ? 0.9 : ch === ' ' ? 0.32 : 0.46), 0) * (bold ? 1.03 : 1);

const edgeText = (e: BoardEdge) => [strings.relations[e.rel], e.fray && '균열', e.mark && '직통선'].filter(Boolean).join(' · ');

const pinsOf = (chapter: Chapter): PinStyle => ({ text: (id) => pinName(chapter, id), side: (id) => pinSide(chapter, id) });

function problems(edges: BoardEdge[], pins?: PinStyle): string[] {
  const { pinTags, legend, labels } = boardLayout(edges, measure, edgeText, pins);
  const boxes: { name: string; box: Box }[] = [
    ...pinTags.map((p) => ({ name: `핀 ${p.id}`, box: p.box })),
    ...[...labels].map(([key, l]) => ({ name: `실 ${key}`, box: l.box })),
    { name: '범례', box: legend },
  ];
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const gap = boxes[i].name.startsWith('실') && boxes[j].name.startsWith('실') ? LABEL_GAP : 0;
      if (boxesOverlap(boxes[i].box, boxes[j].box, gap)) out.push(`${boxes[i].name} × ${boxes[j].name}`);
    }
  }
  const paper = layout.board.paper;
  for (const { name, box } of boxes) {
    if (box.x < paper.x || box.y < paper.y || box.x + box.w > paper.x + paper.w || box.y + box.h > paper.y + paper.h) {
      out.push(`${name}: 차트 종이 밖으로 나감`);
    }
  }
  return out;
}

describe('3장 보드 이름표 자리', () => {
  const ch3 = chapterById('ch3');
  const background = startEdges(ch3).filter((e) => e.background);

  it('시작 보드: 이름표끼리, 핀 이름표, 범례 카드와 겹치지 않고 차트 종이 안에 있다', () => {
    expect(problems(startEdges(ch3))).toEqual([]);
  });

  it('끝 보드(실 4개가 바뀐 뒤)도 겹치지 않는다', () => {
    expect(problems([...background, ...endBoard(ch3)])).toEqual([]);
  });

  it('균열과 직통선 매듭 자리는 이름표가 가리지 않는다', () => {
    const { labels } = boardLayout(startEdges(ch3), measure, edgeText);
    const fray = labels.get(pairKey(['CN', 'SU']))!.t;
    const knot = labels.get(pairKey(['US', 'SU']))!.t;
    expect(fray < 0.4 || fray > 0.6).toBe(true);
    expect(knot < 0.24 || knot > 0.36).toBe(true);
  });
});

describe('프롤로그 보드 이름표 자리', () => {
  const prologue = chapterById('prologue');
  const pins = pinsOf(prologue);

  it('끝 보드(실 3개): 이름표가 겹치지 않고 차트 종이 안에 있다', () => {
    expect(problems(endBoard(prologue), pins)).toEqual([]);
  });

  it("핀 이름표('38선 이남' 등)가 다른 실을 가리지 않는다", () => {
    const edges = endBoard(prologue);
    const { pinTags } = boardLayout(edges, measure, edgeText, pins);
    const covered: string[] = [];
    for (const { id, box } of pinTags) {
      for (const e of edges.filter((x) => !x.pair.includes(id))) {
        const curve = edgeCurve(e);
        for (let t = 0; t <= 1; t += 0.02) {
          const p = pointAt(curve, t);
          if (p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h) {
            covered.push(`핀 ${id} × 실 ${pairKey(e.pair)}`);
            break;
          }
        }
      }
    }
    expect(covered).toEqual([]);
  });
});
