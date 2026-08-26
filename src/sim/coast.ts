// Walking the coast: what `road.ts` is to the hex map, for the line.
//
// `route.ts` is pure — it knows what the coast IS, given a seed. This knows
// what a band can do on it today, which needs the band: whether they are
// settled, what the ship is worth, how many days a step costs and what it
// spends.
//
// The whole decision this milestone exists for lives in two functions.
// `walkOptions` offers forward and back, and `daysToWalk` prices them — and
// because the price is the same in both directions, every step outward is a
// step that has to be paid for twice. That is the sentence 8.2 is measured
// against: how far up the coast do I push before the season turns me back?

import type { GameState } from '../state/types';
import { ROUTE_STOPS, daysBetween, onRoute, stopAt } from './route';
import { unseaworthy } from './ship';

/**
 * Stops a knarr covers in a day's rowing, against one on foot.
 *
 * The ship's whole worth on a line, and the direct heir of `ROW_REACH` on the
 * hex map — where being afloat made a day worth three hexes instead of one.
 * Same number, same reason: without it the knarr is a thing that sits on the
 * beach being expensive.
 */
export const SHIP_REACH = 3;

/** Can the band take to the water at all? */
export function canRow(state: GameState): boolean {
  return !unseaworthy(state.ship);
}

/**
 * Where the band is on the coast.
 *
 * Absent on a save written before the route existed, which is every save so
 * far — the landing is stop 0 and that is where a band that has never walked
 * the line is standing.
 */
export function standingAt(state: GameState): number {
  const at = state.party.stop ?? 0;
  return onRoute(at) ? at : 0;
}

/**
 * Days to walk from where the band is to a stop.
 *
 * Null when it is not a step they can make. Rowing covers up to `SHIP_REACH`
 * stops for one day; on foot it is one stop for the length of that leg.
 */
export function daysToWalk(state: GameState, to: number): number | null {
  const from = standingAt(state);
  if (!onRoute(to) || to === from) return null;
  const stops = Math.abs(to - from);
  if (stops === 1) return stopAt(state.seed, Math.max(from, to)).leg;
  if (stops <= SHIP_REACH && canRow(state)) {
    // A day at the oars, whatever the legs would have cost on foot. The
    // saving IS the ship: three stops of coast for one day rather than the
    // six-to-twelve those legs are worth walked.
    return 1;
  }
  return null;
}

/**
 * Is this a step the band can take right now?
 *
 * The settled rule is `road.ts`'s, unchanged and for the same reason: a band
 * with a hall does not wander off it, and an expedition is how they leave.
 */
export function canWalk(state: GameState, to: number): boolean {
  if (state.end) return false;
  if (state.settlement && !state.expedition) return false;
  return daysToWalk(state, to) !== null;
}

/**
 * Every stop the band could step to today.
 *
 * Forward, back, and — with a hull under them — as far as a day at the oars
 * reaches in either direction. Nearest first, so the strip map draws them in
 * the order a player reads them.
 */
export function walkOptions(state: GameState): number[] {
  if (state.settlement && !state.expedition) return [];
  const from = standingAt(state);
  const out: number[] = [];
  const span = canRow(state) ? SHIP_REACH : 1;
  for (let d = 1; d <= span; d += 1) {
    for (const to of [from - d, from + d]) {
      if (canWalk(state, to)) out.push(to);
    }
  }
  return out;
}

/**
 * How far out the band could get and still come home on what they carry.
 *
 * The question the design is built on, answered in one call rather than left
 * to the player to work out from a strip map. Deliberately conservative: it
 * counts the walk home from wherever it says they can reach, so a band that
 * takes this at its word is never stranded by it.
 *
 * `days` is what they have — the caller decides whether that is food, the
 * days until the season turns, or the smaller of the two, because those are
 * different questions and this should not guess which one is being asked.
 */
export function pushLimit(state: GameState, days: number): number {
  const from = standingAt(state);
  let best = from;
  for (let to = from + 1; to < ROUTE_STOPS; to += 1) {
    const thereAndBack = daysBetween(state.seed, from, to) * 2;
    if (thereAndBack > days) break;
    best = to;
  }
  return best;
}
