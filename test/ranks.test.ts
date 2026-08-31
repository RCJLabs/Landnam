// The line, and the one rule the whole mode rests on: it closes up.
//
// These are the claims the hex battlefield could not make, because on a plane
// there is no such thing as "the man in front". Everything here is checked
// against constructed lines rather than played battles — the point is the
// geometry of a wall, and a played fight would only make it harder to see
// which claim broke.

import { describe, expect, it } from 'vitest';
import {
  RANKS, REACH, atRank, canActFrom, closeUp, depth, engaged, linked,
  shift, standing, targetsFor, type Ranked,
} from '../src/sim/ranks';

/** A line of `n` on a side, ranked 1..n, all of them on their feet. */
function line(side: string, n: number): Ranked[] {
  return Array.from({ length: n }, (_, i) => ({ side, rank: i + 1, down: false, fled: false }));
}

/** Both walls, facing each other. */
function field(us = 4, them = 4): Ranked[] {
  return [...line('warband', us), ...line('foes', them)];
}

describe('the reach table', () => {
  it('lets somebody act from every rank a line can hold', () => {
    // PAST `RANKS`, deliberately. A warband is six sworn and a foe band can
    // be larger, so a real line runs deeper than the tables name — and when
    // this only checked as far as RANKS it missed exactly that: the fifth and
    // sixth men could not strike, throw or defend. They stood in the wall
    // with nothing they were allowed to do, and a played battle found it
    // rather than this did. It happened AGAIN in 9.1b, from the other
    // direction — taking the dash away put 19% of warband turns back into
    // having no legal verb — which is why `stepUp` exists.
    for (let r = 1; r <= RANKS + 4; r++) {
      const verbs = (Object.keys(REACH) as (keyof typeof REACH)[]).filter((v) => canActFrom(v, r));
      expect(verbs.length, `rank ${r} can do nothing at all`).toBeGreaterThan(0);
    }
  });

  it('gives every rank something to do that reaches an enemy', () => {
    // A rank you can stand in but never fight from is a hole in the design,
    // not a tactic — the back rank has to have the throw.
    for (let r = 1; r <= RANKS + 4; r++) {
      const offensive = (Object.keys(REACH) as (keyof typeof REACH)[])
        .filter((v) => canActFrom(v, r) && REACH[v].at.length > 0);
      expect(offensive.length, `rank ${r} can reach nobody`).toBeGreaterThan(0);
    }
  });

  it('keeps the heaviest blow to the front, and the longest reach to the back', () => {
    // The trade that makes standing anywhere a decision.
    expect(REACH.strike.from).toEqual([1, 2]);
    expect(REACH.throw.at.length).toBeGreaterThan(REACH.strike.at.length);
    expect(REACH.strike.from.length).toBeLessThan(REACH.throw.from.length);
  });

  it('names only real ranks, and says which verbs carry past them', () => {
    for (const v of Object.keys(REACH) as (keyof typeof REACH)[]) {
      for (const r of [...REACH[v].from, ...REACH[v].at]) {
        expect(r, `${v} refers to rank ${r}`).toBeGreaterThanOrEqual(1);
        expect(r, `${v} refers to rank ${r}`).toBeLessThanOrEqual(RANKS);
      }
    }
    // An axe and a spear have a length and stop where the list stops. A
    // thrown axe does not. (`dash` was the fourth line here and is gone with
    // the verb — what keeps a deep man from being stuck is now `stepUp`,
    // which is tested in battleActions.test.ts because it needs a battle.)
    expect(canActFrom('strike', RANKS + 2), 'an axe grew longer').toBe(false);
    expect(canActFrom('reach', RANKS + 2), 'a spear grew longer').toBe(false);
    expect(canActFrom('throw', RANKS + 2), 'the back rank cannot throw').toBe(true);
  });
});

describe('who a verb can touch', () => {
  it('offers nobody when the actor is standing too far back for it', () => {
    const f = field();
    const back = atRank(f, 'warband', 4)!;
    expect(targetsFor(f, back, 'strike', 'foes')).toEqual([]);
    expect(targetsFor(f, back, 'throw', 'foes').length).toBe(4);
  });

  it('reaches the third rank with a spear and no further', () => {
    const f = field();
    const second = atRank(f, 'warband', 2)!;
    const hit = targetsFor(f, second, 'reach', 'foes').map((c) => c.rank).sort();
    expect(hit).toEqual([1, 2, 3]);
  });

  it('never offers somebody who is already down or has run', () => {
    const f = field();
    atRank(f, 'foes', 1)!.down = true;
    atRank(f, 'foes', 2)!.fled = true;
    const front = atRank(f, 'warband', 1)!;
    expect(targetsFor(f, front, 'strike', 'foes')).toEqual([]);
  });

  it('offers nobody for a verb done to yourself', () => {
    const f = field();
    const front = atRank(f, 'warband', 1)!;
    expect(targetsFor(f, front, 'defend', 'foes')).toEqual([]);
  });
});

describe('the line closes up', () => {
  it('puts the man behind in front when the front man goes down', () => {
    const f = field();
    const front = atRank(f, 'warband', 1)!;
    front.down = true;
    closeUp(f, 'warband');
    expect(depth(f, 'warband')).toBe(3);
    expect(standing(f, 'warband').map((c) => c.rank).sort()).toEqual([1, 2, 3]);
  });

  it('leaves no gap wherever in the line the man falls', () => {
    for (const lost of [1, 2, 3, 4]) {
      const f = field();
      atRank(f, 'warband', lost)!.down = true;
      closeUp(f, 'warband');
      expect(standing(f, 'warband').map((c) => c.rank).sort(), `lost rank ${lost}`)
        .toEqual([1, 2, 3]);
    }
  });

  it('keeps the order of whoever is left — it closes up, it does not reshuffle', () => {
    const f = field();
    const marked = standing(f, 'warband').map((c, i) => Object.assign(c, { id: i }));
    marked[1]!.down = true;
    closeUp(f, 'warband');
    const after = standing(f, 'warband').sort((a, b) => a.rank - b.rank) as typeof marked;
    expect(after.map((c) => c.id)).toEqual([0, 2, 3]);
  });

  it('changes nothing on a line that has lost nobody', () => {
    const f = field();
    const before = standing(f, 'warband').map((c) => c.rank);
    closeUp(f, 'warband');
    expect(standing(f, 'warband').map((c) => c.rank)).toEqual(before);
  });

  it('is idempotent — closing twice is closing once', () => {
    const f = field();
    atRank(f, 'warband', 2)!.down = true;
    closeUp(f, 'warband');
    const once = standing(f, 'warband').map((c) => c.rank);
    closeUp(f, 'warband');
    expect(standing(f, 'warband').map((c) => c.rank)).toEqual(once);
  });

  it('never touches the other wall', () => {
    const f = field();
    atRank(f, 'warband', 1)!.down = true;
    closeUp(f, 'warband');
    expect(standing(f, 'foes').map((c) => c.rank).sort()).toEqual([1, 2, 3, 4]);
  });
});

// `describe('a shove')` stood here, over `shoveBack` — a man driven back a
// rank with the one behind him coming forward, nobody moved when he was the
// last of his line, and a corpse never swapped with. All three were true.
// 9.1b took the verb and the helper with it: `REACH.shove` was the same reach
// as `strike`, so a shove was never a different option positionally, and the
// arena priced it at 47/60 wins against 47/60 for never shoving.

describe('shifting rank', () => {
  // This was `a dash changes rank`. The verb is gone (9.1b) and `shift` is
  // not: it is how the line closes itself on a man with nothing left to do.
  // The claims are unchanged because the movement is unchanged.
  it('swaps forward with whoever is in front', () => {
    const f = field();
    const third = atRank(f, 'warband', 3)!;
    const second = atRank(f, 'warband', 2)!;
    expect(shift(f, third, -1)).toBe(true);
    expect(third.rank).toBe(2);
    expect(second.rank).toBe(3);
  });

  it('will not step off the front of the wall', () => {
    const f = field();
    const front = atRank(f, 'warband', 1)!;
    expect(shift(f, front, -1)).toBe(false);
    expect(front.rank).toBe(1);
  });

  it('will not step off the back into open ground', () => {
    const f = field(2, 4);
    const back = atRank(f, 'warband', 2)!;
    expect(shift(f, back, 1)).toBe(false);
    expect(back.rank).toBe(2);
  });

  it('walks a man out of a rank his weapon is no use in', () => {
    // The whole reason the MOVEMENT survives 9.1b even though the verb did
    // not: it is the answer to standing somewhere you cannot fight from. The
    // fixture used to arrange that with a shove; a fourth-rank man says the
    // same thing without one.
    const f = field();
    const deep = atRank(f, 'warband', 4)!;
    expect(canActFrom('reach', deep.rank), 'the fixture put him in reach').toBe(false);
    expect(shift(f, deep, -1)).toBe(true);
    expect(deep.rank).toBe(3);
    expect(canActFrom('reach', deep.rank)).toBe(true);
  });
});

describe('the wall', () => {
  it('links a man to the one in front and the one behind, and nobody else', () => {
    const f = field();
    const a = atRank(f, 'warband', 2)!;
    expect(linked(a, atRank(f, 'warband', 1)!)).toBe(true);
    expect(linked(a, atRank(f, 'warband', 3)!)).toBe(true);
    expect(linked(a, atRank(f, 'warband', 4)!)).toBe(false);
  });

  it('never links across the two walls', () => {
    const f = field();
    expect(linked(atRank(f, 'warband', 1)!, atRank(f, 'foes', 1)!)).toBe(false);
  });

  it('breaks when the link falls', () => {
    const f = field();
    const a = atRank(f, 'warband', 1)!;
    const b = atRank(f, 'warband', 2)!;
    expect(linked(a, b)).toBe(true);
    b.down = true;
    expect(linked(a, b)).toBe(false);
  });
});

describe('who is engaged', () => {
  it('is the front two of each wall, and nobody standing behind them', () => {
    const f = field();
    expect(engaged(f, atRank(f, 'warband', 1)!, 'foes').map((c) => c.rank).sort()).toEqual([1, 2]);
    expect(engaged(f, atRank(f, 'warband', 3)!, 'foes')).toEqual([]);
  });
});
