// 4.1: moods, grudges and feuds. The roadmap sets no bar for Phase 4, so the
// two this file holds itself to are:
//   1. Feuds come out of pressure, not out of dice.
//   2. Settling one is measurably better than telling them to get back to work.
// Both are things a player would notice being false.

import { describe, it, expect } from 'vitest';
import { fromKey } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign } from '../src/sim/colony';
import { effectiveStat } from '../src/sim/people';
import { friction, temperOf, TRAITS } from '../src/data/traits';
import { BLOOD_THRESHOLD, FEUD_CHOICES, FEUD_THRESHOLD, WERGILD_FOOD } from '../src/data/feuds';
import {
  driftMoods,
  feudsComeDue,
  frictionBetween,
  grudgeBetween,
  malcontents,
  maybeFireFeud,
  moodOf,
  moodTarget,
  presentFeud,
  ripeFeud,
  settleFeud,
  stirGrudges,
} from '../src/sim/minds';
import type { GameState, Person } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];
const EASY = { hungry: false, cold: false, grieving: false };
const HARD = { hungry: true, cold: true, grieving: false };

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

function settled(seed: string, radius = 14): GameState {
  const state = fresh(seed);
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const landing = state.world.landing;
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    const gap =
      (Math.abs(at.q - landing.q) +
        Math.abs(at.r - landing.r) +
        Math.abs(at.q + at.r - landing.q - landing.r)) /
      2;
    if (gap > radius) continue;
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > bestScore) {
      bestScore = report.total;
      best = at;
    }
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  return state;
}

/** Two people guaranteed to grate: the tally-keeper and the berserk. */
function pairUp(state: GameState): [Person, Person] {
  const a = state.party.people[0]!;
  const b = state.party.people[1]!;
  a.trait = 'quarrelsome';
  b.trait = 'berserk';
  return [a, b];
}

// --- Moods ---

describe('moods follow what is actually happening', () => {
  it('a hungry cold band sours and a fed warm one does not', () => {
    const easy = fresh('mood-easy');
    const hard = fresh('mood-hard');
    for (let d = 0; d < 12; d++) {
      driftMoods(easy, EASY);
      driftMoods(hard, HARD);
    }
    const mean = (s: GameState) =>
      s.party.people.reduce((n, p) => n + p.morale, 0) / s.party.people.length;
    // eslint-disable-next-line no-console
    console.log(`twelve days — fed and warm: ${mean(easy).toFixed(0)}, hungry and cold: ${mean(hard).toFixed(0)}`);
    expect(mean(hard)).toBeLessThan(mean(easy) - 20);
    expect(malcontents(hard).length).toBeGreaterThan(malcontents(easy).length);
  });

  it('wounds and idleness weigh on a person', () => {
    const state = settled('mood-hurt');
    const person = state.party.people[0]!;
    const whole = moodTarget(state, person, EASY);

    person.injuries.push({ id: 'x', label: 'Bad leg', effect: { might: -1 }, heals: 10 });
    expect(moodTarget(state, person, EASY)).toBeLessThan(whole);

    person.injuries = [];
    const working = moodTarget(state, person, EASY);
    delete person.job;
    expect(moodTarget(state, person, EASY)).toBeLessThan(working);
  });

  it('the hardy ride it out and the volatile do not', () => {
    const state = fresh('mood-temper');
    const steady = state.party.people[0]!;
    const wild = state.party.people[1]!;
    steady.trait = 'steadfast';
    wild.trait = 'quarrelsome';
    steady.morale = 70;
    wild.morale = 70;
    for (let d = 0; d < 6; d++) driftMoods(state, HARD);
    expect(temperOf('steadfast')).toBeLessThan(temperOf('quarrelsome'));
    expect(steady.morale).toBeGreaterThan(wild.morale);
  });

  it('every mood has a word, and the words run the right way', () => {
    const person = fresh('mood-words').party.people[0]!;
    const words: string[] = [];
    for (const morale of [90, 60, 40, 25, 5]) {
      person.morale = morale;
      words.push(moodOf(person));
    }
    expect(words).toEqual(['content', 'steady', 'sullen', 'bitter', 'breaking']);
  });
});

// --- Where bad blood comes from ---

describe('feuds come out of pressure, not out of dice', () => {
  function run(seed: string, pressure: typeof EASY, days: number): GameState {
    const state = fresh(seed);
    pairUp(state);
    for (let d = 0; d < days; d++) {
      state.day = d + 1;
      driftMoods(state, pressure);
      stirGrudges(state, pressure);
    }
    return state;
  }

  it('a band that is fed and warm barely quarrels; a starving one does', () => {
    const SEEDS = Array.from({ length: 12 }, (_, i) => `feud-${i}`);
    let easyGrudges = 0;
    let hardGrudges = 0;
    let easyFeuds = 0;
    let hardFeuds = 0;

    for (const seed of SEEDS) {
      const easy = run(seed, EASY, 40);
      const hard = run(seed, HARD, 40);
      easyGrudges += easy.grudges.length;
      hardGrudges += hard.grudges.length;
      if (ripeFeud(easy)) easyFeuds++;
      if (ripeFeud(hard)) hardFeuds++;
    }

    // eslint-disable-next-line no-console
    console.log(
      `over ${SEEDS.length} bands, forty days — fed: ${easyGrudges} grudges, ${easyFeuds} ripened | ` +
        `starving: ${hardGrudges} grudges, ${hardFeuds} ripened`,
    );

    // If a comfortable band quarrelled as much as a starving one, a feud would
    // be an interruption rather than a consequence.
    expect(hardGrudges).toBeGreaterThan(easyGrudges);
    expect(hardFeuds).toBeGreaterThan(easyFeuds);
    expect(easyFeuds).toBeLessThan(SEEDS.length / 2);
  });

  it('it takes two who grate on each other', () => {
    const state = fresh('feud-traits');
    const [a, b] = pairUp(state);
    a.morale = 10;
    b.morale = 10;
    expect(frictionBetween(a, b)).toBeGreaterThan(0);

    // Same misery, two people who get on fine.
    a.trait = 'hardy';
    b.trait = 'healer';
    expect(friction('hardy', 'healer')).toBe(0);
    expect(frictionBetween(a, b)).toBe(0);
  });

  it('content people do not quarrel however different they are', () => {
    const state = fresh('feud-content');
    const [a, b] = pairUp(state);
    a.morale = 95;
    b.morale = 95;
    expect(frictionBetween(a, b)).toBe(0);
  });

  it('bad blood deepens on hard days and fades on easy ones', () => {
    const state = fresh('feud-drift');
    const [a, b] = pairUp(state);
    state.grudges.push({ a: a.id, b: b.id, weight: 8, cause: 'x', since: 1 });
    const grudge = state.grudges[0]!;

    stirGrudges(state, HARD);
    const afterHard = grudge.weight;
    expect(afterHard).toBeGreaterThan(8);

    for (let d = 0; d < 5; d++) stirGrudges(state, EASY);
    expect(grudge.weight).toBeLessThan(afterHard);
  });

  it('a quarrel ends when one of them does', () => {
    const state = fresh('feud-dead');
    const [a, b] = pairUp(state);
    state.grudges.push({ a: a.id, b: b.id, weight: 12, cause: 'x', since: 1 });
    b.alive = false;
    stirGrudges(state, HARD);
    expect(state.grudges[0]!.settled).toBe(true);
    expect(ripeFeud(state)).toBeUndefined();
  });

  it('only one new quarrel a day, whatever the state of the band', () => {
    const state = fresh('feud-rate');
    for (const person of state.party.people) {
      person.trait = 'quarrelsome';
      person.morale = 0;
    }
    const before = state.grudges.length;
    stirGrudges(state, HARD);
    expect(state.grudges.length).toBeLessThanOrEqual(before + 1);
  });
});

// --- Answering one ---

describe('a feud is a decision', () => {
  function ripe(seed: string): GameState {
    const state = settled(seed);
    const [a, b] = pairUp(state);
    state.party.food = 60;
    state.grudges.push({
      a: a.id,
      b: b.id,
      weight: FEUD_THRESHOLD + 2,
      cause: `${a.name} and ${b.name} had it out.`,
      since: 1,
    });
    expect(presentFeud(state, state.grudges[0]!)).toBe(true);
    return state;
  }

  it('comes to the player as a card with three answers and the odds shown', () => {
    const state = ripe('answer-card');
    const card = state.event!;
    expect(card.id).toBe('feud');
    expect(card.feud).toBeDefined();
    expect(card.choices).toHaveLength(FEUD_CHOICES.length);
    expect(card.choices.some((c) => c.hint?.includes('%'))).toBe(true);
    expect(card.body).toContain('had it out');
  });

  it('the wergild settles it and costs the store', () => {
    const state = ripe('answer-wergild');
    const before = state.party.food;
    const out = settleFeud(state, 0);
    expect(out.good).toBe(true);
    expect(state.party.food).toBe(before - WERGILD_FOOD);
    expect(state.grudges[0]!.settled).toBe(true);
  });

  it('an empty store cannot buy peace', () => {
    const state = ripe('answer-broke');
    state.party.food = 1;
    const out = settleFeud(state, 0);
    expect(out.good).toBe(false);
    expect(state.grudges[0]!.settled).toBeFalsy();
  });

  it('telling them to get back to work costs nothing today, and hardens', () => {
    const state = ripe('answer-ignore');
    const before = state.grudges[0]!.weight;
    const food = state.party.food;
    const out = settleFeud(state, 2);
    expect(out.good).toBe(false);
    expect(state.party.food).toBe(food);
    expect(state.grudges[0]!.weight).toBeGreaterThan(before);
    expect(state.grudges[0]!.settled).toBeFalsy();
    expect(state.grudges[0]!.hardened).toBe(true);

    // A quarrel nobody named fades on good days; a refused one does not.
    const named = state.grudges[0]!;
    const weight = named.weight;
    for (let d = 0; d < 6; d++) stirGrudges(state, EASY);
    expect(named.weight).toBeGreaterThanOrEqual(weight);
  });

  it('a quarrel left to run long enough draws blood', () => {
    const state = ripe('answer-blood');
    const grudge = state.grudges[0]!;
    grudge.weight = BLOOD_THRESHOLD + 4;
    let hurt = false;
    for (let d = 0; d < 40 && !hurt; d++) {
      state.day = 40 + d;
      feudsComeDue(state);
      hurt = state.party.people.some((p) => p.injuries.some((i) => i.id.startsWith('feud_')));
    }
    expect(hurt).toBe(true);
    expect(grudge.settled).toBe(true);
    expect(state.saga.some((e) => e.text.includes('knives'))).toBe(true);
  });

  /**
   * The second bar. Both bands carry the same quarrel; one answers it and one
   * does not. If walking away were free, the card would be decoration.
   */
  it('settling beats ignoring, measured over a season', { timeout: 60_000 }, () => {
    const SEEDS = Array.from({ length: 10 }, (_, i) => `weigh-${i}`);
    const tally = {
      settled: { mood: 0, wounded: 0, strength: 0, food: 0 },
      ignored: { mood: 0, wounded: 0, strength: 0, food: 0 },
    };

    for (const seed of SEEDS) {
      for (const [name, answer] of [['settled', 0], ['ignored', 2]] as const) {
        const state = ripe(seed);
        settleFeud(state, answer);
        delete state.event;
        // Short rations, which is the situation a feud arises in at all. A
        // band with the store overflowing has nothing to quarrel about, and
        // measuring there would be measuring the wrong thing.
        state.party.food = 40;
        state.party.firewood = 40;
        for (let d = 0; d < 24 && !state.end; d++) passDay(state);
        const t = tally[name];
        const alive = state.party.people.filter((p) => p.alive);
        // The band's own cohesion recovers within a season by design, so the
        // lasting marks are what people privately think and what the knife
        // took off them.
        t.mood += alive.reduce((n, p) => n + p.morale, 0);
        t.strength += alive.reduce(
          (n, p) => n + effectiveStat(p, 'might') + effectiveStat(p, 'spirit'),
          0,
        );
        t.wounded += state.party.people.filter((p) =>
          p.injuries.some((i) => i.id.startsWith('feud_')),
        ).length;
        t.food += state.party.food;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `over ${SEEDS.length} bands, a season on — settled: ${Math.round(tally.settled.mood)} mood, ` +
        `${tally.settled.strength} strength, ${tally.settled.wounded} knifed, ` +
        `${Math.round(tally.settled.food)} food | ignored: ${Math.round(tally.ignored.mood)} mood, ` +
        `${tally.ignored.strength} strength, ${tally.ignored.wounded} knifed, ` +
        `${Math.round(tally.ignored.food)} food (wergild costs ${WERGILD_FOOD})`,
    );

    expect(tally.settled.mood).toBeGreaterThan(tally.ignored.mood);
    expect(tally.settled.wounded).toBeLessThan(tally.ignored.wounded);
    expect(tally.settled.strength).toBeGreaterThan(tally.ignored.strength);
    // And the wergild is cheap against what the alternative costs.
    expect(tally.ignored.food - tally.settled.food).toBeLessThan(
      WERGILD_FOOD * SEEDS.length,
    );
  });
});

// --- Plumbing ---

describe('minds through the game', () => {
  it('a ripe feud reaches the player, and waits for a fight to finish', () => {
    const state = settled('plumb-fire');
    const [a, b] = pairUp(state);
    state.grudges.push({
      a: a.id,
      b: b.id,
      weight: FEUD_THRESHOLD + 1,
      cause: 'x',
      since: 1,
    });
    // Not while something else is on the table.
    state.battle = { terrain: 'meadow' } as never;
    expect(maybeFireFeud(state)).toBe(false);
    delete state.battle;
    expect(maybeFireFeud(state)).toBe(true);
    expect(state.event?.feud).toBeDefined();
  });

  it('answering it goes through the ordinary card path', () => {
    const state = settled('plumb-choose');
    const [a, b] = pairUp(state);
    state.party.food = 60;
    state.grudges.push({
      a: a.id,
      b: b.id,
      weight: FEUD_THRESHOLD + 1,
      cause: 'x',
      since: 1,
    });
    maybeFireFeud(state);
    const chosen = apply(state, { type: 'CHOOSE', index: 0 });
    expect(chosen.event?.outcome).toBeDefined();
    expect(chosen.grudges[0]!.settled).toBe(true);
    const done = apply(chosen, { type: 'DISMISS_EVENT' });
    expect(done.event).toBeUndefined();
  });

  it('grudges round-trip through a save, and an older one comes forward calm', () => {
    const state = settled('plumb-save');
    const [a, b] = pairUp(state);
    state.grudges.push({ a: a.id, b: b.id, weight: 6, cause: 'x', since: 3 });
    const round = JSON.parse(encode(state)) as GameState;
    expect(round.grudges).toEqual(state.grudges);
    expect(grudgeBetween(round, a.id, b.id)).toBeDefined();
    // And the pair reads the same either way round.
    expect(grudgeBetween(round, b.id, a.id)).toBeDefined();

    const { save } = migrate({ version: 10, party: { people: [] } });
    expect(save['version']).toBe(SAVE_VERSION);
    expect(save['grudges']).toEqual([]);
  });

  it('every trait has a temper, and friction is symmetric', () => {
    for (const trait of TRAITS) {
      expect(temperOf(trait.id)).toBeGreaterThan(0);
      for (const other of TRAITS) {
        expect(friction(trait.id, other.id)).toBe(friction(other.id, trait.id));
      }
    }
  });
});
