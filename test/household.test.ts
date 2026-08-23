// Households made on this coast, and the hall passing when the leader falls.
//
// THE SCOPE OF THIS IS A MEASUREMENT, and it is the important part. The queue
// item asked for children who grow into working hands. They cannot, and the
// arithmetic is not close: measured, every run ends on day 457 — four years
// and ten months, jarldom or no jarldom — while `GENERATION` is sixteen
// years, 1536 days. A child born in the first hour of a saga is four when it
// closes. Growing one up means moving the end of a run, which moves every
// balance curve this project has measured; that is a decision about what the
// game IS, not a feature to slip in behind one. `data/lineage.ts` reached the
// same conclusion years ago and said so, and it was right.
//
// What DID fit was the hole underneath it: `bindKin` runs once, in
// `makeWarband`, and nothing has ever made a tie since.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { LONG_LIFE_WINTERS } from '../src/data/thing';
import { GENERATION } from '../src/data/kin';
import { YEAR_LENGTH } from '../src/sim/calendar';
import { checkRunEnd } from '../src/sim/upkeep';
import {
  PAIR_COOLDOWN,
  PAIR_HEART,
  PAIR_MIN_AGE,
  hallPasses,
  maybePair,
  pairBlocker,
  unattached,
} from '../src/sim/household';
import { isWoman, kinOf } from '../src/sim/kin';
import { leaderOf, living } from '../src/sim/people';
import type { GameState, Person } from '../src/state/types';

/** A settled band at peace, which is the only place a household is made. */
function hall(seed = 'house'): GameState {
  const state = newGame(seed);
  state.settlement = {
    at: state.party.at, name: 'Fisklund', foundedOn: 1,
    plots: [], shelter: 0, watch: 0, built: [], queue: [], works: 0, children: [],
  } as never;
  state.party.food = 300;
  return state;
}

describe('why this is not about generations', () => {
  it('measures the gap between a run and a generation', () => {
    const state = hall('gen-gap');
    let ends = 0;
    for (let d = 1; d < YEAR_LENGTH * 30 && !ends; d++) {
      state.day = d;
      checkRunEnd(state, 1);
      if (state.end) ends = d;
    }
    const grown = GENERATION * YEAR_LENGTH;
    console.log(`a run ends on day ${ends} (${(ends / YEAR_LENGTH).toFixed(1)} years, ${LONG_LIFE_WINTERS} winters)`);
    console.log(`a child is grown at day ${grown} (${GENERATION} years) — ${(grown / ends).toFixed(1)}x a whole saga`);
    // The bar: a child CANNOT come of age inside a run. If this ever fails,
    // somebody has changed the length of a saga, and growing children up
    // becomes a real question again rather than a wish.
    expect(grown).toBeGreaterThan(ends * 2);
  });
});

describe('a hall makes households', () => {
  it('will not make one on the road, in a feud, or with nobody free', () => {
    const camp = newGame('house-road');
    expect(pairBlocker(camp)).toBe('nosteading');

    const state = hall('house-none');
    // Bind everybody: nobody is free, so nobody pairs.
    for (const p of living(state.party.people)) p.kin = { id: 'x', tie: 'cousin' };
    expect(pairBlocker(state)).toBe('nobody');
  });

  it('binds one man to one woman, both free and grown', () => {
    const state = hall('house-bind');
    for (const p of state.party.people) delete p.kin;
    const before = unattached(state).length;
    expect(before).toBeGreaterThan(1);
    const morale = state.party.morale;

    let made = false;
    for (let d = 1; d < 4000 && !made; d++) {
      state.day = d;
      made = maybePair(state);
    }
    expect(made).toBe(true);

    const paired = state.party.people.filter((p) => p.kin && p.alive);
    expect(paired.length).toBeGreaterThanOrEqual(2);
    // A household is a man and a woman — this is the tie a birth reads to
    // name a father, and it must not bind two of the same.
    const [one] = paired;
    const other = kinOf(state.party.people, one!)!;
    expect(isWoman(one!)).not.toBe(isWoman(other));
    expect(one!.kin!.tie === 'husband' || one!.kin!.tie === 'wife').toBe(true);
    expect(state.party.morale).toBe(Math.min(100, morale + PAIR_HEART));
  });

  it('never pairs a child, and never pairs the already-bound', () => {
    const state = hall('house-age');
    for (const p of state.party.people) {
      delete p.kin;
      p.age = PAIR_MIN_AGE - 1;
    }
    expect(unattached(state)).toHaveLength(0);
    expect(pairBlocker(state)).toBe('nobody');
  });

  it('leaves a year between weddings', () => {
    const state = hall('house-cool');
    for (const p of state.party.people) delete p.kin;
    let first = 0;
    for (let d = 1; d < 4000 && !first; d++) {
      state.day = d;
      if (maybePair(state)) first = d;
    }
    state.day = first + PAIR_COOLDOWN - 1;
    expect(pairBlocker(state)).toBe('toosoon');
  });

  it('reopens the door a death shut: a widow can be a household again', () => {
    // The defect in one test. `bindKin` ran once at the start of the world,
    // so a woman widowed on day forty stayed alone for four years and every
    // child she bore was written down with no father.
    const state = hall('house-widow');
    const woman = living(state.party.people).find(isWoman)!;
    const man = living(state.party.people).find((p) => !isWoman(p))!;
    for (const p of state.party.people) delete p.kin;
    woman.kin = { id: 'dead-man', tie: 'wife' };
    // Widowed: the tie points at nobody in the band.
    expect(kinOf(state.party.people, woman)).toBeUndefined();

    delete woman.kin;
    let made = false;
    for (let d = 1; d < 4000 && !made; d++) {
      state.day = d;
      made = maybePair(state);
    }
    expect(made).toBe(true);
    void man;
  });
});

describe('the hall passes', () => {
  it('says who took the high seat, and by what right', () => {
    const state = hall('house-heir');
    const leader = leaderOf(state.party.people)!;
    const before = state.saga.length;
    // Every death site clears `alive` before it mourns, so this is the state
    // `hallPasses` actually meets.
    leader.alive = false;
    hallPasses(state, leader);
    const said = state.saga.slice(before).map((e) => e.text).join(' ');
    expect(said).toContain(leader.name);
    expect(said).toContain('high seat');
  });

  it('says nothing when somebody who never led dies', () => {
    const state = hall('house-hand');
    const notLeader = state.party.people.find(
      (p) => p.id !== leaderOf(state.party.people)!.id,
    )!;
    const before = state.saga.length;
    notLeader.alive = false;
    hallPasses(state, notLeader);
    expect(state.saga.length).toBe(before);
  });

  it('marks the end of the line when there is nobody to hand it to', () => {
    const state = hall('house-last');
    const people: Person[] = state.party.people;
    for (const p of people.slice(1)) p.alive = false;
    const last = people[0]!;
    const before = state.saga.length;
    last.alive = false;
    hallPasses(state, last);
    const said = state.saga.slice(before).map((e) => e.text).join(' ');
    expect(said).toContain('nobody left to hand it to');
  });
});

describe('how often a hall actually makes one', () => {
  it('measures weddings across a saga', () => {
    // The rate matters: too rare and the door this opens is theoretical, too
    // common and a marginal steading reads as a village fete.
    const RUN = 457; // a whole saga, measured above
    let weddings = 0;
    let withOne = 0;
    const runs = 40;

    for (let s = 0; s < runs; s++) {
      const state = hall(`house-rate:${s}`);
      // A band that has buried its partners: the case this was built for.
      for (const p of state.party.people) delete p.kin;
      let made = 0;
      for (let d = 1; d <= RUN; d++) {
        state.day = d;
        if (maybePair(state)) made++;
      }
      weddings += made;
      if (made > 0) withOne++;
    }

    console.log(`households over ${runs} sagas of ${RUN} days, all six unbound:`);
    console.log(`  weddings in all  : ${weddings} (${(weddings / runs).toFixed(2)} a saga)`);
    console.log(`  sagas with any   : ${withOne} of ${runs}`);

    // Most halls should see one; none should see a wedding a season.
    expect(withOne).toBeGreaterThan(runs * 0.5);
    expect(weddings / runs).toBeLessThan(4);
  });
});
