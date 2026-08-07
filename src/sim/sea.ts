// What the sea puts at stake.
//
// The audit's fifth finding: the knarr could not be lost, damaged, or fought
// for — a fight afloat was a meadow fight with a blue background. Now a sea
// fight is played for the hull and the packs. Losing puts a share of the
// cargo over the side and holes the hull; winning strips theirs. A holed
// hull is not a sunk one — she still swims, at half the pace, until a night
// ashore and some timber put her right. Short of sunk, on purpose: a run
// must end by decision, not by one bad fight on the water.

import type { Battle, GameState } from '../state/types';
import { stream } from '../rng';
import { chronicle } from './saga';

/** Share of the packs that goes over the side when a sea fight is lost. */
export const CARGO_LOST_SHARE = 0.35;

/** What winning strips out of their hull. */
export const SEA_SALVAGE = { food: 5, firewood: 4 };

/** Timber (as firewood) a night ashore spends putting the hull right. */
export const HULL_MEND_WOOD = 2;

/** True when this battle is being fought afloat, hulls at stake. */
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
  state.party.hullHoled = true;
  chronicle(
    state,
    `We broke off with the packs going over the side — ${food} of food and ${firewood} of wood to the water — and the hull took a strake's worth of hurt doing it.`,
    'grim',
  );
}

/**
 * A night ashore puts the hull right, if there is wood to do it with. Called
 * from CAMP on land; the mend is part of the night's work, not a new verb.
 */
export function mendHull(state: GameState): boolean {
  if (!state.party.hullHoled) return false;
  if (state.party.firewood < HULL_MEND_WOOD) return false;
  state.party.firewood -= HULL_MEND_WOOD;
  delete state.party.hullHoled;
  chronicle(
    state,
    'We had her over on the beach by firelight and got a sound strake over the sprung one. She swims like herself again.',
    'good',
  );
  return true;
}
