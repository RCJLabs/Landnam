// What the land has left to give.
//
// Forage, hunt and fish paid the same yield on the hundredth day in a valley
// as on the first, so a band that found one good hex had no reason ever to
// leave it: camp, hunt, camp, hunt, and winter was a formality. The country
// was scenery. This makes it a larder with a bottom.
//
// The model is pressure that lifts with time, and it is stored LAZILY: a take
// folds the recovery since the last take into the number it writes, so there
// is no per-day tick, nothing to walk on load, and a hex nobody has worked
// costs the save nothing at all. `pressureAt` is therefore a pure function of
// (what was written, how long ago), which is what makes it testable and what
// keeps a replay honest.

import { key, type Hex } from '../hex';
import type { GameState, Worked } from '../state/types';
import { COAST_IS_A_LINE } from './flags';
import { standingAt } from './coast';

/** The three ways a day on the road puts food in the packs. */
export type Larder = 'forage' | 'hunt' | 'fish';

/**
 * Days for one day's take to grow back.
 *
 * Deliberately short: the point is to move camp, not to write off a valley.
 * Sixteen days means a hex worked hard on the way out is worth something
 * again on the way back.
 */
export const REGROW_DAYS = 20;

/**
 * Days a band may work a hex before it notices — and the most important
 * number here.
 *
 * Without it the FIRST take was already taxed, and that is the take a
 * starving band makes: measured, the published survival odds for As It Lies
 * fell from 72% to 52%. Softening the slope barely helped (55%) while
 * gutting the decision, which is what proved the slope was never the
 * problem. A band passing through and eating for a day or two takes a full
 * yield, as it should — one band of six does not strip a valley in an
 * afternoon. Squatting is what costs.
 */
export const GRACE = 2;

/** What each worked day BEYOND the grace costs the next one. */
export const PRESSURE_STEP = 0.25;

/**
 * The least a worked-out hex will ever give, as a share of its full yield.
 *
 * Never zero. A hex that pays nothing is a trap rather than a decision — the
 * band can always take SOMETHING, it is just long past worth the day.
 */
export const THIN_FLOOR = 0.3;

/**
 * Where a worked larder is filed.
 *
 * A hex while the hex map is the game; a STOP on the coast, because that is
 * what a place is on a line. The record is sparse either way — only ground
 * somebody has actually worked appears in it — so the two addressings can
 * sit in one save without either inventing entries for the other.
 *
 * Known limit while the flag is scaffolding: on the coast this files
 * everything under the band's OWN stop, so a fishing ground worked from
 * somewhere else is not told apart from one worked from here. Nothing does
 * that yet — the colony's fishers are 8.4's problem and the coast has no
 * distant working — but it is a real narrowing and not an oversight.
 */
function slot(state: GameState, kind: Larder, at: Hex): string {
  if (COAST_IS_A_LINE) return `${kind}:s${standingAt(state)}`;
  return `${kind}:${key(at)}`;
}

/**
 * How hard this hex is being worked right now, in days' take, with the
 * recovery since the last one already subtracted.
 */
export function pressureAt(state: GameState, kind: Larder, at: Hex): number {
  const t: Worked | undefined = state.world.worked?.[slot(state, kind, at)];
  if (!t) return 0;
  return Math.max(0, t.n - (state.day - t.day) / REGROW_DAYS);
}

/**
 * The share of its full yield this hex still pays: 1 on untouched ground,
 * falling a quarter with each day's take, floored so it never pays nothing.
 */
export function abundance(state: GameState, kind: Larder, at: Hex): number {
  const pressed = Math.max(0, pressureAt(state, kind, at) - GRACE);
  return Math.max(THIN_FLOOR, 1 - PRESSURE_STEP * pressed);
}

/** Mutates: records a day's take, carrying the recovery into the new figure. */
export function noteTake(state: GameState, kind: Larder, at: Hex): void {
  if (!state.world.worked) state.world.worked = {};
  state.world.worked[slot(state, kind, at)] = {
    n: pressureAt(state, kind, at) + 1,
    day: state.day,
  };
}

/**
 * What the band can SEE before spending the day — the whole reason this is
 * not an invisible tax. Tracks are thin, the berry ground is picked over,
 * the fish have moved off: the deed sheet says so before you commit.
 */
export function thinness(state: GameState, kind: Larder, at: Hex): 'good' | 'worked' | 'thin' {
  // Thresholds live inside the range the floor allows — [THIN_FLOOR, 1]. A
  // cut of this keyed to the old range left 'thin' unreachable the moment
  // the floor rose, which is a warning that can never fire.
  const left = abundance(state, kind, at);
  if (left > 0.85) return 'good';
  return left > 0.45 ? 'worked' : 'thin';
}

/** The word for it, in the sheet's voice. */
export function thinWord(kind: Larder, how: 'worked' | 'thin'): string {
  if (kind === 'hunt') {
    return how === 'thin' ? 'The game has been driven off this ground.' : 'The tracks here are old.';
  }
  if (kind === 'fish') {
    return how === 'thin' ? 'This water has been netted out.' : 'The nets have had a lot from here.';
  }
  return how === 'thin' ? 'This ground is picked bare.' : 'The best of the berries are gone.';
}
