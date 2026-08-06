// Enemies. They are Person objects like anyone else — same stats, same
// bynames, same renderer — because a person is one model in every mode.
// This file only describes how to roll one up.

import type { Stats } from '../state/types';

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
  weight: number;
}

export const FOE_ARCHETYPES: FoeArchetype[] = [
  {
    id: 'scout',
    kind: 'Scout',
    budget: 6,
    favours: ['wits', 'wits', 'spirit'],
    toughness: -2,
    weight: 10,
  },
  {
    id: 'raider',
    kind: 'Raider',
    budget: 8,
    favours: ['might', 'might', 'spirit'],
    toughness: 0,
    weight: 12,
  },
  {
    id: 'huscarl',
    kind: 'Huscarl',
    budget: 11,
    favours: ['might', 'spirit', 'craft'],
    toughness: 3,
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

export function archetypeById(id: string): FoeArchetype | undefined {
  return FOE_ARCHETYPES.find((a) => a.id === id);
}
