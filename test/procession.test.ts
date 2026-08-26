// Travel, seen from the side.
//
// The milestone's bar is "you can tell where you are and what is ahead
// WITHOUT the chart", and that splits cleanly in two. Whether the picture
// KNOWS those things is decided in `render/procession.ts` and proved here.
// Whether a player can READ them off a phone is `scripts/procession.mjs`,
// because no unit test has ever seen a screen.
//
// Flag mocked on, for the reason `strip.test.ts` gives: with it off this view
// is never mounted and every line of it is code nothing executes.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/sim/flags', () => ({ COAST_IS_A_LINE: true }));

import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import {
  BAND_X, HORIZON_Y, ROAD_Y, SCENE_H, SCENE_W, SEEN_AHEAD, WALKER_R,
  countryWord, fileSpots, processionScene, sightAt, whereWeAre,
} from '../src/render/procession';
import { ROUTE_STOPS, daysBetween, stopAt } from '../src/sim/route';
import { learnStop, standingAt, walkOptions } from '../src/sim/coast';
import { landmarkNameAtStop } from '../src/sim/landmark';
import { RIVAL_SETTLES } from '../src/sim/rival';
import type { GameState } from '../src/state/types';

const SEED = 'raven-skerry-317';
const SEEDS = [SEED, 'grim-fjord-100', 'curve-7', 'Þórr-vik'];

function band(stop = 0, seed = SEED): GameState {
  const state = cloneState(newGame(seed));
  state.party.stop = stop;
  state.party.food = 300;
  learnStop(state, stop);
  return state;
}

function allKnown(state: GameState): GameState {
  for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
  return state;
}

describe('how the road runs away from you', () => {
  it('puts nearer things lower and larger, which is what distance IS here', () => {
    // The whole claim that separates this from a row of icons. If it fails,
    // the picture is a chart with the paint taken off.
    let last = sightAt(0);
    for (let off = 1; off <= SEEN_AHEAD + 1; off += 1) {
      const now = sightAt(off);
      expect(now.y, `${off} was not higher up the picture`).toBeLessThan(last.y);
      expect(now.scale, `${off} was not smaller`).toBeLessThan(last.scale);
      expect(now.x, `${off} was not further along`).toBeGreaterThan(last.x);
      last = now;
    }
  });

  it('keeps everything between the road and the horizon', () => {
    for (let off = 0; off <= SEEN_AHEAD; off += 1) {
      const spot = sightAt(off);
      expect(spot.y).toBeLessThanOrEqual(ROAD_Y);
      expect(spot.y).toBeGreaterThanOrEqual(HORIZON_Y);
      expect(spot.x).toBeLessThan(SCENE_W);
      expect(spot.scale).toBeGreaterThan(0);
    }
  });

  it('leaves more road ahead than behind, because that is the decision', () => {
    expect(BAND_X).toBeLessThan(SCENE_W / 2);
    expect(ROAD_Y).toBeLessThan(SCENE_H);
  });
});

describe('the band on the road', () => {
  it('walks as a file, and a big band is a longer one rather than a pile', () => {
    const six = fileSpots(6);
    expect(six).toHaveLength(6);
    for (let i = 1; i < six.length; i += 1) {
      expect(six[i]!.x, `walker ${i} was not behind walker ${i - 1}`)
        .toBeLessThan(six[i - 1]!.x);
      // Far enough apart that they read as people and not as one blot.
      expect(six[i - 1]!.x - six[i]!.x).toBeGreaterThan(WALKER_R * 0.5);
    }
    expect(fileSpots(1)).toHaveLength(1);
    expect(fileSpots(0)).toEqual([]);
  });
});

describe('where we are, said without opening anything', () => {
  it('names the country when the stretch has no name of its own', () => {
    // Find a stretch this coast has NOT named, so the fallback is what runs.
    let bare = 1;
    while (bare < ROUTE_STOPS && landmarkNameAtStop(SEED, bare)) bare += 1;
    const said = whereWeAre(processionScene(band(bare)));
    expect(said).toContain(countryWord(stopAt(SEED, bare).country));
    expect(said, 'it did not say how far along the coast we are')
      .toMatch(/stretch \d+ of \d+/);
  });

  it('names the fixed point when there is one, because that is what a person says', () => {
    let named = 1;
    while (named < ROUTE_STOPS && !landmarkNameAtStop(SEED, named)) named += 1;
    expect(named, 'nothing on this coast is named').toBeLessThan(ROUTE_STOPS);
    const state = band(named);
    expect(whereWeAre(processionScene(state)))
      .toContain(landmarkNameAtStop(SEED, named)!);
  });

  it('says the land gives out at the far headland', () => {
    const scene = processionScene(band(ROUTE_STOPS - 1));
    expect(scene.headland).toBe(true);
    expect(scene.onward).toBeUndefined();
    expect(whereWeAre(scene)).toContain('the last of the coast');
  });

  it('does not name a stretch the band has only heard about', () => {
    // `landmarkNameAtStop` is pure and will happily name any stretch. The
    // picture must not, or the band knows the coast without walking it.
    let named = 1;
    while (named < ROUTE_STOPS && !landmarkNameAtStop(SEED, named)) named += 1;
    const state = cloneState(newGame(SEED));
    state.party.stop = named;
    state.world.knownStops = [];
    expect(processionScene(state).landmark).toBeUndefined();
  });
});

describe('what is ahead', () => {
  it('shows nothing on a coast the band has not learned', () => {
    // The seen/unseen discipline, which is what makes walking out to look
    // worth doing: the shape of the coast is there, what stands on it is not.
    const scene = processionScene(band(0));
    expect(scene.ahead).toEqual([]);
  });

  it('shows what stands on the stretches within sight, nearest first', () => {
    for (const seed of SEEDS) {
      const state = allKnown(band(0, seed));
      for (const n of state.neighbours) n.found = true;
      // Walk the whole coast looking for a stretch that can see something.
      let found = 0;
      for (let at = 0; at < ROUTE_STOPS; at += 1) {
        state.party.stop = at;
        const scene = processionScene(state);
        found += scene.ahead.length;
        expect(scene.ahead.map((s) => s.off), `${seed} at ${at}`)
          .toEqual([...scene.ahead.map((s) => s.off)].sort((a, b) => a - b));
        for (const s of scene.ahead) {
          expect(s.off).toBeGreaterThan(0);
          expect(s.off).toBeLessThanOrEqual(SEEN_AHEAD);
          expect(s.stop).toBe(at + s.off);
          expect(s.days).toBe(daysBetween(seed, at, s.stop));
          expect(s.name.length).toBeGreaterThan(0);
        }
      }
      expect(found, `${seed}: nothing was ever in sight anywhere`).toBeGreaterThan(0);
    }
  });

  it('never shows more than one thing on a stretch', () => {
    const state = allKnown(band(0));
    for (const n of state.neighbours) n.found = true;
    state.day = RIVAL_SETTLES + 1;
    state.rival!.met = true;
    for (let at = 0; at < ROUTE_STOPS; at += 1) {
      state.party.stop = at;
      const stops = processionScene(state).ahead.map((s) => s.stop);
      expect(new Set(stops).size, `two things in sight on one stretch from ${at}`)
        .toBe(stops.length);
    }
  });

  it('stops showing a place once it has been picked clean', () => {
    const state = allKnown(band(0));
    const place = state.world.places.find((p) => (p.stop ?? 0) > 0)!;
    state.party.stop = Math.max(0, place.stop! - 1);
    expect(processionScene(state).ahead.some((s) => s.kind === 'place')).toBe(true);
    place.sackedOn = 30;
    expect(processionScene(state).ahead.some((s) => s.kind === 'place')).toBe(false);
  });

  it('does not show a camp nobody has met', () => {
    const state = allKnown(band(0));
    const camp = state.neighbours.find((n) => (n.stop ?? 0) > 0)!;
    state.party.stop = Math.max(0, camp.stop! - 1);
    const hidden = processionScene(state).ahead.filter((s) => s.stop === camp.stop);
    // Either nothing, or something that is not the camp.
    expect(hidden.every((s) => s.kind !== 'camp')).toBe(true);
    camp.found = true;
    expect(processionScene(state).ahead.some(
      (s) => s.stop === camp.stop && s.kind === 'camp',
    )).toBe(true);
  });
});

describe('the two things a coast lets you do', () => {
  it('offers exactly the steps the sim allows, priced in days', () => {
    for (const seed of SEEDS) {
      const state = band(10, seed);
      const scene = processionScene(state);
      const allowed = new Set(walkOptions(state));
      expect(scene.onward !== undefined).toBe(allowed.has(11));
      expect(scene.back !== undefined).toBe(allowed.has(9));
      if (scene.onward) expect(scene.onward.days).toBe(daysBetween(seed, 10, 11));
      if (scene.back) expect(scene.back.days).toBe(daysBetween(seed, 10, 9));
    }
  });

  it('offers no way back from the landing, and no way on from the headland', () => {
    expect(processionScene(band(0)).back).toBeUndefined();
    expect(processionScene(band(ROUTE_STOPS - 1)).onward).toBeUndefined();
  });

  it('offers a settled band neither, because a hall does not wander off', () => {
    const state = band(4);
    state.settlement = { at: { q: 0, r: 0 }, stop: 4 } as GameState['settlement'];
    const scene = processionScene(state);
    expect(scene.onward).toBeUndefined();
    expect(scene.back).toBeUndefined();
  });

  it('knows where it is standing', () => {
    const state = band(7);
    expect(processionScene(state).at).toBe(standingAt(state));
  });
});
