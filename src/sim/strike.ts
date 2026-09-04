// The three ways iron reaches a man: the swing at arm's length, the thrust
// past a shield-brother's shoulder, and the thrown spear. All three roll
// against the same `evasion` and all three end in the same `drop`.

import type { Combatant, GameState } from '../state/types';
import { activeCombatant, fighterPerson } from './battle';
import { beat, type BlowBeat, type BlowResult } from './beats';
import { canActFrom, canLandOn, screen } from './ranks';
import { canAnchor, wallLinks } from './wall';
import { bonus } from './lore';
import { NERVE_HIT, shakeNerve } from './morale';
import { effectiveStat } from './people';
import { actionRng, carrying, drop, edge, evasion, wallPush } from './swing';

export const THROW_RANGE = 3;

/**
 * What the band's iron-craft adds to a blow. Deliberately one-sided: the lore
 * is something THIS band worked out, and the raiders coming over the ridge
 * did not sit in on it.
 */
function ourBite(state: GameState, attacker: Combatant): number {
  return attacker.side === 'warband' ? bonus(state, 'bite') : 0;
}

/**
 * The blow as data, for the beat stream.
 *
 * This replaced a `lastBlow` slot on the Battle that held exactly one blow
 * for the renderer to flash. One slot could not survive a foe's turn — four
 * swings landed and the view saw the fourth — and it had no vocabulary for
 * HOW a swing finished. A beat says which of the four ways it went, and the
 * stream keeps all of them.
 */
function blow(
  kind: BlowBeat['kind'],
  attacker: Combatant,
  target: Combatant,
  result: BlowResult,
  damage: number,
  screen?: Combatant,
): Omit<BlowBeat, 'n' | 'round'> {
  return {
    kind,
    who: attacker.personId,
    target: target.personId,
    result,
    damage,
    ...(screen ? { screen: screen.personId } : {}),
  };
}

// --- Strike ---

export function doStrike(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || target.side === active.side) return false;
  if (!canActFrom('strike', active.rank)) return false;
  if (!canLandOn('strike', target.rank)) return false;

  const attacker = fighterPerson(state, active.personId);
  const defender = fighterPerson(state, target.personId);
  if (!attacker || !defender) return false;

  active.hasActed = true;
  const rng = actionRng(state, `strike:${active.personId}`);
  const roll =
    rng.roll(2, 6) + effectiveStat(attacker, 'might') + wallPush(state, active) + edge(state, active);

  if (roll < evasion(state, target)) {
    // A swing that fails to land still lands SOMEWHERE: a glancing blow
    // chips one, cannot kill, and keeps a whiffed turn from being a dead
    // one. The old clean miss made half of every fight feel like waiting.
    //
    // Unless the target stands in a FULL wall. Overlapping shields are what
    // a line is for, and without this the chip bled the wall's survival
    // edge to nothing: sixty measured fights went from formation up ~15
    // bodies to a dead heat. The full wall turns glances; a lone fighter
    // or a single link still takes the wear.
    if (wallLinks(battle, target).length >= 2) {
      beat(battle, blow('struck', active, target, 'turned', 0));
      battle.log.push(
        `${defender.name}'s shield-brothers turned ${attacker.name}'s blow aside.` +
          carrying(attacker),
      );
      return true;
    }
    defender.health = Math.max(1, defender.health - 1);
    beat(battle, blow('struck', active, target, 'glance', 1));
    battle.log.push(
      (target.defending
        ? `${attacker.name} hammered ${defender.name}'s shield until the rim split (1).`
        : `${attacker.name}'s blow glanced off ${defender.name} (1).`) + carrying(attacker),
    );
    return true;
  }

  const damage =
    rng.roll(1, 6) + Math.floor(effectiveStat(attacker, 'might') / 2) + ourBite(state, active);
  defender.health = Math.max(0, defender.health - damage);
  beat(battle, blow('struck', active, target, 'hit', damage));
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

// --- The spear thrust: the second rank ---

/**
 * What reaching past a shield-brother costs you, and what it saves.
 *
 * The shield wall had an inside and an outside in name only: a line six
 * wide on a seven-wide field always has somebody stood behind somebody,
 * and until this those men could do nothing at all but wait for a gap. A
 * spear is the answer the period actually used — you thrust past the man
 * in front, over his shoulder, and you are never the one being hit.
 *
 * The cost is honesty about what a reach is: harder to land, lighter when
 * it lands, and a miss that does nothing at all where a proper swing would
 * at least have chipped a shield.
 */
export const REACH_RANGE = 2;
export const REACH_PENALTY = 1;
export const REACH_DAMAGE_OFF = 1;

/**
 * The shield-brother a thrust would go past: one of ours, standing, next to
 * BOTH the thruster and the target. No man in front, no thrust — that is the
 * whole rule, and it is what makes the back rank a position rather than a
 * queue.
 */
export function screenFor(
  state: GameState,
  active: Combatant,
): Combatant | undefined {
  const battle = state.battle;
  if (!battle) return undefined;
  // The old rule asked for a mate adjacent to BOTH the thruster and the
  // target, which was a hex spelling of "somebody is in front of you". On a
  // line that is the man at rank - 1, and he has to be able to hold a place.
  const ahead = screen(battle.combatants, active);
  return ahead && canAnchor(ahead) ? ahead : undefined;
}

export function canReachAt(state: GameState, active: Combatant, target: Combatant): boolean {
  if (active.hasActed || active.broken) return false;
  if (target.down || target.fled || target.side === active.side) return false;
  if (!canActFrom('reach', active.rank)) return false;
  if (!canLandOn('reach', target.rank)) return false;
  return screenFor(state, active) !== undefined;
}

/** Foes the active fighter could put a spear into over a mate's shoulder. */
export function reachTargets(state: GameState): Combatant[] {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return [];
  return battle.combatants.filter((c) => canReachAt(state, active, c));
}

export function doReach(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || !canReachAt(state, active, target)) return false;

  const attacker = fighterPerson(state, active.personId);
  const defender = fighterPerson(state, target.personId);
  const screen = screenFor(state, active);
  if (!attacker || !defender || !screen) return false;
  const front = fighterPerson(state, screen.personId);

  active.hasActed = true;
  const rng = actionRng(state, `reach:${active.personId}`);
  const roll =
    rng.roll(2, 6) + effectiveStat(attacker, 'might') + wallPush(state, active) - REACH_PENALTY;

  if (roll < evasion(state, target)) {
    // Overreached. A thrust that misses does NOT chip the way a swing does:
    // the trade for standing where nothing can hit you is that half of it
    // comes to nothing.
    beat(battle, blow('reached', active, target, 'miss', 0, screen));
    battle.log.push(`${attacker.name} thrust past ${front?.name ?? 'the line'} and found nothing.`);
    return true;
  }

  const damage = Math.max(
    1,
    rng.roll(1, 6) +
      Math.floor(effectiveStat(attacker, 'might') / 2) +
      ourBite(state, active) -
      REACH_DAMAGE_OFF,
  );
  defender.health = Math.max(0, defender.health - damage);
  beat(battle, blow('reached', active, target, 'hit', damage, screen));
  if (defender.health > 0) {
    battle.log.push(
      `${attacker.name}'s spear came over ${front?.name ?? 'the line'} and into ${defender.name} (${damage}).`,
    );
    shakeNerve(state, target, NERVE_HIT);
  } else {
    drop(
      state,
      target,
      defender,
      target.side === 'foe'
        ? `${attacker.name} put ${defender.name} down over the shoulder of the line.`
        : `${defender.name} went down to a spear out of the second rank.`,
      active,
    );
  }
  return true;
}

// --- Throw ---

export function canThrowAt(_state: GameState, active: Combatant, target: Combatant): boolean {
  if (active.throwsLeft <= 0 || active.hasActed || active.broken) return false;
  if (target.down || target.fled || target.side === active.side) return false;
  if (!canActFrom('throw', active.rank)) return false;
  return canLandOn('throw', target.rank);
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
    beat(battle, blow('threw', active, target, 'miss', 0));
    battle.log.push(`${thrower.name}'s spear went wide of ${defender.name}.`);
    return true;
  }

  const damage = rng.roll(1, 6) + ourBite(state, active);
  defender.health = Math.max(0, defender.health - damage);
  beat(battle, blow('threw', active, target, 'hit', damage));
  if (defender.health > 0) {
    battle.log.push(`${thrower.name} put a spear into ${defender.name} (${damage}).`);
    shakeNerve(state, target, NERVE_HIT);
  } else {
    drop(state, target, defender, `${thrower.name}'s throw dropped ${defender.name}.`, active);
  }
  return true;
}
