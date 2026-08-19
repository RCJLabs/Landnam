// A coast with somebody else's dead steading on it.
//
// The zero-network constraint is the whole point: no server, no account, no
// request. A challenge code is a line of text that goes through a chat app
// and gets retyped with a thumb, and this is that line carrying one more
// thing. So the two properties worth guarding are the ones that make it
// survivable text rather than a protocol:
//
//   - a mangled ghost costs the RUIN and never the coast;
//   - and a haunted coast is not an easier coast, or the code is worth more
//     than the seed it was cut from and every shared run is softer than the
//     one being bragged about.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import {
  decodeChallenge,
  encodeChallenge,
  challengeOf,
  ghostOf,
} from '../src/sim/challenge';
import { HAUNT_REACH, ghostLine, haunt, hauntedHex, theRuin } from '../src/sim/haunt';
import { PLACE_KINDS, placeKind } from '../src/data/places';
import { seedPlaces } from '../src/sim/places';
import { stream } from '../src/rng';
import { distance } from '../src/hex';
import { canFound, foundSettlement } from '../src/sim/site';
import { fromKey } from '../src/hex';
import type { GameState, Ghost } from '../src/state/types';

const GHOST: Ghost = { name: 'Eikstead', at: { q: 3, r: -2 }, day: 128, cause: 'starved' };

describe('the code carries a steading and survives being retyped', () => {
  it('round-trips a ghost through the text', () => {
    const code = encodeChallenge({ seed: 'raven-skerry-317', hardship: 'fair', ghost: GHOST });
    const back = decodeChallenge(code);
    expect(back?.ghost).toEqual(GHOST);
    // Still one line of readable text with the seed visible in it, which is
    // the reason this format is not base64.
    expect(code).toContain('raven-skerry-317');
    expect(code.split(/\s+/).length).toBeLessThan(8);
  });

  it('keeps a steading whose name has a space in it', () => {
    const two: Ghost = { ...GHOST, name: 'Two Rivers' };
    const back = decodeChallenge(encodeChallenge({ seed: 's', hardship: 'even', ghost: two }));
    expect(back?.ghost?.name).toBe('Two Rivers');
  });

  it('does not lower the case of a name, because a name is a name', () => {
    const back = decodeChallenge(encodeChallenge({ seed: 's', hardship: 'even', ghost: GHOST }));
    expect(back?.ghost?.name).toBe('Eikstead');
  });

  it('loses the ruin and keeps the coast when the ghost is mangled', () => {
    // THE RULE THE WHOLE FORMAT IS BUILT ON. Every one of these is a thing
    // that happens to a string on its way through a chat app.
    const bad = [
      'LN1 raven-skerry-317 fair g3',
      'LN1 raven-skerry-317 fair g3,-2',
      'LN1 raven-skerry-317 fair g3,-2,Eikstead',
      'LN1 raven-skerry-317 fair gx,y,Eikstead,128,starved',
      'LN1 raven-skerry-317 fair g3,-2,,128,starved',
    ];
    for (const code of bad) {
      const back = decodeChallenge(code);
      expect(back, `${code} cost the player the coast`).toBeTruthy();
      expect(back!.seed, code).toBe('raven-skerry-317');
      expect(back!.hardship, code).toBe('fair');
      expect(back!.ghost, `${code} was read as a ghost anyway`).toBeUndefined();
    }
  });

  it('only offers a ghost from a saga that actually ended', () => {
    // A run still being played has a steading, not a ruin. Sending one would
    // be claiming a death that has not happened — the same reason `coastOf`
    // carries no mark.
    const live = settled('haunt-live');
    expect(ghostOf(live)).toBeUndefined();
    live.end = { cause: 'starved', title: 'x', lines: [] };
    expect(ghostOf(live)?.name).toBe(live.settlement!.name);
    expect(challengeOf(live)).toContain('g');
  });
});

describe('worldgen never grows its own ruin', () => {
  it('seeds every kind except the unseeded one', () => {
    // If a country grew its own ruin the ghost would mean nothing, AND the
    // worldgen parity vectors would move for every seed ever recorded.
    const world = structuredClone(newGame('haunt-seed')).world;
    const placed = seedPlaces(world, stream('haunt-seed', 'worldgen').derive('places'));
    expect(placed.some((p) => p.kind === 'ruin')).toBe(false);
    for (const kind of PLACE_KINDS) {
      if (kind.seeded === false) continue;
      expect(placed.some((p) => p.kind === kind.id), `${kind.id} stopped being seeded`).toBe(true);
    }
  });

  it('marks exactly the ruin as unseeded', () => {
    expect(PLACE_KINDS.filter((k) => k.seeded === false).map((k) => k.id)).toEqual(['ruin']);
  });
});

describe('the haunting itself', () => {
  it('stands the ruin on the ground the ghost named', () => {
    const state = structuredClone(newGame('haunt-place'));
    // A hex this world will actually hold a ruin on.
    const at = Object.keys(state.world.tiles).map(fromKey).find(
      (h) => placeKind('ruin').ground.includes(state.world.tiles[`${h.q},${h.r}`]!.terrain)
        && !state.world.places.some((p) => p.at.q === h.q && p.at.r === h.r)
        && distance(h, state.world.landing) > 0,
    );
    expect(at, 'no ground in this world holds a ruin').toBeTruthy();
    expect(haunt(state, { ...GHOST, at: at! })).toBe(true);
    expect(theRuin(state)?.at).toEqual({ q: at!.q, r: at!.r });
    expect(ghostLine(state)).toContain('Eikstead');
    expect(ghostLine(state)).toContain('ran out of food');
  });

  it('settles for near ground when the named hex is under the sea', () => {
    const state = structuredClone(newGame('haunt-sea'));
    const ocean = Object.entries(state.world.tiles)
      .find(([, t]) => t.terrain === 'ocean')![0];
    const found = hauntedHex(state, { ...GHOST, at: fromKey(ocean) });
    if (found) {
      expect(distance(found, fromKey(ocean))).toBeLessThanOrEqual(HAUNT_REACH);
      expect(placeKind('ruin').ground).toContain(state.world.tiles[`${found.q},${found.r}`]!.terrain);
    }
  });

  it('gives up quietly rather than throwing when nothing will hold it', () => {
    const state = structuredClone(newGame('haunt-nowhere'));
    // Far outside the map entirely.
    expect(() => haunt(state, { ...GHOST, at: { q: 9999, r: -9999 } })).not.toThrow();
    expect(theRuin(state)).toBeUndefined();
  });

  it('never stands on the landing beach', () => {
    const state = structuredClone(newGame('haunt-landing'));
    haunt(state, { ...GHOST, at: state.world.landing });
    const ruin = theRuin(state);
    if (ruin) expect(distance(ruin.at, state.world.landing)).toBeGreaterThan(0);
  });
});

describe('a haunted coast is not an easier coast', () => {
  /**
   * The property that keeps a challenge worth what it claims.
   *
   * If the ruin were a windfall, a code would be worth more than the seed it
   * was cut from, and every shared run would be softer than the one being
   * bragged about. So it is small, it is mostly TIMBER — what survives an
   * abandoned steading is the woodpile, not the larder, because the larder is
   * what ran out — and it is worth less than anything the country grows.
   */
  it('never out-pays the salvage it most resembles, and is mostly wood', () => {
    // Measured against the WRECK rather than against every kind, and the
    // first cut of this bar got that wrong: it demanded the ruin be the
    // poorest thing on the coast, which cannot be true because the oreseam
    // pays nothing in goods at all — it pays in lore. Comparing goods totals
    // across kinds that trade in different currencies is not a comparison.
    // The wreck is the right comparator: both are an unowned thing taken
    // apart in a day, with no garrison and nobody to anger.
    const ruin = placeKind('ruin');
    const worth = (id: string) => {
      const k = placeKind(id as 'wreck');
      return k.loot.food + k.loot.firewood;
    };
    expect(worth('ruin'), 'the ruin out-pays the wreck').toBeLessThan(worth('wreck'));
    expect(placeKind('wreck').garrison, 'the wreck stopped being the right comparator').toBeNull();
    expect(ruin.loot.firewood).toBeGreaterThan(ruin.loot.food);
    // And nobody is angered by going through a dead steading.
    expect(ruin.infamy).toBe(0);
    expect(ruin.garrison).toBeNull();
  });
});

describe('old saves', () => {
  it('come forward unhaunted, which is what they were', () => {
    const save = structuredClone(newGame('haunt-old')) as unknown as Record<string, unknown>;
    save['version'] = 33;
    delete save['ghost'];
    const out = migrate(save).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect(out['ghost']).toBeUndefined();
  });
});

function settled(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const at = Object.keys(state.world.tiles).map(fromKey).find((h) => {
    state.party.at = h;
    return canFound(state, h);
  });
  expect(at, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = at!;
  expect(foundSettlement(state)).toBe(true);
  return state;
}
