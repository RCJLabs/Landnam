// 12.6: what the founding card is entitled to tell a player.
//
// The item asked for the card to carry the TIME. It does not, and the reason
// is three readings rather than a judgement — they are written out in full at
// `FOUND_RECORD_FROM` in sim/site.ts. What it carries instead is the one thing
// about this decision that IS resolvable and that the card's own words argue
// against, and these tests are about keeping it inside its evidence.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import {
  FOUNDING_RECORD,
  FOUND_RECORD_FROM,
  FOUND_RECORD_TO,
  foundingRecord,
  reportHere,
  verdictFor,
} from '../src/sim/site';
import { learnStop } from '../src/sim/coast';
import { ROUTE_STOPS } from '../src/sim/route';
import type { GameState } from '../src/state/types';

/** Stand the band on the first stretch whose total falls in `[from, to)`. */
function standingOn(from: number, to: number): GameState | null {
  for (let s = 0; s < 40; s += 1) {
    const state = newGame(`found-${s}`, 'even');
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      learnStop(state, stop);
      state.party.stop = stop;
      const total = reportHere(state).total;
      if (total >= from && total < to) return state;
    }
  }
  return null;
}

describe('the founding record', () => {
  it('speaks on the ground it was measured on', () => {
    const state = standingOn(FOUND_RECORD_FROM, FOUND_RECORD_TO);
    expect(state, 'no stretch in forty worlds fell inside the window').not.toBeNull();
    expect(foundingRecord(state!)).toBe(FOUNDING_RECORD);
  });

  it('says nothing on ground below the window, where neither arm ever settled', () => {
    const state = standingOn(0, FOUND_RECORD_FROM);
    expect(state, 'no stretch in forty worlds fell below the window').not.toBeNull();
    expect(foundingRecord(state!)).toBeUndefined();
  });

  it('says nothing on ground above it, where there was no decision to price', () => {
    const state = standingOn(FOUND_RECORD_TO, 99);
    expect(state, 'no stretch in forty worlds fell above the window').not.toBeNull();
    expect(foundingRecord(state!)).toBeUndefined();
  });

  it('is a record and not an instruction', () => {
    // The rule `RAID_RECORD`, `VOYAGE_RECORD` and `ABANDON_RECORD` all keep.
    // The game does not tell the player what to do anywhere else, and a band
    // that wants better ground is entitled to go and look for it.
    // Matched on SECOND PERSON rather than on a word list, which is what
    // `retreat.test.ts` uses and what the first cut of this copied: its
    // `\bnever\b` fired on "never raised a steading at all", a descriptive
    // clause in the record's own findings. Instruction is addressing the
    // player, so that is what this looks for.
    expect(FOUNDING_RECORD, 'the record addresses the player').not.toMatch(/\byou(r|rs)?\b/i);
    expect(FOUNDING_RECORD).not.toMatch(/\bshould\b|\bmust\b|\bdon't\b/i);
    // And it has to carry the half that argues the other way, or it is an
    // advertisement — the fault 9.7 found on the rations panel.
    expect(FOUNDING_RECORD).toMatch(/walked on/);
  });

  it('covers exactly the totals the two arms disagreed about', () => {
    // The window is not a taste. One arm took ground from a total of 12 and
    // the other held out for 14, so 12 and 13 are the only totals where they
    // ever chose differently. Pinned to literals so a later widening has to
    // be a decision somebody took rather than a drift.
    expect(FOUND_RECORD_FROM).toBe(12);
    expect(FOUND_RECORD_TO).toBe(14);
    // And the window sits inside one verdict word, so the record and the
    // label above it are talking about the same ground.
    expect(verdictFor(FOUND_RECORD_FROM).label).toBe('Hard ground');
    expect(verdictFor(FOUND_RECORD_TO - 1).label).toBe('Hard ground');
    expect(verdictFor(FOUND_RECORD_TO).label).not.toBe('Hard ground');
  });
});
