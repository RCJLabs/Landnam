// What goes round a hall, and who stops it.
//
// Illness existed and only winter could give it: `coldNight` rolls when the
// fire goes out and hands out an `ill_` injury that will not mend till the
// thaw. What it could not do was SPREAD — so a cough in a longhouse with
// eleven people in it and room for six behaved exactly like a cough in a hall
// with room to spare, and crowding, which the game already counts and already
// docks morale for, cost the band nothing it could feel in the body.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { JOBS } from '../src/data/jobs';
import { ILLNESSES } from '../src/sim/cold';
import { crowding } from '../src/sim/colony';
import {
  CARE_GUARD,
  CATCHING_CAP,
  ailing,
  ailingCount,
  careToday,
  catchingOdds,
  maybeSpread,
} from '../src/sim/sickness';
import { living } from '../src/sim/people';
import type { GameState, Person } from '../src/state/types';
import { canFound, foundSettlement } from '../src/sim/site';
import { fromKey } from '../src/hex';
import { passDay } from '../src/sim/upkeep';
import { SEASON_LENGTH } from '../src/sim/calendar';

/**
 * A settled hall, founded the way the game founds one.
 *
 * NOT a hand-made object. An earlier cut of this fixture fabricated the
 * settlement with `as never` and left out `report` — so `effectiveReport`
 * spread `undefined`, the healer's output came out NaN, `chance(NaN)` is
 * always false, and the measurement read "a healer stops it completely".
 * The instrument was lying, not the feature working.
 */
function hall(seed = 'sick', extra = 0): GameState {
  const state = newGame(seed);
  // Find ground the game itself would accept, stand on it, and found.
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    state.world.seen[k] = 'visible';
    if (!canFound(state, at)) continue;
    foundSettlement(state);
    break;
  }
  if (!state.settlement) throw new Error(`no site in ${seed} — the fixture never ran`);
  state.party.food = 400;
  state.party.firewood = 400;
  // Extra bodies past what the roof holds, which is the whole subject.
  const seed0 = state.party.people[0]!;
  for (let i = 0; i < extra; i++) {
    state.party.people.push({
      ...structuredClone(seed0), id: `x${i}`, name: `Guest${i}`, bond: 'hand',
      injuries: [], kin: undefined,
    } as Person);
  }
  return state;
}

/** The `ill_` mark is what makes it catching rather than a wound. */
function makeSick(who: Person): void {
  who.injuries.push({ ...ILLNESSES[0]!, id: `ill_1_${who.id}` });
}

describe('nothing goes round an empty hall', () => {
  it('is silent with nobody down', () => {
    const state = hall('sick-none');
    expect(ailingCount(state)).toBe(0);
    expect(catchingOdds(state)).toBe(0);
    expect(maybeSpread(state)).toBe(false);
  });

  it('is silent on the road, however many are down', () => {
    // Six people walking in the open air is not a crowded longhouse.
    const state = hall('sick-road');
    makeSick(state.party.people[0]!);
    state.settlement = undefined;
    expect(catchingOdds(state)).toBe(0);
    expect(maybeSpread(state)).toBe(false);
  });
});

describe('a crowded roof is the whole tradeoff', () => {
  it('is worse the more bodies are past what the hall holds', () => {
    const roomy = hall('sick-roomy', 0);
    const packed = hall('sick-packed', 6);
    makeSick(roomy.party.people[0]!);
    makeSick(packed.party.people[0]!);

    expect(crowding(roomy)).toBe(0);
    expect(crowding(packed)).toBeGreaterThan(0);
    // The claim the feature rests on: the same cough is more dangerous in a
    // fuller hall. Before this, these two numbers were identical — zero.
    expect(catchingOdds(packed)).toBeGreaterThan(catchingOdds(roomy));
    expect(catchingOdds(roomy)).toBeGreaterThan(0);
  });

  it('is worse the more are already down, and is capped', () => {
    const one = hall('sick-one', 4);
    const many = hall('sick-many', 4);
    makeSick(one.party.people[0]!);
    for (const p of living(many.party.people).slice(0, 4)) makeSick(p);
    expect(catchingOdds(many)).toBeGreaterThan(catchingOdds(one));
    // A hall is not a plague pit: there is a worst it can be in a day.
    expect(catchingOdds(many)).toBeLessThanOrEqual(CATCHING_CAP);
  });
});

describe('a healer is a hand that grows no food', () => {
  it('exists as a job and produces care rather than a stockpile', () => {
    const healer = JOBS.find((j) => j.id === 'healer')!;
    expect(healer.produces).toBe('care');
    // Illness does not take the winter off, so neither does tending it.
    expect(healer.seasonal).toBe(0);
  });

  it('cuts the odds of it going round', () => {
    const state = hall('sick-healer', 5);
    makeSick(state.party.people[0]!);
    const bare = catchingOdds(state);
    expect(bare).toBeGreaterThan(0);

    // Set somebody to tending.
    const well = living(state.party.people).find((p) => !ailing(p))!;
    well.job = 'healer';
    const tended = careToday(state);
    expect(tended).toBeGreaterThan(0);
    expect(catchingOdds(state)).toBeLessThan(bare);
    expect(CARE_GUARD).toBeGreaterThan(0);
  });
});

describe('what it costs a hall over a winter', () => {
  it('measures how many go down, packed against roomy against tended', () => {
    let tendWorth = 0;
    const run = (extra: number, tend: boolean): number => {
      let caught = 0;
      const seasons = 60;
      for (let s = 0; s < seasons; s++) {
        const state = hall(`sick-run:${s}:${extra}:${tend}`, extra);
        makeSick(state.party.people[0]!);
        if (tend) {
          const well = living(state.party.people).find((p) => !ailing(p));
          if (well) well.job = 'healer';
          tendWorth = careToday(state);
        }
        for (let d = 1; d <= 24; d++) { // one season
          state.day = d;
          if (maybeSpread(state)) caught++;
        }
      }
      return caught / seasons;
    };

    const roomy = run(0, false);
    const packed = run(6, false);
    const tended = run(6, true);
    console.log('one cough, one season (24 days), 30 halls each:');
    console.log(`  room to spare      : ${roomy.toFixed(2)} more went down`);
    console.log(`  six past the roof  : ${packed.toFixed(2)}`);
    console.log(`  ...with a healer   : ${tended.toFixed(2)} (care ${tendWorth.toFixed(2)} a day)`);

    // Density has to bite, and tending has to answer it — otherwise one is
    // decoration and the other is a wasted hand.
    expect(packed).toBeGreaterThan(roomy);
    expect(tended).toBeLessThan(packed);
  });

  it('measures the OTHER half of what a healer buys: getting up sooner', () => {
    // Contagion is only one side. A day of tending also goes into `mendInjuries`
    // — so pricing the job on catches alone would undersell it, and tuning it
    // on catches alone would overshoot.
    const daysToMend = (tend: boolean): number => {
      let total = 0;
      const halls = 20;
      for (let s = 0; s < halls; s++) {
        const state = hall(`sick-mend:${s}:${tend}`, 0);
        const patient = living(state.party.people)[0]!;
        makeSick(patient);
        if (tend) {
          const well = living(state.party.people).find((p) => !ailing(p));
          if (well) well.job = 'healer';
        }
        // Out of winter, where nothing mends at all by design.
        let d = SEASON_LENGTH * 4 + 1;
        let took = 0;
        while (ailing(patient) && took < 200) {
          state.day = d + took;
          passDay(state);
          took++;
        }
        total += took;
      }
      return total / halls;
    };

    const alone = daysToMend(false);
    const tended = daysToMend(true);
    console.log(`one illness, 20 halls, days until it mends:`);
    console.log(`  left to itself : ${alone.toFixed(1)} days`);
    console.log(`  with a healer  : ${tended.toFixed(1)} days`);
    expect(tended).toBeLessThan(alone);
  });
});
