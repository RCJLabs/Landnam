// What a warrior carries away from a bad hour. Pure data: the sim rolls on
// this table when someone is dragged off the field alive.
//
// Penalties are deliberately felt. An injured veteran is still worth more
// than a green replacement, but not the warrior they were.

import type { Injury } from '../state/types';

export type InjuryTemplate = Omit<Injury, 'id'>;

export const INJURIES: InjuryTemplate[] = [
  {
    label: 'Shield-arm broken',
    effect: { might: -2 },
    heals: 24,
  },
  {
    label: 'Gash across the brow',
    effect: { wits: -1 },
    heals: 12,
  },
  {
    label: 'Ribs stove in',
    effect: { might: -1, spirit: -1 },
    heals: 18,
  },
  {
    label: 'Hamstrung',
    effect: { might: -1, wits: -1 },
    heals: 20,
  },
  {
    label: 'Hand half-crushed',
    effect: { craft: -2 },
    heals: 16,
  },
  {
    label: 'Something gone behind the eyes',
    effect: { spirit: -2 },
    heals: 26,
  },
  {
    label: 'Wound that will not close',
    effect: { might: -1, craft: -1 },
    heals: 22,
  },
];

/** Some wounds never mend. Rolled rarely; heals is set absurdly high. */
export const LASTING: InjuryTemplate[] = [
  {
    label: 'Lost an eye',
    effect: { wits: -2 },
    heals: 9999,
  },
  {
    label: 'Walks with a stick now',
    effect: { might: -1, spirit: -1 },
    heals: 9999,
  },
];

/** How a fighter died, for the saga. */
export const DEATHS = [
  'cut down in the press',
  'took a spear and did not get up',
  'bled out before the fight was over',
  'went under and was not seen again',
  'died of the wound that night',
];
