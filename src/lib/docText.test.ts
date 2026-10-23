import { describe, expect, it } from 'vitest';
import { chapterById, glossary } from './data';
import { glossaryByDoc, splitBody } from './docText';

const ch3 = chapterById('ch3');
const words = Object.keys(glossary);

describe('낱말 풀이 밑줄 자리(장마다 처음 나올 때)', () => {
  it('3장: 처음 나오는 문서에만 배정된다', () => {
    const byDoc = glossaryByDoc(ch3, words);
    expect(byDoc.get('3-3')).toEqual(expect.arrayContaining(['공산주의', '국경']));
    expect(byDoc.get('3-5')).toEqual(['외교']);
    expect(byDoc.get('3-6')).toEqual(['성명']);
  });
});

describe('본문 나누기', () => {
  it('합치면 본문 그대로이고, 핵심 구절 덩어리가 하나 있다', () => {
    const byDoc = glossaryByDoc(ch3, words);
    for (const doc of ch3.documents) {
      const chunks = splitBody(doc.body, doc.keyPhrase, byDoc.get(doc.id) ?? []);
      expect(chunks.map((c) => c.pieces.map((p) => p.text).join('')).join('')).toBe(doc.body);
      expect(chunks.filter((c) => c.key).map((c) => c.key)).toEqual([doc.keyPhrase]);
    }
  });

  it('핵심 구절 밖의 밑줄 낱말: 3-6의 "공동 성명" 안의 "성명"', () => {
    const doc = ch3.documents.find((d) => d.id === '3-6')!;
    const pieces = splitBody(doc.body, doc.keyPhrase, ['성명']).flatMap((c) => c.pieces);
    expect(pieces.filter((p) => p.word === '성명')).toEqual([{ text: '성명', word: '성명', key: undefined }]);
  });

  it('밑줄은 그 문서에서 처음 나온 곳에만', () => {
    const pieces = splitBody('국경에서 싸웠다. 다시 국경에서.', undefined, ['국경']).flatMap((c) => c.pieces);
    expect(pieces.filter((p) => p.word === '국경')).toHaveLength(1);
  });
});
