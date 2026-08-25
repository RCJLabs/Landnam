// The second rank: a spear thrust past the man in front.
//
// The shield wall had an inside and an outside in name only — a six-wide
// line on a seven-wide field always has somebody stood behind somebody, and
// until this those men could do nothing but wait for a gap. The rule is
// positional, not equipment: no shield-brother between you and the target,
// no thrust.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { startBattle } from '../src/sim/battleTurn';
import { apply } from '../src/sim/actions';
import { offsetToAxial } from '../src/hex';
import {
  REACH_DAMAGE_OFF,
  REACH_PENALTY,
  canReachAt,
  doReach,
  reachTargets,
  screenFor,
} from '../src/sim/strike';
import type { Combatant, GameState } from '../src/state/types';

/** A clear field with everyone parked, ready to be arranged by hand. */
function field(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  startBattle(state, 'meadow', 2);
  const battle = state.battle!;
  for (const k of Object.keys(battle.grid)) battle.grid[k] = { ground: 'open' };
  battle.combatants.forEach((c, i) => {
    c.at = offsetToAxial(i % 7, c.side === 'warband' ? 8 : 0);
    c.broken = false;
    c.down = false;
    c.fled = false;
  });
  return state;
}

function ours(state: GameState): Combatant[] {
  return state.battle!.combatants.filter((c) => c.side === 'warband');
}
function foes(state: GameState): Combatant[] {
  return state.battle!.combatants.filter((c) => c.side === 'foe');
}

/**
 * back — front — foe, in a line. The classic second rank: `back` stands
 * behind `front`, and puts his spear past `front`'s shoulder.
 *
 * It used to say this in hexes — three of them in a row, two apart. Since
 * 8.1c it says it in ranks, which is what it always meant.
 */
function ranked(seed: string): {
  state: GameState;
  back: Combatant;
  front: Combatant;
  foe: Combatant;
} {
  const state = field(seed);
  const [back, front] = ours(state) as [Combatant, Combatant];
  const foe = foes(state)[0]!;
  back.rank = 2;
  front.rank = 1;
  foe.rank = 1;
  const battle = state.battle!;
  // Everybody else out of the line, so the fixture is exactly three men.
  for (const c of battle.combatants) {
    if (c !== back && c !== front && c !== foe) c.down = true;
  }
  battle.order = [back.personId];
  battle.turnIndex = 0;
  back.hasActed = false;
  return { state, back, front, foe };
}

describe('who may thrust', () => {
  it('the fixture is a real second rank', () => {
    const { back, front, foe } = ranked('reach-shape');
    expect(back.rank).toBe(2);
    expect(front.rank).toBe(1);
    expect(foe.rank).toBe(1);
  });

  it('a man behind a shield-brother can reach past him', () => {
    const { state, back, front, foe } = ranked('reach-yes');
    expect(screenFor(state, back)?.personId).toBe(front.personId);
    expect(canReachAt(state, back, foe)).toBe(true);
    expect(reachTargets(state).map((c) => c.personId)).toContain(foe.personId);
  });

  it('with nobody in front there is nothing to thrust past', () => {
    const { state, back, front, foe } = ranked('reach-nofront');
    // Nobody in front of him any more: he IS the front rank.
    front.down = true;
    back.rank = 1;
    expect(screenFor(state, back)).toBeUndefined();
    expect(canReachAt(state, back, foe)).toBe(false);
    expect(apply(state, { type: 'B_REACH', targetId: foe.personId })).toBe(state);
  });

  it('a broken or fallen man is no screen — he is not holding anything', () => {
    const { state, back, front, foe } = ranked('reach-broken');
    front.broken = true;
    expect(canReachAt(state, back, foe)).toBe(false);
    front.broken = false;
    front.down = true;
    expect(canReachAt(state, back, foe)).toBe(false);
  });

  it('it is the second and third rank: not the first, not the fourth', () => {
    const { state, back, front, foe } = ranked('reach-range');
    expect(canReachAt(state, back, foe)).toBe(true);
    // Up into the front rank: that is a strike, not a thrust. There is
    // nobody's shoulder left to put it past.
    back.rank = 1;
    expect(canReachAt(state, back, foe)).toBe(false);
    // And from the very back, the spear is not long enough.
    back.rank = 4;
    expect(canReachAt(state, back, foe)).toBe(false);
    // The third rank can thrust — but only with somebody in the second to
    // thrust past. A screen is the man DIRECTLY in front, not just anybody
    // ahead of you in the line.
    back.rank = 3;
    expect(canReachAt(state, back, foe), 'nobody in the second rank yet').toBe(false);
    front.rank = 2;
    expect(canReachAt(state, back, foe)).toBe(true);
  });

  it('nobody thrusts at their own side, or twice in a turn', () => {
    const { state, back, front, foe } = ranked('reach-rules');
    expect(canReachAt(state, back, front)).toBe(false);
    back.hasActed = true;
    expect(canReachAt(state, back, foe)).toBe(false);
  });
});

describe('what a thrust does', () => {
  it('lands, hurts, and spends the turn', () => {
    const { state, back, foe } = ranked('reach-lands');
    const battle = state.battle!;
    // A thrust that cannot miss.
    state.party.people.find((p) => p.id === back.personId)!.stats.might = 6;
    const person = battle.foes.find((p) => p.id === foe.personId)!;
    person.stats.wits = 1;
    const before = person.health;

    expect(doReach(state, foe.personId)).toBe(true);
    expect(person.health).toBeLessThan(before);
    expect(back.hasActed).toBe(true);
    expect(battle.log.at(-1)).toMatch(/spear came over|put .* down over the shoulder/);
    expect(battle.beats?.at(-1)).toMatchObject({ kind: 'reached', who: back.personId });
  });

  it('a thrust that misses does NOT chip, where a swing would', () => {
    const { state, back, foe } = ranked('reach-miss');
    const battle = state.battle!;
    // Hopeless: max 2d6 is 12, and evasion here is far past it.
    state.party.people.find((p) => p.id === back.personId)!.stats.might = 0;
    const person = battle.foes.find((p) => p.id === foe.personId)!;
    person.stats.wits = 10;
    const before = person.health;

    expect(doReach(state, foe.personId)).toBe(true);
    // The trade for standing where nothing can hit you: half of it is air.
    expect(person.health).toBe(before);
    expect(battle.beats?.at(-1)).toMatchObject({ kind: 'reached', result: 'miss', damage: 0 });
    expect(battle.log.at(-1)).toContain('found nothing');
  });

  it('reaching is harder and lighter than swinging', () => {
    // Not a dice comparison — the constants themselves, which is what the
    // balance rests on and what a later edit would quietly change.
    expect(REACH_PENALTY).toBeGreaterThan(0);
    expect(REACH_DAMAGE_OFF).toBeGreaterThan(0);
  });

  it('through the action layer, on our turn only', () => {
    const { state, back, foe } = ranked('reach-action');
    state.party.people.find((p) => p.id === back.personId)!.stats.might = 6;
    state.battle!.foes.find((p) => p.id === foe.personId)!.stats.wits = 1;
    const next = apply(state, { type: 'B_REACH', targetId: foe.personId });
    expect(next).not.toBe(state);
    expect(next.battle!.combatants.find((c) => c.personId === back.personId)!.hasActed).toBe(true);
  });
});

describe('their line has a second rank too', () => {
  it('the rule is symmetric — a foe behind a foe can thrust at us', () => {
    const state = field('reach-theirs');
    const [backFoe, frontFoe] = foes(state) as [Combatant, Combatant];
    const us = ours(state)[0]!;
    backFoe.rank = 2;
    frontFoe.rank = 1;
    us.rank = 1;
    const battle = state.battle!;
    for (const c of battle.combatants) {
      if (c !== backFoe && c !== frontFoe && c !== us) c.down = true;
    }
    battle.order = [backFoe.personId];
    battle.turnIndex = 0;
    backFoe.hasActed = false;

    expect(screenFor(state, backFoe)?.personId).toBe(frontFoe.personId);
    expect(canReachAt(state, backFoe, us)).toBe(true);
  });
});
