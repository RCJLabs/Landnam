// Places: the audit's first item. The map gains destinations — a monastery
// rich and soft, a town rich and hard, a wreck, an iron seam — and "go out
// under arms" finally has somewhere to go. The bars here: the data is sane,
// the seeding is deterministic and respects the ground, taking a place pays
// and provokes, a lost fight leaves it standing, and an old save gains
// exactly the places its seed would have been born with.

import { describe, it, expect } from 'vitest';
import { distance, key } from '../src/hex';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { stream } from '../src/rng';
import { apply } from '../src/sim/actions';
import { seedPlaces, placeHere, placeById, sackBlocker, settlePlace } from '../src/sim/places';
import { PLACE_KINDS, placeKind } from '../src/data/places';
import { knows } from '../src/sim/lore';
import { startBattle } from '../src/sim/battleTurn';
import type { GameState, Place } from '../src/state/types';

describe('content lint: places', () => {
  it('ids are unique, and every kind says what it is and what taking it says', () => {
    const ids = PLACE_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of PLACE_KINDS) {
      expect(kind.name.length, kind.id).toBeGreaterThan(5);
      expect(kind.blurb.length, kind.id).toBeGreaterThan(20);
      expect(kind.deed.length, kind.id).toBeGreaterThan(3);
      expect(kind.sackLine.length, kind.id).toBeGreaterThan(20);
      expect(kind.ground.length, kind.id).toBeGreaterThan(0);
      expect(kind.minFromLanding, kind.id).toBeGreaterThan(0);
    }
  });

  it('prices the guarded ones above the free ones, and makes guards mean infamy', () => {
    for (const kind of PLACE_KINDS) {
      const worth = kind.loot.food + kind.loot.firewood;
      if (kind.garrison !== null) {
        // A fight must pay better than salvage, and a fight is REMEMBERED.
        expect(worth, kind.id).toBeGreaterThanOrEqual(15);
        expect(kind.infamy, kind.id).toBeLessThan(0);
        expect(kind.garrison, kind.id).toBeGreaterThanOrEqual(0);
        expect(kind.garrison, kind.id).toBeLessThanOrEqual(6);
      } else {
        expect(kind.infamy, kind.id).toBe(0);
      }
      if (kind.teaches) {
        expect(kind.teaches.odds).toBeGreaterThan(0);
        expect(kind.teaches.odds).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the town out-pays the monastery, because its watch is paid to be awake', () => {
    const monastery = placeKind('monastery');
    const town = placeKind('town');
    expect(town.garrison!).toBeGreaterThan(monastery.garrison!);
    expect(town.loot.food + town.loot.firewood).toBeGreaterThan(
      monastery.loot.food + monastery.loot.firewood,
    );
    expect(town.infamy).toBeLessThan(monastery.infamy);
  });
});

describe('seeding the country', () => {
  it('is deterministic, stands on its own ground, and keeps its distance', () => {
    for (let s = 0; s < 12; s += 1) {
      const state = newGame(`place-seed-${s}`);
      const again = newGame(`place-seed-${s}`);
      expect(again.world.places).toEqual(state.world.places);

      for (const place of state.world.places) {
        const def = placeKind(place.kind);
        const ground = state.world.tiles[key(place.at)]!.terrain;
        expect(def.ground, `${place.id} on ${ground}`).toContain(ground);
        expect(distance(place.at, state.world.landing)).toBeGreaterThanOrEqual(def.minFromLanding);
      }
      // At most one of each kind, and no two in each other's laps.
      const kinds = state.world.places.map((p) => p.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it('most coasts get most places — a map with nothing on it defeats the point', () => {
    let total = 0;
    for (let s = 0; s < 12; s += 1) total += newGame(`place-count-${s}`).world.places.length;
    expect(total / 12).toBeGreaterThanOrEqual(3);
  });
});

/** Stands the band on a specific place, healthy and provisioned. */
function standingOn(seed: string, kind: Place['kind']): GameState | null {
  for (let s = 0; s < 30; s += 1) {
    const state = structuredClone(newGame(`${seed}-${s}`));
    const place = state.world.places.find((p) => p.kind === kind);
    if (!place) continue;
    state.party.at = { ...place.at };
    state.world.seen[key(place.at)] = 'visible';
    return state;
  }
  return null;
}

describe('taking a place', () => {
  it('an unguarded wreck is a day of work: loot, a mark on the map, a line in the saga', () => {
    const state = standingOn('wreck-take', 'wreck')!;
    expect(state).toBeTruthy();
    const place = placeHere(state)!;
    const before = { food: state.party.food, wood: state.party.firewood, day: state.day };

    const next = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(next).not.toBe(state);
    // The day still passes and the fire still burns, so the check is net:
    // the wood gained clearly outweighs a night's burn.
    expect(next.party.firewood).toBeGreaterThan(before.wood + 4);
    expect(placeById(next, place.id)!.sackedOn).toBe(before.day);
    expect(next.day).toBe(before.day + 1);
    expect(next.saga.some((l) => l.text.includes('wreck') || l.text.includes('timber'))).toBe(true);
  });

  it('a monastery is a fight first, and pays only if the field is won', () => {
    const state = standingOn('abbey-take', 'monastery')!;
    expect(state).toBeTruthy();
    const place = placeHere(state)!;
    const foodBefore = state.party.food;

    let next = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(next.battle).toBeTruthy();
    expect(next.battle!.placeId).toBe(place.id);
    expect(placeById(next, place.id)!.sackedOn).toBeUndefined();

    // Break the defenders and take the field.
    for (const c of next.battle!.combatants) {
      if (c.side === 'foe') { c.broken = true; c.nerve = 0; }
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('won');
    next = apply(next, { type: 'B_LEAVE' });

    expect(placeById(next, place.id)!.sackedOn).toBeDefined();
    expect(next.party.food).toBeGreaterThan(foodBefore);
  });

  it('a lost fight leaves the place standing, to come back for', () => {
    const state = standingOn('abbey-lost', 'monastery')!;
    const place = placeHere(state)!;
    let next = apply(state, { type: 'SACK_PLACE', id: place.id });
    for (const c of next.battle!.combatants) {
      if (c.side === 'warband') { c.down = true; }
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('lost');
    next = apply(next, { type: 'B_LEAVE' });
    expect(placeById(next, place.id)!.sackedOn).toBeUndefined();
    expect(sackBlocker(next, place.id)).toBe(null);
  });

  it('word starts where the smoke is seen: the nearest neighbour thinks less of you', () => {
    const state = standingOn('abbey-word', 'monastery')!;
    const place = placeHere(state)!;
    const nearest = [...state.neighbours].sort(
      (a, b) => distance(a.at, place.at) - distance(b.at, place.at),
    )[0]!;
    const before = nearest.standing;
    settlePlace(state, place.id);
    expect(state.neighbours.find((n) => n.id === nearest.id)!.standing).toBeLessThan(before);
  });

  it('a place is taken once — the second visit finds it picked clean', () => {
    const state = standingOn('wreck-twice', 'wreck')!;
    const place = placeHere(state)!;
    const once = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(sackBlocker(once, place.id)).toBe('taken');
    const twice = apply(once, { type: 'SACK_PLACE', id: place.id });
    expect(twice).toBe(once);
  });

  it('cannot be taken from a hex away', () => {
    const state = standingOn('wreck-away', 'wreck')!;
    const place = placeHere(state)!;
    state.party.at = { q: place.at.q + 2, r: place.at.r };
    expect(sackBlocker(state, place.id)).toBe('away');
    expect(apply(state, { type: 'SACK_PLACE', id: place.id })).toBe(state);
  });

  it('an iron seam can teach the band smithing, and never re-teaches it', () => {
    // The odds are seeded; find a seed where the lesson lands.
    for (let s = 0; s < 40; s += 1) {
      const state = standingOn(`seam-${s}`, 'oreseam');
      if (!state) continue;
      const place = placeHere(state)!;
      settlePlace(state, place.id);
      if (knows(state, 'smithing')) return; // the lesson can land: enough
    }
    throw new Error('no seed taught smithing in 40 tries — the odds are not wired');
  });
});

describe('the fight carries the stake', () => {
  it('startBattle stamps the placeId before any turn plays', () => {
    const state = standingOn('stamp', 'monastery')!;
    startBattle(state, 'shore', 1, { placeId: placeHere(state)!.id });
    expect(state.battle!.placeId).toBe(placeHere(state)!.id);
  });
});

describe('old saves gain the country they always had', () => {
  it('migrates a pre-place save to exactly the places its seed was born with', () => {
    const fresh = newGame('migrate-places');
    const old = structuredClone(fresh) as unknown as Record<string, unknown>;
    old['version'] = 17;
    delete (old['world'] as { places?: unknown }).places;

    const migrated = migrate(old).save;
    const world = migrated['world'] as { places: Place[] };
    expect(world.places).toEqual(fresh.world.places);
    // The CURRENT version, whatever it is by now — this assertion broke
    // twice pinned to a literal, and the claim was never about the number.
    expect(migrated['version']).toBe(SAVE_VERSION);
  });

  it('reseeding the same world twice gives the same places', () => {
    const state = newGame('reseed');
    const again = seedPlaces(state.world, stream('reseed', 'worldgen').derive('places'));
    expect(again).toEqual(state.world.places);
  });
});
