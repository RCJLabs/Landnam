// Item 28: somewhere on the water worth going to.
//
// The bar for this work is not "fishing grounds exist" — it is that the sea
// acquires a REASON, which is a claim about a decision rather than about a
// feature. So the centre of this file is the trip arithmetic: what a ground
// pays against what staying ashore pays, and whether the thing that makes it
// worth rowing to (that you cannot walk to one) actually holds.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { canFish } from '../src/sim/gathering';
import { abundance } from '../src/sim/abundance';
import { PURPOSES } from '../src/sim/expedition';
import {
  GROUND_SHARE,
  GROUND_YIELD,
  fisheryYield,
  groundAtStop,
  } from '../src/sim/fishery';
import { ROUTE_STOPS, stopAt } from '../src/sim/route';
import { SHIP_REACH, markTrod } from '../src/sim/coast';
import type { GameState } from '../src/state/types';

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** Stores full, so a measurement is of fishing and nothing else. */
function ready(seed: string): GameState {
  const state = fresh(seed);
  state.party.food = 400;
  state.party.firewood = 400;
  return state;
}

/** Stretches of coast, with and without a ground off them. */
const stops = (seed: string, want: boolean): number[] =>
  [...Array(ROUTE_STOPS).keys()].filter((s) => groundAtStop(seed, s) === want);

/** Stand the band on a stretch, the way walking there would leave them. */
function standAt(state: GameState, stop: number, day: number): GameState {
  state.party.stop = stop;
  state.day = day;
  markTrod(state, stop, day);
  return state;
}

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
  it('costs the save nothing — it is not in it', () => {
    const state = ready('nosave');
    const encoded = encode(state);
    expect(encoded).not.toContain('fishery');
    expect(encoded).not.toContain('grounds');
    // And it still loads, which is the part that matters.
    const back = migrate(JSON.parse(encoded) as Record<string, unknown>);
    expect((back.save as { version: number }).version).toBe(SAVE_VERSION);
  });

});

// The same two facts asked of the address a coast has. Five bars above these
// were about `groundAt`, which took a hex; a coast build never called it, so
// they were green against a country the game does not use — the same trap
// `site.test.ts` fell into. They went with the hexes; `groundAtStop` is what
// a coast asks.
describe('a fishing ground, off a stretch of coast', () => {
  it('is derived from the seed, so a replay finds the same fish', () => {
    for (const seed of ['derive-a', 'derive-b']) {
      const once = stops(seed, true);
      expect(stops(seed, true)).toEqual(once);
      // And a different coast is a different coast.
      expect(stops(`${seed}-other`, true)).not.toEqual(once);
    }
  });

  it('lands near its declared share of the coast', () => {
    let grounds = 0;
    let all = 0;
    for (let s = 0; s < 40; s += 1) {
      const seed = `share-stop-${s}`;
      all += ROUTE_STOPS;
      grounds += stops(seed, true).length;
    }
    const share = grounds / all;
    // eslint-disable-next-line no-console
    console.log(`grounds: ${grounds} of ${all} stretches — ${(share * 100).toFixed(1)}%`);
    // The SAME share as the hex water, unlike `LANDMARK_SHARE_STOP`, and the
    // reason is the ship: a day at the oars covers `SHIP_REACH` stops, so a
    // one-in-seven coast leaves a median stretch a single day from a ground
    // (measured in the trip bar below). A landmark had to be re-shared
    // because a band WALKS to one; a ground it rows to does not.
    expect(Math.abs(share - GROUND_SHARE)).toBeLessThan(0.03);
  });
});

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/**
 * The same trip claim, priced for a coast — and the answer it gives is a
 * different one, because the coast asks the question honestly and the hex map
 * never did.
 *
 * The hex bar compares a fishing trip against foraging A VALLEY, because on
 * an open map the band stands where it likes and the best land is always an
 * option. On a line the band is on the stretch it walked to, and a stretch is
 * whatever country the seed put there. Measured over eight coasts, four
 * points of the year, every stretch of every coast — a day's net food:
 *
 *   valley  +3.38    forest  +2.16    meadow  +0.92
 *   hills   -0.43    shore   -0.48    bog     -0.49     coast-wide  +0.97
 *
 * Four of the six countries a coast can be made of STARVE a band that forages
 * them: they return less than the three a day it costs to stand there. So the
 * land baseline on a line is not a valley, it is the 0.97 an average stretch
 * pays, and that is the number the decision is actually taken against — a
 * player on a bog is not choosing between fish and a valley, they are choosing
 * between fish and a bog.
 *
 * The trip itself keeps its shape: a day out, three days on the ground before
 * the larder thins, a day back. A day out is right because a day at the oars
 * covers `SHIP_REACH` stops, and the ground share leaves a median stretch one
 * such day from the nearest ground — which this checks before it prices
 * anything, since the five-day arithmetic is a lie if a ground is a week away.
 */
function tripOnTheLine(): void {
  // First: is a ground actually a day's rowing off? Over sixty coasts.
  const rows: number[] = [];
  for (let s = 0; s < 60; s += 1) {
    const seed = `reach-${s}`;
    const has = stops(seed, true);
    expect(has.length, `no ground on the whole of ${seed}`).toBeGreaterThan(0);
    for (let i = 0; i < ROUTE_STOPS; i += 1) {
      rows.push(Math.min(...has.map((g) => Math.ceil(Math.abs(g - i) / SHIP_REACH))));
    }
  }
  rows.sort((a, b) => a - b);
  const median = rows[Math.floor(rows.length / 2)]!;
  // eslint-disable-next-line no-console
  console.log(
    `rowing days to the nearest ground: med ${median}, ` +
      `p90 ${rows[Math.floor(rows.length * 0.9)]}, max ${rows[rows.length - 1]}`,
  );
  expect(median, 'a ground a median band cannot row to in a day is not a trip').toBe(1);

  // Then the arithmetic, over every stretch of eight coasts.
  const upkeep: number[] = [];
  const afloat: number[] = [];
  const ashore: number[] = [];
  const byCountry = new Map<string, number[]>();
  for (let s = 0; s < 8; s += 1) {
    const seed = `pays-${s}`;
    const ground = stops(seed, true)[0];
    if (ground === undefined) continue;
    for (const day of [30, 110, 190, 270]) {
      const camp = standAt(ready(seed), ground, day);
      const c = workDay(camp, 'CAMP');
      if (c !== null) upkeep.push(-c);

      const sea = standAt(ready(seed), ground, day);
      const f = workDay(sea, 'FISH');
      if (f !== null) afloat.push(f);

      for (let i = 0; i < ROUTE_STOPS; i += 1) {
        const land = standAt(ready(seed), i, day);
        const l = workDay(land, 'FORAGE');
        if (l === null) continue;
        ashore.push(l);
        const country = stopAt(seed, i).country;
        if (!byCountry.has(country)) byCountry.set(country, []);
        byCountry.get(country)!.push(l);
      }
    }
  }
  const up = mean(upkeep);
  const land = mean(ashore);
  const sea = mean(afloat);
  const trip = (3 * sea - 2 * up) / 5;
  // eslint-disable-next-line no-console
  console.log(
    `a day's food — upkeep ${up.toFixed(2)}, a ground ${sea.toFixed(2)} net; ` +
      `the five-day trip returns ${trip.toFixed(2)} a day against ${land.toFixed(2)} ` +
      `for foraging where you stand (x${(trip / land).toFixed(2)})\n  ` +
      [...byCountry]
        .sort()
        .map(([k, v]) => `${k} ${mean(v).toFixed(2)}`)
        .join('  '),
  );
  // The bleak stretches are the reason the sea exists on a line, so the bar
  // holds that they ARE bleak. If every country fed a band this feature is
  // decoration again, exactly as the sea was before item 28.
  const starving = [...byCountry.values()].filter((v) => mean(v) < 0).length;
  expect(starving, 'no country on a coast starves a forager — the sea has no job')
    .toBeGreaterThan(1);
  // Worth going: the same margin the hex bar asks for, against the land a
  // coast band actually has.
  expect(trip).toBeGreaterThan(land * 1.2);

  // AND NOT A SOLVED GAME — asked against UPKEEP, not against the land.
  //
  // The hex bar's ceiling is `trip < land * 2.5` and it is the wrong
  // instrument on a line, which is visible the moment both are measured: the
  // coast trip returns 3.26 a day where the hex trip returns 4.54, so the
  // coast sea is the STINGIER of the two in absolute food — and it blows a
  // ratio ceiling the richer sea passes, because the divisor is a coast
  // band's land (0.97) rather than a map band's valley (3.31). A ratio
  // against a baseline near zero says nothing about the sea at all.
  //
  // What the ceiling is for is the sentence under it: food is what kills
  // bands and it has to stay that way. That is a claim about a day's take
  // against a day's cost, and a day's cost is 3.00 on both maps. Swept over
  // GROUND_YIELD to check it bites rather than merely passes:
  //
  //   yield 2 -> trip 3.26/day, 1.09x upkeep   (what ships)
  //   yield 3 -> trip 6.36/day, 2.12x upkeep   REJECTED
  //   yield 4 -> trip 9.45/day, 3.15x upkeep   REJECTED
  //
  // Which makes this the TIGHTER of the two bars, not a widened one: the hex
  // ratio admits a ground paying anything up to about 2.7x before it trips,
  // and this rejects 3.
  expect(trip, 'a trip that out-earns two days of standing still is a solved larder')
    .toBeLessThan(up * 2);
}

describe('THE BAR — the sea is worth rowing to', () => {
  it('pays a crew floating on it, and pays nobody standing beside it', () => {
    // The load-bearing claim of the whole feature: you cannot walk to a
    // fishing ground. If the beach next door paid the same, the ship would
    // still have no reason to leave it.
    let checked = 0;
    // The same claim, asked of the address a line actually has. "Beside"
    // is the next stretch over rather than the next hex, and the refusal
    // survives the move intact: the multiple is paid to a band standing at
    // a stretch with a ground off it and to nobody else, so a band that
    // wants the fish has to spend the days getting there.
    //
    // What does NOT survive is the wording of the sim's own note — a coast
    // band is never "at sea", because rowing is a step and not a state, so
    // there is no floating to do. Being there is the whole test.
    for (let s = 0; s < 12; s += 1) {
      const seed = `beside-${s}`;
      for (const at of stops(seed, true)) {
        const on = standAt(fresh(seed), at, 30);
        expect(fisheryYield(on), `stretch ${at} of ${seed}`).toBe(GROUND_YIELD);
        for (const n of [at - 1, at + 1]) {
          if (n < 0 || n >= ROUTE_STOPS || groundAtStop(seed, n)) continue;
          const beside = standAt(fresh(seed), n, 30);
          // The next stretch of coast, within sight of the richest water
          // on it, gets nothing from it.
          expect(fisheryYield(beside), `${n} beside ${at}`).toBe(1);
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
    tripOnTheLine();
  });

  it('thins under a crew that squats on it, so knowing several is the point', () => {
    const state = ready('thins');
    // On a line the larder is keyed by STRETCH (see `sim/abundance.ts`), so
    // squatting has to be done where the sim thinks the band is standing.
    // Placing it by hex, as the line below does, silently measured six days
    // of bare water off the landing instead.
    const ground = stops(state.seed, true)[0]!;
    standAt(state, ground, state.day);
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
    expect(abundance(state, 'fish')).toBeLessThan(0.5);
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
