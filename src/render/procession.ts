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
import { seasonOf } from '../sim/calendar';
import { weatherOn } from '../sim/weather';
import type { WeatherId } from '../data/weather';
import type { GameState, Season, Terrain } from '../state/types';

/** The painted world, in view units. Portrait, because the phone is. */
export const SCENE_W = 390;
export const SCENE_H = 640;

/** Where the road the band walks on sits. */
export const ROAD_Y = SCENE_H * 0.78;

/** How far up the picture the horizon is. Sky above, country below. */
export const HORIZON_Y = SCENE_H * 0.42;

/**
 * The band's leader stands here, so there is more road ahead than behind.
 *
 * It was a third in until Art 13, and a third was too far left: the file
 * trails BACKWARD from the leader, so at 0.33 a band of six reached x = 27
 * and the last two were half off the picture. Measured on the built page at
 * 390x844 — the tail walker's own shadow crossed the frame. The file now
 * gets a stated amount of room (`FILE_LEFT`) and the leader stands where
 * that room begins, still comfortably inside the left half.
 */
export const BAND_X = SCENE_W * 0.4;

/** How near the left edge the tail of the file may come. */
export const FILE_LEFT = SCENE_W * 0.08;

/**
 * How tall a walker is drawn, crown to heel.
 *
 * 82 of a 640-tall scene, which is about 108 real pixels on a 390x844
 * phone. 68 was the first cut and it was too small to read a person off:
 * the shield came out 22px across and the face four, so the figure was a
 * coloured dot again by another route.
 */
export const WALKER_H = 82;

/**
 * Half the width a walker takes, for spacing and for tap targets.
 *
 * Kept under its old name because the file's spacing, the touch rule and the
 * bars are all written against it.
 */
export const WALKER_R = 26;

/**
 * How much smaller each walker further back in the file is drawn.
 *
 * A file goes AWAY from the viewer, so the one at the back is further off,
 * and the cheapest way to say that is size. Ten percent a head: the sixth is
 * two-thirds of the first, which reads as depth and not as a giant.
 */
export const FILE_FALLOFF = 0.1;

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
  /**
   * The sky the band walks under, and the season it walks in.
   *
   * Art 11: the sim has named the sky since the weather work and the top
   * bar prints it, but the picture ignored it — "A gale" in a chip over a
   * calm painted road. The window and the chip now read the same facts.
   */
  weather: WeatherId;
  season: Season;
  /**
   * The band has stopped for the night and not yet walked on.
   *
   * `party.hasCamped` survives from the CAMP action until the next WALK, so
   * it is a real, already-stored trigger for night — see `render/light.ts`
   * for why the light is driven by this and the season rather than by an
   * hour the sim does not have.
   */
  camped: boolean;
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
    weather: weatherOn(state.seed, state.day).id,
    season: seasonOf(state.day),
    camped: state.party.hasCamped,
    ...(landmarkNameAtStop(state.seed, at) && knowsStop(state, at)
      ? { landmark: landmarkNameAtStop(state.seed, at)! }
      : {}),
    ahead,
    ...(step(at + 1) ? { onward: step(at + 1)! } : {}),
    ...(step(at - 1) ? { back: step(at - 1)! } : {}),
    headland: at >= ROUTE_STOPS - 1,
  };
}

/** How big the `i`th walker in the file is drawn, as a fraction of the first. */
export function fileScale(i: number): number {
  return 1 / (1 + i * FILE_FALLOFF);
}

/**
 * Where each of the band's people walks, spread along the road.
 *
 * They walk as a file rather than a rank — a road is not a shield wall — so
 * they trail back from the leader, and a big band is a longer file rather
 * than a taller pile.
 *
 * The file is FITTED rather than merely spaced. The old version stepped back
 * by a fixed 20 units per head with no idea where the edge of the picture
 * was, so it was correct for a band of four and wrong for a band of six —
 * and a hall that has taken people in can walk a dozen. Now the preferred
 * gaps are laid out first, and if they do not fit between the leader and
 * `FILE_LEFT` the whole file is squeezed to the room there is. A crowd
 * bunches up, which is what a crowd on a road does; nobody walks off the
 * page.
 */
export function fileSpots(count: number): { x: number; y: number; scale: number }[] {
  // Preferred gap between walker i-1 and i: the further back they are, the
  // smaller they are drawn and the less room they need.
  const gaps: number[] = [];
  for (let i = 1; i < count; i += 1) gaps.push(WALKER_H * 0.34 * fileScale(i));
  const wanted = gaps.reduce((a, b) => a + b, 0);
  const room = BAND_X - FILE_LEFT;
  const squeeze = wanted > room ? room / wanted : 1;

  const out: { x: number; y: number; scale: number }[] = [];
  let x = BAND_X;
  for (let i = 0; i < count; i += 1) {
    if (i > 0) x -= gaps[i - 1]! * squeeze;
    out.push({
      x,
      // Very slightly up the picture, so the file reads as going away from
      // the viewer rather than sideways across it.
      y: ROAD_Y - i * (WALKER_R * 0.1) * squeeze,
      scale: fileScale(i),
    });
  }
  return out;
}

/**
 * What a named sky does to the LIGHT, as one wash over the whole picture.
 *
 * Separate from the moving weather on purpose. The gusts and flakes the
 * battlefield lends us start invisible and are shown only by their
 * animation — under stillness or reduced motion that reads as a calm day,
 * which was Art 5's deliberate call for a battle. This view's bar is "a
 * gale should look like a gale", and a claim about the picture cannot
 * depend on the picture moving: the wash is static, so the sky is the
 * right colour in a screenshot, under stillness, and for every player who
 * turned the motion off. Fair adds nothing; thaw is a fact about the
 * snowpack, not the air — the battle's own stance, kept.
 */
export function skyWash(weather: WeatherId): { fill: string; opacity: number } | null {
  if (weather === 'gale') return { fill: '#3c4653', opacity: 0.34 };
  if (weather === 'frost') return { fill: '#dfe8f2', opacity: 0.18 };
  if (weather === 'seafog') return { fill: '#c8d2d8', opacity: 0.34 };
  return null;
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

