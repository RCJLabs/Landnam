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
export function sizeOf(def: BuildingDef | undefined): number {
  const cost = def?.works ?? 4;
  return Math.max(0.6, Math.min(1.35, 0.55 + cost / 22));
}

/** Where a building stands in the yard, by its place in the order raised. */
export function slotX(index: number): number {
  return SLOT_W * 0.6 + index * SLOT_W;
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
