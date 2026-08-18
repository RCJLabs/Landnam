// What the game feels like in the hand.
//
// The sound already knows what just happened: `cuesFor` diffs two states and
// hands back a list of `CueId`. Haptics is a second reader of that same list
// rather than a second way of noticing things — so a blow that makes a noise
// and a blow that makes a buzz can never disagree about whether it landed.
//
// THREE RULES, and they are all about restraint.
//
// **One buzz per dispatch, and the heaviest wins.** Vibrations do not layer;
// two fired together arrive as one longer mush and the player learns nothing
// from it. Same reason the bell tolls once however many were lost.
//
// **The common cues are silent.** `step` fires on every move, `miss` on every
// swing that finds air, `gather` on every forage. A phone that buzzes several
// times a day of walking is a phone being put down, and a battery going flat
// for no information at all. What buzzes is what a player would want to feel
// through a pocket: steel, blood, a death, a roof, an ending.
//
// **Still means still.** Somebody who has asked for this game to hold still
// has asked about their hand too, not only about the screen.
//
// IT DOES NOTHING ON AN IPHONE. `navigator.vibrate` has never shipped in
// Safari on iOS and there is no substitute a web page may reach — the taptic
// engine is closed to us. This is an Android improvement, honestly, and the
// settings row hides itself rather than offering a switch that is wired to
// nothing.

import { keptStill } from './motion';
import { read, write } from './store';
import type { CueId } from './data/sounds';

const KEY = 'landnam_haptics';

export type HapticPref = 'on' | 'off';

const isPref = (value: unknown): value is HapticPref => value === 'on' || value === 'off';

export function hapticPref(): HapticPref {
  return read(KEY, isPref, 'on');
}

export function setHapticPref(pref: HapticPref): void {
  write(KEY, pref);
}

/**
 * What each cue feels like, heaviest first.
 *
 * The order IS the priority: the first cue in this list that the dispatch
 * produced is the one that gets felt. So a turn that kills a man and raises a
 * shield is a death, not a shield — which is the thing the player needs to
 * know and the thing they would have felt in the world.
 *
 * Numbers are milliseconds, alternating buzz and pause. Nothing here runs
 * past a fifth of a second: a long vibration on a phone is not "weightier",
 * it is a notification, and it feels like the game has gone wrong.
 */
export const FEELINGS: readonly (readonly [CueId, readonly number[]])[] = [
  // An ending, and the two ways a saga can stop. Long enough to be an event.
  ['jarl', [20, 45, 20, 45, 55]],
  ['ending', [90, 60, 40]],
  // A death. Two tolls, because one of anything reads as an ordinary hit.
  ['knell', [30, 90, 30]],
  ['lost', [70, 50, 30]],
  ['won', [22, 55, 22, 55, 45]],
  // Somebody is down but not gone.
  ['fell', [24, 70, 24]],
  // Steel: the horn going up, and a blow arriving.
  ['horn', [18, 55, 18]],
  ['strike', [16]],
  ['wall', [10, 40, 10]],
  // The steading. Quiet, satisfied things.
  ['posts', [16, 45, 16]],
  ['raised', [14, 45, 14]],
  // A season turning under you.
  ['thaw', [12, 60, 12]],
  // A card landing, and how it fell. The card is the lightest thing that
  // still earns a buzz, because it is the game asking for an answer.
  ['ill', [20, 50, 20]],
  ['card', [10]],
];

/** Everything that reaches the hand, for the test that says what does not. */
export const FELT = new Set<CueId>(FEELINGS.map(([id]) => id));

/**
 * The one pattern a dispatch is worth, or nothing at all.
 *
 * Pure, so what the game feels like can be asserted without a phone.
 */
export function patternFor(cues: readonly CueId[]): number[] | null {
  if (cues.length === 0) return null;
  const wanted = new Set(cues);
  for (const [id, pattern] of FEELINGS) {
    if (wanted.has(id)) return [...pattern];
  }
  return null;
}

/** Everything that decides whether a buzz happens, gathered so it can be faked. */
export interface Hand {
  /** Does this browser have `navigator.vibrate` at all? iOS never has. */
  supported: boolean;
  /** The player's own switch. */
  enabled: boolean;
  /** The game has been asked to hold still — by this game, or by the OS. */
  still: boolean;
}

/** The whole decision, pure: what to send to `navigator.vibrate`, or nothing. */
export function buzzFor(cues: readonly CueId[], hand: Hand): number[] | null {
  if (!hand.supported || !hand.enabled || hand.still) return null;
  return patternFor(cues);
}

/** True when this browser can do anything at all. False on every iPhone. */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Reads the world, decides, and buzzes. The only impure thing in this file. */
export function buzz(cues: readonly CueId[]): void {
  const pattern = buzzFor(cues, {
    supported: hapticsSupported(),
    enabled: hapticPref() === 'on',
    still: keptStill(),
  });
  if (!pattern) return;
  // Wrapped because a browser may refuse — no gesture yet, a policy, a
  // device with no motor — and a refusal is never worth an exception in the
  // middle of a dispatch.
  try {
    navigator.vibrate(pattern);
  } catch {
    /* a phone that will not buzz is still a phone that plays the game */
  }
}
