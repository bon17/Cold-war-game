import { describe, expect, it } from 'vitest';
import { chapterById } from './data';
import { autoOpenDoc, availableDocs } from './docFlow';
import type { Chapter } from '../types';

const base = chapterById('ch3');
const test: Chapter = {
  ...base,
  id: 'test-docs',
  documents: [
    { id: 'A', type: 'flash', tier: 'core', year: 1973, title: '속보', body: '남북 대화 중단.', clues: ['대화 중단'], autoOpen: true },
    { id: 'B', type: 'newspaper', tier: 'core', year: 1979, title: '보통 문서', body: '가. 나.', clues: [] },
    { id: 'C', type: 'flash', tier: 'core', year: 1992, title: '늦게 오는 문서', body: '한중 수교.', clues: ['한중 수교'], revealAfter: 'p1' },
  ],
};

describe('문서 도착 규칙', () => {
  it('revealAfter 문서는 그 시계 지점이 끝난 뒤에만 보인다(5-8)', () => {
    expect(availableDocs(test, []).map((d) => d.id)).toEqual(['A', 'B']);
    expect(availableDocs(test, ['p1']).map((d) => d.id)).toEqual(['A', 'B', 'C']);
  });

  it('autoOpen 문서는 아직 안 읽었으면 장 시작에 열린다(4-1)', () => {
    expect(autoOpenDoc(test, [], [])?.id).toBe('A');
    expect(autoOpenDoc(test, ['A'], [])).toBeUndefined();
  });

  it('3장에는 둘 다 없다', () => {
    expect(availableDocs(base, []).length).toBe(base.documents.length);
    expect(autoOpenDoc(base, [], [])).toBeUndefined();
  });
});
