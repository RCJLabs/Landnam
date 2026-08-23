// Item 28: somewhere on the water worth going to.
//
// The bar for this work is not "fishing grounds exist" — it is that the sea
// acquires a REASON, which is a claim about a decision rather than about a
// feature. So the centre of this file is the trip arithmetic: what a ground
// pays against what staying ashore pays, and whether the thing that makes it
// worth rowing to (that you cannot walk to one) actually holds.

import { describe, it, expect } from 'vitest';
import { fromKey, key, neighbors, type Hex } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { canFish } from '../src/sim/gathering';
import { abundance } from '../src/sim/abundance';
import { isCoastalWater } from '../src/sim/road';
import { PURPOSES } from '../src/sim/expedition';
import {
  GROUND_SHARE,
  GROUND_YIELD,
  fisheryYield,
  groundAt,
  knownGround,
  knownGrounds,
} from '../src/sim/fishery';
import type { GameState } from '../src/state/types';

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** Fog lifted, stores full: so a measurement is of fishing and nothing else. */
function ready(seed: string): GameState {
  const state = fresh(seed);
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  state.party.food = 400;
  state.party.firewood = 400;
  return state;
}

const hexes = (state: GameState): Hex[] => Object.keys(state.world.tiles).map(fromKey);

/**
 * One day's work, with any card cleared first.
 *
 * The cleared card is not a convenience. `applyTravel` refuses every verb
 * while `state.event` is set, so a loop that simply calls the verb silently
 * measures fewer days than it reports — which is exactly what the first cut
 * of the tuning measurement did, and it read a five-day trip off two days.
 */
function workDay(state: GameState, verb: 'FISH' | 'FORAGE' | 'CAMP'): number | null {
  state.event = undefined;
  const before = state.party.food;
  const next = apply(state, { type: verb });
  if (next === state) return null;
  Object.assign(state, next);
  return state.party.food - before;
}

describe('a fishing ground', () => {
  it('is derived from the seed, so a replay finds the same fish', () => {
    for (const seed of ['derive-a', 'derive-b']) {
      const first = fresh(seed);
      const second = fresh(seed);
      for (const at of hexes(first)) {
        expect(groundAt(second, at), key(at)).toBe(groundAt(first, at));
      }
    }
  });

  it('is only ever on water the knarr can actually work', () => {
    const state = fresh('water-only');
    for (const at of hexes(state)) {
      if (!groundAt(state, at)) continue;
      expect(state.world.tiles[key(at)]!.terrain, key(at)).toBe('ocean');
      expect(isCoastalWater(state, at), `${key(at)} is out of the knarr's reach`).toBe(true);
    }
  });

  it('lands near its declared share of the coast', () => {
    let coastal = 0;
    let grounds = 0;
    for (let s = 0; s < 8; s += 1) {
      const state = fresh(`share-${s}`);
      for (const at of hexes(state)) {
        if (!isCoastalWater(state, at)) continue;
        coastal += 1;
        if (groundAt(state, at)) grounds += 1;
      }
    }
    const share = grounds / coastal;
    // eslint-disable-next-line no-console
    console.log(`grounds: ${grounds} of ${coastal} coastal hexes — ${(share * 100).toFixed(1)}%`);
    expect(Math.abs(share - GROUND_SHARE)).toBeLessThan(0.03);
  });

  it('costs the save nothing — it is not in it', () => {
    const state = ready('nosave');
    const encoded = encode(state);
    expect(encoded).not.toContain('fishery');
    expect(encoded).not.toContain('grounds');
    // And it still loads, which is the part that matters.
    const back = migrate(JSON.parse(encoded) as Record<string, unknown>);
    expect((back.save as { version: number }).version).toBe(SAVE_VERSION);
  });

  it('is known once the water has been looked at, and not before', () => {
    const state = fresh('known');
    const ground = hexes(state).find((h) => groundAt(state, h))!;
    expect(knownGround(state, ground)).toBe(false);
    state.world.seen[key(ground)] = 'seen';
    expect(knownGround(state, ground)).toBe(true);
    expect(knownGrounds(state).some((h) => key(h) === key(ground))).toBe(true);
  });
});

describe('THE BAR — the sea is worth rowing to', () => {
  it('pays a crew floating on it, and pays nobody standing beside it', () => {
    // The load-bearing claim of the whole feature: you cannot walk to a
    // fishing ground. If the beach next door paid the same, the ship would
    // still have no reason to leave it.
    let checked = 0;
    for (let s = 0; s < 6; s += 1) {
      const state = fresh(`beside-${s}`);
      for (const at of hexes(state)) {
        if (!groundAt(state, at)) continue;
        expect(fisheryYield(state, at)).toBe(GROUND_YIELD);
        for (const n of neighbors(at)) {
          const tile = state.world.tiles[key(n)];
          if (!tile || tile.terrain === 'ocean') continue;
          // Dry land beside the richest water in the country gets nothing
          // from it.
          expect(fisheryYield(state, n), `${key(n)} beside ${key(at)}`).toBe(1);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('out-pays the land by enough to be worth the days the trip costs', () => {
    // Measured rather than asserted from the constant, because the constant
    // is not the claim — the claim is about the TRIP, which is two travel
    // days plus what the ground gives before it thins.
    const upkeep: number[] = [];
    const ashore: number[] = [];
    const afloat: number[] = [];
    for (let s = 0; s < 8; s += 1) {
      const seed = `pays-${s}`;
      for (const day of [30, 110, 190, 270]) {
        const probe = ready(seed);
        const ground = hexes(probe).find((h) => groundAt(probe, h));
        const valley = hexes(probe).find(
          (h) => probe.world.tiles[key(h)]!.terrain === 'valley',
        );
        if (!ground || !valley) continue;

        const camp = ready(seed);
        camp.party.at = valley; camp.day = day;
        const c = workDay(camp, 'CAMP');
        if (c !== null) upkeep.push(-c);

        const land = ready(seed);
        land.party.at = valley; land.day = day;
        const l = workDay(land, 'FORAGE');
        if (l !== null) ashore.push(l);

        const sea = ready(seed);
        sea.party.at = ground; sea.day = day;
        const f = workDay(sea, 'FISH');
        if (f !== null) afloat.push(f);
      }
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const up = mean(upkeep);
    const land = mean(ashore);
    const sea = mean(afloat);
    // A trip is two days' rowing at a day's upkeep each, then three days on
    // the ground before the larder thins (GRACE in sim/abundance.ts).
    const trip = (3 * sea - 2 * up) / 5;
    // eslint-disable-next-line no-console
    console.log(
      `a day's food — upkeep ${up.toFixed(2)}, forage ${land.toFixed(2)} net, ` +
        `a ground ${sea.toFixed(2)} net; the five-day trip returns ${trip.toFixed(2)} a day ` +
        `against ${land.toFixed(2)} for staying home (x${(trip / land).toFixed(2)})`,
    );
    // Worth going: the trip has to beat staying put by a real margin, or
    // nobody sails and this is decoration.
    expect(trip).toBeGreaterThan(land * 1.2);
    // And not a solved game: an early cut of GROUND_YIELD read forty times
    // the land verbs over five days, because multiplying the GROSS take when
    // upkeep is a flat 3 a day is hugely leveraged. Food is what kills bands
    // and it has to stay that way.
    expect(trip).toBeLessThan(land * 2.5);
  });

  it('thins under a crew that squats on it, so knowing several is the point', () => {
    const state = ready('thins');
    state.party.at = hexes(state).find((h) => groundAt(state, h))!;
    const takes: number[] = [];
    for (let d = 0; d < 6; d += 1) {
      if (!canFish(state)) break;
      const got = workDay(state, 'FISH');
      if (got === null) break;
      takes.push(got);
    }
    expect(takes.length).toBe(6);
    // eslint-disable-next-line no-console
    console.log(`six days on one ground: ${takes.join(', ')}`);
    expect(abundance(state, 'fish', state.party.at)).toBeLessThan(0.5);
    // The last day is worth a fraction of the first. A ground that never
    // thinned would be a reason to sail once and never move again.
    expect(takes[takes.length - 1]!).toBeLessThan(takes[0]! * 0.6);
  });

  it('is an errand a settled band can actually send', () => {
    // The diagnosis that produced the errand: a settled band cannot move at
    // all, so before this the sea was not declined by one, it was shut to
    // one. The purpose is what opens that door.
    const fishing = PURPOSES.find((p) => p.id === 'fish');
    expect(fishing, 'no fishing errand — a settled band cannot reach the water').toBeDefined();
    expect(fishing!.name.length).toBeGreaterThan(8);
    expect(fishing!.blurb.length).toBeGreaterThan(30);
  });
});
