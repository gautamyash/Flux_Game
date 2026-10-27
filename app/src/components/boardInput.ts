/** Return the next stable cell under the finger, preserving the board's existing inner-cell dead zone. */
export function stableCellAt(
  x: number,
  y: number,
  pad: number,
  cell: number,
  n: number,
  previous: number,
): number {
  'worklet';
  const col = Math.floor((x - pad) / cell);
  const row = Math.floor((y - pad) / cell);
  if (col < 0 || row < 0 || col >= n || row >= n) return previous;
  const next = row * n + col;
  if (next === previous || previous < 0) return next;
  const centerX = pad + (col + 0.5) * cell;
  const centerY = pad + (row + 0.5) * cell;
  const margin = cell * 0.38;
  return Math.abs(x - centerX) <= margin && Math.abs(y - centerY) <= margin ? next : previous;
}
