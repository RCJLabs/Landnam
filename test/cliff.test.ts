// The first winter, and the one thing the mark could never say.
//
// A phone playtest arrived as a photograph: day 26, no roof, four food of a
// hundred and sixty-two, nought wood of two hundred and seventy-four. The
// panel dutifully reported the gap and never mentioned that no arrangement
// of six people closes it. This file pins the verdict, and — because a
// warning that cannot fire is worse than no warning — proves it fires.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign } from '../src/sim/colony';
import { forecast, reachable, readiness } from '../src/sim/winter';
import { fromKey } from '../src/hex';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

function settled(seed: string, day: number): GameState {
  const state = structuredClone(newGame(seed));
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
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
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
    const state = settled('cliff-doomed', 40);
    state.party.food = 4;
    state.party.firewood = 0;
    const f = forecast(state);
    expect(f.ready).toBe(false);
    expect(reachable(state)).toBe(false);
    // And it SAYS so, in words, with something left to try.
    const line = readiness(state);
    expect(line).toContain('cannot cut or hunt our way');
    expect(line).toMatch(/taking it from somebody else|wintering elsewhere/);
  });

  it('the verdict is about the gap, not the calendar', () => {
    // Same late day, same ground — stores are the only difference, and they
    // flip the answer. Without this, "late" could be a proxy that happens to
    // look right while measuring nothing.
    const doomed = settled('cliff-pivot', 40);
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
