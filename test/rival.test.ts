// The other boat.
//
// Every clock in this game belonged to the weather. The land waited politely
// while the band made up its mind, so "take your time and find good ground"
// had no cost but the season. These bars hold the one thing that makes a
// rival a rival: the good land runs out while you are deciding.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { key, distance } from '../src/hex';
import { apply } from '../src/sim/actions';
import { foundBlocker } from '../src/sim/site';
import {
  CLAIM_EVERY,
  CLAIM_REACH,
  RIVAL_APART,
  RIVAL_SETTLES,
  rivalBlocks,
  rivalHolds,
  rivalSettled,
} from '../src/sim/rival';
import type { GameState } from '../src/state/types';

/**
 * Spend days without steering the band, so only their clock is running.
 *
 * Cards have to be answered or the day never turns — an earlier cut of this
 * helper camped into a waiting event and stalled on day 4, which made the
 * rival look as though he never moved.
 */
function idle(state: GameState, days: number): GameState {
  let s = state;
  for (let i = 0; i < days && !s.end; i++) {
    // Fed and warm on purpose. These bars are about HIS clock, and a band
    // that starves on day thirty measures the larder instead.
    s.party.food = 400;
    s.party.firewood = 400;
    if (s.event) {
      s = apply(s, s.event.outcome ? { type: 'DISMISS_EVENT' } : { type: 'CHOOSE', index: 0 });
      continue;
    }
    const next = apply(s, { type: 'CAMP' });
    if (next === s) break;
    s = next;
  }
  return s;
}

describe('there is a second landnam on this island', () => {
  it('lands far enough off that we do not start in his yard', () => {
    for (let i = 0; i < 20; i++) {
      const state = newGame(`rival-apart:${i}`);
      if (!state.rival) continue;
      expect(distance(state.rival.at, state.world.landing)).toBeGreaterThanOrEqual(RIVAL_APART);
    }
  });

  it('is a rumour until his posts go in', () => {
    const state = newGame('rival-clock');
    expect(state.rival).toBeDefined();
    expect(rivalSettled(state)).toBe(false);
    const later = idle(state, RIVAL_SETTLES + 1);
    expect(rivalSettled(later)).toBe(true);
  });

  it('holds his hall and takes more ground as the days pass', () => {
    let state = newGame('rival-spread');
    expect(state.rival).toBeDefined();
    const opening = state.rival!.claims.length;
    state = idle(state, RIVAL_SETTLES + CLAIM_EVERY * 3 + 2);
    if (state.end) throw new Error('the band died before the measurement could run');
    // He does not sit still. This is the whole mechanic: days spent are
    // ground lost, whatever the band spent them on.
    expect(state.rival!.claims.length).toBeGreaterThan(opening);
    expect(rivalHolds(state, state.rival!.at)).toBe(true);
  });

  it('keeps his claim in one piece and within reach of the hall', () => {
    let state = newGame('rival-shape');
    state = idle(state, RIVAL_SETTLES + CLAIM_EVERY * 4 + 2);
    if (state.end || !state.rival) return;
    for (const k of state.rival.claims) {
      const [q, r] = k.split(',').map(Number);
      // A blot on the map, not flags scattered over the island.
      expect(distance({ q: q!, r: r! }, state.rival.at)).toBeLessThanOrEqual(CLAIM_REACH);
    }
  });
});

describe('his ground is not ours to take', () => {
  it('refuses the posts on land he holds, and says who', () => {
    let state = newGame('rival-block');
    state = idle(state, RIVAL_SETTLES + CLAIM_EVERY + 2);
    if (state.end || !state.rival) return;
    const held = state.rival.claims[0]!;
    const [q, r] = held.split(',').map(Number);
    const at = { q: q!, r: r! };
    expect(rivalBlocks(state, at)).toBe(true);
    // Make the ground known, so the refusal is about HIM and not about fog.
    state.world.seen[key(at)] = 'seen';
    expect(foundBlocker(state, at)).toBe('taken');
  });

  it('claims nothing on top of a steading that is already standing', () => {
    // A claim is a hand closing on empty land. It is not a way to take a
    // hall somebody is living in — that is what a raid is for.
    let state = newGame('rival-respect');
    state = idle(state, RIVAL_SETTLES + CLAIM_EVERY * 5 + 2);
    if (state.end || !state.rival || !state.settlement) return;
    expect(rivalHolds(state, state.settlement.at)).toBe(false);
  });
});

describe('what the second landnam actually costs', () => {
  it('measures how much ground is gone by the time a slow band decides', () => {
    // The claim being priced: dawdling has a cost that is not the weather's.
    // Measured as ground he holds, and as sites the band could have taken on
    // day one that are shut by the time it gets around to them.
    let held = 0;
    let shutSites = 0;
    let runs = 0;

    for (let s = 0; s < 20; s++) {
      let state = newGame(`rival-cost:${s}`);
      if (!state.rival) continue;
      state = idle(state, 60);
      if (state.end || !state.rival) continue;
      runs++;
      held += state.rival.claims.length;

      // How many of the hexes he now holds would have been legal ground for
      // us on the day we landed.
      for (const k of state.rival.claims) {
        const [q, r] = k.split(',').map(Number);
        const at = { q: q!, r: r! };
        state.world.seen[key(at)] = 'seen';
        if (foundBlocker(state, at) === 'taken') shutSites++;
      }
    }

    console.log(`the other landnam, ${runs} runs, sixty days each:`);
    console.log(`  ground he holds by day 60 : ${(held / runs).toFixed(1)} hexes`);
    console.log(`  of that, ground shut to us: ${(shutSites / runs).toFixed(1)} hexes`);

    expect(runs).toBeGreaterThan(5);
    // He has to actually take something, or he is scenery with a name.
    expect(held / runs).toBeGreaterThan(2);
  });
});
