// The sea as a system: authored decks to fight on, and hulls at stake.
//
// The audit's fifth finding was that a fight afloat was a meadow fight with
// a blue background — the knarr could not be lost, damaged, or fought for.
// The bars here: the sea fields are shaped and linted like the raid fields,
// a fight on ocean ground is fought on one of them, losing puts cargo over
// the side and holes the hull, a holed hull halves the pace and a night
// ashore mends her, and winning strips their hull instead.

import { describe, it, expect } from 'vitest';
import { holed, springStrake } from '../src/sim/ship';
import { SHIP_STRAKES } from '../src/data/ships';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
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
  cell,
} from '../src/sim/battlefield';
import { CARGO_LOST_SHARE, HULL_MEND_WOOD, SEA_SALVAGE, isSeaFight, mendHull, settleSeaFight } from '../src/sim/sea';

// "The knarr is faster than legs" lived here as three hex bars — the ship
// covered `ROW_REACH` hexes of coastal water in the day legs took to cross
// one. A route prices its own legs (`sim/coast.ts`), and the claim is held
// where it now lives: `coastWalk.test.ts` measures a day at the oars putting
// `SHIP_REACH` stretches of coast behind the band, saying so in its own
// words, and refusing a wrecked hull.

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
      const passableAt = (i: number) => isPassable(grid[i]?.ground ?? 'block');
      expect(foeSpots.filter(passableAt).length, field.id).toBeGreaterThanOrEqual(MAX_FOES);
      expect(warbandSpots.filter(passableAt).length, field.id).toBeGreaterThanOrEqual(SWORN_MAX);

      // Somewhere to form a line, and a way between the decks.
      const widest = Math.max(...MIDDLE_ROWS.map((row) => widestStand(grid, row)));
      expect(widest, `${field.id}: nowhere to form up`).toBeGreaterThanOrEqual(FRONT_WIDTH);
      const crossable = Array.from({ length: FIELD_WIDTH }, (_, col) =>
        MIDDLE_ROWS.every((row) => isPassable(grid[cell(col, row)]!.ground)),
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
