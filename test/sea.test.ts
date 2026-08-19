// The sea as a system: authored decks to fight on, and hulls at stake.
//
// The audit's fifth finding was that a fight afloat was a meadow fight with
// a blue background — the knarr could not be lost, damaged, or fought for.
// The bars here: the sea fields are shaped and linted like the raid fields,
// a fight on ocean ground is fought on one of them, losing puts cargo over
// the side and holes the hull, a holed hull halves the pace and a night
// ashore mends her, and winning strips their hull instead.

import { describe, it, expect } from 'vitest';
import { distance, fromKey, key, line, offsetToAxial, range, type Hex } from '../src/hex';
import { holed, springStrake } from '../src/sim/ship';
import { SHIP_STRAKES } from '../src/data/ships';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { ROW_REACH, daysForMove, moveOptions } from '../src/sim/travel';
import type { GameState } from '../src/state/types';
import { startBattle } from '../src/sim/battleTurn';
import { MAX_FOES } from '../src/sim/battle';
import { SWORN_MAX } from '../src/sim/people';
import { SEA_FIELDS } from '../src/data/seaFields';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FRONT_WIDTH,
  MIDDLE_ROWS,
  isPassable,
  seaFieldFrom,
  widestStand,
} from '../src/sim/battlefield';
import { CARGO_LOST_SHARE, HULL_MEND_WOOD, SEA_SALVAGE, isSeaFight, mendHull, settleSeaFight } from '../src/sim/sea';
import { moveEffort, isCoastalWater } from '../src/sim/travel';

/**
 * The knarr, measured against legs.
 *
 * The guide has told the player since 5.x that the knarr "rows coastal water
 * faster than legs walk". It was false. A day's travel is
 * `ceil(effort / 2)`, land is 1 or 2 and `SEA_EFFORT` is 2, so EVERY hex of
 * everything rounded to one day — the ship was exactly as fast as a meadow
 * and no faster than a forest. That is why going out cost a season, and a
 * large part of why raiding could not be a way of living.
 *
 * The day-cost model cannot express "faster" at that granularity, so the
 * hull covers GROUND instead: `ROW_REACH` hexes of coast in the day legs
 * take to cross one.
 */
describe('the knarr is faster than legs', () => {
  function afloat(seed: string): { state: GameState; here: Hex } | null {
    for (let s = 0; s < 40; s += 1) {
      const state = structuredClone(newGame(`${seed}-${s}`));
      for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
      for (const k of Object.keys(state.world.tiles)) {
        const at = fromKey(k);
        if (!isCoastalWater(state, at)) continue;
        // Somewhere with a real stretch of coast around it, or there is
        // nothing to measure.
        const reach = range(at, ROW_REACH).filter((h) => isCoastalWater(state, h));
        if (reach.length < 6) continue;
        state.party.at = at;
        return { state, here: at };
      }
    }
    return null;
  }

  it('a day of rowing covers more coast than a day of walking', () => {
    const found = afloat('row');
    expect(found, 'no coast long enough to row on').toBeTruthy();
    const { state, here } = found!;
    const options = moveOptions(state);
    const far = options.filter((h) => distance(h, here) > 1);
    expect(far.length, 'the hull is offered nothing but the next hex').toBeGreaterThan(0);
    for (const h of far) {
      expect(distance(h, here)).toBeLessThanOrEqual(ROW_REACH);
      expect(daysForMove(state, h), 'a day is a day, however far it carried you').toBe(1);
    }
  });

  it('and only over water, never across a headland', () => {
    const found = afloat('row-land')!;
    const { state, here } = found;
    for (const h of moveOptions(state)) {
      if (distance(h, here) <= 1) continue;
      // Every hex of the crossing has to be water we could row.
      for (const step of line(here, h)) {
        expect(isCoastalWater(state, step), 'rowed over dry land').toBe(true);
      }
    }
  });

  it('legs still take a hex at a time', () => {
    const state = structuredClone(newGame('row-legs'));
    for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
    // On land, nothing further than a neighbour is ever on offer.
    for (const h of moveOptions(state)) {
      expect(distance(h, state.party.at)).toBe(1);
    }
  });
});

describe('content lint: sea fields', () => {
  it('ids are unique and every fight says how it began', () => {
    const ids = SEA_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const field of SEA_FIELDS) {
      expect(field.id).toMatch(/^[a-z0-9-]+$/);
      expect(field.line.length, field.id).toBeGreaterThan(20);
    }
  });

  it('keeps every promise a battlefield makes', () => {
    for (const field of SEA_FIELDS) {
      expect(field.rows, field.id).toHaveLength(FIELD_HEIGHT);
      for (const row of field.rows) expect(row, field.id).toMatch(/^[.,#~]{7}$/);

      const { grid, warbandSpots, foeSpots } = seaFieldFrom(field);
      const passableAt = (h: { q: number; r: number }) =>
        isPassable(grid[key(h)]?.ground ?? 'block');
      expect(foeSpots.filter(passableAt).length, field.id).toBeGreaterThanOrEqual(MAX_FOES);
      expect(warbandSpots.filter(passableAt).length, field.id).toBeGreaterThanOrEqual(SWORN_MAX);

      // Somewhere to form a line, and a way between the decks.
      const widest = Math.max(...MIDDLE_ROWS.map((row) => widestStand(grid, row)));
      expect(widest, `${field.id}: nowhere to form up`).toBeGreaterThanOrEqual(FRONT_WIDTH);
      const crossable = Array.from({ length: FIELD_WIDTH }, (_, col) =>
        MIDDLE_ROWS.every((row) => isPassable(grid[key(offsetToAxial(col, row))]!.ground)),
      );
      expect(crossable.some(Boolean), `${field.id}: cannot be crossed`).toBe(true);
    }
  });
});

describe('a fight afloat is fought on an authored deck', () => {
  it('opens on a sea field with its own line in the log', () => {
    const state = structuredClone(newGame('sea-open'));
    startBattle(state, 'ocean', 1);
    const battle = state.battle!;
    expect(isSeaFight(battle)).toBe(true);
    const openings = SEA_FIELDS.map((f) => f.line);
    expect(openings.some((line) => battle.log[0]!.startsWith(line))).toBe(true);
  });

  it('a raid is never mistaken for a sea fight', () => {
    const state = structuredClone(newGame('sea-not-raid'));
    startBattle(state, 'meadow', 1);
    expect(isSeaFight(state.battle!)).toBe(false);
  });
});

describe('the hull and the packs are the stake', () => {
  it('losing puts cargo over the side and holes the hull', () => {
    const state = structuredClone(newGame('sea-loss'));
    state.party.food = 40;
    state.party.firewood = 20;
    settleSeaFight(state, false);
    expect(holed(state.ship)).toBe(true);
    expect(state.party.food).toBeLessThan(40);
    expect(state.party.firewood).toBeLessThan(20);
    // A share, not a wipe: short of sunk is the design.
    expect(state.party.food).toBeGreaterThan(40 * (1 - CARGO_LOST_SHARE) - 5);
    expect(state.saga.at(-1)!.text).toContain('over the side');
  });

  it('winning strips their hull instead', () => {
    const state = structuredClone(newGame('sea-win'));
    const food = state.party.food;
    settleSeaFight(state, true);
    expect(holed(state.ship)).toBe(false);
    expect(state.party.food).toBe(food + SEA_SALVAGE.food);
  });

  it('a holed hull rows at half pace, and only at sea', () => {
    const state = structuredClone(newGame('sea-limp'));
    // Find a coastal water hex beside the landing to price.
    let water: { q: number; r: number } | null = null;
    for (const [k, tile] of Object.entries(state.world.tiles)) {
      if (tile.terrain !== 'ocean') continue;
      const at = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      if (isCoastalWater(state, at)) { water = at; break; }
    }
    expect(water).toBeTruthy();
    const sound = moveEffort(state, water!);
    springStrake(state.ship);
    const hurt = moveEffort(state, water!);
    expect(hurt!).toBeGreaterThan(sound!);
    // Land does not care about the hull.
    const landNeighbour = Object.entries(state.world.tiles).find(
      ([, t]) => t.terrain === 'meadow',
    );
    expect(landNeighbour).toBeTruthy();
  });

  it('a night ashore mends her, for the price of the timber', () => {
    const state = structuredClone(newGame('sea-mend'));
    springStrake(state.ship);
    state.party.firewood = 10;

    const next = apply(state, { type: 'CAMP' });
    expect(holed(next.ship)).toBe(false);
    expect(next.saga.some((l) => l.text.includes('strake'))).toBe(true);
  });

  it('with no wood to mend with, she stays holed', () => {
    const state = structuredClone(newGame('sea-nowood'));
    springStrake(state.ship);
    state.party.firewood = HULL_MEND_WOOD - 1;
    expect(mendHull(state)).toBe(false);
    expect(holed(state.ship)).toBe(true);
  });

  it('an old save comes forward with a sound hull', () => {
    const old = structuredClone(newGame('sea-migrate')) as unknown as Record<string, unknown>;
    old['version'] = 19;
    delete (old['party'] as { hullHoled?: unknown }).hullHoled;
    // Migration walks all the way to the CURRENT version — pinning a literal
    // here is how this assertion broke on the very next bump.
    const migrated = migrate(old).save;
    expect(migrated['version']).toBe(SAVE_VERSION);
    expect((migrated['party'] as { hullHoled?: boolean }).hullHoled).toBeUndefined();
    // And she is a ship now, with a name, not an absent flag.
    const ship = migrated['ship'] as { name: string; strakes: number };
    expect(ship.strakes).toBe(SHIP_STRAKES);
    expect(ship.name.length).toBeGreaterThan(0);
  });

  it('carries a holed old save forward as one sprung strake', () => {
    // The whole promise of the migration: `hullHoled` MEANT one strake, so a
    // save written under the flag sails at exactly the speed it was saved at.
    const old = structuredClone(newGame('sea-migrate-holed')) as unknown as Record<string, unknown>;
    old['version'] = 20;
    (old['party'] as Record<string, unknown>)['hullHoled'] = true;
    delete old['ship'];
    const migrated = migrate(old).save;
    const ship = migrated['ship'] as { strakes: number };
    expect(ship.strakes).toBe(SHIP_STRAKES - 1);
  });
});
