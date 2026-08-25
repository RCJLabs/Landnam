// The first step of the conversion: a fighter has a place in the LINE.
//
// Written at 8.1b, when rank was a field nothing read and the fight was still
// resolved on hexes — so the only claims available were that ranks exist,
// that they form a sane line, and that an old save comes forward without
// losing the fight it was in the middle of.
//
// All three still hold and the ground under them has moved twice: 8.1c gave
// the verbs to the ranks, 8.1d gave them to the renderer and deleted the hex.
// What this file guards now is the SEAM — a saga saved before any of it walks
// v44 to v47 and comes out with its fight intact. The header is kept honest
// rather than rewritten, because the dates are the point: this was the step
// that made the rest survivable.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { startBattle } from '../src/sim/battleTurn';
import { cloneState } from '../src/state/clone';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import type { GameState } from '../src/state/types';

function fought(seed: string, difficulty = 1): GameState {
  const state = cloneState(newGame(seed));
  startBattle(state, 'meadow', difficulty);
  expect(state.battle, `${seed}: no fight started`).toBeDefined();
  return state;
}

const SEEDS = ['raven-skerry-317', 'grim-fjord-100', 'kelda-vik-42'];

describe('everybody who takes the field has a place in it', () => {
  it('gives every combatant a rank', () => {
    for (const seed of SEEDS) {
      for (const c of fought(seed).battle!.combatants) {
        expect(Number.isInteger(c.rank), `${seed}: ${c.personId} has rank ${c.rank}`).toBe(true);
        expect(c.rank, `${seed}: ${c.personId}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('ranks each side 1..n with no gaps and no two in one place', () => {
    for (const seed of SEEDS) {
      const battle = fought(seed).battle!;
      for (const side of ['warband', 'foe'] as const) {
        const ranks = battle.combatants.filter((c) => c.side === side).map((c) => c.rank).sort((a, b) => a - b);
        if (ranks.length === 0) continue;
        expect(ranks, `${seed}: ${side} ranks`).toEqual(ranks.map((_, i) => i + 1));
      }
    }
  });

  it('ranks the two sides independently — both have a front', () => {
    for (const seed of SEEDS) {
      const battle = fought(seed).battle!;
      for (const side of ['warband', 'foe'] as const) {
        const ranks = battle.combatants.filter((c) => c.side === side).map((c) => c.rank);
        if (ranks.length === 0) continue;
        expect(Math.min(...ranks), `${seed}: ${side} has nobody in front`).toBe(1);
      }
    }
  });
});

describe('a saga saved mid-swing', () => {
  it('comes forward with ranks, and still has its fight', () => {
    const state = fought('raven-skerry-317');
    const before = state.battle!.combatants.length;
    // A save as it was written at v44: same shape, no ranks anywhere.
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    old['version'] = 44;
    const battle = old['battle'] as { combatants: Record<string, unknown>[] };
    for (const c of battle.combatants) delete c['rank'];

    const { save, applied } = migrate(old);
    expect(applied, 'the registry skipped the bump').toBeGreaterThan(0);
    expect(save['version']).toBe(SAVE_VERSION);

    const now = (save['battle'] as { combatants: { side: string; rank: number }[] }).combatants;
    expect(now.length, 'the fight was dropped').toBe(before);
    for (const c of now) {
      expect(Number.isInteger(c.rank), 'somebody came forward without a rank').toBe(true);
      expect(c.rank).toBeGreaterThanOrEqual(1);
    }
    for (const side of ['warband', 'foe']) {
      const ranks = now.filter((c) => c.side === side).map((c) => c.rank).sort((a, b) => a - b);
      if (ranks.length === 0) continue;
      expect(ranks, `${side} came forward in a broken line`).toEqual(ranks.map((_, i) => i + 1));
    }
  });

  it('carries the fight all the way to the line, and leaves the hex behind', () => {
    // This said "is untouched otherwise — this step changes no behaviour",
    // and asserted every combatant still had an `at`, because when it was
    // written v45 only ADDED a rank and the hex was still what fights ran
    // on. Two milestones later the hex is what nothing runs on, so the claim
    // has to be the one that outlived it: a saga saved mid-swing under the
    // old rules walks the whole chain — 44 to 45 to 46 to 47 — and comes out
    // with its fight intact and no coordinate in it.
    const state = fought('grim-fjord-100');
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    old['version'] = 44;
    const battle = old['battle'] as { combatants: Record<string, unknown>[] };
    // As a v44 save was: a hex apiece and no rank at all.
    for (const [i, c] of battle.combatants.entries()) {
      delete c['rank'];
      c['at'] = { q: i, r: 0 };
    }

    const { save } = migrate(old);
    expect(save['version']).toBe(SAVE_VERSION);
    const now = save['battle'] as {
      round: number;
      turnIndex: number;
      combatants: { at?: unknown; rank: number; personId: string; nerve: number }[];
    };
    // The fight itself is where it was.
    expect(now.round).toBe(state.battle!.round);
    expect(now.turnIndex).toBe(state.battle!.turnIndex);
    expect(now.combatants.length).toBe(state.battle!.combatants.length);
    // Every man kept who he is and how he was doing...
    for (const [i, c] of now.combatants.entries()) {
      expect(c.personId).toBe(state.battle!.combatants[i]!.personId);
      expect(c.nerve).toBe(state.battle!.combatants[i]!.nerve);
      expect(Number.isInteger(c.rank)).toBe(true);
    }
    // ...and nobody is carrying a hex any more.
    expect(
      now.combatants.some((c) => c.at !== undefined),
      'a coordinate survived the migration that deletes it',
    ).toBe(false);
  });

  it('a save with no fight in progress migrates without inventing one', () => {
    const state = cloneState(newGame('kelda-vik-42'));
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    old['version'] = 44;
    delete old['battle'];
    const { save } = migrate(old);
    expect(save['version']).toBe(SAVE_VERSION);
    expect(save['battle']).toBeUndefined();
  });
});
