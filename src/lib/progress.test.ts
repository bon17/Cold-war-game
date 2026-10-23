import { describe, expect, it } from 'vitest';
import { chapterById, chapters } from './data';
import { edgeHistory } from './history';
import { deleteSlot, findSlot, MAX_AGE_MS, prune, readSlots, saveSlot } from './save';
import { chapterAchievements, chapterStars, grade } from './scoring';
import type { SaveSlot } from '../types';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
const slot = (name: string, updatedAt = 0): SaveSlot => ({ name, updatedAt, chapterId: 'ch3', progress: {}, stars: {}, achievements: [], archive: [] });

describe('이름별 기록(기획서 5.9)', () => {
  it('이름 앞뒤 공백은 무시하고, 이름마다 따로 저장한다', () => {
    const st = memoryStorage();
    saveSlot(slot('2-12-김민수'), st, 1000);
    saveSlot(slot('2-13-이서연'), st, 2000);
    expect(findSlot('  2-12-김민수 ', st)?.name).toBe('2-12-김민수');
    expect(readSlots(st)).toHaveLength(2);
    deleteSlot('2-12-김민수', st);
    expect(findSlot('2-12-김민수', st)).toBeUndefined();
  });

  it('40개를 넘거나 60일이 지난 기록은 오래된 것부터 지운다', () => {
    const now = MAX_AGE_MS * 2;
    const many = Array.from({ length: 45 }, (_, i) => slot(`s${i}`, now - i * 1000));
    expect(prune(many, now)).toHaveLength(40);
    expect(prune([slot('old', now - MAX_AGE_MS - 1), slot('new', now)], now).map((s) => s.name)).toEqual(['new']);
  });

  it('저장소가 망가져 있거나 막혀 있어도 오류 없이 빈 기록', () => {
    expect(readSlots({ getItem: () => '{망가짐' })).toEqual([]);
    expect(readSlots({ getItem: () => { throw new Error('막힘'); } })).toEqual([]);
    expect(saveSlot(slot('a'), { getItem: () => null, setItem: () => { throw new Error('가득 참'); } })).toBe(false);
  });
});

describe('별과 등급(기획서 5.6)', () => {
  const ch3 = chapterById('ch3');
  const allDone = { 'CN-SU': { wrong: 0, helped: false }, 'CN-US': { wrong: 1, helped: false }, 'KR-NK': { wrong: 0, helped: false }, 'SU-US': { wrong: 0, helped: false } };

  it('별 셋: 두 번 안에 모두, 근거 실 맞음, 보너스 맞음', () => {
    const s = chapterStars(ch3, { done: allDone, reports: { 'ch3-c2': { direction: 'closer', edge: 'CN-US' } }, clues: [], bonus: { edge: 'CN-SU', correct: true } });
    expect(s).toEqual({ edges: true, reason: true, extra: true, total: 3 });   // 방향이 틀려도 별은 잃지 않는다
  });

  it('도움받아 걸린 실이 있으면 ①이 없고, 더 읽기 단서만으로도 ③', () => {
    const s = chapterStars(ch3, {
      done: { ...allDone, 'KR-NK': { wrong: 3, helped: true } },
      reports: { 'ch3-c2': { direction: 'farther', edge: 'KR-NK' } },
      clues: [{ docId: '3-1', clue: '핵실험' }],
      bonus: { edge: 'KR-NK', correct: false },
    });
    expect(s).toEqual({ edges: false, reason: false, extra: true, total: 1 });
  });

  it('등급: 끝낸 장만 센다(–는 뺀다)', () => {
    expect(grade({ ch3: 3, ch4: null })).toEqual({ grade: 'chief', got: 3, max: 3 });
    expect(grade({ ch1: 2, ch2: 1, ch3: null })).toEqual({ grade: 'regular', got: 3, max: 6 });
    expect(grade({ ch3: 1 })?.grade).toBe('apprentice');
    expect(grade({ ch3: null })).toBeNull();
  });

  it('도전 과제: 첫 시도에 모두 맞히면 perfect-board', () => {
    const first = Object.fromEntries(Object.keys(allDone).map((k) => [k, { wrong: 0, helped: false }]));
    expect(chapterAchievements(ch3, { done: first, reports: {}, clues: [], bonus: null })).toEqual(['perfect-board']);
    expect(chapterAchievements(ch3, { done: allDone, reports: {}, clues: [], bonus: null })).toEqual([]);
  });
});

describe('실 이력(장 데이터로 계산)', () => {
  it('3장 남한–북한: 시작은 대립, 실을 걸면 1972 대화가 붙는다', () => {
    expect(edgeHistory(chapters, 'ch3', 'KR-NK', {})).toEqual([{ year: null, rel: 'COLD', label: undefined, chapterTitle: '녹는 얼음' }]);
    expect(edgeHistory(chapters, 'ch3', 'KR-NK', { 'KR-NK': {} }).map((s) => [s.year, s.rel])).toEqual([[null, 'COLD'], [1972, 'TALK']]);
  });
});
