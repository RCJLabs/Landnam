// Copying a GameState, which the sim does on every single action.
//
// `apply` is `(state, action) => state` and never mutates its input, which is
// the rule that makes the whole thing testable, replayable and portable.
//
// This file used to be the place that rule was paid for. `structuredClone`
// copied the entire world every turn, and the world was 78 kB of terrain
// generated once at worldgen and never written again — measured 2026-08-11 at
// 2.2 ms an action for the whole state against 0.045 ms for everything except
// the world, so ninety-eight percent of the cost of a turn was duplicating
// ground that could not change, on a game whose primary target is a phone.
// The fix was to SHARE the tiles between a state and its copy, with the
// record frozen so a careless write announced itself at the line that did it.
//
// 8.5 deleted the ground. A coast is derived from `(seed, stop)` and a whole
// save is 3.2 kB, so there is nothing left to share and nothing left to
// freeze: the ninety-eight percent went with the island rather than being
// optimised away. What remains is the plain copy the rule always asked for.
//
// If a future feature gives the coast writable ground, this is where the
// question comes back — and the answer is another play-state record beside
// `trodStops` and `knownStops`, not a shared mutable one.

import type { GameState } from './types';

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}
