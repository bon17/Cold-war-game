import { describe, expect, it } from 'vitest';
import { chapterById, glossary } from './data';
import { glossaryByDoc, splitBody } from './docText';

const ch3 = chapterById('ch3');
const words = Object.keys(glossary);

describe('낱말 풀이 밑줄 자리(장마다 처음 나올 때)', () => {
  const byDoc = glossaryByDoc(ch3, words);

  it('3장의 낱말 8개가 모두 한 번씩, 처음 나오는 문서에 배정된다', () => {
    const all = [...byDoc.values()].flat();
    expect(all.sort()).toEqual([...words].sort());
    expect(byDoc.get('3-2')).toEqual(['국제전']);
    expect(byDoc.get('3-3')).toEqual(expect.arrayContaining(['공산주의', '진영', '국경']));
    expect(byDoc.get('3-6')).toEqual(['성명']);
    expect(byDoc.get('3-7')).toEqual(expect.arrayContaining(['협정', '정상']));
    expect(byDoc.get('3-1')).toEqual(['핵실험']);
  });
});

describe('본문 나누기', () => {
  it('합치면 본문 그대로이고, 단서 구절마다 덩어리가 하나씩 있다', () => {
    const byDoc = glossaryByDoc(ch3, words);
    for (const doc of ch3.documents) {
      const chunks = splitBody(doc.body, doc.clues, byDoc.get(doc.id) ?? []);
      expect(chunks.map((c) => c.pieces.map((p) => p.text).join('')).join('')).toBe(doc.body);
      expect(chunks.filter((c) => c.clue).map((c) => c.clue).sort()).toEqual([...doc.clues].sort());
    }
  });

  it('단서 안의 밑줄 낱말: 3-6의 "공동 성명" 안에 "성명"', () => {
    const doc = ch3.documents.find((d) => d.id === '3-6')!;
    const chunks = splitBody(doc.body, doc.clues, ['성명']);
    const clue = chunks.find((c) => c.clue === '공동 성명')!;
    expect(clue.pieces).toEqual([
      { text: '공동 ', clue: '공동 성명', word: undefined },
      { text: '성명', clue: '공동 성명', word: '성명' },
    ]);
  });

  it('밑줄은 그 문서에서 처음 나온 곳에만: 3-3의 "국경"은 첫 문장에만', () => {
    const doc = ch3.documents.find((d) => d.id === '3-3')!;
    const pieces = splitBody(doc.body, doc.clues, ['국경']).flatMap((c) => c.pieces);
    expect(pieces.filter((p) => p.word === '국경')).toHaveLength(1);
    expect(doc.body.indexOf('국경')).toBeLessThan(doc.body.indexOf('국경 충돌'));
  });
});
