import { describe, it, expect } from 'vitest';
import {
  DIRECTIONS,
  axialToOffset,
  column,
  distance,
  directionTo,
  equals,
  findPath,
  fromKey,
  fromPixel,
  key,
  line,
  neighbor,
  neighbors,
  offsetToAxial,
  range,
  reachable,
  ring,
  toPixel,
  type Hex,
} from '../src/hex';
import { makeRng } from '../src/rng';

describe('hex coordinates', () => {
  it('round-trips through keys', () => {
    const h: Hex = { q: -4, r: 9 };
    expect(fromKey(key(h))).toEqual(h);
  });

  it('round-trips through offset space over a rectangle', () => {
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 12; col++) {
        expect(axialToOffset(offsetToAxial(col, row))).toEqual({ col, row });
      }
    }
  });

  it('round-trips through pixel space (fuzz)', () => {
    const rng = makeRng('pixel');
    for (const size of [12, 26, 41.5]) {
      for (let i = 0; i < 150; i++) {
        const h: Hex = { q: rng.int(-30, 30), r: rng.int(-30, 30) };
        const p = toPixel(h, size);
        expect(fromPixel(p.x, p.y, size)).toEqual(h);
      }
    }
  });

  it('column matches offset column', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(column(offsetToAxial(col, row))).toBe(col);
      }
    }
  });
});

describe('hex grid', () => {
  it('has six distinct neighbours, each one step away', () => {
    const centre: Hex = { q: 3, r: -2 };
    const ns = neighbors(centre);
    expect(ns).toHaveLength(6);
    expect(new Set(ns.map(key)).size).toBe(6);
    for (const n of ns) expect(distance(centre, n)).toBe(1);
  });

  /**
   * The tie-break, pinned — because a port got it wrong and nothing said so.
   *
   * `line()` nudges both axials by 1e-6 before rounding and `round()` has only
   * TWO branches, so where `dr` and `ds` tie it leaves q and r alone and lets
   * s absorb the error. Both of those are one line each and easy to read past.
   * The C++ port was written as a cube-space rounding with a third branch and
   * no nudge; it matched every sight line from a landing and diverged on the
   * band's first step, hiding one hex of map behind a blocker that is not on
   * the line this walks. See port/sim.md.
   *
   * 4,15 to 6,14 is that exact case: an even tie at the midpoint, which the
   * nudge sends to 5,15 rather than 5,14.
   */
  it('breaks an exact tie the same way every time', () => {
    expect(line({ q: 4, r: 15 }, { q: 6, r: 14 }).map(key)).toEqual([
      '4,15', '5,15', '6,14',
    ]);
    // Walked the other way it is the same three hexes, because the nudge is
    // added to the interpolated point rather than to either end. Worth
    // asserting rather than assuming: a line that picked a different middle
    // depending on which end you started from would make what a band can see
    // depend on which way it happened to be facing.
    expect(line({ q: 6, r: 14 }, { q: 4, r: 15 }).map(key)).toEqual([
      '6,14', '5,15', '4,15',
    ]);
  });

  it('opposite directions cancel', () => {
    const centre: Hex = { q: 0, r: 0 };
    for (let d = 0; d < 6; d++) {
      expect(equals(neighbor(neighbor(centre, d), d + 3), centre)).toBe(true);
    }
  });

  it('directionTo finds each neighbour and rejects far hexes', () => {
    const centre: Hex = { q: 5, r: 5 };
    for (let d = 0; d < 6; d++) {
      expect(directionTo(centre, neighbor(centre, d))).toBe(d);
    }
    expect(directionTo(centre, { q: 12, r: 12 })).toBe(-1);
  });

  it('distance is symmetric and obeys the triangle inequality', () => {
    const rng = makeRng('distance');
    for (let i = 0; i < 300; i++) {
      const a: Hex = { q: rng.int(-25, 25), r: rng.int(-25, 25) };
      const b: Hex = { q: rng.int(-25, 25), r: rng.int(-25, 25) };
      const c: Hex = { q: rng.int(-25, 25), r: rng.int(-25, 25) };
      expect(distance(a, b)).toBe(distance(b, a));
      expect(distance(a, c)).toBeLessThanOrEqual(distance(a, b) + distance(b, c));
    }
  });

  it('ring(n) holds 6n hexes all at distance n', () => {
    const centre: Hex = { q: 2, r: -1 };
    for (let r = 1; r <= 5; r++) {
      const hexes = ring(centre, r);
      expect(hexes).toHaveLength(6 * r);
      expect(new Set(hexes.map(key)).size).toBe(6 * r);
      for (const h of hexes) expect(distance(centre, h)).toBe(r);
    }
  });

  it('range(n) holds 1+3n(n+1) hexes', () => {
    for (let r = 0; r <= 5; r++) {
      expect(range({ q: 0, r: 0 }, r)).toHaveLength(1 + 3 * r * (r + 1));
    }
  });

  it('lines connect endpoints with adjacent steps', () => {
    const rng = makeRng('line');
    for (let i = 0; i < 200; i++) {
      const a: Hex = { q: rng.int(-15, 15), r: rng.int(-15, 15) };
      const b: Hex = { q: rng.int(-15, 15), r: rng.int(-15, 15) };
      const path = line(a, b);
      expect(path[0]).toEqual(a);
      expect(path[path.length - 1]).toEqual(b);
      expect(path).toHaveLength(distance(a, b) + 1);
      for (let j = 1; j < path.length; j++) {
        expect(distance(path[j - 1]!, path[j]!)).toBe(1);
      }
    }
  });

  it('DIRECTIONS are the six unit vectors', () => {
    expect(new Set(DIRECTIONS.map(key)).size).toBe(6);
    for (const d of DIRECTIONS) expect(distance({ q: 0, r: 0 }, d)).toBe(1);
  });
});

describe('pathfinding', () => {
  const open = () => 1;

  it('finds a shortest path across open ground', () => {
    const start: Hex = { q: 0, r: 0 };
    const goal: Hex = { q: 5, r: -2 };
    const path = findPath(start, goal, open);
    expect(path.hexes[0]).toEqual(start);
    expect(path.hexes[path.hexes.length - 1]).toEqual(goal);
    expect(path.cost).toBe(distance(start, goal));
  });

  it('returns an empty path when the goal is walled off', () => {
    const goal: Hex = { q: 3, r: 0 };
    const blocked = (h: Hex) => (h.q === 3 ? Infinity : 1);
    expect(findPath({ q: 0, r: 0 }, goal, blocked).hexes).toHaveLength(0);
  });

  it('routes around expensive ground when it is cheaper to go wide', () => {
    // A wall of cost-50 hexes at q === 2, with a gap at r === 3.
    const cost = (h: Hex) => (h.q === 2 && h.r !== 3 ? 50 : 1);
    const path = findPath({ q: 0, r: 0 }, { q: 4, r: 0 }, cost);
    expect(path.hexes.length).toBeGreaterThan(0);
    expect(path.cost).toBeLessThan(50);
    expect(path.hexes.some((h) => h.q === 2 && h.r === 3)).toBe(true);
  });

  it('start equals goal costs nothing', () => {
    const path = findPath({ q: 1, r: 1 }, { q: 1, r: 1 }, open);
    expect(path.cost).toBe(0);
    expect(path.hexes).toHaveLength(1);
  });

  it('reachable respects the budget', () => {
    const found = reachable({ q: 0, r: 0 }, 2, open);
    // 1 + 6 + 12 hexes lie within two steps of open ground.
    expect(found.size).toBe(19);
    for (const cost of found.values()) expect(cost).toBeLessThanOrEqual(2);
  });

  it('reachable never crosses impassable ground', () => {
    const cost = (h: Hex) => (h.q === 1 ? Infinity : 1);
    const found = reachable({ q: 0, r: 0 }, 4, cost);
    for (const k of found.keys()) expect(fromKey(k).q).not.toBe(1);
  });
});
