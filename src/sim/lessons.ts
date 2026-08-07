// Which lesson, if any, is due. Pure: (state, alreadyTaught) -> LessonDef?
//
// The taught set is passed in rather than read, because what a PLAYER has
// been told is not part of a RUN — it belongs beside the mute in localStorage,
// not in the save. Keeping it a parameter is what lets the whole thing be
// tested without a browser, and what keeps this module honest: it cannot
// quietly start writing to the state it is handed.

import { currentMode } from '../modes';
import { conditionHolds } from './events';
import { canFound } from './site';
import { markVisible } from './winter';
import { wintersStood } from './calendar';
import { WINTERS_TO_JARL } from '../data/thing';
import { LESSONS, type LessonDef, type LessonWhen } from '../data/lessons';
import { placeHere } from './places';
import { hands } from './people';
import { wordBump } from './word';
import type { GameState } from '../state/types';

function holds(state: GameState, when: LessonWhen): boolean {
  switch (when.c) {
    case 'inBattle':
      return Boolean(state.battle) && !state.battle?.outcome;
    case 'inColony':
      return currentMode(state) === 'COLONY';
    case 'canSettle':
      return !state.settlement && canFound(state, state.party.at);
    case 'markVisible':
      return markVisible(state);
    case 'grudge':
      return state.grudges.some((g) => !g.settled);
    case 'away':
      return Boolean(state.expedition);
    case 'couldClaim':
      return Boolean(state.settlement) && wintersStood(state.day) >= WINTERS_TO_JARL;
    case 'atPlace':
      return Boolean(placeHere(state)?.sackedOn === undefined && placeHere(state));
    case 'hasHands':
      return hands(state.party.people).length > 0;
    case 'holed':
      return Boolean(state.party.hullHoled);
    case 'famous':
      return wordBump(state) > 0;
    default:
      // Everything else is an ordinary event condition, interpreted by the
      // event engine so the two can never drift apart.
      return conditionHolds(state, when);
  }
}

/**
 * True when the screen is free enough to say something.
 *
 * A lesson must never displace a real event, an aftermath, or the run's
 * ending — those are the game talking, and the teaching is not more important
 * than the game. This is also what keeps the sim deterministic: because a
 * lesson only ever appears where nothing else would, it cannot change which
 * card a seed draws.
 */
function screenIsFree(state: GameState): boolean {
  return !state.event && !state.aftermath && !state.end && !state.battle?.outcome;
}

/**
 * The first untaught lesson whose conditions hold, or undefined.
 *
 * First rather than random, because LESSONS is written in teaching order: a
 * band that settles on day three is told about the posts before it is told
 * about the wind.
 */
export function lessonDue(
  state: GameState,
  taught: readonly string[],
): LessonDef | undefined {
  if (!screenIsFree(state)) return undefined;
  const known = new Set(taught);
  return LESSONS.find(
    (lesson) => !known.has(lesson.id) && lesson.when.every((w) => holds(state, w)),
  );
}

/** Every lesson id, for the "have I seen them all" check on the title screen. */
export function allLessonIds(): string[] {
  return LESSONS.map((l) => l.id);
}
