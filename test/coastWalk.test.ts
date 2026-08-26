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
import { canStrandhogg, strandTarget } from '../src/sim/sea';
import { placeKind as kindOf } from '../src/data/places';
import { countryHere } from '../src/sim/coast';
import {
  bargainBlocker, canFallOn, neighbourHere, neighboursCallOn, seeNeighbours,
  standingIn,
} from '../src/sim/neighbours';
import { CLAN_COUNT, CLAN_ELBOW } from '../src/data/clans';
import { neighbourStops } from '../src/sim/route';
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

describe('the strandhogg, on a line', () => {
  /** A stop with something on it that has men to defend it. */
  function guarded(): { stop: number } {
    const held = band(0).world.places.find(
      (p) => kindOf(p.kind).garrison !== null && p.stop! > SHIP_REACH,
    );
    expect(held, 'no garrisoned place far enough out to row to').toBeTruthy();
    return { stop: held!.stop! };
  }

  it('is offered to a band that came out of the water', () => {
    // The design's own sentence — "the same place, taken two ways" — in the
    // one coordinate a line has. Rowing there arrives with a sail nobody was
    // watching for.
    const { stop } = guarded();
    const rowed = step(band(stop - SHIP_REACH), stop);
    expect(standingAt(rowed)).toBe(stop);
    expect(rowed.party.bySea, 'the oars did not count as the water').toBe(true);
    expect(strandTarget(rowed)).toBeTruthy();
    expect(canStrandhogg(rowed)).toBe(true);
  });

  it('is refused to a band that walked up the road', () => {
    // The road is the one they watch. Same place, other door.
    const { stop } = guarded();
    const walked = step(band(stop - 1), stop);
    expect(standingAt(walked)).toBe(stop);
    expect(walked.party.bySea).toBeFalsy();
    expect(strandTarget(walked)).toBeUndefined();
    expect(canStrandhogg(walked)).toBe(false);
  });

  it('lasts exactly one day — a night ashore is a night they saw you', () => {
    // The claim the whole thing hangs on. A surprise that survived camping
    // would not be a surprise, it would be a property of the hull.
    const { stop } = guarded();
    const rowed = step(band(stop - SHIP_REACH), stop);
    expect(canStrandhogg(rowed)).toBe(true);
    const slept = apply(rowed, { type: 'CAMP' });
    expect(slept, 'the camp was refused').not.toBe(rowed);
    expect(slept.party.bySea).toBeFalsy();
    expect(canStrandhogg(slept)).toBe(false);
  });

  it('is not offered at a stop with nothing standing on it', () => {
    const bare = [...Array(ROUTE_STOPS).keys()]
      .find((i) => i > SHIP_REACH && !placeAt(SEED, i))!;
    const rowed = step(band(bare - SHIP_REACH), bare);
    expect(rowed.party.bySea).toBe(true);
    expect(strandTarget(rowed), 'a sail fell on empty coast').toBeUndefined();
  });

  it('is not offered against a place nobody is defending', () => {
    // A wreck is a day's work, not a fight — `garrison: null`. Coming out of
    // the water at one is arriving, not falling on anybody.
    const open = band(0).world.places.find(
      (p) => kindOf(p.kind).garrison === null && p.stop! > SHIP_REACH,
    );
    if (!open) return;
    const rowed = step(band(open.stop! - SHIP_REACH), open.stop!);
    expect(strandTarget(rowed)).toBeUndefined();
  });
});

describe('the people already on this coast', () => {
  it('all live at a stop, and none of them on a hex', () => {
    for (const seed of [SEED, 'grim-fjord-100', 'curve-7']) {
      const state = band(0, seed);
      expect(state.neighbours.length, seed).toBe(CLAN_COUNT);
      for (const n of state.neighbours) {
        expect(n.stop, `${seed}: ${n.name} has no address`).not.toBeUndefined();
        expect(n.at, `${seed}: ${n.name} still stands on ground`).toEqual({ q: 0, r: 0 });
      }
      expect(state.neighbours.map((n) => n.stop))
        .toEqual(neighbourStops(seed, CLAN_COUNT, 13, CLAN_ELBOW));
    }
  });

  it('still gets its names and its numbers out of the same rng', () => {
    // The conversion moves WHERE people live. It must not quietly reroll WHO
    // they are — a coast where the flag changes everybody's name and temper
    // is a coast that cannot be compared against the one before it.
    const state = band(0, SEED);
    for (const n of state.neighbours) {
      expect(n.name.length, 'a neighbour with no name').toBeGreaterThan(0);
      expect(n.might).toBeGreaterThanOrEqual(0);
      expect(n.standing).toBeGreaterThanOrEqual(-100);
      expect(n.raidsSent).toBe(0);
    }
    expect(new Set(state.neighbours.map((n) => n.name)).size).toBe(CLAN_COUNT);
  });

  it('is "here" when the band is standing on their stretch, and nowhere else', () => {
    const at = band(0, SEED).neighbours[0]!.stop!;
    const there = band(at, SEED);
    const host = neighbourHere(there);
    expect(host?.stop).toBe(at);
    expect(standingIn(there, host!)).toBe(true);
    // And one stop short is not "here" — the whole point of an address.
    const near = band(at - 1, SEED);
    expect(neighbourHere(near)).toBeUndefined();
    expect(standingIn(near, host!)).toBe(false);
  });

  it('opens the verbs that need a yard to stand in, and only there', () => {
    const first = band(0, SEED).neighbours[0]!;
    const at = first.stop!;
    const away = band(at - 1, SEED);
    expect(bargainBlocker(away, first.id)).toBe('nobody');
    expect(canFallOn(away, first.id)).toBe(false);

    const there = band(at, SEED);
    there.party.food = 400;
    expect(bargainBlocker(there, first.id)).toBeNull();
    expect(canFallOn(there, first.id)).toBe(true);
  });

  it('is met by walking onto their stretch, and does not scribble on a hex', () => {
    const first = band(0, SEED).neighbours[0]!;
    const state = band(first.stop!, SEED);
    const before = Object.keys(state.world.seen).length;
    seeNeighbours(state);
    expect(state.neighbours.find((n) => n.id === first.id)!.found).toBe(true);
    // `revealNeighbour` used to mark their hex seen. On a line every one of
    // them stands at (0,0), so doing it here would write the landing into the
    // seen map of a world nobody is navigating by hexes any more.
    expect(Object.keys(state.world.seen).length).toBe(before);
    expect(state.world.seen['0,0']).toBeUndefined();
  });

  it('is not met by walking somewhere else', () => {
    const first = band(0, SEED).neighbours[0]!;
    const state = band(first.stop! - 1, SEED);
    seeNeighbours(state);
    expect(state.neighbours.some((n) => n.found)).toBe(false);
  });
});

describe('a hall on the coast, and who comes to look at it', () => {
  /** A hall with its posts in a stop the band chose. */
  function hallAt(stop: number, seed = SEED): GameState {
    const state = withHall(seed);
    state.settlement!.stop = stop;
    state.party.stop = stop;
    return state;
  }

  it('records which stretch of coast the posts went into', () => {
    const state = withHall(SEED);
    // `withHall` founds standing at the landing, which is where a band that
    // has not walked anywhere is standing.
    expect(state.settlement!.stop).toBe(0);
  });

  it('is called on by the nearest of them first, working up the coast', () => {
    const state = hallAt(0);
    const order: number[] = [];
    for (let day = 0; day < 400 && order.length < CLAN_COUNT; day += 1) {
      state.day = state.settlement!.foundedOn + day;
      const before = state.neighbours.filter((n) => n.found).map((n) => n.id);
      neighboursCallOn(state);
      for (const n of state.neighbours) {
        if (n.found && !before.includes(n.id)) order.push(n.stop!);
      }
    }
    expect(order.length, 'nobody ever came to look').toBe(CLAN_COUNT);
    expect(order, 'they came in some other order than nearest first')
      .toEqual([...order].sort((a, b) => a - b));
  });

  it('tells the saga which way they lie in words a coast has', () => {
    // "North" is a compass word, and a line has no compass on it. The only
    // two directions that exist here are out and back.
    //
    // The bearing is one of three lines the caller picks between, so a single
    // seed can go a whole saga without saying it. Several seeds, and BOTH
    // phrases demanded — otherwise this passes on a coast where nobody ever
    // mentions a direction, which is exactly the shape of a check that has
    // quietly stopped running.
    const said = new Set<string>();
    for (const seed of [SEED, 'grim-fjord-100', 'curve-7', 'Þórr-vik']) {
      const state = hallAt(10, seed);
      for (let day = 0; day < 400 && state.neighbours.some((n) => !n.found); day += 1) {
        state.day = state.settlement!.foundedOn + day;
        neighboursCallOn(state);
      }
      const lines = state.saga.map((e) => e.text).join('\n');
      expect(lines, seed).not.toMatch(/off (north|south|east|west)/);
      for (const m of lines.matchAll(/off ([a-z ]+?),/g)) said.add(m[1]!);
    }
    expect([...said].sort()).toEqual(['back toward the landing', 'up the coast']);
  });
});

describe('somebody else’s home field', () => {
  it('refuses the posts inside it, and allows them a step outside', () => {
    const state = withHall(SEED);
    delete state.settlement;
    const first = state.neighbours.reduce((a, b) => (a.stop! < b.stop! ? a : b));
    const at = state.party.at;

    state.party.stop = first.stop!;
    expect(canFound(state, at), 'the posts went into a native camp').toBe(false);

    state.party.stop = first.stop! - CLAN_ELBOW;
    expect(canFound(state, at), 'a stop clear of them was still refused').toBe(true);
  });

  it('leaves the landing itself foundable, whoever lives on this coast', () => {
    // The reason `neighbourStops` takes a `room`. The landing is the only
    // ground a band has seen on day one; a coast that refuses it is a coast
    // that cannot be played.
    for (const seed of [SEED, 'grim-fjord-100', 'curve-7', 'Þórr-vik']) {
      const state = withHall(seed);
      delete state.settlement;
      state.party.stop = 0;
      expect(canFound(state, state.party.at), seed).toBe(true);
    }
  });
});
