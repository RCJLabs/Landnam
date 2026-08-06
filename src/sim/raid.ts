// Somebody else wants what you built.
//
// A raid is the only fight where losing costs more than people: the raiders
// are not passing through, they came for the store and the roof. That is what
// makes the palisade worth eight timber and a week of somebody's hands.

import { stream } from '../rng';
import { buildingById } from '../data/buildings';
import type { GameState } from '../state/types';
import { effectiveReport } from './colony';
import { standing } from './battle';
import { raidPressure } from './neighbours';
import { chronicle } from './saga';

/** What share of the store a successful sack carries off. */
export const SACK_SHARE = 0.4;

/** Raiders will not cross the whole country for a hovel. */
export const RAID_EARLIEST_DAY = 12;

export interface Sack {
  food: number;
  firewood: number;
  /** Building id burned, if any. */
  burned?: string;
}

/**
 * How hard the raid is. Bigger settlements are worth robbing, so the longer
 * you stand the more they bring — but a defensible site and a watch that is
 * actually kept both take the edge off.
 */
export function raidDifficulty(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  const worthTaking = home.built.length * 0.4 + Math.min(3, state.party.food / 40);
  const warned = effectiveReport(state)!.defence * 0.18 + home.watch * 0.12;
  // Whoever you have wronged brings more of their own. This is the whole
  // reason a neighbour is a persistent object and not a card.
  //
  // The ceiling is above what rollFoes can actually field (MAX_RAIDERS), so
  // that a site worth watching still reads as safer than one that is not even
  // when both are already bringing everything they have. Clamping at the foe
  // cap would flatten the two into the same number and quietly delete the
  // reason to build a palisade.
  return Math.max(-1, Math.min(6, Math.round(worthTaking - warned + raidPressure(state))));
}

/**
 * True when a raid could happen at all. Deliberately not gated on the band
 * being home: a steading whose warriors are three days out is exactly the one
 * worth coming for, and that is the cost of sending them.
 */
export function raidable(state: GameState): boolean {
  return !!state.settlement && state.day >= RAID_EARLIEST_DAY;
}

/**
 * The steading is sacked. Called when a raid is lost — they take a share of
 * the store and put a torch to something.
 *
 * A palisade does not stop this once the line has broken, but it is why the
 * line usually does not break.
 */
export function sackSteading(state: GameState): Sack {
  const home = state.settlement!;
  const rng = stream(state.seed, 'events').derive(`sack:${state.day}`);

  const food = Math.round(state.party.food * SACK_SHARE);
  const firewood = Math.round(state.party.firewood * SACK_SHARE);
  state.party.food = Math.max(0, state.party.food - food);
  state.party.firewood = Math.max(0, state.party.firewood - firewood);

  const out: Sack = { food, firewood };

  // Something burns. The longhouse is the last thing they fire, because it is
  // full of people — everything else goes first.
  const burnable = home.built.filter((id) => id !== 'longhouse');
  const target = burnable.length > 0 ? rng.pick(burnable) : home.built[0];
  if (target) {
    home.built = home.built.filter((id) => id !== target);
    const def = buildingById(target);
    // Whatever it granted goes with it.
    if (def?.shelter) home.shelter = Math.max(0, home.shelter - def.shelter);
    out.burned = target;
    chronicle(state, `They fired the ${def?.name.toLowerCase() ?? target}. It burned all night.`, 'grim');
  }

  home.watch = 0;
  state.party.morale = Math.max(0, state.party.morale - 14);
  chronicle(
    state,
    food > 0 || firewood > 0
      ? `They took ${food} of food and ${firewood} of wood out of ${home.name}, and we watched them do it.`
      : `They went through ${home.name} and found little worth carrying.`,
    'grim',
  );
  return out;
}

/** Holding the ground. They leave what they were carrying, and their dead. */
export function holdSteading(state: GameState, foesDown: number): void {
  const home = state.settlement!;
  state.party.morale = Math.min(100, state.party.morale + 12);
  chronicle(
    state,
    foesDown > 0
      ? `They broke on ${home.name} and left ${foesDown} of their own in the yard.`
      : `They looked at ${home.name}, and thought better of it.`,
    'good',
  );
}

/** A count of the defenders still on their feet, for the raid's log line. */
export function defendersLeft(state: GameState): number {
  const battle = state.battle;
  return battle ? standing(battle, 'warband').length : 0;
}
