// Combat math: shield-wall, flanking, to-hit. All integers, tuned here
// rather than balance.ts because the numbers ARE the tactical design.

import { key, neighbors, eq } from '../../core/hex';
import { Battle, Unit } from '../types';

export const TO_HIT_TARGET = 7; // 2d6 + atk - effDef >= 7 hits

export function unitAt(battle: Battle, h: { q: number; r: number }): Unit | undefined {
  return battle.units.find((u) => u.alive && !u.escaped && eq(u.at, h));
}

export function livingUnits(battle: Battle, side: 'player' | 'enemy'): Unit[] {
  return battle.units.filter((u) => u.side === side && u.alive && !u.escaped);
}

export function isRouting(u: Unit): boolean {
  return u.statuses.includes('routing');
}

/** Adjacent allies who are neither routing nor dead (shield-wall partners). */
export function wallPartners(battle: Battle, u: Unit): Unit[] {
  return neighbors(u.at)
    .map((h) => unitAt(battle, h))
    .filter((n): n is Unit => n !== undefined && n.side === u.side && !isRouting(n));
}

/** Shield-wall: +1 def per adjacent steady ally, max +2. Routing units get none. */
export function wallBonus(battle: Battle, u: Unit): number {
  if (isRouting(u)) return 0;
  return Math.min(2, wallPartners(battle, u).length);
}

/**
 * Flanking: attacker ignores the defender's shield-wall bonus and gains +1 atk
 * when an allied unit stands adjacent to the defender roughly opposite the
 * attacker (pincer). "Opposite" = the ally is adjacent to the defender and not
 * adjacent to the attacker.
 */
export function isFlanking(battle: Battle, attacker: Unit, defender: Unit): boolean {
  const attackerAdj = new Set(neighbors(attacker.at).map(key));
  return neighbors(defender.at).some((h) => {
    const ally = unitAt(battle, h);
    return (
      ally !== undefined &&
      ally.side === attacker.side &&
      ally.id !== attacker.id &&
      !isRouting(ally) &&
      !attackerAdj.has(key(ally.at))
    );
  });
}

export interface AttackProfile {
  atk: number;
  effDef: number;
  flanked: boolean;
  hitChance: number;
}

export function attackProfile(battle: Battle, attacker: Unit, defender: Unit): AttackProfile {
  const flanked = isFlanking(battle, attacker, defender);
  const tile = battle.grid[key(defender.at)];
  const braced = defender.statuses.includes('braced') ? 2 : 0;
  const wall = flanked ? 0 : wallBonus(battle, defender);
  const atk = attacker.atk + (flanked ? 1 : 0);
  const effDef = defender.def + wall + braced + (tile?.cover ?? 0);
  const need = TO_HIT_TARGET - atk + effDef;
  let ways = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= need) ways++;
  return { atk, effDef, flanked, hitChance: ways / 36 };
}

/** Can this unit stand on that tile? */
export function passable(battle: Battle, h: { q: number; r: number }): boolean {
  const tile = battle.grid[key(h)];
  if (!tile) return false;
  return tile.terrain !== 'water' && tile.terrain !== 'wall' && tile.terrain !== 'rock';
}

/** Movement cost to enter, Infinity if blocked (occupied or impassable). */
export function moveCost(battle: Battle, h: { q: number; r: number }): number {
  if (!passable(battle, h)) return Infinity;
  if (unitAt(battle, h)) return Infinity;
  return 1;
}
