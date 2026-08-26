// The WALK verb, with the coast switched ON.
//
// A separate file for one reason: `COAST_IS_A_LINE` is a build-time constant
// and it is false, so every `WALK` the rest of the suite dispatches is
// refused before it does anything. That is correct — the game must not offer
// a coast that has nothing on it yet — and it leaves the whole verb as code
// no test executes.
//
// Which is the failure this repo keeps rediscovering under different names:
// a stream nobody proves is emitted quietly stays empty; a browser check that
// stopped running looked exactly like one that passed; a bar asserting an
// identity could never fail. Twenty-five lines of movement, day-spending and
// chronicle behind a constant nobody flips is the same shape of hole, and it
// would open the day the flag flips rather than the day it was written.
//
// So the flag is mocked on here and the verb is played for real.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/sim/flags', () => ({ COAST_IS_A_LINE: true }));

import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import { apply } from '../src/sim/actions';
import { SHIP_REACH, standingAt } from '../src/sim/coast';
import { ROUTE_STOPS, daysBetween, placeAt, stopAt } from '../src/sim/route';
import { placeKind } from '../src/data/places';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { placeHere, sackBlocker } from '../src/sim/places';
import { abundance, noteTake, thinness } from '../src/sim/abundance';
import { GROUND_YIELD, fisheryYield, groundAtStop } from '../src/sim/fishery';
import { canFish } from '../src/sim/gathering';
import { countryHere } from '../src/sim/coast';
import { fromKey } from '../src/hex';
import type { Action } from '../src/sim/actions';
import type { GameState } from '../src/state/types';

const SEED = 'raven-skerry-317';

function band(stop = 0, seed = SEED): GameState {
  const state = cloneState(newGame(seed));
  state.party.stop = stop;
  // Enough in the packs that a walk is not a starvation test.
  state.party.food = 400;
  state.party.firewood = 400;
  return state;
}

/**
 * Walk, dismissing whatever the days throw up on the way.
 *
 * Spending days raises event cards, and `applyTravel` refuses every verb
 * while one is up — which is right, and which the first draft of the
 * end-to-end walk did not know: it failed at stop 12 having walked into a
 * card and then read the refusal as a broken coast. Worth keeping as a
 * helper rather than a `try` in one test, because it is what a player does.
 */
function step(state: GameState, to: number): GameState {
  let cur = state;
  for (let guard = 0; guard < 8; guard += 1) {
    if (cur.event) {
      const card: Action = cur.event.outcome
        ? { type: 'DISMISS_EVENT' }
        : { type: 'CHOOSE', index: 0 };
      const next = apply(cur, card);
      if (next === cur) break;
      cur = next;
      continue;
    }
    return apply(cur, { type: 'WALK', to });
  }
  return cur;
}

/** A band with a hall, founded properly rather than faked. */
function withHall(seed: string): GameState {
  const state = cloneState(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  let best: GameState['party']['at'] | null = null;
  let score = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > score) { score = report.total; best = at; }
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.party.stop = 4;
  state.party.food = 400;
  state.party.firewood = 400;
  return state;
}

describe('the flag is on in here', () => {
  it('really is, or nothing below this proves anything', () => {
    const after = apply(band(4), { type: 'WALK', to: 5 });
    expect(standingAt(after), 'the mock did not take').toBe(5);
  });
});

describe('a step up the coast', () => {
  let state: GameState;
  beforeEach(() => { state = band(4); });

  it('puts the band at the stop they walked to', () => {
    expect(standingAt(apply(state, { type: 'WALK', to: 5 }))).toBe(5);
  });

  it('spends exactly the days that leg is worth', () => {
    const leg = stopAt(SEED, 5).leg;
    const after = apply(state, { type: 'WALK', to: 5 });
    expect(after.day - state.day).toBe(leg);
  });

  it('costs the same walking back as walking out', () => {
    // The milestone's whole premise, played rather than computed.
    const out = apply(state, { type: 'WALK', to: 5 });
    const back = apply(out, { type: 'WALK', to: 4 });
    expect(back.day - out.day).toBe(out.day - state.day);
    expect(standingAt(back)).toBe(4);
  });

  it('writes a line in the saga about the country it came to', () => {
    const after = apply(state, { type: 'WALK', to: 5 });
    expect(after.saga.length).toBeGreaterThan(state.saga.length);
  });

  it('costs a day at the oars, and puts the coast behind them', () => {
    const after = apply(state, { type: 'WALK', to: 4 + SHIP_REACH });
    expect(standingAt(after)).toBe(4 + SHIP_REACH);
    expect(after.day - state.day).toBe(1);
    // And the saving is the point: those legs walked are worth far more.
    expect(daysBetween(SEED, 4, 4 + SHIP_REACH)).toBeGreaterThan(1);
  });

  it('says a day at the oars differently from a day on foot', () => {
    // One voice for the whole game: `marchLine` already knows how to tell
    // those apart, and a coast that spoke its own way would read as a second
    // game rather than the same one seen from the side.
    const rowed = apply(state, { type: 'WALK', to: 4 + SHIP_REACH });
    const walked = apply(state, { type: 'WALK', to: 5 });
    const last = (s: GameState) => s.saga[s.saga.length - 1]!.text;
    expect(last(rowed)).not.toBe(last(walked));
  });
});

describe('what it refuses', () => {
  it('refuses to walk off either end of the coast', () => {
    const ashore = band(0);
    expect(apply(ashore, { type: 'WALK', to: -1 })).toBe(ashore);
    const far = band(ROUTE_STOPS - 1);
    expect(apply(far, { type: 'WALK', to: ROUTE_STOPS })).toBe(far);
  });

  it('refuses to spend a day standing still', () => {
    const state = band(6);
    expect(apply(state, { type: 'WALK', to: 6 })).toBe(state);
  });

  it('refuses a band that has a hall to be at', () => {
    // A real founding rather than a hand-made settlement object: the first
    // draft faked one and `apply` walked straight into a field it had not
    // bothered to invent. A fixture that only survives the code path it was
    // written against is not a fixture.
    const settled = withHall(SEED);
    expect(apply(settled, { type: 'WALK', to: 5 })).toBe(settled);
  });

  it('refuses to row a wrecked hull, and still lets them walk', () => {
    const state = band(4);
    state.ship.strakes = 0;
    expect(apply(state, { type: 'WALK', to: 4 + SHIP_REACH })).toBe(state);
    expect(standingAt(apply(state, { type: 'WALK', to: 5 }))).toBe(5);
  });
});

describe('what stands on the coast', () => {
  it('names a place the band walks into, in the words the data gives it', () => {
    // The find has to be told, and told in the game's own vocabulary rather
    // than by printing an id. A saga that reads "There was a monastery" is a
    // debug line wearing a chronicle's clothes.
    let told = false;
    for (let i = 1; i < ROUTE_STOPS && !told; i += 1) {
      const kind = placeAt(SEED, i);
      if (!kind) continue;
      const state = band(i - 1);
      const after = apply(state, { type: 'WALK', to: i });
      const said = after.saga.map((e) => e.text).join(' ');
      expect(said, `stop ${i}`).toContain(placeKind(kind).name);
      expect(said, `stop ${i} printed an id`).not.toContain(`: ${kind}.`);
      told = true;
    }
    expect(told, 'no place on the whole coast to walk into').toBe(true);
  });

  it('says nothing about a stop with nothing on it', () => {
    let quiet = false;
    for (let i = 1; i < ROUTE_STOPS && !quiet; i += 1) {
      if (placeAt(SEED, i)) continue;
      const state = band(i - 1);
      const after = apply(state, { type: 'WALK', to: i });
      // One line for the walking, and no second line inventing a landmark.
      expect(after.saga.length - state.saga.length).toBeLessThanOrEqual(1);
      quiet = true;
    }
    expect(quiet, 'every stop on the coast has something on it').toBe(true);
  });
});

describe('the whole coast, walked', () => {
  it('can be walked end to end, and the days add up', () => {
    // The milestone's own bar, played through `apply` rather than reckoned
    // from `route.ts` — which is the difference between a coast that exists
    // and a coast a band can get to the end of.
    let state = band(0);
    state.party.food = 5000;
    state.party.firewood = 5000;
    const began = state.day;
    for (let to = 1; to < ROUTE_STOPS; to += 1) {
      const next = step(state, to);
      expect(standingAt(next), `never got to ${to}`).toBe(to);
      state = next;
      if (state.end) break;
    }
    expect(standingAt(state), 'never reached the far headland').toBe(ROUTE_STOPS - 1);
    // The days are the coast's own arithmetic plus whatever the cards cost,
    // never less — a walk that came out cheaper than `daysBetween` would
    // mean a leg went unpaid for.
    expect(state.day - began).toBeGreaterThanOrEqual(daysBetween(SEED, 0, ROUTE_STOPS - 1));
  });
});

describe('the places stand on the coast', () => {
  it('seeds them at stops rather than hexes', () => {
    const world = band(0).world;
    expect(world.places.length, 'a coast with nothing on it').toBeGreaterThan(0);
    for (const p of world.places) {
      expect(p.stop, `${p.kind} has no stop`).toBeGreaterThan(0);
      expect(p.stop).toBeLessThan(ROUTE_STOPS);
    }
  });

  it('agrees with the route about where they are', () => {
    // Two derivations of the same fact would be two facts. The world's
    // places and `route.placeAt` must be the same answer.
    for (const p of band(0).world.places) {
      expect(placeAt(SEED, p.stop!), `stop ${p.stop}`).toBe(p.kind);
    }
  });

  it('is found by the band standing at its stop, and not from next door', () => {
    const there = band(0).world.places[0]!;
    const at = band(there.stop!);
    expect(placeHere(at)?.id).toBe(there.id);
    expect(placeHere(band(there.stop! - 1))).toBeUndefined();
  });

  it('cannot be taken from a stop away, and can be from its own', () => {
    const there = band(0).world.places[0]!;
    expect(sackBlocker(band(there.stop! - 1), there.id)).toBe('away');
    expect(sackBlocker(band(there.stop!), there.id)).toBeNull();
  });

  it('is standing there once the band has walked to it', () => {
    // Through `apply` rather than by setting `stop` by hand: the point is
    // that walking the coast arrives somewhere, not that the lookup works.
    const there = band(0).world.places.find((p) => p.stop! > 1)!;
    let state = band(there.stop! - 1);
    state = step(state, there.stop!);
    expect(standingAt(state)).toBe(there.stop);
    expect(placeHere(state)?.kind).toBe(there.kind);
  });
});

describe('the country underfoot', () => {
  it('is the stop’s country, not a hex’s', () => {
    for (const at of [0, 3, 9, ROUTE_STOPS - 1]) {
      expect(countryHere(band(at))).toBe(stopAt(SEED, at).country);
    }
  });

  it('changes as the band walks, which is the whole point of a coast', () => {
    // A line where every stop looked the same would be a corridor.
    const seen = new Set<string>();
    for (let at = 0; at < ROUTE_STOPS; at += 1) seen.add(countryHere(band(at)));
    expect(seen.size, 'the whole coast is one country').toBeGreaterThan(2);
  });
});

describe('the larder is a place on the coast', () => {
  it('thins the stop that was worked, and leaves the next one alone', () => {
    // The whole reason depletion exists, re-addressed: working one stretch
    // of coast hard has to be a reason to move on, not a global tax.
    const state = band(6);
    expect(abundance(state, 'forage', state.party.at)).toBe(1);
    for (let i = 0; i < 5; i += 1) noteTake(state, 'forage', state.party.at);
    const worn = abundance(state, 'forage', state.party.at);
    expect(worn, 'five days of foraging cost nothing').toBeLessThan(1);
    // The band walks on. The next stop has never been touched.
    state.party.stop = 7;
    expect(abundance(state, 'forage', state.party.at)).toBe(1);
    // And walking back finds it exactly as they left it.
    state.party.stop = 6;
    expect(abundance(state, 'forage', state.party.at)).toBe(worn);
  });

  it('keeps the two larders apart at one stop', () => {
    const state = band(6);
    for (let i = 0; i < 5; i += 1) noteTake(state, 'fish', state.party.at);
    expect(abundance(state, 'fish', state.party.at)).toBeLessThan(1);
    expect(abundance(state, 'forage', state.party.at), 'fishing thinned the berries').toBe(1);
  });

  it('says so before the day is spent', () => {
    // The deed sheet's warning, which is what makes this not an invisible
    // tax — and it has to survive the change of address or it is one.
    const state = band(6);
    expect(thinness(state, 'hunt', state.party.at)).toBe('good');
    for (let i = 0; i < 8; i += 1) noteTake(state, 'hunt', state.party.at);
    expect(thinness(state, 'hunt', state.party.at)).not.toBe('good');
  });
});

describe('the water off the coast', () => {
  it('is always there to put a net in', () => {
    // Every stop on a coast has the sea off it. On the hex map most of the
    // island was inland and this was a real question.
    for (const at of [0, 5, 13, ROUTE_STOPS - 1]) {
      expect(canFish(band(at)), `stop ${at}`).toBe(true);
    }
  });

  it('pays a ground’s multiple at the stops that have one', () => {
    const grounds: number[] = [];
    for (let at = 0; at < ROUTE_STOPS; at += 1) {
      if (groundAtStop(SEED, at)) grounds.push(at);
    }
    expect(grounds.length, 'not one fishing ground on the whole coast').toBeGreaterThan(0);
    expect(grounds.length, 'the entire coast is a fishing ground').toBeLessThan(ROUTE_STOPS);
    for (const at of grounds) {
      expect(fisheryYield(band(at), band(at).party.at)).toBe(GROUND_YIELD);
    }
    const bare = [...Array(ROUTE_STOPS).keys()].find((at) => !groundAtStop(SEED, at))!;
    expect(fisheryYield(band(bare), band(bare).party.at)).toBe(1);
  });

  it('puts the same grounds off the same coast every time', () => {
    for (let at = 0; at < ROUTE_STOPS; at += 1) {
      expect(groundAtStop(SEED, at)).toBe(groundAtStop(SEED, at));
    }
  });
});
