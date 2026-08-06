// Tactical action resolution: move, strike, brace. Pure helpers that
// mutate a Battle in place; the strategic reducer owns cloning.

import { Axial, distance } from '../../core/hex';
import { findPath } from '../../core/path';
import { Rng } from '../../core/rng';
import { Battle, Unit } from '../types';
import { attackProfile, isRouting, moveCost, TO_HIT_TARGET, unitAt } from './combatMath';

export interface BattleLogLine {
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export function unitById(battle: Battle, id: string): Unit | undefined {
  return battle.units.find((u) => u.id === id);
}

export function canAct(u: Unit): boolean {
  return u.alive && !u.escaped && !u.hasActed && !isRouting(u);
}

/** Legal move: within movesLeft via passable unoccupied path. */
export function tryMove(battle: Battle, unit: Unit, to: Axial): boolean {
  if (isRouting(unit) || unit.movesLeft <= 0) return false;
  const { path, cost } = findPath(unit.at, to, (h) => moveCost(battle, h), 2000);
  if (path.length === 0 || cost > unit.movesLeft) return false;
  unit.at = to;
  unit.movesLeft -= cost;
  return true;
}

export function tryStrike(
  battle: Battle,
  attacker: Unit,
  defender: Unit,
  rng: Rng,
  log: BattleLogLine[],
): boolean {
  if (attacker.hasActed || isRouting(attacker)) return false;
  if (attacker.side === defender.side || !defender.alive || defender.escaped) return false;
  if (distance(attacker.at, defender.at) !== 1) return false;

  const profile = attackProfile(battle, attacker, defender);
  const roll = rng.roll(2, 6);
  const hit = roll + profile.atk - profile.effDef >= TO_HIT_TARGET;
  attacker.hasActed = true;
  attacker.statuses = attacker.statuses.filter((s) => s !== 'braced');

  const flankNote = profile.flanked ? ' from the flank' : '';
  if (hit) {
    defender.hp -= attacker.damage;
    const playerHit = attacker.side === 'player';
    if (defender.hp <= 0) {
      defender.hp = 0;
      defender.alive = false;
      battle.sideMorale[defender.side] -= 3;
      log.push({
        text: `${attacker.name} strikes${flankNote} — ${defender.name} falls!`,
        tone: playerHit ? 'good' : 'bad',
      });
    } else {
      if (profile.flanked) battle.sideMorale[defender.side] -= 1;
      log.push({
        text: `${attacker.name} hits ${defender.name}${flankNote} (${attacker.damage} dmg).`,
        tone: playerHit ? 'good' : 'bad',
      });
    }
  } else {
    log.push({
      text: `${attacker.name} swings at ${defender.name}${flankNote} — turned aside.`,
      tone: 'info',
    });
  }
  return true;
}

export function tryBrace(unit: Unit): boolean {
  if (unit.hasActed || isRouting(unit)) return false;
  unit.hasActed = true;
  if (!unit.statuses.includes('braced')) unit.statuses.push('braced');
  return true;
}

/** Start-of-side upkeep: reset action economy for that side's units. */
export function refreshSide(battle: Battle, side: 'player' | 'enemy'): void {
  for (const u of battle.units) {
    if (u.side !== side) continue;
    u.movesLeft = u.move;
    u.hasActed = false;
    u.statuses = u.statuses.filter((s) => s !== 'braced');
  }
}

/** Rout tests at the start of a side's turn when its morale pool is low. */
export function routChecks(
  battle: Battle,
  side: 'player' | 'enemy',
  rng: Rng,
  log: BattleLogLine[],
): void {
  const living = battle.units.filter((u) => u.side === side && u.alive && !u.escaped);
  const threshold = living.length * 2;
  if (battle.sideMorale[side] >= threshold) return;
  for (const u of living) {
    if (isRouting(u)) continue;
    if (rng.roll(2, 6) + u.guts < 8) {
      u.statuses.push('routing');
      log.push({
        text: `${u.name} breaks and runs!`,
        tone: side === 'player' ? 'bad' : 'good',
      });
    }
  }
}

/** Routing units flee toward their map edge; remove them once they reach it. */
export function fleeMoves(battle: Battle, side: 'player' | 'enemy', log: BattleLogLine[]): void {
  // Player flees west (toward the ship, col 0); enemies flee east.
  for (const u of battle.units) {
    if (u.side !== side || !u.alive || u.escaped || !isRouting(u)) continue;
    let steps = u.move;
    while (steps-- > 0) {
      const col = u.at.q + ((u.at.r - (u.at.r & 1)) >> 1);
      const targetCol = side === 'player' ? col - 1 : col + 1;
      if (targetCol < 0 || targetCol >= battle.width) {
        u.escaped = true;
        log.push({
          text: side === 'player' ? `${u.name} reaches the ship.` : `${u.name} escapes inland.`,
          tone: 'info',
        });
        break;
      }
      // Try the three hexes in the flee direction, nearest-row first.
      const candidates = (side === 'player' ? [3, 2, 4] : [0, 1, 5])
        .map((d) => ({ d, h: { q: u.at.q, r: u.at.r } }))
        .map(({ d }) => {
          const dirs = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
          ];
          return { q: u.at.q + dirs[d]!.q, r: u.at.r + dirs[d]!.r };
        });
      const open = candidates.find((h) => moveCost(battle, h) !== Infinity);
      if (!open) break;
      u.at = open;
    }
  }
}

/** Battle end detection. */
export function battleOutcome(battle: Battle): 'won' | 'lost' | null {
  const players = battle.units.filter((u) => u.side === 'player' && u.alive && !u.escaped);
  const enemies = battle.units.filter((u) => u.side === 'enemy' && u.alive && !u.escaped);
  if (enemies.length === 0) return 'won';
  if (players.length === 0) return 'lost';
  return null;
}

// Re-export for consumers that only import actions.
export { unitAt };
