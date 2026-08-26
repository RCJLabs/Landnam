// The chart, when the country is a coast.
//
// `render/strip.ts` is pure on purpose — it decides what the chart knows and
// where every stretch sits, and `render/stripMap.ts` only draws what it is
// handed. So this file can hold the whole of 8.2d's claims without a browser,
// and the browser bar is left to prove the one thing a unit test cannot: that
// a thumb can land on a stretch at 390x844.
//
// The flag is mocked on for the same reason `coastWalk.test.ts` mocks it:
// with it off, `standingAt`, `walkOptions` and `pushLimit` are answering
// about a coast the game is not playing on, and a chart nobody can open is
// code no test executes.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/sim/flags', () => ({ COAST_IS_A_LINE: true }));

import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import {
  LANE_H, LANE_Y, STOP_W, STRIP_H, TAP, pickStop, scrollFor, stripKey,
  stripScene, stripWidth, xOf,
} from '../src/render/strip';
import { ROUTE_STOPS, daysBetween, stopAt } from '../src/sim/route';
import { SEASON_LENGTH, SEASON_ORDER, seasonOf } from '../src/sim/calendar';
import { daysInHand, learnStop, markTrod, pushLimit, walkOptions } from '../src/sim/coast';
import { landmarkNameAtStop } from '../src/sim/landmark';
import { RIVAL_SETTLES } from '../src/sim/rival';
import type { GameState } from '../src/state/types';

const SEED = 'raven-skerry-317';
const SEEDS = [SEED, 'grim-fjord-100', 'curve-7', 'Þórr-vik'];

/** A band on the coast with enough in the packs to be going somewhere. */
function band(stop = 0, seed = SEED): GameState {
  const state = cloneState(newGame(seed));
  state.party.stop = stop;
  state.party.food = 300;
  learnStop(state, stop);
  return state;
}

/** Everything on the coast learned, for the tests that are about drawing. */
function allKnown(state: GameState): GameState {
  for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
  return state;
}

describe('where a stretch of coast sits on the chart', () => {
  it('gives every stretch more room than a thumb needs', () => {
    // The number the whole form turns on, and the reason the strip scrolls
    // rather than shrinks. The hex chart fits an island into 300px and its
    // own comment records what that cost — a name three pixels tall. A
    // stretch has to be TAPPED, so it cannot pay that price.
    expect(STOP_W).toBeGreaterThan(TAP);
    expect(TAP).toBe(44);
  });

  it('is a strip too long for any phone, which is the point', () => {
    expect(stripWidth()).toBe(ROUTE_STOPS * STOP_W);
    expect(stripWidth(), 'a coast that fits on a phone is a coast that was shrunk')
      .toBeGreaterThan(390 * 2);
  });

  it('keeps its marks inside the strip it says it is', () => {
    expect(LANE_Y).toBeGreaterThan(0);
    expect(LANE_Y + LANE_H).toBeLessThan(STRIP_H);
  });

  it('answers the same stretch a tap landed on', () => {
    for (let s = 0; s < ROUTE_STOPS; s += 1) {
      expect(pickStop(xOf(s)), `centre of ${s}`).toBe(s);
      // Both edges, just inside, because a thumb lands anywhere on it.
      expect(pickStop(s * STOP_W + 0.5), `left edge of ${s}`).toBe(s);
      expect(pickStop((s + 1) * STOP_W - 0.5), `right edge of ${s}`).toBe(s);
    }
  });

  it('answers nothing off either end of the coast', () => {
    expect(pickStop(-1)).toBeUndefined();
    expect(pickStop(stripWidth())).toBeUndefined();
    expect(pickStop(stripWidth() + 400)).toBeUndefined();
  });

  it('puts the band in the middle of what can be seen, and never past an end', () => {
    const view = 390;
    // In the middle of the coast, the band is centred.
    const mid = scrollFor(13, view);
    expect(xOf(13) - mid).toBeCloseTo(view / 2, 6);
    // At either end it stops rather than scrolling into blank paper.
    expect(scrollFor(0, view)).toBe(0);
    expect(scrollFor(ROUTE_STOPS - 1, view)).toBe(stripWidth() - view);
    // And a view wider than the coast never scrolls at all.
    expect(scrollFor(13, stripWidth() + 200)).toBe(0);
  });
});

describe('what the chart knows, and what it will not say', () => {
  it('says nothing at all about a stretch nobody has learned', () => {
    // The fog discipline, which is the hex chart's and is the reason the
    // chart is worth having: it is a record of what a saga EARNED, not a map
    // handed out on day one.
    const scene = stripScene(band(0), 40);
    const far = scene.stops[20]!;
    expect(far.known).toBe(false);
    expect(far.country).toBeUndefined();
    expect(far.fill).toBeUndefined();
    expect(far.leg, 'it told us how far it was to a coast we have never heard of')
      .toBeUndefined();
    expect(far.marks).toEqual([]);
  });

  it('says what the ground is once they have learned it', () => {
    for (const seed of SEEDS) {
      const scene = stripScene(allKnown(band(0, seed)), 40);
      for (const stop of scene.stops) {
        expect(stop.known, `${seed} at ${stop.index}`).toBe(true);
        expect(stop.country).toBe(stopAt(seed, stop.index).country);
        expect(stop.fill, `${seed} at ${stop.index}`).toBeTruthy();
      }
      // The landing has no leg to it — nobody walked there.
      expect(scene.stops[0]!.leg).toBeUndefined();
      expect(scene.stops[7]!.leg).toBe(stopAt(seed, 7).leg);
    }
  });

  it('marks the ground they actually stood on, apart from the ground they know of', () => {
    const state = band(0);
    learnStop(state, 5);
    markTrod(state, 3, 10);
    const scene = stripScene(state, 40);
    expect(scene.stops[3]!.trod).toBe(true);
    expect(scene.stops[5]!.known).toBe(true);
    expect(scene.stops[5]!.trod, 'being told of a coast is not walking it').toBe(false);
  });

  it('says where the band is standing', () => {
    const scene = stripScene(band(9), 40);
    expect(scene.at).toBe(9);
    expect(scene.stops.filter((s) => s.here).map((s) => s.index)).toEqual([9]);
  });
});

describe('the step the chart offers', () => {
  it('offers exactly what the sim would allow, priced in days', () => {
    for (const seed of SEEDS) {
      const state = band(10, seed);
      const scene = stripScene(state, 40);
      const offered = scene.stops.filter((s) => s.reach !== undefined).map((s) => s.index);
      expect(offered.sort((a, b) => a - b))
        .toEqual([...walkOptions(state)].sort((a, b) => a - b));
      for (const stop of scene.stops) {
        if (stop.reach === undefined) continue;
        expect(stop.reach, `${seed}: ${stop.index}`)
          .toBe(daysBetween(seed, 10, stop.index));
      }
    }
  });

  it('offers a settled band nothing, because a hall does not wander off', () => {
    const state = band(4);
    state.settlement = { at: { q: 0, r: 0 }, stop: 4 } as GameState['settlement'];
    const scene = stripScene(state, 40);
    expect(scene.stops.every((s) => s.reach === undefined)).toBe(true);
  });
});

describe('THE DECISION — how far before you turn back', () => {
  it('draws the mark the whole milestone is measured against', () => {
    // The chart answers it rather than leaving the player to add up legs.
    for (const seed of SEEDS) {
      const state = band(0, seed);
      const scene = stripScene(state, 40);
      expect(scene.limit).toBe(pushLimit(state, 40));
      expect(daysBetween(seed, 0, scene.limit) * 2, `${seed}: stranded them`)
        .toBeLessThanOrEqual(40);
    }
  });

  it('counts the days a band actually has, not the days it wishes it had', () => {
    const state = band(0);
    // Winter is far off, so the packs are the whole answer.
    state.day = 1;
    state.party.food = 40;
    const lean = daysInHand(state);
    state.party.food = 400;
    expect(daysInHand(state), 'more food bought no more days')
      .toBeGreaterThan(lean);
  });

  it('lets winter be the shorter clock, in every year and not only the first', () => {
    // `calendar.daysUntilWinter` counts down to day 49 and answers 0 for
    // every day after it — a first-winter warning helper, which is what it
    // is for. Read as a general deadline it tells a band in the autumn of
    // year three that nothing is coming, and the chart then offers them the
    // whole coast on the strength of a full larder. Caught here.
    const flush = band(0);
    flush.party.food = 4000;
    for (const day of [1, 30, 130, 230, 330]) {
      flush.day = day;
      const season = seasonOf(day);
      const hand = daysInHand(flush);
      if (season === 'winter') continue;
      expect(hand, `day ${day} (${season}) offered a walk longer than the year`)
        .toBeLessThanOrEqual(SEASON_LENGTH * SEASON_ORDER.length);
    }
    // And the deadline tightens as autumn runs out, in a later year too.
    flush.day = 122;
    const early = daysInHand(flush);
    flush.day = 140;
    expect(daysInHand(flush), 'the season never shortened the walk')
      .toBeLessThan(early);
  });
});

describe('what the coast carries', () => {
  it('names the landing, so the chart opens where the saga does', () => {
    const scene = stripScene(band(0), 40);
    expect(scene.stops[0]!.marks.some((m) => m.kind === 'landing')).toBe(true);
  });

  it('names a place once the coast is known, and dims one picked clean', () => {
    const state = allKnown(band(0));
    const place = state.world.places[0]!;
    const scene = stripScene(state, 40);
    const mark = scene.stops[place.stop!]!.marks.find((m) => m.kind === 'place');
    expect(mark, 'a known place went unnamed').toBeTruthy();
    expect(mark!.spent).toBeFalsy();

    state.world.places[0]!.sackedOn = 30;
    const after = stripScene(state, 40);
    const taken = after.stops[place.stop!]!.marks.find((m) => m.kind === 'place')!;
    expect(taken.spent).toBe(true);
    expect(taken.text).toMatch(/picked clean/);
  });

  it('names only the neighbours actually met, and inks them by their temper', () => {
    // A camp nobody has come to is not something the chart could be
    // carrying — the same rule the hex chart keeps.
    const state = allKnown(band(0));
    const n = state.neighbours[0]!;
    expect(stripScene(state, 40).stops[n.stop!]!.marks.some((m) => m.kind === 'neighbour'))
      .toBe(false);

    n.found = true;
    n.standing = -80;
    const angry = stripScene(state, 40).stops[n.stop!]!.marks
      .find((m) => m.kind === 'neighbour')!;
    expect(angry.text).toContain(n.name);
    n.standing = 80;
    const sworn = stripScene(state, 40).stops[n.stop!]!.marks
      .find((m) => m.kind === 'neighbour')!;
    expect(sworn.ink, 'a friend and an enemy were the same colour')
      .not.toBe(angry.ink);
  });

  it('names the other boat’s hall and the ground he has fenced, once met', () => {
    const state = allKnown(band(0));
    state.day = RIVAL_SETTLES + 1;
    const hall = state.rival!.stop!;
    state.rival!.claimStops = [hall, hall + 1];

    expect(stripScene(state, 40).stops[hall]!.marks.some((m) => m.kind === 'rival'))
      .toBe(false);
    state.rival!.met = true;
    const scene = stripScene(state, 40);
    expect(scene.stops[hall]!.marks.find((m) => m.kind === 'rival')!.text)
      .toContain(state.rival!.hall);
    const fenced = scene.stops[hall + 1]!.marks.find((m) => m.kind === 'rival')!;
    expect(fenced.spent, 'fenced ground read the same as his hall').toBe(true);
  });

  it('names our own hall', () => {
    const state = allKnown(band(4));
    state.settlement = { at: { q: 0, r: 0 }, stop: 4, name: 'Ravensholt' } as
      GameState['settlement'];
    expect(stripScene(state, 40).stops[4]!.marks.find((m) => m.kind === 'hall')!.text)
      .toContain('Ravensholt');
  });

  it('names the fixed points, which is what the saga has been calling them', () => {
    const state = allKnown(band(0));
    const scene = stripScene(state, 40);
    let named = 0;
    for (let s = 0; s < ROUTE_STOPS; s += 1) {
      const want = landmarkNameAtStop(SEED, s);
      const got = scene.stops[s]!.marks.find((m) => m.kind === 'landmark');
      if (want) { named += 1; expect(got?.text, `stretch ${s}`).toBe(want); }
      else expect(got, `stretch ${s} invented a landmark`).toBeUndefined();
    }
    expect(named, 'nothing on this coast is named').toBeGreaterThan(2);
  });
});

describe('the key beside the picture', () => {
  it('lists every mark on the coast, seaward, so it agrees with the strip', () => {
    const state = allKnown(band(0));
    for (const n of state.neighbours) n.found = true;
    const scene = stripScene(state, 40);
    const key = stripKey(scene);
    expect(key.length, 'a known coast with nothing on it').toBeGreaterThan(4);
    expect(key.map((k) => k.stop)).toEqual([...key.map((k) => k.stop)].sort((a, b) => a - b));
    // And it is exactly what the picture draws — no more, no less.
    expect(key.length).toBe(scene.stops.reduce((n, s) => n + s.marks.length, 0));
  });

  it('is empty on a coast nobody has learned', () => {
    const scene = stripScene(band(0), 40);
    // Except the landing, which the band is standing on.
    expect(stripKey(scene).every((k) => k.stop === 0)).toBe(true);
  });
});
