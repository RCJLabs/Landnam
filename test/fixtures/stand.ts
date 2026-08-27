// Putting the band where something is — once, for every test that needs it.
//
// The companion to `settled`, and it comes from the same measurement. With
// `COAST_IS_A_LINE` on, `neighbours.test.ts` alone fails 24 times, and almost
// every one of them is `expected null not to be null`: a verb refusing because
// the band is not where the test believes it put them. The line that put them
// there is `state.party.at = { ...n.at }`, written out 31 times across seven
// files.
//
// The SIM has no such problem. `standingIn`, `standingOn` and `atHome` each
// branch on the flag and have done since 8.2c — a neighbour has a `stop`, a
// place has a `stop`, a steading has a `stop`. What was never converted is
// the tests' half of the same idea: not "where am I" but "put me there".
//
// So these are the inverses of those three predicates, and each one CHECKS
// ITSELF against the predicate it inverts before returning. That is the whole
// design. A fixture that silently puts the band in the wrong place does not
// fail here; it fails four lines later inside the verb under test, as a null
// with no explanation — which is exactly the shape of the 24 failures above,
// and it cost an afternoon to read the first time.

import { expect } from 'vitest';
import { standingIn } from '../../src/sim/neighbours';
import { atHome } from '../../src/sim/site';
import { placeHere } from '../../src/sim/places';
import { COAST_IS_A_LINE } from '../../src/sim/flags';
import type { GameState, Neighbour, Place } from '../../src/state/types';

/** Anything the band can go and stand at: it has a hex and, on a line, a stop. */
interface Somewhere {
  at: { q: number; r: number };
  stop?: number;
}

/**
 * The move itself, without the checking. Private, because every caller should
 * be going through one of the three named verbs below and getting the check.
 */
function put(state: GameState, target: Somewhere, what: string): void {
  if (COAST_IS_A_LINE) {
    expect(target.stop, `${what} is not on the coast — it has no stop`).not.toBeUndefined();
    state.party.stop = target.stop;
    return;
  }
  state.party.at = { ...target.at };
}

/** Stand in this neighbour's yard, where falling on them and bartering work. */
export function standBeside(state: GameState, n: Neighbour): void {
  put(state, n, n.name);
  expect(standingIn(state, n), `stood beside ${n.name} and the sim disagrees`).toBe(true);
}

/** Stand on this place, where sacking and visiting work. */
export function standOn(state: GameState, place: Place): void {
  // Named by kind and id: a `Place` carries no name of its own — the prose
  // name a player sees is generated where it is shown.
  const what = `${place.kind} ${place.id}`;
  put(state, place, what);
  expect(placeHere(state)?.id, `stood on ${what} and the sim disagrees`).toBe(place.id);
}

/** Go back to the hearth. Every errand above ends with this. */
export function goHome(state: GameState): void {
  const home = state.settlement;
  expect(home, 'sent home with no steading to go to').toBeTruthy();
  put(state, home!, 'the steading');
  expect(atHome(state), 'walked home and the sim says we are not there').toBe(true);
}
