// Every sound the game makes, written down as a recipe rather than recorded.
//
// Hard constraint 1 is zero external assets, so there are no audio files and
// never will be. What is here instead is a description of how to BUILD each
// sound out of oscillators and filtered noise — a horn is two detuned saws
// under a slow swell, a shield-strike is a click of noise over a low thud.
// The engine in src/audio reads these and schedules nodes; nothing in this
// file knows WebAudio exists, which is what makes it testable data.
//
// Frequencies are hertz, times are seconds, gains are 0..1 before the master.

/** A plain oscillator: a pitch with a shape and an envelope. */
export interface ToneLayer {
  kind: 'tone';
  wave: OscillatorType;
  /** Starting pitch. */
  freq: number;
  /** Pitch to slide to across the layer's life. Absent means hold. */
  glide?: number;
  gain: number;
  /** Seconds to reach full gain. Short is a hit, long is a swell. */
  attack: number;
  /** Seconds to fall back to silence after the attack. */
  decay: number;
  /** Seconds to wait before this layer starts. */
  at?: number;
}

/** Filtered white noise: wind, breath, gravel, the crack of a shield. */
export interface NoiseLayer {
  kind: 'noise';
  filter: BiquadFilterType;
  freq: number;
  q: number;
  /** Filter frequency to sweep to. Absent means hold. */
  sweep?: number;
  gain: number;
  attack: number;
  decay: number;
  at?: number;
}

export type Layer = ToneLayer | NoiseLayer;

export interface SoundDef {
  id: CueId;
  /** One line on what it is meant to sound like. Documentation, not logic. */
  note: string;
  layers: Layer[];
}

export type CueId =
  | 'step'
  | 'oar'
  | 'daybreak'
  | 'camp'
  | 'gather'
  | 'card'
  | 'fair'
  | 'ill'
  | 'horn'
  | 'strike'
  | 'miss'
  | 'fell'
  | 'wall'
  | 'won'
  | 'lost'
  | 'posts'
  | 'raised'
  | 'thaw'
  | 'knell'
  | 'jarl'
  | 'ending'
  | 'tap'
  | 'shut';

export const SOUNDS: SoundDef[] = [
  {
    id: 'step',
    note: 'A boot in wet grass. Deliberately almost nothing — it fires every move.',
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 900, q: 0.8, sweep: 420, gain: 0.1, attack: 0.004, decay: 0.09 },
    ],
  },
  {
    id: 'oar',
    note: 'An oar entering water: a duller, wetter step.',
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 700, q: 0.7, sweep: 240, gain: 0.13, attack: 0.01, decay: 0.22 },
    ],
  },
  {
    id: 'daybreak',
    note: 'The day turning over. A single soft fifth, low enough to sit under speech.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 196, gain: 0.09, attack: 0.05, decay: 0.5 },
      { kind: 'tone', wave: 'sine', freq: 294, gain: 0.05, attack: 0.08, decay: 0.6, at: 0.04 },
    ],
  },
  {
    id: 'camp',
    note: 'Fire catching: a breath of noise that settles.',
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 1800, q: 0.5, sweep: 380, gain: 0.14, attack: 0.06, decay: 0.9 },
      { kind: 'tone', wave: 'sine', freq: 147, gain: 0.06, attack: 0.1, decay: 0.7 },
    ],
  },
  {
    id: 'gather',
    note: 'Something dropped into a basket.',
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 523, glide: 659, gain: 0.08, attack: 0.005, decay: 0.16 },
      { kind: 'noise', filter: 'highpass', freq: 2200, q: 0.7, gain: 0.05, attack: 0.003, decay: 0.07 },
    ],
  },
  {
    id: 'card',
    note: 'Something looks up. A short rising third — attention, not alarm.',
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 330, glide: 415, gain: 0.09, attack: 0.01, decay: 0.28 },
    ],
  },
  {
    id: 'fair',
    note: 'It went well. Rising fifth, plain and unsmug.',
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 392, gain: 0.09, attack: 0.01, decay: 0.22 },
      { kind: 'tone', wave: 'triangle', freq: 587, gain: 0.08, attack: 0.01, decay: 0.34, at: 0.1 },
    ],
  },
  {
    id: 'ill',
    note: 'It did not. A falling minor second, which is the sound of wincing.',
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 311, gain: 0.09, attack: 0.01, decay: 0.2 },
      { kind: 'tone', wave: 'triangle', freq: 233, gain: 0.09, attack: 0.01, decay: 0.42, at: 0.09 },
    ],
  },
  {
    id: 'horn',
    note: 'A war horn. Two detuned saws through a swell — the loudest thing here, on purpose.',
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 147, glide: 220, gain: 0.11, attack: 0.09, decay: 0.85 },
      { kind: 'tone', wave: 'sawtooth', freq: 149, glide: 222, gain: 0.09, attack: 0.12, decay: 0.9 },
      { kind: 'tone', wave: 'sine', freq: 73, gain: 0.08, attack: 0.05, decay: 1 },
    ],
  },
  {
    id: 'strike',
    note: 'Iron on a limewood shield: a noise crack over a body thud.',
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 2600, q: 1.2, sweep: 900, gain: 0.15, attack: 0.002, decay: 0.1 },
      { kind: 'tone', wave: 'triangle', freq: 130, glide: 82, gain: 0.12, attack: 0.002, decay: 0.16 },
    ],
  },
  {
    id: 'miss',
    note: 'A blow going by. Air, no impact.',
    layers: [
      { kind: 'noise', filter: 'bandpass', freq: 1500, q: 2.5, sweep: 500, gain: 0.09, attack: 0.01, decay: 0.16 },
    ],
  },
  {
    id: 'fell',
    note: 'Somebody goes down. A drop with weight behind it.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 160, glide: 55, gain: 0.15, attack: 0.004, decay: 0.4 },
      { kind: 'noise', filter: 'lowpass', freq: 500, q: 0.6, sweep: 140, gain: 0.11, attack: 0.005, decay: 0.3 },
    ],
  },
  {
    id: 'wall',
    note: 'Shields coming together — the wall forming.',
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 1200, q: 0.8, sweep: 300, gain: 0.12, attack: 0.004, decay: 0.14 },
      { kind: 'tone', wave: 'square', freq: 98, gain: 0.06, attack: 0.004, decay: 0.12 },
    ],
  },
  {
    id: 'won',
    note: 'The field held. A drum figure that lands rather than a fanfare.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 110, gain: 0.14, attack: 0.005, decay: 0.22 },
      { kind: 'tone', wave: 'sine', freq: 110, gain: 0.12, attack: 0.005, decay: 0.22, at: 0.18 },
      { kind: 'tone', wave: 'sine', freq: 165, gain: 0.13, attack: 0.005, decay: 0.5, at: 0.36 },
      { kind: 'tone', wave: 'triangle', freq: 330, gain: 0.07, attack: 0.02, decay: 0.7, at: 0.36 },
    ],
  },
  {
    id: 'lost',
    note: 'The field lost. The same weight, walking downward.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 110, gain: 0.13, attack: 0.006, decay: 0.3 },
      { kind: 'tone', wave: 'sine', freq: 87, gain: 0.13, attack: 0.006, decay: 0.4, at: 0.22 },
      { kind: 'tone', wave: 'sawtooth', freq: 55, gain: 0.08, attack: 0.05, decay: 1.1, at: 0.44 },
    ],
  },
  {
    id: 'posts',
    note: 'The land taken. A maul into a post, three times, then the ground answering.',
    layers: [
      { kind: 'noise', filter: 'lowpass', freq: 900, q: 0.7, sweep: 200, gain: 0.15, attack: 0.003, decay: 0.16 },
      { kind: 'noise', filter: 'lowpass', freq: 900, q: 0.7, sweep: 200, gain: 0.15, attack: 0.003, decay: 0.16, at: 0.24 },
      { kind: 'noise', filter: 'lowpass', freq: 900, q: 0.7, sweep: 200, gain: 0.16, attack: 0.003, decay: 0.2, at: 0.48 },
      { kind: 'tone', wave: 'sine', freq: 98, gain: 0.1, attack: 0.08, decay: 1.4, at: 0.5 },
      { kind: 'tone', wave: 'sine', freq: 147, gain: 0.07, attack: 0.12, decay: 1.4, at: 0.55 },
    ],
  },
  {
    id: 'raised',
    note: 'A building finished. Timber settling into place.',
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 262, gain: 0.08, attack: 0.008, decay: 0.2 },
      { kind: 'tone', wave: 'triangle', freq: 392, gain: 0.08, attack: 0.008, decay: 0.36, at: 0.12 },
      { kind: 'noise', filter: 'lowpass', freq: 800, q: 0.6, gain: 0.07, attack: 0.005, decay: 0.18 },
    ],
  },
  {
    id: 'thaw',
    note: 'The season turns. A slow open fifth, which is as close to hope as this game gets.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 220, gain: 0.08, attack: 0.25, decay: 1.2 },
      { kind: 'tone', wave: 'sine', freq: 330, gain: 0.06, attack: 0.35, decay: 1.3, at: 0.15 },
      { kind: 'tone', wave: 'sine', freq: 440, gain: 0.04, attack: 0.4, decay: 1.4, at: 0.3 },
    ],
  },
  {
    id: 'knell',
    note: 'Somebody in the band died. One low bell, allowed to ring out.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 110, gain: 0.14, attack: 0.006, decay: 2.2 },
      { kind: 'tone', wave: 'sine', freq: 164, gain: 0.06, attack: 0.01, decay: 1.8 },
      { kind: 'tone', wave: 'sine', freq: 55, gain: 0.09, attack: 0.02, decay: 2.6 },
    ],
  },
  {
    id: 'jarl',
    note: 'The Thing carried. The horn again, answered a fourth up — the only triumphant sound in the game.',
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 147, gain: 0.1, attack: 0.08, decay: 0.7 },
      { kind: 'tone', wave: 'sawtooth', freq: 196, gain: 0.1, attack: 0.08, decay: 0.9, at: 0.5 },
      { kind: 'tone', wave: 'sawtooth', freq: 294, gain: 0.09, attack: 0.1, decay: 1.6, at: 1 },
      { kind: 'tone', wave: 'sine', freq: 98, gain: 0.09, attack: 0.1, decay: 2.2, at: 1 },
    ],
  },
  {
    id: 'ending',
    note: 'The run is over, however it went. A long fall to nothing.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 196, glide: 65, gain: 0.11, attack: 0.15, decay: 2.4 },
      { kind: 'noise', filter: 'lowpass', freq: 600, q: 0.5, sweep: 90, gain: 0.08, attack: 0.3, decay: 2.2 },
    ],
  },
  {
    id: 'tap',
    note: 'A finger on a button. Must be quiet enough to hear a hundred times.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 660, gain: 0.045, attack: 0.002, decay: 0.05 },
    ],
  },
  {
    id: 'shut',
    note: 'A panel closing. The tap, going the other way.',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 440, glide: 330, gain: 0.045, attack: 0.002, decay: 0.07 },
    ],
  },
];

const BY_ID = new Map(SOUNDS.map((s) => [s.id, s]));

export function soundDef(id: CueId): SoundDef | undefined {
  return BY_ID.get(id);
}

/** How long a sound runs, so the engine knows when to let its nodes go. */
export function soundLength(def: SoundDef): number {
  return def.layers.reduce(
    (longest, layer) => Math.max(longest, (layer.at ?? 0) + layer.attack + layer.decay),
    0,
  );
}

// --- Ambience ---

/**
 * The wind bed. Not a cue: one continuous voice whose character is read off
 * the game state and eased toward, so walking from a summer meadow onto a
 * winter shore is a change you hear before you look at the top bar.
 */
export interface AmbienceProfile {
  /** Lowpass corner. Low is a muffled hall, high is an exposed coast. */
  cutoff: number;
  /** Bed volume, 0..1. */
  gain: number;
  /** Gusts per second — how restless the air is. */
  gustRate: number;
  /** How far a gust swings the cutoff, as a fraction of it. */
  gustDepth: number;
}

/** What a sheltered room sounds like: the floor every profile is built up from. */
export const AMBIENCE_INDOORS: AmbienceProfile = {
  cutoff: 320,
  gain: 0.05,
  gustRate: 0.07,
  gustDepth: 0.25,
};
