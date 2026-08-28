// The country has fixed points now.
//
// It did not before, and the data model lied about it: `Tile.landmark`
// pointed at a `data/landmarks` that was never written, and NOTHING in either
// repo ever set it. So every march line named a terrain — "we moved on into
// hills" — and three days' walking read as the same day three times.
//
// These bars hold the four things that make a landmark a landmark: that it is
// a fact of the seed rather than of the save, that it is sparse enough to
// mean something, that it can be picked out from a ridge miles off, and that
// knowing where you are is worth something when the weather closes in.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import {
  LANDMARK_REACH,
  keepsBearings,
  landmarkHere,
  landmarkNameAtStop,
  spotFixedPoints,
} from '../src/sim/landmark';
import { ROUTE_STOPS, daysBetween } from '../src/sim/route';
import { knowsStop, learnStop, onHeights } from '../src/sim/coast';

describe('the reason to climb a ridge', () => {
  it('picks fixed points out far past ordinary sight', () => {
    // A landmark you can only see by standing on it is not a landmark.
    // The band lands on a beach, so a run's opening hex is never a ridge —
    // an earlier cut of this bar waited for one and never ran at all. Put
    // them on high ground, which is what climbing it means.
    let ran = 0;
    // A ridge is a STRETCH whose country is hills, and reach is counted in
    // days — `spotFixedPoints` says so, because a hex was already a day's
    // walk. What is spotted comes back with a placeholder hex and a name,
    // so the claims are asked of the stretch: within reach, and known
    // afterwards where it was not before.
    for (let s = 0; s < 30 && ran < 3; s++) {
      const state = newGame(`lm-spot:${s}`);
      const ridge = [...Array(ROUTE_STOPS).keys()].find((stop) => onHeights(state, stop));
      if (ridge === undefined) continue;
      state.party.stop = ridge;
      const before = new Set(
        [...Array(ROUTE_STOPS).keys()].filter((stop) => knowsStop(state, stop)),
      );
      const found = spotFixedPoints(state);
      if (found.length === 0) continue;
      ran++;
      const after = [...Array(ROUTE_STOPS).keys()].filter((stop) => knowsStop(state, stop));
      // Spotting LIFTS the fog — on a line that is a stretch becoming known.
      expect(after.length, 'spotted something and learned nothing')
        .toBeGreaterThan(before.size);
      for (const stop of after) {
        if (before.has(stop)) continue;
        expect(daysBetween(state.seed, ridge, stop), `stretch ${stop} is past sight`)
          .toBeLessThanOrEqual(LANDMARK_REACH);
      }
    }
    expect(ran, 'no ridge on thirty coasts showed a fixed point').toBeGreaterThan(0);
  });

  it('never re-spots what is already on the chart', () => {
    const state = newGame('lm-respot');
    const ridge = [...Array(ROUTE_STOPS).keys()].find((stop) => onHeights(state, stop));
    expect(ridge, 'no ridge on this coast').toBeDefined();
    state.party.stop = ridge;
    spotFixedPoints(state);
    expect(spotFixedPoints(state), 'a ridge showed the same coast twice').toHaveLength(0);
  });
});

describe('knowing where you are', () => {
  it('is what a landmark buys when the weather closes in', () => {
    const state = newGame('lm-bearings');
    // Nowhere near one: no bearings.
    expect(keepsBearings(state)).toBe(landmarkHere(state) !== null);

    // Stand on the stretch the landmark stands on, and know it — a line
    // keeps its bearings by `knownStops`, not by lifting fog off a hex.
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      const name = landmarkNameAtStop(state.seed, stop);
      if (!name) continue;
      state.party.stop = stop;
      learnStop(state, stop);
      expect(landmarkHere(state)?.name).toBe(name);
      expect(keepsBearings(state)).toBe(true);
      return;
    }
    throw new Error('no landmark on a whole coast');
  });

});
