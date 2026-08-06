// Persistence. GameState is plain JSON by construction, so saving is a
// stringify — the interesting work is migrating old saves on the way in.

import type { GameState } from './types';
import { migrate } from './migrations';
import { SAVE_KEY, SAVE_VERSION } from './version';

export function encode(state: GameState): string {
  return JSON.stringify(state);
}

/** Parses and migrates. Returns null if the payload is unusable. */
export function decode(json: string): GameState | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const { save } = migrate(raw as Record<string, unknown>);
    return save as unknown as GameState;
  } catch {
    return null;
  }
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, encode({ ...state, version: SAVE_VERSION }));
  } catch {
    // Private browsing or a full quota — play on without persistence.
  }
}

export function load(): GameState | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    return json ? decode(json) : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
