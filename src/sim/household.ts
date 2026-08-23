// Households, made on this coast rather than brought to it.
//
// `bindKin` runs ONCE, in `makeWarband`, and nothing in the game has ever
// made a tie since. So a woman whose husband went under the ice on day forty
// spent the next four years alone in a hall of six people, and every child
// she bore afterwards was recorded with no father — not because the game had
// decided anything about her, but because the only code that could bind two
// people had already run before the run began.
//
// WHAT THIS IS NOT. The queue item asked for children who grow into working
// hands. That cannot be built and the arithmetic is not close: a run ends at
// `LONG_LIFE_WINTERS`, measured at day 457 — four years and ten months,
// jarldom or no jarldom — and `GENERATION` is sixteen years, 1536 days. A
// child born in the first hour of a saga is four when it closes. Growing one
// up would mean moving the end of the run, which would move every balance
// curve this project has measured, and that is a decision about what the game
// IS rather than a feature to be slipped in behind one.
//
// So this is the half that fits inside five winters: the hall makes new
// households, and it passes to somebody when the leader falls.

import { stream } from '../rng';
import { PEER_TIES } from '../data/kin';
import type { GameState, Person } from '../state/types';
import { isWoman } from './kin';
import { living, leaderOf } from './people';
import { childrenOf } from './lineage';
import { chronicle } from './saga';
import { houseAtPeace } from './thing';
import { YEAR_LENGTH } from './calendar';

/** Nobody younger pairs off. The same floor bearing uses. */
export const PAIR_MIN_AGE = 16;

/** The chance on any day the hall is at peace and two people are free. */
export const PAIR_ODDS = 0.006;

/** Days after a household is made before another can be. */
export const PAIR_COOLDOWN = YEAR_LENGTH;

/** Heart it puts into a band that has been burying people. */
export const PAIR_HEART = 10;

/** Everyone grown, alive, and bound to nobody. */
export function unattached(state: GameState): Person[] {
  return living(state.party.people).filter(
    (p) => !p.kin && p.age >= PAIR_MIN_AGE,
  );
}

export type PairBlock = 'nosteading' | 'nobody' | 'feud' | 'toosoon';

/**
 * Why no household is being made, or null when one could be.
 *
 * A blocker rather than a boolean, for the reason `birthBlocker` gives: each
 * of these is a thing the player did or did not do.
 */
export function pairBlocker(state: GameState): PairBlock | null {
  // A hall, not a camp. Two people on the road with everything they own on
  // their backs are not setting up a household.
  if (!state.settlement) return 'nosteading';
  if (!houseAtPeace(state)) return 'feud';
  const since = state.flags['lastPaired'] ?? 0;
  if (since > 0 && state.day - since < PAIR_COOLDOWN) return 'toosoon';
  const free = unattached(state);
  const men = free.filter((p) => !isWoman(p));
  const women = free.filter(isWoman);
  if (men.length === 0 || women.length === 0) return 'nobody';
  return null;
}

/**
 * Two people in the hall make a household of it. Mutates.
 *
 * Only ever a man and a woman, and only ever people bound to nobody — this
 * binds the tie the sim already understands (`Person.kin`), which is what
 * lets a child born afterwards be recorded with a father's name.
 */
export function maybePair(state: GameState): boolean {
  if (pairBlocker(state) !== null) return false;
  const rng = stream(state.seed, 'colony').derive(`pair:${state.day}`);
  if (!rng.chance(PAIR_ODDS)) return false;

  const free = unattached(state);
  const man = rng.derive('m').pick(free.filter((p) => !isWoman(p)));
  const woman = rng.derive('f').pick(free.filter(isWoman));
  if (!man || !woman) return false;

  const [his, hers] = PEER_TIES.mf[1]!; // husband / wife
  man.kin = { id: woman.id, tie: his };
  woman.kin = { id: man.id, tie: hers };
  state.flags['lastPaired'] = state.day;
  state.party.morale = Math.min(100, state.party.morale + PAIR_HEART);

  chronicle(
    state,
    `${man.name} and ${woman.name} were married at the steading, and for one `
      + 'day nobody talked about the winter.',
    'good',
  );
  return true;
}

/**
 * The hall passes. Called when somebody dies, before the body is counted.
 *
 * Leadership already passed by seniority — `leaderOf` simply returns the next
 * sworn in first-ashore order — but it passed SILENTLY, so the most important
 * thing that can happen to a band happened without the saga noticing. This
 * says it, and says what the dead leader left.
 */
export function hallPasses(state: GameState, dead: Person): void {
  // Asked of who they WERE, not who leads now: every death site clears
  // `alive` before it mourns, so by the time this runs `leaderOf` already
  // names the successor. The dead led iff nobody living and sworn stood
  // ahead of them in the order they came ashore.
  if (dead.bond !== 'sworn') return;
  const roster = state.party.people;
  const seat = roster.findIndex((p) => p.id === dead.id);
  const ahead = roster.slice(0, Math.max(0, seat)).some((p) => p.alive && p.bond === 'sworn');
  if (ahead) return;

  const heir = leaderOf(roster);
  const born = childrenOf(state).filter((c) => c.mother === dead.id || c.father === dead.id);

  if (!heir) {
    chronicle(
      state,
      `${dead.name} was the last of those who came ashore first. There was `
        + 'nobody left to hand it to.',
      'grim',
    );
    return;
  }
  chronicle(
    state,
    `${dead.name} was carried out, and ${heir.name} took the high seat — not `
      + `by any vote, but because ${heir.name} came off the knarr next.`,
    'grim',
  );
  if (born.length > 0) {
    const names = born.map((c) => c.name).join(' and ');
    chronicle(
      state,
      `${names} will be told whose child ${born.length > 1 ? 'they are' : 'they are'}, `
        + 'when there is somebody old enough to tell it.',
      'saga',
    );
  }
}
