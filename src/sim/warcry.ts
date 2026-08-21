// The leader's war-cry. It lives beside morale rather than in it because it
// is a battle ACTION — it spends a turn and obeys the same gates as a swing —
// while morale.ts owns what nerve IS. The cry only calls in there.

import { distance } from '../hex';
import type { Combatant, GameState } from '../state/types';
import { activeCombatant, fighterPerson } from './battle';
import { beat } from './beats';
import { shakeNerve, startingNerve } from './morale';
import { leaderOf } from './people';

/** How far the cry carries, in hexes. */
export const WARCRY_RANGE = 2;
/** What it puts back into every friendly heart in range. */
export const WARCRY_HEART = 6;
/** What it takes out of every hostile one. */
export const WARCRY_DREAD = 4;

/** Whether this combatant is the band's leader, standing on this field. */
export function isLeader(state: GameState, combatant: Combatant): boolean {
  return combatant.side === 'warband' && leaderOf(state.party.people)?.id === combatant.personId;
}

export function canWarCry(state: GameState): boolean {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || battle.outcome || battle.warCried) return false;
  return !active.hasActed && !active.broken && isLeader(state, active);
}

/**
 * The war-cry: the leader's action, once a fight. Every friendly heart in
 * range takes some nerve back; every hostile one is shaken, which can break
 * it outright. It spends the turn — a leader roaring is a leader not
 * swinging — and it is the leader's ALONE, which is most of what makes
 * having one mean anything.
 */
export function doWarCry(state: GameState): boolean {
  if (!canWarCry(state)) return false;
  const battle = state.battle!;
  const active = activeCombatant(battle)!;
  const person = fighterPerson(state, active.personId)!;

  active.hasActed = true;
  battle.warCried = true;

  for (const c of battle.combatants) {
    if (c.down || c.fled || distance(c.at, active.at) > WARCRY_RANGE) continue;
    if (c.side === active.side) {
      if (!c.broken) {
        c.nerve = Math.min(startingNerve(state, c.personId), c.nerve + WARCRY_HEART);
      }
    } else {
      shakeNerve(state, c, WARCRY_DREAD);
    }
  }
  beat(battle, { kind: 'warcry', who: active.personId });
  battle.log.push(
    `${person.name} raised the war-cry, and the whole field heard whose ground this was.`,
  );
  return true;
}
