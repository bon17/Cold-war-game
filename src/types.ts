// 게임 데이터 형식. 기획서 docs/plan-v2.md 10.3을 그대로 옮겼다.
// 2026-10-23 쉬운 흐름(기획서 5.0): 문서 하나를 읽으면 실 하나를 바꾼다. 단서 쪽지, 인계 메모, 보너스 질문은 없앴다.
// 한 정보는 한 곳에만 둔다: 막 시작 코드는 각 장의 `code`, 시계 값·캡션·발표 전보 문구는 clock.json,
// 장 시작 보드는 각 장의 `startBoard`.

export type Rel = 'ALLY' | 'COLD' | 'WAR' | 'TALK' | 'NORMAL' | 'OCCUPY';
export type NodeId = 'KR' | 'NK' | 'US' | 'SU' | 'CN' | 'JP' | 'IN' | 'ID' | 'EG' | 'YU' | 'GH';
export type Pair = [NodeId, NodeId];

export interface Doc {
  id: string;
  type: 'telegram' | 'newspaper' | 'radio' | 'speech' | 'memo' | 'flash';
  year: number;
  yearLabel?: string;          // 예: '1950년 6~10월'
  title: string;
  body: string;                // 2~3문장, 100자 이하, 쉬운 말(해요체). 목록 줄은 제외
  keyPhrase: string;           // body 안에 그대로 있는 핵심 구절. 형광펜으로 보이고, 틀렸을 때 힌트로 다시 보여 준다
  listLine?: string[];         // 중립 구역 나라처럼 따로 보여 주는 목록 줄
  listLabel?: string;          // 목록 줄 앞의 말(2-5 '모인 나라 가운데')
  autoOpen?: boolean;          // 장 시작에 자동으로 열림(4-1)
  revealAfter?: string;        // 이 시계 지점 뒤에 도착(5-8)
  source?: string;             // 예: '교과서 222쪽 자료 1'
  outsideTextbook?: boolean;
}

export interface EdgeTask {
  pair: Pair;
  from: Rel | null;
  to: Rel;
  // direct: 그 문서를 읽고 나면 학생이 고른다 / auto: 그 문서를 열면 저절로 바뀐다 / reveal: 그 시계 지점을 공개할 때 저절로 바뀐다
  mode: 'direct' | 'auto' | 'reveal';
  year: number;                // 실 이력표에 쓰는 고정 연도
  doc?: string;                // direct, auto: 이 실과 짝인 문서
  point?: string;              // reveal: 이 실을 바꾸는 시계 지점
  options?: Rel[];             // direct: 보여 줄 실 종류 2개(정답 포함)
  label?: string;              // 이름표 덮어쓰기(예: 미국–소련 '협력', 중국–소련 '관계 정상화')
  explanation: string;         // 성공(또는 자동 적용) 시 한 줄 설명
  fray?: boolean;              // 색은 유지하고 균열 표시만(종류가 바뀌면 균열은 사라짐)
}

// 2장 '어느 편도 아닌 나라' 칸(중립 구역, 기획서 5.2. 2026-10-25 쉬운 흐름으로 다시 정함).
// 짝인 문서를 읽고 실처럼 둘 중 하나를 고른다. 맞히면 보드 왼쪽 위(layout.neutralZone)에 칸이 열리고 나라 이름이 들어간다.
export interface ZoneTask {
  doc: string;
  title: string;               // 칸 이름
  countries: string[];
  question: string;
  options: string[];           // 2개(정답 포함)
  answer: string;
  explanation: string;         // 맞혔을 때 한 줄 설명
}

// clock.json: 시계 데이터는 여기에만 둔다
export interface ClockEntry {
  year: number;
  minutes?: number;
  seconds?: number;            // 2026년 85초
  caption: string;             // 공개 경로 캡션(15자 안팎)
  bulletin: { headline: string; reason: string };  // 발표 전보(사실만, 교사 확인). 1947은 '처음 실린 표지' 설명
}

// 시계 카드가 가리키는 화면 물건(프롤로그 '천천히 읽는 시계 카드')
export type Spot = 'clock' | 'hand' | 'board';

export interface ClockCheckpoint {
  id: string;
  mode: 'show' | 'predict';
  year: number;                // clock.json의 year를 가리킴
  pathYears?: number[];        // 공개 때 거쳐 갈 clock.json의 year들(마지막이 year)
  direction?: 'closer' | 'farther';
  unlockAfterDocs?: string[];  // 열어야 하는 문서
  requireEdges?: Pair[];       // 마쳐야 하는 직접 실. 없으면 그 장의 모든 직접 실
  explanation: string;         // 해설 카드(건너뛸 수 없음)
  wrongNote?: string;          // 정정 보도 문구
  achievement?: string;
  annotateEdge?: { pair: Pair; mark: 'hotline' };  // 2장 직통선 매듭(끝까지 남음)
  // 나눠 읽는 시계 카드(2026-10-23 교사 결정, 프롤로그): 발표 이유(bulletin.reason)와 explanation을 줄('\n')마다 한 장씩
  // 큰 글씨로 보여 준다. spots[장]: 그 장에서 빛낼 화면 물건. 끝에 확인 질문 하나: 틀리면 hint를 보여 주고 다시 고른다.
  story?: { spots: Spot[][]; check: { question: string; answer: string; wrong: string; hint: string } };
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
  // 장 표지 다음 '할 일' 카드: lines는 이 장의 상황(1~2문장씩, 카드 맨 위). title, room, steps는 카드 제목,
  // '이 방에서 알아 둘 것', 할 일을 장마다 바꿀 때만 쓴다(프롤로그: 첫날, 시계가 아직 없음). 없으면 strings.mission의 공통 문구.
  mission: { lines: string[]; title?: string; room?: string[]; steps?: string[] };
  nodeLabels?: Partial<Record<NodeId, string>>;   // 핀 이름 덮어쓰기(프롤로그: 남한 → '38선 이남')
  nodeSides?: Partial<Record<NodeId, LabelSide>>; // 핀 이름표 방향 덮어쓰기(이름이 길어 실을 가릴 때)
  nodeLabelsUntil?: string;    // 이 문서를 마치면 덮어쓰기를 그만둔다(1장: 1948년 정부 수립 문서 → '남한', '북한')
  // 앞 장 끝 보드와 일부러 다르게 시작하는 실(1장: 1948년 남북 정부 수립으로 점령 실이 배경 실이 되고 대립 실이 걸림).
  // 여기 적은 쌍만 달라도 된다(validateData가 나머지는 앞 장 끝과 같은지 본다).
  startChanges?: { note: string; pairs: Pair[] };
  // untilDoc: 이 문서를 마치면 보드에서 내려가는 실(1장 점령 실 → 배경 실 '같은 편'으로 바뀜)
  startBoard: { pair: Pair; rel: Rel; fray?: boolean; mark?: 'hotline'; label?: string; untilDoc?: string }[];
  // appearAfterDoc: 이 문서를 마치면 나타나는 배경 실. note는 그때 '맞아요!' 창에 함께 보여 주는 한 줄
  backgroundEdges: { pair: Pair; rel: Rel; weakened?: boolean; appearAfterDoc?: string; note?: string }[];
  documents: Doc[];            // 배열 순서 = 도착 순서. 앞 문서의 실을 바꿔야 다음 문서가 온다(3개)
  edgeTasks: EdgeTask[];
  zone?: ZoneTask;
  clock: ClockCheckpoint[];    // 시계는 장마다 한 번
  endEvents?: ('renameSU' | 'weakenNKSU' | 'greenCascade')[];  // 5장 끝. greenCascade는 이미 녹색인 실을 다시 울리는 확인 연출
  epilogueBoard?: { pair: Pair; style: 'undyed'; label: string; caption: string };  // 에필로그 남북 실
  window: { image: string; caption: string; alt: string; crop?: { x: number; w: number } };
}

export interface SaveSlot {
  name: string;                // '반-번호-이름'. 앞뒤 공백 제거 후 비교
  updatedAt: number;           // 60일이 지나거나 40개를 넘으면 오래된 것부터 정리
  chapterId: string;           // 저장 지점(막 시작 코드로 들어가면 그 장으로 옮김)
  progress: unknown;           // 읽은 문서, 실, 시도 횟수, 보고서
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
  hotspots: Record<'docs' | 'report' | 'archive', Rect>;
  eraOverrides: Partial<Record<RoomId, { window?: WindowLayout }>>;
}

// nodes.json: 핀 이름, 무대 좌표, 이름표 위치(아트 계획서 4.5)
export type LabelSide = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface NodesData {
  pinSize: number;
  nodes: Partial<Record<NodeId, { name: string; x: number; y: number; label: LabelSide }>>;
  edgeLabelT: Record<string, number>;   // 실 이름표 위치(0.35~0.65). 키는 pairKey
}

// 보드에 지금 걸려 있는 실 하나
export interface BoardEdge {
  pair: Pair;
  rel: Rel;
  fray?: boolean;
  mark?: 'hotline';
  label?: string;
  background?: boolean;       // 배경 실: 퍼즐 대상이 아님, 흐리게, 누를 수 없음
  weakened?: boolean;
}
