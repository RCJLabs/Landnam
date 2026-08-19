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
  /**
   * How much your WORD changes the odds of meeting this one.
   *
   * A coast that has heard about you stops sending the men it can spare and
   * starts sending the men it cannot. Positive means a fearsome reputation
   * brings more of them; negative means it drives them away — nobody's
   * cousins turn out against a band with a name.
   *
   * This lives here because it used to live in `sim/word.ts` as
   * `if (archetype.id === 'huscarl')`, which meant adding a foe meant editing
   * the engine — against this project's oldest rule. Now a new archetype is
   * this file and nothing else, and a test holds the engine to it.
   */
  renown: number;
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
    renown: 0,
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
    renown: 1,
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
    renown: 0,
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
    renown: 3,
  },
  /*
   * The four below are the coast filling out. Each one is meant to make a
   * DIFFERENT fight rather than a differently-statted one, using what the
   * field already has: a volley before contact, numbers against a wall, one
   * man who has to be dealt with, and somebody who will not stand still.
   */
  {
    // Cautious opens with a throw when the lane is clear, so three of them is
    // a real volley: close fast or eat it.
    id: 'spearman',
    kind: 'Spearman',
    budget: 7,
    favours: ['wits', 'might', 'wits'],
    toughness: -1,
    temperament: 'cautious',
    throws: 3,
    weight: 8,
    renown: 0,
  },
  {
    // Somebody's cousins, turned out with what they had. Cheap and many,
    // which is what makes a shield wall worth forming — and they stop coming
    // as your word grows, because farmers do not march against a name.
    id: 'bondi',
    kind: 'Bondi',
    budget: 4,
    favours: ['craft', 'might'],
    toughness: -2,
    temperament: 'aggressive',
    throws: 0,
    weight: 14,
    renown: -2,
  },
  {
    // One man who has to be dealt with. Rare, and rarer still on a quiet
    // coast — he comes looking once there is something worth the walk.
    id: 'wolfcoat',
    kind: 'Wolf-coat',
    budget: 10,
    favours: ['might', 'might', 'spirit'],
    toughness: 2,
    temperament: 'aggressive',
    throws: 0,
    weight: 3,
    renown: 2,
  },
  {
    // Hunts whoever is already busy and will not be the first into contact.
    // The reason to keep a flank clear rather than pile everyone forward.
    id: 'outlaw',
    kind: 'Outlaw',
    budget: 7,
    favours: ['wits', 'spirit'],
    toughness: -1,
    temperament: 'flanker',
    throws: 2,
    weight: 7,
    renown: 0,
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
