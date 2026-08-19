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

/**
 * What being proclaimed is worth to a band's fame, before a single winter
 * of ruling has passed. A jarldom is the loudest thing that can happen to
 * a name on this coast, and 6.4's endless rule would be a victory lap
 * without it: the men who come looking after the Thing have to be worse
 * than the men who came before it.
 */
export const JARL_WORD = 3;

/** How much the coast has heard: years stood, deeds chosen, and rank. */
export function wordOf(state: GameState): number {
  return (
    wintersStood(state.day) +
    state.tally.sackings * 0.5 +
    (state.jarl ? JARL_WORD : 0)
  );
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
  // Data, not a list of ids. This was three lines naming 'huscarl' and
  // 'raider', which meant a new foe could not change with your reputation
  // without an engine edit — see FoeArchetype.renown, and the test that
  // holds this file to it.
  //
  // Never below zero: a negative weight is not "rare", it is a weighted pick
  // reaching for a number that cannot be drawn. The levies thin out to
  // nothing and stop, which is the intent.
  return Math.max(0, archetype.weight + word * archetype.renown);
}
