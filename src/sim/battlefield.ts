// Battlefield generation. The ground you fight on is the ground you were
// standing on: a bog fight is a slog, a forest fight is full of trunks.

import { key, offsetToAxial, type Hex, type HexKey } from '../hex';
import type { Rng } from '../rng';
import type { BattleTile, Ground, Terrain } from '../state/types';

// Portrait: the field is taller than it is wide, because the phone is.
// Seven columns is what lets a hex clear the 44px touch target at 390px.
export const FIELD_WIDTH = 7;
export const FIELD_HEIGHT = 9;

/** Rows each side deploys into — warband at the near edge, foes at the far. */
const WARBAND_ROWS = [FIELD_HEIGHT - 2, FIELD_HEIGHT - 1];
const FOE_ROWS = [0, 1];

interface GroundMix {
  /** Chance a middle-field hex is rough going. */
  rough: number;
  /** Chance it is blocked outright (trunks, boulders). */
  block: number;
  /** Chance it is water (only where water makes sense). */
  water: number;
}

const MIXES: Record<Terrain, GroundMix> = {
  ocean: { rough: 0, block: 0, water: 0 }, // never fought on
  shore: { rough: 0.12, block: 0.03, water: 0.1 },
  meadow: { rough: 0.08, block: 0.02, water: 0 },
  forest: { rough: 0.2, block: 0.16, water: 0 },
  hills: { rough: 0.26, block: 0.1, water: 0 },
  mountains: { rough: 0.3, block: 0.22, water: 0 },
  bog: { rough: 0.42, block: 0.04, water: 0.12 },
  valley: { rough: 0.1, block: 0.03, water: 0.04 },
};

export function groundCost(ground: Ground): number {
  switch (ground) {
    case 'open':
      return 1;
    case 'rough':
      return 2;
    default:
      return Infinity;
  }
}

export function isPassable(ground: Ground): boolean {
  return Number.isFinite(groundCost(ground));
}

/**
 * Builds the field. Deployment columns are always left clear so neither side
 * starts walled in, and a lane is carved if the middle closes up entirely.
 */
export function generateBattlefield(
  terrain: Terrain,
  rng: Rng,
): { grid: Record<HexKey, BattleTile>; warbandSpots: Hex[]; foeSpots: Hex[] } {
  const mix = MIXES[terrain] ?? MIXES.meadow;
  const grid: Record<HexKey, BattleTile> = {};
  const warbandSpots: Hex[] = [];
  const foeSpots: Hex[] = [];

  for (let row = 0; row < FIELD_HEIGHT; row++) {
    for (let col = 0; col < FIELD_WIDTH; col++) {
      const h = offsetToAxial(col, row);
      const isDeploy = WARBAND_ROWS.includes(row) || FOE_ROWS.includes(row);

      let ground: Ground = 'open';
      if (!isDeploy) {
        const roll = rng.next();
        if (roll < mix.block) ground = 'block';
        else if (roll < mix.block + mix.water) ground = 'water';
        else if (roll < mix.block + mix.water + mix.rough) ground = 'rough';
      }

      grid[key(h)] = { ground };
      if (WARBAND_ROWS.includes(row)) warbandSpots.push(h);
      if (FOE_ROWS.includes(row)) foeSpots.push(h);
    }
  }

  ensureCrossable(grid, rng);
  return { grid, warbandSpots, foeSpots };
}

/** The rows between the two deployment bands — the ground to be crossed. */
export const MIDDLE_ROWS = Array.from({ length: FIELD_HEIGHT - 4 }, (_, i) => i + 2);

/**
 * A field the sides cannot reach across is not a battle. Clears a walkable
 * lane down one column if no column runs open through the middle rows.
 */
function ensureCrossable(grid: Record<HexKey, BattleTile>, rng: Rng): void {
  for (let col = 0; col < FIELD_WIDTH; col++) {
    const clear = MIDDLE_ROWS.every((row) => {
      const tile = grid[key(offsetToAxial(col, row))];
      return tile !== undefined && isPassable(tile.ground);
    });
    if (clear) return; // at least one column is walkable end to end
  }

  const lane = rng.int(1, FIELD_WIDTH - 2);
  for (const row of MIDDLE_ROWS) {
    const tile = grid[key(offsetToAxial(lane, row))];
    if (tile && !isPassable(tile.ground)) tile.ground = 'rough';
  }
}

/** Human-readable name for the ground, used in the battle log. */
export function groundName(terrain: Terrain): string {
  switch (terrain) {
    case 'bog':
      return 'the sucking peat';
    case 'forest':
      return 'close trees';
    case 'hills':
      return 'broken slope';
    case 'mountains':
      return 'bare rock';
    case 'shore':
      return 'wet sand';
    case 'valley':
      return 'good grass';
    default:
      return 'open ground';
  }
}
