// The seven things a person can spend a day on. Pure data — sim/colony.ts
// resolves these into stockpiles, so adding a job never touches engine code.
//
// Every job leans on ONE stat and ONE measure of the ground. That pairing is
// the whole design: a site is good at some jobs and bad at others, and your
// people are good at some jobs and bad at others, and the interesting move is
// finding where those two agree.

import type { Measure } from './sites';
import type { Stats } from '../state/types';

export type JobId = 'farmer' | 'hunter' | 'fisher' | 'woodcutter' | 'builder' | 'warrior' | 'healer';

/**
 * What a day's work adds to.
 *
 * `care` is the odd one out and deliberately so: it is not a stockpile that
 * survives the night. A day of tending is spent the day it is given — it
 * speeds what is mending and keeps what is going round the hall from going
 * round it faster. See sim/sickness.ts.
 */
export type Produce = 'food' | 'firewood' | 'shelter' | 'watch' | 'care';

export interface JobDef {
  id: JobId;
  name: string;
  /** Third person, for the saga and the panel. */
  blurb: string;
  stat: keyof Stats;
  /** The site measure that scales it. */
  measure: Measure;
  produces: Produce;
  /** Output at measure 0 — what the job is worth on ground that fights you. */
  floor: number;
  /** Added per point of the governing measure. */
  perPoint: number;
  /**
   * How much the season owns this job, 0..1. Nothing grows in winter, so a
   * farmer is entirely at its mercy; a woodcutter barely notices it and a
   * warrior not at all. Without this the fields would feed you through
   * midwinter and the whole clock would stop mattering.
   */
  seasonal: number;
  /**
   * What this job puts in a person's hands, for the picture to draw.
   *
   * Data rather than a switch in a renderer, because that is the rule for
   * everything else a job carries (CLAUDE.md: adding content must never mean
   * touching engine code). `render/gear.ts` knows how to draw each of these
   * and nothing else needs to.
   *
   * A warrior has none, and that is not an omission: his gear is the shield
   * and spear every sworn man already carries, so giving him a tool as well
   * would draw him holding two things he does not have.
   */
  tool?: ToolId;
}

/** The tools a job can put in a hand. `render/gear.ts` draws them. */
export type ToolId = 'sickle' | 'bow' | 'net' | 'axe' | 'adze' | 'herbs';

export const JOBS: JobDef[] = [
  {
    id: 'farmer',
    tool: 'sickle',
    name: 'Farmer',
    blurb: 'Breaks ground, sows, and keeps the beasts.',
    stat: 'craft',
    measure: 'soil',
    produces: 'food',
    // Farming bare rock returns nothing at all; farming a valley is the best
    // food in the game. No other job has that spread — and none loses more to
    // the winter.
    floor: 0,
    perPoint: 0.42,
    seasonal: 1,
  },
  {
    id: 'hunter',
    tool: 'bow',
    name: 'Hunter',
    blurb: 'Works the tree line for whatever moves in it.',
    stat: 'wits',
    measure: 'timber',
    produces: 'food',
    // Game lives in cover, but a hunter eats something wherever you put them.
    floor: 0.5,
    perPoint: 0.22,
    seasonal: 0.7,
  },
  {
    id: 'fisher',
    tool: 'net',
    name: 'Fisher',
    blurb: 'Sets nets and lines in whatever water there is.',
    stat: 'wits',
    measure: 'harbour',
    produces: 'food',
    // Water keeps giving longer into the year than ground does.
    floor: 0.15,
    perPoint: 0.38,
    seasonal: 0.5,
  },
  {
    id: 'woodcutter',
    tool: 'axe',
    name: 'Woodcutter',
    blurb: 'Fells, splits and stacks against the winter.',
    stat: 'might',
    measure: 'timber',
    produces: 'firewood',
    floor: 0.2,
    perPoint: 0.4,
    // Short days, deep snow, frozen timber. A cutter still works in winter,
    // but at well under half — otherwise the woodpile never has to be built
    // ahead of time and the season has no teeth.
    seasonal: 0.45,
  },
  {
    id: 'builder',
    tool: 'adze',
    name: 'Builder',
    blurb: 'Turf, timber and stone — the walls that keep the cold out.',
    stat: 'craft',
    measure: 'timber',
    produces: 'shelter',
    // A builder has to finish something inside a season or the queue is
    // decoration: this puts the cheapest building at about a week of one
    // pair of hands.
    floor: 0.35,
    perPoint: 0.18,
    seasonal: 0.3,
  },
  {
    id: 'warrior',
    name: 'Warrior',
    blurb: 'Stands the watch, and is ready when it is needed.',
    stat: 'might',
    measure: 'defence',
    produces: 'watch',
    floor: 0.25,
    perPoint: 0.14,
    seasonal: 0,
  },
  {
    id: 'healer',
    tool: 'herbs',
    name: 'Healer',
    blurb: 'Tends the sick, sets what is broken, and keeps the hall clean.',
    stat: 'wits',
    // Fresh water, because that is what tending the sick actually runs on and
    // because every job in this file leans on one measure of the ground.
    measure: 'water',
    produces: 'care',
    // Worth something on any site — a healer with a bucket is still a healer —
    // and worth a great deal beside clean water.
    floor: 0.35,
    perPoint: 0.3,
    // Illness does not take the winter off. This is the only job the season
    // cannot touch except the warrior, and for the same reason: what it works
    // on is people, not ground.
    seasonal: 0,
  },
];

export function jobById(id: string): JobDef | undefined {
  return JOBS.find((j) => j.id === id);
}

/** Shelter caps here: turf and timber only keep out so much. */
export const SHELTER_MAX = 6;
/**
 * Firewood a point of shelter saves each night.
 *
 * Raised from 0.5 after the long-game harness showed the balanced country
 * was unplayable past its first winter: fourteen sagas averaging sixty-six
 * days, not one reaching a second winter, no fight after day 169 at all.
 *
 * The three levers the death table had been naming for three audits —
 * winter sickness, bereavement, grief — were swept first and moved NOTHING:
 * two winters sat at 10% through every one of them. Despair was a symptom,
 * not the disease. A band that misses the winter mark takes eight morale a
 * day for hunger and seven for cold, plus wounds, so it dies of everything
 * at once and despair merely gets there first.
 *
 * The disease was arithmetic. A winter night burns six firewood and more in
 * a deep year; four cutters make about seven a day; and at 0.5 a whole
 * steading's shelter took only three off the night, so the mark was
 * unreachable for six people and the first winter killed four bands in five
 * however well they played.
 *
 * The first cut of this went to 1.0 on survival numbers alone, and it was
 * wrong in a way only a second measurement caught. SHELTER_MAX is six, so
 * 1.0 means a fully built steading cancels an ordinary winter's burn
 * OUTRIGHT — and the winter mark, the promise the whole colony half of the
 * game rests on, went with it. Over twenty-four winters, heeding the mark
 * against ignoring it: 19 against 6 at 0.7, 19 against 8 at 0.8, and 19
 * against 17 at 1.0. At 1.0 preparing for winter had stopped mattering.
 * That is a worse game than a hard one.
 *
 * 0.8 is where both readings are honest: a full steading takes four-fifths
 * off an ordinary night and nothing like all of a deep one, so the roof is
 * most of the answer to winter and never the whole of it. Measured on the
 * curve at 30% of bands seeing spring on the balanced terms, against 22%
 * before — and the mark still separates the prepared from the deaf by
 * eleven winters in twenty-four.
 */
export const SHELTER_SAVES = 0.8;

/** Watch caps here, and decays — a watch not kept is no watch at all. */
export const WATCH_MAX = 6;
export const WATCH_DECAY = 0.5;
/** Each point of watch cuts this share off the chance of being surprised. */
export const WATCH_QUIET = 0.07;

// --- The local ground ---

/** What a plot of the steading's own land is. */
export type PlotKind = 'hall' | 'field' | 'wood' | 'water' | 'rough' | 'watchpost';

export interface PlotDef {
  kind: PlotKind;
  name: string;
  fill: string;
  edge: string;
  /** Jobs whose work happens on this kind of ground. */
  worked: JobId[];
}

export const PLOTS: Record<PlotKind, PlotDef> = {
  hall: { kind: 'hall', name: 'The hall', fill: '#4a3b28', edge: '#d3a441', worked: ['builder'] },
  field: { kind: 'field', name: 'Field', fill: '#7d9150', edge: '#697b43', worked: ['farmer'] },
  wood: { kind: 'wood', name: 'Wood', fill: '#3f5a35', edge: '#33492b', worked: ['woodcutter', 'hunter'] },
  water: { kind: 'water', name: 'Water', fill: '#2e5468', edge: '#244354', worked: ['fisher'] },
  rough: { kind: 'rough', name: 'Rough', fill: '#6d6446', edge: '#57503a', worked: [] },
  watchpost: { kind: 'watchpost', name: 'The watch', fill: '#5a4535', edge: '#b23b2e', worked: ['warrior'] },
};
