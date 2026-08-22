// The coast has teeth.
//
// Water was uniform: every coastal hex cost the same, risked the same
// nothing, and the only thing the sea could do to a hull was lose a fight
// with somebody. So the knarr's three-hex day — the whole reason she exists
// — was free speed with no case against it, and "hug the coast carefully"
// was a sentence in the guide rather than a decision on the map.
//
// Skerries are the case against it. Rocks lie in some coastal water, and a
// day's fast rowing crosses hexes rather than stopping in them, so the
// gamble is real and it is the player's: three hexes now, or one at a time
// through water you can read.
//
// The rocks themselves are DERIVED, not stored — a hash of the seed and the
// hex. That keeps them out of worldgen (whose hash is a contract with the
// C++ port), out of the save, and identical on every replay. What IS stored
// is what the band has learnt, because that is the part a saga earns.

import { key, line, type Hex } from '../hex';
import { stream } from '../rng';
import type { GameState } from '../state/types';
import { isCoastalWater } from './road';

/** Share of coastal water hiding rocks. */
export const SKERRY_SHARE = 0.16;

/** Odds a blind crossing finds them. */
export const STRIKE_BLIND = 0.3;

/**
 * Odds a crossing finds them when the band already has them charted.
 *
 * Not zero: knowing where a skerry lies is not the same as it not being
 * there. But it is the difference between a hazard and a hidden one, and it
 * is what makes charting worth the strake it cost to learn.
 */
export const STRIKE_CHARTED = 0.08;

/**
 * Rocks here. Pure: the same seed and hex always answer the same, so a
 * replay finds the coast exactly where it was.
 */
export function skerryAt(state: GameState, at: Hex): boolean {
  if (!isCoastalWater(state, at)) return false;
  // Never at the landing itself — the keel came ashore there, so the band
  // has already proved that water.
  if (key(at) === key(state.world.landing)) return false;
  return stream(state.seed, 'worldgen').derive(`skerry:${key(at)}`).next() < SKERRY_SHARE;
}

/** True once the band knows about these rocks. */
export function charted(state: GameState, at: Hex): boolean {
  return state.world.charted?.includes(key(at)) ?? false;
}

/** Mutates: the band writes a skerry onto its chart. */
export function chart(state: GameState, at: Hex): void {
  if (!state.world.charted) state.world.charted = [];
  const k = key(at);
  if (!state.world.charted.includes(k)) state.world.charted.push(k);
}

/**
 * The water a crossing actually passes through: every hex of the line but
 * the one being left. A three-hex row is three chances to find rocks, which
 * is exactly the cost the fast day is supposed to carry.
 */
export function crossed(from: Hex, to: Hex): Hex[] {
  return line(from, to).filter((h) => key(h) !== key(from));
}

/**
 * A crossing, and what the rocks made of it. Mutates: springs strakes and
 * writes the chart.
 *
 * Called with the water the band has just rowed over, so a fast three-hex
 * day rolls three times and a careful one-hex step rolls once. That is the
 * whole decision, and it is why this is charged per HEX CROSSED rather than
 * per day.
 */
export function rowThrough(state: GameState, from: Hex, to: Hex): {
  struck: Hex[];
  found: Hex[];
} {
  const struck: Hex[] = [];
  const found: Hex[] = [];
  for (const at of crossed(from, to)) {
    if (!skerryAt(state, at)) continue;
    const known = charted(state, at);
    const rng = stream(state.seed, 'events').derive(`skerry:${key(at)}:${state.day}`);
    if (rng.next() < (known ? STRIKE_CHARTED : STRIKE_BLIND)) {
      struck.push(at);
      // Struck rocks are charted rocks: nobody forgets where that was.
      if (!known) found.push(at);
      chart(state, at);
      continue;
    }
    // Passed clear — and a crew that has just felt the bottom go by knows
    // what is down there. Learning without paying for it is what makes the
    // second voyage along a coast different from the first.
    if (!known) {
      found.push(at);
      chart(state, at);
    }
  }
  return { struck, found };
}
