// How hard the country is. Pure data — every knob here is one the balance
// harness already reads, so a setting can be MEASURED rather than named by
// feel, and the blurbs below quote what was measured.
//
// Deliberately few levers, and all of them ones the game already turns for
// its own reasons: what finds you on the road, what comes for the steading,
// what the fire costs in deep winter, and what came off the knarr. A
// difficulty that reached further in — into the dice of a fight, say —
// would make the shield wall mean something different at each setting, and
// then no measurement of the wall would mean anything at all.

export type HardshipId = 'fair' | 'even' | 'hard';

export interface HardshipDef {
  id: HardshipId;
  name: string;
  /** What it is like, in the game's own voice. */
  blurb: string;
  /**
   * What the harness actually measured for this setting, in plain words.
   * Shown to the player, and asserted non-empty by a content lint: a
   * difficulty whose labels are not measured is a lie told three times.
   */
  measured: string;
  /** Multiplier on how often the road interrupts you. */
  stir: number;
  /** Multiplier on the chance a raid comes for the steading. */
  raid: number;
  /** Multiplier on what the fire costs once winter has closed in. */
  winter: number;
  /** Food and firewood off the knarr, as a multiplier on the standard load. */
  stores: number;
}

export const HARDSHIPS: HardshipDef[] = [
  {
    id: 'fair',
    name: 'A Fair Country',
    blurb:
      'The land gives more than it takes. Fewer strangers on the road, a shorter bite to the winter, and a fuller hold when the keel touches sand. For learning the shape of the thing.',
    measured: 'Three bands in four saw the first spring.',
    stir: 0.6,
    raid: 0.55,
    winter: 0.7,
    stores: 2.5,
  },
  {
    id: 'even',
    name: 'As It Lies',
    blurb:
      'The coast as it was found: what the sagas describe and what every number in this game was balanced against.',
    measured: 'One band in four saw the first spring.',
    stir: 1,
    raid: 1,
    winter: 1,
    stores: 1,
  },
  {
    id: 'hard',
    name: 'A Hard Country',
    blurb:
      'Lean ground and a long winter, and men who have heard of you sooner than you would like. Nothing here is unfair. It is only that less of it goes your way.',
    measured: 'One band in ten saw the first spring.',
    stir: 1.3,
    raid: 1.35,
    winter: 1.15,
    stores: 0.7,
  },
];

export const DEFAULT_HARDSHIP: HardshipId = 'even';

/**
 * Where the numbers above came from, so nobody has to guess later: the
 * balance harness runs its sixty seeds through every setting and prints
 * the spread. Measured 75% / 27% / 10% seeing the first spring — gaps of
 * 48 and 17 points, both comfortably past the ±10 this harness can
 * resolve, which is the only reason the three names are allowed to differ.
 */
export const MEASURED_ON = 'sixty landings, the same sixty for each';

export function hardshipById(id: string | undefined): HardshipDef {
  return HARDSHIPS.find((h) => h.id === id) ?? HARDSHIPS[1]!;
}
