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
import type { GameState, Person, Settlement } from '../state/types';

/** The painted world, in view units. */
export const YARD_W = 420;
export const YARD_H = 300;

/** Where the ground the steading stands on sits. */
export const GROUND_Y = YARD_H * 0.76;

/**
 * How wide a building's plot is.
 *
 * Wide enough to be tapped, because a building is the thing a player wants to
 * ask about — the same 44px rule everything else in this game keeps.
 */
export const SLOT_W = 74;

/** How many buildings stand before the yard has to scroll. */
export const SLOTS_SHOWN = 5;

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
export function steadingScene(state: GameState): SteadingScene {
  const home = state.settlement;
  if (!home) {
    return { name: '', raised: [], folk: [], ground: emptyGround(), width: YARD_W };
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

  return {
    name: home.name,
    raised,
    folk: folkIn(state, home),
    ground: groundOf(home),
    // A whole slot past the last house. Deliberately more generous than the
    // reach: `steading.test.ts` pins it, the queued building needs somewhere
    // to stand, and the folk are spread across the full width. The LEFT inset
    // is what was wrong, and it is `slotX` that fixes it.
    width: Math.max(YARD_W, slotX(raised.length) + SLOT_W),
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
export function folkIn(state: GameState, home: Settlement): Standing[] {
  const here = state.party.people.filter((p) => p.alive);
  const wide = Math.max(YARD_W, slotX(home.built.length + 1) + SLOT_W);
  return here.map((person, i) => ({
    person,
    job: jobOf(person)?.name ?? 'no work',
    // Spread across whatever the yard is wide, in two staggered rows so a
    // full hall does not become one long line off the edge of the picture.
    x: (wide / (here.length + 1)) * (i + 1),
    y: GROUND_Y + 22 + (i % 2) * 20,
  }));
}
