// What the ending screen says killed a band that has nobody left.
//
// 10.4, 2026-09-01. The wipe-out ending used to be decided by two `some()`
// calls in priority order -- ONE person who ever died of hunger, in any winter
// of the saga, named the whole ending `starved`, and `slain` could only fire
// for a band where nobody had ever starved or frozen. Measured over 200
// landings, deaths on the field are 39% of the settler's dead and 47% of the
// raider's, while `slain` ended 3 sagas in 120. The ending was not rare; it
// was misassigned by that line.
//
// These are written against the SHAPE of the bug, not against today's counts:
// each one puts a clear plurality on the table and asks for its name.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { passDay } from '../src/sim/upkeep';
import { DEATHS } from '../src/data/injuries';
import type { GameState } from '../src/state/types';

/** Kill the whole band, giving each named fate to that many of them. */
function wipeOut(state: GameState, fates: string[]): GameState {
  state.party.people.forEach((p, i) => {
    p.alive = false;
    p.left = false;
    p.fate = fates[i % fates.length];
    p.diedOn = state.day;
  });
  passDay(state);
  return state;
}

describe('the ending names what actually killed the band', () => {
  it('says slain when the field took most of them, even though one starved', () => {
    // The exact shape of the old bug: a single hunger death among five who
    // fell on the field. The old code read `some(fate === 'hunger')` first
    // and called this `starved`.
    const s = newGame('ending-slain');
    wipeOut(s, [DEATHS[0]!, DEATHS[1]!, DEATHS[2]!, DEATHS[3]!, DEATHS[4]!, 'hunger']);
    expect(s.end?.cause).toBe('slain');
  });

  it('still says starved when hunger really did take most of them', () => {
    const s = newGame('ending-starved');
    wipeOut(s, ['hunger', 'hunger', 'hunger', 'hunger', DEATHS[0]!, 'the cold']);
    expect(s.end?.cause).toBe('starved');
  });

  it('says frozen when the cold took most of them', () => {
    const s = newGame('ending-frozen');
    wipeOut(s, ['the cold', 'the cold', 'the cold', 'the cold', 'hunger', DEATHS[0]!]);
    expect(s.end?.cause).toBe('frozen');
  });

  it('counts short commons as hunger, because it is', () => {
    const s = newGame('ending-commons');
    wipeOut(s, ['short commons', 'short commons', 'short commons', DEATHS[0]!, DEATHS[1]!, 'the cold']);
    expect(s.end?.cause).toBe('starved');
  });

  it('names an ending even when nobody died of anything it can say', () => {
    // Carried off, or lost to the land. The vocabulary has no word for it and
    // the old code said `slain` here too, so this pins the fallback rather
    // than inventing a new ending.
    const s = newGame('ending-none');
    wipeOut(s, ['was carried off when the steading was sacked']);
    expect(s.end?.cause).toBe('slain');
  });
});
