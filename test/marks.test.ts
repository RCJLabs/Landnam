// The two pure things render/marks.ts owns that nothing else pins.
//
// This is what survived `terrainArt.test.ts`, which 12.7 deleted with the
// hex-map patterns it mostly measured. Six of its eleven tests were claims
// about the map's lattice — `HEX` is 26, `RECIPES.mountains` fits an inradius
// of 22.5, `terrainFill` names a pattern that is built — and every one of
// them was true of code no document has referenced since 8.5.
//
// The lattice and the scatter are still pinned, and pinned BETTER: they are
// exercised in `test/fieldArt.test.ts` against the battlefield, which is the
// caller that actually exists. Duplicating them here against a fixture
// lattice would be measuring the fixture (CLAUDE.md, trap 1).
//
// What is left over is the colour mix and the wrap. Both are used by the real
// renderers and neither is asserted anywhere else, and both fail SILENTLY —
// a five-character hex string is dropped by the browser without complaint,
// and a mark that should be drawn twice and is drawn once leaves a straight
// seam ruled across the ground every tile width.

import { describe, expect, it } from 'vitest';
import { ALL_TERRAINS, terrainDef } from '../src/data/terrain';
import { copies, mix, type Mark } from '../src/render/marks';

const mark = (x: number, y: number): Mark => ({ x, y, size: 0.5, roll: 0.5 });
const W = 200;
const H = 160;

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

describe('the wrap across a tile edge', () => {
  it('draws a mark once when it reaches no edge', () => {
    expect(copies(mark(60, 52), 8, W, H)).toEqual([{ x: 60, y: 52 }]);
  });

  it('draws it again on the far side when it hangs off one', () => {
    expect(copies(mark(3, 52), 8, W, H)).toEqual([
      { x: 3, y: 52 },
      { x: 3 + W, y: 52 },
    ]);
    expect(copies(mark(W - 3, 52), 8, W, H)).toEqual([
      { x: W - 3, y: 52 },
      { x: W - 3 - W, y: 52 },
    ]);
  });

  it('draws it four times in a corner, which is the case that gets forgotten', () => {
    // Every corner, not just the near one: a wrap that handles the top-left
    // and drops the far edge still returns four here and only here.
    expect(copies(mark(2, 2), 8, W, H)).toHaveLength(4);
    expect(copies(mark(W - 2, H - 2), 8, W, H)).toHaveLength(4);
    expect(copies(mark(2, H - 2), 8, W, H)).toHaveLength(4);
    expect(copies(mark(W - 2, 2), 8, W, H)).toHaveLength(4);
  });

  it('wraps on the tile it is given, not on one it remembers', () => {
    // `copies` defaulted its tile to the travel map's until 12.7, so a caller
    // that forgot the argument silently wrapped on the wrong width. The
    // argument is required now; this is what the default was hiding.
    expect(copies(mark(150, 52), 8, W, H)).toHaveLength(1);
    expect(copies(mark(150, 52), 8, 155, H)).toHaveLength(2);
  });
});
