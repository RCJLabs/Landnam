// The land has a bottom, and it grows back.
//
// Before this, forage/hunt/fish paid the same on the hundredth day in a
// valley as on the first: a band that found one good hex never had to leave
// it. These bars hold the shape of the fix — that working a hex costs the
// next day's take, that time gives it back, that it never falls to nothing,
// and that a hex nobody has touched costs the save nothing.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import {
  GRACE,
  PRESSURE_STEP,
  REGROW_DAYS,
  THIN_FLOOR,
  abundance,
  noteTake,
  pressureAt,
  thinness,
} from '../src/sim/abundance';
import type { GameState } from '../src/state/types';
import { applyTravel } from '../src/sim/travel';
import { canGather } from '../src/sim/gathering';

function fresh(): GameState {
  const state = newGame('abundance');
  state.day = 1;
  return state;
}

describe('untouched ground', () => {
  it('pays in full and is written nowhere', () => {
    const state = fresh();
    expect(abundance(state, 'hunt')).toBe(1);
    expect(pressureAt(state, 'hunt')).toBe(0);
    // The save must not grow a key for every hex a band walks over.
    expect(state.world.worked).toBeUndefined();
  });
});

describe('working a hex costs the next day', () => {
  it('falls a step per take and never below the floor', () => {
    const state = fresh();
    // The grace: a band passing through pays nothing, which is the take a
    // starving band makes and the reason the odds survived this mechanic.
    for (let i = 0; i < GRACE; i++) noteTake(state, 'hunt');
    expect(abundance(state, 'hunt')).toBe(1);
    noteTake(state, 'hunt');
    expect(abundance(state, 'hunt')).toBeCloseTo(1 - PRESSURE_STEP, 10);
    for (let i = 0; i < 20; i++) noteTake(state, 'hunt');
    // A trap pays nothing; this pays little. The band can always eat.
    expect(abundance(state, 'hunt')).toBe(THIN_FLOOR);
    expect(abundance(state, 'hunt')).toBeGreaterThan(0);
  });

  it('keeps each larder and each hex separate', () => {
    const state = fresh();
    noteTake(state, 'hunt');
    // Netting the bay does not pick the berries, and the next valley is
    // its own country.
    expect(abundance(state, 'fish')).toBe(1);
    expect(abundance(state, 'forage')).toBe(1);
  });
});

describe('the land grows back', () => {
  it('lifts one take of pressure every REGROW_DAYS', () => {
    const state = fresh();
    noteTake(state, 'hunt');
    noteTake(state, 'hunt');
    expect(pressureAt(state, 'hunt')).toBeCloseTo(2, 10);
    // Pressure is counted from the first take; the grace is applied when the
    // yield is read, so recovery and grace stay two separate ideas.
    state.day += REGROW_DAYS;
    expect(pressureAt(state, 'hunt')).toBeCloseTo(1, 10);
    state.day += REGROW_DAYS * 3;
    // Left long enough, the valley is a valley again.
    expect(pressureAt(state, 'hunt')).toBe(0);
    expect(abundance(state, 'hunt')).toBe(1);
  });

  it('folds recovery into the figure it writes, so a return is not a fresh start', () => {
    const state = fresh();
    for (let i = 0; i < 4; i++) noteTake(state, 'hunt');
    state.day += REGROW_DAYS; // one take's worth back
    noteTake(state, 'hunt');
    // 4 taken, 1 grown back, 1 more taken.
    expect(pressureAt(state, 'hunt')).toBeCloseTo(4, 10);
  });
});

describe('the band can see it coming', () => {
  it('names the state of the ground before the day is spent', () => {
    const state = fresh();
    expect(thinness(state, 'hunt')).toBe('good');
    for (let i = 0; i < GRACE; i++) noteTake(state, 'hunt');
    // Still good: nobody has taken more than a passing band's share.
    expect(thinness(state, 'hunt')).toBe('good');
    noteTake(state, 'hunt');
    expect(thinness(state, 'hunt')).toBe('worked');
    noteTake(state, 'hunt');
    noteTake(state, 'hunt');
    expect(thinness(state, 'hunt')).toBe('thin');
  });
});

describe('the decision the larder is FOR', () => {
  it('measures what a valley pays the tenth day against the first', () => {
    // Isolated deliberately: ONE band, ONE hex, twelve takes, each yield read
    // from its own gathered beat. An earlier cut of this compared a sitting
    // band against a walking one and answered the wrong question — a band
    // that walks changes TERRAIN, and forest-versus-meadow swamps the thing
    // being measured. Same ground, same crew: the only variable left is how
    // often it has already been worked.
    const takes = 12;
    const first: number[] = [];
    const last: number[] = [];
    let seeds = 0;

    for (let s = 0; s < 30; s++) {
      let state = newGame(`larder-decay:${s}`);
      if (!canGather(state)) continue;
      const yields: number[] = [];
      let mark = 0;
      for (let d = 0; d < takes; d++) {
        const next = applyTravel(state, { type: 'HUNT' });
        if (next === state || next.end) break;
        state = next;
        const got = (state.beats ?? [])
          .filter((b) => b.n > mark && b.kind === 'gathered')
          .reduce((sum, b) => sum + (b.kind === 'gathered' ? b.got : 0), 0);
        mark = (state.beats ?? [])[(state.beats ?? []).length - 1]?.n ?? mark;
        yields.push(got);
      }
      if (yields.length < takes) continue;
      seeds++;
      first.push(...yields.slice(0, 3));
      last.push(...yields.slice(-3));
    }

    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const opening = mean(first);
    const closing = mean(last);
    console.log(`the larder, ${seeds} seeds, ${takes} days hunting ONE hex:`);
    console.log(`  first three days: ${opening.toFixed(1)} a day`);
    console.log(`  last three days : ${closing.toFixed(1)} a day`);
    console.log(`  the valley is paying ${(closing / opening).toFixed(2)}x what it did`);

    // The bar: squatting must cost real yield. Not a claim about how much —
    // that is the changelog's job — but a third off is the difference between
    // a decision and a rounding error.
    expect(closing).toBeLessThan(opening * 0.7);
    expect(seeds).toBeGreaterThan(5);
  });
});
