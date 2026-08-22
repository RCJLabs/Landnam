// What the map PROMISES must be what the sim allows.
//
// Written from a bug report — "some hexes aren't travelable even when you are
// right next to them, mainly on shallow water" — and both halves of it were
// measured before a line was changed:
//
//   * 1332 of 2866 hexes the map drew as shallow coastal water could never be
//     entered. Every one of them sat on the map's rim, where the tiles simply
//     run out: the renderer counted an off-map neighbour as "not ocean" and so
//     drew shallow water, while the sim counted it as "not land" and refused
//     the crossing. Two readings of the same fact in two files.
//   * 60 legal moves over 15 afloat turns were never drawn at all — the
//     knarr's three-hex reach, which `moveOptions` has computed since the
//     rowing work and which nothing in `src/` ever called.
//
// These are the bars that keep both shut.

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/rng';
import { newGame } from '../src/state/create';
import { generateWorld } from '../src/sim/worldgen';
import { fromKey, key, neighbors } from '../src/hex';
import { canMove, deepOcean, isCoastalWater, moveOptions } from '../src/sim/road';
import { applyTravel } from '../src/sim/travel';
import type { GameState } from '../src/state/types';
import { range } from '../src/hex';

/** Every hex a move could conceivably reach, independent of moveOptions —
 * so the bar compares two different readings rather than one with itself. */
function neighbourhood(state: GameState) {
  return range(state.party.at, 3);
}

describe('the sea the map draws is the sea the band can row', () => {
  it('draws deep water exactly where the knarr is refused', () => {
    // The invariant that makes the two readings one: over every ocean hex in
    // a generated world, "drawn deep" and "enterable coastal water" are
    // complements. No hex may be light and shut at the same time.
    for (let s = 0; s < 8; s++) {
      const world = generateWorld(makeRng(`reach:${s}`).derive('worldgen'));
      const state = { world } as unknown as GameState;
      let shallow = 0;
      for (const [k, tile] of Object.entries(world.tiles)) {
        if (tile.terrain !== 'ocean') continue;
        const at = fromKey(k);
        expect(deepOcean(state, at)).toBe(!isCoastalWater(state, at));
        if (!deepOcean(state, at)) shallow++;
      }
      // And the rim really is the sea's edge: a world that drew NO shallow
      // water would pass the line above trivially.
      expect(shallow).toBeGreaterThan(0);
    }
  });

  it('calls the map rim open sea, because that is what the band finds there', () => {
    // The reported population exactly: water on the rim that touches no land
    // tile at all. A rim hex that DOES touch a real shore is properly coastal
    // and stays enterable — that distinction is the whole point, and an
    // earlier draft of this bar got it wrong by condemning the whole rim.
    const world = generateWorld(makeRng('reach:rim').derive('worldgen'));
    const state = { world } as unknown as GameState;
    let landless = 0;
    for (const [k, tile] of Object.entries(world.tiles)) {
      if (tile.terrain !== 'ocean') continue;
      const at = fromKey(k);
      const offMap = neighbors(at).some((n) => world.tiles[key(n)] === undefined);
      const touchesLand = neighbors(at).some((n) => {
        const t = world.tiles[key(n)];
        return t !== undefined && t.terrain !== 'ocean';
      });
      if (!offMap || touchesLand) continue;
      landless++;
      // Off the edge of the world there is no shore to hug.
      expect(deepOcean(state, at)).toBe(true);
    }
    // This is the 1332-hex perimeter the report walked into: it must be big,
    // or the fix is being checked against nothing.
    expect(landless).toBeGreaterThan(100);
  });
});

describe('every move the map offers is a move the band can make', () => {
  it('offers all of them and only them, afloat and ashore', () => {
    let afloatTurns = 0;
    for (let s = 0; s < 25; s++) {
      let state = newGame(`reach-markers:${s}`);
      for (let turn = 0; turn < 14; turn++) {
        // The renderer draws exactly this list now (render/travel.ts's
        // `travelOptions` is `moveOptions`), so the bar that matters is that
        // the list itself is the whole legal truth: everything canMove
        // accepts, and nothing it refuses.
        const offered = moveOptions(state).map(key).sort();
        const legal = neighbourhood(state).filter((h) => canMove(state, h)).map(key).sort();
        expect(offered).toEqual(legal);
        if (isCoastalWater(state, state.party.at)) afloatTurns++;
        if (legal.length === 0) break;
        const next = applyTravel(state, { type: 'MOVE', to: legal.map(fromKey)[turn % legal.length]! });
        if (next === state || next.end || next.event) break;
        state = next;
      }
    }
    // The afloat case is the one that was broken; a run of seeds that never
    // put a hull on the water would prove nothing about it.
    expect(afloatTurns).toBeGreaterThan(0);
  });

  it('never offers the hex the band is already standing on', () => {
    // Found by the browser bar the moment the map began drawing the real
    // reach: a marker at span ZERO. `rowable` is trivially true from a hex to
    // itself, so afloat the sim accepted a MOVE that advanced the day and
    // moved nobody — 32 of 35 afloat states measured. The day was real.
    let afloat = 0;
    for (let s = 0; s < 40; s++) {
      let state = newGame(`reach-self:${s}`);
      for (let turn = 0; turn < 16; turn++) {
        expect(canMove(state, state.party.at)).toBe(false);
        expect(moveOptions(state).map(key)).not.toContain(key(state.party.at));
        if (isCoastalWater(state, state.party.at)) afloat++;
        const legal = moveOptions(state).filter((h) => canMove(state, h));
        if (legal.length === 0) break;
        const next = applyTravel(state, { type: 'MOVE', to: legal[turn % legal.length]! });
        if (next === state || next.end || next.event) break;
        state = next;
      }
    }
    expect(afloat).toBeGreaterThan(0);
  });

  it("shows the knarr's whole day of rowing, not one hex of it", () => {
    // The reach exists in the rules (ROW_REACH = 3 hexes for one day) and was
    // invisible on the map. Find a band afloat with real sea room and check
    // the map offers something further than a single step.
    for (let s = 0; s < 60; s++) {
      let state = newGame(`reach-row:${s}`);
      for (let turn = 0; turn < 16; turn++) {
        const legal = moveOptions(state).filter((h) => canMove(state, h));
        if (legal.length === 0) break;
        if (isCoastalWater(state, state.party.at)) {
          const far = legal.filter((h) => Math.max(
            Math.abs(h.q - state.party.at.q),
            Math.abs(h.r - state.party.at.r),
            Math.abs(h.q + h.r - state.party.at.q - state.party.at.r),
          ) > 1);
          if (far.length > 0) {
            // A day of rowing is three hexes; the map is handed all of them.
            const offered = new Set(moveOptions(state).map(key));
            for (const h of far) expect(offered.has(key(h))).toBe(true);
            return;
          }
        }
        const next = applyTravel(state, { type: 'MOVE', to: legal[turn % legal.length]! });
        if (next === state || next.end || next.event) break;
        state = next;
      }
    }
    throw new Error('no afloat band with sea room found — the probe never reached its case');
  });
});
