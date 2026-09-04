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
import { settled as settleSomewhere } from './fixtures/settle';
import { PURPOSES } from '../src/sim/expedition';
import { fieldCrew, homeCrew } from '../src/sim/expedition';
import { foodPerDay } from '../src/sim/upkeep';
import { VOYAGE_RECORD } from '../src/sim/voyage';
import { ABANDON_RECORD } from '../src/data/retreat';
import {
  CROSSING,
  MIN_ABOARD,
  MIN_ASHORE,
  aboard,
  atSeaAway,
  daysOut,
  SETTLER_STORES,
  provisioning,
  sailBlocker,
  sailForHome,
  voyageDay,
} from '../src/sim/voyage';
import { SEASON_LENGTH } from '../src/sim/calendar';
import { living } from '../src/sim/people';
import { roomLeft } from '../src/sim/joining';
import { crowding } from '../src/sim/colony';
import { SHIP_STRAKES } from '../src/data/ships';
import type { GameState } from '../src/state/types';

function hall(seed = 'voyage', extra = 0): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  state.party.stop = state.settlement!.stop;
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

describe('she does not sail on an empty hall', () => {
  // Added when the voyage was made worth taking. It was measurable as a TRAP
  // before this — forced to take every crossing she could, a band went from
  // 5 of 40 standing at day 400 to 3 — and the reason was that people came
  // home into a hall that could not feed them. Requiring the store first is
  // what turns the crossing from a thing you stumble into and regret into a
  // thing you spend a season preparing.

  it('asks for a season of food and a season of wood, and says which is short', () => {
    const state = hall('provision');
    const need = provisioning(state);
    expect(need.food).toBeGreaterThan(0);
    expect(need.firewood).toBeGreaterThan(0);

    state.party.food = need.food - 1;
    expect(sailBlocker(state, twoOf(state))).toBe('hungry');

    state.party.food = need.food;
    state.party.firewood = need.firewood - 1;
    expect(sailBlocker(state, twoOf(state))).toBe('cold');

    state.party.firewood = need.firewood;
    expect(sailBlocker(state, twoOf(state))).toBeNull();
  });

  it('asks for the store LAST, so the reason given is the one to act on', () => {
    // A hall short of wood AND short of hands should be told about the hands:
    // one of those is answered by a different choice, the other by work, and
    // a player sent to chop wood for a boat that would refuse them anyway has
    // been told the wrong thing.
    const state = hall('order');
    state.party.food = 0;
    state.party.firewood = 0;
    expect(sailBlocker(state, [living(state.party.people)[0]!.id])).toBe('shorthanded');
  });

  it('is a bar a working steading can actually clear', () => {
    // The first cut asked for `foodPerDay * CROSSING` — about 312 — against a
    // median hall holding 13 on a day it might have sailed. It opened for
    // nobody in forty sagas. A gate nothing can pass is not a decision.
    const state = hall('clearable');
    const need = provisioning(state);
    // eslint-disable-next-line no-console
    console.log(`a fresh hall of ${living(state.party.people).length} must bank `
      + `${need.food} food and ${need.firewood} wood to sail`);
    expect(need.food).toBeLessThan(150);
    expect(need.firewood).toBeLessThan(150);
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

describe('settlers arrive with what it takes to start', () => {
  it('brings a season of eating per head, on top of what the hull carries', () => {
    // THE line that makes a crossing worth taking. The hold used to return a
    // flat share of itself whoever was aboard — about twenty food — and
    // twenty food feeds three new arrivals for two days. Measured across four
    // separate experiments, the band is FOOD-limited rather than
    // hand-limited, so a voyage that converted a banked surplus into people
    // was trading the scarce thing for the plentiful one.
    const state = hall('arrive');
    state.party.food = 400;
    state.party.firewood = 400;
    sailForHome(state, twoOf(state));
    const before = living(state.party.people).length;
    const larder = state.party.food;
    state.day = state.voyage!.due;
    voyageDay(state);
    const came = living(state.party.people).length - before;
    const gained = state.party.food - larder;
    // eslint-disable-next-line no-console
    console.log(`she came home with ${came} people and ${gained} food — `
      + `${came * SETTLER_STORES} of it theirs`);
    expect(came).toBeGreaterThan(0);
    // Every arrival's own season, and the hull's share on top.
    expect(gained).toBeGreaterThanOrEqual(came * SETTLER_STORES);
    // A season each is the point: they are not a mouth the hall has to find
    // room for on the day they land.
    expect(SETTLER_STORES * 2).toBe(SEASON_LENGTH);
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

// 9.2: the crossing states its record, as the door out does.
describe('the crossing says what became of the bands that took it', () => {
  it('states an outcome and a cause, not advice', () => {
    // Measured at saved 4 / killed 9 over 200 landings, re-taken 2026-08-31.
    // The line has to carry BOTH halves: what happened, and why.
    //
    // THIS TEST USED TO PIN THE WRONG WHY. It asserted /mouths/i, which
    // enforced the unfunded-mouths cause — and that cause has since failed
    // two sweeps: funding the mouths four times as well made things worse,
    // and shortening the crossing (which is what changes when they land
    // relative to winter) moved nothing at all. A bar that holds a card to a
    // disproved explanation is worse than no bar, so it pins what survived
    // instead, and pins the disproved half OUT so it cannot quietly return.
    expect(VOYAGE_RECORD).toMatch(/more died|more were/i);
    expect(VOYAGE_RECORD).toMatch(/crossing/i);
    expect(VOYAGE_RECORD, 'the disproved cause came back').not.toMatch(/mouths/i);
    // And it must not instruct.
    expect(VOYAGE_RECORD).not.toMatch(/\byou should\b|\bdo not\b|\bnever\b/i);
  });

  it('does not contradict the door out, which makes the same kind of claim', () => {
    // Two records in the same voice. If one ever drifts into advice the other
    // will not, and the pair reading differently on the same screen is the
    // tell that somebody edited one without the measurement behind it.
    expect(VOYAGE_RECORD).not.toBe(ABANDON_RECORD);
    for (const line of [VOYAGE_RECORD, ABANDON_RECORD]) {
      expect(line).toMatch(/more died|more were/i);
      expect(line.trim().endsWith('.'), `${line} should be whole sentences`).toBe(true);
    }
  });
});
