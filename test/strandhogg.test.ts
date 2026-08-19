// The strandhögg: falling on a coastal place from the ship.
//
// The sea had a hull, cargo and hull-to-hull fights, but every verb that
// mattered was still a land verb — rowing was walking on water. This is the
// one the period ran on, and it earns its place by being a genuinely
// different bargain from walking up to the same gate: better if you win,
// much worse if you lose.

import { describe, it, expect } from 'vitest';
import { holed } from '../src/sim/ship';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { distance, neighbors, key } from '../src/hex';
import { placeKind } from '../src/data/places';
import { settlePlace } from '../src/sim/places';
import { leaveBattle } from '../src/sim/battleTurn';
import {
  STRAND_FEWER,
  STRAND_HAUL,
  STRAND_INFAMY,
  canStrandhogg,
  strandTarget,
} from '../src/sim/sea';
import type { GameState, Place } from '../src/state/types';

/**
 * Puts a guarded place on the shore and the band afloat beside it. Built by
 * hand rather than hunted for in worldgen: the arrangement is the fixture.
 */
function afloatBeside(seed: string, kind: Place['kind'] = 'monastery'): {
  state: GameState;
  place: Place;
} {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  // Find any water hex with a land neighbour.
  let water: GameState['party']['at'] | null = null;
  let shore: GameState['party']['at'] | null = null;
  for (const k of Object.keys(state.world.tiles)) {
    const at = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
    if (state.world.tiles[key(at)]?.terrain !== 'ocean') continue;
    const land = neighbors(at).find(
      (n) => state.world.tiles[key(n)] && state.world.tiles[key(n)]!.terrain !== 'ocean',
    );
    if (land) {
      water = at;
      shore = land;
      break;
    }
  }
  expect(water && shore, `${seed}: no coast at all`).toBeTruthy();
  state.party.at = water!;
  const place: Place = { id: 'strand-mark', kind, at: shore! };
  state.world.places = [place, ...state.world.places.filter((p) => key(p.at) !== key(shore!))];
  return { state, place };
}

describe("when the ship's way is offered", () => {
  it('afloat beside a guarded place, and only then', () => {
    const { state, place } = afloatBeside('strand-yes');
    expect(strandTarget(state)?.id).toBe(place.id);
    expect(canStrandhogg(state)).toBe(true);
  });

  it('never from dry land, however close the place is', () => {
    const { state, place } = afloatBeside('strand-ashore');
    state.party.at = place.at;
    expect(strandTarget(state)).toBeUndefined();
    expect(apply(state, { type: 'STRANDHOGG' })).toBe(state);
  });

  it('never on a place already picked clean', () => {
    const { state, place } = afloatBeside('strand-taken');
    place.sackedOn = 5;
    expect(strandTarget(state)).toBeUndefined();
  });

  it('never on an unguarded place — there is nobody to surprise', () => {
    // A wreck has no garrison; rowing up to it is just rowing up to it.
    const { state } = afloatBeside('strand-wreck', 'wreck');
    expect(placeKind('wreck').garrison).toBeNull();
    expect(strandTarget(state)).toBeUndefined();
  });
});

describe('what coming out of the water is worth', () => {
  it('they are fewer, shaken, and the log says why', () => {
    const { state, place } = afloatBeside('strand-fight');
    const def = placeKind(place.kind);
    const next = apply(state, { type: 'STRANDHOGG' });
    expect(next).not.toBe(state);

    const battle = next.battle!;
    expect(battle.strandhogg).toBe(true);
    expect(battle.placeId).toBe(place.id);
    expect(battle.log.join(' ')).toContain('not thought to watch the water');

    // Fewer than walking up would have brought.
    const byLand = apply({ ...structuredClone(state), party: { ...structuredClone(state).party, at: place.at } },
      { type: 'SACK_PLACE', id: place.id });
    expect(battle.foes.length).toBeLessThanOrEqual(byLand.battle!.foes.length);
    expect(def.garrison).toBeGreaterThan(0);

    // And shaken: nobody defending starts at full nerve.
    const foes = battle.combatants.filter((c) => c.side === 'foe');
    expect(foes.length).toBeGreaterThan(0);
    expect(foes.every((c) => c.nerve < 100)).toBe(true);
  });

  it('the hold carries more home, and the coast remembers it longer', () => {
    const { state, place } = afloatBeside('strand-haul');
    const def = placeKind(place.kind);

    const byLand = structuredClone(state);
    settlePlace(byLand, place.id, false);
    const bySea = structuredClone(state);
    settlePlace(bySea, place.id, true);

    expect(bySea.party.food - state.party.food).toBe(Math.round(def.loot.food * STRAND_HAUL));
    expect(bySea.party.food).toBeGreaterThan(byLand.party.food);

    // Infamy is a negative shift, so "worse" is a lower standing — and it
    // lands on the neighbour NEAREST the smoke, not on whoever happens to
    // like the band least. Reading the minimum across the coast was the
    // fixture's own bug: it passed only while the two were the same person,
    // and went quiet the moment placement moved anybody.
    const moved = (s: GameState) =>
      [...s.neighbours].sort((a, b) => distance(a.at, place.at) - distance(b.at, place.at))[0]!;
    expect(STRAND_INFAMY).toBeGreaterThan(1);
    expect(moved(bySea).standing).toBeLessThan(moved(byLand).standing);
    expect(moved(byLand).standing).toBeLessThan(moved(state).standing);
    expect(bySea.saga.some((e) => e.text.includes('loaded the knarr'))).toBe(true);
  });

  it('losing one costs the cargo and the hull, as a sea fight does', () => {
    const { state } = afloatBeside('strand-lost');
    const next = apply(state, { type: 'STRANDHOGG' });
    const fighting = structuredClone(next);
    fighting.party.food = 100;
    fighting.battle!.outcome = 'lost';

    leaveBattle(fighting);
    expect(holed(fighting.ship)).toBe(true);
    expect(fighting.party.food).toBeLessThan(100);
  });

  it("winning takes the place, by the ship's reckoning", () => {
    const { state, place } = afloatBeside('strand-won');
    const next = apply(state, { type: 'STRANDHOGG' });
    const fighting = structuredClone(next);
    fighting.battle!.outcome = 'won';
    const before = fighting.party.food;

    leaveBattle(fighting);
    const taken = fighting.world.places.find((p) => p.id === place.id)!;
    expect(taken.sackedOn).toBeDefined();
    expect(fighting.party.food).toBeGreaterThan(before);
  });

  it('the surprise is real but bounded — they are never wiped out for free', () => {
    // A garrison reduced below nothing would make the deed a free take.
    const { state } = afloatBeside('strand-floor', 'town');
    const next = apply(state, { type: 'STRANDHOGG' });
    expect(next.battle!.foes.length).toBeGreaterThan(0);
    expect(STRAND_FEWER).toBeGreaterThan(0);
  });
});
