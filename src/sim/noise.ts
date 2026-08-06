// Seeded fractal value noise. Deterministic and dependency-free — the whole
// landmass is a pure function of the worldgen stream.

import type { Rng } from '../rng';

const TABLE = 256;
const MASK = TABLE - 1;

export type NoiseFn = (x: number, y: number) => number;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Single-octave value noise in [0, 1). */
export function makeValueNoise(rng: Rng): NoiseFn {
  const values = new Float64Array(TABLE * TABLE);
  for (let i = 0; i < values.length; i++) values[i] = rng.next();

  const at = (x: number, y: number): number => values[(y & MASK) * TABLE + (x & MASK)]!;

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/**
 * Fractal Brownian motion over value noise, normalized to [0, 1].
 * More octaves = more coastline detail.
 */
export function makeFbm(rng: Rng, octaves = 4, lacunarity = 2, gain = 0.5): NoiseFn {
  const layers: NoiseFn[] = [];
  for (let i = 0; i < octaves; i++) layers.push(makeValueNoise(rng.derive(`octave:${i}`)));

  let maxAmplitude = 0;
  let amplitude = 1;
  for (let i = 0; i < octaves; i++) {
    maxAmplitude += amplitude;
    amplitude *= gain;
  }

  return (x, y) => {
    let total = 0;
    let amp = 1;
    let freq = 1;
    for (const layer of layers) {
      total += layer(x * freq, y * freq) * amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return total / maxAmplitude;
  };
}
