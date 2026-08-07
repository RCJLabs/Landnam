// Everything that outlives a run, read and written one way.
//
// Three things persist beside the save: whether the sound is off, which
// lessons this player has read, and the memorial wall. Each grew its own
// try/catch, its own JSON parse, and its own idea of what to do when the
// browser refuses storage — three copies of the same twenty lines, and none
// of them stamped with a version.
//
// The save has had a version and a migration registry since v1 precisely
// because getting that wrong destroys somebody's run. These are less
// precious, but "less precious" is how the Person.morale migration bug got
// missed for six versions. A stamp costs nothing and means a future shape
// change has somewhere to hook.

/** Bumped when the SHAPE of anything stored through here changes. */
export const PREFS_VERSION = 1;

const VERSION_KEY = 'landnam_prefs_version';

/**
 * Reads a stored value, or the fallback.
 *
 * Never throws. A browser with storage disabled, a quota exceeded, a value
 * some other tab half-wrote — all of them mean "this player has no
 * preference", which is a perfectly good thing to be.
 */
export function read<T>(key: string, guard: (value: unknown) => value is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Writes a value and stamps the version. Never throws. */
export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(VERSION_KEY, String(PREFS_VERSION));
  } catch {
    // Refused or full. The game does not stop for a preference.
  }
}

export function forget(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do and nothing worth saying.
  }
}

/** What version the stored preferences were last written at. 0 means never. */
export function storedVersion(): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
