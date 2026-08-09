// Kin: who is whose, and what it costs to lose them.
//
// Built on a premise that audit item 8 later demolished. The deaths-by-fate
// table said despair ended more runs than hunger, cold and steel together —
// and it was a labelling artifact: twenty-eight of thirty despair endings
// had an empty larder, so most of them were hunger under another name.
// Endings tell the truth about that now (see `src/sim/upkeep.ts`), and
// despair is a rare death rather than the commonest one.
//
// The system survives its own premise, which is worth saying plainly rather
// than quietly leaving the old claim at the top of the file. A death that
// reshapes the survivors is better than a death that moves a number,
// whether or not grief is what finally ends the run — and it is still the
// only thing in the game that makes one person's loss land harder on
// another. What it is NOT is the answer to the death table.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { makeWarband } from '../src/sim/people';
import { stream } from '../src/rng';
import { MEN, WOMEN } from '../src/data/names';
import { ELDER_TIES, GENERATION, KIN_GRIEF, PEER_TIES } from '../src/data/kin';
import { bindKin, isWoman, kinOf, kinPairs, mourn } from '../src/sim/kin';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { encode } from '../src/state/save';
import type { GameState, Person } from '../src/state/types';

describe('the ground isWoman stands on', () => {
  it('the two name pools never overlap', () => {
    // isWoman() reads a person's gender off which pool their name came from,
    // which is only sound while the pools are disjoint. makePerson decides
    // this and throws it away, so the name is the only record there is.
    const shared = MEN.filter((n) => WOMEN.includes(n));
    expect(shared, `names in both pools: ${shared.join(', ')}`).toHaveLength(0);
  });

  it('reads every name in either pool', () => {
    for (const name of WOMEN) expect(isWoman({ name } as Person), name).toBe(true);
    for (const name of MEN) expect(isWoman({ name } as Person), name).toBe(false);
  });
});

describe('who came off the knarr together', () => {
  it('a new band has people in it, bound both ways', () => {
    const state = newGame('kin-new');
    const pairs = kinPairs(state.party.people);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs) {
      // Symmetric, and each side has its own word for the tie.
      expect(a.kin?.id).toBe(b.id);
      expect(b.kin?.id).toBe(a.id);
      expect(a.kin?.tie.length).toBeGreaterThan(2);
      expect(b.kin?.tie.length).toBeGreaterThan(2);
    }
  });

  it('nobody is their own kin, and nobody is bound twice', () => {
    for (const seed of ['kin-a', 'kin-b', 'kin-c', 'kin-d', 'kin-e']) {
      const people = makeWarband(stream(seed, 'party'));
      const bound = people.filter((p) => p.kin);
      const ids = bound.map((p) => p.kin!.id);
      for (const person of bound) {
        expect(person.kin!.id).not.toBe(person.id);
        // Each id claimed exactly once: a triangle would mean somebody's
        // partner does not point back at them.
        expect(ids.filter((id) => id === person.kin!.id)).toHaveLength(1);
        expect(kinOf(people, person)).toBeTruthy();
      }
    }
  });

  it('the tie fits the two people it is between', () => {
    // Across many bands: a parent word only ever appears across a real
    // generation, and the gendered words match who they are on.
    const elderWords = new Set(Object.values(ELDER_TIES).flat());
    const women = new Set(['sister', 'wife', 'mother', 'daughter']);
    const men = new Set(['brother', 'oath-brother', 'husband', 'father', 'son']);

    for (let i = 0; i < 40; i += 1) {
      const people = makeWarband(stream(`fit-${i}`, 'party'));
      for (const [a, b] of kinPairs(people)) {
        for (const [self, other] of [[a, b], [b, a]] as const) {
          const word = self.kin!.tie;
          if (women.has(word)) expect(isWoman(self), `${word} on a man`).toBe(true);
          if (men.has(word)) expect(isWoman(self), `${word} on a woman`).toBe(false);
          if (elderWords.has(word)) {
            expect(Math.abs(a.age - b.age), `${word} across ${Math.abs(a.age - b.age)} years`)
              .toBeGreaterThanOrEqual(GENERATION);
          }
          void other;
        }
      }
    }
  });

  it('every word in the tables is one the checks above know about', () => {
    const all = [
      ...Object.values(PEER_TIES).flat().flat(),
      ...Object.values(ELDER_TIES).flat(),
    ];
    const known = new Set([
      'brother', 'sister', 'oath-brother', 'cousin',
      'husband', 'wife', 'father', 'mother', 'son', 'daughter',
    ]);
    for (const word of all) expect(known.has(word), `unknown tie "${word}"`).toBe(true);
  });
});

describe('grief has a name now', () => {
  function bandOfTwo(seed: string): GameState {
    const state = structuredClone(newGame(seed));
    // Force a known pair so the test is about mourning, not about rolls.
    const [a, b] = state.party.people as [Person, Person];
    state.party.people.forEach((p) => {
      delete p.kin;
    });
    bindKin([a, b], stream(seed, 'party'), 1);
    return state;
  }

  it('losing your kin takes a third of your heart, and says why', () => {
    const state = bandOfTwo('kin-grief');
    const [a, b] = state.party.people as [Person, Person];
    b.morale = 80;
    a.alive = false;

    mourn(state, a);
    expect(b.morale).toBe(80 - KIN_GRIEF);
    const line = state.saga.at(-1)!.text;
    expect(line).toContain(b.name);
    expect(line).toContain(a.name);
    expect(line).toContain(b.kin!.tie);
  });

  it('mourning a stranger costs nobody anything', () => {
    const state = bandOfTwo('kin-stranger');
    const loner = state.party.people[3]!;
    expect(loner.kin).toBeUndefined();
    const before = state.party.people.map((p) => p.morale);
    mourn(state, loner);
    expect(state.party.people.map((p) => p.morale)).toEqual(before);
  });

  it('the dead do not mourn the dead', () => {
    const state = bandOfTwo('kin-both');
    const [a, b] = state.party.people as [Person, Person];
    b.alive = false;
    b.morale = 50;
    mourn(state, a);
    expect(b.morale).toBe(50);
  });

  it('grief cannot push anyone below nothing', () => {
    const state = bandOfTwo('kin-floor');
    const [a, b] = state.party.people as [Person, Person];
    b.morale = 5;
    mourn(state, a);
    expect(b.morale).toBe(0);
  });
});

describe('old saves', () => {
  it('a band from before this comes forward as strangers', () => {
    // Inventing families retroactively would rewrite a run's history.
    const old = JSON.parse(encode(newGame('kin-old'))) as Record<string, unknown>;
    old['version'] = 25;
    const party = old['party'] as { people: Person[] };
    party.people.forEach((p) => {
      delete p.kin;
    });
    const { save } = migrate(old);
    expect(save['version']).toBe(SAVE_VERSION);
    const back = (save['party'] as { people: Person[] }).people;
    expect(back.every((p) => p.kin === undefined)).toBe(true);
  });
});
