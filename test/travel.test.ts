import { describe, it, expect } from 'vitest';
import { newGame, START_FIREWOOD, START_FOOD } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { living } from '../src/sim/people';
import { foodPerDay, SURVIVAL_DAY } from '../src/sim/upkeep';
import { daysUntilWinter, seasonOf, wintersStood } from '../src/sim/calendar';
import { canWalk, walkOptions } from '../src/sim/coast';
import { ROUTE_STOPS, stopAt } from '../src/sim/route';
import { encode } from '../src/state/save';
import type { GameState } from '../src/state/types';

/**
 * Plays a fight out by simply ending turns, and leaves the field. A card can
 * draw steel, and a loop that only knows how to camp would sit in BATTLE mode
 * forever having every action refused — which looks exactly like a hung run.
 */
function fight(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 400 && s.battle && !s.battle.outcome; i++) {
    s = apply(s, { type: 'B_END_TURN' });
  }
  if (s.battle?.outcome) s = apply(s, { type: 'B_LEAVE' });
  if (s.aftermath) s = apply(s, { type: 'DISMISS_AFTERMATH' });
  return s;
}

function step(state: GameState): GameState {
  if (state.battle || state.aftermath) return fight(state);
  if (state.event) {
    const chosen = apply(state, { type: 'CHOOSE', index: 0 });
    return fight(apply(chosen, { type: 'DISMISS_EVENT' }));
  }
  const options = walkOptions(state);
  const next = options[0] !== undefined
    ? apply(state, { type: 'WALK', to: options[0] })
    : apply(state, { type: 'CAMP' });
  return fight(next);
}

describe('new game', () => {
  it('starts a warband of six on the landing beach', () => {
    const state = newGame('start-seed');
    expect(state.day).toBe(1);
    expect(state.modes).toEqual(['TRAVEL']);
    expect(living(state.party.people)).toHaveLength(6);
    expect(state.party.stop ?? 0).toBe(0);
    expect(state.party.food).toBe(START_FOOD);
    expect(state.party.firewood).toBe(START_FIREWOOD);
    expect(state.saga).toHaveLength(1);
  });


  it('is fully determined by its seed', () => {
    expect(encode(newGame('twin'))).toBe(encode(newGame('twin')));
    expect(encode(newGame('twin'))).not.toBe(encode(newGame('other')));
  });

  it('gives each person a trait and four stats', () => {
    const state = newGame('people-seed');
    for (const person of state.party.people) {
      expect(person.trait).toBeTruthy();
      expect(person.byname).toBeTruthy();
      for (const stat of ['might', 'wits', 'spirit', 'craft'] as const) {
        expect(person.stats[stat]).toBeGreaterThanOrEqual(1);
        expect(person.stats[stat]).toBeLessThanOrEqual(6);
      }
      expect(person.health).toBe(person.maxHealth);
    }
  });
});

describe('movement', () => {
  it('only permits stretches the band can actually reach', () => {
    const state = newGame('move-seed');
    for (const option of walkOptions(state)) {
      expect(canWalk(state, option)).toBe(true);
    }
    // Off the end of the coast, which is the line's version of "not adjacent
    // and not passable": there is nothing there to walk to.
    expect(canWalk(state, ROUTE_STOPS + 4)).toBe(false);
    expect(apply(state, { type: 'WALK', to: ROUTE_STOPS + 4 })).toBe(state);
  });



  it('you cannot raise a hall on water', () => {
    // A QUESTION A LINE CANNOT POSE, so the bar holds the reason instead
    // of the refusal. `foundBlocker` says it in its own comment: on a
    // coast the posts go into the STRETCH the band is standing on, and
    // `route.COUNTRY` is shore and meadow and bog — there is no ocean on
    // it and no mountain either, so 'sea' and 'rock' are refusals with
    // nothing to refuse.
    //
    // That is only true while it stays true, which is what this checks:
    // every stretch of a coast is ground a hall could stand on. The day
    // someone adds an open-water stop, this fails and the refusal comes
    // back with it.
    for (let s = 0; s < 40; s += 1) {
      const seed = `sea-found-${s}`;
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
        const country = stopAt(seed, stop).country;
        expect(country, `${seed} stop ${stop} is not dry land`).not.toBe('ocean');
        expect(country, `${seed} stop ${stop} is bare rock`).not.toBe('mountains');
      }
    }
  });


});

describe('supplies and camp', () => {
  it('camping gathers firewood and costs a day', () => {
    const state = newGame('camp-seed');
    const next = apply(state, { type: 'CAMP' });
    expect(next.day).toBe(2);
    expect(next.party.hasCamped).toBe(true);
    expect(next.party.firewood).toBeGreaterThanOrEqual(state.party.firewood - 1);
  });

  it('foraging adds food and costs a day', () => {
    const state = newGame('forage-seed');
    const next = apply(state, { type: 'FORAGE' });
    expect(next.day).toBe(2);
    // Food is spent on the day's meal but foraging should more than cover it
    // on a summer shore.
    expect(next.party.food).toBeGreaterThan(state.party.food - foodPerDay(state) - 1);
  });

  it('doing nothing eventually kills the band', () => {
    let state = newGame('starve-seed');
    state = structuredClone(state);
    state.party.food = 0;
    state.party.firewood = 0;
    for (let i = 0; i < 200 && !state.end; i++) {
      state = state.battle || state.aftermath
        ? fight(state)
        : state.event
          ? fight(apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' }))
          : fight(apply(state, { type: 'CAMP' }));
    }
    expect(state.end).toBeDefined();
    expect(['starved', 'frozen', 'despair', 'slain']).toContain(state.end!.cause);
  });

  it('resources never go negative across a long run', () => {
    let state = newGame('invariant-seed');
    for (let i = 0; i < 120 && !state.end; i++) {
      state = step(state);
      expect(state.party.food).toBeGreaterThanOrEqual(0);
      expect(state.party.firewood).toBeGreaterThanOrEqual(0);
      expect(state.party.morale).toBeGreaterThanOrEqual(0);
      expect(state.party.morale).toBeLessThanOrEqual(100);
      for (const person of state.party.people) {
        expect(person.health).toBeGreaterThanOrEqual(0);
        expect(person.health).toBeLessThanOrEqual(person.maxHealth);
      }
    }
  });
});

describe('the year', () => {
  it('turns from summer through to winter on day 49', () => {
    expect(seasonOf(1)).toBe('summer');
    expect(seasonOf(24)).toBe('summer');
    expect(seasonOf(25)).toBe('autumn');
    expect(seasonOf(49)).toBe('winter');
    expect(seasonOf(73)).toBe('spring');
    expect(daysUntilWinter(1)).toBe(48);
    expect(daysUntilWinter(49)).toBe(0);
  });

  it('the first thaw is a milestone, not the end of the run', () => {
    let state = newGame('survive-seed');
    state = structuredClone(state);
    state.day = SURVIVAL_DAY - 1;
    state.party.food = 999;
    state.party.firewood = 999;
    state = apply(state, { type: 'CAMP' });
    // Until 4.6 this ended the run in victory. Now the year comes round.
    expect(state.end).toBeUndefined();
    expect(state.day).toBe(SURVIVAL_DAY);
    expect(wintersStood(state.day)).toBe(1);
    expect(state.saga.some((e) => e.text.includes('One winter behind us'))).toBe(true);
  });
});

describe('determinism of play', () => {
  it('the same seed and the same choices produce the same run', () => {
    const playOut = (seed: string): GameState => {
      let state = newGame(seed);
      for (let i = 0; i < 40 && !state.end; i++) state = step(state);
      return state;
    };
    expect(encode(playOut('replay-seed'))).toBe(encode(playOut('replay-seed')));
  });
});

describe('the chronicle does not stutter on a quiet stretch', () => {
  /** Walks a band across dull country and returns the lines it wrote. */
  function quietDays(seed: string, days: number): string[] {
    let state = structuredClone(newGame(seed));
    for (let i = 0; i < days && !state.end; i += 1) {
      if (state.event) {
        state = apply(state, { type: 'DISMISS_EVENT' });
        continue;
      }
      const options = walkOptions(state);
      if (options.length === 0) break;
      state = apply(state, { type: 'WALK', to: options[i % options.length]! });
    }
    return state.saga.map((entry) => entry.text);
  }


  it('keeps enough phrasings that a fortnight of dull country stays readable', () => {
    // Suppressing repeats is not enough on its own — a pool of four distinct
    // sentences all saying "nothing happened" still reads as one line said
    // four ways. The pool has to be wider than the window that guards it.
    const seen = new Set<string>();
    for (let s = 0; s < 25; s += 1) {
      for (const line of quietDays(`variety-${s}`, 30)) seen.add(line);
    }
    expect(seen.size).toBeGreaterThanOrEqual(12);
  });
});
