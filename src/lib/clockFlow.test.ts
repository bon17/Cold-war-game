import { describe, expect, it } from 'vitest';
import { chapterById } from './data';
import { isUnlocked, nextCheckpoint, remaining, revealPath } from './clockFlow';

const ch3 = chapterById('ch3');
const [c1, c2] = ch3.clock;
const allEdges = { 'CN-SU': 1, 'CN-US': 1, 'KR-NK': 1, 'SU-US': 1 };

describe('3장 시계 지점', () => {
  it('1968년 공개는 3-2만 읽으면 열린다(실은 필요 없음)', () => {
    expect(isUnlocked(ch3, c1, [], {})).toBe(false);
    expect(isUnlocked(ch3, c1, ['3-2'], {})).toBe(true);
  });

  it('1972년 보고서는 앞 지점의 3-2까지 핵심 문서 5개와 직접 실 4개가 모두 필요하다', () => {
    expect(remaining(ch3, c2, ['3-3', '3-5', '3-6', '3-7'], allEdges)).toEqual({ docs: ['3-2'], edges: [] });
    expect(remaining(ch3, c2, ['3-2', '3-3', '3-5', '3-6', '3-7'], { 'CN-SU': 1 })).toEqual({ docs: [], edges: ['CN-US', 'KR-NK', 'SU-US'] });
    expect(isUnlocked(ch3, c2, ['3-2', '3-3', '3-5', '3-6', '3-7'], allEdges)).toBe(true);
  });

  it('지점은 순서대로: 1968이 끝나야 1972가 다음', () => {
    expect(nextCheckpoint(ch3, [])?.id).toBe('ch3-c1');
    expect(nextCheckpoint(ch3, ['ch3-c1'])?.id).toBe('ch3-c2');
    expect(nextCheckpoint(ch3, ['ch3-c1', 'ch3-c2'])).toBeUndefined();
  });

  it('바늘 경로: 1968은 7분, 1972는 1969년 10분을 거쳐 12분', () => {
    expect(revealPath(c1).map((e) => [e.year, e.minutes])).toEqual([[1968, 7]]);
    expect(revealPath(c2).map((e) => [e.year, e.minutes])).toEqual([[1969, 10], [1972, 12]]);
  });
});
