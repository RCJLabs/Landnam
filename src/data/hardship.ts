// How hard the country is. Pure data — every knob here is one the balance
// harness already reads, so a setting can be MEASURED rather than named by
// feel, and the blurbs below quote what was measured.
//
// Few levers, and all of them ones the game already turns for its own
// reasons: what finds you on the road, what comes for the steading, what the
// fire costs in deep winter, what came off the knarr — and, since 2026-08-13,
// one point on the dice of a fight.
//
// That last one was refused for a long time, on the grounds that a
// difficulty reaching into combat would make the shield wall mean something
// different at each setting and rob every measurement of the wall of its
// meaning. The objection was right about the risk and wrong about the cost,
// for a reason that is worth writing down rather than re-deriving: `newGame`
// defaults to BALANCED_HARDSHIP, where `steel` is 0, so every fixture that
// measures the wall — test/wall.test.ts, test/battle.test.ts, the whole
// battle suite — is played on terms where this knob does not exist. The
// setting moves the player's fights and touches none of the measurements.
//
// What the refusal cost, meanwhile, was the thing the settings are FOR: a
// player who reaches for the gentlest country because the fighting is going
// badly was handed fewer fights and not one easier one.

export type HardshipId = 'fair' | 'even' | 'hard';

export interface HardshipDef {
  id: HardshipId;
  name: string;
  /** What it is like, in the game's own voice. */
  blurb: string;
  /**
   * What the harness measured for this setting, AS NUMBERS.
   *
   * The prose the player reads is generated from these by `measuredLine`,
   * and the balance harness asserts these against what it has just measured.
   * Both halves matter and neither existed before 2026-08-19:
   *
   *   - the prose used to be hand-written beside the numbers, so the two
   *     could disagree and nothing would notice;
   *   - and the only bar on it was `expect(terms.measured.length)
   *     .toBeGreaterThan(10)`, which asserts that a claim EXISTS rather than
   *     that it is TRUE. The menu could have promised anything over ten
   *     characters long and the suite would have been satisfied.
   *
   * That matters here more than most places. This is the one screen where
   * the game tells a player what it is going to do to them before they
   * agree to it, and balance moved five times in a single day's work.
   */
  odds: {
    /** Fraction of bands that saw the first spring. */
    spring: number;
    /** Fraction that were ever proclaimed jarl. */
    ruled: number;
  };
  /** Multiplier on how often the road interrupts you. */
  stir: number;
  /** Multiplier on the chance a raid comes for the steading. */
  raid: number;
  /** Multiplier on what the fire costs once winter has closed in. */
  winter: number;
  /** Food and firewood off the knarr, as a multiplier on the standard load. */
  stores: number;
  /**
   * What the country is worth on the dice of a fight: added to OUR swings
   * and taken off theirs, so one point here is worth two across the field.
   *
   * Additive and small on purpose. A blow lands on 2d6 plus might against a
   * target number, so a single point is about fourteen points of whether it
   * lands — enough to feel, nowhere near enough to decide a fight on its
   * own. Zero on the balanced middle, which is what keeps it out of every
   * fixture: see the note at the head of this file.
   */
  steel: number;
}

export const HARDSHIPS: HardshipDef[] = [
  {
    id: 'fair',
    name: 'A Fair Country',
    blurb:
      'The land gives more than it takes. Fewer strangers on the road, a shorter bite to the winter, and a fuller hold when the keel touches sand. Where a saga has room to become one.',
    odds: { spring: 0.6, ruled: 0.2 },
    stir: 0.6,
    raid: 0.55,
    winter: 0.7,
    stores: 2.5,
    steel: 1,
  },
  {
    id: 'even',
    name: 'As It Lies',
    blurb:
      'The coast as it was found: what the sagas describe and what every number in this game was balanced against.',
    odds: { spring: 0.28, ruled: 0.05 },
    stir: 1,
    raid: 1,
    winter: 1,
    stores: 1,
    steel: 0,
  },
  {
    id: 'hard',
    name: 'A Hard Country',
    blurb:
      'Lean ground and a long winter, and men who have heard of you sooner than you would like. Nothing here is unfair. It is only that less of it goes your way.',
    odds: { spring: 0.12, ruled: 0.025 },
    stir: 1.3,
    raid: 1.35,
    winter: 1.15,
    stores: 0.7,
    steel: -1,
  },
];

/**
 * The setting a player who chooses nothing gets, and it is deliberately not
 * the one named for the real coast.
 *
 * "As It Lies" is exactly what its blurb says — the terms every number here
 * was balanced against — and the long-game harness finally measured what
 * those terms produce over five hundred days: eighty-two days a saga, four
 * mead halls in twenty, and one band in twenty ever ruling. That is a
 * defensible game and it is the one the tuning is FOR, but it is not a game
 * most people get to see the middle of. On A Fair Country the same twenty
 * sagas ran a hundred and fifty-three days, raised eleven mead halls and put
 * four jarls on the coast. So the default is the country where the thing
 * plays out, and the hard truth is one menu tap away rather than the price
 * of admission.
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
 * the spread. Latest: 62% / 27% / 12% seeing the first spring — gaps of 35
 * and 15 points, both comfortably past the ±10 this harness can resolve,
 * which is the only reason the three names are allowed to differ. Better
 * separated than the 60/25/7 these read before hardship reached the dice of
 * a fight, and properly ordered at the first winter too (87% / 78% / 73%),
 * which it had no way to be while every country's blows landed alike. The jarldom figures come from the long game, which runs
 * twenty seeds of the same worlds out to day 500 — and a count that small
 * is a "does the endgame happen", never a number that moved.
 */
export const MEASURED_ON = 'sixty landings, the same sixty for each';

export function hardshipById(id: string | undefined): HardshipDef {
  return HARDSHIPS.find((h) => h.id === id) ?? HARDSHIPS[1]!;
}

/**
 * The measured odds as the sentence the player reads.
 *
 * Generated rather than written beside the numbers, so the prose and the data
 * cannot drift apart — which they could, and silently, when `measured` was a
 * hand-typed string sitting next to the knobs it described.
 *
 * "One band in eight" rather than "12%" because this game says things in its
 * own voice, and because a fraction with a small denominator is a thing a
 * person can hold in their head while deciding.
 */
export function measuredLine(def: HardshipDef): string {
  const spring = asFraction(def.odds.spring);
  const ruled = def.odds.ruled < 0.03
    ? 'None of twenty ever ruled.'
    : `${cap(inTwenty(def.odds.ruled))} in twenty ruled.`;
  return `${cap(spring.n)} ${spring.n === 'one' ? 'band' : 'bands'} in ${spring.d} saw the first spring. ${ruled}`;
}

/** Number words, which is as far as this needs to count. */
const WORDS = [
  'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** How many in twenty, in words. */
function inTwenty(fraction: number): string {
  return WORDS[Math.max(0, Math.min(20, Math.round(fraction * 20)))]!;
}

/**
 * The tidiest small "n in d" for a fraction.
 *
 * Denominators a person reads without effort, and the one whose rounding is
 * least wrong is chosen — so 0.28 reads "three in ten" rather than
 * "six in twenty", and 0.12 reads "one in eight" rather than "one in ten".
 */
function asFraction(fraction: number): { n: string; d: string } {
  const clamped = Math.max(0, Math.min(1, fraction));
  let best = { d: 20, n: 1, err: Infinity };
  for (const d of [3, 4, 5, 8, 10, 20]) {
    const n = Math.round(clamped * d);
    if (n < 1) continue;
    const err = Math.abs(n / d - clamped);
    // Ties go to the smaller denominator, which is the easier sentence.
    if (err < best.err - 1e-9) best = { d, n, err };
  }
  return { n: WORDS[best.n] ?? `${best.n}`, d: WORDS[best.d] ?? `${best.d}` };
}
