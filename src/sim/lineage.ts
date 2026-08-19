// Being born, and getting older.
//
// Two things the game did not do. Nobody aged — `age` was set when a person
// was made and never touched again, read only to pick a kin tie and to print
// a number when they died — and nobody was ever born.
//
// What this does NOT do is grow anybody up, because the arithmetic forbids
// it: a generation is sixteen years and a run is five. See `data/lineage.ts`.
// A child here is a mouth, a lift, and a name the saga ends with.

import type { Child, GameState, Person } from '../state/types';
import {
  BEARING_MAX,
  BEARING_MIN,
  BIRTH_COOLDOWN,
  BIRTH_FOOD_FLOOR,
  BIRTH_HEART,
  BIRTH_ODDS,
} from '../data/lineage';
import { MEN, WOMEN } from '../data/names';
import { isWoman, kinOf } from './kin';
import { living } from './people';
import { crowding } from './colony';
import { houseAtPeace } from './thing';
import { chronicle } from './saga';
import { stream } from '../rng';
import { YEAR_LENGTH, yearOf } from './calendar';

/** Everyone born on this coast, or none. */
export function childrenOf(state: GameState): Child[] {
  return state.settlement?.children ?? [];
}

/**
 * A year older, every one of them, on the turn of the year.
 *
 * Cheap, and it is what makes a five-winter run read as a life rather than as
 * a fixed roster with a day counter. `age` was already stored and already
 * printed at a death; it simply never moved.
 */
export function ageTheBand(state: GameState): boolean {
  // The thaw is the turn of the year — `yearOf` counts from the first spring,
  // so this fires once a year and on the same day the ice breaks.
  if ((state.day - 1) % YEAR_LENGTH !== 0 || state.day <= 1) return false;
  for (const person of state.party.people) person.age += 1;
  return true;
}

/** Whether this person could bear a child this year. */
export function bearing(person: Person): boolean {
  return person.alive && isWoman(person) && person.age >= BEARING_MIN && person.age <= BEARING_MAX;
}

/**
 * Why nobody is being born, or null when somebody could be.
 *
 * Written as a blocker rather than a boolean for the same reason
 * `launchBlocker` is: every one of these is a thing the player did or did not
 * do, and a refusal that cannot say which is a refusal the player cannot act
 * on.
 */
export type BirthBlock = 'nosteading' | 'nobody' | 'larder' | 'room' | 'feud' | 'toosoon';

export function birthBlocker(state: GameState): BirthBlock | null {
  if (!state.settlement) return 'nosteading';
  if (!living(state.party.people).some(bearing)) return 'nobody';
  // A mouth you cannot feed is not growth. Same floor `drawOdds` keeps.
  if (state.party.food < BIRTH_FOOD_FLOOR) return 'larder';
  if (crowding(state) > 0) return 'room';
  if (!houseAtPeace(state)) return 'feud';
  const last = state.flags['lastBorn'];
  if (last !== undefined && state.day - last < BIRTH_COOLDOWN) return 'toosoon';
  return null;
}

/**
 * The day's roll. Returns the child if one was born.
 *
 * Deterministic off the colony stream, derived by day, so a replay of a seed
 * gets the same children — which the recorded runs and the port both need.
 */
export function maybeBirth(state: GameState): Child | undefined {
  if (birthBlocker(state) !== null) return undefined;
  const rng = stream(state.seed, 'colony').derive(`born:${state.day}`);
  if (!rng.chance(BIRTH_ODDS)) return undefined;

  const mothers = living(state.party.people).filter(bearing);
  const mother = rng.derive('mother').pick(mothers);
  // A father only when there is a tie to name one. The game knows who is
  // bound to whom; it does not invent a marriage that nothing recorded.
  const partner = kinOf(state.party.people, mother);
  const father = partner && partner.alive && !isWoman(partner) ? partner : undefined;

  const girl = rng.derive('sex').chance(0.5);
  const pool = girl ? WOMEN : MEN;
  // Not a name already standing in the band or already borne here — two
  // Ãsdís in one steading is a bug in the saga, not a coincidence.
  const taken = new Set([
    ...state.party.people.map((p) => p.name),
    ...childrenOf(state).map((c) => c.name),
  ]);
  const free = pool.filter((n) => !taken.has(n));
  if (free.length === 0) return undefined;
  const name = rng.derive('name').pick(free);

  const child: Child = { name, bornOn: state.day, mother: mother.id, ...(father ? { father: father.id } : {}) };
  state.settlement!.children.push(child);
  state.flags['lastBorn'] = state.day;
  state.party.morale = Math.min(100, state.party.morale + BIRTH_HEART);
  // "The first of us" is said once and only when it is true — the line was
  // written for every birth on the first pass, which would have had a
  // steading announcing four separate firstborns.
  const first = childrenOf(state).length === 1;
  const kind = girl ? 'daughter' : 'son';
  const them = girl ? 'her' : 'him';
  const named = father ? `${father.name} named ${them} ${name}` : `they named ${them} ${name}`;
  chronicle(
    state,
    `${mother.name} was brought to bed of a ${kind}, and ${named}.${
      first ? ' The first of us who is of this country and no other.' : ''
    }`,
    'good',
  );
  return child;
}

/** Children this person left behind. */
export function orphansOf(state: GameState, person: Person): Child[] {
  return childrenOf(state).filter((c) => c.mother === person.id || c.father === person.id);
}

/** How many years of this country the eldest child has seen. */
export function eldestBorn(state: GameState): number {
  const born = childrenOf(state);
  if (born.length === 0) return 0;
  const first = Math.min(...born.map((c) => c.bornOn));
  return Math.max(0, yearOf(state.day) - yearOf(first));
}
