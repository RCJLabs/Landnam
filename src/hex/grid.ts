// Neighborhood, distance, and shape queries over the axial grid.

import { Hex, round } from './coords';

/**
 * The six unit directions, ordered so that (dir + 3) % 6 is the opposite.
 * 0 = east, then counter-clockwise.
 */
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function neighbor(h: Hex, direction: number): Hex {
  const d = DIRECTIONS[((direction % 6) + 6) % 6]!;
  return { q: h.q + d.q, r: h.r + d.r };
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Direction index from a toward adjacent hex b, or -1 if not adjacent. */
export function directionTo(a: Hex, b: Hex): number {
  return DIRECTIONS.findIndex((d) => a.q + d.q === b.q && a.r + d.r === b.r);
}

/** Every hex exactly `radius` steps from center. radius 0 yields [center]. */
export function ring(center: Hex, radius: number): Hex[] {
  if (radius <= 0) return [{ ...center }];
  const out: Hex[] = [];
  let h: Hex = { q: center.q - radius, r: center.r + radius };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push({ ...h });
      h = neighbor(h, side);
    }
  }
  return out;
}

/** Every hex within `radius` steps of center, inclusive. */
export function range(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let rr = 0; rr <= radius; rr++) out.push(...ring(center, rr));
  return out;
}

/** Hexes along the straight line from a to b, both endpoints included. */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [{ ...a }];
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Epsilon nudge breaks exact-tie rounding deterministically.
    out.push(round(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}
