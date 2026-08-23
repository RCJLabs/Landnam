// What the band is thinking about all this.
//
// Everything here is downstream of things that already happen — hunger, cold,
// wounds, the work they were given, who died. A mood that drifted on its own
// would be a mood the player cannot act on, and a feud that fired on a dice
// roll would be an interruption rather than a consequence.

import { friction, temperOf, traitById } from '../data/traits';
import {
  BLOOD_THRESHOLD,
  FEUD_CAUSES,
  FEUD_CHOICES,
  FEUD_THRESHOLD,
  FEUD_BODY,
  FEUD_TITLE,
  THING_DC,
  WERGILD_FOOD,
} from '../data/feuds';
import { stream } from '../rng';
import { driveOut } from './outlaw';
import type { GameState, Grudge, Person } from '../state/types';
import { crowding, jobOf } from './colony';
import { checkOdds } from './events';
import { bestStat, effectiveStat, living } from './people';
import { chronicle } from './saga';
import { atHome } from './site';

/** How fast a mood moves toward where circumstances are pushing it. */
export const MOOD_DRIFT = 0.28;

// --- Mood ---

export interface Pressure {
  hungry: boolean;
  cold: boolean;
  /** Somebody died within the last few days. */
  grieving: boolean;
}

/**
 * Where this person's morale is being pulled today.
 *
 * The band's own morale is in here because people take their cue from the
 * room, but it is only one term: a hardy man in a miserable band stays
 * steadier than the room, and a quarrelsome one is worse than it.
 */
/** What each body past the steading's room takes off everyone's mood. */
export const CROWDING_BITE = 5;

export function moodTarget(state: GameState, person: Person, pressure: Pressure): number {
  let target = 55;

  target += (state.party.morale - 55) * 0.35;
  target += (person.health / Math.max(1, person.maxHealth)) * 25 - 12;

  if (pressure.hungry) target -= 26;
  if (pressure.cold) target -= 16;
  if (pressure.grieving) target -= 14;

  // Sleeping on the floor of somebody else's hall. Per head over the roof's
  // room, so a steading one body past its capacity is merely uncomfortable
  // and one that has taken in a dozen with nowhere to put them is a place
  // people leave. This is what stops taking hands in from being free once
  // there is food in the store.
  target -= crowding(state) * CROWDING_BITE;

  // Work they are suited to is worth a great deal; being given nothing to do
  // is worse than being given something hard.
  if (state.settlement && atHome(state)) {
    const job = jobOf(person);
    if (!job) target -= 12;
    else {
      const skill = effectiveStat(person, job.stat);
      target += (skill - 3) * 4;
      if (traitById(person.trait)?.tags.includes(job.id)) target += 6;
    }
  }

  // Carrying something that will not mend wears on anybody.
  target -= Math.min(18, person.injuries.length * 9);

  return Math.max(0, Math.min(100, target));
}

/** Moves everyone's morale toward where the day is pushing it. */
export function driftMoods(state: GameState, pressure: Pressure): void {
  for (const person of living(state.party.people)) {
    const target = moodTarget(state, person, pressure);
    const temper = temperOf(person.trait);
    const step = (target - person.morale) * MOOD_DRIFT * temper;
    person.morale = Math.max(0, Math.min(100, person.morale + step));
  }
}

export type Mood = 'content' | 'steady' | 'sullen' | 'bitter' | 'breaking';

export function moodOf(person: Person): Mood {
  if (person.morale >= 72) return 'content';
  if (person.morale >= 52) return 'steady';
  if (person.morale >= 34) return 'sullen';
  if (person.morale >= 18) return 'bitter';
  return 'breaking';
}

export const MOOD_WORD: Record<Mood, string> = {
  content: 'content',
  steady: 'steady',
  sullen: 'sullen',
  bitter: 'bitter',
  breaking: 'at the end of it',
};

/** Everyone whose mood is bad enough to be a problem. */
export function malcontents(state: GameState): Person[] {
  return living(state.party.people).filter((p) => p.morale < 34);
}

// --- Grudges ---

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function grudgeBetween(state: GameState, a: string, b: string): Grudge | undefined {
  return state.grudges.find((g) => pairKey(g.a, g.b) === pairKey(a, b));
}

/**
 * How likely these two are to fall out today. Bad blood needs both a reason
 * — sour moods, hard days — and two people who grate on each other.
 */
export function frictionBetween(a: Person, b: Person): number {
  const traits = friction(a.trait, b.trait);
  // Two content people do not quarrel however different they are.
  const sourness = Math.max(0, (60 - a.morale) + (60 - b.morale)) / 120;
  return traits * sourness;
}

function nameLine(line: string, a: Person, b: Person): string {
  return line.replace(/\{A\}/g, a.name).replace(/\{B\}/g, b.name);
}

/**
 * Rolls for new bad blood and deepens what is already there. Called once a
 * day from the upkeep tick, after moods have moved.
 */
export function stirGrudges(state: GameState, pressure: Pressure): void {
  const rng = stream(state.seed, 'events').derive(`grudge:${state.day}`);
  const crew = living(state.party.people);
  if (crew.length < 2) return;

  // Existing bad blood: worse on a bad day, quietly better on a good one.
  for (const grudge of state.grudges) {
    if (grudge.settled) continue;
    const both = [grudge.a, grudge.b].every((id) =>
      crew.some((p) => p.id === id),
    );
    if (!both) {
      // One of them is gone. Whatever it was, it is over.
      grudge.settled = true;
      continue;
    }
    const hard = (pressure.hungry ? 1.4 : 0) + (pressure.cold ? 0.9 : 0) + (pressure.grieving ? 1 : 0);
    // A quarrel nobody named fades on a good day. One the band was asked
    // about and walked away from does not — it just sits there, and that is
    // what makes "get back to work" a choice rather than a free option.
    const drift = hard > 0 ? hard : grudge.hardened ? 0.35 : -0.5;
    grudge.weight = Math.max(0, grudge.weight + drift);
  }

  // New bad blood. At most one a day: a band that produced three feuds in a
  // week would read as a soap opera rather than a hard winter.
  const pairs: { a: Person; b: Person; heat: number }[] = [];
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const a = crew[i]!;
      const b = crew[j]!;
      const existing = grudgeBetween(state, a.id, b.id);
      if (existing && !existing.settled) continue;
      if (existing?.settled) continue; // once settled, settled
      const heat = frictionBetween(a, b);
      if (heat > 0) pairs.push({ a, b, heat });
    }
  }
  if (pairs.length === 0) return;

  const worst = pairs.reduce((best, p) => (p.heat > best.heat ? p : best));
  // Heat is roughly 0..4; even the worst pairing is not certain on any one day.
  if (!rng.chance(Math.min(0.5, worst.heat * 0.12))) return;

  const causes = FEUD_CAUSES.filter(
    (c) => (!c.needsHunger || pressure.hungry) && (!c.needsDeath || pressure.grieving),
  );
  if (causes.length === 0) return;
  const cause = rng.weighted(causes, (c) => c.weight);
  const line = nameLine(cause.line, worst.a, worst.b);

  state.grudges.push({
    a: worst.a.id,
    b: worst.b.id,
    weight: 4 + worst.heat,
    cause: line,
    since: state.day,
  });
  chronicle(state, line, 'grim');
}

/** Bad blood that has grown into something the band has to answer. */
export function ripeFeud(state: GameState): Grudge | undefined {
  return state.grudges
    .filter((g) => !g.settled && g.weight >= FEUD_THRESHOLD)
    .sort((a, b) => b.weight - a.weight)[0];
}

// --- The card ---

function personOf(state: GameState, id: string): Person | undefined {
  return state.party.people.find((p) => p.id === id);
}

/** Builds the feud card. Returns false if the quarrel has gone stale. */
export function presentFeud(state: GameState, grudge: Grudge): boolean {
  const a = personOf(state, grudge.a);
  const b = personOf(state, grudge.b);
  if (!a?.alive || !b?.alive) {
    grudge.settled = true;
    return false;
  }
  const speaker = bestStat(state.party.people, 'spirit');
  state.event = {
    id: 'feud',
    title: FEUD_TITLE,
    body: `${grudge.cause} ${FEUD_BODY}`,
    feud: { a: a.id, b: b.id },
    choices: FEUD_CHOICES.map((choice) => ({
      // The outlawry choice NAMES the man it would drive out. A judgement
      // this heavy must not be a generic label the player reads afterwards
      // and finds they picked somebody they did not mean to.
      label: choice.label.replace(/\{A\}/g, a.name).replace(/\{B\}/g, b.name),
      hint:
        choice.kind === 'thing'
          ? `Spirit · ${Math.round(checkOdds(speaker, THING_DC) * 100)}%`
          : choice.hint,
    })),
  };
  return true;
}

/** Fires a feud card if one is ripe and nothing else is on the table. */
export function maybeFireFeud(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  const grudge = ripeFeud(state);
  if (!grudge) return false;
  return presentFeud(state, grudge);
}

/**
 * Resolves the chosen answer. Returns the outcome text, which the card shows
 * before the player dismisses it.
 */
export function settleFeud(
  state: GameState,
  index: number,
): { text: string; good: boolean } {
  const card = state.event!;
  const grudge = grudgeBetween(state, card.feud!.a, card.feud!.b)!;
  const a = personOf(state, grudge.a)!;
  const b = personOf(state, grudge.b)!;
  const choice = FEUD_CHOICES[index] ?? FEUD_CHOICES[FEUD_CHOICES.length - 1]!;
  const rng = stream(state.seed, 'events').derive(`feud:${state.day}:${grudge.since}`);

  if (choice.kind === 'wergild') {
    if (state.party.food < WERGILD_FOOD) {
      grudge.weight += 3;
      return {
        text: 'There was nothing in the store worth offering, and everybody knew it.',
        good: false,
      };
    }
    state.party.food -= WERGILD_FOOD;
    grudge.settled = true;
    lift([a, b], 14);
    state.party.morale = Math.min(100, state.party.morale + 5);
    return {
      text: `It was counted out in front of everyone and taken without a word. ${a.name} and ${b.name} shook on it.`,
      good: true,
    };
  }

  if (choice.kind === 'thing') {
    const speaker = bestStat(state.party.people, 'spirit');
    if (rng.roll(2, 6) + speaker >= THING_DC) {
      grudge.settled = true;
      lift([a, b], 10);
      state.party.morale = Math.min(100, state.party.morale + 9);
      return {
        text: 'It was argued out in front of everyone, at length, and it held. Nobody paid anything but time.',
        good: true,
      };
    }
    grudge.weight += 5;
    state.party.morale = Math.max(0, state.party.morale - 6);
    return {
      text: 'It was argued out in front of everyone and settled nothing. Now the whole band has a side.',
      good: false,
    };
  }

  if (choice.kind === 'banish') {
    // Certain, and permanent. No roll, no store to be short of: the quarrel
    // is over because one of the two is gone. What it costs is a hand — and
    // an enemy who knows the country, the band, and where the steading is.
    grudge.settled = true;
    driveOut(state, a);
    b.morale = Math.min(100, b.morale + 6);
    return {
      text: `${a.name} was given until morning. Nobody walked out with ${a.name}, `
        + 'and nobody said much for a while after.',
      good: true,
    };
  }

  // Told to get back to work. Free today, and only today.
  grudge.weight += 6;
  grudge.hardened = true;
  for (const person of [a, b]) person.morale = Math.max(0, person.morale - 8);
  state.party.morale = Math.max(0, state.party.morale - 3);
  return {
    text: 'They went back to work. Neither of them looked at the other for a week.',
    good: false,
  };
}

function lift(people: Person[], amount: number): void {
  for (const person of people) {
    person.morale = Math.min(100, person.morale + amount);
  }
}

/**
 * What an unanswered feud eventually does. Called from the day tick: past the
 * blood threshold somebody gets hurt, which is what makes "get back to work"
 * a decision rather than a free option.
 */
export function feudsComeDue(state: GameState): void {
  const rng = stream(state.seed, 'events').derive(`blood:${state.day}`);
  for (const grudge of state.grudges) {
    if (grudge.settled || grudge.weight < BLOOD_THRESHOLD) continue;
    const a = personOf(state, grudge.a);
    const b = personOf(state, grudge.b);
    if (!a?.alive || !b?.alive) {
      grudge.settled = true;
      continue;
    }
    if (!rng.derive(`${grudge.a}:${grudge.b}`).chance(0.3)) continue;

    // Knives come out. Nobody dies outright of a quarrel — that would be a
    // coin flip deleting a veteran — but somebody is hurt and the band is
    // never the same afterwards.
    const victim = rng.chance(0.5) ? a : b;
    victim.health = Math.max(1, victim.health - 6);
    victim.injuries.push({
      id: `feud_${state.day}_${victim.id}`,
      label: 'Knife-work in the dark',
      effect: { might: -1, spirit: -1 },
      heals: 16,
    });
    grudge.settled = true;
    grudge.weight = 0;
    state.party.morale = Math.max(0, state.party.morale - 16);
    for (const person of living(state.party.people)) {
      person.morale = Math.max(0, person.morale - 8);
    }
    chronicle(
      state,
      `It came to knives between ${a.name} and ${b.name}. ${victim.name} was the one carried inside.`,
      'grim',
    );
    return; // one a day is more than enough
  }
}

/** For the panel: how many quarrels are running, and how bad the worst is. */
export function feudSummary(state: GameState): { open: number; worst: number } {
  const open = state.grudges.filter((g) => !g.settled);
  return {
    open: open.length,
    worst: open.reduce((n, g) => Math.max(n, g.weight), 0),
  };
}

/** Re-exported so callers do not have to reach into two modules. */
export { FEUD_THRESHOLD, BLOOD_THRESHOLD, WERGILD_FOOD };
