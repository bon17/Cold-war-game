import { describe, expect, it } from 'vitest';
import { chapterById } from './data';
import { autoOpenDoc, availableDocs, currentDoc } from './docFlow';
import type { Chapter } from '../types';

const base = chapterById('ch3');
const test: Chapter = {
  ...base,
  id: 'test-docs',
  documents: [
    { id: 'A', type: 'flash', year: 1973, title: '속보', body: '남북 대화가 멈췄어요.', keyPhrase: '멈췄어요', autoOpen: true },
    { id: 'B', type: 'newspaper', year: 1979, title: '보통 문서', body: '가. 나.', keyPhrase: '가' },
    { id: 'C', type: 'flash', year: 1992, title: '늦게 오는 문서', body: '한중 수교.', keyPhrase: '수교', revealAfter: 'p1' },
  ],
  edgeTasks: [],
};

describe('문서 도착 규칙', () => {
  it('3장: 문서는 하나씩 온다. 앞 문서의 실을 바꿔야 다음 문서가 온다', () => {
    const ids = (read: string[], done: Record<string, unknown>) => availableDocs(base, [], read, done).map((d) => d.id);
    expect(ids([], {})).toEqual(['3-3']);
    expect(ids(['3-3'], {})).toEqual(['3-3']);              // 읽기만 하고 실을 안 바꾸면 그대로
    expect(ids(['3-3'], { 'CN-SU': 1 })).toEqual(['3-3', '3-5']);
    expect(ids(['3-3', '3-5', '3-6'], { 'CN-SU': 1, 'CN-US': 1, 'KR-NK': 1 })).toEqual(['3-3', '3-5', '3-6']);
  });

  it('지금 읽을 문서: 실을 바꾸지 않은 마지막 도착 문서, 다 마치면 없음', () => {
    expect(currentDoc(base, [], [], {})?.id).toBe('3-3');
    expect(currentDoc(base, [], ['3-3'], { 'CN-SU': 1 })?.id).toBe('3-5');
    expect(currentDoc(base, [], ['3-3', '3-5', '3-6'], { 'CN-SU': 1, 'CN-US': 1, 'KR-NK': 1 })).toBeUndefined();
  });

  it('실이 없는 문서는 읽으면 다음이 오고, revealAfter 문서는 그 시계 지점이 끝난 뒤에 온다(5-8)', () => {
    expect(availableDocs(test, [], [], {}).map((d) => d.id)).toEqual(['A']);
    expect(availableDocs(test, [], ['A', 'B'], {}).map((d) => d.id)).toEqual(['A', 'B']);
    expect(availableDocs(test, ['p1'], ['A', 'B'], {}).map((d) => d.id)).toEqual(['A', 'B', 'C']);
  });

  it('autoOpen 문서는 아직 안 읽었으면 장 시작에 열린다(4-1)', () => {
    expect(autoOpenDoc(test, [], [], {})?.id).toBe('A');
    expect(autoOpenDoc(test, ['A'], [], {})).toBeUndefined();
    expect(autoOpenDoc(base, [], [], {})).toBeUndefined();
  });
});
