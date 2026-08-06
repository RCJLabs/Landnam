// Field-of-view helpers.
// Strategic layer: simple radius reveal (weather limits sight, not terrain).
// Tactical layer: line-of-sight with blocking tiles.

import { Axial, key, HexKey, spiral, line } from './hex';

/** All hexes within `radius` of center — the strategic fog reveal. */
export function revealRadius(center: Axial, radius: number): Axial[] {
  return spiral(center, radius);
}

/**
 * Tactical line of sight: true if no tile strictly between a and b blocks.
 * Endpoints never block their own line.
 */
export function hasLos(a: Axial, b: Axial, blocks: (h: Axial) => boolean): boolean {
  const pts = line(a, b);
  for (let i = 1; i < pts.length - 1; i++) {
    if (blocks(pts[i]!)) return false;
  }
  return true;
}

/** Set of visible hex keys from origin within radius, respecting blockers. */
export function visibleSet(
  origin: Axial,
  radius: number,
  blocks: (h: Axial) => boolean,
): Set<HexKey> {
  const out = new Set<HexKey>();
  for (const h of spiral(origin, radius)) {
    if (hasLos(origin, h, blocks)) out.add(key(h));
  }
  return out;
}
