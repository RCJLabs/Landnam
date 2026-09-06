// What happens to the title when the man it was granted to dies.
//
// `Jarldom` was `{name, since}` — written once in `thing.ts` when the Thing
// carried, and cleared NOWHERE. `mourn` is the single funnel all six death
// paths run through, and it passed the hall, the blade and the orphans and
// knew nothing about this. So the band went on ruling under a dead man, and
// went on collecting what ruling is worth: three of word, a raider cap two
// higher, the joining draw, goodwill that stops cooling, a season's tribute —
// and the Thing shut behind them forever, because `canCallThing` refuses
// while `state.jarl` is set.
//
// ## Why it lapses rather than passing to the heir
//
// The hall passes. The blade passes. Those are POSSESSIONS, and the rule
// `hallPasses` follows — the next living sworn man off the knarr — is a rule
// about property. A jarldom is not property: the Thing named a MAN, and the
// text it wrote says so ("there was a jarl on that coast where there had been
// nobody"). A coast that hands the title down without being asked is a coast
// with no say in who rules it, and the Thing is the one institution in this
// game that exists to have that say.
//
// So the title dies with him and the checklist reopens: the winters are still
// stood, the hall still stands, the friends are still friends. What it costs
// to take it back is a feast and a 2d6 against fourteen — the same price it
// cost the first time, which is the point. The coast can take it back, and
// the band can go and ask again.
//
// The band's RECORD is not lost with it: `JARLDOMS` counts what the Thing
// carried, so "ever proclaimed jarl" — the figure the difficulty menu
// promises and the challenge code stamps — still means what it always meant.
// Reading `state.jarl` for that question was correct while a jarldom could
// not end, and is not any more; `everRuled` is the question to ask now.

import { chronicle } from './saga';
import { fullName } from './people';
import type { GameState, Person } from '../state/types';

/** How many times the Thing has carried in this saga. */
export const JARLDOMS = 'jarldoms';

/** How many of those ended with the man rather than with the player. */
export const TITLE_LOST = 'titleLost';

/**
 * True if the Thing ever carried here, whether or not it still stands.
 *
 * The right question for anything about the band's record — the menu's
 * "ever proclaimed jarl", the challenge mark, the saga's title. Asking
 * `state.jarl` answers "is there a jarl RIGHT NOW", which is a different
 * question and was only the same one while a jarldom could not end.
 */
export function everRuled(state: GameState): boolean {
  return state.jarl !== undefined || (state.flags[JARLDOMS] ?? 0) > 0;
}

/**
 * Is this the person the Thing named?
 *
 * By id where there is one. Old saves carry a jarldom with only a name, so
 * the name is the fallback rather than the primary: `fullName` is stable for
 * band folk (only a champion's byname is ever reassigned, `battle.ts`), but
 * two people can share one and an id cannot.
 */
export function isTheJarl(state: GameState, person: Person): boolean {
  const jarl = state.jarl;
  if (!jarl) return false;
  if (jarl.id !== undefined) return jarl.id === person.id;
  return fullName(person) === jarl.name;
}

/**
 * The jarl has died. Called from `mourn`, beside the hall and the blade.
 *
 * Returns true if a title actually ended, so a caller can tell "he was not
 * the jarl" from "there was no jarl".
 */
export function titleLapses(state: GameState, dead: Person): boolean {
  if (!state.jarl || !isTheJarl(state, dead)) return false;
  const held = state.day - state.jarl.since;
  state.jarl = undefined;
  state.flags[TITLE_LOST] = (state.flags[TITLE_LOST] ?? 0) + 1;
  // The proclamation card is shown once per jarldom, gated on this flag being
  // unset. Cleared here so a coast that grants the rule a second time says so
  // a second time, rather than handing it over in silence.
  delete state.flags['ruleTaken'];
  chronicle(
    state,
    `${dead.name} had held the coast ${held} days when they carried him out, and `
      + 'the rule went into the ground with him. There was no jarl again.',
    'saga',
    true,
  );
  return true;
}
