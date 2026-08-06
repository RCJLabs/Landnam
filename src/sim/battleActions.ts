// The five things a fighter can do with their turn: move, and then one of
// Strike, Throw, Shove, Defend or Dash.

import { distance, key, neighbor, directionTo, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import type { Combatant, GameState, Person } from '../state/types';
import { activeCombatant, fighterPerson, BASE_MOVES } from './battle';
import { groundCost } from './battlefield';
import { hasShot, reachWithZoc, threatCount } from './zoc';
import { defenceBonus } from './wall';
import { NERVE_HIT, shakeNerve, witnessFall } from './morale';
import { effectiveStat } from './people';

export const THROW_RANGE = 3;
/** Raising a shield is worth this much to the roll needed to hit you. */
export const DEFEND_BONUS = 3;

/**
 * Being on top of a palisade. You have one hand on the stakes and no footing
 * worth the name, and this is the entire reason the thing is worth building:
 * it does not stop them, it makes them climb where you are waiting.
 */
export const WALL_EXPOSED = 3;

function actionRng(state: GameState, label: string): Rng {
  const battle = state.battle!;
  return stream(state.seed, 'combat').derive(
    `${label}:${state.day}:${battle.round}:${battle.turnIndex}`,
  );
}

/**
 * Each enemy past the first on you is worth this much to all of their blows.
 * It has to bite: it is the whole reason a warrior who runs in alone dies,
 * and a warrior with mates at both shoulders does not.
 */
export const OUTNUMBERED_PENALTY = 2;
export const MAX_OUTNUMBERED = 2;

/**
 * How hard this fighter is to land a blow on right now.
 *
 * The wall protects you and being surrounded exposes you, and between them
 * they are why a line beats a charge: shoulder-mates cover the sides that
 * would otherwise be open, and the man who runs in alone ends up with three
 * of them on him and nothing at his back.
 */
export function evasion(state: GameState, target: Combatant): number {
  const person = fighterPerson(state, target.personId);
  const wits = person ? effectiveStat(person, 'wits') : 1;
  const battle = state.battle;
  if (!battle) return 7 + wits;

  const shelter = target.broken ? 0 : defenceBonus(battle, target, DEFEND_BONUS);
  const surrounded = Math.min(
    MAX_OUTNUMBERED,
    Math.max(0, threatCount(battle, target.at, target.side) - 1),
  );
  const onTheStakes = battle.grid[key(target.at)]?.ground === 'wall' ? WALL_EXPOSED : 0;
  return 7 + wits + shelter - surrounded * OUTNUMBERED_PENALTY - onTheStakes;
}

function drop(
  state: GameState,
  target: Combatant,
  person: Person,
  cause: string,
  killer?: Combatant,
): void {
  const battle = state.battle!;
  if (killer && killer.side !== target.side) killer.kills += 1;
  // Nerve has to be shaken while the fallen fighter is still counted as a
  // link, or nobody registers that the wall just opened.
  witnessFall(state, target);
  target.down = true;
  target.defending = false;
  person.health = 0;
  if (target.side === 'foe') person.alive = false;
  battle.log.push(cause);
}

// --- Move ---

export function doMove(state: GameState, to: Hex): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome || active.broken) return false;

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
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;

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
    shakeNerve(state, target, NERVE_HIT);
  } else {
    drop(
      state,
      target,
      defender,
      target.side === 'foe'
        ? `${attacker.name} put ${defender.name} down.`
        : `${defender.name} went down under ${attacker.name}.`,
      active,
    );
  }
  return true;
}

// --- Throw ---

export function canThrowAt(state: GameState, active: Combatant, target: Combatant): boolean {
  if (active.throwsLeft <= 0 || active.hasActed || active.broken) return false;
  if (target.down || target.fled || target.side === active.side) return false;
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
  if (active.broken) return false;

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
    shakeNerve(state, target, NERVE_HIT);
  } else {
    drop(state, target, defender, `${thrower.name}'s throw dropped ${defender.name}.`, active);
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
      drop(state, target, shoved, `${shoved.name} was crushed against the rocks.`, active);
    }
    return true;
  }

  if (tile.ground === 'water') {
    // The old trick: put them in the water and let it do the work.
    drop(state, target, shoved, `${shover.name} put ${shoved.name} into the water.`, active);
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
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
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
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
  active.hasActed = true;
  active.movesLeft += BASE_MOVES;
  const person = fighterPerson(state, active.personId);
  battle.log.push(`${person?.name ?? 'Someone'} broke into a run.`);
  return true;
}

/** Ground cost helper re-exported for the renderer's preview. */
export { groundCost };
