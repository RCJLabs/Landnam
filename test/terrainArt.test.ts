// The terrain texture's pure half.
//
// The patterns themselves are SVG and the suite has no DOM, so what is pinned
// here is everything underneath them: the colour maths, the scatter, and the
// wrap. Those are where a fault would be SILENT — a seam ruled across the
// country, or a bald patch in a forest, is invisible to a type checker and
// invisible to every other test in this repo, and would be found by somebody
// looking at a map and wondering what was wrong with it.

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/rng';
import { ALL_TERRAINS, terrainDef } from '../src/data/terrain';
import {
  copies,
  mix,
  patternId,
  RECIPES,
  scatter,
  terrainFill,
  TILE_H,
  TILE_W,
  type Mark,
} from '../src/render/terrainArt';

const mark = (x: number, y: number): Mark => ({ x, y, size: 0.5, roll: 0.5 });

describe('the colour a mark is drawn in', () => {
  it('mixes towards a colour without drifting off the ends', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('always produces a six-digit hex, whatever the channels round to', () => {
    // A channel that rounds to a single digit has to be padded, or the string
    // is five characters long and the browser silently drops the whole fill.
    for (const terrain of ALL_TERRAINS) {
      for (const amount of [0.1, 0.25, 0.34, 0.5, 0.72]) {
        for (const towards of ['#000000', '#ffffff']) {
          const def = terrainDef(terrain);
          expect(mix(def.fill, towards, amount)).toMatch(/^#[0-9a-f]{6}$/);
          expect(mix(def.edge, towards, amount)).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});

describe('where the marks land', () => {
  it('puts one in every cell, so no hex-sized hole is ever left', () => {
    expect(scatter(makeRng('t'), 6, 5, 1)).toHaveLength(30);
  });

  it('keeps every mark inside the tile it belongs to', () => {
    // Jitter is bounded by half a cell, so a mark can reach a tile edge but
    // never crosses one — the wrap below is what handles the overhang, and it
    // assumes the mark's own point is in the tile.
    for (const m of scatter(makeRng('bounds'), 7, 6, 1)) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThanOrEqual(TILE_W);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThanOrEqual(TILE_H);
    }
  });

  it('is the same scatter every time, so the map is not a new place each paint', () => {
    expect(scatter(makeRng('same'), 4, 4, 0.9)).toEqual(scatter(makeRng('same'), 4, 4, 0.9));
  });
});

describe('the wrap across a tile edge', () => {
  it('draws a mark once when it reaches no edge', () => {
    expect(copies(mark(60, 52), 8)).toEqual([{ x: 60, y: 52 }]);
  });

  it('draws it again on the far side when it hangs off one', () => {
    expect(copies(mark(3, 52), 8)).toEqual([
      { x: 3, y: 52 },
      { x: 3 + TILE_W, y: 52 },
    ]);
    expect(copies(mark(TILE_W - 3, 52), 8)).toEqual([
      { x: TILE_W - 3, y: 52 },
      { x: TILE_W - 3 - TILE_W, y: 52 },
    ]);
  });

  it('draws it four times in a corner, which is the case that gets forgotten', () => {
    // Both corners, not just the near one: a wrap that handles the top-left
    // and drops the far edge still returns four here and only here.
    expect(copies(mark(2, 2), 8)).toHaveLength(4);
    expect(copies(mark(TILE_W - 2, TILE_H - 2), 8)).toHaveLength(4);
    expect(copies(mark(2, TILE_H - 2), 8)).toHaveLength(4);
  });

  it('reaches far enough for every recipe to cover its own marks', () => {
    // A `reach` smaller than the mark it describes is the quiet fault: the
    // mark is drawn once, its overhang is clipped, and a straight seam
    // appears every tile width across an otherwise continuous country. These
    // bounds are the widest each recipe can draw at size = 1.
    const widest: Record<string, number> = {
      ocean: 9, // w = 5 + 4, drawn from -w to +w
      shore: 3, // r * 1.3 at most
      meadow: 7, // h * 1.25 upward at h = 8
      forest: 8, // half-width and the crown's height
      hills: 14, // w = 9 + 5
      mountains: 20, // h * 0.72 across, h * 0.6 up at h = 21
      bog: 6, // pool rx = 4.5 + 4.5
      valley: 15, // w = 10 + 5
    };
    for (const terrain of ALL_TERRAINS) {
      expect(RECIPES[terrain].reach).toBeGreaterThanOrEqual(widest[terrain]!);
    }
  });
});

describe('what a hex asks for', () => {
  it('names a pattern that is actually built, bright and dim', () => {
    for (const terrain of ALL_TERRAINS) {
      expect(terrainFill(terrain, true)).toBe(`url(#${patternId(terrain, false)})`);
      expect(terrainFill(terrain, false)).toBe(`url(#${patternId(terrain, true)})`);
    }
  });

  it('gives every terrain a recipe — including one added later', () => {
    // ALL_TERRAINS is derived from the terrain table, so a terrain added there
    // and forgotten here fails this rather than painting a blank hex.
    for (const terrain of ALL_TERRAINS) {
      expect(RECIPES[terrain]).toBeDefined();
    }
  });
});
