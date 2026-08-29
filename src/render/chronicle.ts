// The saga, arranged as a chronicle rather than a list.
//
// ## What was wrong with it
//
// `state.saga` is the game's memory and it reached the screen as eighty-odd
// undifferentiated lines with a bare day number down the left. Measured on a
// real run of sixty-one days: 87 entries, of which 61 were `plain` — and the
// screenful a player actually lands on read
//
//     51  We made camp and cut 1 of firewood.
//     53  a long swell coming in with no wind behind it — a gale by morning
//     53  We made camp and cut 1 of firewood.
//     54  We turned over black timber for half a day and found only black timber.
//     55  Thorbjorn's shield-arm broken had mended.
//     55  We made camp and cut 1 of firewood.
//
// The camp line five times in one screen, the forecast twice word for word,
// and a man's arm healing given exactly the same weight as a night's
// firewood. The whole of a saga's shape — years, winters, the things worth
// telling — was in the data and none of it was on the page.
//
// ## What a chronicle does instead
//
// Nothing is dropped and nothing that matters is moved. That distinction is
// worth being exact about: the saga is in the save, a player's run is their
// own record of it, and a view that quietly deleted entries would be editing
// somebody's history to make it read better. Every entry still appears, with
// its day and its count; what a repeated ROUTINE line loses is its place in
// the queue between other routine lines, which is not information.
//
// Three things a scribe does, all of them arrangement:
//
//   - THE YEAR IS THE UNIT. A chronicle is kept by season and year, not by
//     day: "the first winter" is how this game already talks about its own
//     clock (`wintersStood`, "survive two winters"), and it is how a player
//     remembers a run.
//   - THE SAME NIGHT, SAID ONCE. Fourteen identical camps in a season are
//     one line and "×14", gathered to the night it started. Only the DAY'S
//     BUSINESS gathers: a told line — good, grim, or saga — never folds and
//     never moves, because their order is the whole point of a chronicle
//     and two of them with the same words are two things that happened.
//   - WEIGHT FOLLOWS MATTER. The scribe writes everything down and gives the
//     colour and the capital to what deserves it. Routine goes quiet;
//     `good`, `grim` and `saga` keep their voice.
//
// Pure and tested. `cards/closing.ts` only draws.

import { SEASON_LENGTH, seasonOf, yearOf } from '../sim/calendar';
import type { SagaEntry, SagaTone, Season } from '../state/types';

/** One line of the chronicle, after consecutive repeats are folded. */
export interface ChronicleLine {
  day: number;
  text: string;
  tone: SagaTone;
  /** How many nights running said the same thing. 1 unless folded. */
  times: number;
}

/** A season's worth of it, under its own heading. */
export interface ChronicleBlock {
  year: number;
  season: Season;
  /** "The first winter" — the way this game already names its own clock. */
  heading: string;
  lines: ChronicleLine[];
}

const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

/** "the first winter", "the eleventh summer". */
export function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

/**
 * What a season of a year is called in the chronicle.
 *
 * A YEAR HERE IS THE GAME'S YEAR, which begins in high summer on day 1 —
 * `calendar.ts` says so and the whole clock is built on it. So "the first
 * winter" is the winter of year one, which is the one the player has been
 * warned about since the opening card, and the words on the page are the
 * same words the game has always used for it.
 */
export function headingFor(day: number): string {
  const season = seasonOf(day);
  return `The ${ordinal(yearOf(day))} ${season}`;
}

/**
 * A line that is worth a capital and a colour.
 *
 * Everything a scribe writes is true; not everything is worth illuminating.
 * `plain` is the day's business — camps, firewood, a forecast — and the
 * other three tones are the run's story.
 */
export function isTold(tone: SagaTone): boolean {
  return tone !== 'plain';
}

/**
 * The saga, arranged.
 *
 * Entries arrive in the order they happened and leave in it: the only things
 * that change are the grouping and the folding of ADJACENT repeats.
 */
export function chronicle(saga: readonly SagaEntry[]): ChronicleBlock[] {
  const blocks: ChronicleBlock[] = [];
  for (const entry of saga) {
    const year = yearOf(entry.day);
    const season = seasonOf(entry.day);
    let block = blocks[blocks.length - 1];
    if (!block || block.year !== year || block.season !== season) {
      block = { year, season, heading: headingFor(entry.day), lines: [] };
      blocks.push(block);
    }
    // THE DAY'S BUSINESS GATHERS; THE STORY NEVER MOVES.
    //
    // Measured on a real run: a season's page read camp, forecast, camp,
    // forecast, camp — the same two sentences alternating down the screen,
    // so an adjacent-only fold caught none of them. Within a season the
    // routine folds to its first night whatever fell between, because the
    // exact interleaving of one night's firewood with the next carries
    // nothing a player reads.
    //
    // A TOLD line never folds and never moves. Those are the run's story,
    // their order is the whole point of a chronicle, and two of them with
    // the same words are two things that happened.
    const fold = isTold(entry.tone)
      ? undefined
      : block.lines.find((l) => l.text === entry.text && l.tone === entry.tone);
    if (fold) {
      // The fold keeps the FIRST day, because that is when it started.
      fold.times += 1;
      continue;
    }
    block.lines.push({ day: entry.day, text: entry.text, tone: entry.tone, times: 1 });
  }
  return blocks;
}

/**
 * Which day of its own season a day is, 1-based.
 *
 * The bare day number was the only mark on a line and it is the least
 * useful one a chronicle can carry: "day 53" means nothing without counting
 * back through the seasons, which is exactly the arithmetic the heading now
 * does for the reader.
 */
export function dayOfSeason(day: number): number {
  return ((Math.max(1, day) - 1) % SEASON_LENGTH) + 1;
}

/** How much of a run is worth telling, for the count under the title. */
export function told(saga: readonly SagaEntry[]): number {
  return saga.filter((e) => isTold(e.tone)).length;
}
