import { describe, it, expect } from 'vitest';
import { hashString, makeRng, makeSeedPhrase, stream } from '../src/rng';

describe('seeded rng', () => {
  it('is reproducible for a given seed', () => {
    const a = makeRng('landnam');
    const b = makeRng('landnam');
    for (let i = 0; i < 200; i++) expect(a.next()).toBe(b.next());
  });

  it('differs between seeds', () => {
    const draw = (seed: string) => {
      const rng = makeRng(seed);
      return Array.from({ length: 12 }, () => rng.next());
    };
    expect(draw('a')).not.toEqual(draw('b'));
  });

  it('named streams are independent of one another', () => {
    // Draining `combat` must not shift what `worldgen` produces.
    const combat = stream('seed-x', 'combat');
    for (let i = 0; i < 50; i++) combat.next();
    const worldA = stream('seed-x', 'worldgen');
    const worldB = stream('seed-x', 'worldgen');
    for (let i = 0; i < 50; i++) expect(worldA.next()).toBe(worldB.next());
  });

  it('derived streams are stable and distinct', () => {
    const base = makeRng('root');
    const one = base.derive('day:3');
    const two = makeRng('root').derive('day:3');
    const other = makeRng('root').derive('day:4');
    for (let i = 0; i < 30; i++) expect(one.next()).toBe(two.next());
    expect(makeRng('root').derive('day:3').next()).not.toBe(other.next());
  });

  it('int covers its range inclusively', () => {
    const rng = makeRng('ints');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('roll(2,6) stays within 2..12', () => {
    const rng = makeRng('dice');
    for (let i = 0; i < 800; i++) {
      const value = rng.roll(2, 6);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(12);
    }
  });

  it('weighted honours zero weights', () => {
    const rng = makeRng('weights');
    for (let i = 0; i < 200; i++) {
      expect(rng.weighted(['a', 'b', 'c'], (x) => (x === 'b' ? 3 : 0))).toBe('b');
    }
  });

  it('shuffle produces a permutation', () => {
    const rng = makeRng('shuffle');
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shuffled = rng.shuffle([...original]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
  });

  it('float stays in range', () => {
    const rng = makeRng('floats');
    for (let i = 0; i < 400; i++) {
      const value = rng.float(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThan(5);
    }
  });

  it('hashString is stable and discriminating', () => {
    expect(hashString('landnam')).toBe(hashString('landnam'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('seed phrases are deterministic per entropy value', () => {
    expect(makeSeedPhrase(42)).toBe(makeSeedPhrase(42));
    expect(makeSeedPhrase(1)).not.toBe(makeSeedPhrase(2));
    expect(makeSeedPhrase(7)).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  });
});
