// The blood-month rite: a card the PLAYER calls for.
//
// Three shapes were tried and measured, and the third is the only one that
// costs nothing it should not.
//
//  1. A weighted card. The event deck is ZERO-SUM — every draw the blót wins
//     is a draw an autumn food card loses, right before the winter. At weight
//     7 only half of settled runs ever met it; at the weight 30 it needed to
//     reach 90%, spring survival on As It Lies fell seven points.
//  2. Fired by the calendar on the turn into autumn. No crowding, full reach
//     — and it puts a card on the table that nobody asked for, which desynced
//     every recorded run in runs/*.json: a replay meets an event it never
//     agreed to and refuses every action after it. Eight bars went red.
//  3. This. The player holds the blót from the deeds sheet, so the card only
//     ever exists because somebody asked for it. No crowding, no interruption,
//     and a rite you choose to hold is better fiction than one that ambushes
//     you anyway.

import { EVENTS } from '../data/eventCards';
import { isEligible, presentEvent } from './events';
import { atHome } from './site';
import type { GameState } from '../state/types';

export const BLOT_ID = 'blot';

/**
 * Puts the blót on the table, if there is a hall to hold it in and nothing
 * else already waiting there.
 */
export function canHoldBlot(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  if (!state.settlement || !atHome(state)) return false;
  const def = EVENTS.find((e) => e.id === BLOT_ID);
  // Its own `when` decides the rest — the season, and one oath at a time.
  // That gate belongs with the card rather than duplicated here.
  return !!def && isEligible(state, def);
}

/** Puts the blót on the table. Mutates. */
export function callTheBlot(state: GameState): boolean {
  if (!canHoldBlot(state)) return false;
  state.event = presentEvent(state, EVENTS.find((e) => e.id === BLOT_ID)!);
  return true;
}
