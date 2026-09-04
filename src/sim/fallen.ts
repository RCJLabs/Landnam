// Reading a run's dead off the state. Pure, so the wall's contents can be
// asserted without a browser.

import type { Fallen } from '../memorial';
import type { GameState } from '../state/types';
import { boreBlade } from './heirloom';

/**
 * Everyone the run buried, oldest death first.
 *
 * Reads the same `fate` and `diedOn` the saga does, so the wall and the
 * chronicle can never disagree about who died of what. Anyone dead without a
 * recorded day is placed at the run's end rather than dropped — a name with a
 * vague date still belongs on a memorial.
 */
export function fallenOf(state: GameState): Fallen[] {
  return state.party.people
    // The wall is for the dead. Somebody who walked out is not dead, and
    // carving them would be a lie about what happened to them.
    .filter((person) => !person.alive && !person.left)
    .map((person) => ({
      name: person.name,
      byname: person.byname,
      fate: person.fate ?? 'was lost',
      day: person.diedOn ?? state.day,
      seed: state.seed,
      // The one thing on this row that can also be on somebody else's. See
      // sim/heirloom.ts — a wall of sixty names where five of them bore the
      // same sword is a wall that says something a list of fates cannot.
      ...(boreBlade(state, person) ? { blade: boreBlade(state, person)! } : {}),
    }))
    .sort((a, b) => a.day - b.day);
}
