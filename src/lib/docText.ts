// 문서 본문을 단서 구절과 낱말 풀이 낱말로 나눈다(기획서 5.1).
import type { Chapter } from '../types';

// 낱말 풀이 밑줄은 장마다 그 장에서 처음 나올 때만 긋는다(기획서 5.1, 2026-10-22 결정).
// 처음 = 문서 배열 순서(도착 순서, 핵심 다음 더 읽기)로 보아 처음 나오는 문서.
export function glossaryByDoc(chapter: Chapter, words: string[]): Map<string, string[]> {
  const byDoc = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const doc of chapter.documents) {
    const found = words.filter((w) => !seen.has(w) && doc.body.includes(w));
    found.forEach((w) => seen.add(w));
    byDoc.set(doc.id, found);
  }
  return byDoc;
}

// 한 글자 조각. clue: 이 조각이 속한 단서 구절, word: 밑줄 낱말
export interface Piece { text: string; clue?: string; word?: string }
// 화면에 그릴 덩어리: 단서 구절 하나(안에 밑줄 낱말이 있을 수 있음) 또는 단서 밖 조각
export interface Chunk { clue?: string; pieces: Piece[] }

export function splitBody(body: string, clues: string[], words: string[]): Chunk[] {
  const clueAt: (string | undefined)[] = new Array(body.length);
  const wordAt: (string | undefined)[] = new Array(body.length);
  for (const clue of clues) {
    const i = body.indexOf(clue);
    if (i >= 0) for (let k = i; k < i + clue.length; k++) clueAt[k] = clue;
  }
  for (const word of words) {
    const i = body.indexOf(word);
    if (i >= 0) for (let k = i; k < i + word.length; k++) wordAt[k] = word;
  }

  const chunks: Chunk[] = [];
  for (let k = 0; k < body.length; k++) {
    let chunk = chunks[chunks.length - 1];
    if (!chunk || chunk.clue !== clueAt[k]) {
      chunk = { clue: clueAt[k], pieces: [] };
      chunks.push(chunk);
    }
    const last = chunk.pieces[chunk.pieces.length - 1];
    // 같은 낱말이 이어지면 한 조각으로 붙인다(낱말 사이 경계는 위치로 구분)
    const startsWord = wordAt[k] !== undefined && (k === 0 || wordAt[k - 1] !== wordAt[k] || clueAt[k - 1] !== clueAt[k]);
    if (last && last.word === wordAt[k] && !startsWord) last.text += body[k];
    else chunk.pieces.push({ text: body[k], word: wordAt[k], clue: clueAt[k] });
  }
  return chunks;
}
