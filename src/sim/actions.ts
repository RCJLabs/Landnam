// The single entry point the UI dispatches through. Pure: (state, action) -> state.
// Routing by mode lives here so each sim module stays focused on its own rules.

import { cloneState } from '../state/clone';
import { chronicle } from './saga';
import { currentMode, popMode, pushMode } from '../modes';
import type { GameState, Rations } from '../state/types';
import type { Hex } from '../hex';
import { chooseOption, dismissEvent, maybeFireEvent } from './events';
import { applyTravel, type TravelAction } from './travel';
import { isWarbandTurn } from './battle';
import { doReach, doStrike, doThrow } from './strike';
import { doDash, doDefend, doMove, doShove } from './footwork';
import { doWarCry } from './warcry';
import { endTurn, leaveBattle } from './battleTurn';
import { assign, makePlots, queueBuild, unqueueBuild } from './colony';
import { atHome } from './site';
import { abandonSteading } from './retreat';
import { stream } from '../rng';
import { key } from '../hex';
import type { JobId } from '../data/jobs';
import type { BuildingId } from '../data/buildings';
import type { Purpose } from '../state/types';
import { launch, turnForHome } from './expedition';
import { sailForHome } from './voyage';

export type BattleAction =
  | { type: 'B_MOVE'; to: Hex }
  | { type: 'B_STRIKE'; targetId: string }
  | { type: 'B_THROW'; targetId: string }
  | { type: 'B_SHOVE'; targetId: string }
  | { type: 'B_DEFEND' }
  | { type: 'B_WARCRY' }
  | { type: 'B_REACH'; targetId: string }
  | { type: 'B_DASH' }
  | { type: 'B_END_TURN' }
  | { type: 'B_LEAVE' };

export type ExpeditionAction =
  | { type: 'LAUNCH'; members: string[]; purpose: Purpose }
  | { type: 'TURN_HOME' };

export type ColonyAction =
  | { type: 'ENTER_COLONY' }
  | { type: 'LEAVE_COLONY' }
  | { type: 'ASSIGN'; personId: string; job: JobId | null }
  | { type: 'QUEUE_BUILD'; building: BuildingId }
  | { type: 'UNQUEUE_BUILD'; building: BuildingId }
  | { type: 'SET_RATIONS'; rations: Rations }
  | { type: 'ABANDON' };

export type Action =
  | TravelAction
  | BattleAction
  | ColonyAction
  | ExpeditionAction
  | { type: 'CHOOSE'; index: number }
  | { type: 'DISMISS_EVENT' }
  | { type: 'DISMISS_AFTERMATH' };

const COLONY_TYPES = new Set([
  'ENTER_COLONY',
  'LEAVE_COLONY',
  'ASSIGN',
  'QUEUE_BUILD',
  'UNQUEUE_BUILD',
  'SET_RATIONS',
  'ABANDON',
]);

const BATTLE_TYPES = new Set([
  'B_MOVE',
  'B_STRIKE',
  'B_THROW',
  'B_SHOVE',
  'B_DEFEND',
  'B_WARCRY',
  'B_REACH',
  'B_DASH',
  'B_END_TURN',
  'B_LEAVE',
]);

export function apply(state: GameState, action: Action): GameState {
  if (state.end) return state;

  // A fight on the field outranks everything else.
  if (currentMode(state) === 'BATTLE' && state.battle) {
    if (!BATTLE_TYPES.has(action.type)) return state;
    const next = cloneState(state);

    switch (action.type) {
      case 'B_MOVE':
        if (!isWarbandTurn(next) || !doMove(next, action.to)) return state;
        return next;
      case 'B_STRIKE':
        if (!isWarbandTurn(next) || !doStrike(next, action.targetId)) return state;
        return next;
      case 'B_REACH':
        if (!isWarbandTurn(next) || !doReach(next, action.targetId)) return state;
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
      case 'B_WARCRY':
        if (!isWarbandTurn(next) || !doWarCry(next)) return state;
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
    const next = cloneState(state);
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
      return next === state ? state : { ...cloneState(state), modes: next.modes };
    }
    if (action.type === 'ASSIGN') {
      const next = cloneState(state);
      if (!assign(next, action.personId, action.job)) return state;
      return next;
    }
    if (action.type === 'QUEUE_BUILD') {
      const next = cloneState(state);
      if (!queueBuild(next, action.building)) return state;
      return next;
    }
    if (action.type === 'ABANDON') {
      // The door `readiness()` has been pointing at since the winter work.
      // A steading decision, taken standing in it — see src/sim/retreat.ts
      // for the cost and src/data/retreat.ts for why it is that much.
      const next = cloneState(state);
      if (!abandonSteading(next)) return state;
      // Out of the colony panel, because there is no colony to be in. The
      // stack never empties: popping the last mode is refused elsewhere and
      // a settled band always has TRAVEL under it.
      return currentMode(next) === 'COLONY' ? popMode(next) : next;
    }

    if (action.type === 'SET_RATIONS') {
      // The winter lever. A steading decision — it is the household's rule
      // for the season, and the steading is where the mark that answers it is
      // shown. Refused when nothing would change, so the day's UI does not
      // report a move that did nothing.
      if ((state.party.rations ?? 'full') === action.rations) return state;
      const next = cloneState(state);
      next.party.rations = action.rations;
      chronicle(
        next,
        action.rations === 'half'
          ? 'We went onto short commons. Everyone knew what it was for and nobody said so.'
          : 'Full shares again. It was the first evening in a while that anybody talked at the fire.',
        action.rations === 'half' ? 'grim' : 'good',
      );
      return next;
    }
    if (action.type === 'UNQUEUE_BUILD') {
      const next = cloneState(state);
      if (!unqueueBuild(next, action.building)) return state;
      return next;
    }
    return state;
  }

  if (COLONY_TYPES.has(action.type)) return state;

  // --- Expeditions ---

  if (action.type === 'LAUNCH') {
    if (currentMode(state) !== 'TRAVEL' || state.event || state.aftermath) return state;
    const next = cloneState(state);
    // 'home' is not an expedition. It rides the same picker because the
    // question is the same — which hands can the hall spare — but what it
    // makes is a voyage, and a voyage leaves the map.
    const went = action.purpose === 'home'
      ? sailForHome(next, action.members)
      : launch(next, action.members, action.purpose);
    if (!went) return state;
    return next;
  }
  if (action.type === 'TURN_HOME') {
    if (currentMode(state) !== 'TRAVEL' || state.event) return state;
    const next = cloneState(state);
    if (!turnForHome(next)) return state;
    return next;
  }

  // The reckoning from a fight blocks the road until it has been read. It is
  // the only place the player is told who did not get up.
  if (state.aftermath) {
    if (action.type !== 'DISMISS_AFTERMATH') return state;
    const next = cloneState(state);
    delete next.aftermath;
    return next;
  }
  if (action.type === 'DISMISS_AFTERMATH') return state;

  // A card on the table blocks everything else until it is answered.
  if (state.event) {
    if (action.type === 'CHOOSE') {
      // A card that has already been answered has nothing left to choose.
      // Without this the call was ACCEPTED and did nothing — `chooseOption`
      // is a no-op on a resolved card, so a fresh clone came back identical.
      // Harmless in the web build, which only offers the choices while they
      // exist, and not harmless at all to anything that reads `apply`'s
      // "same object means refused" contract: `scripts/record.ts` believed
      // it and recorded 1,973 accepted CHOOSEs across 28 days.
      if (state.event.outcome) return state;
      const next = cloneState(state);
      chooseOption(next, action.index);
      return next;
    }
    if (action.type === 'DISMISS_EVENT') {
      const next = cloneState(state);
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
