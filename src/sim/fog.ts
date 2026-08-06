// Fog of war. Three states: never seen, seen once (remembered, drawn dim),
// and visible right now. Line of sight is blocked by forest and high ground,
// so climbing a hill is genuinely worth a turn.

import { key, line, range, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { World } from '../state/types';

/** High ground lets you see over the trees. */
export function onHighGround(world: World, at: Hex): boolean {
  const terrain = world.tiles[key(at)]?.terrain;
  return terrain === 'hills' || terrain === 'mountains';
}

export function sightRadius(world: World, at: Hex, seasonSight: number): number {
  return seasonSight + (onHighGround(world, at) ? 1 : 0);
}

/**
 * True if `target` can be seen from `origin`. Intermediate blocking hexes
 * hide what lies beyond; from high ground only mountains block.
 */
export function hasLineOfSight(world: World, origin: Hex, target: Hex): boolean {
  const elevated = onHighGround(world, origin);
  const path = line(origin, target);
  for (let i = 1; i < path.length - 1; i++) {
    const terrain = world.tiles[key(path[i]!)]?.terrain;
    if (!terrain) continue;
    if (!terrainDef(terrain).blocksSight) continue;
    if (elevated && terrain !== 'mountains') continue;
    return false;
  }
  return true;
}

/**
 * Recomputes visibility around the party. Mutates `world.seen`, demoting
 * everything currently visible to remembered first.
 */
export function revealAround(world: World, at: Hex, radius: number): void {
  for (const [k, state] of Object.entries(world.seen)) {
    if (state === 'visible') world.seen[k] = 'seen';
  }
  for (const h of range(at, radius)) {
    const k = key(h);
    if (!world.tiles[k]) continue;
    if (hasLineOfSight(world, at, h)) world.seen[k] = 'visible';
  }
  world.seen[key(at)] = 'visible';
}

export function visibilityAt(world: World, h: Hex): 'unseen' | 'seen' | 'visible' {
  return world.seen[key(h)] ?? 'unseen';
}

/** How much of the map has been laid eyes on, 0..1 — used in the run summary. */
export function exploredFraction(world: World): number {
  const total = Object.keys(world.tiles).length;
  if (total === 0) return 0;
  return Object.keys(world.seen).length / total;
}
