// 11.S1: how a wall forms up, and the bug that made src/sim/lineup.ts
// necessary. Not test/line.test.ts, which is the RENDERER's rank geometry.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { beginBattle } from '../src/sim/battle';
import { formUp, heft } from '../src/sim/lineup';
import { leaderOf, sworn } from '../src/sim/people';
import type { Person } from '../src/state/types';

function band(): Person[] {
  return newGame('lineup-fixture').party.people;
}

describe('forming up', () => {
  it('puts the man who can hold the front at the front', () => {
    const line = formUp(band());
    for (let i = 1; i < line.length; i += 1) {
      expect(heft(line[i - 1]!)).toBeGreaterThanOrEqual(heft(line[i]!));
    }
  });

  it('does not mutate what it is handed, and is stable across two calls', () => {
    const people = band();
    const before = people.map((p) => p.id);
    const once = formUp(people).map((p) => p.id);
    const twice = formUp(people).map((p) => p.id);
    expect(people.map((p) => p.id)).toEqual(before);
    expect(once).toEqual(twice);
  });

  it('breaks a tie on id rather than on where somebody sat in the roster', () => {
    // Two identical men handed over in the opposite order must form the same
    // line, or a replayed save forks on nothing.
    const people = band();
    for (const p of people) { p.health = 10; p.stats.might = 3; p.injuries = []; }
    const forwards = formUp(people).map((p) => p.id);
    const backwards = formUp([...people].reverse()).map((p) => p.id);
    expect(forwards).toEqual(backwards);
  });

  it('sends a wounded man to the back without anybody deciding it', () => {
    const people = band();
    for (const p of people) { p.health = 12; p.stats.might = 3; p.injuries = []; }
    const front = formUp(people)[0]!;
    front.health = 2;
    expect(formUp(people)[0]!.id).not.toBe(front.id);
    expect(formUp(people).at(-1)!.id).toBe(front.id);
  });
});

describe('the bug this replaced', () => {
  /**
   * THE REGRESSION BAR, and it was watched failing against the old line
   * before it was trusted.
   *
   * Rank used to be the roster index, and `leaderOf` is `sworn(people)[0]` —
   * the same index — so the band's leader stood in the front rank of every
   * fight it ever had, and `leaderFell` costs the whole side 25 nerve.
   * Measured at 296 leader-falls in 300 arena fights, and the shipped line
   * lost 40 fights in 300 to picking at random (11.S1).
   *
   * Written so it FAILS on the old line: the leader here is deliberately the
   * frailest man in the band, so roster order and formed-up order disagree
   * about him as loudly as they can.
   */
  it('does not stand the leader at the front just because he leads', () => {
    const state = newGame('lineup-leader');
    const leader = leaderOf(state.party.people)!;
    for (const p of state.party.people) { p.health = 14; p.stats.might = 4; p.injuries = []; }
    leader.health = 1;
    beginBattle(state, 'meadow', 1);
    const his = state.battle!.combatants.find((c) => c.personId === leader.id)!;
    expect(his.rank).toBe(sworn(state.party.people).length);
  });

  /**
   * Symmetric, and sim/battleAi.ts is where the rule is written down: "a
   * formation trick that only the warband can play is not a formation, it is
   * a bonus." Their wall forms up by the same reading of the same numbers.
   */
  it('forms their wall the same way it forms ours', () => {
    const state = newGame('lineup-foes');
    beginBattle(state, 'meadow', 2);
    const battle = state.battle!;
    for (const side of ['warband', 'foe'] as const) {
      const ranked = battle.combatants
        .filter((c) => c.side === side)
        .sort((a, b) => a.rank - b.rank)
        .map((c) => (side === 'foe' ? battle.foes : state.party.people)
          .find((p) => p.id === c.personId)!);
      expect(ranked.length).toBeGreaterThan(1);
      for (let i = 1; i < ranked.length; i += 1) {
        expect(heft(ranked[i - 1]!)).toBeGreaterThanOrEqual(heft(ranked[i]!));
      }
    }
  });

  it('gives every fighter a rank, once, from one to however deep they stand', () => {
    const state = newGame('lineup-ranks');
    beginBattle(state, 'meadow', 2);
    for (const side of ['warband', 'foe'] as const) {
      const ranks = state.battle!.combatants
        .filter((c) => c.side === side)
        .map((c) => c.rank)
        .sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    }
  });
});
