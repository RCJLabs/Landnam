// What makes a place worth holding. Pure data: src/sim/site.ts reads the
// ground, this file says what the reading means.
//
// The five measures are deliberately in tension. Good soil is open ground and
// open ground cannot be defended; a defensible crag grows nothing; a harbour
// wants sand and sand grows nothing either. There is no site that wins on
// everything, and that is the whole point of the choice.

export type Measure = 'water' | 'soil' | 'timber' | 'harbour' | 'defence';

export interface MeasureDef {
  id: Measure;
  name: string;
  /** One line, shown under the score. Says what it buys you. */
  meaning: string;
}

export const MEASURES: MeasureDef[] = [
  {
    id: 'water',
    name: 'Fresh water',
    meaning: 'A river or a spring. No water, no steading.',
  },
  {
    id: 'soil',
    name: 'Soil',
    meaning: 'Ground that will take barley and keep cattle.',
  },
  {
    id: 'timber',
    name: 'Timber',
    meaning: 'Wood within a day of the door — for walls, roofs and fire.',
  },
  {
    id: 'harbour',
    name: 'Harbour',
    meaning: 'Sheltered water to beach the knarr and work the nets.',
  },
  {
    id: 'defence',
    name: 'Defensibility',
    meaning: 'How many ways in there are for men who mean you harm.',
  },
];

/** Each measure runs 0..5. */
export const MEASURE_MAX = 5;

/** Fresh water below this cannot be settled at all. */
export const WATER_FLOOR = 1;

/** What a score reads as, worst first. Index by the score. */
export const SCORE_WORDS = ['none', 'poor', 'thin', 'fair', 'good', 'rich'];

export interface Verdict {
  /** Lowest total this verdict covers, out of 25. */
  from: number;
  label: string;
  line: string;
}

/**
 * Read worst-first; take the last one whose `from` you have cleared.
 *
 * Calibrated against 4,700 foundable hexes across twelve worlds: most ground
 * is hard ground, good ground is roughly one hex in twenty, and rich ground
 * is one in fifty. A verdict that called half the map "good" would be telling
 * the player nothing.
 */
export const VERDICTS: Verdict[] = [
  { from: 0, label: 'Bare ground', line: 'A place to die in, slowly.' },
  { from: 6, label: 'Hard ground', line: 'It could be held, by people with nothing better.' },
  { from: 8, label: 'Fair ground', line: 'A steading could stand here.' },
  { from: 11, label: 'Good ground', line: 'Land worth the crossing.' },
  { from: 14, label: 'Rich ground', line: 'The kind of place a saga starts in.' },
];

/**
 * The same five words, on the scale a COAST actually reads.
 *
 * The bands above are calibrated against a hex island, where a site totals a
 * mean of 7.4 (sd 1.53). A stretch of shore totals 14.2 (sd 2.21) — and not
 * because anything is broken. `stopSurrounds` gives every stretch a ring that
 * is two parts ocean, so every stretch has a harbour (mean 0.5 -> 4.1) and a
 * flank the sea holds for it (defence 2.0 -> 2.6). A coast IS a harbour; that
 * is what a coast is.
 *
 * But the WORD stopped carrying information. Measured over 260 stretches with
 * the hex bands: Rich ground 60%, Good ground 35%, Fair 4% — a player told
 * "Rich ground" almost everywhere cannot tell a strand worth holding from one
 * that is not, and 3.1's whole bar is that choosing where to settle is a real
 * decision. The totals DO spread (min 9, max 19, a wider absolute range than
 * the hex map's); only the words hid it.
 *
 * So the bands are re-cut at the same PERCENTILES the hex bands sit at, which
 * keeps the shape of the experience rather than the numbers: measured coast
 * quantiles p10=11, p64=15, p97=18, p99=19.
 */
export const COAST_VERDICTS: Verdict[] = [
  { from: 0, label: 'Bare ground', line: 'A place to die in, slowly.' },
  { from: 11, label: 'Hard ground', line: 'It could be held, by people with nothing better.' },
  { from: 15, label: 'Fair ground', line: 'A steading could stand here.' },
  { from: 18, label: 'Good ground', line: 'Land worth the crossing.' },
  { from: 19, label: 'Rich ground', line: 'The kind of place a saga starts in.' },
];

// --- Naming the steading ---

/** First element: what the place is, taken from the ground it stands on. */
export const NAME_ROOTS = [
  'Rav', 'Bjarn', 'Ulf', 'Stein', 'Ask', 'Eik', 'Hval', 'Orm', 'Val', 'Hrafn',
  'Grim', 'Sval', 'Thorn', 'Fisk', 'Elg',
];

/** Second element by the site's strongest measure — the name tells you why. */
export const NAME_SUFFIX: Record<Measure, string[]> = {
  water: ['á', 'brekka', 'lind'],
  soil: ['stead', 'garth', 'akr'],
  timber: ['holt', 'skog', 'lund'],
  harbour: ['vík', 'fjord', 'nes'],
  defence: ['borg', 'fell', 'klif'],
};
