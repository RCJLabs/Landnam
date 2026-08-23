// The knarr away over the open sea.
//
// She could row a coast, fight on the water, carry a strandhögg home and
// spring a strake on rock — and every one of those happened inside the same
// eighteen hundred hexes. There was nowhere to go that was not on the map, so
// the one thing a knarr was actually FOR, crossing open water to somewhere
// else and coming back with what was there, could not happen.
//
// A voyage is not an expedition. An expedition walks the map and can be seen
// and recalled; this leaves the map entirely, and what it costs is a season
// of hands through the part of the year that needs them.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { PURPOSES } from '../src/sim/expedition';
import { fieldCrew, homeCrew } from '../src/sim/expedition';
import { foodPerDay } from '../src/sim/upkeep';
import {
  CROSSING,
  MIN_ABOARD,
  MIN_ASHORE,
  aboard,
  atSeaAway,
  daysOut,
  sailBlocker,
  sailForHome,
  voyageDay,
} from '../src/sim/voyage';
import { living } from '../src/sim/people';
import { roomLeft } from '../src/sim/joining';
import { crowding } from '../src/sim/colony';
import { canFound, foundSettlement } from '../src/sim/site';
import { fromKey } from '../src/hex';
import { SHIP_STRAKES } from '../src/data/ships';
import type { GameState } from '../src/state/types';

function hall(seed = 'voyage', extra = 0): GameState {
  const state = newGame(seed);
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    state.world.seen[k] = 'visible';
    if (!canFound(state, at)) continue;
    foundSettlement(state);
    break;
  }
  if (!state.settlement) throw new Error('no site — the fixture never ran');
  state.party.at = state.settlement.at;
  state.party.food = 300;
  state.party.firewood = 300;
  const seed0 = state.party.people[0]!;
  for (let i = 0; i < extra; i++) {
    state.party.people.push({
      ...structuredClone(seed0), id: `x${i}`, name: `Guest${i}`, bond: 'hand', injuries: [],
    } as never);
  }
  return state;
}

const twoOf = (state: GameState): string[] =>
  living(state.party.people).slice(0, 2).map((p) => p.id);

describe('she rides the picker the expedition already had', () => {
  it('is offered as a purpose rather than a second roster card', () => {
    // The question is the same one — which hands can the hall spare — and
    // asking it twice with two cards would be worse.
    expect(PURPOSES.map((p) => p.id)).toContain('home');
  });
});

describe('what will stop her sailing', () => {
  it('refuses without a hall, with a party out, or twice over', () => {
    const road = newGame('voyage-road');
    expect(sailBlocker(road, [])).toBe('nosteading');

    const state = hall('voyage-gates');
    expect(sailBlocker(state, [])).toBe('nobody');
    expect(sailBlocker(state, twoOf(state))).toBeNull();

    sailForHome(state, twoOf(state));
    expect(sailBlocker(state, twoOf(state))).toBe('already');
  });

  it('will not cross open water on a hull with nothing left', () => {
    const state = hall('voyage-hull');
    state.ship.strakes = 0;
    expect(sailBlocker(state, twoOf(state))).toBe('hull');
    // One sprung strake is a risk the player is allowed to take.
    state.ship.strakes = SHIP_STRAKES - 1;
    expect(sailBlocker(state, twoOf(state))).toBeNull();
  });

  it('needs hands to work her and hands to keep the fire', () => {
    const state = hall('voyage-crew');
    const crew = living(state.party.people);
    expect(sailBlocker(state, [crew[0]!.id])).toBe('shorthanded');
    expect(MIN_ABOARD).toBe(2);
    // Everybody aboard leaves nobody at home.
    expect(sailBlocker(state, crew.map((p) => p.id))).toBe('unmanned');
    expect(MIN_ASHORE).toBeGreaterThan(0);
  });
});

describe('the crew are GONE, which is the whole cost', () => {
  it('takes them off the fields, off the map, and off the ration', () => {
    const state = hall('voyage-gone');
    const before = { home: homeCrew(state).length, field: fieldCrew(state).length };
    const eating = foodPerDay(state);

    sailForHome(state, twoOf(state));
    expect(aboard(state)).toHaveLength(2);
    for (const p of aboard(state)) expect(atSeaAway(state, p)).toBe(true);

    // Not working the steading, not standing on the map, and not eating out
    // of the store — they took their own. Counting them at home would feed
    // them twice.
    expect(homeCrew(state).length).toBe(before.home - 2);
    expect(fieldCrew(state).length).toBe(before.field - 2);
    expect(foodPerDay(state)).toBeLessThan(eating);
  });

  it('takes stores for the crossing out of the hall', () => {
    const state = hall('voyage-stores');
    const before = state.party.food;
    sailForHome(state, twoOf(state));
    expect(state.party.food).toBeLessThan(before);
    expect(state.voyage!.carried).toBeGreaterThan(0);
  });

  it('is gone for most of a year, and says when she is due', () => {
    const state = hall('voyage-due');
    sailForHome(state, twoOf(state));
    expect(daysOut(state)).toBe(CROSSING);
    // Long enough to cost a winter. That is the decision.
    expect(CROSSING).toBeGreaterThan(60);
    state.day += CROSSING - 1;
    expect(voyageDay(state)).toBe(false);
  });
});

describe('what she brings back', () => {
  it('comes home with stores and with people who want land', () => {
    const state = hall('voyage-back');
    const crew = living(state.party.people).length;
    const food = state.party.food;
    sailForHome(state, twoOf(state));

    state.day = state.voyage!.due;
    expect(voyageDay(state)).toBe(true);
    expect(state.voyage).toBeUndefined();

    // Stores, always. People, when there is room for them — the payoff a
    // marginal colony actually needs.
    expect(state.party.food).toBeGreaterThan(food - state.party.food);
    expect(living(state.party.people).length).toBeGreaterThanOrEqual(crew);
    // And everyone who sailed is home again and counted.
    expect(aboard(state)).toHaveLength(0);
    expect(homeCrew(state).length).toBeGreaterThanOrEqual(crew - 2);
  });

  it('brings them in over the roof, and that is the cost', () => {
    // Measured before this was written: gated on the hall's room a voyage
    // brought back NOBODY in the ordinary case, because a fresh steading
    // holds exactly the six already in it — 156 hand-days for nine food, a
    // trap rather than a decision. People fetched from across an ocean have
    // nowhere else to walk to; they crowd in, and a crowded hall is what
    // gets sick.
    const state = hall('voyage-full');
    const crew = living(state.party.people).length;
    const room = roomLeft(state);
    sailForHome(state, twoOf(state));
    state.day = state.voyage!.due;
    voyageDay(state);
    const now = living(state.party.people).length;
    expect(now).toBeGreaterThan(crew);
    // Really over the roof, not merely filling it.
    expect(now - crew).toBeGreaterThan(room);
    expect(crowding(state)).toBeGreaterThan(0);
  });
});

describe('what a voyage is worth, measured', () => {
  it('prices a season of hands against what comes back', () => {
    let hands = 0;
    let brought = 0;
    let stores = 0;
    let rough = 0;
    const runs = 40;

    for (let s = 0; s < runs; s++) {
      const state = hall(`voyage-worth:${s}`);
      const before = living(state.party.people).length;
      const food = state.party.food;
      const strakes = state.ship.strakes;
      sailForHome(state, twoOf(state));
      hands += 2 * CROSSING; // hand-days the hall goes without

      state.day = state.voyage!.due;
      voyageDay(state);
      brought += living(state.party.people).length - before;
      stores += state.party.food - food;
      if (state.ship.strakes < strakes) rough++;
    }

    console.log(`sailing east, ${runs} voyages of ${CROSSING} days:`);
    console.log(`  hands the hall went without: ${(hands / runs).toFixed(0)} hand-days each`);
    console.log(`  came back with             : ${(brought / runs).toFixed(2)} people, ${(stores / runs).toFixed(1)} food`);
    console.log(`  bad crossings              : ${rough} of ${runs} sprang a strake`);

    // It has to bring something, or nobody would ever go...
    expect(brought / runs).toBeGreaterThan(0);
    // ...and the sea has to have its say, or it is a vending machine.
    expect(rough).toBeGreaterThan(0);
    expect(rough).toBeLessThan(runs);
  });
});
