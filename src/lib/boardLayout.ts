// 보드 위 물건의 자리 계산: 실 곡선, 핀 이름표 상자, 실 이름표 자리. Board 화면과 테스트가 함께 쓴다.
import { layout } from './assets';
import { pairKey } from './board';
import { nodes } from './data';
import { placeLabels, type Box } from './labelLayout';
import { sagCurve, type Curve } from './stringPath';
import type { BoardEdge, LabelSide, NodeId } from '../types';

// 글자 폭 재기(무대 px). 화면에서는 canvas로 실제 글꼴을 재고, 테스트에서는 어림값을 쓴다.
export type Measure = (text: string, fontPx: number, bold: boolean) => number;

// Board.css와 같은 값. 바꾸면 함께 바꾼다.
export const PIN_FONT = 30;
export const EDGE_FONT = 28;
export const SWATCH_W = 36;
const BORDER = 1.5;
const PIN_TAG_PAD_X = 10;
const PIN_TAG_H = PIN_FONT * 1.2 + 2 * 2 + BORDER * 2;
const EDGE_TAG_EXTRA = BORDER * 2 + 4 + SWATCH_W + 6 + 8;   // 테두리, 왼쪽 여백, 견본, 간격, 오른쪽 여백
const EDGE_TAG_H = EDGE_FONT * 1.2 + 2 * 2 + BORDER * 2;
const LEGEND_TILT = 4;   // 범례 카드가 1° 기울어 생기는 여유

export function nodeAt(id: NodeId) {
  const node = nodes.nodes[id];
  if (!node) throw new Error(`nodes.json에 핀 ${id}가 없음`);
  return node;
}

export function edgeCurve(edge: BoardEdge): Curve {
  const [a, b] = edge.pair.map(nodeAt);
  return sagCurve(a, b);
}

// 핀 이름표를 핀의 어느 쪽에 달지(보드 중심의 반대쪽, nodes.json). tx, ty는 CSS translate 기준점.
export const PIN_GAP = nodes.pinSize / 2 + 6;
export const SIDE: Record<LabelSide, { dx: number; dy: number; tx: number; ty: number }> = {
  top: { dx: 0, dy: -1, tx: -0.5, ty: -1 },
  bottom: { dx: 0, dy: 1, tx: -0.5, ty: 0 },
  left: { dx: -1, dy: 0, tx: -1, ty: -0.5 },
  right: { dx: 1, dy: 0, tx: 0, ty: -0.5 },
  'top-left': { dx: -0.7, dy: -0.7, tx: -1, ty: -1 },
  'top-right': { dx: 0.7, dy: -0.7, tx: 0, ty: -1 },
  'bottom-left': { dx: -0.7, dy: 0.7, tx: -1, ty: 0 },
  'bottom-right': { dx: 0.7, dy: 0.7, tx: 0, ty: 0 },
};

export function pinTagAnchor(id: NodeId, labelSide: LabelSide = nodeAt(id).label) {
  const node = nodeAt(id);
  const side = SIDE[labelSide];
  return { x: node.x + side.dx * PIN_GAP, y: node.y + side.dy * PIN_GAP, tx: side.tx, ty: side.ty };
}

// 핀 이름과 이름표 방향. 장마다 덮어쓸 수 있다(프롤로그의 '38선 이남'). 없으면 nodes.json 값.
export interface PinStyle {
  text: (id: NodeId) => string;
  side: (id: NodeId) => LabelSide;
}
const DEFAULT_PINS: PinStyle = { text: (id) => nodeAt(id).name, side: (id) => nodeAt(id).label };

function pinTagBox(id: NodeId, measure: Measure, pins: PinStyle): Box {
  const a = pinTagAnchor(id, pins.side(id));
  const w = measure(pins.text(id), PIN_FONT, true) + PIN_TAG_PAD_X * 2 + BORDER * 2;
  return { x: a.x + a.tx * w, y: a.y + a.ty * PIN_TAG_H, w, h: PIN_TAG_H };
}

// 균열은 실 가운데, 직통선 매듭은 t = 0.3에 그린다(EdgeStroke). 이름표가 그 자리를 가리지 않게 한다.
function avoidRanges(edge: BoardEdge): [number, number][] {
  const ranges: [number, number][] = [];
  if (edge.fray) ranges.push([0.4, 0.6]);
  if (edge.mark === 'hotline') ranges.push([0.24, 0.36]);
  return ranges;
}

export function boardLayout(edges: BoardEdge[], measure: Measure, edgeText: (e: BoardEdge) => string, pins: PinStyle = DEFAULT_PINS) {
  const pinIds = [...new Set(edges.flatMap((e) => e.pair))];
  const half = nodes.pinSize / 2;
  const pinBoxes = pinIds.map((id) => {
    const n = nodeAt(id);
    return { x: n.x - half, y: n.y - half, w: nodes.pinSize, h: nodes.pinSize };
  });
  const pinTags = pinIds.map((id) => ({ id, box: pinTagBox(id, measure, pins) }));
  const legend = { x: layout.legend.x - LEGEND_TILT, y: layout.legend.y - LEGEND_TILT, w: layout.legend.w + LEGEND_TILT * 2, h: layout.legend.h + LEGEND_TILT * 2 };

  const puzzle = edges.filter((e) => !e.background);
  const labels = placeLabels(
    puzzle.map((e) => {
      const key = pairKey(e.pair);
      return {
        key,
        curve: edgeCurve(e),
        w: measure(edgeText(e), EDGE_FONT, false) + EDGE_TAG_EXTRA,
        h: EDGE_TAG_H,
        fixedT: nodes.edgeLabelT[key],
        avoid: avoidRanges(e),
      };
    }),
    [...pinBoxes, ...pinTags.map((p) => p.box), legend],
    layout.board.paper,
    edges.map((e) => ({ key: pairKey(e.pair), curve: edgeCurve(e), background: e.background })),
  );
  return { pinIds, pinTags, legend, labels };
}
