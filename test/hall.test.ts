// A hall has to be kept (9.12). The measurement that asked for it is in
// sim/hall.ts; this is the rule it turned into.

import { describe, expect, it } from 'vitest';
import { settled } from './fixtures/settle';
import {
  FEAST_PER_MOUTH,
  HEARTH_FREE,
  KEPT_FOR,
  NEGLECTED_AFTER,
  canKeepHall,
  feastCost,
  heartPaid,
  keepHall,
  keptShare,
  sinceKept,
} from '../src/sim/hall';
import { heartFromBuildings, hearthMark, heartRaised } from '../src/sim/colony';
import { living } from '../src/sim/people';
import type { GameState } from '../src/state/types';

const hall = (seed: string, day = 200): GameState => {
  const state = settled(seed);
  state.day = day;
  state.settlement!.built = ['longhouse', 'meadhall', 'greathall', 'hof'];
  state.settlement!.kept = day;
  state.party.food = 400;
  return state;
};

describe('a hall pays while it is kept', () => {
  it('pays the whole of it on the day of the feast', () => {
    const state = hall('kept');
    expect(keptShare(state)).toBe(1);
    expect(heartPaid(state, 8)).toBe(8);
  });

  it('still pays the whole of it at the end of the season', () => {
    // A hall does not go cold the morning after a season turns, and a player
    // one day late should not lose a jarldom for it.
    const state = hall('edge');
    state.settlement!.kept = state.day - KEPT_FOR;
    expect(keptShare(state)).toBe(1);
  });

  it('fades across the season after that rather than falling off a cliff', () => {
    const state = hall('fading');
    const shares = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      state.settlement!.kept = state.day - (KEPT_FOR + (NEGLECTED_AFTER - KEPT_FOR) * f);
      return keptShare(state);
    });
    expect(shares[0]).toBeCloseTo(1, 6);
    expect(shares[4]).toBeCloseTo(0, 6);
    for (let i = 1; i < shares.length; i += 1) {
      expect(shares[i]!).toBeLessThan(shares[i - 1]!);
    }
  });

  it('pays nothing above the free point once it is properly neglected', () => {
    const state = hall('cold');
    state.settlement!.kept = state.day - NEGLECTED_AFTER * 2;
    expect(keptShare(state)).toBe(0);
    expect(heartPaid(state, 8)).toBe(HEARTH_FREE);
  });
});

describe('the first year is protected by construction', () => {
  // 53% of runs end before their second winter. This must not touch them,
  // and it must not touch them because of the SHAPE of the rule rather than
  // a special case that reads the calendar.
  it('leaves a band with nothing but a roof exactly where it was, ever', () => {
    // Stated over the WHOLE range of neglect rather than at one convenient
    // day. The first cut of this asserted a fully-cold hall at day 30 and
    // failed, because a band 29 days past its last feast is only part of the
    // way through the fade — which was the test being wrong and not the
    // rule. The claim worth making is that no amount of neglect can cost a
    // one-roof band anything at all.
    const state = settled('young');
    state.day = 400;
    state.settlement!.built = ['longhouse'];
    for (let since = 0; since <= NEGLECTED_AFTER * 2; since += 4) {
      state.settlement!.kept = state.day - since;
      expect(heartPaid(state, HEARTH_FREE)).toBe(HEARTH_FREE);
      expect(heartFromBuildings(state)).toBe(HEARTH_FREE);
    }
  });

  it('puts more at risk the more there is standing', () => {
    const state = hall('risk');
    state.settlement!.kept = state.day - NEGLECTED_AFTER * 2;
    const atRisk = (raised: number) => raised - heartPaid(state, raised);
    expect(atRisk(1)).toBe(0);
    expect(atRisk(4)).toBe(3);
    expect(atRisk(8)).toBe(7);
    // Monotonic: a bigger hall always has more riding on the feast.
    for (let r = 1; r < 12; r += 1) expect(atRisk(r + 1)).toBeGreaterThanOrEqual(atRisk(r));
  });
});

describe('holding the feast', () => {
  it('costs the mouths at the table, not a flat price', () => {
    const state = hall('cost');
    const mouths = living(state.party.people).length;
    expect(feastCost(state)).toBe(mouths * FEAST_PER_MOUTH);
    state.party.people.push({ ...state.party.people[0]!, id: 'extra', name: 'Extra' });
    expect(feastCost(state)).toBeGreaterThan(mouths * FEAST_PER_MOUTH);
  });

  it('spends the food and starts the season again', () => {
    const state = hall('spend');
    state.settlement!.kept = state.day - NEGLECTED_AFTER;
    const before = state.party.food;
    const cost = feastCost(state);
    expect(keepHall(state)).toBe(true);
    expect(state.party.food).toBe(before - cost);
    expect(sinceKept(state)).toBe(0);
    expect(keptShare(state)).toBe(1);
  });

  it('cannot be held without the food for it', () => {
    const state = hall('poor');
    state.party.food = feastCost(state) - 1;
    expect(canKeepHall(state)).toBe(false);
    expect(keepHall(state)).toBe(false);
  });

  it('cannot be held with nothing standing to hold it in', () => {
    const state = hall('roofless');
    state.settlement!.built = [];
    expect(canKeepHall(state)).toBe(false);
  });

  it('hands out no morale of its own', () => {
    // The feast's whole worth is that the hall goes on paying. A rite that
    // fed the hall AND handed out a bonus would be the annuity in a hat.
    const state = hall('nobonus');
    const before = state.party.morale;
    keepHall(state);
    expect(state.party.morale).toBe(before);
  });
});

describe('an old save is not punished for being old', () => {
  it('reads a settlement that has never feasted as kept on its founding', () => {
    const state = settled('legacy');
    state.day = 300;
    delete state.settlement!.kept;
    state.settlement!.foundedOn = 290;
    expect(sinceKept(state)).toBe(10);
  });
});

// The mark on the colony panel. The crowding mark was written because a
// penalty the player cannot see is not difficulty, and this rule takes seven
// heart a day off a jarl — so it says so, in the same shape, in the sim,
// where the wording can be held to account.
describe('the panel says what the hall is costing', () => {
  it('says nothing at all to a band whose whole steading is one longhouse', () => {
    // Nothing above the free point can be lost, so a line about it would be
    // noise on exactly the screen that can least afford noise.
    const state = hall('young');
    state.settlement!.built = ['longhouse'];
    expect(heartRaised(state)).toBe(HEARTH_FREE);
    expect(hearthMark(state)).toBeNull();
  });

  it('says nothing to a band with no steading at all', () => {
    const state = hall('landless');
    state.settlement = undefined;
    expect(hearthMark(state)).toBeNull();
  });

  it('calls a kept hall glad, and claims no shortfall', () => {
    const state = hall('glad');
    const mark = hearthMark(state)!;
    expect(mark).not.toBeNull();
    expect(mark.head).toBe('The hall is glad');
    expect(mark.due).toBe(false);
    expect(mark.short).toBe(0);
    expect(mark.since).toBe(0);
    expect(mark.gap).toBe(`${heartRaised(state)} to every heart`);
  });

  it('calls it quiet once the feast is overdue, and cold once it is neglected', () => {
    const state = hall('quiet');
    state.settlement!.kept = state.day - (KEPT_FOR + 1);
    expect(hearthMark(state)!.head).toBe('The hall has gone quiet');
    expect(hearthMark(state)!.due).toBe(true);

    state.settlement!.kept = state.day - NEGLECTED_AFTER;
    expect(hearthMark(state)!.head).toBe('The hall is cold');
    expect(hearthMark(state)!.due).toBe(true);
  });

  it('names the shortfall the sim is actually charging, never a second opinion', () => {
    // The bug this exists to catch is a panel that computes the penalty its
    // own way and drifts from the rule. Checked across the whole fade, not at
    // one convenient day.
    const state = hall('agree');
    for (let since = 0; since <= NEGLECTED_AFTER + 10; since += 1) {
      state.settlement!.kept = state.day - since;
      const mark = hearthMark(state)!;
      const lost = heartRaised(state) - heartFromBuildings(state);
      expect(mark.since).toBe(since);
      // The mark is the sim's own number rounded to a tenth for the panel,
      // and nothing else — so this is an equality, not a tolerance. A
      // tolerance here would let a second opinion drift inside it.
      expect(mark.short).toBe(Math.round(lost * 10) / 10);
    }
  });

  it('reaches its worst at the free point and never past it', () => {
    const state = hall('worst');
    state.settlement!.kept = state.day - NEGLECTED_AFTER * 2;
    const mark = hearthMark(state)!;
    expect(mark.short).toBeCloseTo(heartRaised(state) - HEARTH_FREE, 6);
    expect(mark.gap).toBe(`${mark.short} off every heart`);
  });
});
