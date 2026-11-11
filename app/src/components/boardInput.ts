/** Return the next stable cell under the finger with directional border hysteresis. */
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

  const prevCol = previous % n;
  const prevRow = Math.floor(previous / n);
  const threshold = cell * 0.12;

  // Directional border hysteresis: require a small penetration along the axis of movement
  if (col > prevCol && x < pad + col * cell + threshold) return previous;
  if (col < prevCol && x > pad + (col + 1) * cell - threshold) return previous;
  if (row > prevRow && y < pad + row * cell + threshold) return previous;
  if (row < prevRow && y > pad + (row + 1) * cell - threshold) return previous;

  return next;
}
