// Person generation and the small queries every mode needs about them.

import type { Rng } from '../rng';
import { BYNAMES, MEN, WOMEN } from '../data/names';
import { TRAITS, traitById } from '../data/traits';
import type { Person, Stats } from '../state/types';

export const WARBAND_SIZE = 6;

const STAT_KEYS: (keyof Stats)[] = ['might', 'wits', 'spirit', 'craft'];

/** Spreads a budget across the four stats, each capped 1..5 before traits. */
function rollStats(rng: Rng): Stats {
  const stats: Stats = { might: 1, wits: 1, spirit: 1, craft: 1 };
  let remaining = rng.int(7, 9);
  let guard = 200;
  while (remaining > 0 && guard-- > 0) {
    const stat = rng.pick(STAT_KEYS);
    if (stats[stat] < 5) {
      stats[stat] += 1;
      remaining -= 1;
    }
  }
  return stats;
}

function applyTrait(stats: Stats, traitId: string): Stats {
  const trait = traitById(traitId);
  if (!trait) return stats;
  const out = { ...stats };
  for (const stat of STAT_KEYS) {
    const delta = trait.stats[stat];
    if (delta !== undefined) out[stat] = Math.max(1, out[stat] + delta);
  }
  return out;
}

/**
 * The most who can bear arms at once.
 *
 * Six, because six is what came off the knarr and every fight in the game is
 * balanced against a line that wide. The steading can grow past this — Phase
 * 6.2 — but the warband cannot, so growth buys you labour and never a bigger
 * army. A band that could simply out-number what came for it would make 2.3's
 * shield wall a matter of turning up with more bodies.
 */
export const SWORN_MAX = 6;

/** The ones who bear arms. Never more than SWORN_MAX. */
export function sworn(people: Person[]): Person[] {
  return living(people).filter((p) => p.bond === 'sworn').slice(0, SWORN_MAX);
}

/**
 * Who leads. The first living sworn in the roster — the one who stepped off
 * the knarr first, which the saga said was afterwards remembered. When the
 * leader falls, the next in that first-ashore order carries it: leadership
 * passes by seniority, never by vote, and never to a hand.
 */
export function leaderOf(people: Person[]): Person | undefined {
  return sworn(people)[0];
}

/** Everyone else the steading has taken in. They work; they never fight. */
export function hands(people: Person[]): Person[] {
  return living(people).filter((p) => p.bond !== 'sworn');
}

/** Whether the band could swear another. */
export function canSwear(people: Person[]): boolean {
  return sworn(people).length < SWORN_MAX;
}

export function makePerson(rng: Rng, id: string, bond: Person['bond'] = 'sworn'): Person {
  const woman = rng.chance(0.35);
  const name = rng.pick(woman ? WOMEN : MEN);
  const trait = rng.pick(TRAITS).id;
  const stats = applyTrait(rollStats(rng), trait);
  const maxHealth = 8 + stats.might * 2;

  return {
    id,
    name,
    byname: rng.pick(BYNAMES),
    age: rng.int(17, 44),
    stats,
    trait,
    health: maxHealth,
    maxHealth,
    morale: 70,
    bond,
    injuries: [],
    xp: 0,
    alive: true,
  };
}

/** The warband that steps off the knarr. Names are unique within the band. */
export function makeWarband(rng: Rng, size = WARBAND_SIZE): Person[] {
  const people: Person[] = [];
  const usedNames = new Set<string>();
  let guard = 0;

  while (people.length < size && guard++ < 200) {
    const person = makePerson(rng, `p${people.length + 1}`);
    if (usedNames.has(person.name)) continue;
    usedNames.add(person.name);
    people.push(person);
  }
  return people;
}

export function fullName(person: Person): string {
  return `${person.name} ${person.byname}`;
}

/** Stat after injuries, floored at 1. */
export function effectiveStat(person: Person, stat: keyof Stats): number {
  let value = person.stats[stat];
  for (const injury of person.injuries) value += injury.effect[stat] ?? 0;
  return Math.max(1, value);
}

export function living(people: Person[]): Person[] {
  return people.filter((p) => p.alive);
}

/** The best effective value of a stat in the band — who you send to do a thing. */
export function bestStat(people: Person[], stat: keyof Stats): number {
  const alive = living(people);
  if (alive.length === 0) return 0;
  return Math.max(...alive.map((p) => effectiveStat(p, stat)));
}

export function bestAt(people: Person[], stat: keyof Stats): Person | undefined {
  const alive = living(people);
  if (alive.length === 0) return undefined;
  return alive.reduce((best, p) =>
    effectiveStat(p, stat) > effectiveStat(best, stat) ? p : best,
  );
}

/** Count of living people whose trait carries a tag. */
export function countWithTag(people: Person[], tag: string): number {
  return living(people).filter((p) => traitById(p.trait)?.tags.includes(tag)).length;
}
