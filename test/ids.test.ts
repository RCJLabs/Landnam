// Nobody may be two people.
//
// Everything in this game is keyed by `personId`: `fighterPerson` looks a
// combatant up by it, kin point at each other by it, grudges name two of
// them, jobs are given by it, and the memorial buries by it. A duplicate id
// is therefore not an untidiness, it is two people who are the same person
// as far as the game is concerned — and the symptoms are all somewhere else,
// which is what makes it worth a test of its own.
//
// It shipped. `makeWarband` hands the six who come off the knarr `p1`..`p6`
// and `newGame` set `nextId: 1`, so the first six people ever to join a band
// took their identities. It was unreachable until 2026-08-08 made growth
// actually happen, and silent afterwards: found on 2026-08-11 by a recorder
// bot that assigned `farmer` to the same person 19,717 times and could not
// work out why it never took.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { makePerson } from '../src/sim/people';
import { stream } from '../src/rng';

describe('the id counter', () => {
  it('starts past the people who are already here', () => {
    const state = structuredClone(newGame('ids'));
    const highest = Math.max(
      ...state.party.people.map((p) => Number(/^p(\d+)$/.exec(p.id)?.[1] ?? 0)),
    );
    expect(state.nextId).toBeGreaterThan(highest);
  });

  it('so the first joiner is nobody who is already here', () => {
    const state = structuredClone(newGame('ids-join'));
    const joiner = makePerson(stream('ids-join', 'party').derive('x'), `p${state.nextId}`, 'hand');
    expect(state.party.people.map((p) => p.id)).not.toContain(joiner.id);
  });

  it('and every founder is distinct to begin with', () => {
    const ids = structuredClone(newGame('ids-founders')).party.people.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('repairing a save that already carries a twin', () => {
  /** A v30 save with the exact damage the old counter did. */
  function damaged(): Record<string, unknown> {
    return {
      version: 30,
      nextId: 2,
      grudges: [{ a: 'p1', b: 'p2', weight: 3, cause: 'words', since: 4 }],
      party: {
        people: [
          { id: 'p1', name: 'Ketil', alive: true, kin: { id: 'p2', tie: 'brother' } },
          { id: 'p2', name: 'Bersi', alive: true, kin: { id: 'p1', tie: 'brother' } },
          // The joiner that took the leader's id.
          { id: 'p1', name: 'Astrid', alive: true },
        ],
      },
      battle: {
        combatants: [{ personId: 'p1' }, { personId: 'p2' }, { personId: 'p1' }],
        order: ['p1', 'p2', 'p1'],
        champion: 'p1',
      },
    };
  }

  it('gives the later twin a name of their own', () => {
    const { save } = migrate(damaged());
    const people = (save['party'] as { people: Record<string, unknown>[] }).people;
    const ids = people.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    // The FIRST holder keeps the id: they were here first, and the saga has
    // been telling their story under it.
    expect(ids[0]).toBe('p1');
    expect(ids[1]).toBe('p2');
    expect(ids[2]).not.toBe('p1');
  });

  it('and moves NOTHING else, because nothing ever pointed at them', () => {
    // The instructive one. Rewriting references alongside the rename looks
    // thorough and is wrong: every lookup in this game resolves an id with
    // `find`, so while the duplicate existed every reference to `p1` reached
    // the FOUNDER and none of them ever reached the twin. The first cut
    // carried them across and pointed a brother at the wrong brother.
    const { save } = migrate(damaged());
    expect(save['nextId']).toBeGreaterThan(3);
    const people = (save['party'] as { people: Record<string, unknown>[] }).people;
    expect(people[0]!.kin).toEqual({ id: 'p2', tie: 'brother' });
    expect(people[1]!.kin).toEqual({ id: 'p1', tie: 'brother' });
    expect(save['grudges']).toEqual([{ a: 'p1', b: 'p2', weight: 3, cause: 'words', since: 4 }]);
    const battle = save['battle'] as {
      combatants: { personId: string }[];
      order: string[];
      champion: string;
    };
    expect(battle.combatants.map((c) => c.personId)).toEqual(['p1', 'p2', 'p1']);
    expect(battle.order).toEqual(['p1', 'p2', 'p1']);
    expect(battle.champion).toBe('p1');
  });

  it('leaves an undamaged save alone but still pushes the counter clear', () => {
    const clean = {
      version: 30,
      nextId: 1,
      party: { people: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] },
    };
    const { save } = migrate(clean);
    const people = (save['party'] as { people: Record<string, unknown>[] }).people;
    expect(people.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    // The whole point: no FUTURE joiner can collide either.
    expect(save['nextId']).toBe(4);
    expect(save['version']).toBe(SAVE_VERSION);
  });

  it('survives a save with no people at all', () => {
    const { save } = migrate({ version: 30 });
    expect(save['version']).toBe(SAVE_VERSION);
  });
});
