// 데이터 파일을 형식과 함께 불러온다. 화면의 한국어 글은 모두 여기서 온다(기획서 0장).
import ch3Data from '../data/chapters/ch3.json';
import clockData from '../data/clock.json';
import glossaryData from '../data/glossary.json';
import nodesData from '../data/nodes.json';
import schoolData from '../data/school.json';
import stringsData from '../data/strings.ko.json';
import type { Chapter, ClockEntry, NodesData, Rel } from '../types';

export const chapters: Chapter[] = [ch3Data as Chapter];
export const clock = clockData as ClockEntry[];
export const glossary = glossaryData as Record<string, string>;
export const nodes = nodesData as NodesData;
// 시작 화면의 반·번호 고르기 범위(예: 1~5반, 1~32번). 학교에 맞게 숫자만 고친다.
export const school = schoolData as { classCount: number; numberCount: number };
export const strings = stringsData as typeof stringsData & { relations: Record<Rel, string> };

export function chapterById(id: string): Chapter {
  const chapter = chapters.find((c) => c.id === id);
  if (!chapter) throw new Error(`장 데이터가 없음: ${id}`);
  return chapter;
}
