// The shield wall.
//
// Standing shoulder to shoulder with your own is worth more than any single
// warrior's skill — and it is exactly as fragile as the weakest link in it.
// Drop one man and the wall around him opens.

import { distance, key } from '../hex';
import type { Battle, Combatant } from '../state/types';

/** A wall of one neighbour is worth this; two or more, the full amount. */
export const WALL_BONUS_ONE = 2;
export const WALL_BONUS_FULL = 3;

/** A shield adds only this much when you are already locked in a line. */
export const SHIELD_IN_WALL = 1;

/** A fighter astride the palisade is holding stakes, not a line. */
function onWall(battle: Battle, c: Combatant): boolean {
  return battle.grid[key(c.at)]?.ground === 'wall';
}

/** Can this fighter hold a place in a wall at all? */
export function canAnchor(c: Combatant): boolean {
  return !c.down && !c.fled && !c.broken;
}

/** The allies standing shoulder to shoulder with this fighter. */
export function wallLinks(battle: Battle, of: Combatant): Combatant[] {
  if (!canAnchor(of) || onWall(battle, of)) return [];
  return battle.combatants.filter(
    (c) =>
      c.personId !== of.personId &&
      c.side === of.side &&
      canAnchor(c) &&
      !onWall(battle, c) &&
      distance(c.at, of.at) === 1,
  );
}

/** How much harder the line makes this fighter to hit. */
export function wallBonus(battle: Battle, of: Combatant): number {
  const links = wallLinks(battle, of).length;
  if (links <= 0) return 0;
  return links === 1 ? WALL_BONUS_ONE : WALL_BONUS_FULL;
}

/**
 * Total defensive bonus. A raised shield is most of a lone fighter's
 * protection, but in a wall the shield IS the wall — it adds only a little
 * more. Without that, wall plus shield plus good wits stacks past anything
 * an attack roll can reach, and the fight stalls on untouchable men.
 *
 * `drill` is what the band has learned about holding a line (see data/lore).
 * It is added to the WALL rather than to the fighter, so it is worth nothing
 * to somebody standing on their own — which is the whole idea of drill.
 */
export function defenceBonus(
  battle: Battle,
  of: Combatant,
  defendBonus: number,
  drill = 0,
): number {
  const wall = wallBonus(battle, of);
  const held = wall > 0 ? wall + drill : 0;
  if (!of.defending) return held;
  return held > 0 ? held + SHIELD_IN_WALL : defendBonus;
}

/** Everyone on a side who is currently part of a wall of at least one link. */
export function walledFighters(battle: Battle, side: Combatant['side']): Combatant[] {
  return battle.combatants.filter((c) => c.side === side && wallBonus(battle, c) > 0);
}

/** Pairs of adjacent shoulder-mates, for the renderer to draw the line. */
export function wallPairs(battle: Battle): [Combatant, Combatant][] {
  const pairs: [Combatant, Combatant][] = [];
  const seen = new Set<string>();
  for (const c of battle.combatants) {
    if (!canAnchor(c)) continue;
    for (const link of wallLinks(battle, c)) {
      const id = [c.personId, link.personId].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      pairs.push([c, link]);
    }
  }
  return pairs;
}
