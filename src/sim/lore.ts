// What the band knows, and what knowing it is worth.
//
// The whole of the mechanism is here: a list of ids on the state, one lookup,
// and one sum. Everything else in the sim asks `bonus(state, 'bite')` and
// never has to know which discovery supplied it — which is what lets a new
// lore be a single entry in data/lore.ts and nothing else.

import { LORE, loreById, type LoreId, type LoreKnob } from '../data/lore';
import type { GameState } from '../state/types';
import { chronicle } from './saga';

export function knows(state: GameState, id: LoreId): boolean {
  return state.lore.includes(id);
}

/** Everything the band has worked out, in the order it worked it out. */
export function known(state: GameState) {
  return state.lore.map(loreById).filter((l): l is NonNullable<typeof l> => !!l);
}

/** What is still out there to be found. Never shown to the player as a list. */
export function unknownLore(state: GameState) {
  return LORE.filter((l) => !state.lore.includes(l.id));
}

/**
 * The sum of one knob across everything known. Absent knobs are zero, so a
 * lore that has nothing to say about mending contributes nothing to mending.
 */
export function bonus(state: GameState, knob: LoreKnob): number {
  let total = 0;
  for (const def of known(state)) total += def[knob] ?? 0;
  return total;
}

/**
 * Learns something, once. Returns false if the band already knew it, so
 * callers can tell a discovery from a repeat and not write the saga line twice.
 *
 * Written in saga voice on purpose: working a thing out is one of the few
 * moments in a run that is unambiguously good, and it should read like one.
 */
export function learn(state: GameState, id: LoreId): boolean {
  if (knows(state, id)) return false;
  const def = loreById(id);
  if (!def) return false;
  state.lore.push(id);
  chronicle(state, `We had the way of it now: ${def.name.toLowerCase()}. ${def.gain}`, 'saga');
  return true;
}
