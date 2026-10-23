// 데이터 파일을 형식과 함께 불러온다. 화면의 한국어 글은 모두 여기서 온다(기획서 0장).
import ch3Data from '../data/chapters/ch3.json';
import prologueData from '../data/chapters/prologue.json';
import clockData from '../data/clock.json';
import glossaryData from '../data/glossary.json';
import nodesData from '../data/nodes.json';
import schoolData from '../data/school.json';
import stringsData from '../data/strings.ko.json';
import type { Chapter, ClockEntry, LabelSide, NodeId, NodesData, Rel } from '../types';

// 이야기 순서. 아직 없는 장(1·2·4·5장, 에필로그)은 M3에서 채운다.
// 프롤로그는 빈 배열(startBoard)과 null(실의 처음 상태) 때문에 JSON 형식을 바로 Chapter로 바꿀 수 없어 unknown을 거친다.
// 형식이 맞는지는 data.test.ts의 validateData 검사가 본다.
export const chapters: Chapter[] = [prologueData as unknown as Chapter, ch3Data as Chapter];
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

// 그 장에서 보이는 핀 이름(장마다 덮어쓸 수 있다. 프롤로그의 '38선 이남', '38선 이북')
export function pinName(chapter: Pick<Chapter, 'nodeLabels'>, id: NodeId): string {
  return chapter.nodeLabels?.[id] ?? nodes.nodes[id]?.name ?? id;
}

// 그 장에서 핀 이름표를 다는 방향(이름이 길어져 실을 가리면 장마다 바꾼다)
export function pinSide(chapter: Pick<Chapter, 'nodeSides'>, id: NodeId): LabelSide {
  return chapter.nodeSides?.[id] ?? nodes.nodes[id]?.label ?? 'top';
}
