// The knarr as a thing rather than a flag.
//
// What she is for: the sea already had fights, cargo over the side, salvage
// and the strandhögg, and every one of them worked off `party.hullHoled` —
// one bit, two states, mended in a night. A vessel with a name, a condition
// that grades, and a hold that holds something is the spine those verbs were
// written against and never had.
//
// The one rule that constrains all of it, kept from `sea.ts`: SHORT OF SUNK.
// A run must end by decision, not by one bad fight on the water. So the worst
// that can happen to her is that she will not swim until she is mended — and
// because `isCoastalWater` only ever lets the band float on water that
// touches land, a hull with nothing left can always be rowed the one hex
// ashore to be put right.

import type { GameState, Ship } from '../state/types';
import {
  HOLD_PER_STRAKE,
  HOLD_WHOLE,
  KNARR_NAMES,
  SHIP_STRAKES,
  STRAKE_MEND_WOOD,
} from '../data/ships';
import { stream } from '../rng';

/** The ship a new saga comes ashore in. Named off the seed, so replays hold. */
export function makeShip(seed: string): Ship {
  return {
    name: stream(seed, 'worldgen').derive('knarr').pick(KNARR_NAMES),
    strakes: SHIP_STRAKES,
  };
}

/** Strakes sprung and not yet mended. */
export function sprung(ship: Ship): number {
  return Math.max(0, SHIP_STRAKES - ship.strakes);
}

/** She is making water — the old `hullHoled`, now a matter of degree. */
export function holed(ship: Ship): boolean {
  return ship.strakes < SHIP_STRAKES;
}

/** Nothing sound left. She floats, but she will not be rowed anywhere. */
export function unseaworthy(ship: Ship): boolean {
  return ship.strakes <= 0;
}

/**
 * What she can carry today.
 *
 * Whole, more than the backs aboard her — which is the whole reason a
 * strandhögg takes more than walking up to the same gate. Sprung, less, and
 * that is the cost that makes a damaged hull a decision rather than a delay.
 */
export function hold(ship: Ship): number {
  return Math.max(0, HOLD_WHOLE - sprung(ship) * HOLD_PER_STRAKE);
}

/** The hold as a share of a whole one, for scaling what a raid brings home. */
export function holdShare(ship: Ship): number {
  return hold(ship) / HOLD_WHOLE;
}

/** A strake goes. Never past nothing — see the note at the top of this file. */
export function springStrake(ship: Ship): void {
  ship.strakes = Math.max(0, ship.strakes - 1);
}

/** Timber a full mend would take from the woodpile. */
export function mendCost(ship: Ship): number {
  return sprung(ship) * STRAKE_MEND_WOOD;
}

/**
 * One night's work on the beach: one strake, if there is timber for it.
 *
 * One a night rather than all of them at once, so a hull that took a beating
 * is several nights ashore — which is time, which is the thing autumn is
 * short of. A single sprung strake still mends in one night for two of
 * timber, exactly as `mendHull` always did.
 */
export function mendStrake(state: GameState): boolean {
  const ship = state.ship;
  if (!holed(ship)) return false;
  if (state.party.firewood < STRAKE_MEND_WOOD) return false;
  state.party.firewood -= STRAKE_MEND_WOOD;
  ship.strakes += 1;
  return true;
}
