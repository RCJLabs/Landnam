// Everyone who did not come back, across every run.
//
// Third of the three things that outlive a run — the mute, the teaching, and
// this — and stored the same way, in its own localStorage key rather than in
// the save. A memorial that died with the band would not be a memorial; the
// whole point is that the wall gets longer while the runs keep ending.
//
// The reading and writing is here; the wall itself is drawn in render/cards.

/** Fallen from older runs, newest first. */
const FALLEN_KEY = 'landnam_fallen';

/** How many names the wall keeps. Long enough to be a history, short enough
 *  to render on a phone and to stay well inside a localStorage quota. */
export const WALL_LIMIT = 60;

export interface Fallen {
  name: string;
  byname: string;
  /** What did it. Already a sentence fragment in the game's voice. */
  fate: string;
  /** The day of the run they died on. */
  day: number;
  /** Which run, so two Ketils from different sagas are two people. */
  seed: string;
}

export function fallen(): Fallen[] {
  try {
    const raw = localStorage.getItem(FALLEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFallen) : [];
  } catch {
    return [];
  }
}

function isFallen(value: unknown): value is Fallen {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.byname === 'string' &&
    typeof row.fate === 'string' &&
    typeof row.day === 'number' &&
    typeof row.seed === 'string'
  );
}

/**
 * Adds this run's dead to the wall.
 *
 * Keyed on seed AND name, so finishing the same run twice — reloading an
 * ending, or replaying a seed — does not carve anybody twice. Newest first,
 * trimmed to the limit.
 */
export function remember(dead: Fallen[]): void {
  if (dead.length === 0) return;
  const wall = fallen();
  const already = new Set(wall.map((f) => `${f.seed}:${f.name}:${f.day}`));
  const fresh = dead.filter((f) => !already.has(`${f.seed}:${f.name}:${f.day}`));
  if (fresh.length === 0) return;
  try {
    localStorage.setItem(FALLEN_KEY, JSON.stringify([...fresh, ...wall].slice(0, WALL_LIMIT)));
  } catch {
    // A full or refused store is not worth interrupting an ending for.
  }
}

export function clearWall(): void {
  try {
    localStorage.removeItem(FALLEN_KEY);
  } catch {
    // Nothing to do.
  }
}
