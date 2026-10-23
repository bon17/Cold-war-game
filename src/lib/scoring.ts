// 별과 등급(기획서 5.6). 장마다 별 3개, 예측 방향이 틀려도 별을 잃지 않는다.
import { pairKey } from './board';
import type { Chapter } from '../types';

export interface ChapterProgress {
  done: Record<string, { wrong: number; helped: boolean; auto?: boolean }>;
  reports: Record<string, { direction: string; edge: string }>;
  clues: { docId: string; clue: string }[];
  bonus: { edge: string; correct: boolean } | null;
}

export interface Stars { edges: boolean; reason: boolean; extra: boolean; total: number }

export function chapterStars(chapter: Chapter, p: ChapterProgress): Stars {
  // ① 그 장의 직접 실을 모두 두 번 안에 맞힘(도움받아 걸리면 없음)
  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  const edges = direct.length > 0 && direct.every((t) => {
    const r = p.done[pairKey(t.pair)];
    return r && !r.helped && r.wrong <= 1;
  });
  // ② 시계 예측의 근거 실을 맞힘(예측 지점이 여럿이면 모두)
  const predicts = chapter.clock.filter((c) => c.mode === 'predict' && c.bestEdges && c.bestEdges.length > 0);
  const reason = predicts.length > 0 && predicts.every((c) => {
    const r = p.reports[c.id];
    return !!r && c.bestEdges!.some((pair) => pairKey(pair) === r.edge);
  });
  // ③ 더 읽기 문서의 단서를 하나 이상 모으거나 보너스 질문을 맞힘
  const extraDocs = new Set(chapter.documents.filter((d) => d.tier === 'extra').map((d) => d.id));
  const extra = p.clues.some((c) => extraDocs.has(c.docId)) || !!p.bonus?.correct;
  return { edges, reason, extra, total: [edges, reason, extra].filter(Boolean).length };
}

// 등급: 끝낸 장의 별 비율(끝내지 않은 장은 null이고 계산에서 뺀다)
export type Grade = 'apprentice' | 'regular' | 'chief';

export function grade(stars: Record<string, number | null>): { grade: Grade; got: number; max: number } | null {
  const finished = Object.values(stars).filter((n): n is number => n !== null);
  if (finished.length === 0) return null;
  const got = finished.reduce((a, b) => a + b, 0);
  const max = finished.length * 3;
  const ratio = got / max;
  return { grade: ratio >= 0.85 ? 'chief' : ratio >= 0.5 ? 'regular' : 'apprentice', got, max };
}

// 도전 과제(기획서 5.7) 가운데 한 장 안에서 정해지는 것
export function chapterAchievements(chapter: Chapter, p: ChapterProgress): string[] {
  const out: string[] = [];
  const direct = chapter.edgeTasks.filter((t) => t.mode === 'direct');
  if (direct.length > 0 && direct.every((t) => p.done[pairKey(t.pair)]?.wrong === 0)) out.push('perfect-board');
  const allClues = chapter.documents.flatMap((d) => d.clues.map((c) => `${d.id}:${c}`));
  const got = new Set(p.clues.map((c) => `${c.docId}:${c.clue}`));
  if (allClues.every((c) => got.has(c))) out.push('collector');
  return out;
}
