// Taking the land again.
//
// A saga used to stop at five winters — measured, day 457, jarldom or no
// jarldom — because `checkRunEnd` said "the run has to stop somewhere". That
// was right while there was one coast. A landnám is a thing people did more
// than once: a coast gives what it has and then a household goes back on the
// ship and takes land somewhere else.
//
// This is also what unblocks the question the households work could not
// answer. It does not by itself make children grow up — a generation is still
// sixteen years — but a saga is no longer capped at four years and ten
// months, which is the premise that made it impossible.

import { describe, expect, it } from 'vitest';
import { settled as settleSomewhere } from './fixtures/settle';
import { LONG_LIFE_WINTERS } from '../src/data/thing';
import { YEAR_LENGTH, wintersStood } from '../src/sim/calendar';
import { checkRunEnd } from '../src/sim/upkeep';
import {
  RECKONED,
  canSailOn,
  landnamNumber,
  layDownSaga,
  markReckoning,
  reckoningDue,
  sailOn,
  sailOnBlocker,
} from '../src/sim/landnam';
import { hold } from '../src/sim/ship';
import { living } from '../src/sim/people';
import { key } from '../src/hex';
import type { GameState } from '../src/state/types';
import { RETIRED_WITH_THE_HEXES } from './fixtures/hexOnly';

function hall(seed = 'landnam'): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  state.party.at = state.settlement!.at;
  state.party.food = 300;
  state.party.firewood = 300;
  return state;
}

/** The day the fifth winter has been stood. */
function reckoningDay(): number {
  for (let d = 1; d < YEAR_LENGTH * 12; d++) {
    if (wintersStood(d) >= LONG_LIFE_WINTERS) return d;
  }
  throw new Error('never reached the reckoning');
}

describe('five winters is a reckoning, not an ending', () => {
  it('no longer ends the run by itself', () => {
    const state = hall('landnam-noend');
    state.day = reckoningDay();
    checkRunEnd(state, 1);
    // The rule that used to fire here wrote `survived` and stopped everything.
    expect(state.end).toBeUndefined();
    expect(reckoningDue(state)).toBe(true);
    expect(state.flags[RECKONED]).toBe(state.day);
  });

  it('still lets a band starve or break after it', () => {
    // The early return that would have made five winters a kind of
    // immortality. A band past the reckoning is not safe from anything.
    const state = hall('landnam-mortal');
    state.day = reckoningDay();
    for (const p of state.party.people) p.alive = false;
    checkRunEnd(state, 1);
    expect(state.end).toBeDefined();

    const broken = hall('landnam-broken');
    broken.day = reckoningDay();
    broken.party.morale = 0;
    broken.party.food = 0;
    checkRunEnd(broken, 1);
    expect(broken.end).toBeDefined();
  });

  it('says it once, not every day after', () => {
    const state = hall('landnam-once');
    state.day = reckoningDay();
    expect(markReckoning(state)).toBe(true);
    state.day += 1;
    expect(markReckoning(state)).toBe(false);
  });
});

describe('laying it down is a deed now', () => {
  it('writes the ending the rule used to force', () => {
    const state = hall('landnam-down');
    state.day = reckoningDay();
    expect(layDownSaga(state)).toBe(true);
    expect(state.end?.cause).toBe('survived');
    expect(state.end?.lines.join(' ')).toContain('winters');
  });

  it('is not on offer before the coast is finished', () => {
    const state = hall('landnam-early');
    state.day = 40;
    expect(reckoningDue(state)).toBe(false);
    expect(layDownSaga(state)).toBe(false);
    expect(sailOnBlocker(state)).toBe('notyet');
  });
});

describe('taking the land again', () => {
  it('refuses on a hull that will not swim, or with people out', () => {
    const state = hall('landnam-gates');
    state.day = reckoningDay();
    expect(canSailOn(state)).toBe(true);

    state.ship.strakes = 0;
    expect(sailOnBlocker(state)).toBe('hull');
    state.ship.strakes = 2;

    state.expedition = { members: [], purpose: 'trade', launchedOn: 1, carried: 0 };
    expect(sailOnBlocker(state)).toBe('busy');
  });

  it('gives a whole new country, and keeps the band that crossed to it', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = hall('landnam-sail');
    state.day = reckoningDay();
    const crew = living(state.party.people).map((p) => p.id).sort();
    const oldWorld = Object.keys(state.world.tiles).length;
    const oldLanding = key(state.world.landing);

    expect(sailOn(state)).toBe(true);

    // A new coast, not the old one dressed up.
    expect(state.world.tiles).toBeDefined();
    expect(Object.keys(state.world.tiles).length).toBe(oldWorld);
    expect(key(state.world.landing)).not.toBe(oldLanding);
    expect(key(state.party.at)).toBe(key(state.world.landing));
    // The band and its memory cross; the coast does not.
    expect(living(state.party.people).map((p) => p.id).sort()).toEqual(crew);
    expect(state.settlement).toBeUndefined();
    expect(state.rival).toBeUndefined();
    expect(state.neighbours.length).toBeGreaterThan(0);
    expect(landnamNumber(state)).toBe(2);
    // And the saga goes on: this is not an ending.
    expect(state.end).toBeUndefined();
    expect(state.flags[RECKONED]).toBeUndefined();
  });

  it('carries only what she holds, which is the cost', () => {
    const state = hall('landnam-cargo');
    state.day = reckoningDay();
    state.party.food = 500;
    state.party.firewood = 500;
    const room = hold(state.ship);
    sailOn(state);
    // Five winters of stores do not fit in a knarr.
    expect(state.party.food + state.party.firewood).toBeLessThanOrEqual(room);
    expect(state.party.food).toBeGreaterThan(0);
  });

  it('leaves the man we drove out on the island he was driven onto', () => {
    const state = hall('landnam-outlaw');
    state.day = reckoningDay();
    state.outlaws = [{ id: 'p1', name: 'Ulf', since: 20, might: 4 }];
    sailOn(state);
    expect(state.outlaws).toBeUndefined();
  });

  it('finds the same second island on a replay', () => {
    const a = hall('landnam-same');
    const b = hall('landnam-same');
    a.day = reckoningDay();
    b.day = reckoningDay();
    sailOn(a);
    sailOn(b);
    // Derived from the run seed and which landnám this is, like everything
    // else in this game that has to survive a replay.
    expect(key(a.world.landing)).toBe(key(b.world.landing));
    expect(a.world.landingName).toBe(b.world.landingName);
  });

  it('can be done again, and counts', () => {
    const state = hall('landnam-again');
    state.day = reckoningDay();
    sailOn(state);
    expect(landnamNumber(state)).toBe(2);
    // The reckoning comes round again on the new coast when its winters are
    // stood — the count is of coasts, and the clock does not reset.
    expect(reckoningDue(state)).toBe(true);
    sailOn(state);
    expect(landnamNumber(state)).toBe(3);
  });
});

describe('what this unblocks', () => {
  it('lifts the cap that made a generation impossible', () => {
    // The households work measured this and stopped: a run ended at day 457,
    // four years and ten months, while a generation is sixteen years. That
    // premise is gone — a saga can now run as long as the player keeps
    // taking land. It does not by itself grow anybody up, and nothing here
    // claims it does.
    const state = hall('landnam-cap');
    state.day = reckoningDay();
    checkRunEnd(state, 1);
    expect(state.end).toBeUndefined();
    // Play on well past the old wall.
    state.day = YEAR_LENGTH * 8;
    checkRunEnd(state, 1);
    expect(state.end).toBeUndefined();
  });
});
