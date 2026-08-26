// Walking the coast: what a band can do on the line today.
//
// `route.test.ts` proves what the coast IS. This proves what a band may do on
// it — which needs a band, and so needs a GameState, exactly as `road.ts`
// does against the hex map.
//
// The claim that carries the milestone is in the last group. Depth is only a
// decision if going further costs something that going back does not refund,
// and `pushLimit` is where that arithmetic is answered rather than left to
// the player to do from a strip map.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import {
  SHIP_REACH, canRow, canWalk, daysToWalk, pushLimit, standingAt, walkOptions,
} from '../src/sim/coast';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { ROUTE_STOPS, daysBetween, stopAt } from '../src/sim/route';
import type { GameState } from '../src/state/types';

const SEEDS = ['raven-skerry-317', 'grim-fjord-100', 'curve-7'];

/** A band standing at a stop, with a sound hull unless told otherwise. */
function band(seed: string, stop = 0): GameState {
  const state = cloneState(newGame(seed));
  state.party.stop = stop;
  return state;
}

describe('where the band is standing', () => {
  it('reads a save that has never heard of the coast as the landing', () => {
    const state = cloneState(newGame('s'));
    expect(state.party.stop).toBeUndefined();
    expect(standingAt(state)).toBe(0);
  });

  it('refuses to believe a stop that is not on the coast', () => {
    // Not defensiveness for its own sake: `stop` is a plain number in a save
    // file, and a save edited by hand or written by an older build must not
    // put the band somewhere `stopAt` will happily invent country for.
    for (const bad of [-1, ROUTE_STOPS, ROUTE_STOPS + 40, 2.5]) {
      const state = band('s');
      state.party.stop = bad;
      expect(standingAt(state), `stop ${bad}`).toBe(0);
    }
  });
});

describe('what a step costs', () => {
  it('costs the leg it walks, in either direction', () => {
    for (const seed of SEEDS) {
      const state = band(seed, 5);
      expect(daysToWalk(state, 6)).toBe(stopAt(seed, 6).leg);
      expect(daysToWalk(state, 4)).toBe(stopAt(seed, 5).leg);
    }
  });

  it('costs nothing to stay where you are, and refuses to charge for it', () => {
    expect(daysToWalk(band('s', 4), 4)).toBeNull();
  });

  it('will not walk off either end of the coast', () => {
    expect(daysToWalk(band('s', 0), -1)).toBeNull();
    expect(daysToWalk(band('s', ROUTE_STOPS - 1), ROUTE_STOPS)).toBeNull();
  });

  it('takes a day at the oars however long those legs were on foot', () => {
    // The ship's whole worth, and the heir of the hex map's ROW_REACH.
    for (const seed of SEEDS) {
      const state = band(seed, 8);
      for (let d = 2; d <= SHIP_REACH; d += 1) {
        expect(daysToWalk(state, 8 + d), `${seed} +${d}`).toBe(1);
        expect(daysToWalk(state, 8 - d), `${seed} -${d}`).toBe(1);
      }
      // And the saving is real: those legs are worth far more than a day.
      expect(daysBetween(seed, 8, 8 + SHIP_REACH)).toBeGreaterThan(1);
    }
  });

  it('leaves a wrecked hull on the beach', () => {
    const state = band('s', 8);
    state.ship.strakes = 0;
    expect(canRow(state)).toBe(false);
    expect(daysToWalk(state, 11)).toBeNull();
    // She will not be rowed anywhere; the band's legs still work.
    expect(daysToWalk(state, 9)).not.toBeNull();
  });

  it('rows on a hull that is merely making water', () => {
    const state = band('s', 8);
    state.ship.strakes -= 1;
    expect(canRow(state)).toBe(true);
    expect(daysToWalk(state, 11)).toBe(1);
  });
});

describe('what the coast offers today', () => {
  it('offers forward and back from the middle of it', () => {
    const state = band('s', 10);
    state.ship.strakes = 0;
    expect(walkOptions(state).sort((a, b) => a - b)).toEqual([9, 11]);
  });

  it('offers only forward at the landing, and only back at the headland', () => {
    const ashore = band('s', 0);
    ashore.ship.strakes = 0;
    expect(walkOptions(ashore)).toEqual([1]);
    const far = band('s', ROUTE_STOPS - 1);
    far.ship.strakes = 0;
    expect(walkOptions(far)).toEqual([ROUTE_STOPS - 2]);
  });

  it('offers the ship’s whole reach when there is a hull to row', () => {
    const state = band('s', 10);
    expect(walkOptions(state).sort((a, b) => a - b))
      .toEqual([7, 8, 9, 11, 12, 13]);
  });

  it('offers nearest first, so a strip map draws them in reading order', () => {
    const near = walkOptions(band('s', 10)).map((to) => Math.abs(to - 10));
    expect(near).toEqual([...near].sort((a, b) => a - b));
  });

  it('offers a settled band nothing, and an expedition everything', () => {
    // The hex map's rule, unchanged and for the same reason: a band with a
    // hall does not wander off it, and an expedition is how they leave.
    const settled = band('s', 4);
    settled.settlement = { at: { q: 0, r: 0 } } as GameState['settlement'];
    expect(walkOptions(settled)).toEqual([]);
    expect(canWalk(settled, 5)).toBe(false);
    settled.expedition = { purpose: 'raid' } as GameState['expedition'];
    expect(walkOptions(settled).length).toBeGreaterThan(0);
  });
});

describe('THE DECISION — how far before you turn back', () => {
  it('never names a stop the band could not get home from', () => {
    // Conservative on purpose. A band that takes this at its word is never
    // stranded by it, which is the only way a number like this is worth
    // showing somebody.
    for (const seed of SEEDS) {
      for (const days of [4, 12, 30, 80, 400]) {
        const state = band(seed, 0);
        const far = pushLimit(state, days);
        expect(daysBetween(seed, 0, far) * 2, `${seed}, ${days} days`)
          .toBeLessThanOrEqual(days);
      }
    }
  });

  it('names the furthest one they could', () => {
    for (const seed of SEEDS) {
      for (const days of [4, 12, 30, 80]) {
        const far = pushLimit(band(seed, 0), days);
        if (far >= ROUTE_STOPS - 1) continue;
        expect(daysBetween(seed, 0, far + 1) * 2, `${seed}, ${days} days`)
          .toBeGreaterThan(days);
      }
    }
  });

  it('gets you half as far as a one-way trip would', () => {
    // The whole design in one assertion: the walk home is not free, so the
    // days a band carries buy half the coast they would buy if it were.
    for (const seed of SEEDS) {
      const state = band(seed, 0);
      const there = pushLimit(state, 40);
      // A one-way reckoning of the same 40 days reaches strictly further.
      let oneWay = 0;
      for (let to = 1; to < ROUTE_STOPS; to += 1) {
        if (daysBetween(seed, 0, to) > 40) break;
        oneWay = to;
      }
      expect(oneWay, `${seed}: coming home cost nothing`).toBeGreaterThan(there);
    }
  });

  it('goes nowhere on nothing', () => {
    expect(pushLimit(band('s', 6), 0)).toBe(6);
    expect(pushLimit(band('s', 6), 1)).toBe(6);
  });
});

describe('the flag', () => {
  it('is off, and the game does not offer the coast while it is', () => {
    // Not a claim about the walking — that is proved above. A claim about
    // what the game will DO, because a coast with nothing on it yet would
    // measure as travel getting worse, and would be right.
    expect(COAST_IS_A_LINE).toBe(false);
    const state = band('s', 0);
    const after = apply(state, { type: 'WALK', to: 1 });
    expect(after, 'WALK was accepted with the flag off').toBe(state);
    expect(standingAt(after)).toBe(0);
  });
});

describe('a save from before the coast', () => {
  it('comes forward standing on the landing, with its saga intact', () => {
    const state = cloneState(newGame('grim-fjord-100'));
    state.day = 40;
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    old['version'] = 47;
    delete (old['party'] as Record<string, unknown>)['stop'];

    const { save } = migrate(old);
    expect(save['version']).toBe(SAVE_VERSION);
    expect(save['day']).toBe(40);
    expect(standingAt(save as unknown as GameState)).toBe(0);
  });
});
