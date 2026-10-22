import {
  applyMove,
  createSession,
  createState,
  current,
  legalMoves,
  parseLevel,
  retractTarget,
  sessionMove,
  sessionUndo,
  solve,
  starsFor,
  parSeconds,
  validateMove,
} from '../src/engine';
import type { LevelDef } from '../src/engine';

const mk = (rows: string[], maxMoves = 30, optimal = 0): ReturnType<typeof parseLevel> =>
  parseLevel({ id: 't', chapter: 1, index: 1, size: rows[0].trim().split(/\s+/).length, rows, maxMoves, optimal } as LevelDef);

const go = (level: ReturnType<typeof mk>, cells: number[]) => {
  let st = createState(level);
  for (const c of cells) {
    const r = applyMove(level, st, c);
    if (!r.ok) throw new Error(`move to ${c} invalid: ${r.reason}`);
    st = r.state;
  }
  return st;
};

describe('basics', () => {
  const lv = mk(['1 . 2', '. . .', '. . 3']);
  it('solves a simple level', () => {
    // snake through every cell, ending on node 3
    const st = go(lv, [1, 2, 5, 4, 3, 6, 7, 8]);
    expect(st.status).toBe('solved');
    expect(st.moves).toBe(8);
  });
  it('cannot finish before every open cell is filled', () => {
    const st = go(lv, [1, 2, 5]);
    expect(validateMove(lv, st, 8)?.reason).toBe('finish');
  });
  it('bonus stars and walls are not required', () => {
    const l = mk(['1 * 2', '# # #', '# # #']);
    expect(l.required).toEqual([0, 1, 2].filter((i) => i !== 1));
  });
  it('rejects nodes out of order', () => {
    const lv2 = mk(['1 3 .', '. . .', '. 2 .']);
    const r = validateMove(lv2, createState(lv2), 1);
    expect(r?.reason).toBe('order');
    expect(r?.need).toBe(2);
  });
  it('rejects revisits and non-adjacent', () => {
    const st = go(lv, [1]);
    expect(validateMove(lv, st, 0)?.reason).toBe('used');
    expect(validateMove(lv, st, 8)?.reason).toBe('not-adjacent');
  });
  it('walls block', () => {
    const l = mk(['1 # 2','# # #','# # #']);
    expect(validateMove(l, createState(l), 1)?.reason).toBe('dead');
  });
});

describe('direction', () => {
  const l = mk(['1 > .', '. . .', '. . 2']);
  it('forces the exit', () => {
    const st = go(l, [1]);
    expect(validateMove(l, st, 4)?.reason).toBe('direction');
    expect(validateMove(l, st, 2)).toBeNull();
  });
});

describe('burn', () => {
  it('costs two moves', () => {
    const l = mk(['1 B 2','# # #','# # #']);
    const st = go(l, [1, 2]);
    expect(st.moves).toBe(3);
    expect(st.status).toBe('solved');
  });
  it('can exceed the budget', () => {
    const l = mk(['1 B 2','# # #','# # #'], 1);
    expect(validateMove(l, createState(l), 1)?.reason).toBe('no-moves');
  });
});

describe('teleport', () => {
  const l = mk(['1 T1 # # 2', '. . . . .', '. . . . T1', '# # # # #', '# # # # #']);
  it('jumps to partner for free', () => {
    const st = go(l, [1]);
    expect(st.head).toBe(14);
    expect(st.moves).toBe(1);
    expect(st.path).toEqual([0, 1, 14]);
  });
  it('can be solved through the portal', () => {
    // exit at 14, go up to 9 then up to 4 (node 2)
    const l2 = mk(['1 T1 # # 2', '# # # # .', '# # # # T1', '# # # # #', '# # # # #']);
    const st = go(l2, [1, 9, 4]);
    expect(st.status).toBe('solved');
  });
});

describe('freeze', () => {
  // freeze at index 1; after exit step, neighbours locked for 3 moves
  const l = mk(['1 F . . 2', '. . . . .', '. . . . .', '. . . . .', '. . . . .']);
  it('locks the 3x3 area after the exit step', () => {
    const st = go(l, [1, 2]); // cross F then step right
    // moving down from 2 enters index 7 which is a neighbour of F? F=1: neighbours 0,2,5,6,7 -> 7 locked
    expect(validateMove(l, st, 7)?.reason).toBe('frozen');
    expect(validateMove(l, st, 3)).toBeNull();
  });
});

describe('switch and gate', () => {
  const l = mk(['1 S G 2','# # # #','# # # #','# # # #']);
  it('gate is closed until switch is crossed', () => {
    const st = go(l, [1]);
    expect(validateMove(l, st, 2)).toBeNull();
  });
  it('closed gate blocks without switch', () => {
    const l2 = mk(['1 . G 2','. . . .','# # # #','# # # #']);
    const st = go(l2, [1]);
    expect(validateMove(l2, st, 2)?.reason).toBe('gate');
  });
});

describe('countdown', () => {
  it('fails if it expires unentered', () => {
    const l = mk(['1 . . . 2', 'c2 . . . .', '# # # # #', '# # # # #', '# # # # #']);
    let st = createState(l);
    st = (applyMove(l, st, 1) as any).state;
    const r = applyMove(l, st, 2) as any;
    expect(r.state.status).toBe('failed');
    expect(r.state.fail).toBe('countdown');
  });
  it('is safe when entered in time', () => {
    const l = mk(['1 c2 . 2','# # # #','# # # #','# # # #']);
    const st = go(l, [1, 2, 3]);
    expect(st.status).toBe('solved');
  });
});

describe('session', () => {
  it('undoes and tracks retract target', () => {
    const l = mk(['1 . 2','# # #','# # #']);
    let s = createSession(l);
    s = sessionMove(s, 1).session;
    expect(retractTarget(s)).toBe(0);
    s = sessionUndo(s);
    expect(current(s).path).toEqual([0]);
  });
  it('trapped is detected', () => {
    const l = mk(['1 . #', '# # #', '# # 2']);
    const r = applyMove(l, createState(l), 1) as any;
    expect(r.ok).toBe(true);
    expect(r.state.status).toBe('failed');
    expect(r.state.fail).toBe('trapped');
  });
  it('legalMoves excludes walls', () => {
    const l = mk(['1 . 2', '# . .', '. . .']);
    expect(legalMoves(l, createState(l))).toEqual([1]);
  });
});

describe('solver', () => {
  it('finds optimal on an open board', () => {
    const l = mk(['1 . .', '. . .', '. . 2'], 20);
    const r = solve(l);
    expect(r.status).toBe('solved');
    expect(r.cost).toBe(8);
  });
  it('uses portals when shorter', () => {
    const l = mk(['1 T1 # # # # 2', '# # # # # # T1', '# # # # # # #', '# # # # # # #', '# # # # # # #', '# # # # # # #', '# # # # # # #'], 20);
    const r = solve(l);
    expect(r.status).toBe('solved');
    expect(r.cost).toBe(2);
  });
  it('detects unsolvable', () => {
    const l = mk(['1 # 2', '# # #', '# # #']);
    expect(solve(l).status).toBe('unsolvable');
  });
  it('stars follow optimal', () => {
    const l = mk(['1 . 2','# # #','# # #'], 10, 2);
    expect(starsFor(l, 2)).toBe(3);
    expect(starsFor(l, 4)).toBe(2);
    expect(starsFor(l, 9)).toBe(1);
    // time and hints also count
    const par = parSeconds(l);
    expect(starsFor(l, 2, par, 0)).toBe(3);
    expect(starsFor(l, 2, Math.ceil(par * 1.5), 0)).toBe(2);
    expect(starsFor(l, 2, par * 3, 0)).toBe(1);
    expect(starsFor(l, 2, par, 1)).toBe(2);
    expect(starsFor(l, 2, par, 3)).toBe(1);
  });
});
