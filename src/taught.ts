// What this player has already been told.
//
// Deliberately NOT in the save, beside the mute and for the same reason: a
// run is a story about a band, and "has this person read the card about
// firewood" is a fact about the person holding the phone. Putting it in the
// save would re-teach the game on every new landing and would make the same
// seed play differently depending on who loaded it.

const TAUGHT_KEY = 'landnam_taught';

export function taught(): string[] {
  try {
    const raw = localStorage.getItem(TAUGHT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // Unreadable or refused storage means an untaught player, which is the
    // safe way to be wrong: they see a card they may have seen before.
    return [];
  }
}

export function markTaught(id: string): void {
  const known = taught();
  if (known.includes(id)) return;
  try {
    localStorage.setItem(TAUGHT_KEY, JSON.stringify([...known, id]));
  } catch {
    // A browser refusing storage is not a reason to refuse the game.
  }
}

/** Puts the teaching back, for a player who wants the cards again. */
export function forgetTeaching(): void {
  try {
    localStorage.removeItem(TAUGHT_KEY);
  } catch {
    // Nothing to do and nothing worth saying.
  }
}
