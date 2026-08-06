import { describe, it, expect } from 'vitest';
import { key, neighbors, findPath, column, type Hex } from '../src/hex';
import { stream } from '../src/rng';
import { generateWorld, WORLD_HEIGHT, WORLD_WIDTH } from '../src/sim/worldgen';
import { terrainDef } from '../src/data/terrain';
import type { World } from '../src/state/types';

function walkable(world: World) {
  return (h: Hex) => {
    const tile = world.tiles[key(h)];
    if (!tile) return Infinity;
    const cost = terrainDef(tile.terrain).cost;
    return Number.isFinite(cost) ? cost : Infinity;
  };
}

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateWorld(stream('same-seed', 'worldgen'));
    const b = generateWorld(stream('same-seed', 'worldgen'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different lands for different seeds', () => {
    const a = generateWorld(stream('coast-one', 'worldgen'));
    const b = generateWorld(stream('coast-two', 'worldgen'));
    expect(JSON.stringify(a.tiles)).not.toBe(JSON.stringify(b.tiles));
  });

  const SEEDS = Array.from({ length: 20 }, (_, i) => `world-${i}`);

  it.each(SEEDS.map((s) => [s]))('%s yields a readable landmass', (seed) => {
    const world = generateWorld(stream(seed, 'worldgen'));

    expect(world.width).toBe(WORLD_WIDTH);
    expect(world.height).toBe(WORLD_HEIGHT);
    expect(Object.keys(world.tiles)).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);

    // The landing is always a beach touching the sea.
    const landingTile = world.tiles[key(world.landing)];
    expect(landingTile?.terrain).toBe('shore');
    expect(
      neighbors(world.landing).some((n) => world.tiles[key(n)]?.terrain === 'ocean'),
    ).toBe(true);

    // Sea lies west of the landing — you arrived from open water.
    expect(column(world.landing)).toBeLessThan(WORLD_WIDTH / 2);

    // Enough walkable country to make exploring meaningful.
    const land = Object.values(world.tiles).filter((t) => t.terrain !== 'ocean');
    expect(land.length).toBeGreaterThan(200);

    // And enough sea that it reads as a coast, not a continent.
    const ocean = Object.values(world.tiles).filter((t) => t.terrain === 'ocean');
    expect(ocean.length).toBeGreaterThan(80);

    // Terrain variety: at least four distinct land types.
    const kinds = new Set(land.map((t) => t.terrain));
    expect(kinds.size).toBeGreaterThanOrEqual(4);

    // Nothing starts revealed; fog is applied by newGame, not worldgen.
    expect(Object.keys(world.seen)).toHaveLength(0);
  });

  it('every shore hex actually touches the sea', () => {
    const world = generateWorld(stream('shoreline', 'worldgen'));
    for (const [k, tile] of Object.entries(world.tiles)) {
      if (tile.terrain !== 'shore') continue;
      const h = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      expect(neighbors(h).some((n) => world.tiles[key(n)]?.terrain === 'ocean')).toBe(true);
    }
  });

  it('inland country is reachable on foot from the landing', () => {
    for (const seed of ['reach-a', 'reach-b', 'reach-c']) {
      const world = generateWorld(stream(seed, 'worldgen'));
      // Find a land hex well east of the landing and confirm a route exists.
      const target = Object.entries(world.tiles)
        .map(([k, tile]) => ({ h: { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }, tile }))
        .filter(({ h, tile }) => tile.terrain !== 'ocean' && column(h) > column(world.landing) + 8)
        .sort((a, b) => column(a.h) - column(b.h))[0];
      expect(target).toBeDefined();
      const path = findPath(world.landing, target!.h, walkable(world));
      expect(path.hexes.length).toBeGreaterThan(0);
    }
  });

  it('rivers only run over land', () => {
    const world = generateWorld(stream('rivers', 'worldgen'));
    for (const tile of Object.values(world.tiles)) {
      if (tile.river) expect(tile.terrain).not.toBe('ocean');
    }
  });
});
