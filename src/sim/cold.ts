// Cold nights, and what they leave behind.
//
// Split out of `winter.ts` on 2026-08-21. The mark is arithmetic the player
// is shown; this is what happens when the arithmetic loses — a fire that goes
// out, a roll against shelter and spirit, and an illness that turns a bad
// winter into a fatal one.
//
// The illness table stays here rather than moving to `src/data` for the
// reason it always did: the only thing that reads it is `coldNight` a few
// lines below, and a table with one caller reads better beside its caller.
// `scripts/party-tables.ts` hands the same four to the port.

import type { GameState, Injury, Person } from '../state/types';
import { effectsOn, seasonOf, winterDepth } from './calendar';
import { living } from './people';
import { chronicle } from './saga';
import { mourn } from './kin';
import { bonus } from './lore';
import { stream } from '../rng';

/**
 * What a cold night gives you.
 *
 * Exported since 2026-08-20 so `scripts/party-tables.ts` can hand the port the
 * same four. It stays here rather than moving to src/data because the ONLY
 * thing that reads it is `coldNight` twenty lines below, and a table with one
 * caller reads better beside its caller than in a file of its own.
 */
export const ILLNESSES: Omit<Injury, 'id'>[] = [
  { label: 'A cough that will not clear', effect: { might: -1 }, heals: 14 },
  { label: 'Fever in the night', effect: { spirit: -1, wits: -1 }, heals: 12 },
  { label: 'Frostbitten hands', effect: { craft: -2 }, heals: 20 },
  { label: 'Something on the lungs', effect: { might: -1, spirit: -1 }, heals: 18 },
];

export const SICKNESS_BASE_DC = 9;

/** True while the ground is too hard for anything to mend properly. */
export function frozen(day: number): boolean {
  return seasonOf(day) === 'winter';
}

/**
 * A cold night without fire. Everyone rolls; shelter and spirit are what stand
 * between a bad night and a bad month.
 */
export function coldNight(state: GameState, severity: number): Person[] {
  const home = state.settlement;
  const shelter = home ? home.shelter : 0;
  const rng = stream(state.seed, 'colony').derive(`cold:${state.day}`);
  const fell: Person[] = [];

  for (const person of living(state.party.people)) {
    // Already ill and still cold: it gets worse rather than doubling up.
    const alreadyIll = person.injuries.some((i) => i.id.startsWith('ill_'));
    const roll =
      rng.derive(person.id).roll(2, 6) +
      Math.floor(person.stats.spirit / 2) +
      shelter +
      // Knowing what to do for a cold body is worth as much as the roof over it.
      bonus(state, 'physic');
    // Later winters do not merely burn more wood; they are colder.
    if (roll >= SICKNESS_BASE_DC + severity + Math.floor(winterDepth(state.seed, state.day) / 2)) continue;

    if (alreadyIll) {
      person.health = Math.max(0, person.health - 2);
    } else {
      const template = rng.derive(`what:${person.id}`).pick(ILLNESSES);
      person.injuries.push({ ...template, id: `ill_${state.day}_${person.id}` });
      person.health = Math.max(0, person.health - 2);
      fell.push(person);
    }

    if (person.health <= 0) {
      person.alive = false;
      person.fate = 'the sickness of that winter';
      person.diedOn = state.day;
      chronicle(state, `${person.name} did not wake. It was the cold that did it.`, 'grim');
      mourn(state, person);
    }
  }

  if (fell.length > 0) {
    // Sickness in a small band is a morale event as much as a health one.
    state.party.morale = Math.max(0, state.party.morale - fell.length * 3);
    chronicle(
      state,
      fell.length === 1
        ? `${fell[0]!.name} took ill in the night — ${fell[0]!.injuries[fell[0]!.injuries.length - 1]!.label.toLowerCase()}.`
        : `${fell.length} of us went down sick in the same week.`,
      'grim',
    );
  }
  return fell;
}

/** How many of the band are carrying an illness right now. */
export function sickCount(state: GameState): number {
  return living(state.party.people).filter((p) => p.injuries.some((i) => i.id.startsWith('ill_')))
    .length;
}

/** True when the day is one the fire cannot be allowed to go out. */
export function bitingCold(day: number): boolean {
  return effectsOn(day).firewood >= 3;
}
