import { describe, expect, it } from 'vitest';
import { chapterById } from './data';
import { isUnlocked, nextCheckpoint, remaining, revealPath } from './clockFlow';

const ch3 = chapterById('ch3');
const [c1] = ch3.clock;
const allEdges = { 'CN-SU': 1, 'CN-US': 1, 'KR-NK': 1 };

describe('3장 시계 지점(장마다 한 번)', () => {
  it('1972년 보고서는 문서 3개와 직접 실 3개가 모두 필요하다', () => {
    expect(remaining(ch3, c1, ['3-3', '3-5'], allEdges)).toEqual({ docs: ['3-6'], edges: [] });
    expect(remaining(ch3, c1, ['3-3', '3-5', '3-6'], { 'CN-SU': 1 })).toEqual({ docs: [], edges: ['CN-US', 'KR-NK'] });
    expect(isUnlocked(ch3, c1, ['3-3', '3-5', '3-6'], allEdges)).toBe(true);
  });

  it('지점은 하나: 끝나면 다음이 없다', () => {
    expect(nextCheckpoint(ch3, [])?.id).toBe('ch3-c1');
    expect(nextCheckpoint(ch3, ['ch3-c1'])).toBeUndefined();
  });

  it('바늘 경로: 1969년 10분을 거쳐 1972년 12분', () => {
    expect(revealPath(c1).map((e) => [e.year, e.minutes])).toEqual([[1969, 10], [1972, 12]]);
  });
});
