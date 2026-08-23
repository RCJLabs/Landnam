// The one enemy the player makes on purpose.
//
// Every other hostile thing is dealt out by the world. An outlaw was one of
// the six who came off the knarr, and he is in the country because of a
// judgement the player made at a feud card. The court already had three
// answers — pay the wergild, argue it out, tell them to get back to work —
// and this is the fourth: certain, permanent, and expensive in the one
// currency a band of six cannot spare.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { FEUD_CHOICES, OUTLAW_LIE_LOW, OUTLAW_MORALE } from '../src/data/feuds';
import { presentFeud, settleFeud } from '../src/sim/minds';
import { STRIKE_ODDS, STRIKE_REST, driveOut, maybeOutlawStrike, outlaws } from '../src/sim/outlaw';
import { living } from '../src/sim/people';
import type { GameState, Grudge } from '../src/state/types';

/** A band with a ripe quarrel between its first two people. */
function quarrel(seed = 'outlaw'): { state: GameState; grudge: Grudge } {
  const state = newGame(seed);
  const [a, b] = state.party.people;
  const grudge: Grudge = {
    a: a!.id,
    b: b!.id,
    cause: 'They fell out over nothing anybody could name afterwards.',
    weight: 12,
    since: 1,
  };
  state.grudges.push(grudge);
  return { state, grudge };
}

describe('the court has a fourth answer', () => {
  it('offers outlawry, and NAMES the man it would drive out', () => {
    const { state, grudge } = quarrel();
    expect(presentFeud(state, grudge)).toBe(true);
    const labels = state.event!.choices!.map((c) => c.label);
    const a = state.party.people[0]!;
    const outlawry = labels.find((l) => l.includes('outlaw'));
    expect(outlawry).toBeDefined();
    // A judgement this heavy must not be a generic label the player reads
    // afterwards and finds they picked somebody they did not mean to.
    expect(outlawry).toContain(a.name);
    expect(outlawry).not.toContain('{A}');
  });

  it('costs a hand, settles the quarrel for good, and is felt', () => {
    const { state, grudge } = quarrel();
    presentFeud(state, grudge);
    const before = living(state.party.people).length;
    const morale = state.party.morale;
    const index = FEUD_CHOICES.findIndex((c) => c.kind === 'banish');

    const out = settleFeud(state, index);
    expect(out.good).toBe(true);
    // The band is smaller. In a band of six that is the dearest thing there
    // is, which is what makes this a decision against paying food.
    expect(living(state.party.people).length).toBe(before - 1);
    expect(grudge.settled).toBe(true);
    expect(state.party.morale).toBe(Math.max(0, morale - OUTLAW_MORALE));
  });

  it('leaves him alive and OUT there, not buried', () => {
    const { state } = quarrel();
    const person = state.party.people[0]!;
    driveOut(state, person);
    // `left`, not dead: upkeep stops feeding him and the saga does not bury
    // somebody who is walking around.
    expect(person.alive).toBe(false);
    expect(person.left).toBe(true);
    expect(outlaws(state)).toHaveLength(1);
    expect(outlaws(state)[0]!.name).toBe(person.name);
    expect(outlaws(state)[0]!.since).toBe(state.day);
  });
});

describe('the judgements keep their order', () => {
  it('appends, because recorded runs replay CHOOSE by index', () => {
    // Found the hard way: the first cut of outlawry sat third in the list and
    // pushed "get back to work" to fourth, which silently rewrote every
    // recorded run in runs/*.json — a saga that told two men to go back to
    // work would have driven one of them out instead. `settleFeud` takes an
    // INDEX, so the order of this array is a contract with the past.
    expect(FEUD_CHOICES.map((c) => c.kind)).toEqual([
      'wergild', 'thing', 'ignore', 'banish',
    ]);
  });
});

describe('he is still in the country', () => {
  it('keeps his head down at first', () => {
    const { state } = quarrel();
    driveOut(state, state.party.people[0]!);
    let struck = false;
    for (let d = 0; d < OUTLAW_LIE_LOW; d++) {
      state.day = state.day + 1;
      if (maybeOutlawStrike(state)) struck = true;
    }
    // Driving a man out must not summon an ambush the same week — the player
    // has to be allowed to think the decision worked.
    expect(struck).toBe(false);
  });

  it('comes back eventually, and then rests', () => {
    const { state } = quarrel();
    driveOut(state, state.party.people[0]!);
    let first = 0;
    for (let d = 0; d < 3000 && first === 0; d++) {
      state.day += 1;
      if (state.battle) state.battle = undefined;
      if (maybeOutlawStrike(state)) first = state.day;
    }
    expect(first).toBeGreaterThan(OUTLAW_LIE_LOW);

    // And having tried once, he is not waiting round the next corner.
    let again = 0;
    for (let d = 0; d < STRIKE_REST - 2 && again === 0; d++) {
      state.day += 1;
      if (state.battle) state.battle = undefined;
      if (maybeOutlawStrike(state)) again = state.day;
    }
    expect(again).toBe(0);
  });

  it('never interrupts a card, a fight, or a day at sea', () => {
    const { state } = quarrel();
    driveOut(state, state.party.people[0]!);
    state.day += OUTLAW_LIE_LOW + 5;

    state.event = { id: 'x', title: 't', body: 'b', choices: [] };
    expect(maybeOutlawStrike(state)).toBe(false);
    state.event = undefined;

    // Afloat: a man on foot cannot reach a hull under way, and it is the one
    // place the band could not run.
    for (const k of Object.keys(state.world.tiles)) {
      if (state.world.tiles[k]!.terrain !== 'ocean') continue;
      const [q, r] = k.split(',').map(Number);
      state.party.at = { q: q!, r: r! };
      break;
    }
    expect(maybeOutlawStrike(state)).toBe(false);
  });
});

describe('how much danger the judgement actually buys', () => {
  it('measures the rate, and that more outlaws is more danger', () => {
    const rate = (howMany: number): number => {
      let strikes = 0;
      const runs = 30;
      for (let s = 0; s < runs; s++) {
        const state = newGame(`outlaw-rate:${s}`);
        for (let i = 0; i < howMany; i++) driveOut(state, state.party.people[i]!);
        for (let d = 0; d < 365; d++) {
          state.day += 1;
          if (state.battle) state.battle = undefined;
          if (maybeOutlawStrike(state)) strikes++;
        }
      }
      return strikes / runs;
    };

    const one = rate(1);
    const three = rate(3);
    console.log(`outlaws coming back, over a year:`);
    console.log(`  one driven out  : ${one.toFixed(2)} fights a year`);
    console.log(`  three driven out: ${three.toFixed(2)} fights a year`);

    // A judgement that costs a hand and never comes back to bite is a free
    // lunch; one that ambushes monthly is a punishment.
    expect(one).toBeGreaterThan(0.5);
    expect(one).toBeLessThan(6);
    // And the faction the player built is bigger than one man.
    expect(three).toBeGreaterThan(one);
    expect(STRIKE_ODDS).toBeGreaterThan(0);
    expect(STRIKE_REST).toBeGreaterThan(0);
  });
});
