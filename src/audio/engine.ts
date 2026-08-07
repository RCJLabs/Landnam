// The one impure corner of the audio: actual WebAudio nodes.
//
// Everything worth testing lives in cues.ts and ambience.ts as pure functions
// over state. This file only knows how to turn a recipe into sound, and it is
// written to be inert when it cannot: no AudioContext (jsdom, an old browser,
// a locked-down webview) means every call here quietly does nothing rather
// than throwing into the middle of a dispatch.
//
// There is no game loop. Cues are scheduled on the audio clock and forgotten;
// the wind bed is a handful of nodes wired to an LFO, so the gusts happen in
// the audio thread rather than in a timer. The game stays turn-based.

import { soundDef, type AmbienceProfile, type CueId } from '../data/sounds';
import { read, write } from '../store';

/** Preferences are not part of a run, so this is deliberately not in the save. */
const MUTE_KEY = 'landnam_mute';

/** Master trim. Every gain in the sound table is relative to this. */
const MASTER = 0.55;

/** Seconds a profile change takes to arrive. Weather does not snap. */
const EASE = 1.5;

interface Bed {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  gust: OscillatorNode;
  gustDepth: GainNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bed: Bed | null = null;
let muted = readMute();
/**
 * Detune counter. Repeated blows sound like a machine if they are identical,
 * and `Math.random` is banned — so the variation walks a fixed cycle instead,
 * which is both deterministic and not the seeded game RNG (audio must never
 * consume rolls the sim depends on).
 */
let nudge = 0;

/**
 * The mute, with a one-line migration in it.
 *
 * It shipped as the raw string '1' before the preferences went through a
 * shared store, so a player who silenced the game yesterday has that in their
 * browser today. Reading the old form and rewriting it in the new one costs
 * four lines and is the difference between a preference honoured and a
 * preference silently lost — which is exactly the failure the version stamp
 * exists to make visible.
 */
function readMute(): boolean {
  const stored = read(MUTE_KEY, (v): v is boolean => typeof v === 'boolean', null as unknown as boolean);
  if (typeof stored === 'boolean') return stored;
  try {
    const legacy = localStorage.getItem(MUTE_KEY) === '1';
    if (legacy) write(MUTE_KEY, true);
    return legacy;
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Flips the mute and remembers it. Returns the new state. */
export function toggleMute(): boolean {
  muted = !muted;
  write(MUTE_KEY, muted);
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.05);
  }
  return muted;
}

/**
 * Brings the audio up. Must be called from inside a real user gesture —
 * every mobile browser refuses to start an AudioContext any other way, which
 * is why nothing here happens at boot.
 */
export function wake(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const Ctor: typeof AudioContext | undefined =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return;
  try {
    ctx = new Ctor();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER;
  master.connect(ctx.destination);
}

/** True once there is something to make noise with and it is not muted. */
function live(): boolean {
  return ctx !== null && master !== null && !muted;
}

// --- Cues ---

export function play(id: CueId): void {
  if (!live()) return;
  const def = soundDef(id);
  if (!def || !ctx || !master) return;

  const now = ctx.currentTime;
  // A cycle of six is long enough that a run of strikes never repeats a pitch
  // twice running, and small enough that nothing sounds out of tune.
  nudge = (nudge + 1) % 6;
  const detune = (nudge - 2.5) * 7;

  for (const layer of def.layers) {
    const at = now + (layer.at ?? 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.gain), at + layer.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + layer.attack + layer.decay);
    gain.connect(master);

    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(layer.freq, at);
      if (layer.glide !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, layer.glide),
          at + layer.attack + layer.decay,
        );
      }
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + layer.attack + layer.decay + 0.02);
    } else {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.frequency.setValueAtTime(layer.freq, at);
      filter.Q.value = layer.q;
      if (layer.sweep !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(20, layer.sweep),
          at + layer.attack + layer.decay,
        );
      }
      source.connect(filter);
      filter.connect(gain);
      source.start(at);
      source.stop(at + layer.attack + layer.decay + 0.02);
    }
  }
}

/** Plays several cues without stacking them all on the same instant. */
export function playAll(ids: CueId[]): void {
  for (const id of ids) play(id);
}

// --- Noise ---

let noise: AudioBuffer | null = null;

/**
 * Two seconds of white noise, made once and shared. Filled from a fixed
 * xorshift rather than `Math.random`, which is banned project-wide — and
 * which would also make the wind a different wind on every reload.
 */
function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noise) return noise;
  const frames = context.sampleRate * 2;
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  let x = 0x9e3779b9;
  for (let i = 0; i < frames; i += 1) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // x is a signed 32-bit int; this lands it in [-1, 1).
    data[i] = x / 0x80000000;
  }
  noise = buffer;
  return buffer;
}

// --- Ambience ---

/**
 * Starts or re-aims the wind. Called whenever the game state might have
 * changed what the air should sound like; easing means calling it every
 * render is harmless.
 */
export function setAmbience(profile: AmbienceProfile): void {
  if (!ctx || !master) return;
  if (!bed) bed = startBed(ctx, master);
  if (!bed) return;

  const now = ctx.currentTime;
  bed.filter.frequency.setTargetAtTime(profile.cutoff, now, EASE);
  bed.gain.gain.setTargetAtTime(muted ? 0 : profile.gain, now, EASE);
  bed.gust.frequency.setTargetAtTime(profile.gustRate, now, EASE);
  bed.gustDepth.gain.setTargetAtTime(profile.cutoff * profile.gustDepth, now, EASE);
}

/** Silences the wind without tearing the graph down — used on the title screen. */
export function hushAmbience(): void {
  if (!ctx || !bed) return;
  bed.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

function startBed(context: AudioContext, out: GainNode): Bed | null {
  try {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context);
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.6;

    const gain = context.createGain();
    gain.gain.value = 0;

    // The gusts: a slow sine on the filter's own frequency. This runs in the
    // audio thread, so the wind keeps breathing without a single timer or
    // animation frame on the game side.
    const gust = context.createOscillator();
    gust.type = 'sine';
    gust.frequency.value = 0.2;
    const gustDepth = context.createGain();
    gustDepth.gain.value = 120;
    gust.connect(gustDepth);
    gustDepth.connect(filter.frequency);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start();
    gust.start();
    return { source, filter, gain, gust, gustDepth };
  } catch {
    return null;
  }
}
