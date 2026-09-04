// Who is under threat, and from whom.
//
// This was zone of control on a hex plane: a standing fighter threatened all
// six hexes around them, stepping into a threatened hex ended your movement,
// and stepping out of one cost extra. Those two clauses existed to make a
// line something you had to break rather than stroll around.
//
// Since 8.1c the line is not something the player assembles out of positions
// — it is the shape of the world. So the clauses are gone and what is left is
// the question they were really answering: can anybody actually reach me?
//
// The file keeps its name because every importer knows it, and because "the
// zone somebody controls" is still exactly what it computes. It is simply
// that the zone is now the ranks their weapons cover.

import type { Battle, Combatant, Side } from '../state/types';
import { canActFrom, canLandOn } from './ranks';

export function standingEnemies(battle: Battle, side: Side): Combatant[] {
  return battle.combatants.filter((c) => !c.down && !c.fled && c.side !== side);
}

/**
 * How many of the other side could put something into this fighter.
 *
 * A throw is deliberately NOT counted. It reaches every rank, so counting it
 * would make every fighter equally threatened everywhere and the number would
 * stop meaning anything — which is the opposite of what the callers want it
 * for. What they are asking is "is the press closing on this one", and that
 * is the men who can strike or reach.
 */
export function threatCount(battle: Battle, of: Combatant): number {
  return standingEnemies(battle, of.side).filter(
    (e) =>
      (canActFrom('strike', e.rank) && canLandOn('strike', of.rank)) ||
      (canActFrom('reach', e.rank) && canLandOn('reach', of.rank)),
  ).length;
}

/** Is anybody on the other side able to reach this fighter at all? */
export function isThreatened(battle: Battle, of: Combatant): boolean {
  return threatCount(battle, of) > 0;
}
