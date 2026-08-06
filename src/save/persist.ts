// localStorage persistence with versioned keys.

import { GameRun, MetaProfile } from '../sim/types';
import { decodeRun, encodeRun } from './codec';

const META_KEY = 'whaleroad.meta.v1';
const RUN_KEY = 'whaleroad.run.v1';

export const META_VERSION = 1;

export function defaultMeta(): MetaProfile {
  return {
    version: META_VERSION,
    fame: 0,
    unlocks: [],
    runsPlayed: 0,
    bestDistanceWest: 0,
    victories: 0,
  };
}

export function loadMeta(): MetaProfile {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const meta = JSON.parse(raw) as MetaProfile;
    if (meta.version !== META_VERSION) return defaultMeta();
    return meta;
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaProfile): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full/blocked: play on without persistence.
  }
}

export function loadRun(): GameRun | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = decodeRun(raw);
    if (run.version !== 1) return null;
    return run;
  } catch {
    return null;
  }
}

export function saveRun(run: GameRun): void {
  try {
    localStorage.setItem(RUN_KEY, encodeRun(run));
  } catch {
    // ignore
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}
