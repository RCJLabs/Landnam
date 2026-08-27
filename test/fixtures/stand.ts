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
import { ROUTE_STOPS, stopAt } from '../../src/sim/route';
import { key } from '../../src/hex';
import type { GameState, Neighbour, Place, Terrain } from '../../src/state/types';

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

/**
 * Stand somewhere the country is what the test asked for.
 *
 * The hex way to do this is to paint the tile underfoot —
 * `state.world.tiles[key(state.party.at)]!.terrain = 'hills'` — and it stopped
 * working the moment `conditionHolds` learned to read `countryHere`, because
 * on a line the country comes from the STOP and no tile is consulted. A line
 * cannot be painted, only walked to.
 *
 * Returns false when no stretch of this coast is that country, so a caller
 * can walk seeds rather than fail: a coast with no hills on it is a fact
 * about that coast, not a broken fixture.
 */
export function standIn(state: GameState, country: Terrain): boolean {
  if (COAST_IS_A_LINE) {
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      if (stopAt(state.seed, stop).country !== country) continue;
      state.party.stop = stop;
      return true;
    }
    return false;
  }
  const tile = state.world.tiles[key(state.party.at)];
  if (!tile) return false;
  tile.terrain = country;
  return true;
}

/**
 * Step off whatever the band is standing on, far enough that the sim agrees.
 *
 * For the tests whose whole subject is the REFUSAL — "cannot be taken from a
 * hex away", "never from the next hex over". Those wrote
 * `state.party.at = { q: place.at.q + 2, r: place.at.r }`, which on a coast
 * moves nobody, so the refusal they were checking for never came and the
 * test read as the sim having gone permissive.
 */
export function stepOff(state: GameState, from: Somewhere, away = 2): void {
  if (COAST_IS_A_LINE) {
    const at = from.stop ?? 0;
    const to = at + away < ROUTE_STOPS ? at + away : Math.max(0, at - away);
    expect(to, 'this coast is too short to step off anything').not.toBe(at);
    state.party.stop = to;
  } else {
    state.party.at = { q: from.at.q + away, r: from.at.r };
  }
}

/**
 * Step away from the hearth, far enough that the sim agrees you have left.
 *
 * The fourth verb of the same family, and the one that fails most quietly.
 * `state.party.at = { q: home.at.q + 2, r: home.at.r }` moves nobody on a
 * coast — `WALK` moves `party.stop` and never touches `party.at` — so a test
 * that walked out and expected a refusal got a band still standing in its own
 * yard, and the refusal it was checking for never came.
 *
 * Self-checked like the rest: leaving has to be something `atHome` can see.
 */
export function walkOff(state: GameState, steps = 2): void {
  const home = state.settlement;
  expect(home, 'walked away from a steading that does not exist').toBeTruthy();
  if (COAST_IS_A_LINE) {
    const from = home!.stop ?? 0;
    // Toward the far end unless that runs off the coast, then back the way
    // they came. Either is "not home", which is the whole claim.
    const to = from + steps < ROUTE_STOPS ? from + steps : Math.max(0, from - steps);
    expect(to, 'this coast is too short to walk off the steading').not.toBe(from);
    state.party.stop = to;
  } else {
    state.party.at = { q: home!.at.q + steps, r: home!.at.r };
  }
  expect(atHome(state), 'walked away and the sim still says we are home').toBe(false);
}

/** Go back to the hearth. Every errand above ends with this. */
export function goHome(state: GameState): void {
  const home = state.settlement;
  expect(home, 'sent home with no steading to go to').toBeTruthy();
  put(state, home!, 'the steading');
  expect(atHome(state), 'walked home and the sim says we are not there').toBe(true);
}
