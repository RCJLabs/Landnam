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
import { fromKey, key, distance } from '../src/hex';
import { LANDMARKS, landmarkDef } from '../src/data/landmarks';
import {
  LANDMARK_REACH,
  LANDMARK_SHARE,
  keepsBearings,
  landmarkAt,
  landmarkHere,
  landmarkName,
  landmarkNameAtStop,
  spotFixedPoints,
} from '../src/sim/landmark';
import { onHighGround } from '../src/sim/fog';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { ROUTE_STOPS, daysBetween } from '../src/sim/route';
import { knowsStop, learnStop, onHeights } from '../src/sim/coast';

describe('a fact of the seed, not of the save', () => {
  it('answers the same for the same country every time', () => {
    const a = newGame('lm-same');
    const b = newGame('lm-same');
    let found = 0;
    for (const k of Object.keys(a.world.tiles).slice(0, 3000)) {
      const at = fromKey(k);
      const one = landmarkAt(a.world, a.seed, at);
      expect(one).toBe(landmarkAt(b.world, b.seed, at));
      if (one) found++;
    }
    expect(found).toBeGreaterThan(5);
  });

  it('stores nothing: the tile fields that used to promise this are gone', () => {
    const state = newGame('lm-save');
    const tile = state.world.tiles[key(state.world.landing)]!;
    // They were dead weight for years — declared, never written, never read.
    expect('landmark' in tile).toBe(false);
    expect('explored' in tile).toBe(false);
  });

  it('names the same stone the same thing, and names it like a place', () => {
    const state = newGame('lm-name');
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      const name = landmarkName(state.world, state.seed, at);
      if (!name) continue;
      expect(name).toBe(landmarkName(state.world, state.seed, at));
      // A name, not an id: either "the Split Rock" or "Ravenstone Falls".
      expect(name).toMatch(/^(the [A-Z][a-z-]+ [A-Z][a-z]+|[A-Z][a-z]+[a-z]+)$/);
      return;
    }
    throw new Error('no landmark in a whole world — the bar never ran');
  });
});

describe('sparse enough to mean something', () => {
  it('salts the country rather than paving it', () => {
    let eligible = 0;
    let marks = 0;
    for (let s = 0; s < 4; s++) {
      const state = newGame(`lm-density:${s}`);
      for (const k of Object.keys(state.world.tiles)) {
        const at = fromKey(k);
        const tile = state.world.tiles[k]!;
        if (tile.river) continue;
        if (!LANDMARKS.some((l) => l.on.includes(tile.terrain))) continue;
        eligible++;
        if (landmarkAt(state.world, state.seed, at)) marks++;
      }
    }
    const share = marks / eligible;
    console.log(`landmarks: ${marks} on ${eligible} eligible hexes (${(share * 100).toFixed(1)}%)`);
    // Order, not the constant — tuning the density must not argue with a bar.
    expect(share).toBeGreaterThan(LANDMARK_SHARE * 0.6);
    expect(share).toBeLessThan(LANDMARK_SHARE * 1.5);
  });

  it('only stands on ground its kind belongs on', () => {
    const state = newGame('lm-ground');
    let checked = 0;
    for (const k of Object.keys(state.world.tiles)) {
      const id = landmarkAt(state.world, state.seed, fromKey(k));
      if (!id) continue;
      checked++;
      // No sea stacks in the mountains, no waterfalls on a beach.
      expect(landmarkDef(id).on).toContain(state.world.tiles[k]!.terrain);
      expect(state.world.tiles[k]!.river).toBe(false);
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('the reason to climb a ridge', () => {
  it('picks fixed points out far past ordinary sight', () => {
    // A landmark you can only see by standing on it is not a landmark.
    // The band lands on a beach, so a run's opening hex is never a ridge —
    // an earlier cut of this bar waited for one and never ran at all. Put
    // them on high ground, which is what climbing it means.
    let ran = 0;
    if (COAST_IS_A_LINE) {
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
        const found = spotFixedPoints(state, state.party.at);
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
      return;
    }
    for (let s = 0; s < 30 && ran < 3; s++) {
      const state = newGame(`lm-spot:${s}`);
      const ridge = Object.keys(state.world.tiles)
        .map((k) => fromKey(k))
        .find((at) => onHighGround(state.world, at));
      if (!ridge) continue;
      const from = ridge;
      state.party.at = from;
      const found = spotFixedPoints(state, from);
      if (found.length === 0) continue;
      ran++;
      for (const f of found) {
        expect(distance(f.at, from)).toBeLessThanOrEqual(LANDMARK_REACH);
        // Spotting LIFTS the fog on it — that is the whole mechanic.
        expect(state.world.seen[key(f.at)]).toBeDefined();
      }
    }
    expect(ran).toBeGreaterThan(0);
  });

  it('never re-spots what is already on the chart', () => {
    const state = newGame('lm-respot');
    const from = Object.keys(state.world.tiles)
      .map((k) => fromKey(k))
      .find((at) => onHighGround(state.world, at)) ?? state.party.at;
    const first = spotFixedPoints(state, from);
    const again = spotFixedPoints(state, from);
    expect(again).toHaveLength(0);
    void first;
  });
});

describe('knowing where you are', () => {
  it('is what a landmark buys when the weather closes in', () => {
    const state = newGame('lm-bearings');
    // Nowhere near one: no bearings.
    expect(keepsBearings(state)).toBe(landmarkHere(state) !== null);

    if (COAST_IS_A_LINE) {
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
    }

    // Stand the band beside a known one and it keeps them.
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      if (!landmarkAt(state.world, state.seed, at)) continue;
      state.party.at = at;
      state.world.seen[k] = 'visible';
      expect(landmarkHere(state)?.name).toBe(landmarkName(state.world, state.seed, at));
      expect(keepsBearings(state)).toBe(true);
      return;
    }
    throw new Error('no landmark in a whole world');
  });

  it('needs the band to have SEEN it — an unfound stone is no help', () => {
    const state = newGame('lm-unseen');
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      if (!landmarkAt(state.world, state.seed, at)) continue;
      state.party.at = at;
      delete state.world.seen[k];
      // And clear the ring, or a neighbour's landmark answers instead.
      for (const n of Object.keys(state.world.seen)) {
        if (distance(fromKey(n), at) <= 1) delete state.world.seen[n];
      }
      expect(keepsBearings(state)).toBe(false);
      return;
    }
    throw new Error('no landmark in a whole world');
  });
});
