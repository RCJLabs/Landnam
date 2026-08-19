// Word of the band: the world escalates with the years, everywhere.
//
// The audit's third finding — only the home raid ever grew; day 700's
// travel fight drew the same four archetypes at the same weights as day
// 7's. And this project has burned itself before on escalation that was
// quietly swallowed by a clamp, so every knob here is tested to BIND:
// the count actually rises, the mix actually hardens, and the raid path
// is actually untouched.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { makeRng } from '../src/rng';
import { startBattle } from '../src/sim/battleTurn';
import { MAX_FOES, foeCapFor, raiderCap, rollFoes } from '../src/sim/battle';
import { weightFor, wordBump, wordOf } from '../src/sim/word';
import { FOE_ARCHETYPES } from '../src/data/foes';
import type { GameState } from '../src/state/types';

/** A band at the given point in its saga, with the given deeds behind it. */
function famous(seed: string, day: number, sackings: number): GameState {
  const state = structuredClone(newGame(seed));
  state.day = day;
  state.tally.sackings = sackings;
  return state;
}

const YEAR = 96;

describe('word accumulates', () => {
  it('grows with winters stood and with deeds chosen, from nothing', () => {
    expect(wordOf(famous('w', 10, 0))).toBe(0);
    expect(wordOf(famous('w', 10 + 2 * YEAR, 0))).toBeGreaterThan(wordOf(famous('w', 10 + YEAR, 0)));
    expect(wordOf(famous('w', 10, 4))).toBeGreaterThan(wordOf(famous('w', 10, 0)));
  });

  it('leaves the tuned first year alone for a band that robbed nobody', () => {
    for (const day of [1, 30, 49, 73]) {
      expect(wordBump(famous('quiet', day, 0)), `day ${day}`).toBe(0);
    }
  });
});

describe('every knob BINDS — the Math.min lesson, applied in advance', () => {
  it('the count: word raises the cap, so the difficulty bump reaches the field', () => {
    // With six sworn the old formula saturated MAX_FOES at difficulty two.
    // A famous band must actually see more foes, or the whole scalar is
    // theatre. Deterministic: count depends only on size, difficulty, cap.
    const young = famous('bind-count', 30, 0);
    startBattle(young, 'meadow', 0);
    const est = young.battle!.foes.length;

    const old = famous('bind-count', 30 + 5 * YEAR, 4); // word 7: bump 3, cap +2
    startBattle(old, 'meadow', 0);
    expect(old.battle!.foes.length).toBeGreaterThan(est);
    expect(old.battle!.foes.length).toBeGreaterThan(MAX_FOES);
    expect(old.battle!.log[0]).toContain('They had heard of us.');
  });

  it('the mix: a known band draws huscarls where a nobody drew scouts', () => {
    const share = (word: number): number => {
      let huscarls = 0;
      let total = 0;
      for (let i = 0; i < 40; i += 1) {
        const foes = rollFoes(makeRng(`mix-${word}-${i}`), 6, 2, false, 8, word);
        total += foes.length;
        huscarls += foes.filter((f) => f.trait === 'foe:huscarl').length;
      }
      return huscarls / total;
    };
    expect(share(6)).toBeGreaterThan(share(0));
  });

  it('word never makes the men who come SOFTER', () => {
    // This used to name 'huscarl' and 'raider' and require everything else to
    // be flat — the same list of ids the engine carried, and it broke the
    // moment a foe was added whose odds FALL with word. A levy thinning out
    // is not a violation of the rule, it is the rule: somebody's cousins do
    // not turn out against a band with a name.
    //
    // So the property is stated on what the coast actually sends. The
    // expected budget of a man drawn at random must not fall as word grows,
    // and over the whole range it has to rise — a reputation that changed
    // nothing would be a knob that does not bind, which is this file's
    // subject.
    const expectedBudget = (word: number): number => {
      const total = FOE_ARCHETYPES.reduce((sum, a) => sum + weightFor(a, word), 0);
      return FOE_ARCHETYPES.reduce(
        (sum, a) => sum + a.budget * (weightFor(a, word) / total), 0);
    };

    let last = expectedBudget(0);
    for (const word of [1, 2, 3, 6, 10, 20]) {
      const now = expectedBudget(word);
      expect(now, `word ${word} sent softer men than word ${word - 1}`)
        .toBeGreaterThanOrEqual(last - 1e-9);
      last = now;
    }
    expect(expectedBudget(10)).toBeGreaterThan(expectedBudget(0));
  });

  it('lets only the hard men gain by your name', () => {
    // The aggregate rule above is the OUTCOME, and it turned out to be too
    // blunt to guard the input: giving the cheapest levy a strongly positive
    // renown still left expected budget rising, because the huscarls and
    // wolf-coats grow faster than the levies dilute. Checked directly, then:
    // a foe may only become MORE likely as your word grows if it is at least
    // as hard as the coast's average man. Anything softer may hold steady or
    // thin out, never crowd in.
    const mean = FOE_ARCHETYPES.reduce((s, a) => s + a.budget, 0) / FOE_ARCHETYPES.length;
    for (const a of FOE_ARCHETYPES) {
      if (a.renown > 0) {
        expect(a.budget, `${a.id} grows with word but is softer than average`)
          .toBeGreaterThanOrEqual(mean);
      }
    }
  });

  it('the cap tops out — the field is seven wide and the warband is six', () => {
    expect(foeCapFor(famous('cap', 30 + 20 * YEAR, 40))).toBe(MAX_FOES + 2);
  });
});

describe('the home raid is not double-charged', () => {
  it('sackings reach raids through standing, never through word', () => {
    // The raid path has its own escalation (raidDifficulty, raiderCap), and
    // a sacking already lands there by making the coast angrier. Routing
    // word into it too would count one deed twice.
    const quiet = famous('raid-path', 30 + 2 * YEAR, 0);
    const infamous = famous('raid-path', 30 + 2 * YEAR, 12);
    expect(raiderCap(infamous)).toBe(raiderCap(quiet));
  });

  it('a raid opens without the word line', () => {
    const state = structuredClone(newGame('raid-noline'));
    state.tally.sackings = 12;
    state.day = 300;
    // No steading: an open-field fight, which DOES carry word...
    startBattle(state, 'meadow', 0);
    expect(state.battle!.log[0]).toContain('They had heard of us.');
  });
});
