// Enemies. They are Person objects like anyone else — same stats, same
// bynames, same renderer — because a person is one model in every mode.
// This file only describes how to roll one up.

import type { Stats } from '../state/types';

/**
 * How a foe fights.
 *   aggressive — closes and swings, and keeps swinging
 *   cautious   — throws from range, shields up when hurt, dislikes being
 *                outnumbered and will give ground to fix it
 *   flanker    — hunts warriors who are already engaged, avoids being the
 *                first one into contact
 */
export type Temperament = 'aggressive' | 'cautious' | 'flanker';

export interface FoeArchetype {
  id: string;
  /** Shown instead of a trait name on the fighter card. */
  kind: string;
  /** Points spread over the four stats, on top of a base of 1 each. */
  budget: number;
  /** Leans the spread toward these stats. */
  favours: (keyof Stats)[];
  /** Extra health beyond the might-derived base. */
  toughness: number;
  temperament: Temperament;
  /** Spears and hand-axes carried into the fight. */
  throws: number;
  weight: number;
}

export const FOE_ARCHETYPES: FoeArchetype[] = [
  {
    id: 'scout',
    kind: 'Scout',
    budget: 6,
    favours: ['wits', 'wits', 'spirit'],
    toughness: -2,
    temperament: 'cautious',
    throws: 2,
    weight: 10,
  },
  {
    id: 'raider',
    kind: 'Raider',
    budget: 8,
    favours: ['might', 'might', 'spirit'],
    toughness: 0,
    temperament: 'aggressive',
    throws: 1,
    weight: 12,
  },
  {
    id: 'skirmisher',
    kind: 'Skirmisher',
    budget: 8,
    favours: ['wits', 'might', 'spirit'],
    toughness: -1,
    temperament: 'flanker',
    throws: 1,
    weight: 9,
  },
  {
    id: 'huscarl',
    kind: 'Huscarl',
    budget: 11,
    favours: ['might', 'spirit', 'craft'],
    toughness: 3,
    temperament: 'aggressive',
    throws: 0,
    weight: 5,
  },
];

/** Foe names are drawn from the same Norse well — these are neighbours. */
export const FOE_NAMES = [
  'Hrafn', 'Ketil', 'Bui', 'Starkad', 'Vagn', 'Glum', 'Hallvard', 'Solvi',
  'Refr', 'Thrand', 'Eyjolf', 'Kalf', 'Hogni', 'Vestein', 'Bard', 'Ozur',
];

export const FOE_BYNAMES = [
  'the Hungry', 'Blackteeth', 'the Landless', 'Crookback', 'the Loud',
  'Ill-Luck', 'the Thin', 'Wolf-Jaw', 'the Stranger', 'Cold-Iron',
];

/**
 * The men who LEAD bands wear heavier names than the men who fill them.
 * A champion keeps his given name and trades up his byname — the byname is
 * the reputation, and reputation is exactly what a named raid leader is.
 */
export const CHAMPION_BYNAMES = [
  'Skull-Splitter', 'the Bloody', 'Hard-Counsel', 'Ship-Burner',
  'the Old Wolf', 'Battle-Glad', 'Iron-Beard', 'the Unforgiven',
];

export function archetypeById(id: string): FoeArchetype | undefined {
  return FOE_ARCHETYPES.find((a) => a.id === id);
}
