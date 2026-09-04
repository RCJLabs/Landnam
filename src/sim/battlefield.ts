// Battlefield generation. The ground you fight on is the ground you were
// standing on: a bog fight is a slog, a forest fight is full of trunks.

import type { Rng } from '../rng';
import type { BattleTile, Ground, Terrain } from '../state/types';
import { RAID_FIELDS, type RaidFieldDef } from '../data/raidFields';
import { SEA_FIELDS, type SeaFieldDef } from '../data/seaFields';

// Portrait: the field is taller than it is wide, because the phone is.
// Seven columns is what lets a cell clear the 44px touch target at 390px.
export const FIELD_WIDTH = 7;
export const FIELD_HEIGHT = 9;

/**
 * Where a tile sits in the grid.
 *
 * The field was an axial hex lattice until 8.5, and every access to it went
 * through `key(offsetToAxial(col, row))` — a column and a row, encoded into
 * a hex and straight back out again. Nobody ever asked it a hex question:
 * since 8.1c the fight is resolved on ranks and nothing walks the ground, so
 * the neighbours, the distances and the paths all went unused. A rectangle
 * indexed by row is the same 63 tiles with the ceremony taken off.
 */
export function cell(col: number, row: number): number {
  return row * FIELD_WIDTH + col;
}

/** A field of open ground, for the generators to cut into. */
function blankField(): BattleTile[] {
  return Array.from({ length: FIELD_WIDTH * FIELD_HEIGHT }, () => ({ ground: 'open' as Ground }));
}

/** Rows each side deploys into — warband at the near edge, foes at the far. */
const WARBAND_ROWS = [FIELD_HEIGHT - 2, FIELD_HEIGHT - 1];
const FOE_ROWS = [0, 1];

/**
 * A generated field: the ground, and where each side forms up on it.
 *
 * The spots are cell indices rather than positions now — nothing has stood
 * on one since the fight moved onto ranks, and they survive only as the
 * count of places each side could have formed up in, which the field tests
 * still hold the generators to.
 */
export interface Field {
  grid: BattleTile[];
  warbandSpots: number[];
  foeSpots: number[];
}

interface GroundMix {
  /** Chance a middle-field cell is rough going. */
  rough: number;
  /** Chance it is blocked outright (trunks, boulders). */
  block: number;
  /** Chance it is water (only where water makes sense). */
  water: number;
}

const MIXES: Record<Terrain, GroundMix> = {
  // A fight on the water is two hulls lashed together: cargo and mast to
  // climb over, and open sea in the gaps where the boats do not meet.
  ocean: { rough: 0.06, block: 0.14, water: 0.24 },
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
    // A palisade does not stop them, it slows them where you want them
    // slowed. Sealing the field outright would leave a fight with no way to
    // be joined at all.
    case 'wall':
      return 3;
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
): Field {
  const mix = MIXES[terrain] ?? MIXES.meadow;
  const grid = blankField();
  const warbandSpots: number[] = [];
  const foeSpots: number[] = [];

  for (let row = 0; row < FIELD_HEIGHT; row++) {
    for (let col = 0; col < FIELD_WIDTH; col++) {
      const i = cell(col, row);
      const isDeploy = WARBAND_ROWS.includes(row) || FOE_ROWS.includes(row);

      let ground: Ground = 'open';
      if (!isDeploy) {
        const roll = rng.next();
        if (roll < mix.block) ground = 'block';
        else if (roll < mix.block + mix.water) ground = 'water';
        else if (roll < mix.block + mix.water + mix.rough) ground = 'rough';
      }

      grid[i] = { ground };
      if (WARBAND_ROWS.includes(row)) warbandSpots.push(i);
      if (FOE_ROWS.includes(row)) foeSpots.push(i);
    }
  }

  ensureCrossable(grid, rng);
  ensureFront(grid, rng);
  return { grid, warbandSpots, foeSpots };
}

/** The rows between the two deployment bands — the ground to be crossed. */
export const MIDDLE_ROWS = Array.from({ length: FIELD_HEIGHT - 4 }, (_, i) => i + 2);

/**
 * A field the sides cannot reach across is not a battle. Clears a walkable
 * lane down one column if no column runs open through the middle rows.
 */
function ensureCrossable(grid: BattleTile[], rng: Rng): void {
  for (let col = 0; col < FIELD_WIDTH; col++) {
    const clear = MIDDLE_ROWS.every((row) => {
      const tile = grid[cell(col, row)];
      return tile !== undefined && isPassable(tile.ground);
    });
    if (clear) return; // at least one column is walkable end to end
  }

  const lane = rng.int(1, FIELD_WIDTH - 2);
  for (const row of MIDDLE_ROWS) {
    const tile = grid[cell(lane, row)];
    if (tile && !isPassable(tile.ground)) tile.ground = 'rough';
  }
}

/**
 * How many shoulders the ground must be able to hold in a row.
 *
 * Four, because the shield wall's bonus comes from standing next to people
 * and caps at two neighbours: four abreast is a line with a proper middle.
 */
export const FRONT_WIDTH = 4;

/**
 * A field with no room to form a line is a field where the shield wall does
 * not exist — and the wall is a whole milestone of this game.
 *
 * `ensureCrossable` above guarantees a walkable LANE, which is the opposite
 * thing: a corridor admits single file, and single file is exactly how you
 * lose a fight the wall was supposed to win. On heavy ground — forest blocks
 * one cell in six, mountains nearly one in four — the middle of the field
 * fragments into pockets, adjacency breaks, and holding the line stops paying
 * for itself. This guarantees somewhere on the field where four can stand
 * abreast, whatever country the fight was rolled from.
 */
function ensureFront(grid: BattleTile[], rng: Rng): void {
  for (const row of MIDDLE_ROWS) {
    if (widestStand(grid, row) >= FRONT_WIDTH) return;
  }

  // Nowhere to form up: clear a stretch. Rough rather than open, because the
  // ground is still what it is — bog is bog, you just can stand in a line in
  // it. Only the impassable is moved.
  const row = rng.pick(MIDDLE_ROWS);
  const start = rng.int(0, Math.max(0, FIELD_WIDTH - FRONT_WIDTH));
  for (let col = start; col < start + FRONT_WIDTH; col += 1) {
    const tile = grid[cell(col, row)];
    if (tile && !isPassable(tile.ground)) tile.ground = 'rough';
  }
}

/** The longest run of ground in one row that people can actually stand in. */
export function widestStand(grid: BattleTile[], row: number): number {
  let best = 0;
  let run = 0;
  for (let col = 0; col < FIELD_WIDTH; col += 1) {
    const tile = grid[cell(col, row)];
    if (tile && isPassable(tile.ground)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

// --- A fight on the water ---

/** Which authored sea fight this is. Picked with the battle's own rng. */
export function pickSeaField(rng: Rng): SeaFieldDef {
  return rng.pick(SEA_FIELDS);
}

/**
 * The field for a fight afloat: two ships, parsed from an authored map.
 * Deployment is the standard two rows at each end — their deck and ours.
 */
export function seaFieldFrom(
  def: SeaFieldDef,
): Field {
  const grid = blankField();
  const warbandSpots: number[] = [];
  const foeSpots: number[] = [];

  for (let row = 0; row < FIELD_HEIGHT; row++) {
    for (let col = 0; col < FIELD_WIDTH; col++) {
      const i = cell(col, row);
      const mark = def.rows[row]?.[col] ?? '.';
      let ground: Ground = 'open';
      if (mark === ',') ground = 'rough';
      else if (mark === '#') ground = 'block';
      else if (mark === '~') ground = 'water';
      grid[i] = { ground };
      if (row >= FIELD_HEIGHT - 2 && ground !== 'block' && ground !== 'water') warbandSpots.push(i);
      if (row <= 1 && ground !== 'block' && ground !== 'water') foeSpots.push(i);
    }
  }
  return { grid, warbandSpots, foeSpots };
}

// --- The steading under attack ---

/** Where the palisade runs, and where its gate is. */
export const WALL_ROW = 5;

/**
 * Which authored approach this raid comes by.
 *
 * Filtered by what the steading actually holds — the sea cannot flank a
 * steading with no water, and raiders cannot come out of trees that are not
 * there — then picked with the raid's own rng, so two raids in one saga are
 * fought on different ground and a replay fights the same ones.
 */
export function pickRaidField(plotKinds: string[], rng: Rng): RaidFieldDef {
  const fits = RAID_FIELDS.filter((f) => !f.needs || plotKinds.includes(f.needs));
  return rng.pick(fits.length > 0 ? fits : RAID_FIELDS);
}

/**
 * The field for a raid: your own ground, with the hall at your back.
 *
 * Parsed from an authored map rather than rolled from terrain, because the
 * whole point of defending a place you built is that the ground reads as a
 * place. The palisade, if it stands, rises along the map's wall line with
 * its one gate; if it does not, the same approach is fought open — which is
 * the palisade read as ground rather than as a number.
 */
export function steadingFieldFrom(
  def: RaidFieldDef,
  hasPalisade: boolean,
): Field {
  const grid = blankField();
  const warbandSpots: number[] = [];
  const foeSpots: number[] = [];

  for (let row = 0; row < FIELD_HEIGHT; row++) {
    for (let col = 0; col < FIELD_WIDTH; col++) {
      const i = cell(col, row);
      const mark = def.rows[row]?.[col] ?? '.';

      let ground: Ground = 'open';
      if (mark === ',') ground = 'rough';
      else if (mark === '#' || mark === 'H') ground = 'block';
      else if (mark === '~') ground = 'water';
      else if (mark === '=') ground = hasPalisade ? 'wall' : 'open';
      // '.' and 'G' are open ground; the gate is simply where the wall parts.

      grid[i] = { ground };
      // Defenders form up in the two rows immediately behind the palisade, so
      // a raider who climbs it lands within reach of somebody. Deploying them
      // back by the hall would hand the wall away for nothing.
      if (row >= WALL_ROW + 1 && row <= WALL_ROW + 2 && ground !== 'block') warbandSpots.push(i);
      if (row <= 1 && ground !== 'block') foeSpots.push(i);
    }
  }

  return { grid, warbandSpots, foeSpots };
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
    case 'ocean':
      return 'lashed hulls';
    case 'valley':
      return 'good grass';
    default:
      return 'open ground';
  }
}
