import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/core/rng';
import { generateChart } from '../src/procgen/chart';
import { findPath } from '../src/core/path';
import { key, fromKey, neighbors, distance } from '../src/core/hex';
import { BALANCE } from '../src/content/balance';

describe('chart procgen', () => {
  it('same seed generates a deep-equal chart', () => {
    const a = generateChart(makeRng('det-check').fork('chart'));
    const b = generateChart(makeRng('det-check').fork('chart'));
    expect(JSON.stringify({ ...a, discovered: [] })).toBe(JSON.stringify({ ...b, discovered: [] }));
  });

  it('different seeds differ', () => {
    const a = generateChart(makeRng('seed-one').fork('chart'));
    const b = generateChart(makeRng('seed-two').fork('chart'));
    expect(JSON.stringify(a.tiles)).not.toBe(JSON.stringify(b.tiles));
  });

  const SEEDS = Array.from({ length: 40 }, (_, i) => `invariant-seed-${i}`);

  it.each(SEEDS.map((s) => [s]))('invariants hold for %s', (seed) => {
    const chart = generateChart(makeRng(seed).fork('chart'));

    // Start and goal exist on sailable tiles.
    const startTile = chart.tiles[key(chart.startAt)]!;
    const goalTile = chart.tiles[key(chart.vinlandAt)]!;
    expect(startTile.terrain).toBe('coast');
    expect(startTile.region).toBe('norway');
    expect(goalTile.region).toBe('vinland');

    // Navigable within bounds.
    const sail = (h: { q: number; r: number }) => {
      const t = chart.tiles[key(h)];
      return !t || t.terrain === 'land' || t.terrain === 'ice' ? Infinity : 1;
    };
    const { path } = findPath(chart.startAt, chart.vinlandAt, sail);
    expect(path.length).toBeGreaterThanOrEqual(BALANCE.chart.pathMin);
    expect(path.length).toBeLessThanOrEqual(BALANCE.chart.pathMax);

    // All features sit on non-land tiles and respect min spacing.
    const featureHexes: { q: number; r: number }[] = [];
    for (const [k, t] of Object.entries(chart.tiles)) {
      if (!t.feature) continue;
      expect(t.terrain).not.toBe('land');
      expect(t.terrain).not.toBe('ice');
      featureHexes.push(fromKey(k));
    }
    for (let i = 0; i < featureHexes.length; i++) {
      for (let j = i + 1; j < featureHexes.length; j++) {
        expect(distance(featureHexes[i]!, featureHexes[j]!)).toBeGreaterThanOrEqual(3);
      }
    }
    // A home port and at least a few other features exist.
    const kinds = Object.values(chart.tiles)
      .filter((t) => t.feature)
      .map((t) => t.feature!.kind);
    expect(kinds.filter((k) => k === 'home')).toHaveLength(1);
    expect(kinds.length).toBeGreaterThanOrEqual(5);

    // Coast tiles actually touch land.
    for (const [k, t] of Object.entries(chart.tiles)) {
      if (t.terrain !== 'coast') continue;
      const touchesLand = neighbors(fromKey(k)).some(
        (n) => chart.tiles[key(n)]?.terrain === 'land',
      );
      expect(touchesLand).toBe(true);
    }

    // Danger rises westward: goal tile tier >= start tile tier.
    expect(goalTile.dangerTier).toBeGreaterThanOrEqual(startTile.dangerTier);
    expect(goalTile.dangerTier).toBe(3);
  });
});
