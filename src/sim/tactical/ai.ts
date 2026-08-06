// Enemy AI: ordered heuristics, deliberately simple and fully deterministic
// given the battle state and rng stream.
//
// Per enemy unit: 1) routing units are handled by fleeMoves, skip.
// 2) If adjacent to a player unit, strike the best target (flanked first,
//    then lowest effective def, then lowest hp).
// 3) Else move toward the nearest player unit — brave units close the whole
//    way; cowards stop 2 hexes out unless they outnumber locally.
// 4) After moving, strike if now adjacent; otherwise brace.

import { distance } from '../../core/hex';
import { findPath, reachable } from '../../core/path';
import { Rng } from '../../core/rng';
import { enemyById } from '../../content/enemies';
import { Battle, Unit } from '../types';
import { BattleLogLine, tryBrace, tryMove, tryStrike } from './actions';
import { attackProfile, isRouting, livingUnits, moveCost } from './combatMath';

function bestTarget(battle: Battle, unit: Unit): Unit | null {
  const adjacent = livingUnits(battle, 'player').filter((p) => distance(p.at, unit.at) === 1);
  if (adjacent.length === 0) return null;
  const scored = adjacent.map((t) => {
    const p = attackProfile(battle, unit, t);
    return { t, score: (p.flanked ? 100 : 0) - p.effDef * 10 - t.hp };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.t;
}

export function runEnemyTurn(battle: Battle, rng: Rng, log: BattleLogLine[]): void {
  const units = livingUnits(battle, 'enemy');
  for (const unit of units) {
    if (!unit.alive || unit.escaped || isRouting(unit)) continue;
    // Cowards keep their distance early, but grow bold once the raiders
    // linger — defending their homes, and denying stalemate tactics.
    const brave =
      unit.kind === 'crew' ? true : enemyById(unit.kind).brave || battle.round > 3;

    // Strike immediately if already adjacent.
    let target = bestTarget(battle, unit);
    if (target) {
      tryStrike(battle, unit, target, rng.fork(`strike:${unit.id}`), log);
      continue;
    }

    // Approach the nearest player unit.
    const players = livingUnits(battle, 'player').filter((p) => !isRouting(p));
    const anyPlayers = players.length > 0 ? players : livingUnits(battle, 'player');
    if (anyPlayers.length === 0) return;
    const nearest = [...anyPlayers].sort((a, b) => distance(a.at, unit.at) - distance(b.at, unit.at))[0]!;

    const wantDistance = brave ? 1 : 2;
    if (distance(unit.at, nearest.at) > wantDistance) {
      // Find the reachable hex that gets closest to the target.
      const options = reachable(unit.at, unit.movesLeft, (h) => moveCost(battle, h));
      let best: { q: number; r: number } | null = null;
      let bestScore = Infinity;
      for (const [k, cost] of options) {
        const c = k.indexOf(',');
        const h = { q: Number(k.slice(0, c)), r: Number(k.slice(c + 1)) };
        const d = distance(h, nearest.at);
        if (d < wantDistance) continue; // don't overshoot into bad spots
        const score = d * 10 + cost;
        if (score < bestScore) {
          bestScore = score;
          best = h;
        }
      }
      if (best && (best.q !== unit.at.q || best.r !== unit.at.r)) {
        // Verify path (reachable() already guarantees one, but tryMove revalidates).
        const ok = tryMove(battle, unit, best);
        if (!ok) {
          const step = findPath(unit.at, nearest.at, (h) => moveCost(battle, h), 2000);
          if (step.path.length > 1) tryMove(battle, unit, step.path[1]!);
        }
      }
    }

    // Strike if the approach brought us adjacent, else hold.
    target = bestTarget(battle, unit);
    if (target) {
      tryStrike(battle, unit, target, rng.fork(`strike2:${unit.id}`), log);
    } else {
      tryBrace(unit);
    }
  }
}
