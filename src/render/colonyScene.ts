// What the steading SHOWS, decided once and drawn by whoever is drawing.
//
// The same seam `render/travelScene.ts` cuts, for the same two reasons: a
// second backend consumes the description rather than reimplementing the
// rules, and the rules become testable without a document.
//
// It matters more here than the file size suggests. Where a worker STANDS is
// not decoration — the whole point of drawing the steading is that assignment
// is a thing you see, so "put someone on the fields and a figure appears in
// the fields" is a claim the game makes and nothing checked it. Same for which
// plot a raised building lands on, and for the spreading that stops two people
// on one plot hiding each other. All of that was reachable only by reading SVG
// attributes out of a browser, which is why none of it was tested.
//
// Nothing here knows what a colour is.

import { key, toPixel, type Hex } from '../hex';
import type { JobId } from '../data/jobs';
import type { GameState, Plot } from '../state/types';
import { jobOf, plotsFor } from '../sim/colony';
import { living } from '../sim/people';

/** The hex the steading is drawn at. Scene coordinates are in these units. */
export const HEX = 34;

/** One plot of the steading's own ground. */
export interface PlotPaint {
  kind: string;
  at: Hex;
  /** The hall is the one plot drawn heavier than the rest. */
  hall: boolean;
}

/** Something standing on a plot: what the ground is, or what was raised on it. */
export type ColonyMark =
  | { kind: 'plot'; plot: string; at: Hex }
  | { kind: 'raised'; building: string; at: Hex };

/** One of your people, standing on the ground they work. */
export interface WorkerPaint {
  name: string;
  at: Hex;
  /**
   * Where within the plot, in world units from its middle.
   *
   * Two people on one plot would otherwise be drawn on top of each other, and
   * the second would simply not exist as far as the player is concerned.
   */
  nudge: readonly [number, number];
}

/** The frame the steading is drawn in, in world units. */
export interface ColonyBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ColonyScene {
  plots: PlotPaint[];
  /** In draw order: what the ground is, then what has been built on it. */
  marks: ColonyMark[];
  folk: WorkerPaint[];
  /** Null when there is no steading yet, or it has no ground. */
  bounds: ColonyBounds | null;
}

/** The box that holds every plot, with a plot's worth of air round it. */
function frame(plots: readonly Plot[]): ColonyBounds | null {
  if (plots.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const plot of plots) {
    const p = toPixel(plot.at, HEX);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = HEX * 0.9;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

/**
 * Everything the steading draws.
 *
 * Rebuilt whole on every repaint, unlike the world map: a steading is a
 * handful of plots and a handful of people, so there is nothing here worth
 * diffing — the cost of working out what changed would exceed the cost of
 * saying it all again.
 */
export function describeColony(state: GameState): ColonyScene {
  const home = state.settlement;
  const empty: ColonyScene = { plots: [], marks: [], folk: [], bounds: null };
  if (!home || home.plots.length === 0) return empty;

  const plots: PlotPaint[] = home.plots.map((plot) => ({
    kind: plot.kind,
    at: plot.at,
    hall: plot.kind === 'hall',
  }));

  const marks: ColonyMark[] = home.plots.map((plot) => ({
    kind: 'plot' as const,
    plot: plot.kind,
    at: plot.at,
  }));

  // What has been raised, standing on the plots it belongs on — never on the
  // hall, which is the one plot that is already something.
  const spots = home.plots.filter((p) => p.kind !== 'hall');
  home.built.forEach((id, i) => {
    const spot = spots[i % Math.max(1, spots.length)];
    if (!spot) return;
    marks.push({ kind: 'raised', building: id, at: spot.at });
  });

  // Workers stand on the ground they work. Where several share a job, they are
  // spread across the plots that job has, and then round the middle of the one
  // they land on, so nobody is hidden underneath somebody else.
  const folk: WorkerPaint[] = [];
  // Two counts, and they answer different questions. `taken` is per JOB and
  // decides WHICH of that job's plots this person walks to. `crowd` is per
  // PLOT and decides where they stand once they get there.
  //
  // They have to be separate. Counting only per job says a hunter and a
  // woodcutter are each the first to arrive, and the wood they share is
  // worked by both — so both stood dead centre, on top of each other. Six
  // people with jobs drew four.
  const taken = new Map<string, number>();
  const crowd = new Map<string, number>();
  for (const person of living(state.party.people)) {
    const job = jobOf(person);
    if (!job) continue;
    const options = plotsFor(home, job.id as JobId);
    const nth = taken.get(job.id) ?? 0;
    taken.set(job.id, nth + 1);
    const spot = options.length > 0 ? options[nth % options.length] : undefined;
    if (!spot) continue;
    // How many are already standing here. The nudge has to come from THIS
    // count, not from the running one: `(nth / options.length) * 2pi` sends
    // the fourth farmer of three fields back to the first field AND back to
    // an angle of 2pi, which is the same place as the first farmer down to
    // the pixel. Nine farmers on three fields drew three people.
    const here = key(spot.at);
    const round = crowd.get(here) ?? 0;
    crowd.set(here, round + 1);
    // The golden angle, so no two rounds ever land on top of each other
    // however many people share a plot.
    const angle = round * 2.399963229728653;
    // A spiral, not a ring. On one ring the eighth person to reach a plot
    // stands 5.7px from a neighbour and a head is 7.5px across, so a big
    // crowd goes back to hiding under itself — just less exactly than
    // before. Widening by sqrt keeps every head clear up to twenty-one on
    // one plot; the clamp keeps the last of them on the plot rather than out
    // on the grass. It matters because `warrior` and `builder` have exactly
    // one plot each — the watch and the hall — so a whole band really can
    // land on a single hex.
    const away = round === 0 ? 0 : Math.min(HEX * 0.68, HEX * 0.17 * Math.sqrt(round + 1));
    folk.push({
      name: person.name,
      at: spot.at,
      nudge: [Math.cos(angle) * away, Math.sin(angle) * away],
    });
  }

  return { plots, marks, folk, bounds: frame(home.plots) };
}
