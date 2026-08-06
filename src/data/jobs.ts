// The six things a person can spend a day on. Pure data — sim/colony.ts
// resolves these into stockpiles, so adding a job never touches engine code.
//
// Every job leans on ONE stat and ONE measure of the ground. That pairing is
// the whole design: a site is good at some jobs and bad at others, and your
// people are good at some jobs and bad at others, and the interesting move is
// finding where those two agree.

import type { Measure } from './sites';
import type { Stats } from '../state/types';

export type JobId = 'farmer' | 'hunter' | 'fisher' | 'woodcutter' | 'builder' | 'warrior';

/** What a day's work adds to. */
export type Produce = 'food' | 'firewood' | 'shelter' | 'watch';

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
}

export const JOBS: JobDef[] = [
  {
    id: 'farmer',
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
];

export function jobById(id: string): JobDef | undefined {
  return JOBS.find((j) => j.id === id);
}

/** Shelter caps here: turf and timber only keep out so much. */
export const SHELTER_MAX = 6;
/** Each point of shelter saves this much firewood a night. */
export const SHELTER_SAVES = 0.5;

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
