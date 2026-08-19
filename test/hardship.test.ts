// How hard the country is.
//
// The measured spread lives in test/balance.test.ts, where the sixty-seed
// harness runs every setting. This file pins the mechanism: that each knob
// reaches the thing it names, that the terms ride on the RUN rather than on
// the device, and that old saves come forward on the terms they were played.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { BALANCED_HARDSHIP, DEFAULT_HARDSHIP, HARDSHIPS, hardshipById, measuredLine } from '../src/data/hardship';
import { eventChance } from '../src/sim/events';
import { raidOdds } from '../src/sim/raid';
import { firewoodPerNight } from '../src/sim/upkeep';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { startBattle } from '../src/sim/battleTurn';
import { edge } from '../src/sim/battleActions';
import { fromKey } from '../src/hex';
import type { GameState, HardshipId } from '../src/state/types';

function settled(seed: string, hardship: HardshipId): GameState {
  const state = structuredClone(newGame(seed, hardship));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > bestScore) {
      bestScore = report.total;
      best = at;
    }
  }
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.settlement!.foundedOn = 1;
  state.day = 60; // deep winter, where the fire costs most
  state.party.food = 200;
  return state;
}

describe('the three countries', () => {
  it('every setting is whole, and the middle one changes nothing', () => {
    expect(HARDSHIPS).toHaveLength(3);
    for (const terms of HARDSHIPS) {
      expect(terms.name.length).toBeGreaterThan(3);
      expect(terms.blurb.length).toBeGreaterThan(40);
      // The generated sentence, not a hand-typed one. The odds themselves
      // are barred against the harness in test/balance.test.ts; this is the
      // prose being well-formed for every setting.
      expect(measuredLine(terms).length).toBeGreaterThan(10);
      expect(terms.odds.spring).toBeGreaterThan(0);
      expect(terms.odds.spring).toBeLessThanOrEqual(1);
      for (const knob of [terms.stir, terms.raid, terms.winter, terms.stores]) {
        expect(knob).toBeGreaterThan(0);
      }
    }
    // 'even' must be exactly the game every other number was balanced
    // against, or every measurement in this repo silently moves. It is no
    // longer the setting a new player GETS — that is DEFAULT_HARDSHIP, and
    // the two are deliberately different things.
    const even = hardshipById('even');
    expect(even.id).toBe(BALANCED_HARDSHIP);
    expect([even.stir, even.raid, even.winter, even.stores]).toEqual([1, 1, 1, 1]);
    // `steel` is additive where the rest are multipliers, so its neutral
    // value is nought rather than one — and it has to BE neutral here, or
    // every fight in the battle suite silently moves. See the note at the
    // head of src/data/hardship.ts: that zero is the entire licence for
    // letting a difficulty reach into combat at all.
    expect(even.steel).toBe(0);
    expect(HARDSHIPS.some((h) => h.id === DEFAULT_HARDSHIP)).toBe(true);
  });

  it('an unknown or missing id reads as the balanced middle', () => {
    expect(hardshipById(undefined).id).toBe('even');
    expect(hardshipById('nonsense').id).toBe('even');
  });
});

describe('every knob reaches the thing it names', () => {
  // This project's oldest bug is an escalation routed through a knob that a
  // clamp downstream throws away. Each of these compares the same seed on
  // two settings and asserts the number the player actually meets.

  it('the hold off the knarr', () => {
    const fair = newGame('knob-stores', 'fair');
    const hard = newGame('knob-stores', 'hard');
    expect(fair.party.food).toBeGreaterThan(hard.party.food);
    expect(fair.party.firewood).toBeGreaterThan(hard.party.firewood);
  });

  it('what finds you on the road', () => {
    const fair = newGame('knob-stir', 'fair');
    const hard = newGame('knob-stir', 'hard');
    fair.day = 30;
    hard.day = 30;
    expect(eventChance(hard)).toBeGreaterThan(eventChance(fair));
  });

  it('what the fire costs in deep winter', () => {
    const fair = settled('knob-winter', 'fair');
    const hard = settled('knob-winter', 'hard');
    expect(firewoodPerNight(hard)).toBeGreaterThan(firewoodPerNight(fair));
  });

  it('how often they come for the steading', () => {
    const fair = settled('knob-raid', 'fair');
    const hard = settled('knob-raid', 'hard');
    for (const s of [fair, hard]) {
      s.settlement!.built.push('longhouse', 'meadhall');
      s.neighbours.forEach((n) => {
        n.found = true;
        n.standing = -80;
      });
    }
    expect(raidOdds(fair)).toBeGreaterThan(0);
    expect(raidOdds(hard)).toBeGreaterThan(raidOdds(fair));
  });

  /**
   * The newest knob, and the one this file's header used to say would never
   * exist. Hardship touched `stir`, `raid`, `winter` and `stores` and
   * nothing about a fight, so A Fair Country made fights RARER and left
   * every blow exactly as hard to land as A Hard Country did — a player who
   * reached for the gentlest setting because the fighting was going badly
   * was handed no help at all with the fighting.
   */
  it('what the country is worth on the dice of a fight', () => {
    const ours = (id: HardshipId): number => {
      const state = structuredClone(newGame('knob-steel', id));
      startBattle(state, 'meadow', 0);
      const us = state.battle!.combatants.find((c) => c.side === 'warband')!;
      const them = state.battle!.combatants.find((c) => c.side === 'foe')!;
      // The spread across the field, which is what a player actually feels:
      // the knob is added to our swings and taken off theirs.
      return edge(state, us) - edge(state, them);
    };
    expect(ours('fair')).toBeGreaterThan(ours('even'));
    expect(ours('even')).toBeGreaterThan(ours('hard'));
    expect(ours('even')).toBe(0);
  });
});

describe('the terms belong to the run', () => {
  it('a new landing stamps them, and they survive a save', () => {
    const state = newGame('terms-save', 'hard');
    expect(state.hardship).toBe('hard');
    const round = JSON.parse(encode(state)) as GameState;
    expect(round.hardship).toBe('hard');
  });

  it('an older save comes forward on the terms it was played', () => {
    const old = JSON.parse(encode(newGame('terms-old'))) as Record<string, unknown>;
    old['version'] = 24;
    delete old['hardship'];
    const { save } = migrate(old);
    expect(save['version']).toBe(SAVE_VERSION);
    // Everything before this setting existed was played on the balanced
    // middle, so that is the honest thing to bring it forward as.
    expect(save['hardship']).toBe('even');
  });

  it('a save that already names its country keeps it', () => {
    const old = JSON.parse(encode(newGame('terms-keep', 'fair'))) as Record<string, unknown>;
    old['version'] = 24;
    const { save } = migrate(old);
    expect(save['hardship']).toBe('fair');
  });
});
