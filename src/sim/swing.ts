// What every blow shares, whichever verb swings it: the same derived dice,
// the same reckoning of how hard a fighter is to hit, what the country and
// the wall add, what a wound explains — and the same fall when one goes down.

import { stream, type Rng } from '../rng';
import type { Combatant, GameState, Injury, Person } from '../state/types';
import { fighterPerson } from './battle';
import { beat } from './beats';
import { atThePalisade, defenceBonus, wallLinks } from './wall';
import { threatCount } from './zoc';
import { bonus } from './lore';
import { leaderFell, witnessFall } from './morale';
import { closeUp } from './ranks';
import { effectiveStat } from './people';
import { hardshipById } from '../data/hardship';

/** Raising a shield is worth this much to the roll needed to hit you. */
export const DEFEND_BONUS = 3;

/**
 * Being on top of a palisade. You have one hand on the stakes and no footing
 * worth the name, and this is the entire reason the thing is worth building:
 * it does not stop them, it makes them climb where you are waiting.
 */
export const WALL_EXPOSED = 3;

/**
 * Every verb rolls from here, not from a stream of its own: the label folds
 * in the day, round and turn, so the same fighter doing the same thing twice
 * in a fight still gets fresh dice, and a replayed save gets the same ones.
 * Exported because each verb module is half of a whole that used to be one
 * file — a verb deriving its own stream would silently fork the replay.
 */
export function actionRng(state: GameState, label: string): Rng {
  const battle = state.battle!;
  return stream(state.seed, 'combat').derive(
    `${label}:${state.day}:${battle.round}:${battle.turnIndex}`,
  );
}

/**
 * Each enemy past the first on you is worth this much to all of their blows.
 * It has to bite: it is the whole reason a warrior who runs in alone dies,
 * and a warrior with mates at both shoulders does not.
 */
export const OUTNUMBERED_PENALTY = 2;
export const MAX_OUTNUMBERED = 2;

/**
 * The wall pushes. Shoulder-mates were always worth something to a
 * fighter's DEFENCE; now they add weight to the blow as well — one mate is
 * +1 to hit, two are +2, same shape as the wall bonus itself. This is what
 * "more synergy with your band" means mechanically: the line is not a place
 * you hide, it is a thing that hits. Symmetric, because their line is a
 * line too.
 */
export const WALL_PUSH_MAX = 2;

/**
 * What the country itself is worth to a swing.
 *
 * The one place hardship reaches into a fight. Added to ours and taken off
 * theirs, so A Fair Country is two points of swing across the field and A
 * Hard Country two the other way, while the balanced middle is exactly zero
 * and every fixture in the battle suite is played there — which is the only
 * reason a difficulty is allowed this deep in at all. See src/data/hardship.
 *
 * On `doStrike` alone, and that is a scope decision rather than an
 * oversight: the swing at arm's length is what fights are made of and what
 * the measured curve in ROADMAP.md was read off. The thrust already carries
 * REACH_PENALTY and the thrown spear rolls off wits, and pushing the knob
 * into those would buy a fraction of a blow a saga at the price of making
 * every published figure describe something other than what was measured.
 */
export function edge(state: GameState, attacker: Combatant): number {
  const steel = hardshipById(state.hardship).steel;
  // Early, so the balanced middle returns +0 rather than the -0 that negating
  // a zero gives. Nothing downstream can tell them apart, but a sim value
  // that serialises as `-0` is the kind of thing a save test finds later.
  if (steel === 0) return 0;
  return attacker.side === 'warband' ? steel : -steel;
}

/**
 * The wound that is dragging this swing, named — or nothing at all.
 *
 * The game has been taking a point off the dice and telling nobody. A fresh
 * band lands 76% of its swings and a worn one 59%, and the whole of that gap
 * is `effectiveStat` quietly reading the injury table; meanwhile the foes are
 * generated whole for every fight and never carry a wound, so the player sees
 * their own men missing, sees the enemy hitting, and is given no reason for
 * either. A number that changes the outcome and is never stated reads as the
 * dice being unfair.
 *
 * MIGHT only, because might is what `doStrike` rolls against. A lost eye is
 * a real wound and it is not what made this blow go wide, and naming it here
 * would be a worse lie than saying nothing.
 *
 * Appended to the two lines where a blow fails, and deliberately nowhere
 * else: a hit does not need excusing, and a wound recited on every swing
 * stops being read by the second fight.
 */
export function carrying(attacker: Person): string {
  let worst: Injury | undefined;
  for (const injury of attacker.injuries) {
    const cost = injury.effect.might ?? 0;
    if (cost < 0 && cost < (worst?.effect.might ?? 0)) worst = injury;
  }
  if (!worst) return '';
  // The labels are written as a healer's note — "Shield-arm broken",
  // "Hamstrung" — so they drop straight into an appositive without rewording.
  return ` ${worst.label}, and the swing showed it.`;
}

export function wallPush(state: GameState, attacker: Combatant): number {
  const battle = state.battle;
  if (!battle) return 0;
  return Math.min(WALL_PUSH_MAX, wallLinks(battle, attacker).length);
}

/**
 * How hard this fighter is to land a blow on right now.
 *
 * The wall protects you and being surrounded exposes you, and between them
 * they are why a line beats a charge: shoulder-mates cover the sides that
 * would otherwise be open, and the man who runs in alone ends up with three
 * of them on him and nothing at his back.
 */
export function evasion(state: GameState, target: Combatant): number {
  const person = fighterPerson(state, target.personId);
  const wits = person ? effectiveStat(person, 'wits') : 1;
  const battle = state.battle;
  if (!battle) return 7 + wits;

  // Wall-drill is likewise ours alone, and only counts to a fighter who is
  // actually standing in a line.
  const drill = target.side === 'warband' ? bonus(state, 'wall') : 0;
  const shelter = target.broken ? 0 : defenceBonus(battle, target, DEFEND_BONUS, drill);
  const surrounded = Math.min(
    MAX_OUTNUMBERED,
    Math.max(0, threatCount(battle, target) - 1),
  );
  // Astride the stakes: since 8.1c that is the raiders' front rank, the men
  // actually climbing, rather than whoever stood on a wall hex.
  const onTheStakes =
    target.side === 'foe' && target.rank === 1 && atThePalisade(battle) ? WALL_EXPOSED : 0;
  return 7 + wits + shelter - surrounded * OUTNUMBERED_PENALTY - onTheStakes;
}

/**
 * Every kill goes through here, whichever verb dealt it. Exported for the
 * same reason as `actionRng`: the fall's bookkeeping — the kill tally, the
 * nerve shaken while the fallen still counts as a link, the leader's fall
 * read out AFTER the cause — is an ordering, and two copies of an ordering
 * are two orderings.
 */
export function drop(
  state: GameState,
  target: Combatant,
  person: Person,
  cause: string,
  killer?: Combatant,
): void {
  const battle = state.battle!;
  if (killer && killer.side !== target.side) killer.kills += 1;
  // Nerve has to be shaken while the fallen fighter is still counted as a
  // link, or nobody registers that the wall just opened.
  witnessFall(state, target);
  target.down = true;
  target.defending = false;
  // The line closes over him. This is the rule the whole mode rests on, and
  // it belongs HERE rather than in each verb: a hole left in a wall is a wall
  // whose front rank is empty, and a fight where nobody stands at the front
  // is a fight where nobody can reach anybody — which is exactly what
  // happened when this was missing, three seeds running to the round limit
  // with the survivors stranded at ranks four, five and six.
  closeUp(battle.combatants, target.side);
  person.health = 0;
  if (target.side === 'foe') person.alive = false;
  battle.log.push(cause);
  beat(battle, {
    kind: 'fell',
    who: target.personId,
    side: target.side,
    ...(killer ? { by: killer.personId } : {}),
  });
  // After the cause, so the saga reads fall first, then what it did to them.
  leaderFell(state, target);
}
