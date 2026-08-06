import { describe, it, expect } from 'vitest';
import { key, distance } from '../src/hex';
import { newGame, START_FIREWOOD, START_FOOD } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { canMove, daysForMove, moveEffort, moveOptions } from '../src/sim/travel';
import { living } from '../src/sim/people';
import { foodPerDay, SURVIVAL_DAY } from '../src/sim/upkeep';
import { daysUntilWinter, seasonOf } from '../src/sim/calendar';
import { visibilityAt } from '../src/sim/fog';
import { encode } from '../src/state/save';
import type { GameState } from '../src/state/types';

function step(state: GameState): GameState {
  if (state.event) {
    const chosen = apply(state, { type: 'CHOOSE', index: 0 });
    return apply(chosen, { type: 'DISMISS_EVENT' });
  }
  const options = moveOptions(state);
  return options[0] ? apply(state, { type: 'MOVE', to: options[0] }) : apply(state, { type: 'CAMP' });
}

describe('new game', () => {
  it('starts a warband of six on the landing beach', () => {
    const state = newGame('start-seed');
    expect(state.day).toBe(1);
    expect(state.modes).toEqual(['TRAVEL']);
    expect(living(state.party.people)).toHaveLength(6);
    expect(state.party.at).toEqual(state.world.landing);
    expect(state.party.food).toBe(START_FOOD);
    expect(state.party.firewood).toBe(START_FIREWOOD);
    expect(state.saga).toHaveLength(1);
  });

  it('reveals the country around the landing but not the whole map', () => {
    const state = newGame('fog-seed');
    expect(visibilityAt(state.world, state.party.at)).toBe('visible');
    const revealed = Object.keys(state.world.seen).length;
    expect(revealed).toBeGreaterThan(3);
    expect(revealed).toBeLessThan(Object.keys(state.world.tiles).length / 4);
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
  it('only permits adjacent, passable hexes', () => {
    const state = newGame('move-seed');
    for (const option of moveOptions(state)) {
      expect(distance(state.party.at, option)).toBe(1);
      expect(canMove(state, option)).toBe(true);
    }
    const far = { q: state.party.at.q + 4, r: state.party.at.r };
    expect(canMove(state, far)).toBe(false);
    expect(apply(state, { type: 'MOVE', to: far })).toBe(state);
  });

  it('never permits walking onto open sea', () => {
    const state = newGame('sea-seed');
    for (const [k, tile] of Object.entries(state.world.tiles)) {
      if (tile.terrain !== 'ocean') continue;
      const h = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      expect(moveEffort(state, h)).toBeNull();
    }
  });

  it('advances the day and moves the party', () => {
    const state = newGame('advance-seed');
    const target = moveOptions(state)[0]!;
    const days = daysForMove(state, target)!;
    const next = apply(state, { type: 'MOVE', to: target });
    expect(next.party.at).toEqual(target);
    expect(next.day).toBe(state.day + days);
    expect(state.day).toBe(1); // the input state is untouched
  });

  it('hard ground costs more days than open ground', () => {
    const state = newGame('cost-seed');
    // Mountains cost 4 effort, meadow 1 — two days versus one.
    const fake = structuredClone(state);
    const target = moveOptions(fake)[0]!;
    fake.world.tiles[key(target)]!.terrain = 'meadow';
    expect(daysForMove(fake, target)).toBe(1);
    fake.world.tiles[key(target)]!.terrain = 'mountains';
    expect(daysForMove(fake, target)).toBe(2);
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
      state = state.event
        ? apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' })
        : apply(state, { type: 'CAMP' });
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

  it('surviving to spring ends the run in victory', () => {
    let state = newGame('survive-seed');
    state = structuredClone(state);
    state.day = SURVIVAL_DAY - 1;
    state.party.food = 999;
    state.party.firewood = 999;
    state = apply(state, { type: 'CAMP' });
    expect(state.end?.cause).toBe('survived');
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
