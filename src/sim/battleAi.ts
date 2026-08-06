// Enemy behaviour. Three temperaments, each scoring the same battlefield
// differently, so a scout and a huscarl do not play the same fight.

import { distance, fromKey, type Hex } from '../hex';
import type { Combatant, GameState } from '../state/types';
import type { Temperament } from '../data/foes';
import { activeCombatant, archetypeOf, fighterPerson, standing } from './battle';
import { canThrowAt, doDefend, doShove, doStrike, doThrow, evasion } from './battleActions';
import { reachWithZoc, threatCount } from './zoc';
import { effectiveStat } from './people';

/**
 * Past this round nobody is being clever any more. Cautious and flanking
 * fighters press in like everyone else, which stops two careful sides from
 * circling each other until the round limit calls it.
 */
export const PATIENCE_ROUNDS = 12;

function temperamentOf(state: GameState, combatant: Combatant): Temperament {
  const battle = state.battle!;
  if (battle.round > PATIENCE_ROUNDS) return 'aggressive';
  const person = fighterPerson(state, combatant.personId);
  return person ? (archetypeOf(person)?.temperament ?? 'aggressive') : 'aggressive';
}

function healthFraction(state: GameState, combatant: Combatant): number {
  const person = fighterPerson(state, combatant.personId);
  if (!person || person.maxHealth === 0) return 1;
  return person.health / person.maxHealth;
}

/** Prefer whoever is closest to dropping, then whoever is easiest to hit. */
function bestMeleeTarget(state: GameState, active: Combatant): Combatant | undefined {
  const battle = state.battle!;
  const adjacent = standing(battle, 'warband').filter((c) => distance(c.at, active.at) === 1);
  if (adjacent.length === 0) return undefined;
  return [...adjacent].sort((a, b) => {
    const ha = fighterPerson(state, a.personId)?.health ?? 99;
    const hb = fighterPerson(state, b.personId)?.health ?? 99;
    return ha - hb || evasion(state, a) - evasion(state, b) || a.personId.localeCompare(b.personId);
  })[0];
}

/**
 * How much this fighter wants to stand on a given hex. Temperament is the
 * whole difference between the archetypes.
 */
function positionScore(
  state: GameState,
  active: Combatant,
  at: Hex,
  temperament: Temperament,
): number {
  const battle = state.battle!;
  const enemies = standing(battle, 'warband');
  if (enemies.length === 0) return 0;

  const gap = Math.min(...enemies.map((e) => distance(at, e.at)));
  const threats = threatCount(battle, at, active.side);
  let score = -gap * 10;

  switch (temperament) {
    case 'aggressive':
      // Wants contact and does not care what it costs.
      if (gap === 1) score += 30;
      break;

    case 'cautious': {
      // Likes a throwing lane and dislikes being swarmed.
      if (gap >= 2 && gap <= 3 && active.throwsLeft > 0) score += 25;
      score -= Math.max(0, threats - 1) * 22;
      if (healthFraction(state, active) < 0.4 && gap === 1) score -= 25;
      break;
    }

    case 'flanker': {
      // Hunts warriors already busy with someone else, and would rather not
      // be the one who opens the fight.
      const engaged = enemies.filter(
        (e) =>
          distance(e.at, at) === 1 &&
          standing(battle, 'foe').some(
            (f) => f.personId !== active.personId && distance(f.at, e.at) === 1,
          ),
      );
      if (engaged.length > 0) score += 40;
      else if (gap === 1) score -= 12;
      score -= Math.max(0, threats - 1) * 14;
      break;
    }
  }
  return score;
}

/** Moves this fighter to the best hex their temperament can see. */
function reposition(state: GameState, active: Combatant, temperament: Temperament): void {
  const battle = state.battle!;
  const reach = reachWithZoc(battle, active);
  if (reach.size === 0) return;

  let bestAt: Hex | null = null;
  let bestScore = positionScore(state, active, active.at, temperament);
  let bestCost = 0;

  for (const [k, cost] of reach) {
    const at = fromKey(k);
    const score = positionScore(state, active, at, temperament);
    if (score > bestScore || (score === bestScore && cost < bestCost)) {
      bestScore = score;
      bestAt = at;
      bestCost = cost;
    }
  }

  if (bestAt) {
    active.at = bestAt;
    active.movesLeft -= bestCost;
  }
}

/** One foe's whole turn. */
export function takeFoeTurn(state: GameState): void {
  const battle = state.battle!;
  const active = activeCombatant(battle);
  if (!active || active.side !== 'foe') return;
  if (standing(battle, 'warband').length === 0) return;

  const temperament = temperamentOf(state, active);
  const hurt = healthFraction(state, active) < 0.35;

  // A cautious fighter with a clear lane opens with a throw before closing.
  if (temperament === 'cautious' && active.throwsLeft > 0 && !active.hasActed) {
    const shot = standing(battle, 'warband').find((c) => canThrowAt(state, active, c));
    if (shot) {
      doThrow(state, shot.personId);
      return;
    }
  }

  reposition(state, active, temperament);

  const target = bestMeleeTarget(state, active);
  if (!target) {
    // Nothing in reach. Throw if there is a lane.
    if (!active.hasActed && active.throwsLeft > 0) {
      const shot = standing(battle, 'warband').find((c) => canThrowAt(state, active, c));
      if (shot) {
        doThrow(state, shot.personId);
        return;
      }
    }
    // Only cover up against someone who can actually reach you. Shielding in
    // an empty field is what turns a careful fight into a staring contest.
    const exposed = threatCount(battle, active.at, active.side) > 0;
    if (!active.hasActed && exposed && (hurt || temperament === 'cautious')) doDefend(state);
    return;
  }

  // Badly hurt and cautious: get the shield up rather than trade blows.
  if (hurt && temperament === 'cautious') {
    doDefend(state);
    return;
  }

  const attacker = fighterPerson(state, active.personId);
  const defender = fighterPerson(state, target.personId);

  // A shove is worth more than a swing when it puts them in the water, or
  // when their shield is up and a blow would just rattle it.
  if (attacker && defender) {
    const strongEnough = effectiveStat(attacker, 'might') >= effectiveStat(defender, 'might');
    if (target.defending && strongEnough) {
      doShove(state, target.personId);
      return;
    }
  }

  doStrike(state, target.personId);
}
