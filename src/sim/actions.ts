// The single entry point the UI dispatches through. Pure: (state, action) -> state.
// Routing by mode lives here so each sim module stays focused on its own rules.

import { currentMode, popMode, pushMode } from '../modes';
import type { GameState } from '../state/types';
import type { Hex } from '../hex';
import { chooseOption, dismissEvent, maybeFireEvent } from './events';
import { applyTravel, type TravelAction } from './travel';
import { isWarbandTurn } from './battle';
import { doDash, doDefend, doMove, doShove, doStrike, doThrow } from './battleActions';
import { endTurn, leaveBattle } from './battleTurn';
import { assign, makePlots } from './colony';
import { atHome } from './site';
import { stream } from '../rng';
import { key } from '../hex';
import type { JobId } from '../data/jobs';

export type BattleAction =
  | { type: 'B_MOVE'; to: Hex }
  | { type: 'B_STRIKE'; targetId: string }
  | { type: 'B_THROW'; targetId: string }
  | { type: 'B_SHOVE'; targetId: string }
  | { type: 'B_DEFEND' }
  | { type: 'B_DASH' }
  | { type: 'B_END_TURN' }
  | { type: 'B_LEAVE' };

export type ColonyAction =
  | { type: 'ENTER_COLONY' }
  | { type: 'LEAVE_COLONY' }
  | { type: 'ASSIGN'; personId: string; job: JobId | null };

export type Action =
  | TravelAction
  | BattleAction
  | ColonyAction
  | { type: 'CHOOSE'; index: number }
  | { type: 'DISMISS_EVENT' }
  | { type: 'DISMISS_AFTERMATH' };

const COLONY_TYPES = new Set(['ENTER_COLONY', 'LEAVE_COLONY', 'ASSIGN']);

const BATTLE_TYPES = new Set([
  'B_MOVE',
  'B_STRIKE',
  'B_THROW',
  'B_SHOVE',
  'B_DEFEND',
  'B_DASH',
  'B_END_TURN',
  'B_LEAVE',
]);

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
      case 'B_THROW':
        if (!isWarbandTurn(next) || !doThrow(next, action.targetId)) return state;
        return next;
      case 'B_SHOVE':
        if (!isWarbandTurn(next) || !doShove(next, action.targetId)) return state;
        return next;
      case 'B_DEFEND':
        if (!isWarbandTurn(next) || !doDefend(next)) return state;
        return next;
      case 'B_DASH':
        if (!isWarbandTurn(next) || !doDash(next)) return state;
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

  // --- COLONY ---

  if (action.type === 'ENTER_COLONY') {
    if (!atHome(state) || state.event || currentMode(state) !== 'TRAVEL') return state;
    const next = structuredClone(state);
    // A save from before COLONY existed carries a settlement with no ground.
    // Regenerate it here rather than in the migration, which cannot reach the
    // rng or today's plot rules.
    const home = next.settlement!;
    if (home.plots.length === 0) {
      home.plots = makePlots(
        home.report,
        home.at,
        stream(next.seed, 'colony').derive(`found:${key(home.at)}`).derive('plots'),
      );
    }
    next.modes = pushMode(next, 'COLONY').modes;
    return next;
  }

  if (currentMode(state) === 'COLONY') {
    if (!COLONY_TYPES.has(action.type)) return state;
    if (action.type === 'LEAVE_COLONY') {
      const next = popMode(state);
      return next === state ? state : { ...structuredClone(state), modes: next.modes };
    }
    if (action.type === 'ASSIGN') {
      const next = structuredClone(state);
      if (!assign(next, action.personId, action.job)) return state;
      return next;
    }
    return state;
  }

  if (COLONY_TYPES.has(action.type)) return state;

  // The reckoning from a fight blocks the road until it has been read. It is
  // the only place the player is told who did not get up.
  if (state.aftermath) {
    if (action.type !== 'DISMISS_AFTERMATH') return state;
    const next = structuredClone(state);
    delete next.aftermath;
    return next;
  }
  if (action.type === 'DISMISS_AFTERMATH') return state;

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
