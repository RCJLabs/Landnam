// The battlefield's ground patterns, held to the same bars the travel map's
// are — because the travel map already paid for these lessons with a real
// phone bug ("the mountains and trees are in the hexes weird") and a repaint
// that grew with the map.

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/rng';
import { scatter } from '../src/render/terrainArt';
import {
  FIELD_CENTRES,
  FIELD_HEX,
  FIELD_INRADIUS,
  FIELD_RECIPES,
  FIELD_TILE_H,
  FIELD_TILE_W,
  fieldFill,
  fieldPatternId,
  footingOf,
  openBase,
} from '../src/render/fieldArt';
import { ALL_TERRAINS } from '../src/data/terrain';

describe('the field lattice', () => {
  it('tiles on the battle hex, not the travel one', () => {
    // battle.ts imports FIELD_HEX, so the grid and the pattern lattice
    // cannot drift — but the tile has to close over that hex or the seams
    // rule lines across the field.
    expect(FIELD_TILE_W).toBeCloseTo(2 * Math.sqrt(3) * FIELD_HEX, 10);
    expect(FIELD_TILE_H).toBeCloseTo(4 * 1.5 * FIELD_HEX, 10);
  });

  it('gives every hex in the tile its own centre', () => {
    // Two columns by four rows is the smallest tile that closes: eight.
    expect(FIELD_CENTRES).toHaveLength(8);
  });
});

describe('no mark may reach past the inradius', () => {
  // The bar the phone bug wrote: a hex fill is CLIPPED by the hex, so a mark
  // placed `spread` out with `reach` past its point gets sliced in half by
  // the edge and reads as a mistake. Held by construction for every ground.
  for (const [ground, spec] of Object.entries(FIELD_RECIPES)) {
    it(`${ground} stays inside its hex`, () => {
      expect(spec.spread + spec.reach).toBeLessThanOrEqual(FIELD_INRADIUS);
    });
  }
});

describe('the scatter is the same field every time', () => {
  it('is deterministic, so a repaint is not a new country', () => {
    const a = scatter(makeRng('landnam-field-art').derive('open:shore'), 6, 17, FIELD_CENTRES);
    const b = scatter(makeRng('landnam-field-art').derive('open:shore'), 6, 17, FIELD_CENTRES);
    expect(a).toEqual(b);
  });
});

describe('open ground belongs to its country', () => {
  it('maps every terrain a fight can stand on to a footing', () => {
    for (const terrain of ALL_TERRAINS) {
      expect(['grass', 'sand', 'stone']).toContain(footingOf(terrain));
    }
  });

  it('gives every terrain its own open pattern, and the rest one each', () => {
    for (const terrain of ALL_TERRAINS) {
      expect(fieldFill('open', terrain)).toBe(`url(#field-open-${terrain})`);
    }
    // Non-open grounds look the same whatever the country: one pattern each,
    // whatever terrain is passed alongside.
    expect(fieldPatternId('rough', 'shore')).toBe(fieldPatternId('rough', 'meadow'));
  });

  it('derives a base colour for every terrain without throwing', () => {
    for (const terrain of ALL_TERRAINS) {
      expect(openBase(terrain)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
