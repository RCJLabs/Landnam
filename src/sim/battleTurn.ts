// Battle turns: the two actions 2.1 needs, whose turn it is, the foe's own
// decisions, and handing the field back to travel when it is settled.

import { distance, findPath, reachable, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import { popMode } from '../modes';
import type { Battle, GameState, Terrain } from '../state/types';
import { effectiveStat } from './people';
import { chronicle } from './saga';
import {
  activeCombatant,
  battleMoveCost,
  beginBattle,
  fighterPerson,
  refreshTurn,
  standing,
} from './battle';

/**
 * Pure safety net on the auto-played foe turns. It must be generous enough
 * never to fire in real play — the round limit is what actually ends a
 * grinding fight — but finite so a bad state cannot spin forever.
 */
const MAX_AUTO_TURNS = 2000;

function turnRng(state: GameState, label: string): Rng {
  const battle = state.battle!;
  return stream(state.seed, 'combat').derive(
    `${label}:${state.day}:${battle.round}:${battle.turnIndex}`,
  );
}

// --- Actions ---

/** Walks the active fighter, spending movement by ground cost. */
export function doMove(state: GameState, to: Hex): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return false;

  const path = findPath(active.at, to, (h) => battleMoveCost(battle, h));
  if (path.hexes.length === 0 || path.cost > active.movesLeft) return false;

  active.at = to;
  active.movesLeft -= path.cost;
  return true;
}

/**
 * A blow. 2d6 + might against the defender's wits — quick fighters are hard
 * to land on. Damage scales with might.
 */
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
  const rng = turnRng(state, `strike:${active.personId}`);
  const roll = rng.roll(2, 6) + effectiveStat(attacker, 'might');
  const evade = 7 + effectiveStat(defender, 'wits');

  if (roll < evade) {
    battle.log.push(`${attacker.name} swung at ${defender.name} and missed.`);
    return true;
  }

  const damage = rng.roll(1, 6) + Math.floor(effectiveStat(attacker, 'might') / 2);
  defender.health = Math.max(0, defender.health - damage);
  if (defender.health > 0) {
    battle.log.push(`${attacker.name} struck ${defender.name} (${damage}).`);
    return true;
  }

  target.down = true;
  // Foes are finished for good; the warband's fate is settled off the field
  // when the fight ends (permadeath proper lands in 2.4).
  if (target.side === 'foe') defender.alive = false;
  battle.log.push(
    target.side === 'foe'
      ? `${attacker.name} put ${defender.name} down.`
      : `${defender.name} went down under ${attacker.name}.`,
  );
  return true;
}

// --- Turn cycle ---

/**
 * A fight that cannot end is worse than a fight that ends badly: BATTLE must
 * always hand control back. If neither side can finish it in this many
 * rounds, the field is decided on who is still upright.
 */
export const ROUND_LIMIT = 50;

function checkOutcome(battle: Battle): void {
  if (battle.outcome) return;
  const ours = standing(battle, 'warband').length;
  const theirs = standing(battle, 'foe').length;

  if (theirs === 0) {
    battle.outcome = 'won';
  } else if (ours === 0) {
    battle.outcome = 'lost';
  } else if (battle.round > ROUND_LIMIT) {
    battle.outcome = ours >= theirs ? 'won' : 'lost';
    battle.log.push('Neither side could finish it. We drew apart in the dark.');
  }
}

/** Advances to the next fighter still standing. */
function advanceTurn(battle: Battle): void {
  for (let i = 0; i < battle.order.length + 1; i++) {
    battle.turnIndex += 1;
    if (battle.turnIndex >= battle.order.length) {
      battle.turnIndex = 0;
      battle.round += 1;
    }
    if (activeCombatant(battle)) return; // found someone still up
  }
}

/** One foe's whole turn: close the distance, then swing if you can. */
function takeFoeTurn(state: GameState): void {
  const battle = state.battle!;
  const active = activeCombatant(battle);
  if (!active || active.side !== 'foe') return;

  const enemies = standing(battle, 'warband');
  if (enemies.length === 0) return;

  const nearest = [...enemies].sort(
    (a, b) =>
      distance(a.at, active.at) - distance(b.at, active.at) ||
      a.personId.localeCompare(b.personId),
  )[0]!;

  if (distance(active.at, nearest.at) > 1) {
    // Take the reachable hex that gets closest. Going by reachable ground
    // rather than a clear path matters: fighters block hexes, so a direct
    // route often does not exist, and a foe that needs one just stands there
    // and the battle never ends.
    const options = reachable(active.at, active.movesLeft, (h) => battleMoveCost(battle, h));
    let best: { at: Hex; gap: number; cost: number } | null = null;
    for (const [k, cost] of options) {
      const i = k.indexOf(',');
      const at: Hex = { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
      const gap = distance(at, nearest.at);
      if (
        best === null ||
        gap < best.gap ||
        (gap === best.gap && cost < best.cost)
      ) {
        best = { at, gap, cost };
      }
    }
    if (best && best.gap < distance(active.at, nearest.at)) {
      active.at = best.at;
      active.movesLeft -= best.cost;
    }
  }

  const adjacent = standing(battle, 'warband').filter((c) => distance(c.at, active.at) === 1);
  if (adjacent.length > 0) {
    // Go for whoever is closest to dropping.
    const weakest = [...adjacent].sort((a, b) => {
      const pa = fighterPerson(state, a.personId)?.health ?? 99;
      const pb = fighterPerson(state, b.personId)?.health ?? 99;
      return pa - pb || a.personId.localeCompare(b.personId);
    })[0]!;
    doStrike(state, weakest.personId);
  }
}

/**
 * Plays out foe turns until the warband has the field or the fight is over.
 * Control is never handed back on someone else's turn — there would be no
 * legal action to take, and the player would be stuck watching.
 */
function playUntilOurTurn(state: GameState): void {
  const battle = state.battle;
  if (!battle) return;

  for (let i = 0; i < MAX_AUTO_TURNS; i++) {
    checkOutcome(battle);
    if (battle.outcome) return;

    const active = activeCombatant(battle);
    if (!active) {
      // Whoever held this slot is down; roll on.
      advanceTurn(battle);
      refreshTurn(battle);
      continue;
    }
    if (active.side === 'warband') return;

    takeFoeTurn(state);
    checkOutcome(battle);
    if (battle.outcome) return;
    advanceTurn(battle);
    refreshTurn(battle);
  }
}

/**
 * Opens a fight and settles it onto the warband's turn, so the field is
 * always playable the moment it appears — even when a foe wins initiative.
 */
export function startBattle(state: GameState, terrain: Terrain, difficulty = 0): void {
  beginBattle(state, terrain, difficulty);
  playUntilOurTurn(state);
}

/** Ends the current fighter's turn and plays every foe turn that follows. */
export function endTurn(state: GameState): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;

  checkOutcome(battle);
  if (battle.outcome) return true;

  advanceTurn(battle);
  refreshTurn(battle);
  playUntilOurTurn(state);
  return true;
}

/**
 * Leaves the field: pops BATTLE, writes the result into the saga, and picks
 * the warband back up. Losing costs health and heart, not lives — the full
 * weight of a defeat lands in 2.4.
 */
export function leaveBattle(state: GameState): void {
  const battle = state.battle;
  if (!battle || !battle.outcome) return;

  const won = battle.outcome === 'won';
  const fallen: string[] = [];
  for (const combatant of battle.combatants) {
    if (combatant.side !== 'warband') continue;
    const person = fighterPerson(state, combatant.personId);
    if (!person) continue;
    if (combatant.down) {
      person.health = 1;
      fallen.push(person.name);
    }
  }

  if (won) {
    state.party.morale = Math.min(100, state.party.morale + 10);
    chronicle(
      state,
      fallen.length > 0
        ? `We held the ground, and carried ${fallen.join(' and ')} off it.`
        : 'We held the ground, and none of us stayed on it.',
      'good',
    );
  } else {
    state.party.morale = Math.max(0, state.party.morale - 15);
    chronicle(state, 'They broke us, and we ran. What we left behind we left behind.', 'grim');
  }

  const next = popMode(state);
  state.modes = next.modes;
  delete state.battle;
}

export { checkOutcome };
