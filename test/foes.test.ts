// Who turns up, and whether adding one costs an engine edit.
//
// Four archetypes carried the whole combat game — against shield walls,
// nerve, zone-of-control and five actions, which is a rich system fed by very
// little. Four more is content; the interesting part is that it COULD not be
// content until `weightFor` stopped naming ids.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { FOE_ARCHETYPES, archetypeById } from '../src/data/foes';
import { weightFor } from '../src/sim/word';
import { makeRng } from '../src/rng';

describe('the coast has more than four kinds of man on it', () => {
  it('has every archetype rollable and distinct', () => {
    expect(FOE_ARCHETYPES.length).toBeGreaterThanOrEqual(8);
    const ids = FOE_ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of FOE_ARCHETYPES) {
      expect(archetypeById(a.id)).toBe(a);
      expect(a.weight, `${a.id} can never be drawn`).toBeGreaterThan(0);
      expect(a.budget, `${a.id} has no stats`).toBeGreaterThan(0);
      expect(a.favours.length, `${a.id} favours nothing`).toBeGreaterThan(0);
      expect(a.throws).toBeGreaterThanOrEqual(0);
    }
  });

  it('makes different FIGHTS, not different stat lines', () => {
    // The point of the four added: a volley before contact, numbers against a
    // wall, one man who must be dealt with, and somebody who will not stand
    // still. If these collapse into each other the variety is cosmetic.
    const byTemper = new Set(FOE_ARCHETYPES.map((a) => a.temperament));
    expect(byTemper.size).toBe(3);
    // Somebody throws a real volley, and somebody throws nothing.
    expect(Math.max(...FOE_ARCHETYPES.map((a) => a.throws))).toBeGreaterThanOrEqual(3);
    expect(FOE_ARCHETYPES.some((a) => a.throws === 0)).toBe(true);
    // A spread from cheap bodies to one worth fearing.
    const budgets = FOE_ARCHETYPES.map((a) => a.budget);
    expect(Math.max(...budgets) - Math.min(...budgets)).toBeGreaterThanOrEqual(6);
  });
});

describe('word changes who comes, and it is data that says so', () => {
  it('brings the heavy ones and thins the levies', () => {
    const huscarl = archetypeById('huscarl')!;
    const bondi = archetypeById('bondi')!;
    expect(weightFor(huscarl, 3)).toBeGreaterThan(weightFor(huscarl, 0));
    expect(weightFor(bondi, 3)).toBeLessThan(weightFor(bondi, 0));
  });

  it('never asks the weighted pick for a number it cannot draw', () => {
    // A negative weight is not "rare"; it is a pick reaching for something
    // that does not exist. The levies thin to nothing and stop there.
    for (const a of FOE_ARCHETYPES) {
      for (const word of [0, 1, 2, 5, 10, 40]) {
        expect(weightFor(a, word), `${a.id} at word ${word}`).toBeGreaterThanOrEqual(0);
      }
    }
    // And something is always drawable, or a fight cannot be rolled at all.
    for (const word of [0, 1, 5, 40]) {
      const total = FOE_ARCHETYPES.reduce((sum, a) => sum + weightFor(a, word), 0);
      expect(total, `nothing can be rolled at word ${word}`).toBeGreaterThan(0);
    }
  });

  it('holds the same reputation curve the hardcoded version had', () => {
    // The two ids that used to be named in `word.ts`, with the numbers they
    // were named with — so this refactor moved the rule and did not change it.
    expect(weightFor(archetypeById('huscarl')!, 4)).toBe(5 + 4 * 3);
    expect(weightFor(archetypeById('raider')!, 4)).toBe(12 + 4 * 1);
    expect(weightFor(archetypeById('scout')!, 4)).toBe(10);
  });

  /**
   * THE RULE THIS PROJECT HAS HELD SINCE THE START, ENFORCED.
   *
   * CLAUDE.md: "adding content must never require touching engine code."
   * `weightFor` broke it quietly — `if (archetype.id === 'huscarl')` — so a
   * new foe could not respond to reputation without an engine edit. Naming an
   * archetype id anywhere in `src/sim` is that bug coming back.
   */
  it('names no archetype id anywhere in the engine', () => {
    const ids = FOE_ARCHETYPES.map((a) => a.id);
    const offenders: string[] = [];
    for (const file of readdirSync('src/sim')) {
      if (!file.endsWith('.ts')) continue;
      // Comments stripped first. The rule is about what the engine DOES, not
      // about prose explaining why it no longer does it — the note in word.ts
      // recording the old `if (archetype.id === 'huscarl')` tripped this on
      // its first run, which is the instrument being wrong rather than the
      // code.
      const text = readFileSync(`src/sim/${file}`, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const id of ids) {
        if (text.includes(`'${id}'`)) offenders.push(`src/sim/${file} names '${id}'`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the roll', () => {
  it('reaches every archetype over enough fights', () => {
    // A weight so small nothing ever draws it is content that does not exist.
    const rng = makeRng('foe-spread');
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      seen.add(rng.weighted(FOE_ARCHETYPES, (a) => weightFor(a, 2)).id);
    }
    for (const a of FOE_ARCHETYPES) {
      expect(seen.has(a.id), `${a.id} never came up in 4000 rolls`).toBe(true);
    }
  });

  it('shifts the mix as a band becomes known', () => {
    // The whole point of renown: a quiet coast sends its farmers, a famous
    // one sends its household men.
    const count = (word: number, id: string): number => {
      const rng = makeRng(`mix-${word}`);
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        if (rng.weighted(FOE_ARCHETYPES, (a) => weightFor(a, word)).id === id) n++;
      }
      return n;
    };
    expect(count(6, 'huscarl')).toBeGreaterThan(count(0, 'huscarl') * 2);
    expect(count(6, 'bondi')).toBeLessThan(count(0, 'bondi'));
  });
});
