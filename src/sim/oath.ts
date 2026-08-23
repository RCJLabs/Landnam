// Holding a band to what it swore.
//
// The oath itself is raised by the blót card, which is pure data and uses the
// flag effect the deck already had — so swearing needs no new engine
// vocabulary and no new field in the save. What DOES need engine code is the
// part that makes an oath an oath: noticing when it is broken, and charging
// for it.
//
// The shape of the mechanic: a constraint the player takes on purpose, which
// pays heart if it is carried to the turn of the year and costs more than
// that, plus the good opinion of every neighbour on the coast, if it is not.
// Breaking one is meant to be the worse deal — an oath a player would happily
// break is not a constraint, it is a coupon.

import {
  OATHS,
  OATH_BROKEN_HEART,
  OATH_BROKEN_STANDING,
  OATH_FORESWORN,
  OATH_KEPT_HEART,
  OATH_MARK,
  OATH_SINCE,
  type OathDef,
} from '../data/oaths';
import { YEAR_LENGTH } from './calendar';
import { shiftStanding } from './neighbours';
import { chronicle } from './saga';
import type { GameState } from '../state/types';

/** The oath the band is under, or none. One at a time, on purpose. */
export function standingOath(state: GameState): OathDef | undefined {
  return OATHS.find((o) => (state.flags[o.flag] ?? 0) > 0);
}

/** The day it was sworn, once the engine has stamped it. */
export function sworeOn(state: GameState): number {
  return state.flags[OATH_SINCE] ?? 0;
}

/** How many oaths this band has broken. Nothing forgets it. */
export function foresworn(state: GameState): number {
  return state.flags[OATH_FORESWORN] ?? 0;
}

/** Clears the oath, whichever way it ended. */
function release(state: GameState, oath: OathDef): void {
  delete state.flags[oath.flag];
  delete state.flags[OATH_SINCE];
  delete state.flags[OATH_MARK];
}

/**
 * Has this oath been broken? One test per oath, and each is a comparison
 * against what was true when it was sworn — which is why the engine stamps a
 * mark rather than the card doing it: a card's effects carry constants, not
 * readings.
 */
function isBroken(state: GameState, oath: OathDef): boolean {
  if (oath.id === 'noSack') {
    return state.tally.sackings > (state.flags[OATH_MARK] ?? 0);
  }
  // holdFast: sworn on a hall, and the hall is gone from under them.
  return !state.settlement;
}

/**
 * One day of being held to it. Called from the day tick.
 *
 * Stamps the oath on the first day it stands, then watches. Returns true on
 * the day something happened, so a caller could say so.
 */
export function oathDay(state: GameState): boolean {
  const oath = standingOath(state);
  if (!oath) return false;

  // Newly sworn: record what it is measured against. The blót card raised a
  // flag with a constant in it; the reading has to be taken here.
  if (sworeOn(state) === 0) {
    state.flags[OATH_SINCE] = state.day;
    state.flags[OATH_MARK] = state.tally.sackings;
    chronicle(state, oath.sworn, 'saga');
    return true;
  }

  if (isBroken(state, oath)) {
    state.flags[OATH_FORESWORN] = foresworn(state) + 1;
    state.party.morale = Math.max(0, state.party.morale - OATH_BROKEN_HEART);
    // The coast hears. An oath is given in front of witnesses, which is the
    // whole reason it is worth anything.
    for (const n of state.neighbours) {
      if (!n.found) continue;
      shiftStanding(state, n.id, OATH_BROKEN_STANDING);
    }
    chronicle(state, oath.broken, 'grim');
    release(state, oath);
    return true;
  }

  if (state.day - sworeOn(state) >= YEAR_LENGTH) {
    state.party.morale = Math.min(100, state.party.morale + OATH_KEPT_HEART);
    chronicle(state, oath.kept, 'good');
    release(state, oath);
    return true;
  }
  return false;
}
