import type { GameState, Level } from '../engine';

/** Plain-language description of one board cell, read out by TalkBack / VoiceOver. */
export function describeCell(level: Level, st: GameState, i: number): string {
  const n = level.size;
  const pos = `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
  const c = level.cells[i];
  const bits: string[] = [];
  switch (c.kind) {
    case 'node': bits.push(`number ${c.n}`); break;
    case 'dead': return `${pos}, blocked`;
    case 'dir': bits.push(`arrow, you must leave ${({ u: 'up', d: 'down', l: 'left', r: 'right' } as const)[c.dir ?? 'r']}`); break;
    case 'burn': bits.push('burn cell, costs two moves'); break;
    case 'tele': bits.push(`portal ${c.pair}`); break;
    case 'freeze': bits.push('freeze cell, locks neighbours for three moves'); break;
    case 'switch': bits.push('switch, toggles gates'); break;
    case 'gate': bits.push('gate'); break;
    case 'bonus': bits.push('bonus star'); break;
    case 'count': bits.push(`countdown ${c.n}`); break;
    default: bits.push('empty');
  }
  if (st.head === i) bits.push('you are here');
  else if (st.used[i]) bits.push('already used');
  else if (c.kind === 'node' && c.n === st.nextNode) bits.push('next target');
  return `${pos}, ${bits.join(', ')}`;
}

export function progressLine(level: Level, st: GameState): string {
  const left = level.required.filter((i) => !st.used[i]).length;
  return `${left} cell${left === 1 ? '' : 's'} left. Next number ${Math.min(st.nextNode, level.nodeCount)}.`;
}
