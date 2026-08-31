// The other boat.
//
// Every clock in this game belonged to the weather. The land waited politely
// while the band made up its mind, so "take your time and find good ground"
// had no cost but the season. These bars hold the one thing that makes a
// rival a rival: the good land runs out while you are deciding.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { foundBlocker } from '../src/sim/site';
import { hasBeck } from '../src/sim/site';
import {
  CLAIM_EVERY,
  CLAIM_EVERY_STOPS,
  CLAIM_REACH_STOPS,
  RIVAL_APART_STOPS,
  RIVAL_SETTLES,
  rivalBlocks,
  rivalHolds,
  rivalSettled,
  rivalStops,
  meetRival,
} from '../src/sim/rival';
import { currentMode } from '../src/modes';
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
  return rivalStops(state).length;
}

/** How long it takes him to close his hand once, in this world's clock. */
const CLAIM_TICK = CLAIM_EVERY_STOPS;

describe('there is a second landnam on this island', () => {
  it('lands far enough off that we do not start in his yard', () => {
    for (let i = 0; i < 20; i++) {
      const state = newGame(`rival-apart:${i}`);
      if (!state.rival) continue;
      // Was passing vacuously: `rival.at` is the placeholder (0,0) on a
      // line, so the hex distance measured the landing against a fixed
      // point and happened to clear the bar. RIVAL_APART_STOPS is the real
      // one, and it means what RIVAL_APART meant — far enough that neither
      // his elbow nor his reach touches the sand we were put down on.
      expect(state.rival.stop, `${i}: no address`).not.toBeUndefined();
      expect(state.rival.stop).toBeGreaterThanOrEqual(RIVAL_APART_STOPS);
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
    // `rivalHolds` reads the stretch UNDERFOOT on a line, the way every
    // other "is this ground spoken for" question does — so the band has to
    // be standing on his hall for the question to be about his hall.
    state.party.stop = state.rival!.stop;
    expect(rivalHolds(state)).toBe(true);
  });

  it('keeps his claim in one piece and within reach of the hall', () => {
    let state = newGame('rival-shape');
    state = idle(state, RIVAL_SETTLES + CLAIM_TICK * 4 + 2);
    if (state.end || !state.rival) return;
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
  });
});

describe('coming in sight of him', () => {
  /**
   * 9.10. The saga names the day sight first fell on his hall, and it can only
   * do that because `meetRival` writes it down.
   *
   * THROUGH `meetRival`, not by setting the field. The sagagen tests build
   * their rival by hand, so deleting the one line that records the day failed
   * NOTHING there — a test of a field is not a test of the code that fills it.
   * Second time this session that fault has been caught by sabotage.
   */
  it('writes down the day, and only the first day', () => {
    const state = newGame('rival-metday');
    const rival = state.rival!;
    expect(rival.met).toBe(false);
    expect(rival.metOn, 'a fresh rival already carries a day').toBeUndefined();

    // Standing anywhere else must not count as meeting him.
    state.party.stop = (rival.stop ?? 0) + 4;
    state.day = 30;
    meetRival(state);
    expect(rival.met, 'he was met from four stretches away').toBe(false);
    expect(rival.metOn).toBeUndefined();

    // In sight of the hall.
    state.party.stop = rival.stop;
    state.day = 45;
    meetRival(state);
    expect(rival.met).toBe(true);
    expect(rival.metOn, 'the day sight fell on him was not recorded').toBe(45);

    // And it is the FIRST sight, not the latest — walking past again on a
    // later day must not rewrite the saga's date.
    state.day = 200;
    meetRival(state);
    expect(rival.metOn, 'a later visit overwrote the first sight').toBe(45);
  });
});

describe('his ground is not ours to take', () => {
  it('refuses the posts on land he holds, and says who', () => {
    let state = newGame('rival-block');
    state = idle(state, RIVAL_SETTLES + CLAIM_TICK + 2);
    if (state.end || !state.rival) return;
    // The band has to be STANDING on it: `foundBlocker` asks about the
    // stretch underfoot on a line, where the hex arm asks about a
    // coordinate handed to it.
    //
    // And it has to be a stretch that would OTHERWISE take posts. Since
    // fresh water became the settling gate, `foundBlocker` answers 'dry'
    // before it answers 'taken' — the hex map's own order — so a claimed
    // stretch with no beck reports the water rather than the man, and this
    // bar would be holding the wrong refusal. He does not always fence a
    // watered stretch, so seeds are walked until he does.
    for (let s = 0; s < 40; s += 1) {
      let world = newGame(`rival-block-${s}`);
      world = idle(world, RIVAL_SETTLES + CLAIM_TICK + 2);
      if (world.end || !world.rival) continue;
      const wet = rivalStops(world).find((stop) => hasBeck(world.seed, stop));
      if (wet === undefined) continue;
      learnStop(world, wet);
      world.party.stop = wet;
      expect(rivalBlocks(world)).toBe(true);
      expect(foundBlocker(world)).toBe('taken');
      return;
    }
    throw new Error('no rival in forty coasts fenced ground with water on it');
  });

  it('claims nothing on top of a steading that is already standing', () => {
    // A claim is a hand closing on empty land. It is not a way to take a
    // hall somebody is living in — that is what a raid is for.
    let state = newGame('rival-respect');
    state = idle(state, RIVAL_SETTLES + CLAIM_EVERY * 5 + 2);
    if (state.end || !state.rival || !state.settlement) return;
    // Stand on our own hall: he must not have fenced the ground under it.
    state.party.stop = state.settlement.stop ?? 0;
    expect(rivalHolds(state)).toBe(false);
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
    const unit = 'stretches';

    for (let s = 0; s < 20; s++) {
      let state = newGame(`rival-cost:${s}`);
      if (!state.rival) continue;
      state = idle(state, horizon);
      if (state.end || !state.rival) continue;
      runs++;
      held += holdings(state);

      // How much of what he now holds would have been legal ground for us on
      // the day we landed.
      for (const stop of rivalStops(state)) {
        learnStop(state, stop);
        state.party.stop = stop;
        if (foundBlocker(state) === 'taken') shutSites++;
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
