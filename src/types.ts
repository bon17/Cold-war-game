// 게임 데이터 형식. 기획서 docs/plan-v2.md 10.3을 그대로 옮겼다.
// 한 정보는 한 곳에만 둔다: 막 시작 코드는 각 장의 `code`, 시계 값·캡션·발표 전보 문구는 clock.json,
// 장 시작 보드는 각 장의 `startBoard`.

export type Rel = 'ALLY' | 'COLD' | 'WAR' | 'TALK' | 'NORMAL' | 'OCCUPY';
export type NodeId = 'KR' | 'NK' | 'US' | 'SU' | 'CN' | 'JP' | 'IN' | 'ID' | 'EG' | 'YU' | 'GH';
export type Pair = [NodeId, NodeId];

export interface Doc {
  id: string;
  type: 'telegram' | 'newspaper' | 'radio' | 'speech' | 'memo' | 'flash';
  tier: 'core' | 'extra';      // 핵심(열면 읽음) / 더 읽기(단서를 칠해야 별 ③)
  year: number;
  yearLabel?: string;          // 예: '1950년 6~10월'
  title: string;
  body: string;                // 2~4문장, 약 120자(통합 문서 160자) 이하. 목록 줄은 제외
  listLine?: string[];         // 중립 구역 나라처럼 따로 보여 주는 목록 줄
  clues: string[];             // body 안에 그대로 들어 있어야 하는 구절
  autoOpen?: boolean;          // 장 시작에 자동으로 열림(4-1)
  revealAfter?: string;        // 이 시계 지점 뒤에 도착(5-8)
  source?: string;             // 예: '교과서 222쪽 자료 1'
  outsideTextbook?: boolean;
}

export interface EdgeTask {
  pair: Pair;
  from: Rel | null;
  to: Rel;
  mode: 'direct' | 'auto';
  year: number;                // 실 이력표에 쓰는 고정 연도
  evidence: string[];          // direct: 정답으로 인정하는 단서 / auto: 트리거 단서
  options?: Rel[];             // direct: 보여 줄 실 종류 3개(정답 포함)
  label?: string;              // 이름표 덮어쓰기(예: 미국–소련 '협력', 중국–소련 '관계 정상화')
  explanation: string;         // 성공(또는 자동 적용) 시 한 줄 설명
  fray?: boolean;              // 색은 유지하고 균열 표시만(종류가 바뀌면 균열은 사라짐)
}

export interface NeutralTask { node: NodeId; evidence: string[]; }

// clock.json: 시계 데이터는 여기에만 둔다
export interface ClockEntry {
  year: number;
  minutes?: number;
  seconds?: number;            // 2026년 85초
  caption: string;             // 공개 경로 캡션(15자 안팎)
  bulletin: { headline: string; reason: string };  // 발표 전보(사실만, 교사 확인). 1947은 '처음 실린 표지' 설명
}

export interface ClockCheckpoint {
  id: string;
  mode: 'show' | 'predict';
  year: number;                // clock.json의 year를 가리킴
  pathYears?: number[];        // 공개 때 거쳐 갈 clock.json의 year들(마지막이 year)
  direction?: 'closer' | 'farther';
  bestEdges?: Pair[];          // 별 ②의 정답. 비어 있으면 근거 실 단계 생략
  edgeNotes?: { pair: Pair; note: string }[];      // 특정 실을 골랐을 때 덧붙이는 한 줄
  unlockAfterDocs?: string[];  // 열어야 하는 핵심 문서
  requireEdges?: Pair[];       // 마쳐야 하는 직접 실. 없으면 그 장의 모든 직접 실과 중립 구역
  explanation: string;         // 해설 카드(건너뛸 수 없음)
  wrongNote?: string;          // 정정 보도 문구
  achievement?: string;
  annotateEdge?: { pair: Pair; mark: 'hotline' };  // 2장 직통선 매듭(끝까지 남음)
}

export type RoomId = 'room-1950s' | 'room-1970s' | 'room-1980s' | 'room-now';

export interface Chapter {
  id: string;
  session: 1 | 2;
  title: string;
  period: string;
  code: string;                // 막 시작 코드(한글 4글자). 다른 곳에 두지 않는다
  room: RoomId;
  cover: { image: string; alt: string; question: string };
  startClock: { minutes?: number; seconds?: number } | null;  // 프롤로그는 null(아직 걸리지 않음)
  startNote?: { text: string; signature: string };            // 장 시작 쪽지(2장)
  handover?: {                 // 2차시 시작 인계 메모(3장)
    lines: string[]; blankPair: Pair; answer: Rel; options: Rel[]; signature: string;
  };
  nodeLabels?: Partial<Record<NodeId, string>>;
  startBoard: { pair: Pair; rel: Rel; fray?: boolean; mark?: 'hotline'; label?: string }[];
  backgroundEdges: { pair: Pair; rel: Rel; weakened?: boolean; appearAfterDoc?: string; note?: string }[];
  documents: Doc[];            // 배열 순서 = 도착 순서
  edgeTasks: EdgeTask[];
  neutralTasks?: NeutralTask[];
  clock: ClockCheckpoint[];
  quickQuestion?: { prompt: string; options: string[]; answer: number; after: string };
  bonusQuestion?: { prompt: string; answer: Pair; achievement?: string };
  endEvents?: ('renameSU' | 'weakenNKSU' | 'greenCascade')[];  // 5장 끝. greenCascade는 이미 녹색인 실을 다시 울리는 확인 연출
  epilogueBoard?: { pair: Pair; style: 'undyed'; label: string; caption: string };  // 에필로그 남북 실
  window: { image: string; caption: string; alt: string; crop?: { x: number; w: number } };
}

export interface SaveSlot {
  name: string;                // '반-번호-이름'. 앞뒤 공백 제거 후 비교
  updatedAt: number;           // 60일이 지나거나 40개를 넘으면 오래된 것부터 정리
  chapterId: string;           // 저장 지점(막 시작 코드로 들어가면 그 장으로 옮김)
  progress: unknown;           // 읽은 문서, 단서, 실, 시도 횟수, 보고서
  stars: Record<string, number | null>;   // null = '–'(끝내지 않음, 등급 계산에서 제외)
  achievements: string[];
  archive: unknown[];          // 틀린 판단 기록
}

// layout.json: 무대 좌표(docs/art-direction.md 4.4). 모든 숫자는 무대 px.
export interface Rect { x: number; y: number; w: number; h: number; }

export interface WindowLayout extends Rect { src: string; pane: Rect; }

export interface Layout {
  stage: { w: number; h: number };
  deskTopY: number;
  board: Rect & { src: string; paper: Rect };
  neutralZone: Rect;
  legend: Rect;
  clock: { src: string; cx: number; cy: number; r: number; faceR: number;
           nail: { x: number; y: number }; plaque: Rect };
  window: WindowLayout;
  calendar: Rect;
  lamp: Rect & { src: string; pool: { cx: number; cy: number; rx: number; ry: number } };
  eraProps: Rect;
  hotspots: Record<'docs' | 'clues' | 'report' | 'archive', Rect>;
  eraOverrides: Partial<Record<RoomId, { window?: WindowLayout }>>;
}
