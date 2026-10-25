// 데이터 파일을 형식과 함께 불러온다. 화면의 한국어 글은 모두 여기서 온다(기획서 0장).
import ch1Data from '../data/chapters/ch1.json';
import ch2Data from '../data/chapters/ch2.json';
import ch3Data from '../data/chapters/ch3.json';
import ch4Data from '../data/chapters/ch4.json';
import ch5Data from '../data/chapters/ch5.json';
import prologueData from '../data/chapters/prologue.json';
import clockData from '../data/clock.json';
import glossaryData from '../data/glossary.json';
import nodesData from '../data/nodes.json';
import schoolData from '../data/school.json';
import stringsData from '../data/strings.ko.json';
import { docFinished, type DocState } from './board';
import type { Chapter, ClockEntry, LabelSide, NodeId, NodesData, Rel } from '../types';

// 이야기 순서. 아직 없는 장(에필로그)은 M3에서 채운다.
// 빈 배열(startBoard)과 null(실의 처음 상태)이 있으면 JSON 형식을 바로 Chapter로 바꿀 수 없어 unknown을 거친다.
// 형식이 맞는지는 data.test.ts의 validateData 검사가 본다.
export const chapters: Chapter[] = [
  prologueData as unknown as Chapter,
  ch1Data as unknown as Chapter,
  ch2Data as unknown as Chapter,
  ch3Data as Chapter,
  ch4Data as unknown as Chapter,
  ch5Data as unknown as Chapter,
];
export const clock = clockData as ClockEntry[];
export const glossary = glossaryData as Record<string, string>;
export const nodes = nodesData as NodesData;
// 시작 화면의 반·번호 고르기 범위(예: 1~5반, 1~32번). 학교에 맞게 숫자만 고친다.
export const school = schoolData as { classCount: number; numberCount: number };
export const strings = stringsData as typeof stringsData & { relations: Record<Rel, string> };

// 장의 이야기 순서. 데이터가 아직 없는 장도 들어 있다(앞뒤 장을 찾을 때 빈 장을 건너뛰지 않으려고).
export const STORY_ORDER = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'epilogue'] as const;

export function storyNeighbor(id: string, step: -1 | 1): string | undefined {
  const i = STORY_ORDER.indexOf(id as (typeof STORY_ORDER)[number]);
  return i < 0 ? undefined : STORY_ORDER[i + step];
}

// 바로 앞 장(이야기 순서). 그 장의 데이터가 아직 없으면 undefined(그러면 '앞 장 끝 = 이 장 시작' 검사를 건너뛴다)
export function previousChapter(chapter: Pick<Chapter, 'id'>): Chapter | undefined {
  const id = storyNeighbor(chapter.id, -1);
  return chapters.find((c) => c.id === id);
}

export function chapterById(id: string): Chapter {
  const chapter = chapters.find((c) => c.id === id);
  if (!chapter) throw new Error(`장 데이터가 없음: ${id}`);
  return chapter;
}

// 핀 이름 덮어쓰기를 지금 쓰는지. nodeLabelsUntil이 있으면 그 문서를 마칠 때까지만 쓴다(1장: 1948년 정부 수립 문서까지 '38선 이남').
// 진행 상태를 안 주면 장이 끝났을 때의 이름이다(보고서, 근무 평정표). asIfDone: 이 문서는 마친 것으로 친다(실 바꾸기 창의 질문)
function labelsOn(chapter: Chapter, s?: DocState, asIfDone?: string): boolean {
  const until = chapter.nodeLabelsUntil;
  if (!until) return true;
  return !!s && until !== asIfDone && !docFinished(chapter, until, s);
}

// 문서를 마친 뒤 바뀐 이름(5장 '러시아'). 진행 상태를 안 주면 장 끝이므로 바뀐 이름
function renamed(chapter: Chapter, id: NodeId, s?: DocState): string | undefined {
  const r = chapter.renameAfter;
  return r && (!s || docFinished(chapter, r.doc, s)) ? r.labels[id] : undefined;
}

// 이름이 바뀐 핀의 옛 이름(5장 '소련'). 보드 이름표 위에 줄을 그어 함께 보여 준다
export function oldPinName(chapter: Chapter, id: NodeId, s?: DocState): string | undefined {
  return renamed(chapter, id, s) ? nodes.nodes[id]?.name ?? id : undefined;
}

// 그 장에서 보이는 핀 이름(장마다 덮어쓸 수 있다. 프롤로그의 '38선 이남', '38선 이북', 5장 끝의 '러시아')
export function pinName(chapter: Chapter, id: NodeId, s?: DocState, asIfDone?: string): string {
  return renamed(chapter, id, s) ?? (labelsOn(chapter, s, asIfDone) ? chapter.nodeLabels?.[id] : undefined) ?? nodes.nodes[id]?.name ?? id;
}

// 그 장에서 핀 이름표를 다는 방향(이름이 길어져 실을 가리면 장마다 바꾼다). 덮어쓴 이름과 함께 바뀐다.
export function pinSide(chapter: Chapter, id: NodeId, s?: DocState): LabelSide {
  return (labelsOn(chapter, s) ? chapter.nodeSides?.[id] : undefined) ?? nodes.nodes[id]?.label ?? 'top';
}
