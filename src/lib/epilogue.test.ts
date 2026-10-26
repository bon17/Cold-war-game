import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useGame } from '../store/gameStore';
import { endBoard, pairKey } from './board';
import { clockText, minutesOf } from './clockFlow';
import { chapterById, chapters, pinName } from './data';
import { nextAction } from './guide';
import { edgeHistory } from './history';
import { chapterForCode } from './session';

// 에필로그 「남은 실」(2026-10-25 교사 결정): 문서 2개를 읽고 시계(1991년 17분 → 지금 85초)를 예측한다. 바꾸는 실은 없고,
// 남북 실은 흰 실 '지금은?'. 시계 뒤 80년의 창 → 서랍 속 편지 → 쓰기 화면 → 마지막 매듭 → 끝 화면.
const ep = chapterById('epilogue');
const game = () => useGame.getState();
const action = () => nextAction(ep, game());
const read = (doc: string) => {
  game().openDocument(doc);
  game().closeDocument();
};

describe('에필로그', () => {
  beforeEach(() => useGame.setState(initialState('epilogue')));

  it('5장 끝 보드에서 시작하고, 소련은 처음부터 러시아, 일력은 2026, 시계는 1991년 값 17분', () => {
    const sig = (b: typeof ep.startBoard) => Object.fromEntries(b.map((e) => [pairKey(e.pair), [e.rel, e.label ?? '', e.mark ?? ''].join('/')]));
    expect(sig(ep.startBoard)).toEqual(sig(endBoard(chapterById('ch5'))));
    expect(pinName(ep, 'SU', game())).toBe('러시아');
    expect(game().clockShown).toEqual({ minutes: 17, year: 2026 });
    expect(ep.edgeTasks).toEqual([]);
    expect(chapterForCode('바늘과실')).toBe('epilogue');
  });

  it("초록 실만 보고 '사이가 좋은데 왜 위험?'이 되지 않게: 보드는 '1992년 기록', 보고서 도움말, 큰 나라들 이야기", () => {
    expect(ep.epilogueBoard?.stamp).toBe('1992년 기록');
    expect(ep.clock[0].hint).toContain('1992년');
    expect(ep.documents.find((d) => d.id === 'E-2')?.keyPhrase).toContain('큰 나라들');
  });

  it('문서 2개를 읽으면 보고서. 공개 뒤 시계는 85초, 숫자판은 초로', () => {
    expect(action()).toEqual({ kind: 'doc', docId: 'E-1' });
    read('E-1');
    read('E-2');
    expect(action()).toEqual({ kind: 'report' });
    game().openReport();
    game().submitReport({ direction: 'closer' });
    game().advanceReveal();
    game().advanceReveal();
    game().advanceReveal();
    expect(game().clockShown).toEqual({ minutes: 85 / 60, year: 2026 });
    expect(clockText(game().clockShown.minutes)).toBe('자정까지 85초');
    expect(clockText(17)).toBe('자정까지 17분');
    expect(action()).toEqual({ kind: 'done' });
  });

  it('남북 실의 이력은 1991년 대화까지(쓰기 화면과 실 이력표가 같은 이력을 쓴다)', () => {
    const steps = edgeHistory(chapters, 'epilogue', 'KR-NK', {}).filter((h) => h.year !== null);
    expect(steps.map((h) => `${h.year} ${h.rel}`)).toEqual(['1948 COLD', '1950 WAR', '1953 COLD', '1972 TALK', '1973 COLD', '1991 TALK']);
    expect(ep.epilogueBoard).toMatchObject({ pair: ['KR', 'NK'], label: '지금은?' });
    expect(minutesOf(ep.startClock ?? {})).toBe(17);
  });

  it('80년의 창은 장마다 본 창밖 그림을 차례로 쓰고 휴전선 그림으로 끝난다. 모든 장의 창밖에 이어 주는 한 줄', () => {
    const frames = ep.finale!.montage.frames;
    for (const f of frames) expect(f.chapter ? !!chapterById(f.chapter).window.image : !!f.image).toBe(true);
    expect(frames[frames.length - 1].chapter).toBe('epilogue');
    for (const c of chapters.filter((c) => c.id !== 'epilogue')) expect(c.window.link, c.id).toBeTruthy();
  });

  it('1~5장 창밖에 그날의 당직 일지. 5장 일지의 선배(1945년부터)가 에필로그 편지를 쓴 사람', () => {
    for (const id of ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']) expect(chapterById(id).window.diary, id).toBeTruthy();
    expect(chapterById('ch5').window.diary).toContain('1945년');
    expect(ep.finale!.letter.signature).toContain('1945년');
  });
});
