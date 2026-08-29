// The chart, when the country is a coast.
//
// The hex chart fits a whole island into three hundred pixels, and its own
// comment records what that cost: names were tried on it and could not be
// read, so the marks say WHERE and a key underneath says WHICH. That is the
// right answer for a map of an island and the wrong one for a coast, because
// a coast is not a shape to be taken in at a glance — it is an ORDER, and the
// only question a player asks of it is how far along it to go.
//
// So this is a strip: one lane, read seaward, long enough that every stretch
// is something a thumb can land on, and scrolled rather than shrunk. The
// portolan strip chart is the same object for the same reason.
//
// Pure, and tested as such. `stripScene` reads a GameState and answers what
// is on the coast and what the band knows of it; nothing here draws, and
// nothing that draws decides anything. `render/stripMap.ts` is the hand.

import { clanKind, standingFor } from '../data/clans';
import { placeKind } from '../data/places';
import { terrainDef } from '../data/terrain';
import { landmarkNameAtStop } from '../sim/landmark';
import { hasTrod, knowsStop, pushLimit, standingAt, walkOptions } from '../sim/coast';
import { ROUTE_STOPS, daysBetween, stopAt } from '../sim/route';
import { rivalSettled } from '../sim/rival';
import type { GameState, Terrain } from '../state/types';
import { BLOOD, RUST } from './palette';

/**
 * Width of one stretch of coast, in chart pixels.
 *
 * The number the whole form turns on. A chart you cannot touch is a picture,
 * and this one has to be touched — with the flag on it is the only way to
 * walk anywhere until 8.3 puts a procession under it. So a stretch is wider
 * than the 44px touch target this project has held since 5.2, with enough
 * left over for the leg between it and the next one to be written rather
 * than guessed at.
 *
 * Twenty-six of these is 1456px, which does not fit any phone and is not
 * meant to. The strip SCROLLS. Shrinking to fit is what the hex chart does
 * and it is precisely why that chart cannot carry a name.
 */
export const STOP_W = 58;

/** Touch target this has to clear, from CLAUDE.md's mobile rule. */
export const TAP = 44;

/** How tall the painted lane is. */
export const LANE_H = 74;

/** The whole strip, lane plus the room the marks and legs need above and below. */
export const STRIP_H = 176;

/** Where the lane's top edge sits inside the strip. */
export const LANE_Y = 58;

/** The full drawn width. Twenty-six stretches, scrolled. */
export function stripWidth(): number {
  return ROUTE_STOPS * STOP_W;
}

/** The centre of a stretch, in chart pixels. */
export function xOf(stop: number): number {
  return stop * STOP_W + STOP_W / 2;
}

/**
 * Which stretch a tap at this x landed on, or undefined if it landed off the
 * end of the coast.
 */
export function pickStop(x: number): number | undefined {
  if (x < 0) return undefined;
  const stop = Math.floor(x / STOP_W);
  return stop < ROUTE_STOPS ? stop : undefined;
}

/**
 * How far to scroll so the band sits in the middle of what can be seen.
 *
 * Clamped at both ends, so the landing and the far headland sit against
 * their own edge rather than in the middle of a half-empty strip.
 */
export function scrollFor(at: number, viewW: number): number {
  const want = xOf(at) - viewW / 2;
  return Math.max(0, Math.min(stripWidth() - viewW, want));
}

/** What one mark on a stretch is. */
export interface StripMark {
  kind: 'place' | 'neighbour' | 'rival' | 'landmark' | 'hall' | 'landing';
  /** What the key calls it. */
  text: string;
  /** Ink for the glyph, where the thing has an opinion about us. */
  ink?: string;
  /** Dimmed: a place picked clean, ground somebody else has fenced. */
  spent?: boolean;
}

/** One stretch of coast, as the chart knows it. */
export interface StripStop {
  index: number;
  /** Undefined until the band knows what is there. */
  country?: Terrain;
  /** Flat fill and darker edge, from data/terrain. Undefined while unknown. */
  fill?: string;
  edge?: string;
  /** Days from the stretch before this one. Undefined while unknown. */
  leg?: number;
  known: boolean;
  /** They have stood here. */
  trod: boolean;
  here: boolean;
  /** A step they could take today, and what it would cost in days. */
  reach?: number;
  marks: StripMark[];
}

export interface StripScene {
  stops: StripStop[];
  at: number;
  /** Days out they could go and still get home on what the caller counted. */
  limit: number;
  /** How many stretches they have stood on. */
  walked: number;
}

/**
 * The coast as the chart draws it.
 *
 * The fog discipline is the hex chart's, unchanged: a stretch the band has
 * not learned shows as unknown water-stained paper and says nothing about
 * itself. Everything else is a fact the band has earned — by walking it, by
 * being told of it in a bargain, or by picking it out from a ridge.
 */
export function stripScene(state: GameState, daysInHand: number): StripScene {
  const at = standingAt(state);
  const options = new Map<number, number>();
  for (const to of walkOptions(state)) {
    options.set(to, daysBetween(state.seed, at, to));
  }
  const settled = rivalSettled(state);

  const stops: StripStop[] = [];
  for (let i = 0; i < ROUTE_STOPS; i += 1) {
    const known = knowsStop(state, i);
    const stop = stopAt(state.seed, i);
    const def = terrainDef(stop.country);
    const marks: StripMark[] = [];

    if (known) {
      if (i === 0) {
        marks.push({
          kind: 'landing',
          text: `${state.world.landingName || 'The landing'} — where we came ashore`,
        });
      }
      if (state.settlement?.stop === i) {
        marks.push({ kind: 'hall', text: `${state.settlement.name} — our steading` });
      }
      for (const p of state.world.places) {
        if (p.stop !== i) continue;
        const spent = p.sackedOn !== undefined;
        marks.push({
          kind: 'place',
          text: `${placeKind(p.kind).name}${spent ? ' — picked clean' : ''}`,
          spent,
        });
      }
      // Only the ones we have actually met. A camp we have never come to is
      // not a thing the chart could be carrying.
      for (const n of state.neighbours) {
        if (n.stop !== i || !n.found) continue;
        const standing = standingFor(n.standing);
        marks.push({
          kind: 'neighbour',
          text: `${n.name} — a ${clanKind(n.kind).noun} · ${standing.label}`,
          ink: STANDING_INK[standing.id],
        });
      }
      if (settled && state.rival?.met) {
        if (state.rival.stop === i) {
          marks.push({ kind: 'rival', text: `${state.rival.hall} — ${state.rival.leader}'s hall` });
        } else if ((state.rival.claimStops ?? []).includes(i)) {
          marks.push({ kind: 'rival', text: `Fenced by ${state.rival.hall}`, spent: true });
        }
      }
      const named = landmarkNameAtStop(state.seed, i);
      if (named) marks.push({ kind: 'landmark', text: named });
    }

    stops.push({
      index: i,
      known,
      trod: hasTrod(state, i),
      here: i === at,
      ...(known ? { country: stop.country, fill: def.fill, edge: def.edge } : {}),
      ...(known && i > 0 ? { leg: stop.leg } : {}),
      ...(options.has(i) ? { reach: options.get(i)! } : {}),
      marks,
    });
  }

  return {
    stops,
    at,
    limit: pushLimit(state, daysInHand),
    walked: Object.keys(state.world.trodStops ?? {}).length,
  };
}

/**
 * Somebody else's camp, inked by what they think of us — the same table the
 * hex chart and the travel map read, so the coast's temper is one colour
 * wherever a player meets it.
 */
export const STANDING_INK: Record<string, string> = {
  hostile: BLOOD,
  cold: RUST,
  wary: '#b6a06a',
  friendly: '#7fa05a',
  sworn: '#5fa389',
};

/**
 * Every mark on the coast, in the order the key should list them.
 *
 * Seaward, because that is the order the strip is read in and a key that
 * disagrees with the picture beside it is worse than no key.
 */
export function stripKey(scene: StripScene): { stop: number; mark: StripMark }[] {
  const out: { stop: number; mark: StripMark }[] = [];
  for (const stop of scene.stops) {
    for (const mark of stop.marks) out.push({ stop: stop.index, mark });
  }
  return out;
}
