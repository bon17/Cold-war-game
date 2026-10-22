// 3:2 무대를 화면에 맞춰 줄이거나 늘리고 가운데에 둔다(기획서 8.4, 아트 계획서 4.6).
export interface StageFit {
  scale: number;
  x: number;  // 화면 왼쪽에서 무대 왼쪽 끝까지(실제 px)
  y: number;  // 화면 위에서 무대 위 끝까지(실제 px)
}

export function fitStage(viewW: number, viewH: number, stageW: number, stageH: number): StageFit {
  const scale = Math.min(viewW / stageW, viewH / stageH);
  return {
    scale,
    x: (viewW - stageW * scale) / 2,
    y: (viewH - stageH * scale) / 2,
  };
}

// 무대 좌표를 실제 화면 좌표로 바꾼다. 무대 밖 오버레이(실제 px 글자)를 무대 물건 옆에 놓을 때 쓴다.
export function stageToScreen(fit: StageFit, sx: number, sy: number): { x: number; y: number } {
  return { x: fit.x + sx * fit.scale, y: fit.y + sy * fit.scale };
}
