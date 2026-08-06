// What every passing day costs. This is the clock that kills you: mouths to
// feed, a fire to keep, and a season that stops giving.

import type { GameState, Person, RunEnd } from '../state/types';
import { effectsOn, seasonOf } from './calendar';
import { living } from './people';
import { chronicle } from './saga';

/** Winter arrives on day 49; spring on day 73 is survival. */
export const SURVIVAL_DAY = 73;

export function foodPerDay(state: GameState): number {
  return Math.max(1, Math.ceil(living(state.party.people).length / 2));
}

export function firewoodPerNight(state: GameState): number {
  return effectsOn(state.day).firewood;
}

function weakest(people: Person[]): Person | undefined {
  const alive = living(people);
  if (alive.length === 0) return undefined;
  return alive.reduce((worst, p) => (p.health < worst.health ? p : worst));
}

function wound(state: GameState, person: Person, amount: number, fate: string): void {
  person.health -= amount;
  if (person.health <= 0) {
    person.health = 0;
    person.alive = false;
    person.fate = fate;
    chronicle(state, `${person.name} ${person.byname} died of ${fate}. We had no ground fit to bury them in.`, 'grim');
  }
}

function endRun(state: GameState, cause: RunEnd['cause'], title: string, lines: string[]): void {
  if (state.end) return;
  state.end = { cause, title, lines };
}

/** Heals injuries and knits wounds over time. */
function mendInjuries(state: GameState): void {
  for (const person of state.party.people) {
    if (!person.alive) continue;
    person.injuries = person.injuries.filter((injury) => {
      injury.heals -= 1;
      if (injury.heals <= 0) {
        chronicle(state, `${person.name}'s ${injury.label.toLowerCase()} had mended.`, 'good');
        return false;
      }
      return true;
    });
  }
}

/**
 * Advances a single day and applies its costs. Mutates the state clone.
 * Returns false once the run has ended, so callers can stop early.
 */
export function passDay(state: GameState): boolean {
  if (state.end) return false;

  state.day += 1;
  const party = state.party;
  const season = seasonOf(state.day);
  const effects = effectsOn(state.day);

  // Mouths.
  const needed = foodPerDay(state);
  const eaten = Math.min(party.food, needed);
  party.food -= eaten;
  const hungry = eaten < needed;

  // Fire.
  const wood = firewoodPerNight(state);
  const burned = Math.min(party.firewood, wood);
  party.firewood -= burned;
  const cold = burned < wood;

  if (hungry) {
    party.morale = Math.max(0, party.morale - 8);
    const victim = weakest(party.people);
    if (victim) wound(state, victim, 2, 'hunger');
    const streak = (state.flags['hungerStreak'] ?? 0) + 1;
    state.flags['hungerStreak'] = streak;
    chronicle(state, hungerLine(streak), 'grim');
  } else {
    state.flags['hungerStreak'] = 0;
  }

  if (cold) {
    // Cold only truly bites outside summer; a summer night without fire is
    // merely miserable.
    const bite = season === 'winter' ? 3 : season === 'summer' ? 0 : 1;
    party.morale = Math.max(0, party.morale - (season === 'winter' ? 7 : 3));
    if (bite > 0) {
      for (const person of living(party.people)) wound(state, person, bite, 'the cold');
      chronicle(state, 'The fire went out in the night. We did not sleep.', 'grim');
    }
  }

  // A well-kept camp slowly restores nerve.
  if (!hungry && !cold) {
    party.morale = Math.min(100, party.morale + 1);
  }

  mendInjuries(state);

  // Season turned?
  if ((state.day - 1) % 24 === 0) {
    chronicle(state, seasonOpening(season), 'saga');
  }
  // Telegraph the coming winter while there is still time to act.
  if (state.day === 41) {
    chronicle(state, 'The light was going early. Winter was eight days out, and our stores were what they were.', 'saga');
  }

  checkRunEnd(state, effects.forage);
  return !state.end;
}

/** Hunger escalates rather than repeating itself day after day. */
function hungerLine(streak: number): string {
  if (streak === 1) return 'We ate nothing that day, and felt it in the morning.';
  if (streak === 2) return 'A second day with nothing. Nobody spoke much.';
  if (streak === 3) return 'Three days empty. We boiled leather and drank the water off it.';
  if (streak <= 5) return `${streak} days without food. The walking had gone slow and strange.`;
  if (streak <= 8) return 'We had stopped feeling hungry, which the old hands said was the bad sign.';
  return 'There was nothing left to eat and nothing left to say about it.';
}

function seasonOpening(season: string): string {
  switch (season) {
    case 'autumn':
      return 'The first frost came, and the birds went south over us in their thousands.';
    case 'winter':
      return 'Winter closed its hand. Nothing grew, nothing moved, and the dark came at noon.';
    case 'spring':
      return 'The ice broke in the shallows. We had lived through it.';
    default:
      return 'The long days came, and the sun barely left the water.';
  }
}

export function checkRunEnd(state: GameState, _forage: number): void {
  const alive = living(state.party.people);

  if (state.day >= SURVIVAL_DAY && alive.length > 0) {
    endRun(state, 'survived', 'We Held the Land', [
      `${alive.length} of ${state.party.people.length} lived to see the ice break.`,
      'The land had not taken us. Not this year.',
    ]);
    return;
  }

  if (alive.length === 0) {
    const starved = state.party.people.some((p) => p.fate === 'hunger');
    const froze = state.party.people.some((p) => p.fate === 'the cold');
    endRun(
      state,
      starved ? 'starved' : froze ? 'frozen' : 'slain',
      'No One Came Back',
      [`The warband ended on day ${state.day}.`, 'The sea keeps no account of who it carries out.'],
    );
    return;
  }

  if (state.party.morale <= 0) {
    endRun(state, 'despair', 'The Band Broke', [
      `On day ${state.day} what was left of us stopped listening to each other.`,
      'Some walked inland. Some walked into the water. None of it was a plan.',
    ]);
  }
}
