// The combat overhaul: who leads, what the wall adds to a blow, what a
// missed swing still costs, and the leader's war-cry.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { startBattle } from '../src/sim/battleTurn';
import { apply } from '../src/sim/actions';
import { leaderOf } from '../src/sim/people';
import { startingNerve } from '../src/sim/morale';
import { WALL_PUSH_MAX, wallPush } from '../src/sim/swing';
import { doStrike } from '../src/sim/strike';
import {
  WARCRY_HEART,
  WARCRY_RANGE,
  canWarCry,
  doWarCry,
  isLeader,
} from '../src/sim/warcry';
import type { Beat } from '../src/sim/beats';
import type { Combatant, GameState } from '../src/state/types';

/** The newest thing the fight recorded about itself. */
function lastBeat(state: GameState): Beat | undefined {
  return state.battle?.beats?.at(-1);
}

function fight(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  startBattle(state, 'meadow', 1);
  const battle = state.battle!;
  for (let i = 0; i < battle.grid.length; i += 1) battle.grid[i] = { ground: 'open' };
  return state;
}

function ours(state: GameState): Combatant[] {
  return state.battle!.combatants.filter((c) => c.side === 'warband');
}

function foes(state: GameState): Combatant[] {
  return state.battle!.combatants.filter((c) => c.side === 'foe');
}

/** Puts everyone somewhere deliberate and hands the turn to `who`. */
function arrange(state: GameState, who: Combatant): void {
  const battle = state.battle!;
  battle.order = [who.personId];
  battle.turnIndex = 0;
  who.hasActed = false;
  who.broken = false;
}

/**
 * Get these out of the way.
 *
 * It used to mean "stand them on a far row". Since 8.1c what matters is the
 * RANK — a man parked on the far side of the field is still shoulder to
 * shoulder if his rank touches yours — so they go to ranks deep enough that
 * nothing in a fixture reaches them.
 */
function park(list: Combatant[]): void {
  list.forEach((c, i) => { c.rank = 20 + i; });
}

describe('who leads', () => {
  it('the first living sworn leads, and the mantle passes by seniority', () => {
    const state = fight('leader-order');
    const people = state.party.people;
    expect(leaderOf(people)?.id).toBe(people[0]!.id);

    people[0]!.alive = false;
    expect(leaderOf(people)?.id).toBe(people[1]!.id);
  });

  it('a hand never leads, whatever the roster order says', () => {
    const state = fight('leader-hand');
    const people = state.party.people;
    people[0]!.bond = 'hand';
    expect(leaderOf(people)?.id).toBe(people[1]!.id);
  });

  it('isLeader marks exactly one combatant on the field', () => {
    const state = fight('leader-mark');
    const marked = state.battle!.combatants.filter((c) => isLeader(state, c));
    expect(marked).toHaveLength(1);
    expect(marked[0]!.personId).toBe(leaderOf(state.party.people)!.id);
  });
});

describe('the wall pushes', () => {
  it('no mates, one mate, two mates — and two is the cap', () => {
    const state = fight('push-count');
    const [a, b, c, d] = ours(state) as [Combatant, Combatant, Combatant, Combatant];
    park(foes(state));
    park(ours(state).slice(4));
    // `a` is the middle of the line and has both — `b` and `c` flank him with
    // one each, and `d` stands where nothing touches him.
    a.rank = 2;
    b.rank = 1;
    c.rank = 3;
    d.rank = 6;
    for (const x of [a, b, c, d]) {
      x.broken = false;
      x.down = false;
      x.fled = false;
    }

    expect(wallPush(state, d)).toBe(0);
    expect(wallPush(state, b)).toBe(1);
    expect(wallPush(state, a)).toBe(2);
    expect(wallPush(state, a)).toBe(WALL_PUSH_MAX);
  });
});

describe('the glancing blow', () => {
  /** An attacker who cannot possibly reach the target's evasion. */
  function hopeless(seed: string): {
    state: GameState;
    attacker: Combatant;
    target: Combatant;
  } {
    const state = fight(seed);
    const attacker = ours(state)[0]!;
    const target = foes(state)[0]!;
    park(ours(state).slice(1));
    park(foes(state).slice(1));
    attacker.rank = 1;
    target.rank = 2;
    arrange(state, attacker);

    // Max roll is 2d6 = 12; with might 0 and no wall push it cannot touch
    // evasion 7 + wits 10 = 17. The miss is guaranteed, not merely likely.
    state.party.people.find((p) => p.id === attacker.personId)!.stats.might = 0;
    const person = state.battle!.foes.find((p) => p.id === target.personId)!;
    person.stats.wits = 10;
    return { state, attacker, target };
  }

  it('a miss still chips one point and says so', () => {
    const { state, target } = hopeless('glance-chip');
    const person = state.battle!.foes.find((p) => p.id === target.personId)!;
    const before = person.health;

    expect(doStrike(state, target.personId)).toBe(true);
    expect(person.health).toBe(before - 1);
    expect(lastBeat(state)).toMatchObject({ kind: 'struck', result: 'glance', damage: 1 });
    const line = state.battle!.log.at(-1)!;
    expect(/glanced|shield/.test(line)).toBe(true);
  });

  it('a glancing blow can never kill', () => {
    const { state, target } = hopeless('glance-floor');
    const person = state.battle!.foes.find((p) => p.id === target.personId)!;
    person.health = 1;

    expect(doStrike(state, target.personId)).toBe(true);
    expect(person.health).toBe(1);
    expect(target.down).toBe(false);
  });

  it('a full wall turns the glance — shield-brothers take the wear instead', () => {
    const { state, target } = hopeless('glance-wall');
    // Give the target two shoulder-mates: a full wall. On a line that is one
    // in the rank ahead and one in the rank behind — which used to take a
    // search over off-row hexes to find, and now just says itself.
    const [mate1, mate2] = foes(state).slice(1, 3) as [Combatant, Combatant];
    target.rank = 2;
    mate1.rank = 1;
    mate2.rank = 3;
    for (const m of [mate1, mate2]) {
      m.broken = false;
      m.down = false;
      m.fled = false;
    }
    const person = state.battle!.foes.find((p) => p.id === target.personId)!;
    const before = person.health;

    expect(doStrike(state, target.personId)).toBe(true);
    expect(person.health).toBe(before);
    // The beat says WHICH kind of nothing this was: a full wall turning it
    // aside, not a swing that went past.
    expect(lastBeat(state)).toMatchObject({ kind: 'struck', result: 'turned', damage: 0 });
    expect(state.battle!.log.at(-1)).toContain('turned');
  });

  it('every blow lands its own beat, glancing or not', () => {
    // The old one-slot hook could only ever say "something happened since
    // you last looked". A stream keeps both swings.
    const { state, attacker, target } = hopeless('glance-count');
    expect(doStrike(state, target.personId)).toBe(true);
    const first = lastBeat(state)!.n;
    attacker.hasActed = false;
    expect(doStrike(state, target.personId)).toBe(true);
    expect(lastBeat(state)!.n).toBe(first + 1);
  });
});

describe('the war-cry', () => {
  function field(seed: string): {
    state: GameState;
    leader: Combatant;
    nearAlly: Combatant;
    farAlly: Combatant;
    nearFoe: Combatant;
    farFoe: Combatant;
  } {
    const state = fight(seed);
    const leader = ours(state).find((c) => isLeader(state, c))!;
    const others = ours(state).filter((c) => c !== leader);
    const [nearAlly, farAlly] = others as [Combatant, Combatant];
    const [nearFoe, farFoe] = foes(state) as [Combatant, Combatant];
    park(ours(state).slice(3));
    park(foes(state).slice(2));
    leader.rank = 1;
    nearAlly.rank = 2;
    farAlly.rank = 6;
    nearFoe.rank = 1;
    farFoe.rank = 9;
    arrange(state, leader);
    for (const x of [nearAlly, farAlly, nearFoe, farFoe]) {
      x.broken = false;
      x.down = false;
      x.fled = false;
    }
    return { state, leader, nearAlly, farAlly, nearFoe, farFoe };
  }

  it('is the leader’s alone, and only before the action is spent', () => {
    const { state, leader, nearAlly } = field('cry-who');
    expect(canWarCry(state)).toBe(true);

    arrange(state, nearAlly);
    expect(canWarCry(state)).toBe(false);
    expect(apply(state, { type: 'B_WARCRY' })).toBe(state);

    arrange(state, leader);
    leader.hasActed = true;
    expect(canWarCry(state)).toBe(false);
  });

  it('puts heart into friends in earshot, capped at where they started', () => {
    const { state, leader, nearAlly, farAlly } = field('cry-heart');
    const full = startingNerve(state, nearAlly.personId);
    nearAlly.nerve = full - 20;
    const farBefore = (farAlly.nerve = full - 20);
    leader.nerve = full - 2;

    expect(doWarCry(state)).toBe(true);
    expect(nearAlly.nerve).toBe(full - 20 + WARCRY_HEART);
    // The cry does not carry past its range.
    expect(farAlly.nerve).toBe(farBefore);
    // The crier hears it too, but nobody rises past their own high-water mark.
    expect(leader.nerve).toBe(startingNerve(state, leader.personId));
  });

  it('puts dread into foes in earshot and spends the fight’s one cry', () => {
    const { state, leader, nearFoe, farFoe } = field('cry-dread');
    const nearBefore = nearFoe.nerve;
    const farBefore = farFoe.nerve;

    expect(doWarCry(state)).toBe(true);
    expect(nearFoe.broken || nearFoe.nerve < nearBefore).toBe(true);
    expect(farFoe.nerve).toBe(farBefore);
    expect(state.battle!.warCried).toBe(true);
    expect(leader.hasActed).toBe(true);

    // Once a fight means once.
    leader.hasActed = false;
    expect(canWarCry(state)).toBe(false);
    expect(doWarCry(state)).toBe(false);
  });

  it('carries exactly WARCRY_RANGE hexes', () => {
    // The fixture leans on the constant staying at 2; if this fails, the
    // positions above need re-drawing, not just the number changing.
    expect(WARCRY_RANGE).toBe(2);
  });
});
