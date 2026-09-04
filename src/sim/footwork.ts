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

/*
 * `SHIELD_WHEN_UNDER` and `shieldAdvised` stood here, and 9.1b's follow-up
 * measurement settled the question they were asking. The record, because it
 * cost three days and two reversals to get:
 *
 * 9.1 found the shield was NOT dead, only never reached — both harnesses put
 * `B_DEFEND` last, and on a line the front rank always has somebody to hit.
 * Taken FIRST, where a player takes it, it read 49/60 wins against 46 for
 * swinging always, and the hint said so.
 *
 * 9.1b INVERTED that the next day on the same instrument. Once the line began
 * closing itself, fights got more crowded and more lethal, and the same arm
 * read 31/60 against 42 — paired, won 0 and lost 11.
 *
 * AND THE THIRD READING IS THE ONE THAT SETTLES IT. Every arm ever run took
 * the shield INSTEAD of a swing, so all of them were really measuring "give
 * up your attack". The arm that had never been tried is the free one: set the
 * shield only when there is nothing to attack. It ties swinging-always
 * EXACTLY — same wins, same men standing, same log — which by this project's
 * own rule is evidence the rule never fired, not that it is worthless. So it
 * was counted: **front-two turns with nothing to hit, over sixty fights,
 * ZERO**. The walls deploy in contact and `defend` is a front-two verb, so
 * the shield's free case does not exist on this battlefield. It can only ever
 * be bought with a blow, and buying it loses.
 *
 * `doDefend` STAYS — the foe AI reaches for it, a cautious fighter who is
 * hurt sets his shield rather than trading, and nothing measures that as
 * wrong. What is gone is the function that ADVISED a player to do it, because
 * a helper whose one true case does not exist is worse than no helper. See
 * test/wall.test.ts, which asserts the zero so the day it stops being zero is
 * a day somebody finds out.
 */

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
