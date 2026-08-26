// What the sea puts at stake.
//
// The audit's fifth finding: the knarr could not be lost, damaged, or fought
// for — a fight afloat was a meadow fight with a blue background. Now a sea
// fight is played for the hull and the packs. Losing puts a share of the
// cargo over the side and holes the hull; winning strips theirs. A holed
// hull is not a sunk one — she still swims, at half the pace, until a night
// ashore and some timber put her right. Short of sunk, on purpose: a run
// must end by decision, not by one bad fight on the water.

import type { Battle, GameState, Place } from '../state/types';
import { distance, key } from '../hex';
import { placeKind } from '../data/places';
import { stream } from '../rng';
import { chronicle } from './saga';
import { holed, mendStrake, springStrake, unseaworthy } from './ship';
import { STRAKE_MEND_WOOD } from '../data/ships';
import { COAST_IS_A_LINE } from './flags';
import { standingAt } from './coast';

/** Share of the packs that goes over the side when a sea fight is lost. */
export const CARGO_LOST_SHARE = 0.35;

/** What winning strips out of their hull. */
export const SEA_SALVAGE = { food: 5, firewood: 4 };

/**
 * Timber (as firewood) a night ashore spends putting ONE strake right.
 *
 * Re-exported from `data/ships` rather than owned here now that the hull has
 * more than one of them — two numbers for the same nail is how they drift.
 */
export const HULL_MEND_WOOD = STRAKE_MEND_WOOD;

/** True when this battle is being fought afloat, hulls at stake. */
/**
 * The strandhögg: falling on a coastal place FROM THE SHIP.
 *
 * The sea had a hull, cargo and hull-to-hull fights, but rowing was still
 * only walking on water — every verb that mattered was a land verb. This is
 * the one the period actually ran on. The knarr comes out of the water at a
 * place standing on the shore, and the difference from walking up to the
 * same gate is the whole point:
 *
 *   - they are not ready. Nobody watches the water the way they watch the
 *     road, so the garrison is a man lighter and starts shaken.
 *   - the hold takes more than backs can carry, so the take is larger.
 *   - and there is no line of retreat. Lose, and it is a sea fight's stakes
 *     — the packs go over the side and the hull is holed getting clear.
 *   - the coast remembers a sail longer than it remembers a raid. The
 *     standing hit is heavier.
 *
 * The decision it creates is real: the same place, taken two ways, and the
 * ship's way is better if you win and much worse if you do not.
 */

/** What a man not expecting a sail is worth: one fewer of them, and shaken. */
export const STRAND_FEWER = 1;
export const STRAND_SHAKEN = 25;
/** What the hold carries home over what backs could. */
export const STRAND_HAUL = 1.4;
/** How much worse the coast takes a raid that came out of the water. */
export const STRAND_INFAMY = 1.5;

/** A place on the shore, reachable from the water we are floating on. */
export function strandTarget(state: GameState): Place | undefined {
  if (COAST_IS_A_LINE) {
    // Not "are we floating on water beside it" — a route has no floating,
    // because rowing is a step and not a state. The two ways are how you
    // ARRIVED: out of the water with a sail nobody was watching for, or up
    // the road, which is the one they watch. One day only; see `Party.bySea`.
    if (state.party.bySea !== true) return undefined;
    const at = standingAt(state);
    return state.world.places.find(
      (p) =>
        p.stop === at &&
        p.sackedOn === undefined &&
        placeKind(p.kind).garrison !== null,
    );
  }
  if (state.world.tiles[key(state.party.at)]?.terrain !== 'ocean') return undefined;
  return state.world.places.find(
    (p) =>
      p.sackedOn === undefined &&
      placeKind(p.kind).garrison !== null &&
      distance(p.at, state.party.at) === 1,
  );
}

export function canStrandhogg(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  return strandTarget(state) !== undefined;
}

export function isSeaFight(battle: Battle): boolean {
  return battle.terrain === 'ocean' && !battle.raid;
}

/** The settling-up when a sea fight ends, either way. */
export function settleSeaFight(state: GameState, won: boolean): void {
  if (won) {
    state.party.food += SEA_SALVAGE.food;
    state.party.firewood += SEA_SALVAGE.firewood;
    chronicle(
      state,
      `We went through their hull for what she carried: ${SEA_SALVAGE.food} of food and ${SEA_SALVAGE.firewood} of wood.`,
      'good',
    );
    return;
  }

  const rng = stream(state.seed, 'events').derive(`sea-loss:${state.day}`);
  const food = Math.round(state.party.food * CARGO_LOST_SHARE * rng.float(0.8, 1.1));
  const firewood = Math.round(state.party.firewood * CARGO_LOST_SHARE * rng.float(0.8, 1.1));
  state.party.food = Math.max(0, state.party.food - food);
  state.party.firewood = Math.max(0, state.party.firewood - firewood);
  springStrake(state.ship);
  chronicle(
    state,
    `We broke off with the packs going over the side — ${food} of food and ${firewood} of wood to the water — and ${state.ship.name} took a strake's worth of hurt doing it.`,
    'grim',
  );
  if (unseaworthy(state.ship)) {
    chronicle(
      state,
      `There was nothing sound left in her. ${state.ship.name} would float and go nowhere until she was hauled out and worked on.`,
      'grim',
    );
  }
}

/**
 * A night ashore puts the hull right, if there is wood to do it with. Called
 * from CAMP on land; the mend is part of the night's work, not a new verb.
 */
export function mendHull(state: GameState): boolean {
  if (!mendStrake(state)) return false;
  chronicle(
    state,
    holed(state.ship)
      ? `We had ${state.ship.name} over on the beach by firelight and got a sound strake over a sprung one. There is more of her to do.`
      : `We had ${state.ship.name} over on the beach by firelight and got a sound strake over the sprung one. She swims like herself again.`,
    'good',
  );
  return true;
}
