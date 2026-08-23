// Somewhere on the water worth going to.
//
// The sea was measured before this was written (see the item-23 probe in
// test/balance.test.ts) and the finding was not that the water was dull — it
// was that the water was EMPTY. The game offers a wet hex on a fifth of every
// band's moving days, a third of the menu on those days, and it is declined
// ninety-four times in a hundred. Nothing out there was worth the day, so
// nobody spent one, and every feature laid on top of the sea — skerries, the
// knarr's three-hex reach, the whole ship — was content behind a door that
// nobody opened.
//
// What the same measurements say bands actually WANT is food: starvation is
// the cause of eleven of every twenty endings, ahead of every other death in
// the game put together. So the reason the sea needed is a larder, and the
// sea already half had one — ocean pays 5 to a beach's 4, which is a gradient
// too thin to row for.
//
// A fishing ground is that gradient made worth the trip. It pays a multiple,
// and it pays ONLY to a crew floating on it: the beach next door is still a
// beach. That is the whole design. You cannot walk to a fishing ground.
//
// DERIVED, not stored, for the two reasons everything else on this map is:
// worldgen's hash is a contract with the C++ port and must not move, and a
// fact that can be computed does not belong in a save. Nor does knowing about
// one need a field — the landmark note says it best: a ground sits on a hex,
// and the fog already remembers which hexes have been seen.

import { fromKey, key, neighbors, type Hex } from '../hex';
import { stream } from '../rng';
import type { GameState } from '../state/types';
import { isCoastalWater } from './road';

/**
 * Share of coastal water holding a ground.
 *
 * Sparse enough that finding one is worth something, common enough that a
 * band which looks at the sea at all will have one in reach. Measured against
 * ~122 coastal hexes per world, this is roughly a dozen and a half per coast,
 * in the same order as the 5.2 gates and 2.7 nameable waters that the coast
 * already has and nobody ever reached.
 */
export const GROUND_SHARE = 0.14;

/**
 * What a ground pays, as a multiple of the water's ordinary take.
 *
 * Set from the arithmetic of an actual trip, and the first cut of it was
 * wrong in a way worth keeping written down. It was picked as 2.6 by
 * reasoning about NET food per day, and measured at forty times the land
 * verbs over five days — a solved food problem rather than a reason to sail.
 * The error: upkeep is a flat 3 a day, so multiplying the GROSS take when the
 * baseline net is small is hugely leveraged. 2.6x gross is 4.3x net.
 *
 * The measured ground this is set against, one day on fresh ground, ten
 * worlds across four points of the year: upkeep 3.00/day; a valley's forage
 * grosses 5.72 for a net of 2.73; plain coastal water grosses exactly the
 * same, which is why the sea was never worth rowing to.
 *
 * A trip is two travel days at -3 each plus three days' fishing before the
 * larder thins (see GRACE in sim/abundance.ts). At 2x, a fresh day on a
 * ground nets about 8.4, so the five-day cycle returns 3.9 a day against 2.73
 * for staying home and foraging — about half again as good. Clearly worth the
 * launch; not enough to stop the winter being the thing that kills you.
 */
export const GROUND_YIELD = 2;

/**
 * A ground here. Pure and seeded, so the same coast has the same fish on
 * every replay.
 *
 * Coastal water only — not because the deep sea has no fish, but because the
 * knarr cannot work water with no shore in sight, and a ground she cannot
 * reach is a number in a file.
 */
export function groundAt(state: GameState, at: Hex): boolean {
  if (!isCoastalWater(state, at)) return false;
  return stream(state.seed, 'worldgen').derive(`fishery:${key(at)}`).next() < GROUND_SHARE;
}

/**
 * True once the band has laid eyes on this water.
 *
 * No field of its own, and no charting verb. Birds work a ground and can be
 * seen working it, so what tells a crew is the same thing that tells them
 * anything else about the country: they looked at it.
 */
export function knownGround(state: GameState, at: Hex): boolean {
  return groundAt(state, at) && state.world.seen[key(at)] !== undefined;
}

/**
 * The multiple this hex pays a crew fishing ON it.
 *
 * The `atSea` test is the load-bearing line in this file. A ground is a place
 * on the water, and standing on the beach beside it is not being there — that
 * refusal is the entire reason the ship gets used.
 */
export function fisheryYield(state: GameState, at: Hex): number {
  if (state.world.tiles[key(at)]?.terrain !== 'ocean') return 1;
  return groundAt(state, at) ? GROUND_YIELD : 1;
}

/** Grounds the band knows of, nearest first — for the map and the sheet. */
export function knownGrounds(state: GameState): Hex[] {
  const out: Hex[] = [];
  for (const k of Object.keys(state.world.seen)) {
    const at = fromKey(k);
    if (groundAt(state, at)) out.push(at);
  }
  return out;
}

/**
 * A ground within sight of where we stand, if there is one — the hook that
 * makes the sea legible from the land it is looked at from.
 */
export function groundInSight(state: GameState, from: Hex): Hex | null {
  for (const n of neighbors(from)) {
    if (knownGround(state, n)) return n;
  }
  return null;
}
