// What just changed on screen, so the chrome can point at it.
//
// Animation in this game is decoration and nothing else — every state change
// has already happened by the time anything here runs, and the renderers stay
// logic-free. What lives here is the one question a view cannot answer on its
// own, because it is rebuilt from scratch on every render: which of these
// numbers is different from the last time I drew you?
//
// Pure and keyed by name, so it is testable without a DOM.

export type Bumps = Record<string, boolean>;

/**
 * Compares two readings and reports which entries moved.
 *
 * The FIRST reading never bumps. Loading a save, or opening the game at all,
 * is not a moment where six numbers changed — it is a moment where they were
 * seen for the first time, and flashing the whole bar at somebody would be
 * noise with no information in it.
 */
export function bumped(
  previous: Record<string, number> | null,
  next: Record<string, number>,
): Bumps {
  const out: Bumps = {};
  if (!previous) return out;
  for (const [name, value] of Object.entries(next)) {
    const was = previous[name];
    out[name] = was !== undefined && was !== value;
  }
  return out;
}

/**
 * Remembers the last reading it was shown. One per bar; the top bar and the
 * battle bar are different sets of numbers and must not overwrite each other.
 */
export function makeWatch(): (next: Record<string, number>) => Bumps {
  let previous: Record<string, number> | null = null;
  return (next) => {
    const changes = bumped(previous, next);
    previous = { ...next };
    return changes;
  };
}

/** Whether the viewer has asked for less movement. Honoured by CSS too. */
export function wantsStillness(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
