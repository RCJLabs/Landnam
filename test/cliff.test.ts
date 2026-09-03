// The first winter, and the one thing the mark could never say.
//
// A phone playtest arrived as a photograph: day 26, no roof, four food of a
// hundred and sixty-two, nought wood of two hundred and seventy-four. The
// panel dutifully reported the gap and never mentioned that no arrangement
// of six people closes it. This file pins the verdict, and — because a
// warning that cannot fire is worse than no warning — proves it fires.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { assign } from '../src/sim/colony';
import { forecast } from '../src/sim/winter';
import { reachable, readiness } from '../src/sim/reach';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

function settled(seed: string, day: number): GameState {
  // `radius: Infinity` on purpose. Every number in this file was measured on
  // the BEST ground in the world — "a band on the best ground is beyond
  // saving on the eve of winter" is the claim, and it stops meaning that the
  // moment the fixture settles for the best ground within a fortnight's walk.
  const state = settleSomewhere(seed, { radius: Infinity });
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.day = day;
  return state;
}

describe('whether the mark can be met at all', () => {
  it('says yes to a band with the stores already in', () => {
    const state = settled('cliff-rich', 30);
    state.party.food = 900;
    state.party.firewood = 900;
    expect(forecast(state).ready).toBe(true);
    expect(reachable(state)).toBe(true);
  });

  it('says yes to a band that is short but has the season to fix it', () => {
    // Early, empty-handed, everything still ahead of them.
    const state = settled('cliff-early', 10);
    state.party.food = 20;
    state.party.firewood = 20;
    expect(forecast(state).ready).toBe(false);
    expect(reachable(state)).toBe(true);
  });

  it('says no to the photograph: late, roofless and empty', () => {
    // MEASURED ACROSS SEEDS, because one seed was measuring luck.
    //
    // This asked a single band on day 40 and expected `reachable` false. It
    // held on the hex map and failed on a coast, which read as the coast
    // being soft — and it is not. Swept over twelve worlds on the best ground
    // each of them has, food 4 and firewood 0, the two maps have the same
    // cliff in the same place:
    //
    //   day    30      40      50      60
    //   hex    10/12   6/12    1/12    1/12   still savable
    //   coast  12/12   8/12    2/12    1/12
    //
    // Day 40 is late autumn and HALF of both maps can still be saved from
    // it; 'cliff-doomed' just happened to be one of the six the hex map
    // gives up on. The cliff is the turn of winter, and it is there on both.
    // RE-SWEPT AND RESTATED, 2026-09-03, when `walkWinter` stopped picking its
    // food job BY NAME (see sim/reach.ts). That repair cuts the verdict's
    // false-deads from 65 to 50 per 900 seeds and its error from 33% to 28%,
    // so it is a better projection — and a better projection is a kinder one,
    // which moved this reading:
    //
    //   day            30      40      50      60      70
    //   past saving     0/12    0/12    6/12    4/12    5/12
    //
    // (Day 70 lifts because the thaw is three days off and there is barely a
    // winter left to survive — `nextThaw(day) - day` is the walk's length.)
    //
    // The OLD bar was an absolute count: at day 50, at least 9 of 12 doomed.
    // With the corrected projection no day reaches 9, so that number is gone.
    // What has NOT gone is the cliff itself, and it is the claim this file
    // exists for: mid-autumn a band on the best ground is always saveable,
    // and by the eve of winter half of them are not. So the bar is the STEP
    // rather than the level — it fails a projection that has stopped
    // discriminating between the two, which is the defect worth catching, and
    // it no longer pins one arithmetic threshold that a fairer verdict trips.
    const MID = 40;
    const EVE = 50;
    const pastSaving = (day: number) => {
      let saveable = 0;
      for (let i = 0; i < 12; i += 1) {
        const state = settled(`cliff-doomed-${i}`, day);
        state.party.food = 4;
        state.party.firewood = 0;
        expect(forecast(state).ready, `${i}: a band with nothing was called ready`).toBe(false);
        if (reachable(state)) saveable += 1;
      }
      return 12 - saveable;
    };
    const midAutumn = pastSaving(MID);
    const eve = pastSaving(EVE);
    // eslint-disable-next-line no-console
    console.log(`past saving: ${midAutumn}/12 in mid-autumn (day ${MID}), ${eve}/12 on the eve (day ${EVE})`);
    expect(eve, 'the eve of winter is not a cliff at all').toBeGreaterThanOrEqual(4);
    expect(
      eve - midAutumn,
      'mid-autumn and the eve of winter read alike — the verdict has stopped telling them apart',
    ).toBeGreaterThanOrEqual(4);

    // And it SAYS so, in words, with something left to try — asked of a band
    // the verdict has actually given up on.
    const doomed = [...Array(12).keys()]
      .map((i) => {
        const state = settled(`cliff-doomed-${i}`, EVE);
        state.party.food = 4;
        state.party.firewood = 0;
        return state;
      })
      .find((state) => !reachable(state));
    expect(doomed, 'no band on the eve of winter was past saving').toBeDefined();
    const line = readiness(doomed!);
    expect(line).toContain('cannot cut or hunt our way');
    expect(line).toMatch(/taking it from somebody else|wintering elsewhere/);
  });

  it('the verdict is about the gap, not the calendar', () => {
    // Same late day, same ground — stores are the only difference, and they
    // flip the answer. Without this, "late" could be a proxy that happens to
    // look right while measuring nothing.
    //
    // DAY 48, WAS 40, AND THE ASSERTION IS UNTOUCHED. Short commons — the
    // winter lever — means a band can eat 2 a day instead of 3, which frees
    // enough labour that this band on the best ground in the world is no
    // longer beyond saving eight days out from the frost. `reachable` walks
    // the lean case deliberately: a verdict that ignored the lever would go
    // back to condemning bands that could use it, which is the false-
    // condemnation bug the ship-and-weather work spent a session removing.
    //
    // Measured rather than nudged until it passed: the 0/0 band on this
    // ground reads saveable at days 40 and 44 and doomed from 48 onward.
    // The eve of winter is where a band with nothing is out of options, and
    // that is a truer statement of this test's own point than day 40 was.
    const doomed = settled('cliff-pivot', 48);
    doomed.party.food = 0;
    doomed.party.firewood = 0;
    const saved = structuredClone(doomed);
    saved.party.food = 900;
    saved.party.firewood = 900;

    expect(reachable(doomed)).toBe(false);
    expect(reachable(saved)).toBe(true);
  });

  it('a band still on the road is never told it has lost', () => {
    // No posts in the ground means no mark to miss.
    const wandering = structuredClone(newGame('cliff-road'));
    wandering.day = 40;
    wandering.party.food = 0;
    wandering.party.firewood = 0;
    expect(reachable(wandering)).toBe(true);
  });

  it('reads the same field the mark itself reads', () => {
    // The verdict must never contradict the number beside it: if forecast
    // says ready, reachable cannot say lost. Checked across a spread of days
    // and stores rather than at one convenient point.
    for (const day of [20, 30, 40, 50, 60]) {
      for (const store of [0, 40, 200, 900]) {
        const state = settled(`cliff-agree-${day}`, day);
        state.party.food = store;
        state.party.firewood = store;
        if (forecast(state).ready) {
          expect(reachable(state), `day ${day}, store ${store}`).toBe(true);
        }
      }
    }
  });
});
