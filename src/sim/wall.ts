// The shield wall.
//
// Standing shoulder to shoulder with your own is worth more than any single
// warrior's skill — and it is exactly as fragile as the weakest link in it.
// Drop one man and the wall around him opens.

import type { Battle, Combatant } from '../state/types';

/** A wall of one neighbour is worth this; two or more, the full amount. */
export const WALL_BONUS_ONE = 2;
export const WALL_BONUS_FULL = 3;

/** A shield adds only this much when you are already locked in a line. */
export const SHIELD_IN_WALL = 1;

/**
 * Is this fight being fought across a palisade?
 *
 * Derived from the field rather than stored, so nothing about the save
 * changes: 'wall' ground exists only on a raid map, and only when the
 * steading's stakes were actually standing when the band came (see
 * `steadingFieldFrom`).
 */
export function atThePalisade(battle: Battle): boolean {
  for (const tile of battle.grid) {
    if (tile.ground === 'wall') return true;
  }
  return false;
}

/**
 * A fighter astride the palisade is holding stakes, not a line.
 *
 * This used to be whoever happened to be standing on a wall hex, which since
 * 8.1c is nobody: there is no ground to stand on and `Combatant.at` is frozen
 * where the fighter deployed. That silently deleted the whole mechanic — a
 * walled steading and an open one came out of ten raids with byte-identical
 * tallies, which is the palisade costing eight timber for nothing.
 *
 * The line spelling of "it does not stop them, it makes them climb where you
 * are waiting" is that the men climbing ARE the raiders' front rank. They
 * have one hand on the wood, so they hold no line with each other, and
 * `evasion` makes them easier to hit for the same reason.
 */
function onWall(battle: Battle, c: Combatant): boolean {
  return c.side === 'foe' && c.rank === 1 && atThePalisade(battle);
}

/** Can this fighter hold a place in a wall at all? */
export function canAnchor(c: Combatant): boolean {
  return !c.down && !c.fled && !c.broken;
}

/**
 * The allies standing shoulder to shoulder with this fighter.
 *
 * Adjacent RANKS, since 8.1c: the man in front of you and the man behind. On
 * the hex field this asked for `distance === 1`, which on an open plane meant
 * a wall was something the player had to build and keep rebuilding as people
 * moved. In a line it is the default state of the world, and what costs you
 * is having it broken.
 */
export function wallLinks(battle: Battle, of: Combatant): Combatant[] {
  if (!canAnchor(of) || onWall(battle, of)) return [];
  return battle.combatants.filter(
    (c) =>
      c.personId !== of.personId &&
      c.side === of.side &&
      canAnchor(c) &&
      !onWall(battle, c) &&
      Math.abs(c.rank - of.rank) === 1,
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
