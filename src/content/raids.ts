// Raid definitions: battlefield templates as ASCII art (one char per hex,
// rows = offset rows), enemy rosters by danger tier, and loot.
//
// Template chars:
//   .  grass      s  sand       ,  floor (inside buildings)
//   ~  water      #  wall       ^  rock (impassable, blocks sight)
//   P  player deploy (sand)     E  enemy deploy (grass/floor)

import { Effect } from '../sim/types';

export interface RaidDef {
  id: string;
  title: string;
  template: string[];
  /** Enemy archetype ids per danger tier (index 0-3). */
  roster: [string[], string[], string[], string[]];
  lootText: string;
  loot: Effect[];
  /** Extra fame for winning. */
  fame: number;
}

export const RAIDS: RaidDef[] = [
  {
    id: 'monastery',
    title: 'Raid on the Monastery',
    template: [
      '~~ssss......',
      '~sssP....E..',
      '~ssP...##,#.',
      '~ssP...#,,E.',
      '~sssP..#,E#.',
      '~ssP...##,#.',
      '~sss....E...',
      '~~ssss......',
    ],
    roster: [
      ['monk', 'monk', 'levy', 'levy'],
      ['monk', 'monk', 'levy', 'levy', 'warrior'],
      ['monk', 'levy', 'levy', 'warrior', 'warrior'],
      ['levy', 'levy', 'warrior', 'warrior', 'huscarl'],
    ],
    lootText: 'Chalices, candle-silver, and the reliquary’s hoard.',
    loot: [
      { t: 'res', silver: 18, food: 4 },
      { t: 'fame', amount: 8 },
    ],
    fame: 8,
  },
  {
    id: 'village',
    title: 'Raid on the Village',
    template: [
      '~~ss........',
      '~ssP...E....',
      '~sP...#,#.E.',
      '~ssP..,,,...',
      '~sP...#,#E..',
      '~ssP....E...',
      '~sss.....E..',
      '~~ss........',
    ],
    roster: [
      ['levy', 'levy', 'levy', 'warrior'],
      ['levy', 'levy', 'warrior', 'warrior'],
      ['levy', 'warrior', 'warrior', 'warrior', 'levy'],
      ['warrior', 'warrior', 'warrior', 'huscarl', 'levy'],
    ],
    lootText: 'Winter stores, hack-silver, and smoked fish.',
    loot: [
      { t: 'res', silver: 10, food: 10, water: 6 },
      { t: 'fame', amount: 5 },
    ],
    fame: 5,
  },
];

export function raidById(id: string): RaidDef {
  const def = RAIDS.find((r) => r.id === id);
  if (!def) throw new Error(`unknown raid ${id}`);
  return def;
}
