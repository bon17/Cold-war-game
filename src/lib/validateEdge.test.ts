import { describe, expect, it } from 'vitest';
import { pairKey } from './board';
import { chapterById } from './data';
import { evidenceDoc, judge, optionOrder } from './validateEdge';

const ch3 = chapterById('ch3');
const direct = ch3.edgeTasks.filter((t) => t.mode === 'direct');

describe('실 판정', () => {
  it('근거가 틀리면 종류와 상관없이 "단서가 틀림"', () => {
    const task = direct.find((t) => pairKey(t.pair) === 'CN-SU')!;
    expect(judge(task, '미국 선수단', 'COLD')).toBe('wrongEvidence');
    expect(judge(task, '국경 충돌', 'TALK')).toBe('wrongRel');
    expect(judge(task, '국경 충돌', 'COLD')).toBe('ok');
  });

  it('남북 실은 단서 둘 다 근거로 인정한다', () => {
    const task = direct.find((t) => pairKey(t.pair) === 'KR-NK')!;
    expect(judge(task, '공동 성명', 'TALK')).toBe('ok');
    expect(judge(task, '적십자 회담', 'TALK')).toBe('ok');
  });

  it('힌트에 쓰는 문서는 그 실의 근거가 들어 있는 문서', () => {
    expect(evidenceDoc(ch3, direct.find((t) => pairKey(t.pair) === 'SU-US')!)?.id).toBe('3-7');
  });
});

describe('선택지 순서', () => {
  it('같은 선택지를 섞기만 하고, 정답 자리가 실마다 돌아간다(3장: ②①③②)', () => {
    const positions = direct.map((t) => {
      const order = optionOrder(ch3, t);
      expect([...order].sort()).toEqual([...t.options!].sort());
      return order.indexOf(t.to) + 1;
    });
    expect(positions).toEqual([2, 1, 3, 2]);
  });
});
