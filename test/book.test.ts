// 12.10: the last screen and the book say what the run said.
//
// Three separate faults lived here, and every one of them was invisible to
// the suite because nothing asserted about CONTENT reaching a reader:
//
//   1. `state.end.lines` — the winter verdict, the day the store ran out, why
//      a fed band broke anyway — had exactly one reader in the codebase, the
//      screen-reader live region. A sighted player got a generic closing
//      picked at random from a bank, and a comment in `cards/closing.ts`
//      claimed the lines were "inside it, said in prose".
//   2. The 300-entry cap dropped the oldest blindly. Over 120 sagas to day
//      700, 39% hit it and EVERY one had lost both its landing and its
//      founding; the median such book opened on day 332.
//   3. `chronicle` deduped against the previous entry only, so any line at
//      all in between let a repeat through. 7,936 stutters across 119 of 120
//      sagas — one book wrote "We rested at Ormnes" on days 513, 515, 517,
//      520, 521, 522, 525...
//
// Asserted on `composeSaga`'s text and on `sim/saga.ts` rather than on the
// DOM: there is no jsdom in this toolchain, and a claim about what a player
// reads is better made where the words are chosen than where they are
// appended.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { chronicle, bookEntries } from '../src/sim/saga';
import { composeSaga, sagaText } from '../src/sim/sagagen';
import type { GameState } from '../src/state/types';

const fresh = (seed = 'book'): GameState => structuredClone(newGame(seed));

describe('the ending says what the run said', () => {
  it('puts the run’s own closing lines in the saga, not just a generic one', () => {
    const state = fresh();
    state.day = 210;
    state.end = {
      cause: 'starved',
      title: 'The Stores Gave Out',
      lines: [
        'By day 210 there had been nothing in the store for a long time.',
        'Nobody starved outright.',
      ],
    };
    const saga = composeSaga(state);
    const text = sagaText(saga);
    for (const line of state.end.lines) {
      expect(text, 'a line the run wrote about itself is missing from the ending')
        .toContain(line);
    }
    // And the generic closing is still there — the run's lines are added to
    // the frame, not swapped for it.
    const last = saga.chapters[saga.chapters.length - 1]!;
    expect(last.heading).toBe('The Stores Gave Out');
    expect(
      last.text.length,
      'the closing chapter is only the run lines — the frame was dropped',
    ).toBeGreaterThan(state.end.lines.join(' ').length);
  });

  it('says nothing extra for a run still going', () => {
    const state = fresh();
    state.day = 80;
    expect(() => composeSaga(state)).not.toThrow();
    const last = composeSaga(state).chapters.slice(-1)[0]!;
    expect(last.heading).toBe('And After');
  });
});

describe('the book keeps its own spine', () => {
  /** Fills past the cap with throwaway days, so eviction has to choose. */
  function flood(state: GameState, days: number): void {
    for (let i = 0; i < days; i += 1) {
      state.day += 1;
      chronicle(state, `A day passed, and it was the ${i}th of them.`);
    }
  }

  it('never evicts a landmark, however long the run', () => {
    const state = fresh();
    // The landing is entry one, written by `newGame` and marked.
    expect(state.saga[0]!.keep).toBe(true);
    const landing = state.saga[0]!.text;

    state.day = 10;
    chronicle(state, 'We set the first post and we called the place Steinlund.', 'saga', true);
    flood(state, 900);

    expect(state.saga.length).toBeLessThanOrEqual(300);
    expect(state.saga.map((e) => e.text)).toContain(landing);
    expect(state.saga.some((e) => e.text.includes('first post'))).toBe(true);
  });

  it('still drops the ordinary days — a book of only landmarks is not a book', () => {
    const state = fresh();
    flood(state, 900);
    expect(state.saga.length).toBeLessThanOrEqual(300);
    // The earliest throwaway is gone; the latest is not.
    expect(state.saga.some((e) => e.text.includes('the 0th of them'))).toBe(false);
    expect(state.saga.some((e) => e.text.includes('the 899th of them'))).toBe(true);
  });

  it('gives the book every landmark plus the recent days', () => {
    const state = fresh();
    state.day = 10;
    chronicle(state, 'We set the first post and we called the place Steinlund.', 'saga', true);
    flood(state, 400);

    const shown = bookEntries(state, 20);
    expect(shown.length).toBeGreaterThan(20);
    expect(shown.some((e) => e.text.includes('first post'))).toBe(true);
    expect(shown[0]!.keep).toBe(true);
    // Chronological and without duplicates: a view must not quietly edit
    // somebody's record of their own run.
    expect(shown.map((e) => e.day)).toEqual([...shown.map((e) => e.day)].sort((a, b) => a - b));
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('asks for nothing it cannot give', () => {
    const state = fresh();
    expect(bookEntries(state, 999).length).toBe(state.saga.length);
  });
});

describe('the chronicle does not stutter', () => {
  it('refuses a line it said within the echo, not just the one before', () => {
    const state = fresh();
    const line = 'We rested at Ormnes, and the work went on around us.';
    const before = state.saga.length;
    state.day = 100;
    chronicle(state, line);
    state.day = 101;
    chronicle(state, 'The sky cleared off cold after sunset.');
    state.day = 102;
    // THE EXACT SHAPE OF THE BUG: one line in between was enough to let the
    // repeat through, because the guard looked only at the previous entry.
    chronicle(state, line);
    const written = state.saga.slice(before).filter((e) => e.text === line);
    expect(written.length, 'the rest line was written twice, two entries apart').toBe(1);
  });

  it('says it again once it is genuinely old news', () => {
    const state = fresh();
    const line = 'We rested at Ormnes, and the work went on around us.';
    state.day = 100;
    chronicle(state, line);
    for (let i = 0; i < 6; i += 1) {
      state.day += 1;
      chronicle(state, `Something else happened, number ${i}.`);
    }
    state.day += 1;
    chronicle(state, line);
    expect(state.saga.filter((e) => e.text === line).length).toBe(2);
  });
});
