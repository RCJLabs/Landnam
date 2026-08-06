import { describe, it, expect } from 'vitest';
import {
  Axial,
  key,
  fromKey,
  neighbors,
  neighbor,
  distance,
  dirTo,
  ring,
  spiral,
  line,
  toPixel,
  fromPixel,
  offsetToAxial,
  axialToOffset,
  DIRS,
} from '../src/core/hex';
import { makeRng } from '../src/core/rng';

describe('hex core', () => {
  it('key roundtrips', () => {
    const h: Axial = { q: -3, r: 7 };
    expect(fromKey(key(h))).toEqual(h);
  });

  it('has six unique neighbors at distance 1', () => {
    const c: Axial = { q: 2, r: -1 };
    const ns = neighbors(c);
    expect(ns).toHaveLength(6);
    expect(new Set(ns.map(key)).size).toBe(6);
    for (const n of ns) expect(distance(c, n)).toBe(1);
  });

  it('opposite directions cancel', () => {
    const c: Axial = { q: 0, r: 0 };
    for (let d = 0; d < 6; d++) {
      expect(neighbor(neighbor(c, d), d + 3)).toEqual(c);
    }
  });

  it('dirTo finds the direction to each neighbor', () => {
    const c: Axial = { q: 4, r: 4 };
    for (let d = 0; d < 6; d++) {
      expect(dirTo(c, neighbor(c, d))).toBe(d);
    }
    expect(dirTo(c, { q: 9, r: 9 })).toBe(-1);
  });

  it('distance satisfies triangle inequality and symmetry (fuzz)', () => {
    const rng = makeRng('hex-fuzz');
    for (let i = 0; i < 200; i++) {
      const a: Axial = { q: rng.int(-20, 20), r: rng.int(-20, 20) };
      const b: Axial = { q: rng.int(-20, 20), r: rng.int(-20, 20) };
      const c: Axial = { q: rng.int(-20, 20), r: rng.int(-20, 20) };
      expect(distance(a, b)).toBe(distance(b, a));
      expect(distance(a, c)).toBeLessThanOrEqual(distance(a, b) + distance(b, c));
    }
  });

  it('ring(r) has 6r hexes all at distance r', () => {
    const c: Axial = { q: 1, r: 1 };
    for (let r = 1; r <= 4; r++) {
      const rr = ring(c, r);
      expect(rr).toHaveLength(6 * r);
      expect(new Set(rr.map(key)).size).toBe(6 * r);
      for (const h of rr) expect(distance(c, h)).toBe(r);
    }
  });

  it('spiral(r) has 1+3r(r+1) hexes', () => {
    const c: Axial = { q: 0, r: 0 };
    for (let r = 0; r <= 4; r++) {
      expect(spiral(c, r)).toHaveLength(1 + 3 * r * (r + 1));
    }
  });

  it('line endpoints are correct and consecutive steps adjacent', () => {
    const rng = makeRng('line-fuzz');
    for (let i = 0; i < 100; i++) {
      const a: Axial = { q: rng.int(-10, 10), r: rng.int(-10, 10) };
      const b: Axial = { q: rng.int(-10, 10), r: rng.int(-10, 10) };
      const l = line(a, b);
      expect(l[0]).toEqual(a);
      expect(l[l.length - 1]).toEqual(b);
      expect(l).toHaveLength(distance(a, b) + 1);
      for (let j = 1; j < l.length; j++) {
        expect(distance(l[j - 1]!, l[j]!)).toBe(1);
      }
    }
  });

  it('pixel conversion roundtrips (fuzz)', () => {
    const rng = makeRng('pixel-fuzz');
    for (const size of [10, 24, 37.5]) {
      for (let i = 0; i < 100; i++) {
        const h: Axial = { q: rng.int(-30, 30), r: rng.int(-30, 30) };
        const p = toPixel(h, size);
        expect(fromPixel(p.x, p.y, size)).toEqual(h);
      }
    }
  });

  it('offset conversion roundtrips over a rectangle', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const h = offsetToAxial(col, row);
        expect(axialToOffset(h)).toEqual({ col, row });
      }
    }
  });

  it('DIRS are the 6 unit hex vectors', () => {
    expect(new Set(DIRS.map((d) => key(d))).size).toBe(6);
    for (const d of DIRS) expect(distance({ q: 0, r: 0 }, d)).toBe(1);
  });
});
