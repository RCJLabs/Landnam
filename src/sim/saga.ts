// The saga log. Written in past-tense chronicle voice, as if someone is
// recounting the run years later. Never "You forage" — always "We ate thin."

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

/** Ordinal-ish day phrasing for summary lines. */
export function dayPhrase(day: number): string {
  return `day ${day}`;
}
