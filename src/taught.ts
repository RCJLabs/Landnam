// What this player has already been told.
//
// Deliberately NOT in the save, beside the mute and for the same reason: a
// run is a story about a band, and "has this person read the card about
// firewood" is a fact about the person holding the phone. Putting it in the
// save would re-teach the game on every new landing and would make the same
// seed play differently depending on who loaded it.

import { forget, isStringList, read, write } from './store';

const TAUGHT_KEY = 'landnam_taught';

export function taught(): string[] {
  // Unreadable or refused storage means an untaught player, which is the safe
  // way to be wrong: they see a card they may have seen before.
  return read(TAUGHT_KEY, isStringList, []);
}

export function markTaught(id: string): void {
  const known = taught();
  if (known.includes(id)) return;
  write(TAUGHT_KEY, [...known, id]);
}

/** Puts the teaching back, for a player who wants the cards again. */
export function forgetTeaching(): void {
  forget(TAUGHT_KEY);
}
