// The saga log. Written in past-tense chronicle voice, as if someone is
// recounting the run years later. Never "You forage" — always "We ate thin."

import type { Rng } from '../rng';
import type { GameState, SagaTone } from '../state/types';

const MAX_ENTRIES = 300;

/** Appends a line. Mutates — callers are already working on a state clone. */
export function chronicle(
  state: GameState,
  text: string,
  tone: SagaTone = 'plain',
  keep = false,
): void {
  // A chronicle that repeats itself reads like a bug, not a saga — and this
  // compared against the PREVIOUS ENTRY ONLY until 12.10, which caught a
  // repeat only when two identical days landed back to back. Anything at all
  // in between let it through: measured over 120 sagas to day 700, 7,936
  // stutters across 119 of them, and one settled saga wrote "We rested at
  // Ormnes, and the work went on around us" on days 513, 515, 517, 520, 521,
  // 522, 525, 527... — a third of that book was one sentence, because a
  // weather line fell between each pair of rest days.
  //
  // ECHO is the window `fresh()` already uses for the same reason, so the two
  // halves of the repeat rule now agree about what "lately" means.
  if (state.saga.slice(-ECHO).some((entry) => entry.text === text)) return;
  state.saga.push(keep ? { day: state.day, text, tone, keep: true } : { day: state.day, text, tone });
  if (state.saga.length > MAX_ENTRIES) evict(state);
}

/**
 * Drops the oldest entries the saga can do without.
 *
 * This was `splice(0, over)` — a blind FIFO, which is exactly right for a
 * day's weather and exactly wrong for the day the posts went in. Kept
 * entries are stepped over; only if there is nothing else left does a kept
 * one go, because a book of nothing but landmarks is not a chronicle either.
 */
function evict(state: GameState): void {
  let over = state.saga.length - MAX_ENTRIES;
  for (let i = 0; i < state.saga.length && over > 0; ) {
    if (state.saga[i]!.keep) { i += 1; continue; }
    state.saga.splice(i, 1);
    over -= 1;
  }
  // Every remaining entry is a landmark and there are still too many. The
  // oldest go, and the run has earned that problem.
  if (over > 0) state.saga.splice(0, over);
}

/**
 * The entries a book should show: every landmark, plus the last `count`.
 *
 * The ending rendered `saga.slice(-160)` and nothing else, so even a saga
 * that KEPT its founding showed a book that opened after it — 42 of the 58
 * runs that founded, and 8 of the 9 that were proclaimed. Chronological, no
 * duplicates, and it never invents or reorders a line: a view must not
 * quietly edit somebody's record of their own run.
 */
export function bookEntries(state: GameState, count: number) {
  const tail = Math.max(0, state.saga.length - count);
  return state.saga.filter((entry, i) => i >= tail || entry.keep === true);
}

export function recentSaga(state: GameState, count: number) {
  return state.saga.slice(-count);
}

/** How many entries back the chronicle remembers saying a thing. */
const ECHO = 4;

/**
 * Picks a line the chronicle has not used lately.
 *
 * Picking blind from a pool of four repeats inside three days about half the
 * time, and a quiet stretch of travel is exactly when the log is the only
 * thing moving on screen — so the repeat reads as a stutter in the writing
 * rather than as a quiet week. Falls back to the whole pool once everything
 * in it is recent, because a repeat beats saying nothing.
 */
export function fresh(state: GameState, rng: Rng, pool: string[]): string {
  const recent = new Set(state.saga.slice(-ECHO).map((entry) => entry.text));
  const unused = pool.filter((line) => !recent.has(line));
  return rng.pick(unused.length > 0 ? unused : pool);
}

/** Ordinal-ish day phrasing for summary lines. */
export function dayPhrase(day: number): string {
  return `day ${day}`;
}
