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
      'The land gives more than it takes. Fewer strangers on the road, a shorter bite to the winter, and a fuller hold when the keel touches sand. Where a saga has room to become one.',
    measured: 'Two bands in three saw the first spring. Three in twenty ruled.',
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
    measured: 'Three bands in ten saw the first spring. One in twenty ruled.',
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
    measured: 'One band in twelve saw the first spring.',
    stir: 1.3,
    raid: 1.35,
    winter: 1.15,
    stores: 0.7,
  },
];

/**
 * The setting a player who chooses nothing gets, and it is deliberately not
 * the one named for the real coast.
 *
 * "As It Lies" is exactly what its blurb says — the terms every number here
 * was balanced against — and the long-game harness finally measured what
 * those terms produce over five hundred days: eighty-six days a saga, and
 * one band in twenty ever ruling. That is a defensible game and it is the
 * one the tuning is FOR, but it is not a game most people get to see the
 * middle of. On A Fair Country the same forty sagas ran a hundred and
 * sixty-one days, raised thirteen mead halls and put three jarls on the
 * coast. So the default is the country where the thing plays out, and the
 * hard truth is one menu tap away rather than the price of admission.
 */
export const DEFAULT_HARDSHIP: HardshipId = 'fair';

/**
 * The terms every other number in this repo was tuned against, and what a
 * `newGame` with no setting named gets.
 *
 * Kept SEPARATE from the player-facing default on purpose. Pointing
 * `newGame`'s parameter default at DEFAULT_HARDSHIP would have moved the
 * baseline of every fixture in the suite the moment the menu default
 * changed — softer worlds under tests written to measure the balanced one,
 * with nothing failing to say so.
 */
export const BALANCED_HARDSHIP: HardshipId = 'even';

/**
 * Where the numbers above came from, so nobody has to guess later: the
 * balance harness runs its sixty seeds through every setting and prints
 * the spread. Latest: 67% / 30% / 8% seeing the first spring — gaps of 37
 * and 22 points, both comfortably past the ±10 this harness can resolve,
 * which is the only reason the three names are allowed to differ. The
 * jarldom figures come from the long game, which runs twenty seeds of the
 * same worlds out to day 500.
 */
export const MEASURED_ON = 'sixty landings, the same sixty for each';

export function hardshipById(id: string | undefined): HardshipDef {
  return HARDSHIPS.find((h) => h.id === id) ?? HARDSHIPS[1]!;
}
