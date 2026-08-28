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

import type { GameState, Terrain, World } from '../state/types';
import { LEG_MAX, ROUTE_STOPS, daysBetween, onRoute, stopAt } from './route';
import {
  SEASON_LENGTH, SEASON_ORDER, daysUntilNextSeason, nextSeason, seasonOf,
} from './calendar';
import { foodPerDay } from './upkeep';
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

/**
 * What country the band is standing in.
 *
 * The seam the whole conversion turns on, and the reason it is one function
 * rather than fifteen: `state.world.tiles[key(state.party.at)]?.terrain ??
 * 'meadow'` appears verbatim all over the sim, and every one of those is the
 * same question asked of a coordinate system that is being replaced.
 *
 * Off the flag it is that expression, character for character, so nothing
 * moves while the hex map is still the game.
 */
export function countryHere(state: GameState): Terrain {
  return stopAt(state.seed, standingAt(state)).country;
}

// --- What the band remembers of this coast ---
//
// The line's answer to `world.trod` and `world.seen`, and the two are kept
// apart here for the same reason the hex map keeps them apart: standing
// somewhere and knowing what is there are different facts. A trader names a
// monastery you have never walked to; you walk a stretch of empty shore and
// learn nothing but that it was empty.

/** Stops the band has actually stood on, with the day it first did. */
export function trodStops(state: GameState): Record<string, number> {
  return state.world.trodStops ?? {};
}

/** Has the band stood here? */
export function hasTrod(state: GameState, stop: number): boolean {
  return trodStops(state)[String(stop)] !== undefined;
}

/**
 * Records that the band is standing here today. Mutates; callers hold a
 * clone, as everywhere else in the sim.
 *
 * First-visit only, exactly like `world.trod` — the day a coast was first
 * walked is a fact a saga uses, and overwriting it every time the band comes
 * back would turn "we first saw it in spring" into "we were there Tuesday".
 */
export function markTrod(state: GameState, stop: number, day: number): void {
  if (!onRoute(stop)) return;
  const trod = (state.world.trodStops ??= {});
  if (trod[String(stop)] === undefined) trod[String(stop)] = day;
  // Standing somewhere is one way of learning what is there, and the
  // commonest one.
  learnStop(state, stop);
  // AND THE NEXT HEADLAND EITHER SIDE.
  //
  // This is `revealAround` for a line, and it was missing. When the fog pass
  // was cut in 8.2c the note said "a coast is walked, not surveyed" — right
  // about the RADIUS, wrong about sight itself, and the cost only showed up
  // when 8.3 put a picture of the road on screen: the procession bar walked
  // twelve stretches and never once had anything to draw ahead, because the
  // only stretch a band ever knew was the one under its feet.
  //
  // One stretch, which is two to four days' walk. A man on a coast can see
  // the next headland; he cannot see the one after it, and that is what
  // climbing a ridge is still for — `LANDMARK_REACH` is eight days and stays
  // the way you see further than your own legs.
  for (const near of [stop - 1, stop + 1]) learnStop(state, near);
}

/** Does the band know what stands at this stop? */
export function knowsStop(state: GameState, stop: number): boolean {
  return (state.world.knownStops ?? []).includes(stop);
}

/** Marks a stretch of coast known, however the band came to know it. */
export function learnStop(state: GameState, stop: number): void {
  if (!onRoute(stop)) return;
  const known = (state.world.knownStops ??= []);
  if (!known.includes(stop)) {
    known.push(stop);
    // Sorted so the strip map and the saga read them seaward, and so two
    // sagas that learned the same coast in a different order still save the
    // same bytes.
    known.sort((a, b) => a - b);
  }
}

/**
 * Is this high enough ground to see along the coast from?
 *
 * `fog.onHighGround` counts hills and mountains. A route's country never
 * includes mountains — see `route.COUNTRY`, which is shore and not summit —
 * so on a line this is hills, and it means the same thing it meant: the one
 * kind of stretch where climbing pays in knowledge.
 */
export function onHeights(state: GameState, stop = standingAt(state)): boolean {
  return stopAt(state.seed, stop).country === 'hills';
}

/**
 * Days until the next winter shuts the coast, from any day of any year.
 *
 * NOT `calendar.daysUntilWinter`, and the difference is the whole reason
 * this exists. That one counts down to day 49 and answers 0 for every day
 * after it — a first-winter warning helper, which is what it is used for and
 * what its own comment says. Read as a general deadline it tells a band in
 * the autumn of year three that nothing is coming, and the chart would then
 * offer them the whole coast on the strength of a full larder.
 *
 * Zero while winter is actually here: the season has stopped being a
 * deadline the walking can beat, and the packs are the whole of the answer.
 */
function daysUntilNextWinter(day: number): number {
  if (seasonOf(day) === 'winter') return 0;
  let days = daysUntilNextSeason(day);
  let season = nextSeason(day);
  // At most the three seasons that are not winter; the guard is a backstop,
  // not a bound anything real reaches.
  for (let i = 0; i < SEASON_ORDER.length && season !== 'winter'; i += 1) {
    days += SEASON_LENGTH;
    season = SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % SEASON_ORDER.length]!;
  }
  return days;
}

/**
 * Days the band could keep walking on what it is carrying.
 *
 * `pushLimit` deliberately does not guess which clock the caller means —
 * food, or the days until the season turns — because those are different
 * questions. This answers the one the CHART asks, and the chart asks the
 * player's question: how far can I go before something stops me.
 *
 * The smaller of the two, because a band does not get to pick which one runs
 * out first.
 */
export function daysInHand(state: GameState): number {
  const perDay = foodPerDay(state);
  const onFood = perDay > 0 ? Math.floor(state.party.food / perDay) : ROUTE_STOPS * LEG_MAX;
  const toWinter = daysUntilNextWinter(state.day);
  return toWinter > 0 ? Math.min(onFood, toWinter) : onFood;
}

/**
 * How much of the coast this saga has learned, 0..1.
 *
 * Was `sim/fog.ts`'s, where it divided the seen hexes by the tile count. A
 * line has no fog: what a band knows is the stretches it knows.
 */
export function exploredFraction(world: World): number {
  return (world.knownStops?.length ?? 0) / ROUTE_STOPS;
}
