// 3.3: needs and buildings. The bar is that a build order emerges naturally
// from scarcity, so the centre of this file pits a bot that always builds what
// it most lacks against bots that follow a fixed order and against one that
// never builds at all.

import { describe, it, expect } from 'vitest';
import { fromKey } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { eventChance } from '../src/sim/events';
import { passDay } from '../src/sim/upkeep';
import {
  assign,
  availableJobs,
  buildable,
  buildBlocker,
  buildProgress,
  capacity,
  effectiveReport,
  finishBuilds,
  foodKeeping,
  hasBuilt,
  heartFromBuildings,
  offerable,
  output,
  queueBuild,
  shelterSaving,
  standing,
  underway,
  unqueueBuild,
} from '../src/sim/colony';
import { daysOfFood, nightsOfFire, readNeeds, suggestedBuild, worstNeed } from '../src/sim/needs';
import { BUILDINGS, buildingById, type BuildingId } from '../src/data/buildings';
import { jobById, type JobId } from '../src/data/jobs';
import { living } from '../src/sim/people';
import type { GameState } from '../src/state/types';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/**
 * Settled on the best ground within a fair walk, as a careful player would.
 * Some coasts have nothing settleable near the landing at all — the water gate
 * is real — so the search widens rather than giving up.
 */
function settledWell(seed: string, radius = 14): GameState {
  const state = structuredClone(newGame(seed));
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
  state.party.people.filter((p) => p.alive).forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  return state;
}

/** Hands a steading enough timber to actually raise something. */
function stocked(seed: string, timber = 120): GameState {
  const state = settledWell(seed);
  state.party.firewood = timber;
  return state;
}

// --- Needs ---

describe('the four needs', () => {
  it('reads all four, always, and always in range', () => {
    const state = settledWell('needs-1');
    const needs = readNeeds(state);
    expect(needs.map((n) => n.id).sort()).toEqual(['food', 'heart', 'rest', 'warmth']);
    for (const need of needs) {
      expect(need.level).toBeGreaterThanOrEqual(0);
      expect(need.level).toBeLessThanOrEqual(1);
      expect(need.line.length).toBeGreaterThan(10);
    }
  });

  it('names the thing that is actually hurting', () => {
    const hungry = settledWell('needs-hungry');
    hungry.party.food = 0;
    hungry.party.firewood = 400;
    hungry.party.morale = 90;
    for (const p of hungry.party.people) p.health = p.maxHealth;
    expect(worstNeed(hungry).id).toBe('food');

    const cold = settledWell('needs-cold');
    cold.party.food = 900;
    cold.party.firewood = 0;
    cold.party.morale = 90;
    for (const p of cold.party.people) p.health = p.maxHealth;
    expect(worstNeed(cold).id).toBe('warmth');

    const beaten = settledWell('needs-hurt');
    beaten.party.food = 900;
    beaten.party.firewood = 400;
    beaten.party.morale = 90;
    for (const p of beaten.party.people) p.health = 1;
    expect(worstNeed(beaten).id).toBe('rest');

    const broken = settledWell('needs-heart');
    broken.party.food = 900;
    broken.party.firewood = 400;
    broken.party.morale = 2;
    for (const p of broken.party.people) p.health = p.maxHealth;
    expect(worstNeed(broken).id).toBe('heart');
  });

  it('counts days of food against what the band actually eats', () => {
    const state = settledWell('needs-days');
    state.party.food = 60;
    const before = daysOfFood(state);
    state.party.food = 30;
    expect(daysOfFood(state)).toBeLessThan(before);
    expect(nightsOfFire(state)).toBeGreaterThan(0);
  });

  it('suggests a building that answers the worst of it', () => {
    const cold = stocked('suggest-cold');
    cold.day = 40; // late enough that a bare stack is genuinely frightening
    cold.party.firewood = 8;
    cold.party.food = 900;
    cold.party.morale = 95;
    for (const p of cold.party.people) p.health = p.maxHealth;
    expect(worstNeed(cold).id).toBe('warmth');
    expect(suggestedBuild(cold, buildable(cold))?.answers).toBe('warmth');
  });
});

// --- Raising things ---

describe('the build queue', () => {
  it('pays its timber on queue, and half of it back on cancel', () => {
    const state = stocked('queue-pay');
    const longhouse = buildingById('longhouse')!;
    const before = state.party.firewood;

    expect(queueBuild(state, 'longhouse')).toBe(true);
    expect(state.party.firewood).toBe(before - longhouse.timber);
    expect(state.settlement!.queue).toEqual(['longhouse']);

    expect(unqueueBuild(state, 'longhouse')).toBe(true);
    // Half back: changing your mind costs, which is why the queue is a
    // decision rather than a scratchpad.
    expect(state.party.firewood).toBe(before - longhouse.timber + Math.floor(longhouse.timber / 2));
    expect(state.settlement!.queue).toEqual([]);
    expect(state.settlement!.works).toBe(0);
  });

  it('refuses what cannot be paid for, stood on, or reached yet', () => {
    const broke = settledWell('queue-broke');
    broke.party.firewood = 0;
    expect(buildBlocker(broke, buildingById('longhouse')!)).toBe('timber');
    expect(queueBuild(broke, 'longhouse')).toBe(false);

    const rich = stocked('queue-after');
    // The smokehouse waits on a longhouse; nothing else does.
    expect(buildBlocker(rich, buildingById('smokehouse')!)).toBe('after');
    expect(queueBuild(rich, 'smokehouse')).toBe(false);
    expect(queueBuild(rich, 'longhouse')).toBe(true);
    expect(buildBlocker(rich, buildingById('longhouse')!)).toBe('queued');
  });

  it('a dock needs a harbour and farm plots need soil', () => {
    const state = stocked('queue-ground');
    const home = state.settlement!;
    home.report = { ...home.report, harbour: 0, soil: 0 };
    expect(buildBlocker(state, buildingById('dock')!)).toBe('ground');
    expect(buildBlocker(state, buildingById('farmplots')!)).toBe('ground');
    home.report = { ...home.report, harbour: 3, soil: 3 };
    expect(buildBlocker(state, buildingById('dock')!)).toBeNull();
    expect(buildBlocker(state, buildingById('farmplots')!)).toBeNull();
  });

  it('builders finish it, and it never finishes twice', () => {
    const state = stocked('queue-finish');
    queueBuild(state, 'longhouse');
    const longhouse = buildingById('longhouse')!;

    let days = 0;
    while (!hasBuilt(state, 'longhouse') && days < 60 && !state.end) {
      passDay(state);
      days++;
    }
    // eslint-disable-next-line no-console
    console.log(`longhouse (${longhouse.works} builder-days) finished in ${days} days with one builder`);
    expect(hasBuilt(state, 'longhouse')).toBe(true);
    expect(state.settlement!.queue).toEqual([]);
    expect(state.settlement!.built.filter((id) => id === 'longhouse')).toHaveLength(1);
    expect(state.saga.some((e) => e.text.includes('Longhouse'))).toBe(true);

    // Running the completion check again changes nothing.
    const snapshot = encode(state);
    finishBuilds(state);
    expect(encode(state)).toBe(snapshot);
  });

  it('banked work does not survive the thing it was banked for', () => {
    const state = stocked('queue-lost');
    queueBuild(state, 'palisade');
    for (let d = 0; d < 3 && !state.end; d++) passDay(state);
    expect(state.settlement!.works).toBeGreaterThan(0);
    unqueueBuild(state, 'palisade');
    expect(state.settlement!.works).toBe(0);
  });

  it('with nothing on the stocks, builders only patch and mend', () => {
    const state = settledWell('queue-idle');
    const before = state.settlement!.shelter;
    for (let d = 0; d < 10 && !state.end; d++) passDay(state);
    // Some, but a fraction of what a real building grants.
    expect(state.settlement!.shelter).toBeGreaterThan(before);
    expect(state.settlement!.shelter).toBeLessThan(buildingById('longhouse')!.shelter!);
  });
});

// --- What standing buildings actually do ---

describe('buildings change the steading', () => {
  function raise(state: GameState, ids: BuildingId[]): GameState {
    const home = state.settlement!;
    home.built.push(...ids);
    for (const id of ids) {
      home.shelter = Math.min(6, home.shelter + (buildingById(id)!.shelter ?? 0));
    }
    return state;
  }

  it('farm plots really do make the soil better', () => {
    const bare = stocked('eff-soil');
    bare.settlement!.report = { ...bare.settlement!.report, soil: 2 };
    const walled = raise(structuredClone(bare), ['farmplots']);
    expect(effectiveReport(walled)!.soil).toBe(effectiveReport(bare)!.soil + 1);

    const farmer = jobById('farmer')!;
    const person = bare.party.people[0]!;
    expect(output(walled, person, farmer)).toBeGreaterThan(output(bare, person, farmer));
  });

  it('a longhouse is worth firewood you do not have to cut', () => {
    const open = stocked('eff-roof');
    const roofed = raise(structuredClone(open), ['longhouse']);
    expect(shelterSaving(roofed)).toBeGreaterThan(shelterSaving(open));

    open.party.firewood = 80;
    roofed.party.firewood = 80;
    open.day = 55;
    roofed.day = 55; // deep winter, when the fire costs most
    passDay(open);
    passDay(roofed);
    expect(roofed.party.firewood).toBeGreaterThan(open.party.firewood);
  });

  it('a smokehouse keeps a quarter more of what is caught', () => {
    const plain = stocked('eff-smoke');
    const smoked = raise(structuredClone(plain), ['longhouse', 'smokehouse']);
    expect(foodKeeping(smoked)).toBeCloseTo(1.25, 6);

    const hunter = jobById('hunter')!;
    const person = plain.party.people[0]!;
    expect(output(smoked, person, hunter)).toBeCloseTo(output(plain, person, hunter) * 1.25, 5);
    // And it leaves wood work alone.
    const cutter = jobById('woodcutter')!;
    expect(output(smoked, person, cutter)).toBeCloseTo(output(plain, person, cutter), 6);
  });

  it('a palisade makes the steading quieter', () => {
    const open = stocked('eff-wall');
    const walled = raise(structuredClone(open), ['palisade']);
    expect(effectiveReport(walled)!.defence).toBeGreaterThan(effectiveReport(open)!.defence);
    expect(eventChance(walled)).toBeLessThan(eventChance(open));
  });

  it('a dock lets you fish ground that has no water on it', () => {
    const inland = stocked('eff-dock');
    const home = inland.settlement!;
    home.plots = home.plots.map((p) => (p.kind === 'water' ? { ...p, kind: 'rough' as const } : p));
    expect(availableJobs(inland).map((j) => j.id)).not.toContain('fisher');
    const docked = raise(structuredClone(inland), ['dock']);
    expect(availableJobs(docked).map((j) => j.id)).toContain('fisher');
  });

  it('a mead hall lifts the heart every single day', () => {
    const plain = stocked('eff-mead');
    const merry = raise(structuredClone(plain), ['longhouse', 'meadhall']);
    plain.party.morale = 40;
    merry.party.morale = 40;
    plain.party.food = 200;
    merry.party.food = 200;
    passDay(plain);
    passDay(merry);
    expect(merry.party.morale).toBeGreaterThan(plain.party.morale);
  });

  it('no building can push a measure past the cap', () => {
    const state = stocked('eff-cap');
    state.settlement!.report = { ...state.settlement!.report, soil: 5, harbour: 5, defence: 5 };
    raise(state, ['farmplots', 'dock', 'palisade']);
    const report = effectiveReport(state)!;
    for (const value of [report.soil, report.harbour, report.defence]) {
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('every building is reachable — none is defined and then unbuildable', () => {
    const state = stocked('eff-all', 400);
    const home = state.settlement!;
    home.report = { water: 5, soil: 5, timber: 5, harbour: 5, defence: 5, total: 25 };
    for (const building of BUILDINGS) {
      // Grant whatever it waits on, then check the ground and purse allow it.
      for (const id of building.after ?? []) {
        if (!home.built.includes(id)) home.built.push(id);
      }
      expect(buildBlocker(state, building), building.id).toBeNull();
    }
  });
});

// --- The milestone's bar ---

describe('a build order emerges naturally from scarcity', () => {
  const SEEDS = ['ord-a', 'ord-b', 'ord-c', 'ord-d', 'ord-e', 'ord-f'];

  /** Queue whatever answers the worst need. */
  function scarcityBot(state: GameState): void {
    if (state.settlement!.queue.length > 0) return;
    const pick = suggestedBuild(state, buildable(state));
    if (pick) queueBuild(state, pick.id);
  }

  /** Queue in a fixed order, need or no need. */
  function fixedBot(order: BuildingId[]) {
    return (state: GameState): void => {
      if (state.settlement!.queue.length > 0) return;
      for (const id of order) {
        const building = buildingById(id);
        if (building && buildBlocker(state, building) === null) {
          queueBuild(state, id);
          return;
        }
      }
    };
  }

  function play(seed: string, bot: ((state: GameState) => void) | null) {
    const state = settledWell(seed);
    while (state.day < 73 && !state.end) {
      if (bot) bot(state);
      passDay(state);
    }
    return {
      survived: state.end?.cause === 'survived',
      days: state.day,
      built: state.settlement!.built.slice(),
    };
  }

  it('building what you lack beats building by rote, and beats not building', () => {
    const tally = {
      scarcity: { survived: 0, days: 0 },
      lateFirst: { survived: 0, days: 0 },
      never: { survived: 0, days: 0 },
    };
    const orders: string[] = [];

    for (const seed of SEEDS) {
      const a = play(seed, scarcityBot);
      // A plausible-but-wrong order: the showy things first.
      const b = play(seed, fixedBot(['palisade', 'dock', 'longhouse', 'meadhall', 'farmplots']));
      const c = play(seed, null);

      tally.scarcity.survived += a.survived ? 1 : 0;
      tally.scarcity.days += a.days;
      tally.lateFirst.survived += b.survived ? 1 : 0;
      tally.lateFirst.days += b.days;
      tally.never.survived += c.survived ? 1 : 0;
      tally.never.days += c.days;
      orders.push(a.built.join(' > ') || '(nothing)');
    }

    // eslint-disable-next-line no-console
    console.log(
      `over ${SEEDS.length} years — ` +
        `scarcity ${tally.scarcity.survived} survived (${Math.round(tally.scarcity.days / SEEDS.length)} avg days) | ` +
        `rote ${tally.lateFirst.survived} (${Math.round(tally.lateFirst.days / SEEDS.length)}) | ` +
        `never ${tally.never.survived} (${Math.round(tally.never.days / SEEDS.length)})`,
    );
    // eslint-disable-next-line no-console
    console.log('orders the scarcity bot arrived at:');
    for (const order of orders) console.log('  ', order);

    // Building at all has to be worth it, and building the RIGHT thing has to
    // beat building the wrong thing. Without both, the queue is busywork.
    expect(tally.scarcity.days).toBeGreaterThan(tally.never.days);
    expect(tally.scarcity.survived).toBeGreaterThanOrEqual(tally.never.survived);
    expect(tally.scarcity.days).toBeGreaterThan(tally.lateFirst.days);
  });

  /**
   * The same steading under different pressures. Measured this way rather than
   * across seeds because the natural first build IS the longhouse almost
   * everywhere — a band with no roof is cold before it is anything else, and a
   * test that demanded variety there would be demanding the wrong thing.
   */
  it('the same steading wants different things under different pressures', () => {
    const picks = new Map<string, string>();

    const scarcity = (mutate: (s: GameState) => void): GameState => {
      const state = stocked('diverge', 200);
      state.day = 30;
      state.party.food = 900;
      state.party.firewood = 200;
      state.party.morale = 95;
      for (const p of state.party.people) p.health = p.maxHealth;
      // Everything comfortable, then one thing made scarce.
      mutate(state);
      return state;
    };

    const cold = scarcity((s) => {
      s.party.firewood = 6;
    });
    const hungry = scarcity((s) => {
      s.party.food = 2;
    });
    const miserable = scarcity((s) => {
      s.party.morale = 3;
    });

    for (const [label, state] of [
      ['cold', cold],
      ['hungry', hungry],
      ['miserable', miserable],
    ] as const) {
      const need = worstNeed(state);
      const pick = suggestedBuild(state, buildable(state));
      picks.set(label, `${need.id} -> ${pick?.id ?? 'nothing'}`);
    }

    // eslint-disable-next-line no-console
    console.log(`under pressure: ${[...picks.entries()].map(([k, v]) => `${k}: ${v}`).join(' | ')}`);

    expect(worstNeed(cold).id).toBe('warmth');
    expect(worstNeed(hungry).id).toBe('food');
    expect(worstNeed(miserable).id).toBe('heart');
    expect(suggestedBuild(cold, buildable(cold))?.answers).toBe('warmth');
    expect(suggestedBuild(hungry, buildable(hungry))?.answers).toBe('food');
    // Three pressures, three answers. If any two agreed, the panel would be
    // telling the player the same thing whatever was wrong.
    expect(new Set(picks.values()).size).toBe(3);
  });
});

// --- Item 7: the queue must not end ---

describe('the queue never ends', () => {
  it('another búð goes up only for people with nowhere to sleep', () => {
    const state = stocked('repeat-bud', 400);
    const home = state.settlement!;
    home.built.push('longhouse');
    const bud = buildingById('bud')!;
    const before = capacity(state);

    expect(buildBlocker(state, bud)).toBeNull();
    home.built.push('bud');
    expect(capacity(state)).toBe(before + bud.room!);

    // Standing already, and not "built" — but with room to spare, another
    // would stand empty. This gate is not tidiness: without it the panel's
    // own suggestion becomes an infinite timber sink, measured at a hundred
    // firewood off a first winter.
    expect(buildBlocker(state, bud)).toBe('room');

    // Fill it past the roofs it has and the hut is worth raising again.
    const spare = state.party.people[0]!;
    while (living(state.party.people).length <= capacity(state)) {
      state.party.people.push({ ...structuredClone(spare), id: `extra_${state.party.people.length}` });
    }
    expect(buildBlocker(state, bud)).toBeNull();

    // One-shots have not changed their minds.
    home.built.push('meadhall');
    expect(buildBlocker(state, buildingById('meadhall')!)).toBe('built');
  });

  it('with every last thing standing, the panel still has a row to show', () => {
    const state = stocked('repeat-offer', 400);
    state.settlement!.built.push(...BUILDINGS.map((b) => b.id));
    const offered = offerable(state);
    // Not "nothing left" — the repeatable stays on the panel, disabled with
    // its reason, so the player can see the queue has a tail at all.
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((b) => b.repeat)).toBe(true);
  });

  it('repeatables grant only what can safely stack', () => {
    // A repeatable foodKeep would compound into a food printer, a stacking
    // heart into free morale. Room and shelter are the safe currencies:
    // room is the POINT, and shelter is capped by the sim.
    for (const b of BUILDINGS.filter((x) => x.repeat)) {
      expect(b.foodKeep, b.id).toBeUndefined();
      expect(b.heart, b.id).toBeUndefined();
      expect(b.raises, b.id).toBeUndefined();
      expect(b.unlocks, b.id).toBeUndefined();
    }
  });

  it('the late tier pulls real weight: loft, tower and god-house all bind', () => {
    const fed = stocked('late-store');
    fed.settlement!.built.push('longhouse', 'smokehouse', 'storehouse');
    expect(foodKeeping(fed)).toBeCloseTo(1.25 * 1.15, 6);

    const watched = stocked('late-watch');
    watched.settlement!.report = { ...watched.settlement!.report, defence: 1 };
    const bare = effectiveReport(watched)!.defence;
    watched.settlement!.built.push('palisade', 'watchtower');
    expect(effectiveReport(watched)!.defence).toBe(bare + 3);

    const pious = stocked('late-hof');
    pious.settlement!.built.push('longhouse', 'meadhall');
    const merry = heartFromBuildings(pious);
    pious.settlement!.built.push('hof');
    expect(heartFromBuildings(pious)).toBe(merry + 2);
  });
});

// --- Mode and saves ---

describe('building through the action layer', () => {
  function inColony(seed: string): GameState {
    return apply(stocked(seed), { type: 'ENTER_COLONY' });
  }

  it('queues and cancels, and refuses nonsense', () => {
    const inside = inColony('act-build');
    const queued = apply(inside, { type: 'QUEUE_BUILD', building: 'longhouse' });
    expect(queued).not.toBe(inside);
    expect(queued.settlement!.queue).toEqual(['longhouse']);
    expect(underway(queued)?.id).toBe('longhouse');
    expect(buildProgress(queued)).toBe(0);

    // Twice is a refusal, not a second longhouse.
    expect(apply(queued, { type: 'QUEUE_BUILD', building: 'longhouse' })).toBe(queued);
    const cancelled = apply(queued, { type: 'UNQUEUE_BUILD', building: 'longhouse' });
    expect(cancelled.settlement!.queue).toEqual([]);
    expect(apply(cancelled, { type: 'UNQUEUE_BUILD', building: 'longhouse' })).toBe(cancelled);
  });

  it('will not build from the road', () => {
    const outside = stocked('act-road');
    expect(apply(outside, { type: 'QUEUE_BUILD', building: 'longhouse' })).toBe(outside);
  });

  it('a queue round-trips through a save', () => {
    const queued = apply(inColony('act-save'), { type: 'QUEUE_BUILD', building: 'longhouse' });
    const round = JSON.parse(encode(queued)) as GameState;
    expect(round.settlement!.queue).toEqual(['longhouse']);
    expect(round.settlement!.built).toEqual([]);
    expect(round.settlement!.works).toBe(0);
  });

  it('a v7 save comes forward with an empty queue and keeps its roof', () => {
    const { save } = migrate({
      version: 7,
      party: { people: [] },
      settlement: { at: { q: 0, r: 0 }, name: 'Old', plots: [], shelter: 4, watch: 1 },
    });
    expect(save['version']).toBe(SAVE_VERSION);
    const home = save['settlement'] as { built: unknown[]; queue: unknown[]; works: number; shelter: number };
    expect(home.built).toEqual([]);
    expect(home.queue).toEqual([]);
    expect(home.works).toBe(0);
    // Taking a roof off a band mid-winter because the model changed would be
    // indefensible, so the old shelter survives the migration.
    expect(home.shelter).toBe(4);
  });

  it('an unsettled band cannot build anything', () => {
    const state = structuredClone(newGame('act-homeless'));
    expect(offerable(state)).toHaveLength(0);
    expect(buildable(state)).toHaveLength(0);
    expect(standing({ built: [] } as never)).toEqual([]);
    expect(queueBuild(state, 'longhouse')).toBe(false);
  });
});
