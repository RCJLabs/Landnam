// The chart: the route the band has walked, and the landmarks worth drawing.
// The rendering is a view, but what it draws from is state — and that has to
// be honest, or the map is a nice picture of a run that did not happen.

import { describe, it, expect } from 'vitest';
import { key, neighbors, distance } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { moveOptions } from '../src/sim/road';
import { route } from '../src/render/map';
import type { GameState } from '../src/state/types';
import { RETIRED_WITH_THE_HEXES } from './fixtures/hexOnly';

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** Walks the band a few hexes, answering whatever cards come up. */
function wander(seed: string, steps: number): GameState {
  let state = fresh(seed);
  for (let i = 0; i < steps * 4 && route(state).length < steps + 1; i++) {
    if (state.end) break;
    if (state.battle) {
      state = apply(state, { type: 'B_END_TURN' });
      if (state.battle?.outcome) state = apply(state, { type: 'B_LEAVE' });
      continue;
    }
    if (state.aftermath) {
      state = apply(state, { type: 'DISMISS_AFTERMATH' });
      continue;
    }
    if (state.event) {
      const next = state.event.outcome
        ? apply(state, { type: 'DISMISS_EVENT' })
        : apply(state, { type: 'CHOOSE', index: 0 });
      state = next;
      continue;
    }
    const options = moveOptions(state);
    if (options.length === 0) break;
    state = apply(state, { type: 'MOVE', to: options[i % options.length]! });
  }
  return state;
}

describe('the route', () => {
  it('starts where the knarr grounded, and the landing has a name', () => {
    const state = fresh('chart-start');
    expect(state.world.landingName.length).toBeGreaterThan(3);
    expect(Object.keys(state.world.trod)).toEqual([key(state.world.landing)]);
    expect(state.world.trod[key(state.world.landing)]).toBe(1);
  });

  it('records every hex actually stood on, with the day it was reached', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = wander('chart-walk', 6);
    const walked = route(state);
    expect(walked.length).toBeGreaterThan(1);
    expect(walked[0]!.day).toBe(1);
    // Days never go backwards, because the route is stored first-visit-first.
    for (let i = 1; i < walked.length; i++) {
      expect(walked[i]!.day).toBeGreaterThanOrEqual(walked[i - 1]!.day);
    }
    // And the band is standing on the last of them.
    expect(state.world.trod[key(state.party.at)]).toBeDefined();
  });

  it('remembers ground once, however often it is crossed', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    let state = fresh('chart-back');
    const start = state.party.at;
    const there = moveOptions(state)[0]!;
    state = apply(state, { type: 'MOVE', to: there });
    if (state.event || state.battle) return; // a card got in the way; not what we measure
    const firstDay = state.world.trod[key(there)];
    expect(firstDay).toBeDefined();

    const back = apply(state, { type: 'MOVE', to: start });
    if (back.event || back.battle) return;
    const again = apply(back, { type: 'MOVE', to: there });
    // The day of first arrival is the one the chart shows.
    expect(again.world.trod[key(there)]).toBe(firstDay);
  });

  it('only records ground walked, not ground merely seen', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = wander('chart-seen', 5);
    const trod = Object.keys(state.world.trod);
    const seen = Object.keys(state.world.seen);
    expect(trod.length).toBeLessThan(seen.length);
    // Everything walked is necessarily also seen.
    for (const k of trod) expect(state.world.seen[k]).toBeDefined();
  });

  it('is a path: consecutive steps are neighbours', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = wander('chart-path', 8);
    const walked = route(state);
    let adjacent = 0;
    for (let i = 1; i < walked.length; i++) {
      if (distance(walked[i - 1]!.at, walked[i]!.at) === 1) adjacent++;
    }
    // Not every pair need be adjacent — a revisited hex is not re-recorded,
    // so the sequence can jump. Most of it should join up, though, or the
    // drawn trail would be a scatter of dots.
    expect(adjacent).toBeGreaterThan((walked.length - 1) * 0.5);
  });

  it('survives a save, and an older save comes forward with an honest route', () => {
    const state = wander('chart-save', 4);
    const round = JSON.parse(encode(state)) as GameState;
    expect(round.world.trod).toEqual(state.world.trod);
    expect(round.world.landingName).toBe(state.world.landingName);

    // A v8 save has no record of where anyone walked. Rather than invent one,
    // the migration starts the route from where the band is standing.
    const { save } = migrate({
      version: 8,
      world: { tiles: {}, seen: {}, landing: { q: 2, r: 3 } },
      party: { at: { q: 5, r: 7 }, people: [] },
    });
    expect(save['version']).toBe(SAVE_VERSION);
    const world = save['world'] as { trod: Record<string, number>; landingName: string };
    expect(world.landingName).toBeTruthy();
    // The ROUTE itself retires with the hexes. `world.trod` is the hex map's
    // record of where a band walked, and v54 takes it out of a coast save
    // along with the island and the fog — a line remembers in `trodStops`,
    // and a hex route carried forward into a coast is a road through a
    // country that is not there. The v9 rule this asserts is the hex map's
    // and is still checked on the hex build.
    if (RETIRED_WITH_THE_HEXES) return;
    expect(world.trod).toEqual({ '5,7': 1 });
  });

  it('a walk of many days leaves a route the chart can draw', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = wander('chart-long', 12);
    const walked = route(state);
    expect(walked.length).toBeGreaterThan(3);
    for (const step of walked) {
      // Every recorded hex is real ground on the map.
      expect(state.world.tiles[key(step.at)], key(step.at)).toBeDefined();
      expect(neighbors(step.at)).toHaveLength(6);
    }
  });
});
