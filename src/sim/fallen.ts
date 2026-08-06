// Reading a run's dead off the state. Pure, so the wall's contents can be
// asserted without a browser.

import type { Fallen } from '../memorial';
import type { GameState } from '../state/types';

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
    }))
    .sort((a, b) => a.day - b.day);
}
