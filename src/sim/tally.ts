// A count of what the band actually did.
//
// Almost everything a saga wants to say can be read back off the state — who
// died and of what, where the steading was, what got built. These are the
// things that cannot: a fight leaves no record once the field is cleared, and
// a bargain leaves only a slightly larger woodpile. So they are counted as
// they happen, and the saga reads the counter rather than guessing.

import type { GameState, Tally } from '../state/types';

export function emptyTally(): Tally {
  return {
    battles: 0,
    battlesWon: 0,
    raids: 0,
    raidsHeld: 0,
    foesFelled: 0,
    expeditions: 0,
    bargains: 0,
    sackings: 0,
    seaDays: 0,
  };
}

/**
 * Adds to one counter. Tolerates an absent tally so that a save carried
 * forward from before 4.5 cannot crash a running fight — it simply starts
 * counting from where it is noticed.
 */
export function note(state: GameState, key: keyof Tally, n = 1): void {
  if (!state.tally) state.tally = emptyTally();
  state.tally[key] += n;
}

export function tallyOf(state: GameState): Tally {
  return state.tally ?? emptyTally();
}
