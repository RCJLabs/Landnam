// The fighter's legs and stance: set the shield, and close the line when
// there is nothing else a man may do.
//
// THIS FILE USED TO HOLD TWO MORE VERBS, and 9.1b took them off the bar.
//
// `doShove` was `{from:[1,2], at:[1,2]}` — the same reach as `strike` — so it
// was never a different option positionally, only ever an alternative to
// hitting somebody, and the arena measured it at 47/60 wins against 47/60 for
// never shoving at all. `doDash` was the only way to change rank, and its
// price was one win in sixty: near enough free, and doing something real.
//
// Dropping the dash is what needed care. Measured before the cut, over the
// arena's 60 fights: with neither verb, 269 of 1427 warband turns — 19% —
// had NO legal action at all, at ranks 4, 5 and 6. `throw` is the only verb
// a back-rank man has, `throwsLeft` runs out, and dash was how he walked up
// into the wall afterwards. That is the bug `ranks.ts` says it shipped for
// one afternoon, arriving a second time by deletion instead of by a table.
//
// So the movement outlived the verb: `stepUp` closes the line on a man who
// has nothing he may legally do. He does not choose it and it costs him no
// action he had a use for — which is what a real wall does, and what the
// player was being charged an action for.

import type { Combatant, GameState } from '../state/types';
import { activeCombatant, fighterPerson } from './battle';
import { beat } from './beats';
import { canActFrom, shift } from './ranks';
import { reachTargets, throwTargets } from './strike';
import { strikeTargets } from './battle';

// --- Defend ---

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
 * Whether the shield is worth more than the swing for whoever is up.
 *
 * 9.1 — AND THE VERB WAS NOT DEAD, THE MEASUREMENT WAS. `B_DEFEND` appeared
 * zero times in 1165 battle actions, and the arena's "defend only" arm tied
 * never-defending EXACTLY, a tie that had been asserted for so long it read
 * as a finding about the shield. It was a finding about a priority list: both
 * harnesses put the verb last, below strike, reach, throw and dash, and on a
 * line the front rank nearly always has somebody to hit, so the rule never
 * fired.
 *
 * Measured with the shield taken FIRST, where a player would take it, over 60
 * fights at difficulty 2:
 *
 *   swings always        46/60 wins, 172 standing
 *   shield when hurt     49/60 wins, 189 standing   (paired: won 8, lost 5)
 *   when outnumbered     39/60 wins, 158 standing   (paired: won 1, lost 8)
 *   always, front rank   11/60 wins,  85 standing   (paired: won 0, lost 35)
 *
 * So it is a real verb with a narrow case, which is the shape a good verb
 * has: worth taking when the man holding it is hurt, ruinous taken every
 * turn. Three wins in sixty is thin on its own — the seventeen extra men
 * standing is the sturdier half of it — and neither is a reason to press it
 * blind, which is why this names the ONE case rather than scoring the choice.
 *
 * Stated as a fact for the hint to say, not as a rule the game enforces: the
 * player is told when the shield is worth more, and can swing anyway.
 *
 * AND 9.1b OVERTURNED IT, on the same instrument, the next day. Once the line
 * began closing itself the whole arena moved and this arm INVERTED:
 *
 *   swings always        42/60 wins, 155 standing
 *   shield when hurt     31/60 wins, 120 standing   (paired: won 0, lost 11)
 *   when outnumbered     30/60 wins, 125 standing
 *   always, front rank    0/60 wins,  51 standing
 *
 * The reason is legible rather than mysterious: a man who used to stand safe
 * in a back rank doing nothing now walks into the wall, so fights are more
 * crowded and more lethal, and a turn spent on the shield instead of the blow
 * costs more than it saves. Three wins in sixty was thin when it was in the
 * shield's favour, and this is not thin.
 *
 * So the hint that said it is GONE from render/battleUi.ts — a sentence the
 * harness calls false is worse than no sentence. This function is kept, and
 * kept tested, because the question it answers is still well posed and the
 * ruling is Evan's: give the shield a different rule, or take it off the bar.
 * Nothing reads it today.
 */
export const SHIELD_WHEN_UNDER = 0.5;

export function shieldAdvised(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome) return false;
  if (active.hasActed || active.broken || active.defending) return false;
  if (!canActFrom('defend', active.rank)) return false;
  // Nothing to set a shield against is not a case for setting one.
  if (!battle.combatants.some((c) => c.side !== active.side && !c.down && !c.fled)) return false;
  const person = fighterPerson(state, active.personId);
  return !!person && person.health <= person.maxHealth * SHIELD_WHEN_UNDER;
}

// --- The line closing itself ---

/**
 * Is there anything at all this fighter may legally do?
 *
 * Every verb that survives 9.1b, asked from where they are standing. A `false`
 * here is a man in the wall with no legal order — the thing `ranks.ts` calls
 * out by name — and it is what `stepUp` exists to answer.
 *
 * Deliberately NOT asking about the war cry: it is the leader's alone and once
 * a fight, so a leader who has already used it would read as busy on every
 * turn afterwards and never close up.
 */
export function nothingToDo(state: GameState, who: Combatant): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;
  if (who.hasActed || who.broken || who.down || who.fled) return false;
  if (activeCombatant(battle)?.personId !== who.personId) return false;
  if (canActFrom('defend', who.rank)) return false;
  return strikeTargets(state).length === 0
    && reachTargets(state).length === 0
    && throwTargets(state).length === 0;
}

/**
 * The wall closes on a man who has nothing left to do. Mutates.
 *
 * ONE RANK, not as many as it takes. A man walking from the sixth rank to the
 * third in a turn is a sprint, and this file's own history says a shield wall
 * does not sprint — that was the hex dash's whole failure, arriving alone and
 * having already acted.
 *
 * It DOES spend the turn, and that is deliberate rather than mean. The step
 * is exactly the dash with the button taken off, and the dash cost an action
 * — one the men it fires for had no other use for. Leaving the action unspent
 * would let a man walk up a rank and then swing in the same turn, which is
 * strictly better than the verb ever was and makes standing deep free. `9.13`
 * then ends the turn for the player automatically, so what they see is the
 * man shouldering forward and the turn passing, with nothing to press.
 *
 * Reported as a `moved` beat without `flight`, which is the same shape a
 * broken man giving ground already emits — one is the line tightening and the
 * other is it coming apart, and a view can tell them apart by the flag.
 */
export function stepUp(state: GameState, who: Combatant): boolean {
  const battle = state.battle;
  if (!battle || !nothingToDo(state, who)) return false;
  const was = who.rank;
  if (!shift(battle.combatants, who, -1)) return false;
  who.hasActed = true;
  beat(battle, { kind: 'moved', who: who.personId, from: was, to: who.rank });
  const person = fighterPerson(state, who.personId);
  battle.log.push(`${person?.name ?? 'Someone'} shouldered forward into the line.`);
  return true;
}
