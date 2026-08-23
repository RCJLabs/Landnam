// The one mark the band leaves on the country.
//
// Everything else the world does to the band: winter comes, the sea springs
// a strake, another landnamsmadr fences the good ground. The band's own work
// went into a steading and stopped at its fence — the map itself was a
// fixed thing to be walked over, identically, on the four hundredth day as
// on the first.
//
// A made way is the exception. It is slow — days of the band's own time, on
// ground that pays nothing while they work it — and it is permanent, and it
// is the only thing here that outlives whoever dug it. What it buys is the
// journey you take AGAIN: the road to the neighbour you trade with, the way
// out to the coast the raids go from.

import { key, line, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState } from '../state/types';

/** What a made way costs a hex to enter. A road walks like a meadow. */
export const WAY_EFFORT = 1;

/** True where the band has broken ground. */
export function madeWay(state: GameState, at: Hex): boolean {
  return state.world.made?.[key(at)] !== undefined;
}

/**
 * Days of work to cut a way through this hex: the ground's own cost.
 *
 * So a bog is three days and a mountain pass four, and a meadow is not worth
 * anybody's time — which is why `wayBlocker` refuses it rather than selling
 * the band a day for nothing.
 */
export function wayDays(state: GameState, at: Hex): number {
  const tile = state.world.tiles[key(at)];
  if (!tile) return 0;
  return Math.max(1, Math.round(terrainDef(tile.terrain).cost));
}

/**
 * How far a day carries the band along a made way.
 *
 * The whole mechanic, and it exists because of a measurement that killed the
 * first version. A way was going to buy a point of effort — and a day is
 * `ceil(effort / 2)`, so on forest and hills, the two commonest hard grounds,
 * cutting a way cost two days and saved LITERALLY NOTHING per crossing. The
 * day-cost model cannot express "a bit faster" at this granularity; it is
 * the same wall `ROW_REACH` hit, and this is the same answer. A made way
 * covers GROUND: two hexes of it in the day one hex of rough country takes.
 *
 * Which turns the verb into the thing a road actually is. One made hex is
 * nearly worthless; a CHAIN of them is a road, and the band builds it.
 */
export const WAY_REACH = 2;

export type WayBlock = 'sea' | 'made' | 'rock' | 'unknown';

export const WAY_REASON: Record<WayBlock, string> = {
  sea: 'There is no ground here to break.',
  made: 'The way through here is already made.',
  rock: 'Bare rock. Nothing short of a season would cut through this.',
  unknown: 'We have not stood on that ground.',
};

/**
 * Why the band cannot cut a way here, or null if they can.
 *
 * Easy ground is deliberately ALLOWED. An earlier cut of this refused it —
 * "it would pay back nothing" — which was true of a lone hex and wrong about
 * the mechanic: a chain that has to jump a meadow is not a road. Cutting a
 * meadow costs one day and buys the link, and the deed sheet says so rather
 * than the rules forbidding it.
 */
export function wayBlocker(state: GameState, at: Hex): WayBlock | null {
  const tile = state.world.tiles[key(at)];
  if (!tile) return 'unknown';
  if (tile.terrain === 'ocean') return 'sea';
  if (madeWay(state, at)) return 'made';
  if (!Number.isFinite(terrainDef(tile.terrain).cost)) return 'rock';
  return null;
}

export function canMakeWay(state: GameState, at: Hex): boolean {
  return wayBlocker(state, at) === null;
}

/** True if every hex from here to there is ground the band has broken. */
export function wayable(state: GameState, from: Hex, to: Hex): boolean {
  if (!madeWay(state, from) || !madeWay(state, to)) return false;
  for (const step of line(from, to)) {
    if (!madeWay(state, step)) return false;
  }
  return true;
}

/** Mutates: the ground is broken, and stays broken. */
export function breakGround(state: GameState, at: Hex): void {
  if (!state.world.made) state.world.made = {};
  state.world.made[key(at)] = state.day;
}

/** What the chronicle says, by what was cut through. */
export function wayLine(state: GameState, at: Hex): string {
  const tile = state.world.tiles[key(at)]!;
  if (tile.river) {
    return 'We laid stone in the river until a man could cross it dry, and it will be there after us.';
  }
  if (tile.terrain === 'bog') {
    return 'We cut and laid brushwood across the bog until it held a foot, and the crossing was ours.';
  }
  if (tile.terrain === 'forest') {
    return 'We cut a way through the wood wide enough to drive a beast down.';
  }
  if (tile.terrain === 'mountains') {
    return 'We worked the pass until the loose rock was off it and a laden man could walk it.';
  }
  return 'We broke a way through, and the going here will be easier ever after.';
}
