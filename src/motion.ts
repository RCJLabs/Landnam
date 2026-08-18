// The motion preference: with the device, or kept still.
//
// The game has honoured prefers-reduced-motion since 5.3 — but that is a
// device-wide switch buried in an OS menu, and somebody who wants THIS
// game's screen still should not have to still their whole phone to get it.
// The choice lives beside the mute in the preference store; 'system' means
// the media query decides, exactly as before this setting existed.

import { read, write } from './store';

const KEY = 'landnam_motion';

export type MotionPref = 'system' | 'still';

const isPref = (value: unknown): value is MotionPref =>
  value === 'system' || value === 'still';

export function motionPref(): MotionPref {
  return read(KEY, isPref, 'system');
}

export function setMotionPref(pref: MotionPref): void {
  write(KEY, pref);
  applyMotionPref(pref);
}

/** Puts the choice on the root element, where the stylesheet reads it. */
export function applyMotionPref(pref: MotionPref = motionPref()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('still', pref === 'still');
}

/**
 * Is the game meant to be holding still right now?
 *
 * The stylesheet has always answered this with `.still` plus a
 * `prefers-reduced-motion` media query, which is two halves of one rule
 * expressed only in CSS. Haptics needs the same answer and cannot read a
 * stylesheet, so the rule is here in words and the CSS keeps its own copy —
 * a buzz in the hand is motion, whatever it is that moves.
 */
export function keptStill(pref: MotionPref = motionPref()): boolean {
  if (pref === 'still') return true;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
