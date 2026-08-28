// Somewhere on the water worth going to.
//
// The sea was measured before this was written (see the item-23 probe in
// test/balance.test.ts) and the finding was not that the water was dull — it
// was that the water was EMPTY. The game offered a wet hex on a fifth of every
// band's moving days, a third of the menu on those days, and it was declined
// ninety-four times in a hundred. Nothing out there was worth the day, so
// nobody spent one, and every feature laid on top of the sea — skerries, the
// knarr's three-hex reach, the whole ship — was content behind a door that
// nobody opened.
//
// What the same measurements say bands actually WANT is food: starvation is
// the cause of eleven of every twenty endings, ahead of every other death in
// the game put together. So the reason the sea needed is a larder, and the
// sea already half had one — ocean paid 5 to a beach's 4, which is a gradient
// too thin to row for.
//
// A fishing ground is that gradient made worth the trip. It pays a multiple
// off the stretches that have one, and nothing off the stretches that do not,
// which is what makes where you camp a decision.
//
// DERIVED, not stored, like everything else the coast is made of: a fact that
// can be computed from `(seed, stop)` does not belong in a save.

import { stream } from '../rng';
import type { GameState } from '../state/types';
import { standingAt } from './coast';

/**
 * Share of the coast holding a ground.
 *
 * Sparse enough that finding one is worth something, common enough that a
 * band walking the line will pass several. Measured against the hex map's
 * ~122 coastal hexes per world this came to roughly a dozen and a half per
 * coast; on a 26-stop route it is three or four.
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
 * The multiple the water off this stretch pays a crew fishing it.
 *
 * The hex version refused to pay anybody standing on the beach BESIDE a
 * ground — being there meant floating on it, and that refusal was the entire
 * reason the ship got used. A route has no floating: rowing is a step and not
 * a state, so what pays the multiple is standing at a stop with a ground off
 * it, and the ship earns its keep elsewhere.
 */
export function fisheryYield(state: GameState): number {
  return groundAtStop(state.seed, standingAt(state)) ? GROUND_YIELD : 1;
}

/**
 * Is there a fishing ground off this stop of the coast?
 *
 * Derived from `(seed, stop)` like everything else on the route, so it needs
 * no state and the port gets it for free.
 */
export function groundAtStop(seed: string, stop: number): boolean {
  return stream(seed, 'worldgen').derive(`fishery:stop:${stop}`).next() < GROUND_SHARE;
}
