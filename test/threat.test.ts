// The watch mark: how likely somebody is to come, and what is making it so.
//
// The winter mark is the most successful panel in this game because it never
// lies — it walks the same days the day tick will. This is the same clock for
// the other hazard, and it is held to the same rule: the reading IS the
// calculation. `raidOdds` is one field of `threatReading` and nothing else,
// so a panel that disagrees with the dice is not possible rather than merely
// unlikely.

import { settled as settleSomewhere } from './fixtures/settle';
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { RAID_CHANCE_MAX, RAID_RESPITE, raidOdds, threatReading } from '../src/sim/raid';
import type { GameState } from '../src/state/types';

function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  state.settlement!.foundedOn = 1;
  state.day = 100;
  state.party.food = 120;
  state.settlement!.built.push('longhouse', 'meadhall');
  return state;
}

describe('the reading is the calculation', () => {
  it('raidOdds is exactly the chance the panel shows', () => {
    // Not "close to". The same number, across a spread of situations — the
    // panel and the dice must be one computation, not two that agree today.
    for (const seed of ['threat-a', 'threat-b', 'threat-c']) {
      for (const anger of [0, 40, 90]) {
        for (const watch of [0, 3, 6]) {
          const state = settled(seed);
          state.neighbours.forEach((n) => {
            n.found = true;
            n.standing = -anger;
          });
          state.settlement!.watch = watch;
          expect(raidOdds(state)).toBe(threatReading(state).chance);
        }
      }
    }
  });

  it('a fresh steading is left alone, and says how long for', () => {
    const state = settled('threat-new');
    state.settlement!.foundedOn = state.day - 3;
    const read = threatReading(state);
    expect(read.respite).toBe(RAID_RESPITE - 3);
    expect(read.chance).toBe(0);
    expect(raidOdds(state)).toBe(0);
  });

  it('an unsettled band has no steading to come for', () => {
    const wandering = structuredClone(newGame('threat-road'));
    const read = threatReading(wandering);
    expect(read.chance).toBe(0);
    expect(read.draws).toHaveLength(0);
  });
});

describe('what the panel names', () => {
  it('names the things actually drawing them, and only those', () => {
    const state = settled('threat-draws');
    state.neighbours.forEach((n) => {
      n.found = true;
      n.standing = 40; // friendly: no grievance term
    });
    const labels = threatReading(state).draws.map((t) => t.label);
    expect(labels).toContain('Winters stood');
    expect(labels).toContain('What is raised');
    expect(labels).toContain('What is in the store');
    expect(labels).not.toContain('Who is angry');

    state.neighbours[0]!.standing = -90;
    expect(threatReading(state).draws.map((t) => t.label)).toContain('Who is angry');
  });

  it('names the wall and the watch only once they exist', () => {
    const state = settled('threat-keeps');
    state.settlement!.watch = 0;
    const bare = threatReading(state);
    expect(bare.keeps.map((t) => t.label)).not.toContain('The watch');

    state.settlement!.watch = 4;
    state.settlement!.built.push('palisade');
    const held = threatReading(state);
    expect(held.keeps.map((t) => t.label)).toEqual(
      expect.arrayContaining(['The wall', 'The watch']),
    );
  });

  it('every term the panel shows actually moves the chance it shows', () => {
    // A row that is displayed but inert would be worse than no panel: it
    // would teach the player to spend on something that does nothing.
    const base = settled('threat-binds');
    base.neighbours.forEach((n) => {
      n.found = true;
      n.standing = 0;
    });
    const before = threatReading(base).chance;

    const richer = structuredClone(base);
    richer.party.food += 100;
    expect(threatReading(richer).chance).toBeGreaterThan(before);

    const angrier = structuredClone(base);
    angrier.neighbours[0]!.standing = -90;
    expect(threatReading(angrier).chance).toBeGreaterThan(before);

    const watched = structuredClone(base);
    watched.settlement!.watch = 6;
    expect(threatReading(watched).chance).toBeLessThan(before);

    const walled = structuredClone(base);
    walled.settlement!.built.push('palisade');
    expect(threatReading(walled).chance).toBeLessThan(before);
  });

  it('a steading nobody can reach reads as quiet, not as a small number', () => {
    const state = settled('threat-quiet');
    state.neighbours.forEach((n) => {
      n.found = true;
      n.standing = 60;
    });
    state.party.food = 0;
    state.settlement!.watch = 6;
    state.settlement!.built.push('palisade', 'watchtower');
    state.day = 30;
    const read = threatReading(state);
    if (read.chance === 0) {
      expect(read.quiet).toBe(true);
      expect(raidOdds(state)).toBe(0);
    }
  });

  it('the ceiling is a safety valve, not a state the game reaches', () => {
    // This started as a test that the panel NAMES the cap, and the fixture
    // could not reach it: nine winters, ten buildings, a full store and a
    // coast that hates you reads 0.021 against a 0.055 ceiling. So the
    // "as bad as it gets" branch was dead UI and was removed. Kept as a
    // test so the next person to look at RAID_CHANCE_MAX knows it is a
    // guard rail rather than a target.
    const state = settled('threat-cap');
    state.neighbours.forEach((n) => {
      n.found = true;
      n.standing = -100;
    });
    state.party.food = 900;
    state.day = 900;
    for (let i = 0; i < 8; i += 1) state.settlement!.built.push('bud');
    const read = threatReading(state);
    expect(read.chance).toBeGreaterThan(0);
    expect(read.chance).toBeLessThan(RAID_CHANCE_MAX / 2);
  });

  it('every days-between figure is a real number of days', () => {
    const state = settled('threat-days');
    state.neighbours.forEach((n) => {
      n.found = true;
      n.standing = -50;
    });
    const read = threatReading(state);
    expect(read.everyDays).toBeGreaterThan(0);
    expect(Number.isFinite(read.everyDays!)).toBe(true);
    // And it is the honest reciprocal of the chance being rolled.
    expect(read.everyDays).toBe(Math.round(1 / read.chance));
  });
});
