// The headless runner: seed and actions in, state and a hash out.
//
// What is being tested is not really "does it play" — `apply` has had
// coverage since 2.1. It is the two properties a cross-implementation diff
// stands on, and both of them are easy to get subtly wrong in a way nothing
// notices until the diff is reporting differences that are not there:
//
//   - the hash sees everything that MATTERS and nothing that does not, and
//   - the canonical form does not depend on anything a second language is
//     free to do differently (key order, how it prints a double).
//
// Plus replay fidelity, which is the whole product: the same script twice is
// the same saga, or a recorded run is worth nothing.

import { describe, it, expect } from 'vitest';
import exampleText from '../runs/example.json?raw';
import { canonical, hashOf, play, stateHash, worldHash, type Script } from '../src/run/headless';
import { newGame } from '../src/state/create';
import type { Action } from '../src/sim/actions';

const CAMP: Action = { type: 'CAMP' };
const script = (seed: string, n: number): Script => ({
  seed,
  actions: Array.from({ length: n }, () => CAMP),
});

describe('canonical form', () => {
  it('does not care what order the keys were written in', () => {
    // The one that matters most. JavaScript keeps insertion order and another
    // language's map will not, so a hash over the natural order would report
    // a difference between two identical states.
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
    expect(canonical({ x: { p: 1, q: 2 } })).toBe(canonical({ x: { q: 2, p: 1 } }));
  });

  it('does care what order an ARRAY was written in', () => {
    // Order is meaning in a turn order, a saga, a build queue.
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
  });

  it('writes numbers explicitly rather than however the runtime likes', () => {
    expect(canonical(3)).toBe('3');
    expect(canonical(-0)).toBe('0');
    expect(canonical(0.1 + 0.2)).toBe(canonical(0.30000000000000004));
    // 15 significant digits, so two languages agree on the text without
    // having to agree on shortest-round-trip printing.
    expect(canonical(1 / 3)).toBe((1 / 3).toPrecision(15));
    expect(canonical(Infinity)).toBe('inf');
    expect(canonical(NaN)).toBe('nan');
  });

  it('treats an absent field and an undefined one alike', () => {
    // `JSON.stringify` drops undefined members, and a port reading the same
    // save would simply not have the key. They must not hash differently.
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });
});

describe('the hash', () => {
  it('is sixteen hex digits', () => {
    expect(hashOf({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when anything in the state changes', () => {
    const a = structuredClone(newGame('hash-a'));
    const b = structuredClone(newGame('hash-a'));
    expect(stateHash(a)).toBe(stateHash(b));
    b.party.food += 1;
    expect(stateHash(b)).not.toBe(stateHash(a));
  });

  it('ignores the saga, which is prose', () => {
    // A hash that moved when a sentence was reworded would cry wolf on every
    // content edit until nobody looked at it. The run is what is hashed.
    const a = structuredClone(newGame('hash-saga'));
    const before = stateHash(a);
    a.saga.push({ day: 1, text: 'Reworded later, meaning nothing.', tone: 'plain' });
    expect(stateHash(a)).toBe(before);
  });

  it('separates the world from the run', () => {
    const played = play(script('hash-world', 6));
    const fresh = structuredClone(newGame('hash-world'));
    // Days passed and stores moved, but the country did not.
    expect(played.worldHash).toBe(worldHash(fresh));
    expect(played.hash).not.toBe(stateHash(fresh));
  });

  it('gives different seeds different worlds', () => {
    expect(play(script('seed-one', 0)).worldHash).not.toBe(play(script('seed-two', 0)).worldHash);
  });
});

describe('replay', () => {
  it('is the same saga twice', () => {
    const a = play(script('replay', 30));
    const b = play(script('replay', 30));
    expect(b.hash).toBe(a.hash);
    expect(b.day).toBe(a.day);
    expect(b.applied).toBe(a.applied);
  });

  it('reproduces a recorded run exactly, refusing nothing', () => {
    // The committed example, replayed. A refusal here means the sim now
    // offers different choices than it did when this was recorded — which
    // is a real finding about a rules change, not a broken test.
    const recorded = JSON.parse(exampleText) as Script;
    const result = play(recorded);
    expect(result.refused, `first refused action was #${result.refused[0]}`).toEqual([]);
    expect(result.applied).toBe(recorded.actions.length);
    expect(result.day).toBeGreaterThan(1);
  });

  it('records WHERE a script first went wrong rather than throwing', () => {
    // A script recorded against a different game is the normal case for a
    // repro file that has aged, and the useful answer is how far it got.
    const bad: Script = {
      seed: 'refusals',
      // Battle actions on the road are refused by the mode gate, every time.
      actions: [CAMP, { type: 'B_END_TURN' }, CAMP, { type: 'B_LEAVE' }],
    };
    const result = play(bad);
    expect(result.refused).toEqual([1, 3]);
    expect(result.applied).toBe(2);
  });

  it('plays the terms it is told to', () => {
    const even = play({ seed: 'terms', hardship: 'even', actions: [] });
    const fair = play({ seed: 'terms', hardship: 'fair', actions: [] });
    // Same seed, same country — the hardship changes the band's terms, not
    // the ground they landed on.
    expect(fair.worldHash).toBe(even.worldHash);
    expect(fair.hash).not.toBe(even.hash);
  });
});
