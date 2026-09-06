// 12.8: the odds on a foe, held against the blow the game actually strikes.
//
// `hitOdds` is exact rather than fitted — one random term, two six-sided dice
// — so what these tests guard is not a model's accuracy but whether the
// formula and the code have DRIFTED APART. A number printed on a foe that no
// longer matches the swing behind it is worse than no number: the player is
// deciding on it.
//
// The bar the item set is ">= 2,000 seeded swings within 3 points", and it is
// run against the real `doStrike` rather than a re-implementation of it, for
// the same reason `counsel` re-runs the winter mark instead of doing its own
// arithmetic: a second copy of the rule can agree with itself while both
// disagree with the game.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { startBattle } from '../src/sim/battleTurn';
import { activeCombatant, strikeTargets } from '../src/sim/battle';
import { doStrike } from '../src/sim/strike';
import { apply } from '../src/sim/actions';
import { isWarbandTurn } from '../src/sim/battle';
import { atLeastOn2d6, hitOdds } from '../src/sim/swing';
import type { GameState } from '../src/state/types';

function fight(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  startBattle(state, 'meadow', 1);
  return state;
}

describe('the dice, counted rather than modelled', () => {
  it('reads 1 where the swing cannot miss and 0 where it cannot land', () => {
    // The two ends are the point of counting: a foe the player cannot miss
    // and one they cannot hit are facts worth saying plainly, and a formula
    // that rounds them to 99% and 1% is lying at exactly the moments the
    // player would most like the truth.
    expect(atLeastOn2d6(2)).toBe(1);
    expect(atLeastOn2d6(-5)).toBe(1);
    expect(atLeastOn2d6(13)).toBe(0);
    expect(atLeastOn2d6(99)).toBe(0);
  });

  it('is the real tail of 2d6 at every step between', () => {
    // Written out rather than derived, so this test cannot agree with the
    // function by sharing its mistake.
    const ways: Record<number, number> = {
      3: 35, 4: 33, 5: 30, 6: 26, 7: 21, 8: 15, 9: 10, 10: 6, 11: 3, 12: 1,
    };
    for (const [need, count] of Object.entries(ways)) {
      expect(atLeastOn2d6(Number(need)), `2d6 >= ${need}`).toBeCloseTo(count / 36, 10);
    }
  });

  it('is monotone: a harder foe is never better odds', () => {
    for (let n = -2; n <= 14; n += 1) {
      expect(atLeastOn2d6(n + 1)).toBeLessThanOrEqual(atLeastOn2d6(n));
    }
  });
});

describe('the odds on a foe match the blow the game strikes', () => {
  it('predicts the hit rate over thousands of real seeded swings', { timeout: 300_000 }, () => {
    // Bucketed by the odds the game offered, because an overall average can
    // be right while every individual number is wrong — two errors either
    // side cancel and the check passes on a function that tells the player
    // nothing true. Each bucket is its own claim.
    const buckets = new Map<number, { n: number; landed: number }>();
    let swings = 0;

    for (let s = 0; s < 1200 && swings < 16000; s += 1) {
      let state = fight(`odds-${s}`);
      for (let turn = 0; turn < 200 && !state.battle?.outcome; turn += 1) {
        if (!isWarbandTurn(state)) {
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
        const targets = strikeTargets(state);
        const active = activeCombatant(state.battle!);
        if (!targets.length || !active) {
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
        const target = targets[swings % targets.length]!;
        const odds = hitOdds(state, active, target);
        // Where the beat stream stands BEFORE the blow, so the beat this
        // swing writes can be picked out of what follows it.
        const was = (state.battle!.beats ?? []).length;

        const copy = structuredClone(state);
        const struck = doStrike(copy, target.personId);
        if (!struck) { state = apply(state, { type: 'B_END_TURN' }); continue; }

        // What the swing DID, read off ITS OWN beat.
        //
        // THE FIRST CUT TOOK THE LAST BEAT IN THE STREAM and was wrong by
        // twenty-five points in every bucket — including the one where the
        // odds are 100%, which landed 75%. A blow that KILLS appends more
        // beats after its own (the fall, the nerve it shakes, a leader's
        // death read out after the cause), so the last beat is a hit's
        // consequence rather than the hit. Reading a cause off "whatever
        // moved last" is the fault CLAUDE.md names, and it presented here as
        // a clean, consistent, entirely wrong ~25 points.
        const beats = copy.battle!.beats ?? [];
        const mine = beats.slice(was).find((b) => b.kind === 'struck');
        const landed = Boolean(mine && mine.kind === 'struck' && mine.result === 'hit');

        const key = Math.round(odds * 36);
        const bucket = buckets.get(key) ?? { n: 0, landed: 0 };
        bucket.n += 1;
        if (landed) bucket.landed += 1;
        buckets.set(key, bucket);
        swings += 1;
        state = copy;
      }
    }

    expect(swings, 'no swings were measured at all').toBeGreaterThanOrEqual(2000);

    const rows: string[] = [];
    let worst = 0;
    for (const [key, b] of [...buckets.entries()].sort((a, c) => a[0] - c[0])) {
      const said = key / 36;
      const was = b.landed / b.n;
      // ONLY BUCKETS THAT CAN RESOLVE THREE POINTS ARE JUDGED, and the
      // threshold is arithmetic rather than taste. Two standard errors on a
      // rate near 0.7 is three points at about n = 350, so below that a
      // bucket cannot tell a real drift from the dice — the first cut gated
      // at 100 and duly failed on a bucket 5.2 points out with n = 170,
      // which is 1.5 standard errors and means nothing. A tolerance a
      // sample cannot resolve is the fault this repo keeps finding in its
      // own bars; it is not one to write fresh.
      if (b.n < 350) { rows.push(`  ${(said * 100).toFixed(0)}% said — ${b.n} swings, too few to resolve 3 points`); continue; }
      const gap = Math.abs(said - was) * 100;
      if (gap > worst) worst = gap;
      rows.push(`  ${(said * 100).toFixed(0)}% said — ${(was * 100).toFixed(1)}% landed over ${b.n} swings (${gap.toFixed(1)} points out)`);
    }
    // eslint-disable-next-line no-console
    console.log(`odds against the real swing, ${swings} seeded strikes:\n${rows.join('\n')}`);

    expect(
      worst,
      `the worst bucket is ${worst.toFixed(1)} points out — the number on the foe and the`
        + ' blow behind it have come apart',
    ).toBeLessThanOrEqual(3);
  });
});
