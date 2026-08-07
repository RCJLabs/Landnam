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
