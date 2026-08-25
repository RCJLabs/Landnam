// The fighter's legs and stance: step, run, set the shield, and drive a man
// back a pace. Nothing here rolls to wound — a shove can kill, but only by
// where it puts you.

import type { Battle, Combatant, GameState } from '../state/types';
import { activeCombatant, fighterPerson } from './battle';
import { beat } from './beats';
import { canActFrom, canLandOn, shift, shoveBack } from './ranks';
import { effectiveStat } from './people';
import { actionRng, drop } from './swing';

// --- Shove ---

/**
 * Who would come forward if this one were driven back, or undefined when he
 * is the last of his line and has nowhere to go.
 *
 * On the hex field this answered with a HEX — the square behind them, which
 * might be water, or rock, or another man. On a line the interesting answer
 * is not where the shoved man lands but WHO ends up in front instead, which
 * is the whole reason to spend an action on it.
 */
export function shoveDestination(battle: Battle, target: Combatant): Combatant | undefined {
  return battle.combatants.find(
    (c) => c.side === target.side && !c.down && !c.fled && c.rank === target.rank + 1,
  );
}

export function doShove(state: GameState, targetPersonId: string): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;

  const target = battle.combatants.find((c) => c.personId === targetPersonId && !c.down);
  if (!target || target.side === active.side) return false;
  if (!canActFrom('shove', active.rank)) return false;
  if (!canLandOn('shove', target.rank)) return false;

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

  // Back a rank, swapping with whoever was behind him. The man who comes
  // forward is the point of the whole verb: shove the huscarl off the front
  // and his spearman is suddenly holding the line with the wrong weapon.
  const came = shoveBack(battle.combatants, target);

  if (!came) {
    // Nowhere to go: he was the last rank, and is driven against his own.
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
      battle.log.push(`${shover.name} drove ${shoved.name} back into his own men (2).`);
    } else {
      drop(state, target, shoved, `${shoved.name} was crushed against his own line.`, active);
    }
    return true;
  }

  target.defending = false;
  beat(battle, {
    kind: 'shoved',
    who: active.personId,
    target: target.personId,
    result: 'pushed',
    from: stood,
    to: target.at,
  });
  const forward = fighterPerson(state, came.personId);
  battle.log.push(
    `${shover.name} drove ${shoved.name} back a rank`
      + (forward ? `, and ${forward.name} was in front.` : '.'),
  );
  return true;
}

// --- Defend and Dash ---

export function doDefend(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
  // The table says only the front two have anything to set a shield against,
  // and until this line it said so to nobody: `doDefend` never asked, so a
  // man in the third rank could raise his shield and collect DEFEND_BONUS
  // against spears and thrown axes for an action he had no other use for.
  // That is the back rank being strictly safer for free, which is the
  // opposite of what depth is supposed to cost.
  if (!canActFrom('defend', active.rank)) return false;
  const person = fighterPerson(state, active.personId);
  active.hasActed = true;
  active.defending = true;
  active.movesLeft = 0;
  beat(battle, { kind: 'defended', who: active.personId });
  battle.log.push(`${person?.name ?? 'Someone'} set their shield.`);
  return true;
}

/**
 * Change rank.
 *
 * Dash was a second helping of movement across open ground, and there is no
 * open ground any more. It survives the conversion by becoming the answer to
 * being put somewhere your weapon is no use: the spearman shoved to the front
 * buys his way back, and the thrower out of hand-axes walks up into the wall.
 * That is worth an action in a way that running never quite was.
 */
export function doDash(state: GameState, by: -1 | 1 = -1): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome || active.broken) return false;
  if (!canActFrom('dash', active.rank)) return false;
  const swapped = shift(battle.combatants, active, by);
  if (!swapped) return false;
  active.hasActed = true;
  active.defending = false;
  const person = fighterPerson(state, active.personId);
  beat(battle, { kind: 'dashed', who: active.personId });
  battle.log.push(
    `${person?.name ?? 'Someone'} ${by < 0 ? 'pushed up into the line' : 'gave ground'}.`,
  );
  return true;
}
