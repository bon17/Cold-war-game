import { describe, expect, it } from 'vitest';
import { pairKey } from './board';
import { chapterById } from './data';
import { docForTask, judge, optionOrder, revealTasksFor, taskForDoc } from './validateEdge';

const ch3 = chapterById('ch3');
const direct = ch3.edgeTasks.filter((t) => t.mode === 'direct');

describe('실 판정', () => {
  it('관계만 본다', () => {
    const task = direct.find((t) => pairKey(t.pair) === 'CN-SU')!;
    expect(judge(task, 'ALLY')).toBe(false);
    expect(judge(task, 'COLD')).toBe(true);
  });

  it('문서 하나에 실 하나: 3-3 중국–소련, 3-5 미국–중국, 3-6 남한–북한', () => {
    expect(['3-3', '3-5', '3-6'].map((id) => pairKey(taskForDoc(ch3, id)!.pair))).toEqual(['CN-SU', 'CN-US', 'KR-NK']);
    expect(docForTask(ch3, direct[1])?.id).toBe('3-5');
  });

  it('미국–소련 실은 시계 공개 때 저절로 바뀐다', () => {
    expect(revealTasksFor(ch3, 'ch3-c1').map((t) => pairKey(t.pair))).toEqual(['SU-US']);
  });
});

describe('선택지 순서', () => {
  it('같은 선택지를 섞기만 하고, 정답 자리가 실마다 돌아간다(3장: ②①②)', () => {
    const positions = direct.map((t) => {
      const order = optionOrder(ch3, t);
      expect([...order].sort()).toEqual([...t.options!].sort());
      return order.indexOf(t.to) + 1;
    });
    expect(positions).toEqual([2, 1, 2]);
  });
});
