// The single entry point the UI dispatches through. Pure: (state, action) -> state.
// Routing by mode lives here so each sim module stays focused on its own rules.

import { currentMode } from '../modes';
import type { GameState } from '../state/types';
import type { Hex } from '../hex';
import { chooseOption, dismissEvent, maybeFireEvent } from './events';
import { applyTravel, type TravelAction } from './travel';
import { isWarbandTurn } from './battle';
import { doMove, doStrike, endTurn, leaveBattle } from './battleTurn';

export type BattleAction =
  | { type: 'B_MOVE'; to: Hex }
  | { type: 'B_STRIKE'; targetId: string }
  | { type: 'B_END_TURN' }
  | { type: 'B_LEAVE' };

export type Action =
  | TravelAction
  | BattleAction
  | { type: 'CHOOSE'; index: number }
  | { type: 'DISMISS_EVENT' };

const BATTLE_TYPES = new Set(['B_MOVE', 'B_STRIKE', 'B_END_TURN', 'B_LEAVE']);

export function apply(state: GameState, action: Action): GameState {
  if (state.end) return state;

  // A fight on the field outranks everything else.
  if (currentMode(state) === 'BATTLE' && state.battle) {
    if (!BATTLE_TYPES.has(action.type)) return state;
    const next = structuredClone(state);

    switch (action.type) {
      case 'B_MOVE':
        if (!isWarbandTurn(next) || !doMove(next, action.to)) return state;
        return next;
      case 'B_STRIKE':
        if (!isWarbandTurn(next) || !doStrike(next, action.targetId)) return state;
        return next;
      case 'B_END_TURN':
        // Deliberately not gated on whose turn it is: ending a turn must
        // always drive the cycle forward, or a foe turn left active would
        // reject every action and strand the player on the field.
        if (!endTurn(next)) return state;
        return next;
      case 'B_LEAVE':
        if (!next.battle?.outcome) return state;
        leaveBattle(next);
        return next;
      default:
        return state;
    }
  }

  if (BATTLE_TYPES.has(action.type)) return state;

  // A card on the table blocks everything else until it is answered.
  if (state.event) {
    if (action.type === 'CHOOSE') {
      const next = structuredClone(state);
      chooseOption(next, action.index);
      return next;
    }
    if (action.type === 'DISMISS_EVENT') {
      const next = structuredClone(state);
      dismissEvent(next);
      return next;
    }
    return state;
  }

  if (action.type === 'CHOOSE' || action.type === 'DISMISS_EVENT') return state;

  if (currentMode(state) === 'TRAVEL') {
    const next = applyTravel(state, action as TravelAction);
    if (next === state) return state;
    // An event may have drawn steel; if so, do not stack another on top.
    if (!next.end && !next.battle) maybeFireEvent(next);
    return next;
  }

  // COLONY arrives in Phase 3.
  return state;
}
