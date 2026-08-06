// The first winter. Twenty-four days on which the land gives nothing back and
// the fire has to be fed four times a night.
//
// The whole design of this milestone is one claim: when a colony dies in the
// dark, the player was told the number and chose not to meet it. Everything
// here exists to make that claim true — the forecast walks the remaining days
// with YOUR people on YOUR jobs at the season factors they will actually face,
// so the target it prints is a simulation of your plan rather than a rule of
// thumb someone tuned by feel.

import type { GameState, Injury, Person } from '../state/types';
import { effectsOn, nextThaw, seasonOf } from './calendar';
import { dayLabour, jobOf, output, seasonFactor, shelterSaving } from './colony';
import { living } from './people';
import { chronicle } from './saga';
import { bonus } from './lore';
import { firewoodPerNight, foodPerDay } from './upkeep';
import { stream } from '../rng';

/** Winter opens on day 49. Spring — and survival — on day 73. */
export const WINTER_DAY = 49;

/** How much more than the forecast to bank. The weather is not a mean. */
export const PRUDENCE = 1.15;

/**
 * How far out the mark starts being shown: the turn of autumn. Before 4.6 the
 * panel was gated on "day 25 or later", which meant the same thing exactly
 * once. It has to be a window now, because the year comes round again.
 */
export const MARK_WINDOW = 48;

export interface Forecast {
  /** Days between now and the ice breaking. */
  days: number;
  /** Food that must be in the store today to reach spring on this plan. */
  food: number;
  /** Firewood likewise. */
  firewood: number;
  /** What is actually in hand, minus what is needed. Negative is a shortfall. */
  foodGap: number;
  firewoodGap: number;
  /** True when both stores clear the target. */
  ready: boolean;
}

/**
 * Walks every remaining day and adds up what the band will fail to produce.
 *
 * Deliberately projects the CURRENT assignments forward: a colony that has
 * everyone farming is told, correctly, that its fields will stop in twenty
 * days and it will starve. Change the plan and the number changes with it.
 */
export function forecast(state: GameState): Forecast {
  // Whichever thaw is next. Before 4.6 this was the single day the run ended
  // on; the mark now points at the winter actually coming.
  const days = Math.max(0, nextThaw(state.day) - state.day);
  const home = state.settlement;
  const crew = living(state.party.people);

  let food = 0;
  let firewood = 0;
  const saved = shelterSaving(state);

  for (let i = 1; i <= days; i++) {
    const day = state.day + i;
    const mouths = Math.max(1, Math.ceil(crew.length / 2));
    // Same helper the day tick burns from, so the mark cannot lie.
    const fire = Math.max(0, effectsOn(day).firewood - saved);

    let grown = 0;
    let cut = 0;
    if (home) {
      for (const person of crew) {
        const job = jobOf(person);
        if (!job) continue;
        // Same maths the day tick will use, at that day's season factor.
        const amount = output(state, person, job) * ratio(state.day, day, job.seasonal);
        if (job.produces === 'food') grown += amount;
        else if (job.produces === 'firewood') cut += amount;
      }
    }

    food += Math.max(0, mouths - grown);
    firewood += Math.max(0, fire - cut);
  }

  const needFood = Math.round(food * PRUDENCE);
  const needWood = Math.round(firewood * PRUDENCE);
  return {
    days,
    food: needFood,
    firewood: needWood,
    foodGap: Math.round(state.party.food) - needFood,
    firewoodGap: Math.round(state.party.firewood) - needWood,
    ready: state.party.food >= needFood && state.party.firewood >= needWood,
  };
}

/** Re-scales today's output to another day's season. */
function ratio(today: number, then: number, seasonal: number): number {
  const now = 1 + seasonal * (effectsOn(today).forage - 1);
  const later = 1 + seasonal * (effectsOn(then).forage - 1);
  if (now <= 0) return 0;
  return Math.max(0, later) / now;
}

/** One line naming where the band stands against the winter. */
export function readiness(state: GameState): string {
  const f = forecast(state);
  // Out of season the mark is not a live target, so it does not read like one.
  if (!markVisible(state)) return 'The ice has broken. We lived.';
  if (f.ready) {
    return `Stores will reach spring: ${f.food} food and ${f.firewood} wood is the mark, and we are past both.`;
  }
  const short: string[] = [];
  if (f.foodGap < 0) short.push(`${-f.foodGap} short of food`);
  if (f.firewoodGap < 0) short.push(`${-f.firewoodGap} short of wood`);
  return `To see spring we need ${f.food} food and ${f.firewood} wood. We are ${short.join(' and ')}.`;
}

// --- Sickness ---

const ILLNESSES: Omit<Injury, 'id'>[] = [
  { label: 'A cough that will not clear', effect: { might: -1 }, heals: 14 },
  { label: 'Fever in the night', effect: { spirit: -1, wits: -1 }, heals: 12 },
  { label: 'Frostbitten hands', effect: { craft: -2 }, heals: 20 },
  { label: 'Something on the lungs', effect: { might: -1, spirit: -1 }, heals: 18 },
];

export const SICKNESS_BASE_DC = 9;

/**
 * Whether the mark is worth putting on screen. A number the player cannot act
 * on yet is noise, and a winter target shown through high summer is noise for
 * two whole seasons.
 */
export function markVisible(state: GameState): boolean {
  if (state.end || !state.settlement) return false;
  const days = forecast(state).days;
  return days > 0 && days <= MARK_WINDOW;
}

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
    if (roll >= SICKNESS_BASE_DC + severity) continue;

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

// --- Telegraphing it ---

/**
 * Saga warnings at the points where there is still time to act. Fires at most
 * once each, so a long autumn does not become a nagging.
 */
export function telegraphWinter(state: GameState): void {
  if (!state.settlement) return;
  const f = forecast(state);

  const warn = (flag: string, text: string): void => {
    if ((state.flags[flag] ?? 0) > 0) return;
    state.flags[flag] = 1;
    chronicle(state, text, 'saga');
  };

  // The turn of autumn: the first honest reckoning of what is needed.
  if (state.day >= 25 && state.day < WINTER_DAY) {
    warn(
      'winterTargetGiven',
      `The nights drew in and we counted what we had. To see spring we would need ${f.food} of food and ${f.firewood} of wood laid by. ${
        f.ready ? 'We had it, and more.' : 'We did not have it yet.'
      }`,
    );
  }

  // A week out, when there is still time to cut wood but not to grow food.
  if (state.day >= WINTER_DAY - 7 && state.day < WINTER_DAY && !f.ready) {
    warn(
      'winterLastWarning',
      `Seven days from the dark, and the store was short: ${
        f.foodGap < 0 ? `${-f.foodGap} of food` : ''
      }${f.foodGap < 0 && f.firewoodGap < 0 ? ' and ' : ''}${
        f.firewoodGap < 0 ? `${-f.firewoodGap} of wood` : ''
      }. Everyone knew it.`,
    );
  }

  if (state.day === WINTER_DAY) {
    warn(
      'winterOpened',
      f.ready
        ? 'Winter closed over us with the store full. We had done what could be done.'
        : 'Winter closed over us short, and we had known it was coming.',
    );
  }
}

/**
 * The run-end verdict on the winter. Says plainly whether the band was warned
 * and what it did about it — the milestone's whole point is that a death in
 * the dark is never a surprise.
 */
export function winterVerdict(state: GameState): string | undefined {
  if (!state.settlement) return undefined;
  const warned = (state.flags['winterTargetGiven'] ?? 0) > 0;
  const short = (state.flags['winterLastWarning'] ?? 0) > 0;
  if (!warned) return undefined;
  if (state.end?.cause === 'survived') {
    return short
      ? 'We went into the dark short, and came out of it anyway. It was closer than anyone says now.'
      : 'We had counted right in the autumn, and the counting held.';
  }
  return short
    ? 'We had been told the number in the autumn, and we went into the dark without it.'
    : 'The store had looked like enough in the autumn. It was not.';
}

/** True when the day is one the fire cannot be allowed to go out. */
export function bitingCold(day: number): boolean {
  return effectsOn(day).firewood >= 3;
}

/** The projected daily take, for the panel. Zero away from home. */
export function todaysTake(state: GameState): { food: number; firewood: number } {
  const take = dayLabour(state);
  return { food: take.food, firewood: take.firewood };
}

/** Re-exported so the panel does not have to reach into two modules. */
export { seasonFactor, shelterSaving, firewoodPerNight, foodPerDay };
