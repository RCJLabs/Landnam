import { describe, it, expect } from 'vitest';
import { key, distance, neighbors } from '../src/hex';
import { newGame, START_FIREWOOD, START_FOOD } from '../src/state/create';
import { apply } from '../src/sim/actions';
import {
  atSea,
  canFish,
  canGather,
  canMove,
  daysForMove,
  isCoastalWater,
  moveEffort,
  moveOptions,
  SEA_EFFORT,
} from '../src/sim/travel';
import { canFound } from '../src/sim/site';
import { living } from '../src/sim/people';
import { foodPerDay, SURVIVAL_DAY } from '../src/sim/upkeep';
import { daysUntilWinter, seasonOf, wintersStood } from '../src/sim/calendar';
import { visibilityAt } from '../src/sim/fog';
import { encode } from '../src/state/save';
import type { GameState } from '../src/state/types';

/**
 * Plays a fight out by simply ending turns, and leaves the field. A card can
 * draw steel, and a loop that only knows how to camp would sit in BATTLE mode
 * forever having every action refused — which looks exactly like a hung run.
 */
function fight(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 400 && s.battle && !s.battle.outcome; i++) {
    s = apply(s, { type: 'B_END_TURN' });
  }
  if (s.battle?.outcome) s = apply(s, { type: 'B_LEAVE' });
  if (s.aftermath) s = apply(s, { type: 'DISMISS_AFTERMATH' });
  return s;
}

/** Answers whatever card is on the table, so a move can be tested. */
function card(state: GameState): GameState {
  if (!state.event) return state;
  const chosen = apply(state, { type: 'CHOOSE', index: 0 });
  return apply(chosen, { type: 'DISMISS_EVENT' });
}

function step(state: GameState): GameState {
  if (state.battle || state.aftermath) return fight(state);
  if (state.event) {
    const chosen = apply(state, { type: 'CHOOSE', index: 0 });
    return fight(apply(chosen, { type: 'DISMISS_EVENT' }));
  }
  const options = moveOptions(state);
  const next = options[0]
    ? apply(state, { type: 'MOVE', to: options[0] })
    : apply(state, { type: 'CAMP' });
  return fight(next);
}

describe('new game', () => {
  it('starts a warband of six on the landing beach', () => {
    const state = newGame('start-seed');
    expect(state.day).toBe(1);
    expect(state.modes).toEqual(['TRAVEL']);
    expect(living(state.party.people)).toHaveLength(6);
    expect(state.party.at).toEqual(state.world.landing);
    expect(state.party.food).toBe(START_FOOD);
    expect(state.party.firewood).toBe(START_FIREWOOD);
    expect(state.saga).toHaveLength(1);
  });

  it('reveals the country around the landing but not the whole map', () => {
    const state = newGame('fog-seed');
    expect(visibilityAt(state.world, state.party.at)).toBe('visible');
    const revealed = Object.keys(state.world.seen).length;
    expect(revealed).toBeGreaterThan(3);
    expect(revealed).toBeLessThan(Object.keys(state.world.tiles).length / 4);
  });

  it('is fully determined by its seed', () => {
    expect(encode(newGame('twin'))).toBe(encode(newGame('twin')));
    expect(encode(newGame('twin'))).not.toBe(encode(newGame('other')));
  });

  it('gives each person a trait and four stats', () => {
    const state = newGame('people-seed');
    for (const person of state.party.people) {
      expect(person.trait).toBeTruthy();
      expect(person.byname).toBeTruthy();
      for (const stat of ['might', 'wits', 'spirit', 'craft'] as const) {
        expect(person.stats[stat]).toBeGreaterThanOrEqual(1);
        expect(person.stats[stat]).toBeLessThanOrEqual(6);
      }
      expect(person.health).toBe(person.maxHealth);
    }
  });
});

describe('movement', () => {
  it('only permits adjacent, passable hexes', () => {
    const state = newGame('move-seed');
    for (const option of moveOptions(state)) {
      expect(distance(state.party.at, option)).toBe(1);
      expect(canMove(state, option)).toBe(true);
    }
    const far = { q: state.party.at.q + 4, r: state.party.at.r };
    expect(canMove(state, far)).toBe(false);
    expect(apply(state, { type: 'MOVE', to: far })).toBe(state);
  });

  it('the knarr hugs the coast: water in sight of land only', () => {
    const state = newGame('sea-seed');
    let coastal = 0;
    let open = 0;
    for (const [k, tile] of Object.entries(state.world.tiles)) {
      if (tile.terrain !== 'ocean') continue;
      const h = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      const effort = moveEffort(state, h);
      if (isCoastalWater(state, h)) {
        // Rowable, and never cheaper than the easiest ground on foot.
        expect(effort, k).toBe(SEA_EFFORT);
        coastal += 1;
      } else {
        expect(effort, `${k}: open water is not a road`).toBeNull();
        open += 1;
      }
    }
    expect(coastal, 'no water was reachable at all').toBeGreaterThan(0);
    expect(open, 'the whole sea was coastal').toBeGreaterThan(0);
  });

  it('a band can put out from the beach, sail, and come ashore again', () => {
    const state = newGame('sea-voyage');
    // The landing is a shore hex, so at least one neighbour is coastal water.
    const water = neighbors(state.party.at).find((h) => isCoastalWater(state, h));
    expect(water, 'nothing to launch into from the landing').toBeTruthy();
    expect(canMove(state, water!)).toBe(true);

    const afloat = card(apply(state, { type: 'MOVE', to: water! }));
    expect(afloat).not.toBe(state);
    expect(atSea(afloat)).toBe(true);
    expect(afloat.day).toBeGreaterThan(state.day);

    // At sea the land's larder is shut, but the nets are the best they get.
    expect(canGather(afloat)).toBe(false);
    expect(canFish(afloat)).toBe(true);
    expect(apply(afloat, { type: 'FORAGE' })).toBe(afloat);
    expect(apply(afloat, { type: 'HUNT' })).toBe(afloat);
    expect(apply(afloat, { type: 'FISH' }).party.food).toBeGreaterThanOrEqual(afloat.party.food);

    // A night aboard gathers no firewood — the pile only ever goes down,
    // because the night's fire still has to come from somewhere.
    const camped = apply(afloat, { type: 'CAMP' });
    expect(camped.party.firewood).toBeLessThanOrEqual(afloat.party.firewood);

    // A card drawn on the water blocks the road like any other, so answer it
    // before asking whether the band can get home.
    const anchored = card(camped);

    // There is always a way back to dry land from coastal water.
    const shore = moveOptions(anchored).find(
      (h) => anchored.world.tiles[`${h.q},${h.r}`]?.terrain !== 'ocean',
    );
    expect(shore, 'stranded at sea').toBeTruthy();
    expect(atSea(apply(anchored, { type: 'MOVE', to: shore! }))).toBe(false);
  });

  it('you cannot raise a hall on water', () => {
    const state = newGame('sea-found');
    const water = neighbors(state.party.at).find((h) => isCoastalWater(state, h))!;
    const afloat = card(apply(state, { type: 'MOVE', to: water }));
    expect(canFound(afloat, afloat.party.at)).toBe(false);
    expect(apply(afloat, { type: 'FOUND' })).toBe(afloat);
  });

  it('advances the day and moves the party', () => {
    const state = newGame('advance-seed');
    const target = moveOptions(state)[0]!;
    const days = daysForMove(state, target)!;
    const next = apply(state, { type: 'MOVE', to: target });
    expect(next.party.at).toEqual(target);
    expect(next.day).toBe(state.day + days);
    expect(state.day).toBe(1); // the input state is untouched
  });

  it('hard ground costs more days than open ground', () => {
    const state = newGame('cost-seed');
    // Mountains cost 4 effort, meadow 1 — two days versus one.
    const fake = structuredClone(state);
    const target = moveOptions(fake)[0]!;
    fake.world.tiles[key(target)]!.terrain = 'meadow';
    expect(daysForMove(fake, target)).toBe(1);
    fake.world.tiles[key(target)]!.terrain = 'mountains';
    expect(daysForMove(fake, target)).toBe(2);
  });
});

describe('supplies and camp', () => {
  it('camping gathers firewood and costs a day', () => {
    const state = newGame('camp-seed');
    const next = apply(state, { type: 'CAMP' });
    expect(next.day).toBe(2);
    expect(next.party.hasCamped).toBe(true);
    expect(next.party.firewood).toBeGreaterThanOrEqual(state.party.firewood - 1);
  });

  it('foraging adds food and costs a day', () => {
    const state = newGame('forage-seed');
    const next = apply(state, { type: 'FORAGE' });
    expect(next.day).toBe(2);
    // Food is spent on the day's meal but foraging should more than cover it
    // on a summer shore.
    expect(next.party.food).toBeGreaterThan(state.party.food - foodPerDay(state) - 1);
  });

  it('doing nothing eventually kills the band', () => {
    let state = newGame('starve-seed');
    state = structuredClone(state);
    state.party.food = 0;
    state.party.firewood = 0;
    for (let i = 0; i < 200 && !state.end; i++) {
      state = state.battle || state.aftermath
        ? fight(state)
        : state.event
          ? fight(apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' }))
          : fight(apply(state, { type: 'CAMP' }));
    }
    expect(state.end).toBeDefined();
    expect(['starved', 'frozen', 'despair', 'slain']).toContain(state.end!.cause);
  });

  it('resources never go negative across a long run', () => {
    let state = newGame('invariant-seed');
    for (let i = 0; i < 120 && !state.end; i++) {
      state = step(state);
      expect(state.party.food).toBeGreaterThanOrEqual(0);
      expect(state.party.firewood).toBeGreaterThanOrEqual(0);
      expect(state.party.morale).toBeGreaterThanOrEqual(0);
      expect(state.party.morale).toBeLessThanOrEqual(100);
      for (const person of state.party.people) {
        expect(person.health).toBeGreaterThanOrEqual(0);
        expect(person.health).toBeLessThanOrEqual(person.maxHealth);
      }
    }
  });
});

describe('the year', () => {
  it('turns from summer through to winter on day 49', () => {
    expect(seasonOf(1)).toBe('summer');
    expect(seasonOf(24)).toBe('summer');
    expect(seasonOf(25)).toBe('autumn');
    expect(seasonOf(49)).toBe('winter');
    expect(seasonOf(73)).toBe('spring');
    expect(daysUntilWinter(1)).toBe(48);
    expect(daysUntilWinter(49)).toBe(0);
  });

  it('the first thaw is a milestone, not the end of the run', () => {
    let state = newGame('survive-seed');
    state = structuredClone(state);
    state.day = SURVIVAL_DAY - 1;
    state.party.food = 999;
    state.party.firewood = 999;
    state = apply(state, { type: 'CAMP' });
    // Until 4.6 this ended the run in victory. Now the year comes round.
    expect(state.end).toBeUndefined();
    expect(state.day).toBe(SURVIVAL_DAY);
    expect(wintersStood(state.day)).toBe(1);
    expect(state.saga.some((e) => e.text.includes('One winter behind us'))).toBe(true);
  });
});

describe('determinism of play', () => {
  it('the same seed and the same choices produce the same run', () => {
    const playOut = (seed: string): GameState => {
      let state = newGame(seed);
      for (let i = 0; i < 40 && !state.end; i++) state = step(state);
      return state;
    };
    expect(encode(playOut('replay-seed'))).toBe(encode(playOut('replay-seed')));
  });
});

describe('the chronicle does not stutter on a quiet stretch', () => {
  /** Walks a band across dull country and returns the lines it wrote. */
  function quietDays(seed: string, days: number): string[] {
    let state = structuredClone(newGame(seed));
    for (let i = 0; i < days && !state.end; i += 1) {
      if (state.event) {
        state = apply(state, { type: 'DISMISS_EVENT' });
        continue;
      }
      const options = moveOptions(state);
      if (options.length === 0) break;
      state = apply(state, { type: 'MOVE', to: options[i % options.length]! });
    }
    return state.saga.map((entry) => entry.text);
  }

  it('never says the same thing twice inside three days', () => {
    // The bug this locks down came off a phone screenshot: three consecutive
    // entries that all read the same, on the screen where the log is the only
    // thing moving.
    let windows = 0;
    let stutters = 0;
    for (let s = 0; s < 40; s += 1) {
      const lines = quietDays(`stutter-${s}`, 40);
      for (let i = 2; i < lines.length; i += 1) {
        windows += 1;
        if (new Set(lines.slice(i - 2, i + 1)).size < 3) stutters += 1;
      }
    }
    expect(windows).toBeGreaterThan(50);
    expect(stutters).toBe(0);
  });

  it('keeps enough phrasings that a fortnight of dull country stays readable', () => {
    // Suppressing repeats is not enough on its own — a pool of four distinct
    // sentences all saying "nothing happened" still reads as one line said
    // four ways. The pool has to be wider than the window that guards it.
    const seen = new Set<string>();
    for (let s = 0; s < 25; s += 1) {
      for (const line of quietDays(`variety-${s}`, 30)) seen.add(line);
    }
    expect(seen.size).toBeGreaterThanOrEqual(12);
  });
});
