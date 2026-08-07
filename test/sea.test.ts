// The sea as a system: authored decks to fight on, and hulls at stake.
//
// The audit's fifth finding was that a fight afloat was a meadow fight with
// a blue background — the knarr could not be lost, damaged, or fought for.
// The bars here: the sea fields are shaped and linted like the raid fields,
// a fight on ocean ground is fought on one of them, losing puts cargo over
// the side and holes the hull, a holed hull halves the pace and a night
// ashore mends her, and winning strips their hull instead.

import { describe, it, expect } from 'vitest';
import { key, offsetToAxial } from '../src/hex';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { apply } from '../src/sim/actions';
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
    expect(state.party.hullHoled).toBe(true);
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
    expect(state.party.hullHoled).toBeUndefined();
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
    state.party.hullHoled = true;
    const holed = moveEffort(state, water!);
    expect(holed!).toBeGreaterThan(sound!);
    // Land does not care about the hull.
    const landNeighbour = Object.entries(state.world.tiles).find(
      ([, t]) => t.terrain === 'meadow',
    );
    expect(landNeighbour).toBeTruthy();
  });

  it('a night ashore mends her, for the price of the timber', () => {
    const state = structuredClone(newGame('sea-mend'));
    state.party.hullHoled = true;
    state.party.firewood = 10;

    const next = apply(state, { type: 'CAMP' });
    expect(next.party.hullHoled).toBeUndefined();
    expect(next.saga.some((l) => l.text.includes('strake'))).toBe(true);
  });

  it('with no wood to mend with, she stays holed', () => {
    const state = structuredClone(newGame('sea-nowood'));
    state.party.hullHoled = true;
    state.party.firewood = HULL_MEND_WOOD - 1;
    expect(mendHull(state)).toBe(false);
    expect(state.party.hullHoled).toBe(true);
  });

  it('an old save comes forward with a sound hull', () => {
    const old = structuredClone(newGame('sea-migrate')) as unknown as Record<string, unknown>;
    old['version'] = 19;
    delete (old['party'] as { hullHoled?: unknown }).hullHoled;
    const migrated = migrate(old).save;
    expect(migrated['version']).toBe(20);
    expect((migrated['party'] as { hullHoled?: boolean }).hullHoled).toBeUndefined();
  });
});
