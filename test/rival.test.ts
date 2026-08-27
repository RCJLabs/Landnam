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
  CLAIM_EVERY_STOPS,
  CLAIM_REACH,
  CLAIM_REACH_STOPS,
  RIVAL_APART,
  RIVAL_APART_STOPS,
  RIVAL_SETTLES,
  rivalBlocks,
  rivalHolds,
  rivalSettled,
  rivalStops,
} from '../src/sim/rival';
import { currentMode } from '../src/modes';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { learnStop } from '../src/sim/coast';
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
  const from = state.day;
  // Guarded by TURNS rather than days, because a battle takes several turns
  // and none of them is a day.
  for (let guard = 0; guard < days * 8 && s.day - from < days && !s.end; guard += 1) {
    // Fed and warm on purpose. These bars are about HIS clock, and a band
    // that starves on day thirty measures the larder instead.
    s.party.food = 400;
    s.party.firewood = 400;
    if (s.event) {
      s = apply(s, s.event.outcome ? { type: 'DISMISS_EVENT' } : { type: 'CHOOSE', index: 0 });
      continue;
    }
    if (s.aftermath) { s = apply(s, { type: 'DISMISS_AFTERMATH' }); continue; }
    // AND IT FIGHTS. Without this the loop met its first raid, found CAMP
    // refused in BATTLE mode, and broke — on BOTH builds. Measured: of twenty
    // seeds only one reached day 150, the rest stopped between day 8 and day
    // 62 with the band alive and a battle on the table. Every number this
    // file has ever printed was taken over however many days happened to pass
    // before somebody came over the hill.
    //
    // It matters because the rival is a CLOCK. A loop that stops early does
    // not measure him slowly, it measures him not at all — and on a coast,
    // where a claim comes every CLAIM_EVERY_STOPS days rather than every
    // CLAIM_EVERY, it read as a rival who had gone inert. He has not: with a
    // loop that can fight he holds a median of 4 stretches by day 200 and 6
    // by day 320, which is exactly what `sim/rival.ts` recorded when the
    // number was chosen.
    if (currentMode(s) === 'BATTLE') {
      if (s.battle?.outcome) { s = apply(s, { type: 'B_LEAVE' }); continue; }
      const foe = s.battle?.combatants.find((c) => c.side === 'foe' && !c.down && !c.fled);
      if (foe) {
        const struck = apply(s, { type: 'B_STRIKE', targetId: foe.personId });
        if (struck !== s) { s = struck; continue; }
      }
      const ended = apply(s, { type: 'B_END_TURN' });
      if (ended === s) break;
      s = ended;
      continue;
    }
    const next = apply(s, { type: 'CAMP' });
    if (next === s) break;
    s = next;
  }
  return s;
}

/** His holdings, in whichever units this world counts them. */
function holdings(state: GameState): number {
  return COAST_IS_A_LINE ? rivalStops(state).length : state.rival!.claims.length;
}

/** How long it takes him to close his hand once, in this world's clock. */
const CLAIM_TICK = COAST_IS_A_LINE ? CLAIM_EVERY_STOPS : CLAIM_EVERY;

describe('there is a second landnam on this island', () => {
  it('lands far enough off that we do not start in his yard', () => {
    for (let i = 0; i < 20; i++) {
      const state = newGame(`rival-apart:${i}`);
      if (!state.rival) continue;
      if (COAST_IS_A_LINE) {
        // Was passing vacuously: `rival.at` is the placeholder (0,0) on a
        // line, so the hex distance measured the landing against a fixed
        // point and happened to clear the bar. RIVAL_APART_STOPS is the real
        // one, and it means what RIVAL_APART meant — far enough that neither
        // his elbow nor his reach touches the sand we were put down on.
        expect(state.rival.stop, `${i}: no address`).not.toBeUndefined();
        expect(state.rival.stop).toBeGreaterThanOrEqual(RIVAL_APART_STOPS);
        continue;
      }
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
    const opening = holdings(state);
    state = idle(state, RIVAL_SETTLES + CLAIM_TICK * 3 + 2);
    if (state.end) throw new Error('the band died before the measurement could run');
    // He does not sit still. This is the whole mechanic: days spent are
    // ground lost, whatever the band spent them on.
    expect(holdings(state)).toBeGreaterThan(opening);
    if (COAST_IS_A_LINE) {
      // `rivalHolds` reads the stretch UNDERFOOT on a line, the way every
      // other "is this ground spoken for" question does — so the band has to
      // be standing on his hall for the question to be about his hall.
      state.party.stop = state.rival!.stop;
      expect(rivalHolds(state, state.party.at)).toBe(true);
      return;
    }
    expect(rivalHolds(state, state.rival!.at)).toBe(true);
  });

  it('keeps his claim in one piece and within reach of the hall', () => {
    let state = newGame('rival-shape');
    state = idle(state, RIVAL_SETTLES + CLAIM_TICK * 4 + 2);
    if (state.end || !state.rival) return;
    if (COAST_IS_A_LINE) {
      // Also passing vacuously: on a line the claims live in `claimStops` and
      // `claims` is empty, so this loop had nothing to walk.
      const stops = rivalStops(state);
      expect(stops.length, 'he holds nothing at all').toBeGreaterThan(0);
      for (const stop of stops) {
        expect(Math.abs(stop - state.rival.stop!)).toBeLessThanOrEqual(CLAIM_REACH_STOPS);
      }
      // A block of coast, not flags scattered along it: every stretch he
      // holds touches another, which is what `nextClaimStop` enforces.
      for (const stop of stops) {
        if (stop === state.rival.stop) continue;
        expect(
          stops.includes(stop - 1) || stops.includes(stop + 1),
          `stretch ${stop} is a flag on its own`,
        ).toBe(true);
      }
      return;
    }
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
    state = idle(state, RIVAL_SETTLES + CLAIM_TICK + 2);
    if (state.end || !state.rival) return;
    if (COAST_IS_A_LINE) {
      // The band has to be STANDING on it: `foundBlocker` asks about the
      // stretch underfoot on a line, where the hex arm asks about a
      // coordinate handed to it.
      const stop = rivalStops(state)[0]!;
      learnStop(state, stop);
      state.party.stop = stop;
      expect(rivalBlocks(state, state.party.at)).toBe(true);
      expect(foundBlocker(state, state.party.at)).toBe('taken');
      return;
    }
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

    // HIS CLOCK, NOT SIXTY DAYS. On a line a claim comes every
    // CLAIM_EVERY_STOPS rather than every CLAIM_EVERY, deliberately — one
    // stretch is 1/26 of the country against the hex map's 1/1139, and
    // `sim/rival.ts` explains at length why a thing worth forty times more
    // should not come forty times as often. Sixty days is three of his hex
    // ticks and one of his coast ticks, so measuring both at sixty measures
    // two different questions and calls the second one a failure.
    const horizon = RIVAL_SETTLES + CLAIM_TICK * 3 + 2;
    const unit = COAST_IS_A_LINE ? 'stretches' : 'hexes';

    for (let s = 0; s < 20; s++) {
      let state = newGame(`rival-cost:${s}`);
      if (!state.rival) continue;
      state = idle(state, horizon);
      if (state.end || !state.rival) continue;
      runs++;
      held += holdings(state);

      // How much of what he now holds would have been legal ground for us on
      // the day we landed.
      if (COAST_IS_A_LINE) {
        for (const stop of rivalStops(state)) {
          learnStop(state, stop);
          state.party.stop = stop;
          if (foundBlocker(state, state.party.at) === 'taken') shutSites++;
        }
        continue;
      }
      for (const k of state.rival.claims) {
        const [q, r] = k.split(',').map(Number);
        const at = { q: q!, r: r! };
        state.world.seen[key(at)] = 'seen';
        if (foundBlocker(state, at) === 'taken') shutSites++;
      }
    }

    console.log(`the other landnam, ${runs} runs, ${horizon} days each:`);
    console.log(`  ground he holds by then   : ${(held / runs).toFixed(1)} ${unit}`);
    console.log(`  of that, ground shut to us: ${(shutSites / runs).toFixed(1)} ${unit}`);

    expect(runs).toBeGreaterThan(5);
    // He has to actually take something, or he is scenery with a name.
    expect(held / runs).toBeGreaterThan(2);
  });
});
