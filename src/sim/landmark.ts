// Where you are, said in words a person would use.
//
// The country had no fixed points. Every march line named a TERRAIN — "we
// moved on into hills" — so three days' walking read as the same day three
// times, and a player who passed one waterfall twice had nothing to tell
// them it was the same water. `Tile.landmark` existed as a field, pointed at
// a `data/landmarks` that was never written, and was set by nothing in
// either repo: the idea had been declared and never built.
//
// Landmarks are DERIVED from `(seed, stop)`, like everything else the coast
// is made of: a fact that can be computed does not belong in a save. Which
// ones the band knows needs no field either — a landmark stands on a stretch,
// and `knownStops` already remembers which stretches have been learned.

import { makeRng } from '../rng';
import { LANDMARKS, LANDMARK_MARKS, LANDMARK_ROOTS, landmarkDef } from '../data/landmarks';
import type { GameState } from '../state/types';
import { ROUTE_STOPS, daysBetween, onRoute, stopAt } from './route';
import { knowsStop, learnStop, onHeights, standingAt } from './coast';

/** Share of eligible hexes carrying one. Sparse on purpose: a landmark that
 * is everywhere is scenery, and scenery is what this replaces. */
export const LANDMARK_SHARE = 0.045;

/** How far one can be picked out from high ground — the whole point of them. */
export const LANDMARK_REACH = 8;

/**
 * Share of eligible STOPS carrying one, when the coast is a line.
 *
 * A separate number from `LANDMARK_SHARE`, and it has to be: that one is per
 * HEX over roughly 1139 of them, on a map where a saga stands on eight. A
 * coast is 26 stops and a band walks most of the ones it reaches, so the same
 * 0.045 makes a different game rather than the same one seen from the side.
 *
 * Measured over 300 seeded coasts before it was chosen, counting named stops
 * per coast and how many a ten-stop walk actually meets:
 *
 *   share   named of 25 (min-med-max)   met on a 10-stop walk (median)
 *   0.045   0-1-6                       0 — nothing at all on 192 of 300
 *   0.15    0-3-9                       1 — nothing on 68 of 300
 *   0.25    1-6-13                      2 — nothing on 17 of 300
 *   0.34    2-8-15                      3 — nothing on 7 of 300
 *   0.50    3-12-19                     5 — nothing on 1 of 300
 *
 * The hex map's own number is the top line, and it is the one that fails:
 * carried over unchanged it gives a median coast ONE named point and leaves
 * two walks in three with nothing to remember a stretch by, which is exactly
 * the disease this module was written against.
 *
 * A third, because the ceiling is real too. Roughly four places and four
 * neighbours already sit on a 26-stop coast, so about seventeen stretches
 * are bare country; a third of the coast named gives about half of those a
 * name and leaves the rest as country. Going to a half starts making the
 * module's own rule false — a landmark that is everywhere is scenery.
 */
export const LANDMARK_SHARE_STOP = 0.34;

/**
 * The landmark on this stretch of coast, or null.
 *
 * Two questions in order — can this country carry one, and did the dice put
 * one here — asked of `(seed, stop)` so the coast is derived rather than
 * stored, like everything else in route.ts. The landing carries none: it is
 * named already, by the saga's first line.
 */
export function landmarkAtStop(seed: string, stop: number): string | null {
  if (!onRoute(stop) || stop === 0) return null;
  const country = stopAt(seed, stop).country;
  const kinds = LANDMARKS.filter((l) => l.on.includes(country));
  if (kinds.length === 0) return null;
  const rng = makeRng(`landnam-route:${seed}:${stop}:landmark`);
  if (rng.next() >= LANDMARK_SHARE_STOP) return null;
  return kinds[rng.int(0, kinds.length - 1)]!.id;
}

/** Its name, built once from the coast it stands on. */
export function landmarkNameAtStop(seed: string, stop: number): string | null {
  const id = landmarkAtStop(seed, stop);
  if (!id) return null;
  const def = landmarkDef(id);
  const rng = makeRng(`landnam-route:${seed}:${stop}:landmark-name`);
  return rng.next() < 0.5
    ? `the ${rng.pick(LANDMARK_MARKS)} ${def.noun}`
    : `${rng.pick(LANDMARK_ROOTS)}${def.noun.toLowerCase()}`;
}

/**
 * A fixed point on the coast: the stretch it stands on and what it is called.
 *
 * `{ at: Hex; name }` until 8.5, where the hex was always the `{q:0,r:0}`
 * placeholder every coast address carried and the stop was the real answer.
 */
export interface Landmark {
  stop: number;
  name: string;
}

/** Every landmark the band has laid eyes on, nearest first. */
export function knownLandmarks(state: GameState): Landmark[] {
  // Sorted by days rather than by stops, because the legs are not evenly
  // long and "nearest" has to mean nearest to walk.
  const here = standingAt(state);
  const found: Landmark[] = [];
  for (let s = 0; s < ROUTE_STOPS; s += 1) {
    if (!knowsStop(state, s)) continue;
    const name = landmarkNameAtStop(state.seed, s);
    if (name) found.push({ stop: s, name });
  }
  return found.sort(
    (a, b) => daysBetween(state.seed, a.stop, here) - daysBetween(state.seed, b.stop, here),
  );
}

/**
 * The landmark the band is standing at or beside, if any.
 *
 * "Beside" counts: a waterfall is a thing you camp near, not a thing you
 * stand on, and a fixed point one hex away still tells you where you are.
 */
export function landmarkHere(state: GameState): Landmark | null {
  // "Beside" counts, and on a line it is if anything truer: a stop is a
  // stretch of coast, and the waterfall at the end of the last one is still
  // the thing you took your bearings from this morning.
  const here = standingAt(state);
  for (const s of [here, here - 1, here + 1]) {
    if (!onRoute(s) || !knowsStop(state, s)) continue;
    const name = landmarkNameAtStop(state.seed, s);
    if (name) return { stop: s, name };
  }
  return null;
}

/**
 * The band knows where it is.
 *
 * This is what wayfinding BUYS: weather takes sight away — fog and gales
 * close the country in — and a known fixed point does not give you longer
 * eyes, it gives you your bearings. So the sky's penalty is cancelled beside
 * a landmark, and nothing else about sight changes.
 */
export function keepsBearings(state: GameState): boolean {
  return landmarkHere(state) !== null;
}

/**
 * Landmarks picked out from a ridge: the reason to climb one.
 *
 * Mutates: lifts the fog on the hex a landmark stands on, out to
 * LANDMARK_REACH — much further than ordinary sight, which is what makes a
 * landmark a landmark rather than a view.
 */
export function spotFixedPoints(state: GameState): Landmark[] {
  const found: Landmark[] = [];
  // Reach counted in DAYS, which is what the hex number already was — a hex
  // was a day's walk. From a hilly stretch you can see LANDMARK_REACH days of
  // coast in both directions, which is the whole reason to be standing on it.
  if (!onHeights(state)) return found;
  const here = standingAt(state);
  for (let s = 0; s < ROUTE_STOPS; s += 1) {
    if (knowsStop(state, s)) continue;
    if (daysBetween(state.seed, here, s) > LANDMARK_REACH) continue;
    const name = landmarkNameAtStop(state.seed, s);
    if (!name) continue;
    // Marks the stretch KNOWN and nothing else.
    learnStop(state, s);
    found.push({ stop: s, name });
  }
  return found;
}
