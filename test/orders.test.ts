// 12.2: the household's standing order, and the rule it makes the band follow.
//
// The rule itself was not written here — it was lifted whole out of
// test/fixtures/harness.ts, where every figure this project quotes about
// crewing was measured. That is the point of the item: a rule only the bot
// can follow is a rule the game does not have. So these tests are about the
// two things the move has to get right — that the order is INTENT and does
// nothing until a day turns, and that the day it turns is worked to the same
// rule the harness was working to.

import { describe, it, expect } from 'vitest';
import { settled as settleSomewhere } from './fixtures/settle';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { followOrders } from '../src/sim/orders';
import { availableJobs, output } from '../src/sim/colony';
import { forecast, markVisible, MARK_WINDOW } from '../src/sim/winter';
import { nextThaw } from '../src/sim/calendar';
import { jobById, type JobId } from '../src/data/jobs';
import { living } from '../src/sim/people';
import { currentMode } from '../src/modes';
import { encode, decode } from '../src/state/save';
import { run, setPolicy, SETTLER, ordersGiven } from './fixtures/harness';
import type { GameState } from '../src/state/types';

/**
 * A settled band standing inside the winter mark's window with an empty
 * larder and an empty woodpile — which is the only state the order acts in,
 * and the state a test that wanted to watch it act would otherwise reach by
 * playing a hundred days and hoping.
 */
function pressed(seed = 'orders'): GameState {
  const state = settleSomewhere(seed);
  // Walk the clock to inside the mark's window rather than setting a flag:
  // `markVisible` is the gate the rule reads, and a test that stubbed it
  // would be testing its own stub.
  state.day = Math.max(1, nextThaw(state.day) - Math.floor(MARK_WINDOW / 2));
  state.party.food = 0;
  state.party.firewood = 0;
  for (const p of living(state.party.people)) delete p.job;
  return state;
}

const jobs = (state: GameState) => living(state.party.people).map((p) => p.job ?? null);

describe('a standing order is intent, and nothing until a day turns', () => {
  it('does nothing at all to a band nobody has given one', () => {
    const state = pressed();
    expect(markVisible(state), 'the fixture is not inside the mark window').toBe(true);
    expect(forecast(state).foodGap, 'the fixture is not short').toBeLessThan(0);
    const before = jobs(state);
    expect(followOrders(state)).toBe(0);
    expect(jobs(state)).toEqual(before);
  });

  it('crews the band to whatever the mark says is short, once it has one', () => {
    const state = pressed();
    state.settlement!.orders = 'mark';
    const moved = followOrders(state);
    expect(moved, 'the order changed nobody').toBeGreaterThan(0);
    // Both stores are empty, so both wants are live and the band is split.
    const set = new Set(jobs(state));
    expect(set.has('woodcutter'), 'nobody was put on wood').toBe(true);
    expect(
      [...set].some((j) => j === 'farmer' || j === 'hunter' || j === 'fisher'),
      'nobody was put on food',
    ).toBe(true);
    expect(jobs(state).includes(null), 'somebody was left idle under orders').toBe(false);
  });

  it('says nothing outside the mark\'s own window', () => {
    const state = pressed();
    state.settlement!.orders = 'mark';
    // High summer, the far side of the window from the thaw.
    state.day = Math.max(1, nextThaw(state.day) - MARK_WINDOW - 20);
    expect(markVisible(state)).toBe(false);
    const before = jobs(state);
    expect(followOrders(state)).toBe(0);
    expect(jobs(state)).toEqual(before);
  });

  it('leaves a band whose stores already reach spring alone', () => {
    const state = pressed();
    state.settlement!.orders = 'mark';
    const need = forecast(state);
    state.party.food = need.food + 50;
    state.party.firewood = need.firewood + 50;
    const before = jobs(state);
    expect(followOrders(state)).toBe(0);
    expect(jobs(state)).toEqual(before);
  });

  it('keeps one pair of hands on the stocks while something is queued', () => {
    const state = pressed();
    state.settlement!.orders = 'mark';
    state.settlement!.queue = ['longhouse'];
    followOrders(state);
    expect(jobs(state)[0], 'the queue was stripped for the mark').toBe('builder');
  });

  it('does not crew on the turn the order is given — it is intent, not a tap', () => {
    const state = pressed();
    const before = jobs(state);
    const next = apply({ ...state, modes: ['TRAVEL', 'COLONY'] }, { type: 'SET_ORDERS', orders: 'mark' });
    expect(next.settlement!.orders).toBe('mark');
    expect(jobs(next), 'giving the order moved hands the same turn').toEqual(before);
  });

  it('and the band works to it the next day the clock turns', () => {
    const state = pressed();
    state.settlement!.orders = 'mark';
    const before = jobs(state);
    passDay(state);
    expect(jobs(state), 'a day passed under orders and nobody moved').not.toEqual(before);
  });
});

describe('the order asks the ground rather than naming a food job', () => {
  /**
   * THE ONE MEASURED DECISION INSIDE THE RULE, and the reason there is only
   * one order on the panel. `PROBE 12.2` ran the two candidate rules over the
   * same 300 landings on As It Lies: keeping the mark met with a NAMED food
   * job saw spring 202 times, asking the ground 230 — paired, asking the
   * ground saved 29 and killed 1 over 30 discordant pairs, exact p < 0.0001
   * (settler, floor 7, 2026-09-05). The floor-9 reading of the same pair was
   * saved 11 / killed 1, so the effect grew rather than shrank.
   *
   * An option measured to be worse than the one beside it is not a decision,
   * so "by name" is not offered. This is the bar that keeps it that way.
   */
  it('puts a hand on whichever food job that person and that ground pay best at', () => {
    const state = pressed('ground');
    state.settlement!.orders = 'mark';
    // Food short, wood full: the rule's food-only branch, so every hand it
    // touches is being handed a food job and nothing else.
    const need = forecast(state);
    state.party.firewood = need.firewood + 50;
    state.party.food = 0;
    followOrders(state);

    const open = availableJobs(state).map((j) => j.id);
    const feeds = (['farmer', 'hunter', 'fisher'] as JobId[]).filter((id) => open.includes(id));
    expect(feeds.length, 'this ground offers no food job at all').toBeGreaterThan(0);

    for (const person of living(state.party.people)) {
      const job = person.job as JobId | undefined;
      if (!job || !feeds.includes(job)) continue;
      const best = feeds.reduce(
        (a, b) => (output(state, person, jobById(b)!) > output(state, person, jobById(a)!) ? b : a),
      );
      expect(
        output(state, person, jobById(job)!),
        `${person.name} was put on ${job} where ${best} pays better on this ground`,
      ).toBeCloseTo(output(state, person, jobById(best)!), 6);
    }
  });
});

describe('the verb', () => {
  const inYard = (state: GameState): GameState => ({ ...state, modes: ['TRAVEL', 'COLONY'] });

  it('is refused from the road, like every other steading decision', () => {
    const state = pressed();
    expect(currentMode(state)).toBe('TRAVEL');
    expect(apply(state, { type: 'SET_ORDERS', orders: 'mark' })).toBe(state);
  });

  it('is refused when it would change nothing', () => {
    const state = inYard(pressed());
    state.settlement!.orders = 'mark';
    expect(apply(state, { type: 'SET_ORDERS', orders: 'mark' })).toBe(state);
    const bare = inYard(pressed());
    expect(apply(bare, { type: 'SET_ORDERS', orders: null })).toBe(bare);
  });

  it('can be taken back, and the crew stays where it was left', () => {
    const state = inYard(pressed());
    state.settlement!.orders = 'mark';
    followOrders(state);
    const under = jobs(state);
    const next = apply(state, { type: 'SET_ORDERS', orders: null });
    expect(next.settlement!.orders).toBeUndefined();
    expect(jobs(next), 'taking the order back scattered the crew').toEqual(under);
    // And the day that follows leaves them alone.
    passDay(next);
    expect(jobs(next)).toEqual(under);
  });

  it('writes the decision into the saga, both ways', () => {
    const state = inYard(pressed());
    const on = apply(state, { type: 'SET_ORDERS', orders: 'mark' });
    expect(on.saga.length).toBeGreaterThan(state.saga.length);
    const off = apply(on, { type: 'SET_ORDERS', orders: null });
    expect(off.saga.length).toBeGreaterThan(on.saga.length);
  });

  it('survives a save and comes back as the same order', () => {
    const state = inYard(pressed());
    const on = apply(state, { type: 'SET_ORDERS', orders: 'mark' });
    const back = decode(encode(on));
    expect(back?.settlement?.orders).toBe('mark');
  });
});

/**
 * A band nobody has given an order to must play EXACTLY the game it played
 * before 12.2 existed.
 *
 * This is the bar the item asked for, and it is here rather than in
 * balance.test.ts because it is a claim about a code change and not about
 * balance. `followOrders` returns 0 the moment it sees no order, so the
 * as-is path is untouched by construction — but "by construction" is the
 * phrase this repo keeps catching itself using in place of a measurement.
 *
 * VERIFIED BY STASHING THE CHANGE, 2026-09-05: these eight hashes were taken
 * on the built tree and again with `src/` and the harness reverted to
 * 344b6cc, and all eight matched. `version` is excluded from the hash and
 * that exclusion is the whole reason the check is trustworthy — the first
 * cut included it, every hash differed, and the difference was entirely the
 * SAVE_VERSION bump this item ships. A hash that moves for a reason that is
 * not the game moving is a check that cannot pass.
 */
describe('the game a band without orders plays', () => {
  const PINNED: Record<number, string> = {
    0: 'a2d4430e',
    1: '85ee2878',
    2: 'dca4b610',
    3: '2021a352',
    4: 'd306f466',
    5: '2a8df8ce',
    6: '4103b5b8',
    7: '9906c483',
  };

  const fnv = (text: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };

  it('is the same game, saga for saga, to the last field', { timeout: 900_000 }, () => {
    setPolicy(SETTLER);
    for (let s = 0; s < 8; s += 1) {
      const final = run(`curve-${s}`, 400, undefined, 'even');
      expect(final.settlement?.orders, `curve-${s} gave itself an order`).toBeUndefined();
      const { version: _stamp, ...rest } = final as unknown as Record<string, unknown>;
      expect(fnv(JSON.stringify(rest)), `curve-${s} is not the saga it used to be`)
        .toBe(PINNED[s]);
    }
  });

  it('and the orders arm is a different game, or nothing was measured', { timeout: 900_000 }, () => {
    // The instrument check that goes with the bar above. Two arms that agree
    // to the byte would mean the order never fired, which is trap 3 and has
    // been the answer three times in this repo's history.
    setPolicy({ ...SETTLER, id: 'orders', followsOrders: true });
    let gave = 0;
    let differed = 0;
    for (let s = 0; s < 8; s += 1) {
      const final = run(`curve-${s}`, 400, undefined, 'even');
      if (ordersGiven > 0) gave += 1;
      const { version: _stamp, ...rest } = final as unknown as Record<string, unknown>;
      if (fnv(JSON.stringify(rest)) !== PINNED[s]) differed += 1;
    }
    setPolicy(SETTLER);
    expect(gave, 'the orders arm never reached the yard to give the order').toBeGreaterThan(0);
    expect(differed, 'the orders arm played the identical saga — the order did nothing')
      .toBeGreaterThan(0);
  });
});
