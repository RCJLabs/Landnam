// Enemy behaviour. Three temperaments, each scoring the same battlefield
// differently, so a scout and a huscarl do not play the same fight.

import type { Combatant, GameState } from '../state/types';
import type { Temperament } from '../data/foes';
import { activeCombatant, archetypeOf, fighterPerson, standing, strikeTargets } from './battle';
import { canThrowAt, doReach, doStrike, doThrow, reachTargets } from './strike';
import { doDefend } from './footwork';
import { evasion } from './swing';
import { threatCount } from './zoc';
import { closeUp } from './ranks';
import { beat } from './beats';

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

/**
 * When a clan's named man decides he has had enough of this field.
 *
 * THE SAME FRACTION `takeFoeTurn` ALREADY CALLS HURT, taken from there
 * rather than picked to taste: a cautious fighter at 0.35 puts his shield up,
 * and a champion with a clan behind him walks. Spelled separately on purpose
 * — they agree today and they are not one rule.
 */
export const CHAMPION_QUITS_AT = 0.35;

/**
 * A clan's champion, badly hurt, gets off the field.
 *
 * WHY THIS EXISTS. MEASURED 2026-09-04 (80 landings an arm, `fair`, to day
 * 400, 981 fights with a named man): the recurring antagonist never recurs —
 * 0 of 179 clan fights featured a man met before. He opens at rank 1 in 100%
 * of fights, he flees in 0 of 981 and breaks in 3-9%, so he never gives the
 * ground `takeBrokenTurn` would have given him; and the band wins 87% of clan
 * fights, because those are the fights it picks. A man who fights to the end
 * of a fight his side loses nine times in ten is not a recurring foe, he is a
 * milestone.
 *
 * WHY ONLY A CLAN'S MAN. `settleChampion` does nothing without a
 * `championOf`: a champion who belongs to nobody cannot come back whatever
 * happens to him, and he already walks off 60-65% of his fights. Restricting
 * the rule keeps it on the population it was measured for — and it reads as
 * the truth about both men. One has a hall to go back to; the other is on
 * that field by choice.
 *
 * DELIBERATELY NOT A ROUT. He leaves under his own steam, on his own turn,
 * still standing — `settleChampion` then writes the line it has always had
 * for a man who got away, and gives him the scar that makes him worse next
 * time. Killing him on the field is still final, and still the only way to be
 * rid of him; it now has to be done before he decides to go.
 */
export function championQuits(state: GameState, active: Combatant): boolean {
  const battle = state.battle!;
  if (!battle.championOf || battle.champion !== active.personId) return false;
  if (active.down || active.fled) return false;
  if (healthFraction(state, active) >= CHAMPION_QUITS_AT) return false;

  const person = fighterPerson(state, active.personId);
  const name = person ? `${person.name}${person.byname ? ` ${person.byname}` : ''}` : 'Their man';
  active.fled = true;
  // Same as a man going down: the wall does not keep his place for him.
  closeUp(battle.combatants, active.side);
  beat(battle, { kind: 'fled', who: active.personId });
  battle.log.push(`${name} had taken enough, and went back to his own.`);
  active.hasActed = true;
  return true;
}

/** One foe's whole turn. */
export function takeFoeTurn(state: GameState): void {
  const battle = state.battle!;
  const active = activeCombatant(battle);
  if (!active || active.side !== 'foe') return;
  if (standing(battle, 'warband').length === 0) return;

  // Before anything else he might do with the turn: he may not want it.
  if (championQuits(state, active)) return;

  const temperament = temperamentOf(state, active);
  // Left as its own number rather than pointed at CHAMPION_QUITS_AT below.
  // They are the same fraction today and they are not the same rule: moving
  // when a champion walks must not silently move when a cautious man shields.
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
