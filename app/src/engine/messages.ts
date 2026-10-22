import { Dir, InvalidMove, MoveEvent } from './types';

const ARROW: Record<Dir, string> = { u: '↑', r: '→', d: '↓', l: '←' };

export function arrow(d: Dir): string {
  return ARROW[d];
}

/** Feedback-line text for invalid moves (copy from the design Copy sheet). */
export function invalidMessage(m: InvalidMove): string {
  switch (m.reason) {
    case 'finish':
      return 'Fill every open cell before the last number.';
    case 'dead':
      return 'That is a wall. Go around it.';
    case 'direction':
      return `Wrong direction. Exit must be ${ARROW[m.dir as Dir]}`;
    case 'burned':
      return 'That cell has burned out. Pick another.';
    case 'frozen':
      return `Frozen for ${m.remaining} more move${m.remaining === 1 ? '' : 's'}.`;
    case 'order':
      return `Not yet. Reach ${m.need} before ${(m.need as number) + 1}.`;
    case 'no-moves':
      return 'No moves left. Undo to try another route.';
    case 'expired':
      return 'The countdown cell ran out. Undo to retry.';
    case 'used':
      return 'Each cell can be used once.';
    case 'gate':
      return 'That gate is closed. Find the switch.';
    case 'portal':
      return 'The other portal is already on your path.';
    default:
      return '';
  }
}

export function eventMessage(e: MoveEvent, size: number): string {
  switch (e.type) {
    case 'node':
      return `Node ${e.n} reached.`;
    case 'burn':
      return 'Burn cell will be lost once you leave it.';
    case 'teleport':
      return `Teleport used. Exit opened at row ${Math.floor(e.to / size) + 1}, column ${(e.to % size) + 1}.`;
    case 'freeze':
      return `Frozen: ${e.around.length} neighbours locked for 3 moves.`;
    case 'switch':
      return e.on ? `Switch ON. ${e.gates.length} gate${e.gates.length === 1 ? '' : 's'} flipped.` : 'Switch OFF. Gates flipped back.';
    case 'bonus':
      return 'Bonus star collected.';
    case 'countdown-warning':
      return 'The countdown cell expires after your next move.';
  }
}

export function failTitle(reason: string, used: number, max: number): { title: string; body: string } {
  if (reason === 'countdown')
    return { title: 'The countdown ran out', body: 'The cell reached 0 before the path crossed it.' };
  if (reason === 'trapped')
    return { title: 'No valid move left', body: 'The head is boxed in by your own path and a wall.' };
  return { title: `${used} of ${max} moves used`, body: 'One node short. Your route was close.' };
}
