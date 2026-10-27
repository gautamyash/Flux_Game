import { stableCellAt } from '../src/components/boardInput';

describe('board drag cell gate', () => {
  const pad = 10;
  const cell = 100;
  const n = 8;
  const center = (index: number) => ({ x: pad + (index % n + 0.5) * cell, y: pad + (Math.floor(index / n) + 0.5) * cell });

  test('keeps the current cell through the edge dead zone and accepts the new cell deeper inside', () => {
    expect(stableCellAt(111, 60, pad, cell, n, 0)).toBe(0);
    expect(stableCellAt(123, 60, pad, cell, n, 0)).toBe(1);
  });

  test('skips duplicate cells and preserves a fast multi-cell destination for JS path interpolation', () => {
    const c0 = center(0);
    const c3 = center(3);
    expect(stableCellAt(c0.x, c0.y, pad, cell, n, 0)).toBe(0);
    expect(stableCellAt(c3.x, c3.y, pad, cell, n, 0)).toBe(3);
  });

  test('board edges do not invent a cell or lose the previous in-board cell', () => {
    expect(stableCellAt(pad - 1, 60, pad, cell, n, -1)).toBe(-1);
    expect(stableCellAt(pad - 1, 60, pad, cell, n, 0)).toBe(0);
    expect(stableCellAt(pad + n * cell, 60, pad, cell, n, 0)).toBe(0);
  });

  test('works across the far edge of an 8 by 8 board', () => {
    const last = center(63);
    expect(stableCellAt(last.x, last.y, pad, cell, n, -1)).toBe(63);
  });
});
