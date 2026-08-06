// Who comes, and who goes.
//
// The band has been six people for the whole game up to here, and that is the
// single fact behind every failed attempt to make the late game dangerous:
// six people with nothing else to do out-produce any burn that can be set, so
// nothing priced in food or firewood could threaten them. This is the other
// half — a band that can grow, and therefore a band that can be worth
// bleeding.
//
// Everyone who arrives arrives as a HAND. The warband is six and stays six
// (see SWORN_MAX): growth buys labour, never a wider shield wall.

import { stream } from '../rng';
import { capacity } from './colony';
import { hands, living, makePerson } from './people';
import { chronicle } from './saga';
import type { GameState, Person } from '../state/types';

/** Morale at which a hand starts thinking about walking. */
export const LEAVING_MOOD = 25;

/** Chance per day a miserable hand actually goes. */
export const LEAVING_CHANCE = 0.12;

/** A hand who has been with the band this long has made their choice. */
export const SETTLED_IN = 30;

/** Beds going spare right now. Never negative. */
export function roomLeft(state: GameState): number {
  return Math.max(0, capacity(state) - living(state.party.people).length);
}

/**
 * Takes people in, as many as there is room for.
 *
 * Returns the ones who actually joined, which may be fewer than asked for and
 * may be none — a hall with no spare bed turns people away, and that refusal
 * is the whole reason capacity exists. Mutates; callers hold a clone.
 */
export function takeIn(state: GameState, count: number, why: string): Person[] {
  const room = Math.min(count, roomLeft(state));
  if (room <= 0) return [];

  const rng = stream(state.seed, 'party').derive(`join:${state.day}:${state.nextId}`);
  const joined: Person[] = [];
  for (let i = 0; i < room; i += 1) {
    const person = makePerson(rng.derive(`${i}`), `p${state.nextId}`, 'hand');
    state.nextId += 1;
    person.joinedOn = state.day;
    // Nobody arrives delighted. They arrive because the alternative was worse.
    person.morale = 45;
    state.party.people.push(person);
    joined.push(person);
  }

  const names = joined.map((p) => p.name).join(' and ');
  chronicle(state, `${names} ${joined.length > 1 ? 'came' : 'came'} to us: ${why}`, 'good');
  return joined;
}

/**
 * Hands who have had enough, and go.
 *
 * The sworn never leave — that is what sworn means, and a warband that could
 * evaporate would make every fight a morale check before it was a fight.
 * Hands are another matter: they came because the alternative was worse, and
 * when it stops being worse they walk. A crowded hall in a bad winter is
 * exactly where that happens, which is what gives capacity its teeth.
 *
 * Someone who has been with the band a month has thrown their lot in and
 * stays, so a steading that gets through a bad patch keeps the people it
 * carried through it.
 */
export function handsLeave(state: GameState): Person[] {
  const rng = stream(state.seed, 'party').derive(`leave:${state.day}`);
  const gone: Person[] = [];

  for (const person of hands(state.party.people)) {
    if (person.morale > LEAVING_MOOD) continue;
    if (state.day - (person.joinedOn ?? 0) >= SETTLED_IN) continue;
    if (!rng.derive(person.id).chance(LEAVING_CHANCE)) continue;

    // Not dead — gone. `alive: false` keeps the upkeep honest (they are not
    // eating here any more); `left` keeps the saga honest.
    person.alive = false;
    person.left = true;
    person.fate = 'walked out one morning and did not come back';
    person.diedOn = state.day;
    gone.push(person);
  }

  for (const person of gone) {
    chronicle(state, `${person.name} left us. Nobody went after ${person.name}.`, 'grim');
  }
  return gone;
}
