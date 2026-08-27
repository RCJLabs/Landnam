// Putting a band on ground it can build on — once, for every test that needs
// one.
//
// Twenty-two test files carried their own copy of this. Every copy did the
// same thing: sweep `world.tiles`, keep the best `siteReport` the band could
// legally take, put the posts in. That was fine while there was one
// coordinate system and became a liability the day there were two — the
// conversion has to change twenty-two hex searches, or it changes one.
//
// Measured before it was written: with `COAST_IS_A_LINE` flipped on, 148
// tests across 39 files fail, and the single commonest cause by a wide
// margin is this fixture reporting "nothing foundable". Not thirty bugs —
// one duplicated helper, thirty times over. `coastWalk.test.ts` had already
// hit it and been fixed in place, which is what made the pattern visible.
//
// So this knows both worlds and picks by the flag. A test that wants a
// steading says so and stops caring what the country is made of.
//
// The copies split into two families and the difference was measured rather
// than assumed: eleven took the BEST ground by `siteReport`, and eight took
// the FIRST hex the sweep found that would take posts. Unifying on the best
// looked like it would move eight files' numbers — a better site yields more,
// and `rations`, `counsel` and `minds` all measure yields. It moved none of
// them: all twenty-six files are green on the shared search. The reason is
// that the ground-quality spread inside one island is small next to what
// those files vary. Where it WOULD have mattered the caller now says so out
// loud — `cliff` and `hardship` pass `radius: Infinity` because their numbers
// were measured on the best ground in the world and mean nothing off it.

import { expect } from 'vitest';
import { cloneState } from '../../src/state/clone';
import { newGame } from '../../src/state/create';
import { distance, fromKey, type Hex } from '../../src/hex';
import { canFound, foundSettlement, siteReport, stopReport } from '../../src/sim/site';
import { learnStop } from '../../src/sim/coast';
import { ROUTE_STOPS } from '../../src/sim/route';
import { COAST_IS_A_LINE } from '../../src/sim/flags';
import type { GameState, HardshipId } from '../../src/state/types';

export interface SettleOptions {
  /**
   * How far from the landing to look, in hexes on a map and in stretches on
   * a coast.
   *
   * The copies that took this used it for the same reason — a steading the
   * band could plausibly have walked to, rather than one across the island —
   * and every one of them fell back to the whole world if the near ground
   * would not take posts. That fallback is kept: a fixture that throws
   * because one seed is stony is a fixture that makes tests flaky.
   */
  radius?: number;
  /**
   * Fill the packs to 200 food and 200 firewood.
   *
   * OFF by default, and the default is the whole point. The first draft had
   * it on — "most callers want a fed band" — and two tests went red at once:
   * the build-order measurement in `buildings.test.ts` and the winter
   * forecast in `winter.test.ts`. Neither of the copies this replaced
   * stocked anything, and both files exist to measure what SCARCITY does. A
   * fixture that quietly hands every band a full larder does not fail those
   * tests, it answers a different question and reports the answer as theirs.
   *
   * Exactly one of the twenty-two copies stocked, and it now asks.
   */
  stock?: boolean;
  /**
   * The terms the run is played on, handed straight to `newGame`.
   *
   * Only `hardship.test.ts` wants this, and it wants it because the terms
   * ride on the RUN — a band founded under `newGame(seed)` and then told it
   * is on hard terms would be measuring a state no player can reach.
   */
  hardship?: HardshipId;
  /**
   * `'best'` takes the highest-scoring ground in reach; `'first'` takes the
   * first that will have them at all.
   *
   * Added for `colony.test.ts`, which carries BOTH searches on purpose and
   * documents the difference: its `settledWell` is "what a player who read
   * the panel and spent a week looking would end up with", and its `settled`
   * is "the first hex that will have them, which is a different and much
   * bleaker measurement". Several of its claims are about a POOR steading, so
   * flattening the two would quietly re-ask them of a good one.
   *
   * Every other caller wanted the best, and the two families were measured
   * against each other before being unified — see the header. This is the one
   * place the difference was load-bearing, and it now says so.
   */
  pick?: 'best' | 'first';
}

/**
 * The best ground within reach that will take a hall, or the best anywhere.
 *
 * Returns the state with the posts already in. Throws through `expect` rather
 * than returning null, because every caller treated a missing site as a bug
 * in the fixture and not a case to handle.
 */
export function settled(seed: string, options: SettleOptions = {}): GameState {
  const { radius = 14, stock = false, hardship, pick = 'best' } = options;
  const state = cloneState(hardship ? newGame(seed, hardship) : newGame(seed));

  if (COAST_IS_A_LINE) {
    for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
    let best: number | null = null;
    let score = -1;
    for (const reach of [radius, ROUTE_STOPS]) {
      for (let stop = 0; stop < Math.min(ROUTE_STOPS, reach + 1); stop += 1) {
        state.party.stop = stop;
        if (!canFound(state, state.party.at)) continue;
        const total = stopReport(seed, stop).total;
        if (total > score) { score = total; best = stop; }
        if (pick === 'first') break;
      }
      if (best !== null) break;
    }
    expect(best, `${seed}: no stretch of this coast would take a hall`).not.toBeNull();
    state.party.stop = best!;
  } else {
    for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
    const landing = state.world.landing;
    let best: Hex | null = null;
    let score = -1;
    for (const reach of [radius, Infinity]) {
      for (const k of Object.keys(state.world.tiles)) {
        const at = fromKey(k);
        if (distance(at, landing) > reach) continue;
        state.party.at = at;
        if (!canFound(state, at)) continue;
        const report = siteReport(state.world, at)!;
        if (report.total > score) { score = report.total; best = at; }
        if (pick === 'first') break;
      }
      if (best) break;
    }
    expect(best, `${seed}: nothing foundable`).toBeTruthy();
    state.party.at = best!;
  }

  expect(foundSettlement(state), `${seed}: the posts would not go in`).toBe(true);
  if (stock) {
    state.party.food = 200;
    state.party.firewood = 200;
  }
  return state;
}

/**
 * Where a band can stand and put posts in, without founding.
 *
 * For the tests that want to check the REFUSAL rather than the steading —
 * `canFound` is the thing under test there, so the fixture must not have
 * spent it.
 */
export function foundableSpot(state: GameState): boolean {
  if (COAST_IS_A_LINE) {
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      learnStop(state, stop);
      state.party.stop = stop;
      if (canFound(state, state.party.at)) return true;
    }
    return false;
  }
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.world.seen[k] = 'seen';
    state.party.at = at;
    if (canFound(state, at)) return true;
  }
  return false;
}
