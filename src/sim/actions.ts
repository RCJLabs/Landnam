// The single entry point the UI dispatches through. Pure: (state, action) -> state.
// Routing by mode lives here so each sim module stays focused on its own rules.

import { currentMode } from '../modes';
import type { GameState } from '../state/types';
import { chooseOption, dismissEvent, maybeFireEvent } from './events';
import { applyTravel, type TravelAction } from './travel';

export type Action =
  | TravelAction
  | { type: 'CHOOSE'; index: number }
  | { type: 'DISMISS_EVENT' };

export function apply(state: GameState, action: Action): GameState {
  if (state.end) return state;

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
    const next = applyTravel(state, action);
    if (next === state) return state;
    if (!next.end) maybeFireEvent(next);
    return next;
  }

  // BATTLE and COLONY arrive in Phase 2 and 3.
  return state;
}
