// The five things a fighter can do with their turn: move, and then one of
// Strike, Throw, Shove, Defend or Dash.

import { distance, key, neighbor, directionTo, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import type { Battle, Combatant, GameState, Person } from '../state/types';
import { activeCombatant, fighterPerson, BASE_MOVES } from './battle';
import { groundCost } from './battlefield';
import { hasShot, reachWithZoc } from './zoc';
import { effectiveStat } from './people';

export const THROW_RANGE = 3;
/** Raising a shield is worth this much to the roll needed to hit you. */
export const DEFEND_BONUS = 3;

function actionRng(state: GameState, label: string): Rng {
  const battle = state.battle!;
  return stream(state.seed, 'combat').derive(
    `${label}:${state.day}:${battle.round}:${battle.turnIndex}`,
  );
}

/** How hard this fighter is to land a blow on right now. */
export function evasion(state: GameState, target: Combatant): number {
  const person = fighterPerson(state, target.personId);
  const wits = person ? effectiveStat(person, 'wits') : 1;
  return 7 + wits + (target.defending ? DEFEND_BONUS : 0);
}

function drop(battle: Battle, target: Combatant, person: Person, cause: string): void {
  target.down = true;
  person.health = 0;
  if (target.side === 'foe') person.alive = false;
  battle.log.push(cause);
}

// --- Move ---

export function doMove(state: GameState, to: Hex): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return false;

  const reach = reachWithZoc(battle, active);
  const cost = reach.get(key(to));
  if (cost === undefined) return false;

  active.at = to;
  active.movesLeft -= cost;
  return true;
}

// --- Strike ---

export function doStrike(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || target.side === active.side) return false;
  if (distance(active.at, target.at) !== 1) return false;

  const attacker = fighterPerson(state, active.personId);
  const defender = fighterPerson(state, target.personId);
  if (!attacker || !defender) return false;

  active.hasActed = true;
  const rng = actionRng(state, `strike:${active.personId}`);
  const roll = rng.roll(2, 6) + effectiveStat(attacker, 'might');

  if (roll < evasion(state, target)) {
    battle.log.push(
      target.defending
        ? `${attacker.name} beat on ${defender.name}'s shield to no effect.`
        : `${attacker.name} swung at ${defender.name} and missed.`,
    );
    return true;
  }

  const damage = rng.roll(1, 6) + Math.floor(effectiveStat(attacker, 'might') / 2);
  defender.health = Math.max(0, defender.health - damage);
  if (defender.health > 0) {
    battle.log.push(`${attacker.name} struck ${defender.name} (${damage}).`);
  } else {
    drop(
      battle,
      target,
      defender,
      target.side === 'foe'
        ? `${attacker.name} put ${defender.name} down.`
        : `${defender.name} went down under ${attacker.name}.`,
    );
  }
  return true;
}

// --- Throw ---

export function canThrowAt(state: GameState, active: Combatant, target: Combatant): boolean {
  if (active.throwsLeft <= 0 || active.hasActed) return false;
  if (target.down || target.side === active.side) return false;
  const gap = distance(active.at, target.at);
  if (gap < 2 || gap > THROW_RANGE) return false;
  return hasShot(state.battle!, active.at, target.at);
}

/** Throw targets for whoever is acting — range 2 to 3, clear line only. */
export function throwTargets(state: GameState): Combatant[] {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return [];
  return battle.combatants.filter((c) => canThrowAt(state, active, c));
}

export function doThrow(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || !canThrowAt(state, active, target)) return false;

  const thrower = fighterPerson(state, active.personId);
  const defender = fighterPerson(state, target.personId);
  if (!thrower || !defender) return false;

  active.hasActed = true;
  active.throwsLeft -= 1;
  const rng = actionRng(state, `throw:${active.personId}`);
  // A thrown spear is aimed, not muscled: wits, not might.
  const roll = rng.roll(2, 6) + effectiveStat(thrower, 'wits');

  if (roll < evasion(state, target)) {
    battle.log.push(`${thrower.name}'s spear went wide of ${defender.name}.`);
    return true;
  }

  const damage = rng.roll(1, 6);
  defender.health = Math.max(0, defender.health - damage);
  if (defender.health > 0) {
    battle.log.push(`${thrower.name} put a spear into ${defender.name} (${damage}).`);
  } else {
    drop(battle, target, defender, `${thrower.name}'s throw dropped ${defender.name}.`);
  }
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
  if (!battle || !active || active.hasActed || battle.outcome) return false;

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

  if (attack <= resist) {
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
    if (shoved.health > 0) {
      battle.log.push(`${shover.name} slammed ${shoved.name} into what was behind them (2).`);
    } else {
      drop(battle, target, shoved, `${shoved.name} was crushed against the rocks.`);
    }
    return true;
  }

  if (tile.ground === 'water') {
    // The old trick: put them in the water and let it do the work.
    drop(battle, target, shoved, `${shover.name} put ${shoved.name} into the water.`);
    return true;
  }

  target.at = destination;
  target.defending = false;
  battle.log.push(`${shover.name} drove ${shoved.name} back a step.`);
  return true;
}

// --- Defend and Dash ---

export function doDefend(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome) return false;
  const person = fighterPerson(state, active.personId);
  active.hasActed = true;
  active.defending = true;
  active.movesLeft = 0;
  battle.log.push(`${person?.name ?? 'Someone'} set their shield.`);
  return true;
}

export function doDash(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome) return false;
  active.hasActed = true;
  active.movesLeft += BASE_MOVES;
  const person = fighterPerson(state, active.personId);
  battle.log.push(`${person?.name ?? 'Someone'} broke into a run.`);
  return true;
}

/** Ground cost helper re-exported for the renderer's preview. */
export { groundCost };
