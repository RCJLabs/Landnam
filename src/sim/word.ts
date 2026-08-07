// Word of the band, and what it costs.
//
// The audit's third finding: the home raid was the only thing in the game
// that grew with the years. Travel and sea fights drew the same four
// archetypes at the same weights on day 700 as day 7, so the long game got
// longer without getting harder. This is the missing scalar — how much this
// coast has HEARD about the band — and it is built from exactly two things:
// how long they have stood, and what they have done. Winters accumulate on
// their own; sackings are chosen. A quiet band ages into mild fame; a
// band that robs the coast buys its escalation by hand.
//
// It feeds open-field fights only. The home raid has its own machinery
// (raidDifficulty, raidPressure, raiderCap) and sackings already reach it
// through standing — routing word there too would count the same deed
// twice.

import type { GameState } from '../state/types';
import type { FoeArchetype } from '../data/foes';
import { wintersStood } from './calendar';

/** How much the coast has heard: years stood, and deeds chosen. */
export function wordOf(state: GameState): number {
  return wintersStood(state.day) + state.tally.sackings * 0.5;
}

/**
 * What word adds to an open-field fight's difficulty. Nought through the
 * whole first year for a band that has robbed nobody — the tuned early game
 * must not move — then climbing, capped where the field itself runs out.
 */
export function wordBump(state: GameState): number {
  return Math.min(3, Math.floor(wordOf(state) / 2));
}

/**
 * Archetype weight under word: the men who come looking for a KNOWN band
 * lean harder toward huscarls and raiders — scouts do not measure themselves
 * against famous people. This is the knob that binds even when the foe
 * count has hit its cap: the same six men, but a harder six.
 */
export function weightFor(archetype: FoeArchetype, word: number): number {
  if (archetype.id === 'huscarl') return archetype.weight + word * 3;
  if (archetype.id === 'raider') return archetype.weight + word;
  return archetype.weight;
}
