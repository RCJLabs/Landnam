// What goes round a hall, and who stops it.
//
// Illness existed and only winter could give it: `coldNight` rolls when the
// fire goes out and hands out an `ill_` injury that will not mend till the
// thaw. What it could not do was SPREAD — so a cough in a longhouse with
// eleven people in it and room for six behaved exactly like a cough in a hall
// with room to spare, and crowding, which the game already counts and already
// docks morale for, cost the band nothing it could feel in the body.

import { describe, expect, it } from 'vitest';
import { settled as settleSomewhere } from './fixtures/settle';
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
import { OVER_ROOF, drawOdds, roomLeft, takeIn, willAdmit } from '../src/sim/joining';
import { capacity } from '../src/sim/colony';
import type { GameState, Person } from '../src/state/types';
import { passDay } from '../src/sim/upkeep';
import { SEASON_LENGTH, SEASON_ORDER, seasonOf } from '../src/sim/calendar';

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
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
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

describe('a hall that is full will still take one more', () => {
  // Item 30. `crowding` was unreachable — zero on EVERY settled day of sixty
  // sagas — and the reason was not that roofs are generous. It was that two
  // files disagreed about what capacity is FOR and neither knew it.
  // sim/joining.ts said a hall with no spare bed turns people away and made
  // that the whole point of capacity; sim/sickness.ts built its tradeoff on
  // going PAST the roof. The band pressed up against the roof and stopped, so
  // CROWD_BITE multiplied nothing and CARE_GUARD guarded a floor.

  /** Fill a hall to exactly its capacity. */
  function packed(seed: string): GameState {
    const state = hall(seed);
    const room = capacity(state);
    const seed0 = state.party.people[0]!;
    while (living(state.party.people).length < room) {
      state.party.people.push({
        ...structuredClone(seed0), id: `f${state.party.people.length}`,
        name: `Full${state.party.people.length}`, bond: 'hand', injuries: [], kin: undefined,
      } as Person);
    }
    return state;
  }

  it('admits the floor between the benches, and then refuses', () => {
    const state = packed('packed');
    expect(roomLeft(state)).toBe(0);
    expect(willAdmit(state)).toBe(OVER_ROOF);

    const came = takeIn(state, OVER_ROOF + 2, 'a probe knocked');
    expect(came).toHaveLength(OVER_ROOF);
    // And now it really is full: a hall is a building, not a tent.
    expect(willAdmit(state)).toBe(0);
    expect(takeIn(state, 1, 'one more')).toHaveLength(0);
  });

  it('is crowded once they are in, which is the whole point', () => {
    const state = packed('packed-bite');
    expect(crowding(state)).toBe(0);
    takeIn(state, OVER_ROOF, 'a probe knocked');
    expect(crowding(state)).toBe(OVER_ROOF);
    // And the thing built on it finally moves.
    makeSick(state.party.people[0]!);
    const packedOdds = catchingOdds(state);
    const roomy = hall('roomy-bite');
    makeSick(roomy.party.people[0]!);
    expect(packedOdds).toBeGreaterThan(catchingOdds(roomy));
  });

  it('does not shut the door the moment the last bed goes', () => {
    // THE GATE BEHIND THE GATE. Lifting the cap inside `takeIn` changed
    // nothing on its own, because `drawOdds` returns zero at `roomLeft <= 0`
    // — at a hall exactly full nobody ever arrives to be crowded in. Both
    // gates have to read the same number or the fix is invisible.
    const state = packed('door');
    state.party.food = 4000;
    expect(roomLeft(state)).toBe(0);
    expect(drawOdds(state)).toBeGreaterThan(0);
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

describe('a winter illness mends for a healer and for nobody else', () => {
  // The healer's identity, and it was switched off until 2026-08-24.
  //
  // `mendInjuries` refuses to tick any `ill_` between the frost and the thaw,
  // for a good reason it stated: winter illness that mended like a summer
  // scratch would take the teeth out of the season. But the rule was TOTAL,
  // and `coldNight` is where illness comes from — so the healer's mending
  // lever was dead in the only season that uses it, while its other lever,
  // the guard on `catchingOdds`, was already guarding a floor because
  // `crowding` returns zero on every settled day the harness has measured.
  //
  // So the season keeps its teeth against a hall with nobody set to tending,
  // and a hall that spends a hand can nurse somebody through.

  function winterHall(seed: string, tended: boolean): GameState {
    const state = hall(seed);
    const crew = living(state.party.people);
    crew.forEach((p, i) => { p.job = tended && i === 0 ? 'healer' : 'farmer'; });
    state.day = SEASON_ORDER.indexOf('winter') * SEASON_LENGTH + 3;
    state.party.food = 4000;
    state.party.firewood = 4000;
    for (const p of crew) makeSick(p);
    return state;
  }

  const twelveDays = (state: GameState): void => {
    for (let d = 0; d < 12; d += 1) {
      state.event = undefined;
      if (!passDay(state)) break;
    }
  };

  it('does not mend at all in a hall with nobody tending', () => {
    const state = winterHall('frost-alone', false);
    const man = living(state.party.people)[1]!;
    const before = man.injuries[0]!.heals;
    twelveDays(state);
    expect(seasonOf(state.day)).toBe('winter');
    // Not one day of it, which is the rule the season rests on.
    expect(man.injuries[0]?.heals).toBe(before);
  });

  it('mends under tending, and says so in the saga', () => {
    const state = winterHall('frost-tended', true);
    const man = living(state.party.people)[1]!;
    const before = man.injuries[0]!.heals;
    expect(careToday(state)).toBeGreaterThan(0);
    twelveDays(state);
    const after = man.injuries[0]?.heals ?? 0;
    // eslint-disable-next-line no-console
    console.log(`twelve winter days: ${before} to heal became ${after} under tending`);
    expect(after).toBeLessThan(before);
  });

  it('mends slower than the same illness would out of the frost', () => {
    // The season has to keep its teeth: tending is the ONLY thing ticking in
    // winter, where out of it there is a free day-a-day on top. Measured as
    // days actually taken off, not asserted from the constants — the first
    // cut of this compared `care` with `1 + care` and was true whatever the
    // code did.
    const winter = winterHall('frost-rate', true);
    const summer = winterHall('thaw-rate', true);
    summer.day = SEASON_ORDER.indexOf('summer') * SEASON_LENGTH + 3;
    const took = (state: GameState): number => {
      const man = living(state.party.people)[1]!;
      const before = man.injuries[0]!.heals;
      twelveDays(state);
      return before - (man.injuries[0]?.heals ?? 0);
    };
    const inFrost = took(winter);
    const inThaw = took(summer);
    // eslint-disable-next-line no-console
    console.log(`twelve tended days took ${inFrost.toFixed(1)} off it in winter, `
      + `${inThaw.toFixed(1)} in summer`);
    expect(inFrost).toBeGreaterThan(0);
    expect(inFrost).toBeLessThan(inThaw);
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
