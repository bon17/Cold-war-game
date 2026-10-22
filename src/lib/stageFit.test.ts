import { describe, expect, it } from 'vitest';
import { fitStage, stageToScreen } from './stageFit';

describe('fitStage', () => {
  it('1366×650 크롬북(주소창 제외)에서는 세로에 맞춰 약 0.63배가 되고 좌우에 띠가 생긴다', () => {
    const fit = fitStage(1366, 650, 1536, 1024);
    expect(fit.scale).toBeCloseTo(650 / 1024, 5);
    expect(fit.y).toBe(0);
    expect(fit.x).toBeCloseTo((1366 - 1536 * fit.scale) / 2, 5);
  });

  it('세로가 긴 화면에서는 가로에 맞추고 위아래에 띠가 생긴다', () => {
    const fit = fitStage(1024, 1366, 1536, 1024);
    expect(fit.scale).toBeCloseTo(1024 / 1536, 5);
    expect(fit.x).toBe(0);
    expect(fit.y).toBeGreaterThan(0);
  });

  it('3:2 화면에서는 띠 없이 꽉 찬다', () => {
    const fit = fitStage(1536, 1024, 1536, 1024);
    expect(fit).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe('stageToScreen', () => {
  it('무대 좌표에 배율을 곱하고 띠만큼 옮긴다', () => {
    const fit = { scale: 0.5, x: 100, y: 20 };
    expect(stageToScreen(fit, 200, 40)).toEqual({ x: 200, y: 40 });
  });
});
