// The mode stack: TRAVEL | BATTLE | COLONY.
//
// BATTLE pushes on top of whatever is underneath (travel or colony) and pops
// back with a result, so the layer below never loses its place. The stack
// lives in GameState so a save restores you exactly where you were.

import type { GameState, Mode } from './state/types';

export function currentMode(state: GameState): Mode {
  return state.modes[state.modes.length - 1] ?? 'TRAVEL';
}

export function isMode(state: GameState, mode: Mode): boolean {
  return currentMode(state) === mode;
}

/** Pushes a mode on top. The layer beneath is preserved. */
export function pushMode(state: GameState, mode: Mode): GameState {
  return { ...state, modes: [...state.modes, mode] };
}

/** Pops the top mode. Refuses to empty the stack. */
export function popMode(state: GameState): GameState {
  if (state.modes.length <= 1) return state;
  return { ...state, modes: state.modes.slice(0, -1) };
}

/** Replaces the whole stack — used when travel gives way to colony for good. */
export function setMode(state: GameState, mode: Mode): GameState {
  return { ...state, modes: [mode] };
}
