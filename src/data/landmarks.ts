// The things a country is remembered by.
//
// A map of eighteen hundred hexes with nothing named on it is a field, not a
// country: every forest hex is "forest", every march line says "we moved on
// into hills", and a player who walked past the same waterfall three times
// has no way to know it was the same one. These are the fixed points that
// turn ground into somewhere — and because they can be picked out from a
// ridge miles off, they are what the coast is navigated BY.
//
// Data, not engine: adding a kind here is the whole job of adding a kind.

import type { Terrain } from '../state/types';

export interface LandmarkDef {
  id: string;
  /** The common noun, for a name like "the Split Rock". */
  noun: string;
  /** Ground it can stand on. */
  on: Terrain[];
  /** What the chronicle says on the day the band first stands under it. */
  blurb: string;
}

export const LANDMARKS: LandmarkDef[] = [
  {
    id: 'rock',
    noun: 'Rock',
    on: ['hills', 'mountains', 'meadow'],
    blurb: 'a standing rock split top to bottom, taller than the mast',
  },
  {
    id: 'falls',
    noun: 'Falls',
    on: ['valley', 'hills', 'mountains'],
    blurb: 'a fall of white water loud enough to talk over',
  },
  {
    id: 'burn',
    noun: 'Burn',
    on: ['forest'],
    blurb: 'a burnt wood, black trunks standing in new green',
  },
  {
    id: 'cairn',
    noun: 'Cairn',
    on: ['hills', 'meadow', 'mountains'],
    blurb: 'a cairn somebody piled long before us, and nobody here to say who',
  },
  {
    id: 'stack',
    noun: 'Stack',
    on: ['shore'],
    blurb: 'a sea stack standing off the beach with birds all over it',
  },
  {
    id: 'mere',
    noun: 'Mere',
    on: ['bog', 'valley'],
    blurb: 'a black mere with no bottom anyone could find',
  },
];

/** Name halves, so an instance is "Ravenstone Falls" rather than "Falls". */
export const LANDMARK_ROOTS = [
  'Raven', 'Grim', 'Bear', 'Wolf', 'Elk', 'Hawk', 'Storm', 'Frost', 'Ash',
  'Thorn', 'Salt', 'Blood', 'Cold', 'Long', 'Broad', 'High', 'Old', 'Grey',
];

/** And the qualities that get hung on them. */
export const LANDMARK_MARKS = [
  'Split', 'Broken', 'Leaning', 'Drowned', 'Burnt', 'Silent', 'Bright',
  'Crooked', 'Hollow', 'Wind-worn',
];

export function landmarkDef(id: string): LandmarkDef {
  const found = LANDMARKS.find((l) => l.id === id);
  if (!found) throw new Error(`no landmark kind: ${id}`);
  return found;
}
