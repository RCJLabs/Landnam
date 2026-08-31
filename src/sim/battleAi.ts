// Enemy behaviour. Three temperaments, each scoring the same battlefield
// differently, so a scout and a huscarl do not play the same fight.

import type { Combatant, GameState } from '../state/types';
import type { Temperament } from '../data/foes';
import { activeCombatant, archetypeOf, fighterPerson, standing, strikeTargets } from './battle';
import { canThrowAt, doReach, doStrike, doThrow, reachTargets } from './strike';
import { doDefend } from './footwork';
import { evasion } from './swing';
import { threatCount } from './zoc';

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
 * `takeRank` stood here. It read: if you cannot reach anybody from where you
 * are, shoulder forward until you can — with temperament deciding who bothers.
 *
 * 9.1b took the dash off the bar, and the same movement is now the line
 * closing itself (`stepUp`, sim/footwork.ts), run for BOTH sides at the top of
 * a turn. Every rule this function carried survives in that one:
 *
 * - "the cautious do not shoulder into the front rank" — `nothingToDo` is
 *   false for anybody in ranks 1 or 2, because they may always set a shield;
 * - "a flanker with axes left is where it wants to be" — a man with axes and
 *   somebody to throw at has something to do, so the line does not close on
 *   him;
 * - and it still spends the turn, as the dash did.
 */

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


  // A shove stood here, for a foe strong enough to lean on a raised shield.
  // 9.1b took the verb: on a line it had the same reach as a strike and the
  // arena priced it at nothing (47/60 wins either way), so the foe simply
  // swings at the shield now, which is what DEFEND_BONUS is there to answer.
  doStrike(state, target.personId);
}
