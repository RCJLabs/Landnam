// Travel, seen from the side: the band on the road, and the coast ahead.
//
// The chart in the pack answers "how far along do I go" — it is an ORDER, and
// 8.2d made it one you can read and touch. What it cannot answer is the
// question a player asks a hundred times more often and never opens a card
// for: where am I, and what is coming. The hex map answered that by being on
// screen the whole time, and a strip chart in a drawer does not.
//
// So this is the road itself. One stretch of coast, painted; the band walking
// it; and what stands on the stretches ahead rising as silhouettes, nearer
// ones larger, exactly as things do when you are walking toward them.
//
// ## Why silhouettes and not a second chart
//
// The milestone's bar is "you can tell where you are and what is ahead
// WITHOUT the chart". A row of icons would pass that bar and be a chart with
// the paint taken off. What makes this different is that distance is drawn as
// distance — a monastery two stretches on is smaller and higher up the
// hillside than a camp on the next one, and a player reads which is nearer
// without reading a number. The numbers are still there for the ones who want
// them; they are not what the picture is FOR.
//
// Pure, like `render/strip.ts` and for the same reason. Every decision about
// what is visible and where it sits is here and tested; `processionView.ts`
// only draws.

import { standingFor } from '../data/clans';
import { placeKind } from '../data/places';
import { landmarkNameAtStop } from '../sim/landmark';
import { STANDING_INK } from './strip';
import { countryHere, knowsStop, standingAt, walkOptions } from '../sim/coast';
import { ROUTE_STOPS, daysBetween } from '../sim/route';
import { rivalSettled } from '../sim/rival';
import type { GameState, Terrain } from '../state/types';

/** The painted world, in view units. Portrait, because the phone is. */
export const SCENE_W = 390;
export const SCENE_H = 640;

/** Where the road the band walks on sits. */
export const ROAD_Y = SCENE_H * 0.78;

/** How far up the picture the horizon is. Sky above, country below. */
export const HORIZON_Y = SCENE_H * 0.42;

/** The band stands here, a third in, so there is more road ahead than behind. */
export const BAND_X = SCENE_W * 0.33;

/** How tall a walker is. Comfortably past the touch target. */
export const WALKER_R = 26;

/**
 * How many stretches ahead can be made out.
 *
 * Three, and the reason is the picture rather than the sim. A fourth
 * silhouette lands within a few pixels of the third — the perspective curve
 * has flattened by then — so it costs a node and buys a smudge. What is
 * further off than this is what the chart is for.
 */
export const SEEN_AHEAD = 3;

/** One thing standing on the coast ahead, as the eye takes it. */
export interface Sighting {
  stop: number;
  /** Stretches between here and there: 1 is the next one along. */
  off: number;
  kind: 'place' | 'camp' | 'rival' | 'hall';
  /** What it is called, for the label and the reader. */
  name: string;
  /** Where it stands, in view units. */
  x: number;
  y: number;
  /** How big it looks from here, 0..1 of its full size. */
  scale: number;
  /** Days of walking to reach it. */
  days: number;
  ink?: string;
}

export interface ProcessionScene {
  at: number;
  /** The country underfoot, which is what gets painted. */
  country: Terrain;
  /** What this stretch is called, if it is called anything. */
  landmark?: string;
  /** Things standing on the road ahead, nearest first. */
  ahead: Sighting[];
  /** The step out and the step back, if the band may take them. */
  onward?: { stop: number; days: number };
  back?: { stop: number; days: number };
  /** True once the coast runs out ahead. */
  headland: boolean;
}

/**
 * How far up the picture something `off` stretches away stands, and how big.
 *
 * A plain perspective fall-off: everything sits between the road the band is
 * on and the horizon, and shrinks toward it. Not a projection with a real
 * camera in it — this is a painting, and the only property that has to hold
 * is that nearer things are lower and larger, because that is what a player
 * reads distance off.
 */
export function sightAt(off: number): { x: number; y: number; scale: number } {
  // 0..1 across the stretches that can be seen, easing so the first step
  // away is a big change and the third is a small one.
  const t = Math.min(1, off / (SEEN_AHEAD + 1));
  const eased = Math.sqrt(t);
  return {
    x: BAND_X + (SCENE_W * 0.92 - BAND_X) * eased,
    y: ROAD_Y - (ROAD_Y - HORIZON_Y) * eased,
    scale: 1 - 0.62 * eased,
  };
}

/** What stands on a stretch, for the eye: at most one thing, the biggest. */
function whatStandsOn(state: GameState, stop: number): Omit<Sighting, 'off' | 'x' | 'y' | 'scale' | 'days'> | undefined {
  if (state.settlement?.stop === stop) {
    return { stop, kind: 'hall', name: state.settlement.name };
  }
  const place = state.world.places.find((p) => p.stop === stop && p.sackedOn === undefined);
  if (place) return { stop, kind: 'place', name: placeKind(place.kind).name };
  const camp = state.neighbours.find((n) => n.stop === stop && n.found);
  if (camp) {
    // Inked from the same table the chart and the hex map read, so the
    // coast's temper is one colour wherever a player meets it.
    return { stop, kind: 'camp', name: camp.name, ink: STANDING_INK[standingFor(camp.standing).id] };
  }
  if (rivalSettled(state) && state.rival?.met && state.rival.stop === stop) {
    return { stop, kind: 'rival', name: state.rival.hall };
  }
  return undefined;
}

/**
 * The road as the band sees it today.
 *
 * The seen/unseen discipline is the whole sim's, unchanged: a stretch the
 * band has not learned shows its country and nothing standing on it. You can
 * see the shape of the coast running away from you without knowing there is a
 * monastery on it — which is exactly right, and is what makes walking out to
 * look worth doing.
 */
export function processionScene(state: GameState): ProcessionScene {
  const at = standingAt(state);
  const options = new Set(walkOptions(state));

  const ahead: Sighting[] = [];
  for (let off = 1; off <= SEEN_AHEAD; off += 1) {
    const stop = at + off;
    if (stop >= ROUTE_STOPS) break;
    if (!knowsStop(state, stop)) continue;
    const what = whatStandsOn(state, stop);
    if (!what) continue;
    const spot = sightAt(off);
    ahead.push({
      ...what,
      off,
      ...spot,
      days: daysBetween(state.seed, at, stop),
    });
  }

  const step = (stop: number) => (options.has(stop)
    ? { stop, days: daysBetween(state.seed, at, stop) }
    : undefined);

  return {
    at,
    country: countryHere(state),
    ...(landmarkNameAtStop(state.seed, at) && knowsStop(state, at)
      ? { landmark: landmarkNameAtStop(state.seed, at)! }
      : {}),
    ahead,
    ...(step(at + 1) ? { onward: step(at + 1)! } : {}),
    ...(step(at - 1) ? { back: step(at - 1)! } : {}),
    headland: at >= ROUTE_STOPS - 1,
  };
}

/**
 * Where each of the band's people walks, spread along the road.
 *
 * They walk as a file rather than a rank — a road is not a shield wall — so
 * they trail back from the leader, and a big band is a longer file rather
 * than a taller pile.
 */
export function fileSpots(count: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    // Behind the leader and very slightly up the picture, so the file reads
    // as going away from the viewer rather than sideways across it.
    out.push({
      x: BAND_X - i * (WALKER_R * 0.78),
      y: ROAD_Y - i * (WALKER_R * 0.1),
    });
  }
  return out;
}

/**
 * What the panel says about where the band is standing.
 *
 * The milestone's bar in one string: the country, what this stretch is
 * called if it is called anything, and how far along the coast it is.
 */
export function whereWeAre(scene: ProcessionScene): string {
  const where = scene.headland
    ? 'the last of the coast'
    : `stretch ${scene.at} of ${ROUTE_STOPS - 1}`;
  return scene.landmark
    ? `${scene.landmark} — ${where}`
    : `${countryWord(scene.country)}, ${where}`;
}

/** Country, said the way a person would say it. */
export function countryWord(country: Terrain): string {
  const said: Partial<Record<Terrain, string>> = {
    shore: 'On the strand',
    meadow: 'In open grass',
    forest: 'Under trees',
    hills: 'On high ground',
    bog: 'On soft ground',
    valley: 'In a valley',
  };
  return said[country] ?? 'On the road';
}

