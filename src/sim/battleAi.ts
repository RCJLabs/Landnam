// Enemy behaviour. Three temperaments, each scoring the same battlefield
// differently, so a scout and a huscarl do not play the same fight.

import type { Combatant, GameState } from '../state/types';
import type { Temperament } from '../data/foes';
import { activeCombatant, archetypeOf, fighterPerson, standing, strikeTargets } from './battle';
import { canThrowAt, doReach, doStrike, doThrow, reachTargets } from './strike';
import { doDash, doDefend, doShove } from './footwork';
import { evasion } from './swing';
import { threatCount } from './zoc';
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
function bestMeleeTarget(state: GameState): Combatant | undefined {
  const adjacent = strikeTargets(state);
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
/**
 * Take a better place in the line, if there is one.
 *
 * This was a search over reachable hexes scored by gap, shoulder-mates and
 * temperament. A line has no such geography — the only choice about where to
 * be is WHICH RANK, so the whole thing collapses to: if you cannot reach
 * anybody from here, shoulder forward until you can.
 *
 * Temperament still shows, but in what a fighter does rather than where they
 * walk: the aggressive push up, the cautious hold what they have, and the
 * flanker keeps to the back where a thrown axe still reaches.
 */
function takeRank(state: GameState, active: Combatant, temperament: Temperament): void {
  const battle = state.battle!;
  if (active.hasActed || active.broken) return;

  const canHitSomething =
    strikeTargets(state).length > 0
    || reachTargets(state).length > 0
    || (active.throwsLeft > 0 && standing(battle, 'warband').some((c) => canThrowAt(state, active, c)));
  if (canHitSomething) return;

  // A flanker with axes left is exactly where it wants to be.
  if (temperament === 'flanker' && active.throwsLeft > 0) return;
  // The cautious do not shoulder into the front rank to make something happen.
  if (temperament === 'cautious' && active.rank <= 2) return;

  doDash(state, -1);
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

  takeRank(state, active, temperament);

  const target = bestMeleeTarget(state);
  if (!target) {
    // Nothing at arm's length — but their line has a second rank too, and a
    // spear over a mate's shoulder is exactly what it is for. Symmetric on
    // purpose: a formation trick that only the warband can play is not a
    // formation, it is a bonus.
    if (!active.hasActed) {
      const reach = reachTargets(state);
      if (reach.length > 0) {
        const weakest = reach.reduce((worst, c) =>
          healthFraction(state, c) < healthFraction(state, worst) ? c : worst,
        );
        doReach(state, weakest.personId);
        return;
      }
    }
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
    const exposed = threatCount(battle, active) > 0;
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
