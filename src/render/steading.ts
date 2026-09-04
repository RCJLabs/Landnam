// The steading, seen from the side: what you have actually built.
//
// The colony's local map is a ring of hex plots — ground, drawn as ground.
// It says what the steading COULD do (a field here, water there) and almost
// nothing about what it IS. Everything the player spends a season on lives in
// `settlement.built`, which the map never draws at all: raising a longhouse
// changes a list and changes no pixel.
//
// So the elevation is the other half. Buildings stand on a strip of ground,
// left to right in the order they were raised, with the one being worked on
// half-up beside them. That is the milestone's whole bar — raising a building
// visibly changes the steading you walk into — and it is a bar the hex map
// could never have passed, because it was drawing the wrong noun.
//
// Pure, and tested as such. `steadingView.ts` only draws.

import { buildingById, type BuildingDef } from '../data/buildings';
import { jobOf } from '../sim/colony';
import type { ToolId } from '../data/jobs';
import { GROUND_Y as HORIZON_Y } from './line';
import type { GameState, Person, Settlement } from '../state/types';

/** The narrowest the yard is drawn, before buildings widen it. */
export const YARD_W = 420;

/**
 * Where the ground the steading stands on sits: ON THE PAINTED HORIZON.
 *
 * `fieldOil` paints one world — sky above `line.ts`'s ground line, ridges on
 * it, brushed ground below — and the battlefield composes on that horizon.
 * The yard did not: its own ground sat at y 228 in a 0..300 viewBox, which
 * is entirely inside the PAINTING'S SKY, so the view drew a flat brown
 * rectangle over the clouds for the houses to stand on. Measured on the
 * built page: at 390x844 the yard letterboxed 176px of a 382px slot, and
 * every building raised shrank the whole picture, because the viewBox
 * widened under `meet`. Standing the steading on the painting's own ground
 * is what lets the composition (`composeYard`) show sky, ridges and worn
 * earth instead of black bands.
 */
export const GROUND_Y = HORIZON_Y;

/**
 * The bottom of the yard's world: the foreground strip below the ground
 * line where the folk stand, with room under the back row for the word
 * saying what they are at.
 */
export const YARD_H = GROUND_Y + 90;

/**
 * How wide a building's plot is.
 *
 * Wide enough to be tapped, because a building is the thing a player wants to
 * ask about — the same 44px rule everything else in this game keeps.
 */
export const SLOT_W = 74;

/** How many buildings stand before the yard has to scroll. */
export const SLOTS_SHOWN = 5;

/**
 * How tall the folk in the yard stand.
 *
 * Against a house whose walls are 22 and whose ridge is 52, a person of 34
 * comes to the eaves — which is roughly right for a turf longhouse and, more
 * to the point, leaves the building the bigger thing in the picture. It was
 * effectively 45 before (a head-on fighter drawn at radius 15, plus helm and
 * health bar), and a band standing shoulder-high to the ridge is why the
 * yard read as figures pasted over houses rather than people in front of
 * them.
 */
export const FOLK_H = 34;

/**
 * The frame the yard is seen through, fitted to the slot that shows it.
 *
 * The viewBox matches the SLOT'S aspect exactly, so `meet` letterboxes
 * nothing — the defect this replaces gave 46% of the picture to black bands
 * at 390x844 and drew a 161px-wide postage stamp at 320x568. Anchored on
 * the ground line: the foreground keeps just enough room for the folk (up
 * to `FORE_MAX` world units), and everything else is sky and ridge over the
 * houses, which is how the battlefield composes the same painting.
 */
export const FORE_MAX = 90;

/**
 * How long the ground takes to wear and the turf to green over.
 *
 * Wear is faster than growth on purpose: a path is trodden in one season,
 * turf takes a couple of years to knit — so a day-20 yard is raw earth and
 * fresh-cut walls, day-200 is a worn path in front of greening houses, and
 * the two read as different ages at a glance.
 */
export const TRODDEN_DAYS = 160;
export const GREENED_DAYS = 400;

/** A hard winter's worth of firewood, for sizing the pile against. */
export const WOODPILE_FULL = 60;

export function composeYard(
  sceneW: number,
  slotW: number,
  slotH: number,
): { x: number; y: number; w: number; h: number } {
  // A slot that has not been laid out yet measures zero; frame for a phone
  // rather than dividing by it.
  const w = slotW >= 10 ? slotW : 390;
  const h = slotH >= 10 ? slotH : 380;
  const visH = (sceneW * h) / w;
  const fore = Math.min(FORE_MAX, Math.max(40, visH * 0.28));
  return { x: 0, y: GROUND_Y - (visH - fore), w: sceneW, h: visH };
}

export interface Raised {
  id: string;
  name: string;
  /** 0..1. Anything under 1 is the thing currently being worked on. */
  done: number;
  x: number;
  /** How big it stands, from the building's own weight in the data. */
  size: number;
}

export interface Standing {
  person: Person;
  /** The job's word, so the picture can say who is doing what. */
  job: string;
  /** And the thing it puts in their hands, off the job's own data. */
  tool?: ToolId;
  x: number;
  y: number;
}

export interface SteadingScene {
  name: string;
  /** Everything raised, in the order it went up, plus the one in hand. */
  raised: Raised[];
  /** Who is in the yard, and at what. */
  folk: Standing[];
  /** The ground this steading stands on, as counts by kind. */
  ground: { field: number; wood: number; water: number; rough: number };
  /** How wide the yard has to be for everything to stand in it. */
  width: number;
  /**
   * The facts below are Art 12's whole point: every one is a function of
   * time or of what the band has actually done, so a screenshot of day 20
   * and one of day 200 are different pictures without a caption. None is
   * stored — each is derived from state the sim already keeps.
   */
  /** A hearth is lit: something stands, and somebody is home to feed it. */
  smoke: boolean;
  /** 0..1 — how worn the yard is by feet, from days lived on it. */
  trodden: number;
  /** 0..1 — how far the turf walls have greened over, same clock. */
  greened: number;
  /** 0..1 — the woodpile against a hard winter's worth. */
  woodpile: number;
  /** The steading's fields, and whether anybody is actually working them. */
  fields: { count: number; tilled: boolean };
  /** Everyone born here, for the small figures by the door. */
  childNames: string[];
}

/**
 * How big a building stands.
 *
 * Read off its cost rather than given a table of its own: a thing that took a
 * season of everybody's work should look like it, and the cost is already the
 * number that says so. Kept to a narrow range — the point is that a hall
 * reads as bigger than a byre, not that a byre is a speck.
 */
export const SIZE_MIN = 0.6;
export const SIZE_MAX = 1.35;

export function sizeOf(def: BuildingDef | undefined): number {
  const cost = def?.works ?? 4;
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, 0.55 + cost / 22));
}

/**
 * The geometry of one house, owned HERE rather than in the view.
 *
 * It was owned in both, and that was the bug: `steadingView` drew walls at
 * `SLOT_W * 0.42` with the roof oversailing by five, while the layout below
 * inset the first slot by `SLOT_W * 0.6` — a number that had no relationship
 * to either. At full size the roof reaches 48.7 from its own centre and the
 * first slot stood at 44.4, so a large first building hung four units off the
 * left of the viewBox. A longhouse, raised first, was drawn half off the page.
 *
 * The `hearth` bar did not catch it, and — measured rather than assumed —
 * tightening it from an overlap test to a containment one did not catch it
 * either: `steadingView` fits the viewBox with `xMidYMid meet`, so content
 * just outside the viewBox still lands inside the element rect the bar reads.
 * The bar is tightened anyway because containment is the question its name
 * asks, but the check that actually holds this is in `test/steading.test.ts`,
 * where it is arithmetic and needs no browser.
 */
export const HOUSE_HALF = SLOT_W * 0.42;
export const ROOF_OVERSAIL = 5;
/** The furthest any house reaches from its own centre, at its largest. */
export const HOUSE_REACH = (HOUSE_HALF + ROOF_OVERSAIL) * SIZE_MAX;

/** Where a building stands in the yard, by its place in the order raised. */
export function slotX(index: number): number {
  return HOUSE_REACH + index * SLOT_W;
}

/**
 * The steading as it stands today.
 *
 * `built` is the order things were raised, and the yard keeps that order:
 * a player who raised the byre first sees the byre first, every time. The
 * head of the queue stands beside them half-up, because a steading with
 * scaffolding in it is a truer picture than one that hides its work.
 */
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function steadingScene(state: GameState): SteadingScene {
  const home = state.settlement;
  if (!home) {
    return {
      name: '', raised: [], folk: [], ground: emptyGround(), width: YARD_W,
      smoke: false, trodden: 0, greened: 0, woodpile: 0,
      fields: { count: 0, tilled: false }, childNames: [],
    };
  }

  const raised: Raised[] = home.built.map((id, i) => {
    const def = buildingById(id);
    return {
      id,
      name: def?.name ?? id,
      done: 1,
      x: slotX(i),
      size: sizeOf(def),
    };
  });

  // The one in hand. `works` is builder-days banked against the head of the
  // queue, so the fraction is real rather than a guess at progress.
  const next = home.queue[0];
  if (next) {
    const def = buildingById(next);
    raised.push({
      id: next,
      name: def?.name ?? next,
      done: def && def.works > 0 ? Math.max(0.08, Math.min(0.95, home.works / def.works)) : 0.08,
      x: slotX(raised.length),
      size: sizeOf(def),
    });
  }

  // A whole slot past the last house. Deliberately more generous than the
  // reach: `steading.test.ts` pins it, the queued building needs somewhere
  // to stand, and the folk are spread across the full width. The LEFT inset
  // is what was wrong, and it is `slotX` that fixes it.
  const width = Math.max(YARD_W, slotX(raised.length) + SLOT_W);

  const folk = folkIn(state, width);
  const ground = groundOf(home);
  const stood = Math.max(0, state.day - home.foundedOn);

  return {
    name: home.name,
    raised,
    folk,
    ground,
    width,
    // Standing walls and somebody home to keep the fire: the scaffolding in
    // hand does not smoke, and neither does a steading everyone has left.
    smoke: home.built.length > 0 && folk.length > 0,
    trodden: clamp01(stood / TRODDEN_DAYS),
    greened: clamp01(stood / GREENED_DAYS),
    woodpile: clamp01(state.party.firewood / WOODPILE_FULL),
    fields: {
      count: ground.field,
      tilled: state.party.people.some((p) => p.alive && p.job === 'farmer'),
    },
    childNames: home.children.map((c) => c.name),
  };
}

function emptyGround(): SteadingScene['ground'] {
  return { field: 0, wood: 0, water: 0, rough: 0 };
}

/** What the steading has to work with, counted off its own plots. */
export function groundOf(home: Settlement): SteadingScene['ground'] {
  const ground = emptyGround();
  for (const plot of home.plots) {
    if (plot.kind === 'field') ground.field += 1;
    else if (plot.kind === 'wood') ground.wood += 1;
    else if (plot.kind === 'water') ground.water += 1;
    else if (plot.kind === 'rough') ground.rough += 1;
  }
  return ground;
}

/**
 * Who is standing in the yard.
 *
 * Everybody alive and at home, spread along the front of the ground so no two
 * are in the same place — which is a bug this mode has had twice, and the
 * kind a screenshot cannot catch because the second figure IS drawn, exactly
 * underneath the first.
 */
export function folkIn(state: GameState, width: number): Standing[] {
  const here = state.party.people.filter((p) => p.alive);
  return here.map((person, i) => ({
    person,
    job: jobOf(person)?.name ?? 'no work',
    ...(jobOf(person)?.tool ? { tool: jobOf(person)!.tool! } : {}),
    // Spread across whatever the yard is wide, in two staggered rows so a
    // full hall does not become one long line off the edge of the picture.
    //
    // THE WIDTH IS HANDED IN, and that is the fix. It used to be computed
    // here as `slotX(built.length + 1) + SLOT_W` while `steadingScene`
    // computed the yard's real width as `slotX(raised.length) + SLOT_W` —
    // the same expression with a different count in it. With nothing in the
    // build queue the two disagree by a whole slot, so the last of the band
    // was placed 74 units past the right edge of the picture and drawn half
    // off it. One number, one place.
    x: (width / (here.length + 1)) * (i + 1),
    // Both rows stand in the foreground, in front of the houses, with room
    // under the back row for the word saying what they are at.
    y: GROUND_Y + 26 + (i % 2) * 18,
  }));
}
