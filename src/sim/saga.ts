// The saga log. Written in past-tense chronicle voice, as if someone is
// recounting the run years later. Never "You forage" — always "We ate thin."

import type { Rng } from '../rng';
import type { GameState, SagaTone } from '../state/types';

const MAX_ENTRIES = 300;

/** Appends a line. Mutates — callers are already working on a state clone. */
export function chronicle(state: GameState, text: string, tone: SagaTone = 'plain'): void {
  // A chronicle that repeats itself reads like a bug, not a saga.
  if (state.saga[state.saga.length - 1]?.text === text) return;
  state.saga.push({ day: state.day, text, tone });
  if (state.saga.length > MAX_ENTRIES) {
    state.saga.splice(0, state.saga.length - MAX_ENTRIES);
  }
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
