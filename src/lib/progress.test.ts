import { describe, expect, it } from 'vitest';
import { chapterById, chapters } from './data';
import { edgeHistory } from './history';
import { deleteSlot, findSlot, MAX_AGE_MS, playerKey, prune, readSlots, saveSlot } from './save';
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

  it('반·번호·이름 세 칸을 반-번호-이름으로 묶고, 하나라도 비면 빈 값이다', () => {
    expect(playerKey('2', '12', ' 김민수 ')).toBe('2-12-김민수');
    expect(playerKey('', '12', '김민수')).toBe('');
    expect(playerKey('2', '', '김민수')).toBe('');
    expect(playerKey('2', '12', '  ')).toBe('');
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

  it('실을 한 번에 맞힐 때마다 별 하나(3장은 실 3개)', () => {
    const s = chapterStars(ch3, { done: { 'CN-SU': { wrong: 0 }, 'CN-US': { wrong: 1 }, 'KR-NK': { wrong: 0 }, 'SU-US': { wrong: 0, auto: true } } });
    expect(s.rows.map((r) => r.firstTry)).toEqual([true, false, true]);   // 저절로 바뀐 미국–소련은 세지 않는다
    expect(s.total).toBe(2);
    expect(chapterStars(ch3, { done: {} }).total).toBe(0);
  });

  it('등급: 끝낸 장만 센다(–는 뺀다)', () => {
    expect(grade({ ch3: 3, ch4: null })).toEqual({ grade: 'chief', got: 3, max: 3 });
    expect(grade({ ch1: 2, ch2: 1, ch3: null })).toEqual({ grade: 'regular', got: 3, max: 6 });
    expect(grade({ ch3: 1 })?.grade).toBe('apprentice');
    expect(grade({ ch3: null })).toBeNull();
  });

  it('도전 과제: 첫 시도에 모두 맞히면 perfect-board', () => {
    const first = { 'CN-SU': { wrong: 0 }, 'CN-US': { wrong: 0 }, 'KR-NK': { wrong: 0 } };
    expect(chapterAchievements(ch3, { done: first })).toEqual(['perfect-board']);
    expect(chapterAchievements(ch3, { done: { ...first, 'KR-NK': { wrong: 1 } } })).toEqual([]);
  });
});

describe('실 이력(장 데이터로 계산)', () => {
  it('3장 남한–북한: 1장 시작 대립 → 1950 전쟁 → (2장이 아직 없어) 3장 시작 대립, 실을 걸면 1972 대화', () => {
    const steps = (done: Record<string, unknown>) => edgeHistory(chapters, 'ch3', 'KR-NK', done).map((s) => [s.year, s.rel]);
    expect(steps({})).toEqual([[null, 'COLD'], [1950, 'WAR'], [null, 'COLD']]);
    expect(steps({ 'KR-NK': {} })).toEqual([[null, 'COLD'], [1950, 'WAR'], [null, 'COLD'], [1972, 'TALK']]);
  });
});
