// Where you are, said in words a person would use.
//
// The country had no fixed points. Every march line named a TERRAIN — "we
// moved on into hills" — so three days' walking read as the same day three
// times, and a player who passed one waterfall twice had nothing to tell
// them it was the same water. `Tile.landmark` existed as a field, pointed at
// a `data/landmarks` that was never written, and was set by nothing in
// either repo: the idea had been declared and never built.
//
// Landmarks are DERIVED from the seed, exactly as skerries are, for the same
// two reasons: worldgen's hash is a contract with the C++ port, and a fact
// that can be computed does not belong in a save. Which ones the band knows
// needs no field either — a landmark stands on a hex, and the fog already
// remembers which hexes have been seen.

import { distance, fromKey, key, neighbors, type Hex } from '../hex';
import { stream } from '../rng';
import { LANDMARKS, LANDMARK_MARKS, LANDMARK_ROOTS, landmarkDef } from '../data/landmarks';
import type { GameState, World } from '../state/types';

/** Share of eligible hexes carrying one. Sparse on purpose: a landmark that
 * is everywhere is scenery, and scenery is what this replaces. */
export const LANDMARK_SHARE = 0.045;

/** How far one can be picked out from high ground — the whole point of them. */
export const LANDMARK_REACH = 8;

/**
 * The landmark on this hex, or null. Pure and seeded, so the same country
 * has the same fixed points on every replay.
 */
export function landmarkAt(world: World, seed: string, at: Hex): string | null {
  const tile = world.tiles[key(at)];
  if (!tile) return null;
  const kinds = LANDMARKS.filter((l) => l.on.includes(tile.terrain));
  if (kinds.length === 0) return null;
  // A river hex is already distinctive, and a landmark on top of one reads
  // as clutter rather than as a fixed point.
  if (tile.river) return null;
  const rng = stream(seed, 'worldgen').derive(`landmark:${key(at)}`);
  if (rng.next() >= LANDMARK_SHARE) return null;
  return kinds[rng.int(0, kinds.length - 1)]!.id;
}

/** Its name, built once from the ground it stands on. */
export function landmarkName(world: World, seed: string, at: Hex): string | null {
  const id = landmarkAt(world, seed, at);
  if (!id) return null;
  const def = landmarkDef(id);
  const rng = stream(seed, 'worldgen').derive(`landmark-name:${key(at)}`);
  // Two shapes, so a country does not read as a list: "the Split Rock" and
  // "Ravenstone Falls".
  return rng.next() < 0.5
    ? `the ${rng.pick(LANDMARK_MARKS)} ${def.noun}`
    : `${rng.pick(LANDMARK_ROOTS)}${def.noun.toLowerCase()}`;
}

/** Every landmark the band has laid eyes on, nearest first. */
export function knownLandmarks(state: GameState): { at: Hex; name: string }[] {
  const out: { at: Hex; name: string }[] = [];
  for (const k of Object.keys(state.world.seen)) {
    const at = fromKey(k);
    const name = landmarkName(state.world, state.seed, at);
    if (name) out.push({ at, name });
  }
  return out.sort(
    (a, b) => distance(a.at, state.party.at) - distance(b.at, state.party.at),
  );
}

/**
 * The landmark the band is standing at or beside, if any.
 *
 * "Beside" counts: a waterfall is a thing you camp near, not a thing you
 * stand on, and a fixed point one hex away still tells you where you are.
 */
export function landmarkHere(state: GameState): { at: Hex; name: string } | null {
  for (const at of [state.party.at, ...neighbors(state.party.at)]) {
    if (!state.world.seen[key(at)]) continue;
    const name = landmarkName(state.world, state.seed, at);
    if (name) return { at, name };
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
export function spotFixedPoints(state: GameState, from: Hex): { at: Hex; name: string }[] {
  const found: { at: Hex; name: string }[] = [];
  const world = state.world;
  for (let dq = -LANDMARK_REACH; dq <= LANDMARK_REACH; dq++) {
    for (let dr = -LANDMARK_REACH; dr <= LANDMARK_REACH; dr++) {
      const at = { q: from.q + dq, r: from.r + dr };
      if (distance(at, from) > LANDMARK_REACH) continue;
      if (world.seen[key(at)] !== undefined) continue;
      const name = landmarkName(world, state.seed, at);
      if (!name) continue;
      world.seen[key(at)] = 'seen';
      found.push({ at, name });
    }
  }
  return found;
}
