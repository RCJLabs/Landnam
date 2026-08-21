// The fighter's legs and stance: step, run, set the shield, and drive a man
// back a pace. Nothing here rolls to wound — a shove can kill, but only by
// where it puts you.

import { directionTo, key, neighbor, distance, type Hex } from '../hex';
import type { GameState, Combatant } from '../state/types';
import { activeCombatant, fighterPerson, BASE_MOVES } from './battle';
import { beat } from './beats';
import { reachWithZoc } from './zoc';
import { effectiveStat } from './people';
import { actionRng, drop } from './swing';

// --- Move ---

export function doMove(state: GameState, to: Hex): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome || active.broken) return false;

  const reach = reachWithZoc(battle, active);
  const cost = reach.get(key(to));
  if (cost === undefined) return false;

  const from = active.at;
  active.at = to;
  active.movesLeft -= cost;
  beat(battle, { kind: 'moved', who: active.personId, from, to, cost });
  return true;
}

// --- Shove ---

/** Where a shove would send them: straight back, away from the shover. */
export function shoveDestination(active: Combatant, target: Combatant): Hex | null {
  const dir = directionTo(active.at, target.at);
  return dir < 0 ? null : neighbor(target.at, dir);
}

export function doShove(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || target.side === active.side) return false;
  if (distance(active.at, target.at) !== 1) return false;

  const shover = fighterPerson(state, active.personId);
  const shoved = fighterPerson(state, target.personId);
  if (!shover || !shoved) return false;

  active.hasActed = true;
  const rng = actionRng(state, `shove:${active.personId}`);
  const attack = rng.roll(2, 6) + effectiveStat(shover, 'might');
  const resist =
    rng.roll(2, 6) + effectiveStat(shoved, 'might') + (target.defending ? 2 : 0);

  const stood = target.at;
  if (attack <= resist) {
    beat(battle, {
      kind: 'shoved',
      who: active.personId,
      target: target.personId,
      result: 'held',
      from: stood,
    });
    battle.log.push(`${shoved.name} did not give ground to ${shover.name}.`);
    return true;
  }

  const destination = shoveDestination(active, target);
  const tile = destination ? battle.grid[key(destination)] : undefined;
  const blocked =
    !destination ||
    !tile ||
    battle.combatants.some((c) => !c.down && c.at.q === destination.q && c.at.r === destination.r);

  if (blocked) {
    // Nowhere to go: they are driven against whatever is behind them.
    shoved.health = Math.max(0, shoved.health - 2);
    beat(battle, {
      kind: 'shoved',
      who: active.personId,
      target: target.personId,
      result: 'crushed',
      from: stood,
      damage: 2,
    });
    if (shoved.health > 0) {
      battle.log.push(`${shover.name} slammed ${shoved.name} into what was behind them (2).`);
    } else {
      drop(state, target, shoved, `${shoved.name} was crushed against the rocks.`, active);
    }
    return true;
  }

  if (tile.ground === 'water') {
    // The old trick: put them in the water and let it do the work.
    beat(battle, {
      kind: 'shoved',
      who: active.personId,
      target: target.personId,
      result: 'drowned',
      from: stood,
      to: destination,
    });
    drop(state, target, shoved, `${shover.name} put ${shoved.name} into the water.`, active);
    return true;
  }

  target.at = destination;
  target.defending = false;
  beat(battle, {
    kind: 'shoved',
    who: active.personId,
    target: target.personId,
    result: 'pushed',
    from: stood,
    to: destination,
  });
  battle.log.push(`${shover.name} drove ${shoved.name} back a step.`);
  return true;
}

// --- Defend and Dash ---

export function doDefend(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
  const person = fighterPerson(state, active.personId);
  active.hasActed = true;
  active.defending = true;
  active.movesLeft = 0;
  beat(battle, { kind: 'defended', who: active.personId });
  battle.log.push(`${person?.name ?? 'Someone'} set their shield.`);
  return true;
}

export function doDash(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
  active.hasActed = true;
  active.movesLeft += BASE_MOVES;
  const person = fighterPerson(state, active.personId);
  beat(battle, { kind: 'dashed', who: active.personId });
  battle.log.push(`${person?.name ?? 'Someone'} broke into a run.`);
  return true;
}
