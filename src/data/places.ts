// The places. Pure data — sim/places.ts seeds them onto the map and settles
// what taking one is worth; adding a kind here never touches engine code.
//
// This is the audit's first finding made flesh: "go out under arms" had no
// destination, because nothing on the map was worth walking to. These are.
// The rich ones are guarded, the guarded ones are provocations, and every
// one is taken ONCE — a monastery does not restock.

import type { Place, Terrain } from '../state/types';
import type { LoreId } from './lore';

export type PlaceKind = Place['kind'];

export interface PlaceKindDef {
  id: PlaceKind;
  /** How the map and the site panel name it. */
  name: string;
  /** The site panel's line when you are standing on it. */
  blurb: string;
  /** What the deed button says. */
  deed: string;
  /** Terrain it can be seeded on. */
  ground: Terrain[];
  /** How far from the landing it is seeded, so the rich ones are a voyage. */
  minFromLanding: number;
  /**
   * Battle difficulty of whoever holds it, or null for an undefended place —
   * taking a wreck apart is a day's work, not a fight.
   */
  garrison: number | null;
  loot: { food: number; firewood: number; morale: number };
  /** A chance the taking teaches something. See data/lore. */
  teaches?: { lore: LoreId; odds: number };
  /**
   * What the coast thinks of an armed band that did this — a shift on the
   * NEAREST neighbour's standing, because word starts where the smoke is
   * seen. Nought for salvage nobody owns.
   */
  infamy: number;
  /** Chronicle line when it falls. Past tense; it goes in the saga. */
  sackLine: string;
}

export const PLACE_KINDS: PlaceKindDef[] = [
  {
    id: 'monastery',
    name: 'a house of the White Christ',
    blurb: 'Stone cells, a bell, and men who do not carry weapons. There is more in their store than in their yard.',
    deed: 'Fall on the house',
    ground: ['shore'],
    minFromLanding: 6,
    garrison: 1,
    loot: { food: 18, firewood: 4, morale: 8 },
    teaches: { lore: 'runes', odds: 0.5 },
    infamy: -6,
    sackLine: 'We fell on the house of the White Christ and carried off what generations had given it. The bell went into the sea.',
  },
  {
    id: 'town',
    name: 'a trading town',
    blurb: 'Jetties, warehouses, and a watch that is paid to be awake. Rich enough to be worth it, and it knows.',
    deed: 'Fall on the town',
    ground: ['shore', 'valley', 'meadow'],
    minFromLanding: 11,
    garrison: 4,
    loot: { food: 26, firewood: 16, morale: 10 },
    infamy: -16,
    sackLine: 'We took the trading town at a run and left it lighter by a winter of stores. The whole coast will hear of it.',
  },
  {
    id: 'wreck',
    name: 'a wreck on the strand',
    blurb: 'A hull broken-backed on the rocks, stripped by nobody yet. Good timber, and maybe better lessons.',
    deed: 'Break up the wreck',
    ground: ['shore'],
    minFromLanding: 3,
    garrison: null,
    loot: { food: 2, firewood: 9, morale: 2 },
    teaches: { lore: 'shipwright', odds: 0.35 },
    infamy: 0,
    sackLine: 'We broke the wreck up for her timber, and learned from her bones how she had been put together.',
  },
  {
    id: 'oreseam',
    name: 'a seam of bog iron',
    blurb: 'Orange water and heavy stone in the bank. Somebody who knew fire could make this worth a great deal.',
    deed: 'Work the seam',
    ground: ['bog', 'hills', 'mountains'],
    minFromLanding: 4,
    garrison: null,
    loot: { food: 0, firewood: 0, morale: 3 },
    teaches: { lore: 'smithing', odds: 0.8 },
    infamy: 0,
    sackLine: 'We worked the iron seam until we understood it, and marked the bank for the years to come.',
  },
];

export function placeKind(id: PlaceKind): PlaceKindDef {
  return PLACE_KINDS.find((k) => k.id === id) ?? PLACE_KINDS[0]!;
}
