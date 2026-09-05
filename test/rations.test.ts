// Short commons — the winter lever.
//
// THE CALL THIS ANSWERS. Three separate investigations found the first winter
// is not a phase the player plays: stores on its first morning predict spring
// 94–98% of the time, deaths run flat across all four weeks rather than at
// some playable moment, and 27 of 30 are plain starvation. `readiness()`
// named two ways out and measurement said both made it worse — a band taking
// them went from 17 survivors to 13, saving nobody.
//
// So the standard this has to meet is not "it exists". It is "it beats
// nothing", and the paired measurement in `balance.test.ts` is where that is
// settled. These are the mechanics underneath it.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { foodPerDay, passDay } from '../src/sim/upkeep';
import { forecast } from '../src/sim/winter';
import {
  HALF_RATION_HEART,
  HALF_RATION_TOLL,
  RATION_SHARE,
  TIGHTENED_KILLED,
  TIGHTENED_OF,
  TIGHTENED_SAVED,
  tighteningWorth,
} from '../src/data/rations';
import { pushMode } from '../src/modes';
import type { GameState } from '../src/state/types';

describe('short commons stretch the store', () => {
  it('feeds the band on less, and it is less by a real amount', () => {
    const state = settled('rat-eat');
    const full = foodPerDay(state);
    state.party.rations = 'half';
    const half = foodPerDay(state);
    expect(half, 'short commons ate the same as full shares').toBeLessThan(full);
    expect(half).toBeGreaterThanOrEqual(1);
    expect(RATION_SHARE).toBeLessThan(1);
  });

  it('never feeds nobody, however small the band', () => {
    const state = settled('rat-floor');
    state.party.rations = 'half';
    for (const p of state.party.people.slice(1)) p.alive = false;
    expect(foodPerDay(state)).toBeGreaterThanOrEqual(1);
  });
});

describe('the mark moves with the belt', () => {
  /**
   * THE PAYOFF OF THERE BEING ONE COPY OF THE MOUTHS FORMULA.
   *
   * `foodPerDay` is read by the night's eating, by the winter mark and by the
   * verdict. Split across two copies — which it was until the lineage work —
   * a band on short commons would have gone on being told to stock a full
   * winter's food while eating two thirds of it. The mark would have been
   * lying in the one season it exists for.
   */
  it('asks for less food the moment the band eats less', () => {
    const state = settled('rat-mark');
    state.day = 40;
    state.party.food = 20;
    state.party.firewood = 20;
    const asked = forecast(state).food;

    state.party.rations = 'half';
    expect(
      forecast(state).food,
      'the mark went on asking for a full winter while the band ate short',
    ).toBeLessThan(asked);
  });
});

describe('and it is paid for', () => {
  it('takes heart every day it is kept', () => {
    const state = settled('rat-heart');
    state.party.food = 500;
    state.party.firewood = 500;
    state.party.morale = 80;
    const plain = structuredClone(state);

    state.party.rations = 'half';
    passDay(state);
    passDay(plain);

    expect(
      plain.party.morale - state.party.morale,
      'short commons cost the band nothing',
    ).toBe(HALF_RATION_HEART);
  });

  it('wears the weakest down over a long lean stretch', () => {
    const state = settled('rat-toll');
    state.party.food = 500;
    state.party.firewood = 500;
    state.party.rations = 'half';
    const before = state.party.people.map((p) => p.health).reduce((a, b) => a + b, 0);

    for (let d = 0; d < HALF_RATION_TOLL && !state.end; d += 1) passDay(state);

    const after = state.party.people.map((p) => p.health).reduce((a, b) => a + b, 0);
    expect(after, 'a lean fortnight cost nobody anything').toBeLessThan(before);
  });

  it('forgets the lean days once the band eats properly again', () => {
    const state = settled('rat-forget');
    state.party.food = 500;
    state.party.firewood = 500;
    state.party.rations = 'half';
    passDay(state);
    expect(state.flags['leanDays']).toBe(1);
    state.party.rations = 'full';
    passDay(state);
    expect(state.flags['leanDays'], 'the toll kept counting through full shares').toBe(0);
  });
});

describe('the player can actually reach it', () => {
  it('is a steading decision, and refuses a change that changes nothing', () => {
    const state = pushMode(settled('rat-act'), 'COLONY');
    const lean = apply(state, { type: 'SET_RATIONS', rations: 'half' });
    expect(lean.party.rations).toBe('half');
    expect(lean.saga.at(-1)!.text).toContain('short commons');

    // Asking for what is already true is not a move.
    expect(apply(lean, { type: 'SET_RATIONS', rations: 'half' })).toBe(lean);

    const back = apply(lean, { type: 'SET_RATIONS', rations: 'full' });
    expect(back.party.rations).toBe('full');
  });
});

describe('old saves', () => {
  it('come forward on full shares, which is what they were eating', () => {
    const save = structuredClone(newGame('rat-old')) as unknown as Record<string, unknown>;
    save['version'] = 34;
    delete (save['party'] as Record<string, unknown>)['rations'];
    const out = migrate(save).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect((out['party'] as { rations?: string }).rations).toBeUndefined();
    // And ABSENT HAS TO MEAN FULL, or every old save quietly starts eating
    // short. The first cut of this compared `foodPerDay` to itself, which is
    // a tautology dressed as a bar — it would have passed with absent meaning
    // anything at all.
    const carried = out as unknown as GameState;
    const explicit: GameState = { ...carried, party: { ...carried.party, rations: 'full' } };
    const lean: GameState = { ...carried, party: { ...carried.party, rations: 'half' } };
    expect(foodPerDay(carried), 'an absent value stopped meaning full shares')
      .toBe(foodPerDay(explicit));
    expect(foodPerDay(carried)).toBeGreaterThan(foodPerDay(lean));
  });
});

function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  return state;
}

// 9.7: the panel names what tightening is worth, not only what it costs.
describe('the rations control states the record', () => {
  it('names both halves, so it reads as a record and not a nudge', () => {
    const line = tighteningWorth();
    expect(line).toContain(String(TIGHTENED_SAVED));
    expect(line).toContain(String(TIGHTENED_KILLED));
    expect(line).toContain(String(TIGHTENED_OF));
    // It must say what it COST somebody too. A line naming only the bands
    // saved is an advertisement, and this game does not run those.
    expect(line).toMatch(/died of it/);
  });

  it('keeps the numbers the measurement actually found', () => {
    // Pinned to literals rather than to each other: written as
    // `SAVED > KILLED` this passes at any pair, which is the tautology a
    // claim shipped with earlier in this phase. These are the figures from
    // `PROBE 12.3 short commons by audience` — 960 seeds an arm on As It
    // Lies, settler, floor 7, 2026-09-05, counted over the 809 of them where
    // the panel's own condition put this line on screen. The floor-9 reading
    // of the same lever was 22 / 1 / 120 and is not comparable: a different
    // bot, and a denominator that included bands the panel never speaks to.
    expect(TIGHTENED_SAVED).toBe(35);
    expect(TIGHTENED_KILLED).toBe(5);
    expect(TIGHTENED_OF).toBe(809);
  });

  it('will not publish a figure that cannot resolve its own sign', () => {
    // WAS `SAVED > KILLED * 10`, AND TEN WAS THE FLOOR-9 RATIO WRITTEN DOWN
    // AS A LAW. It did not survive the re-take — the honest ratio is nearer
    // seven — and a threshold picked from one reading is exactly what this
    // repo keeps catching itself doing.
    //
    // So the guard is on the thing that actually matters about a number
    // printed to a player: whether the sample it came from can tell the
    // lever's sign from a coin. Saved and killed are the discordant pairs of
    // a paired trial, so the null is a fair coin over their sum, and this is
    // the two-sided exact binomial on it.
    //
    // It is not a tautology and it is not free: it FAILS on the same
    // instrument's 120-seed reading (saved 4, killed 2 — p = 0.69) and on its
    // 240-seed reading (10 and 2 — p = 0.039), and passes here at 35 and 5
    // (p = 5e-7). Softening the line, or restating it from a thin run, breaks
    // this test.
    const n = TIGHTENED_SAVED + TIGHTENED_KILLED;
    let tail = 0;
    let choose = 1;
    for (let k = 0; k <= n; k += 1) {
      if (k > 0) choose = (choose * (n - k + 1)) / k;
      if (k >= TIGHTENED_SAVED || k <= TIGHTENED_KILLED) tail += choose;
    }
    const p = tail / 2 ** n;
    expect(TIGHTENED_SAVED).toBeGreaterThan(TIGHTENED_KILLED);
    expect(p).toBeLessThan(0.01);
  });
});
