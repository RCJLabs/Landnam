// The turn cycle: whose turn it is, playing out the foes' turns, and handing
// the field back to travel when it is settled.

import { popMode } from '../modes';
import type { Battle, GameState, Terrain } from '../state/types';
import { chronicle } from './saga';
import {
  activeCombatant,
  beginBattle,
  effective,
  fighterPerson,
  refreshTurn,
  standing,
} from './battle';
import { takeFoeTurn } from './battleAi';
import { pressureAtTurnStart, takeBrokenTurn } from './morale';

/**
 * Pure safety net on the auto-played foe turns. Generous enough never to fire
 * in real play — the round limit is what actually ends a grinding fight — but
 * finite, so a bad state cannot spin forever.
 */
const MAX_AUTO_TURNS = 2000;

/**
 * A fight that cannot end is worse than a fight that ends badly: BATTLE must
 * always hand control back. If neither side can finish it in this many
 * rounds, the field is decided on who is still upright.
 */
export const ROUND_LIMIT = 50;

export function checkOutcome(battle: Battle): void {
  if (battle.outcome) return;
  // A side is beaten when nobody is left standing, and equally when everyone
  // still up has lost their nerve — a broken line has already lost the field.
  const ours = standing(battle, 'warband').length;
  const theirs = standing(battle, 'foe').length;
  const oursWilling = effective(battle, 'warband').length;
  const theirsWilling = effective(battle, 'foe').length;

  if (theirs === 0) {
    battle.outcome = 'won';
  } else if (ours === 0) {
    battle.outcome = 'lost';
  } else if (theirsWilling === 0 && oursWilling > 0) {
    battle.outcome = 'won';
    battle.log.push('Their line broke, and what was left of it ran.');
  } else if (oursWilling === 0 && theirsWilling > 0) {
    battle.outcome = 'lost';
    battle.log.push('Our line broke. There was nothing to do but run.');
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
      advanceTurn(battle);
      refreshTurn(battle);
      continue;
    }

    // Pressure comes first, because standing surrounded can be the thing
    // that breaks them — and a fighter who breaks right now must be handled
    // as broken, not handed to the player with no legal orders.
    pressureAtTurnStart(state, active);

    // A fighter who has lost their nerve is not taking orders, from the
    // player or from anyone. They rally or they run, and the turn moves on.
    if (active.broken) {
      takeBrokenTurn(state, active);
      checkOutcome(battle);
      if (battle.outcome) return;
      // A rally hands the turn back to whoever it belongs to.
      if (!active.broken && active.side === 'warband') return;
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
  const ran: string[] = [];
  for (const combatant of battle.combatants) {
    if (combatant.side !== 'warband') continue;
    const person = fighterPerson(state, combatant.personId);
    if (!person) continue;
    if (combatant.down) {
      person.health = 1;
      fallen.push(person.name);
    } else if (combatant.fled) {
      ran.push(person.name);
    }
  }

  // Running is remembered. It costs the band's heart even in victory.
  if (ran.length > 0) {
    state.party.morale = Math.max(0, state.party.morale - ran.length * 4);
    chronicle(
      state,
      `${ran.join(' and ')} ran, and came back to us later saying nothing.`,
      'grim',
    );
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
