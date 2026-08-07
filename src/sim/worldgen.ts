// World generation. The party always makes landfall on a western shore with
// unknown country to the east — so "inland" always means "into the dark".

import { key, offsetToAxial, column, neighbors, type Hex, type HexKey } from '../hex';
import type { Rng } from '../rng';
import type { Terrain, Tile, World } from '../state/types';
import { makeFbm } from './noise';

export const WORLD_WIDTH = 40;
export const WORLD_HEIGHT = 30;

const SEA_LEVEL = 0.5;
/** Minimum contiguous land hexes reachable from the landing, else reroll. */
const MIN_LANDMASS = 260;

interface Field {
  elevation: number;
  moisture: number;
}

function buildFields(rng: Rng, width: number, height: number): Map<HexKey, Field> {
  const elevationNoise = makeFbm(rng.derive('elevation'), 5);
  const moistureNoise = makeFbm(rng.derive('moisture'), 3);
  // Jittered sampling origin so seeds don't share a corner of the noise field.
  const ox = rng.int(0, 900);
  const oy = rng.int(0, 900);
  const fields = new Map<HexKey, Field>();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const h = offsetToAxial(col, row);
      const nx = ox + col * 0.16;
      const ny = oy + row * 0.16;

      // West is always open sea; land firms up as you go east.
      const eastward = col / (width - 1);
      const westBias = Math.min(1, Math.max(0, (eastward - 0.08) / 0.35));

      // Soften the north and south edges so the land reads as a coast,
      // not a rectangle clipped by the viewport.
      const edgeY = Math.min(row, height - 1 - row) / (height * 0.28);
      const northSouthFalloff = Math.min(1, Math.max(0, edgeY));

      const raw = elevationNoise(nx, ny);
      const elevation = raw * 0.62 + westBias * 0.52 - (1 - northSouthFalloff) * 0.38;

      fields.set(key(h), {
        elevation,
        moisture: moistureNoise(nx + 40, ny + 40),
      });
    }
  }
  return fields;
}

function classify(elevation: number, moisture: number): Terrain {
  if (elevation < SEA_LEVEL) return 'ocean';
  if (elevation > 0.86) return 'mountains';
  if (elevation > 0.74) return 'hills';
  if (moisture > 0.68) return elevation < 0.58 ? 'bog' : 'forest';
  if (moisture > 0.44) return 'forest';
  if (moisture > 0.3) return elevation < 0.62 ? 'valley' : 'meadow';
  return 'meadow';
}

/** Land hexes touching the sea become shore — where a knarr can beach. */
function markShore(tiles: Record<HexKey, Tile>): void {
  for (const [k, tile] of Object.entries(tiles)) {
    if (tile.terrain === 'ocean' || tile.terrain === 'mountains') continue;
    const h = fromKeyLocal(k);
    const touchesSea = neighbors(h).some((n) => tiles[key(n)]?.terrain === 'ocean');
    if (touchesSea) tile.terrain = 'shore';
  }
}

function fromKeyLocal(k: HexKey): Hex {
  const i = k.indexOf(',');
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

/**
 * Rivers run downhill from high ground to the sea, marking every hex they
 * pass through. They give fresh water inland and cost effort to cross.
 */
function carveRivers(
  rng: Rng,
  tiles: Record<HexKey, Tile>,
  fields: Map<HexKey, Field>,
  count: number,
): void {
  const sources = Object.entries(tiles)
    .filter(([k, t]) => t.terrain === 'mountains' || (t.terrain === 'hills' && (fields.get(k)?.elevation ?? 0) > 0.78))
    .map(([k]) => k);
  if (sources.length === 0) return;

  for (let i = 0; i < count; i++) {
    let current = rng.pick(sources);
    const walked = new Set<HexKey>();

    for (let step = 0; step < 60; step++) {
      if (walked.has(current)) break;
      walked.add(current);
      const tile = tiles[current];
      if (!tile) break;
      if (tile.terrain === 'ocean') break;
      tile.river = true;

      // Flow to the lowest neighbour we have not already used.
      let bestKey: HexKey | null = null;
      let bestElevation = fields.get(current)?.elevation ?? 1;
      for (const n of neighbors(fromKeyLocal(current))) {
        const nk = key(n);
        if (walked.has(nk) || !tiles[nk]) continue;
        const elevation = fields.get(nk)?.elevation ?? 1;
        if (elevation < bestElevation) {
          bestElevation = elevation;
          bestKey = nk;
        }
      }
      if (!bestKey) break; // a lake, or a dead end — rivers may simply stop
      current = bestKey;
    }
  }
}

/** Flood-fill of walkable land reachable from a starting hex. */
function landmassFrom(start: Hex, tiles: Record<HexKey, Tile>): Set<HexKey> {
  const seen = new Set<HexKey>([key(start)]);
  const queue: Hex[] = [start];
  while (queue.length > 0) {
    const here = queue.pop()!;
    for (const n of neighbors(here)) {
      const nk = key(n);
      const tile = tiles[nk];
      if (!tile || seen.has(nk) || tile.terrain === 'ocean') continue;
      seen.add(nk);
      queue.push(n);
    }
  }
  return seen;
}

/** The westernmost shore hex near mid-map — where the keel touches sand. */
function chooseLanding(tiles: Record<HexKey, Tile>, height: number): Hex | null {
  const midRow = (height - 1) / 2;
  const candidates = Object.entries(tiles)
    .filter(([, t]) => t.terrain === 'shore')
    .map(([k]) => fromKeyLocal(k))
    .filter((h) => Math.abs(h.r - midRow) < height * 0.3);
  if (candidates.length === 0) return null;

  // Prefer far west, then closest to the middle row: a lonely, exposed beach.
  candidates.sort((a, b) => column(a) - column(b) || Math.abs(a.r - midRow) - Math.abs(b.r - midRow));
  return candidates[0] ?? null;
}

function generateOnce(rng: Rng, width: number, height: number): World | null {
  const fields = buildFields(rng, width, height);
  const tiles: Record<HexKey, Tile> = {};

  for (const [k, field] of fields) {
    tiles[k] = { terrain: classify(field.elevation, field.moisture), river: false };
  }

  markShore(tiles);
  carveRivers(rng.derive('rivers'), tiles, fields, rng.int(3, 6));

  const landing = chooseLanding(tiles, height);
  if (!landing) return null;
  if (landmassFrom(landing, tiles).size < MIN_LANDMASS) return null;

  // Places are seeded by the caller from their own derived stream, so a
  // migration can re-derive them for an old save without replaying worldgen.
  return { width, height, tiles, seen: {}, landing, landingName: '', trod: {}, places: [] };
}

/** Generates a world, rerolling with derived seeds until one is worth playing. */
export function generateWorld(rng: Rng, width = WORLD_WIDTH, height = WORLD_HEIGHT): World {
  for (let attempt = 0; attempt < 24; attempt++) {
    const world = generateOnce(rng.derive(`attempt:${attempt}`), width, height);
    if (world) return world;
  }
  throw new Error('worldgen failed: no viable landmass after 24 attempts');
}
