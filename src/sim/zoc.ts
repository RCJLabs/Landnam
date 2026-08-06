// Zone of control and battlefield reach.
//
// Facing-free: a standing fighter threatens all six hexes around them. Two
// clauses do all the work, and between them they make a line something you
// have to break rather than stroll around:
//
//   1. Stepping INTO a threatened hex ends your movement there.
//   2. Stepping OUT of a threatened hex costs extra — you are disengaging
//      under someone's blows.
//
// Dash is the answer to both, which is what makes it worth an action.

import { distance, key, line, neighbors, type Hex, type HexKey } from '../hex';
import type { Battle, Combatant, Side } from '../state/types';
import { groundCost } from './battlefield';

/** Leaving a threatened hex costs this much on top of the ground. */
export const DISENGAGE_COST = 2;

export function standingEnemies(battle: Battle, side: Side): Combatant[] {
  return battle.combatants.filter((c) => !c.down && c.side !== side);
}

/** Is this hex threatened by anyone on the other side? */
export function isThreatened(battle: Battle, at: Hex, side: Side): boolean {
  return standingEnemies(battle, side).some((e) => distance(e.at, at) === 1);
}

/** How many enemies threaten this hex — used by the AI to judge a position. */
export function threatCount(battle: Battle, at: Hex, side: Side): number {
  return standingEnemies(battle, side).filter((e) => distance(e.at, at) === 1).length;
}

function occupied(battle: Battle, at: Hex): boolean {
  return battle.combatants.some((c) => !c.down && c.at.q === at.q && c.at.r === at.r);
}

function enterCost(battle: Battle, at: Hex): number {
  const tile = battle.grid[key(at)];
  if (!tile) return Infinity;
  if (occupied(battle, at)) return Infinity;
  return groundCost(tile.ground);
}

/**
 * Every hex this fighter can reach, mapped to what it costs to get there.
 * Honours both zone-of-control clauses.
 */
export function reachWithZoc(battle: Battle, mover: Combatant): Map<HexKey, number> {
  const budget = mover.movesLeft;
  const best = new Map<HexKey, number>();
  if (budget <= 0) return best;

  const startThreatened = isThreatened(battle, mover.at, mover.side);
  // Frontier entries carry whether we may keep going from that hex.
  const frontier: { at: Hex; cost: number; canContinue: boolean }[] = [
    { at: mover.at, cost: 0, canContinue: true },
  ];

  while (frontier.length > 0) {
    let pick = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i]!.cost < frontier[pick]!.cost) pick = i;
    }
    const current = frontier.splice(pick, 1)[0]!;
    if (!current.canContinue) continue;

    const leavingEngagement =
      current.cost === 0 ? startThreatened : isThreatened(battle, current.at, mover.side);

    for (const next of neighbors(current.at)) {
      const step = enterCost(battle, next);
      if (!Number.isFinite(step)) continue;
      const total = current.cost + step + (leavingEngagement ? DISENGAGE_COST : 0);
      if (total > budget) continue;

      const k = key(next);
      const known = best.get(k);
      if (known !== undefined && known <= total) continue;
      best.set(k, total);
      // Entering a threatened hex stops you: you are in the fight now.
      frontier.push({
        at: next,
        cost: total,
        canContinue: !isThreatened(battle, next, mover.side),
      });
    }
  }

  best.delete(key(mover.at));
  return best;
}

/** Line of sight for throws: blocked ground stops a thrown weapon. */
export function hasShot(battle: Battle, from: Hex, to: Hex): boolean {
  const path = line(from, to);
  for (let i = 1; i < path.length - 1; i++) {
    const tile = battle.grid[key(path[i]!)];
    if (!tile) return false;
    if (tile.ground === 'block') return false;
    // A fighter in the way soaks the throw.
    if (occupied(battle, path[i]!)) return false;
  }
  return true;
}
