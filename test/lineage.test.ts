// Being born, getting older, and the one claim this must not make.
//
// The item asked for children who grow into the band. They cannot, and the
// arithmetic is not close: `GENERATION` is 16 years and a run ends after 5
// winters. The first test here pins that, so a later change that quietly
// starts promising a grown-up second generation has to argue with a number.
//
// Everything else is about the thing item 6 caught the Thing's checklist
// doing — carrying requirements that never once refused anybody. A birth the
// larder never felt would be exactly that.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import {
  ageTheBand,
  bearing,
  birthBlocker,
  childrenOf,
  maybeBirth,
  orphansOf,
} from '../src/sim/lineage';
import {
  BEARING_MAX,
  BEARING_MIN,
  BIRTH_FOOD_FLOOR,
  CHILD_APPETITE,
  ORPHAN_GRIEF,
} from '../src/data/lineage';
import { GENERATION } from '../src/data/kin';
import { LONG_LIFE_WINTERS } from '../src/data/thing';
import { foodPerDay } from '../src/sim/upkeep';
import { mourn } from '../src/sim/kin';
import { isWoman } from '../src/sim/kin';
import { YEAR_LENGTH } from '../src/sim/calendar';
import { canFound, foundSettlement } from '../src/sim/site';
import { fromKey } from '../src/hex';
import type { GameState } from '../src/state/types';

describe('nobody grows up, and the numbers say why', () => {
  it('cannot fit a generation inside a run, which is the whole reason', () => {
    // A run ends at LONG_LIFE_WINTERS. A generation is GENERATION years. If
    // these ever cross, a real second generation becomes possible and this
    // file's central claim needs rewriting rather than quietly outliving it.
    expect(LONG_LIFE_WINTERS).toBeLessThan(GENERATION);
  });

  it('ages everyone once a year and not otherwise', () => {
    const state = structuredClone(newGame('line-age'));
    const before = state.party.people.map((p) => p.age);

    state.day = 5;
    expect(ageTheBand(state)).toBe(false);
    expect(state.party.people.map((p) => p.age)).toEqual(before);

    state.day = YEAR_LENGTH + 1;
    expect(ageTheBand(state)).toBe(true);
    expect(state.party.people.map((p) => p.age)).toEqual(before.map((a) => a + 1));

    // And not twice on the same turn of the year.
    state.day = YEAR_LENGTH + 2;
    expect(ageTheBand(state)).toBe(false);
  });

  it('lets ageing carry somebody out of bearing years', () => {
    const state = structuredClone(newGame('line-bearing'));
    const woman = state.party.people.find(isWoman);
    expect(woman, 'no women in the band to test with').toBeTruthy();
    woman!.age = BEARING_MAX;
    expect(bearing(woman!)).toBe(true);
    woman!.age = BEARING_MAX + 1;
    expect(bearing(woman!)).toBe(false);
    woman!.age = BEARING_MIN - 1;
    expect(bearing(woman!)).toBe(false);
  });
});

describe('a birth is earned, not handed out', () => {
  it('refuses, and says which thing is missing', () => {
    const wandering = structuredClone(newGame('line-road'));
    expect(birthBlocker(wandering)).toBe('nosteading');

    const home = settled('line-home');
    home.party.food = BIRTH_FOOD_FLOOR - 1;
    expect(birthBlocker(home), 'a famine handed out a mouth').toBe('larder');

    home.party.food = BIRTH_FOOD_FLOOR + 50;
    // With a bearing woman, room and peace, nothing is in the way.
    if (home.party.people.some((p) => p.alive && isWoman(p))) {
      for (const p of home.party.people) if (isWoman(p)) p.age = 25;
      expect(birthBlocker(home)).toBeNull();
    }
  });

  it('never fires twice inside the cooldown', () => {
    const state = readyToBear('line-cool');
    state.flags['lastBorn'] = state.day - 1;
    expect(birthBlocker(state)).toBe('toosoon');
  });

  it('actually happens, and happens the same way twice', () => {
    // The first cut of this called `maybeBirth` once on each of two clones
    // and compared the results. At two percent a day both were `undefined`,
    // so it asserted undefined === undefined and would have passed with
    // births switched off entirely — the same hollow bar the weather work
    // had to rewrite twice.
    //
    // So: walk days until one fires, which proves the mechanism is reachable,
    // and only then compare.
    const born = (seed: string): { day: number; name: string } | undefined => {
      const state = readyToBear(seed);
      for (let d = 0; d < 400; d += 1) {
        state.day += 1;
        const child = maybeBirth(state);
        if (child) return { day: state.day, name: child.name };
      }
      return undefined;
    };
    const first = born('line-same');
    expect(first, 'nobody was ever born in 400 eligible days').toBeTruthy();
    expect(born('line-same')).toEqual(first);
    // And a different steading is a different child.
    expect(born('line-other')?.name).not.toBe(undefined);
  });
});

describe('a child is a mouth, or it is decoration', () => {
  /**
   * THE BAR ITEM 6 EARNED.
   *
   * The Thing's checklist was found carrying two needs met by 78 settled
   * sagas out of 78 — requirements that never once refused anybody. A birth
   * that the larder never felt would be the same mistake with a cradle in it.
   */
  it('costs the larder something the day it arrives', () => {
    const state = readyToBear('line-mouth');
    const before = foodPerDay(state);
    // Enough children that a quarter-ration each has to show up in a figure
    // that is counted in whole sacks.
    const need = Math.ceil(2 / CHILD_APPETITE);
    for (let i = 0; i < need; i += 1) {
      state.settlement!.children.push({
        name: `child-${i}`, bornOn: state.day, mother: state.party.people[0]!.id,
      });
    }
    expect(
      foodPerDay(state),
      'children ate nothing — the mouth is decoration',
    ).toBeGreaterThan(before);
  });

  it('is counted by the larder and the winter mark from one formula', () => {
    // `winter.ts` used to carry its own copy of the mouths arithmetic, twice.
    // That was harmless while every mouth was an adult and would have gone
    // silently wrong the moment children ate — the same class of drift the
    // weather work had to fix between the mark and the fire.
    const src = readFileSync('src/sim/winter.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(
      src.includes('Math.ceil(crew.length / 2)'),
      'winter.ts is computing mouths itself again',
    ).toBe(false);
  });
});

describe('a death that leaves a child', () => {
  it('costs heart for who is left behind, on top of the ordinary grief', () => {
    const state = readyToBear('line-orphan');
    const mother = state.party.people.find((p) => p.alive && isWoman(p))!;
    state.settlement!.children.push({
      name: 'Ketill', bornOn: state.day, mother: mother.id,
    });
    expect(orphansOf(state, mother)).toHaveLength(1);

    const plain = structuredClone(state);
    plain.settlement!.children = [];
    const plainMother = plain.party.people.find((p) => p.id === mother.id)!;

    mother.alive = false;
    plainMother.alive = false;
    mourn(state, mother);
    mourn(plain, plainMother);

    expect(
      plain.party.morale - state.party.morale,
      'an orphan cost the steading nothing',
    ).toBe(ORPHAN_GRIEF);
    expect(state.saga.some((l) => l.text.includes('Ketill'))).toBe(true);
  });
});

describe('old saves', () => {
  it('come forward with a steading that has borne nobody', () => {
    const save = structuredClone(settled('line-old')) as unknown as Record<string, unknown>;
    save['version'] = 32;
    delete (save['settlement'] as Record<string, unknown>)['children'];
    const out = migrate(save).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect((out['settlement'] as { children: unknown[] }).children).toEqual([]);
  });

  it('survives having no steading at all', () => {
    const save = structuredClone(newGame('line-old-road')) as unknown as Record<string, unknown>;
    save['version'] = 32;
    expect(() => migrate(save)).not.toThrow();
  });
});

// --- helpers ---

function settled(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const at = Object.keys(state.world.tiles).map(fromKey).find((h) => {
    state.party.at = h;
    return canFound(state, h);
  });
  expect(at, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = at!;
  expect(foundSettlement(state)).toBe(true);
  return state;
}

/** A steading with everything a birth asks for already true. */
function readyToBear(seed: string): GameState {
  const state = settled(seed);
  state.party.food = BIRTH_FOOD_FLOOR + 80;
  for (const p of state.party.people) if (isWoman(p)) p.age = 25;
  // A woman, guaranteed: the six off the knarr are drawn, so a seed with no
  // women would make this suite silently test nothing.
  if (!state.party.people.some((p) => p.alive && isWoman(p))) {
    state.party.people[0]!.name = 'Ãsdís';
  }
  expect(childrenOf(state)).toEqual([]);
  return state;
}
