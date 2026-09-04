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
      'The land gives more than it takes. Fewer strangers on the road, a shorter bite to the winter, a fuller hold when the keel touches sand — and your blows fall a little truer than theirs. Where a saga has room to become one.',
    odds: { spring: 0.87, ruled: 0.48 },
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
    odds: { spring: 0.65, ruled: 0.29 },
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
      'Lean ground and a long winter, men who have heard of you sooner than you would like, and every one of them a shade harder to put down. Nothing here is unfair. It is only that less of it goes your way.',
    odds: { spring: 0.38, ruled: 0.10 },
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
 * THE ARGUMENT FOR IT WAS RE-MADE ON 2026-08-20, because the old one had
 * quietly stopped being true. It read "As It Lies gives 28% a first spring,
 * which is not a game most people get to see the middle of" — and the winter
 * lever took As It Lies to 45%. A default resting on a figure that has moved
 * seventeen points is a judgement nobody has actually checked.
 *
 * So it was checked, at sixty sagas a country rather than the twenty the
 * long game normally runs, and the argument SURVIVED — it simply lives
 * somewhere else now. The lever fixed the first winter and did almost
 * nothing for the second:
 *
 *              avg saga   2nd winter   mead hall   friend   jarl
 *   fair       220 days      27/60       36/60      33/60   17/60
 *   even       119 days       9/60       17/60      12/60    5/60
 *   hard        74 days       2/60        3/60       5/60    2/60
 *
 * On the balanced terms, one band in seven reaches a second winter and one
 * in five ever makes a friend on that coast — so the hall, the Thing and the
 * jarldom are content a default player would almost never see. On A Fair
 * Country it is nearly half and better than half. That is the whole case:
 * the default is the country where the back half of this game happens, and
 * the hard truth is one menu tap away rather than the price of admission.
 *
 * And it is a BAR now rather than this paragraph — see "the country a player
 * gets without choosing" in test/balance.test.ts. The next time these
 * figures move, something fails instead of a comment going quietly stale,
 * which is what happened here.
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
 * Where the numbers above came from, so nobody has to guess later.
 *
 * THREE HUNDRED landings a setting, not sixty, and that is the whole lesson
 * of this figure's history. Latest: 87% / 65% / 38% published, measured at
 * 87% / 65% / 38% (262, 196 and 115 of 300 landings) on 2026-09-04.
 *
 * ALL SIX RESTATED 2026-09-04, FOR THE FLIP. The daily crewing stopped
 * reaching for the hunter by name and started asking the ground which food
 * job pays here (`crewsByOutput`, now on in all three shipped policies).
 * Spring went 84/58/30 -> 87/65/38 and ever-rule 30/23/7 -> 48/29/10 over the
 * same seeds.
 *
 * They do NOT move together, and the shape is the point: +3, +7, +8 on
 * spring. A fair country feeds a band whatever it does; the worse the ground,
 * the more it matters that you work the right part of it. Only ONE of the six
 * had actually broken its tolerance — A Fair Country's ever-rule, 48%
 * measured against 30% published — but all six are restated rather than the
 * one, because a published figure here is what the harness has just measured
 * and not the nearest number that still passes.
 *
 * RE-MEASURED AFTER 11.S1, 2026-09-03, and all three moved for one reason:
 * the shield wall stopped forming up in roster order. Rank used to be a
 * fighter's roster index, which is also `leaderOf`'s index and `bindKin`'s,
 * so the leader stood at the front of every fight and both kin pairs stood
 * shoulder to shoulder — an order measured WORSE THAN CHANCE (178 arena wins
 * in 300 against 218 for a line drawn at random). `sim/lineup.ts` forms both
 * walls by who can hold the front instead. Over the same 300 landings the
 * curve went 81% -> 84%, 55% -> 58%, 27% -> 30%.
 *
 * Two things worth noting about that. The three moved TOGETHER, by three
 * points each, which is what a change to the fight rather than to a country
 * should look like — and the gaps the names rest on, 26 and 28 points, did
 * not move at all. And As It Lies is the one that broke the bar rather than
 * drifting inside it: published 53 against a measured 58 is five points, and
 * the tolerance is five.
 *
 * RE-MEASURED ON THE COAST, 2026-08-28, and twice in the same day — which is
 * the honest record and worth keeping as one. The flag flipped in the morning
 * and the harness ran against the game that ships for the first time: reached
 * winter 93% / 68% / 50%, saw spring 83% / 52% / 25%. By the evening a coast
 * save had stopped carrying the hex island and the battle stream had been
 * re-keyed to the stretch it is fought on (both in 8.5's job 3), and the
 * curve settled at reached winter 96% / 72% / 56%, saw spring 83% / 56% / 31%.
 *
 * A FAIR COUNTRY did not move at all across either change — 83% both times,
 * against a published 86% — and As It Lies moved three points. Neither was
 * tuned to agree; they simply describe a game whose shape survived being
 * rebuilt underneath them, which is the most reassuring thing in this note.
 *
 * RE-MEASURED AFTER 9.1b, 2026-08-31, and A Fair Country moved for the first
 * time since it was written: 83% -> 81%, over the same 300 landings. Taking
 * the dash off the bar means the line closes ITSELF on a man with nothing
 * left to do (sim/footwork.ts), and closing is not free — a back-rank man out
 * of hand-axes used to stand safe doing nothing, and now he walks into the
 * wall where he can be hit. The arena reads the same direction and larger: a
 * formation bot goes 47/60 wins and 166 standing to 42 and 155.
 *
 * The published 86% was already three points optimistic and is now five, so
 * it is RESTATED to 81 rather than left to flatter the card. The other two did
 * not move: As It Lies 55%, A Hard Country 27%, both inside the slack.
 *
 * A Hard Country moved twice, 17% -> 25% -> 31%, and the direction has one
 * cause: a hard country's band dies to the ground it settled on, and on a
 * coast the settling gate is FRESH WATER rather than a five-measure total, so
 * the worst ground a hard band can talk itself onto is less bad. The gaps are
 * 27 and 25 points, still comfortably past the ±10 this harness can resolve,
 * which is what lets the three names differ at all.
 *
 * As It Lies promised 72% for a day and a half and was never within twenty
 * points of it. The 72 was written on 2026-08-22 off a sixty-seed reading,
 * on the same day it was measured — and at sixty seeds the standard error on
 * a rate near 0.7 is about six points, so a single sample can sit nine or
 * ten points off the truth and look like a result. Re-measured at three
 * hundred, the commit that published 72% was itself running at 52%. Nothing
 * regressed. The instrument was too coarse to set a promise with, and the
 * promise was set with it anyway.
 *
 * So: a published figure here is measured at `LANDNAM_SEEDS=300` and nothing
 * less. The suite still runs the bar at sixty, which is the right sample for
 * a TRIPWIRE — it catches unwinnable and walkover — and the wrong one for a
 * claim printed on the menu. The two jobs need different sample sizes and
 * this file was doing both with one.
 *
 * The gaps between the three are 33 and 36 points, both comfortably past the
 * ±10 this harness can resolve, which is the only reason the three names are
 * allowed to differ.
 *
 * These are the odds AS PLAYED — the harness bot pulls the winter lever, and
 * short commons is signposted on the steading panel the moment the mark says
 * the stores are short, so a bot that never touched it was measuring a game
 * an attentive player does not play.
 *
 * Reaching the first winter is 93% / 84% / 71%. The first two used to read
 * the same figure and no longer do, which is the sample rather than the game:
 * at sixty seeds they were indistinguishable.
 *
 * The jarldom figures come from the long game at ONE HUNDRED AND TWENTY
 * sagas a country, and they caught the same disease as the spring figures in
 * a place nobody had looked.
 *
 * They were published as 40% / 10% / 5% off a twenty-seed sample, and the bar
 * that guards them runs at twenty seeds too — so it agreed, and went on
 * agreeing. At sixty the same measurement reads 27% / 23% / 7%, which is not
 * a drift but a collapse: A Fair Country and As It Lies, thirty points apart
 * on the menu, four points apart in fact. At a hundred and twenty the
 * ordering comes back — 28% / 19% / 6% — and that recovery is the tell. A
 * jarldom is rare, rare events need sample, and twenty sagas cannot see one
 * setting from another.
 *
 * As It Lies was quoted at 15% rather than the 19% a hundred and twenty
 * landings gave, because two hundred and forty gave 14.6% and the larger
 * sample won.
 *
 * ALL THREE RESTATED 2026-08-28, when the hexes went — 30% / 23% / 7%, from
 * the same hundred and twenty sagas a country. What moved them is worth
 * writing down, because it is not the sample: `maybeFireEvent` derived its
 * roll from `key(party.at)`, which on a coast was the frozen landing hex, so
 * every band rolled the day's odds from the same constant wherever it stood.
 * Retiring the placeholder forced that key to become the STRETCH, and a pure
 * re-labelling of an RNG derive moved the three arms by 4.2, 4.1 and 5.8
 * points. Measured both ways rather than assumed: with the old key the same
 * build reads 34% / 19% / 13%.
 *
 * Note what that says about the instrument. The bar on these figures is eight
 * points, chosen as two standard errors at 120 sagas — and a change that
 * touched no rule at all moved every arm by most of that. The harness is
 * deterministic, so these are exact readings rather than draws, and the bar
 * cannot flake; but the figures are only as stable as the RNG labels they are
 * measured through, and this is the second time that has surprised somebody.
 *
 * ONE THING FOR A HUMAN. A Fair Country and As It Lies are now 30% and 23%,
 * seven points apart, where the menu had them thirty apart at 28% and 15%.
 * The two settings barely separate on "ever rule" any more. Spring still
 * separates them cleanly — 86% against 53% — so the SETTINGS are fine; it is
 * the jarldom figure that has stopped being a distinguishing number. Whether
 * to tune for that or to stop quoting it is a design call, not a measurement.
 *
 * The old note here said the twenty-seed sample was "a mistake worth naming"
 * and named it, and then the fix was to re-measure at sixty — which was
 * still not enough, and nothing said so for a day. That is the shape of this
 * whole item: every time the answer was "measure wider", and every time the
 * new sample was chosen by what was convenient rather than by what the
 * figure needed.
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
  // Ten in twenty is a true sentence nobody says out loud, and A Fair Country
  // landed on it the day the flip restated these figures. Said as a half it
  // takes the same shape as the sentence before it, and "them" cannot be
  // misread as the bands that saw the spring.
  const inTwentieths = inTwenty(def.odds.ruled);
  const ruled = def.odds.ruled < 0.03
    ? 'None of twenty ever ruled.'
    : inTwentieths === 'ten'
      ? 'One band in two ruled.'
      : `${cap(inTwentieths)} in twenty ruled.`;
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
