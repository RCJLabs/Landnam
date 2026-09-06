// The first state of a run, in one place.
//
// `startRun` in main.ts built this inline: decode what was typed, fall back
// to a fresh seed phrase, take the terms off the challenge if it carried
// them, plant the mark and the ghost. Lifted here for 12.12, because a
// RECORDING has to be able to reproduce the state its actions were taken
// against, and a second copy of these six lines is a second copy that can
// drift from the one the game actually opens with.
//
// Deliberately not `newGame` itself: `newGame` is the world, and this is the
// world plus whatever somebody else's saga brought to it.

import { decodeChallenge } from './sim/challenge';
import { haunt } from './sim/haunt';
import { makeSeedPhrase } from './rng';
import { newGame } from './state/create';
import type { HardshipId } from './data/hardship';
import type { GameState } from './state/types';

/** What a run opened with: what was typed, and the terms it was played on. */
export interface Opening {
  /** The seed phrase or challenge code the player entered. May be empty. */
  entry: string;
  /** The terms chosen at the title, ignored when the entry carries its own. */
  hardship: HardshipId;
}

/**
 * Opens a run.
 *
 * `now` is the clock only an empty entry needs — a fresh seed phrase. Passed
 * in rather than read, so a recording that was opened with an empty entry
 * still replays: the phrase it actually got is written into the recording and
 * handed back here.
 */
export function openRun(entry: string, hardship: HardshipId, now: number): GameState {
  const challenge = decodeChallenge(entry);
  const seed = challenge
    ? challenge.seed || makeSeedPhrase(now)
    : entry || makeSeedPhrase(now);
  const state = newGame(seed, challenge ? challenge.hardship : hardship);
  if (challenge?.mark) state.chasing = challenge.mark;
  // Never fatal: a ghost naming ground this world put under the sea simply is
  // not there.
  if (challenge?.ghost) haunt(state, challenge.ghost);
  return state;
}
