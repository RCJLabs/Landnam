import { describe, it, expect } from 'vitest';
import { makeRng, hashString, generateSeed } from '../src/core/rng';

describe('seeded rng', () => {
  it('same seed produces the same sequence', () => {
    const a = makeRng('whale-road');
    const b = makeRng('whale-road');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('different seeds produce different sequences', () => {
    const a = makeRng('seed-a');
    const b = makeRng('seed-b');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('forked streams are independent of parent draws', () => {
    // Fork, then draw different amounts from parents; forks must match.
    const p1 = makeRng('parent');
    const p2 = makeRng('parent');
    p1.next(); // perturb p1 only
    p1.next();
    p1.next();
    const f1 = p1.fork('chart');
    const f2 = p2.fork('chart');
    for (let i = 0; i < 50; i++) expect(f1.next()).toBe(f2.next());
  });

  it('int stays in bounds and hits both endpoints', () => {
    const r = makeRng('int-bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('roll(2,6) is within [2,12]', () => {
    const r = makeRng('dice');
    for (let i = 0; i < 500; i++) {
      const v = r.roll(2, 6);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(12);
    }
  });

  it('weightedPick respects zero weights', () => {
    const r = makeRng('weighted');
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 200; i++) {
      expect(r.weightedPick(items, (x) => (x === 'b' ? 1 : 0))).toBe('b');
    }
  });

  it('shuffle is a permutation', () => {
    const r = makeRng('shuffle');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = r.shuffle([...arr]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr);
  });

  it('hashString is stable', () => {
    expect(hashString('whale-road')).toBe(hashString('whale-road'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('generateSeed is deterministic per entropy value', () => {
    expect(generateSeed(123)).toBe(generateSeed(123));
    expect(generateSeed(1)).not.toBe(generateSeed(2));
  });
});
