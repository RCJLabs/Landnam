// The autumn reckoning: raids stop being a coin flip spread over a run and
// become a season a band can prepare for.
//
// The measurement that asked for this is in `sim/raid.ts` beside the
// constant, and it is worth repeating because it is not what it looks like:
// the long game already saw 268 raids across 120 sagas — 2.2 a run — and yet
// a twenty-saga probe found only EIGHT OF TWENTY ever saw a single one. A low
// per-day chance over a run of unpredictable length gives most bands none and
// a few several. The threat was never too small. It was too random to plan
// against, which is why the palisade — worth 47% to 91% on a six-man defence
// — was the rarest building in the game at 13 of 60 sagas.

import { describe, expect, it } from 'vitest';
import { settled } from './fixtures/settle';
import {
  AUTUMN_FROM,
  AUTUMN_TO,
  autumnChance,
  autumnRaidDay,
  threatReading,
} from '../src/sim/raid';
import { SEASON_LENGTH, daysUntilAutumn, seasonOf, seasonStartDay } from '../src/sim/calendar';
import type { GameState } from '../src/state/types';

/** A steading worth coming for: five buildings and a winter in the store. */
const worthTaking = (seed: string, day = 30): GameState => {
  const state = settled(seed);
  state.day = day;
  state.settlement!.built = ['bud', 'smokehouse', 'storehouse', 'farmplots', 'watchtower'];
  state.party.food = 120;
  return state;
};

describe('the reckoning falls in autumn', () => {
  it('names a day inside the season, never its first or its last', () => {
    // Not the 1st, so the season opens with the question still open; not the
    // 24th, so a band that survives it has a few days before the winter.
    for (let year = 0; year < 12; year += 1) {
      const state = worthTaking(`when-${year}`, 25 + year * 96);
      const start = seasonStartDay(state.day);
      const when = autumnRaidDay(state);
      expect(seasonOf(when)).toBe('autumn');
      expect(when - start).toBeGreaterThanOrEqual(AUTUMN_FROM);
      expect(when - start).toBeLessThanOrEqual(AUTUMN_TO);
      expect(when - start).toBeLessThan(SEASON_LENGTH);
    }
  });

  it('names the same day every time it is asked, without storing it', () => {
    // Derived from the seed and the season, so it costs the save nothing and
    // a reload cannot reroll the year's raid.
    const state = worthTaking('stable');
    const first = autumnRaidDay(state);
    for (let i = 0; i < 5; i += 1) expect(autumnRaidDay(state)).toBe(first);
  });

  it('does not name the same day in every autumn of a run', () => {
    const days = new Set(
      Array.from({ length: 8 }, (_, y) => {
        const s = worthTaking('spread', 25 + y * 96);
        return autumnRaidDay(s) - seasonStartDay(s.day);
      }),
    );
    expect(days.size).toBeGreaterThan(1);
  });
});

describe('what draws them is what they would be coming for', () => {
  it('leaves bare posts with an empty store alone', () => {
    const state = settled('bare');
    state.day = 30;
    state.settlement!.built = [];
    state.party.food = 0;
    expect(autumnChance(state)).toBe(0);
  });

  it('grows with what there is to take', () => {
    const poor = worthTaking('poor');
    poor.party.food = 20;
    const rich = worthTaking('rich');
    rich.party.food = 300;
    expect(autumnChance(rich)).toBeGreaterThan(autumnChance(poor));
  });

  it('is never a certainty, however fat the steading', () => {
    const state = worthTaking('fat');
    state.settlement!.built = ['bud', 'smokehouse', 'storehouse', 'farmplots', 'watchtower',
      'meadhall', 'greathall', 'earthworks', 'hof', 'dock'];
    state.party.food = 4000;
    // `1 - e^(-worth·k)` saturates rather than clipping, which is the point:
    // the first constant tried was 0.5 and put every steading in the game
    // between 89% and 96% — a certainty the wall could not move.
    expect(autumnChance(state)).toBeLessThan(1);
    expect(autumnChance(state)).toBeGreaterThan(0.5);
  });

  it('holds its grace after founding', () => {
    const state = worthTaking('young');
    state.settlement!.foundedOn = state.day;
    expect(threatReading(state).respite).toBeGreaterThan(0);
    expect(autumnChance(state)).toBe(0);
  });
});

describe('the odds are readable a summer ahead', () => {
  it('counts down to the reckoning from every other season', () => {
    // What the watch panel says. A wall takes a season to raise, so the
    // number that matters is how long there is left to raise it.
    expect(daysUntilAutumn(25)).toBe(0);
    expect(daysUntilAutumn(48)).toBe(0);
    expect(daysUntilAutumn(1)).toBe(24);
    expect(daysUntilAutumn(49)).toBe(72);
    expect(seasonOf(1 + daysUntilAutumn(1))).toBe('autumn');
    for (const day of [1, 20, 49, 70, 95, 130, 200, 411]) {
      const until = daysUntilAutumn(day);
      expect(seasonOf(day + until)).toBe('autumn');
      if (until > 0) expect(seasonOf(day + until - 1)).not.toBe('autumn');
    }
  });
});
