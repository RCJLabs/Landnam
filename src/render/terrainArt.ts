// Procedural terrain texture: one repeating pattern per terrain, built once
// into the map's <defs> and referenced by every hex that stands on it.
//
// WHY A PATTERN AND NOT GLYPHS. Mountains, forest and hills used to get a
// little group of paths appended per hex, which meant the map's texture cost
// grew with the number of hexes the band had seen — and `paint()` rebuilds
// every seen hex on every repaint, so late in a run that was some hundreds of
// extra nodes destroyed and recreated per action. A <pattern> is rasterised
// once by the browser and referenced by a fill string, so eight textured
// terrains now cost FEWER nodes than three did.
//
// WHY THE TILE IS NOT A WHOLE NUMBER OF HEXES. 120 x 104 map units against a
// hex 45 across on rows 39 apart is about two and two-thirds each way, so the
// pattern lands somewhere different on every hex. A tile that fitted the grid
// exactly would stamp the same three trees on every forest and read as
// wallpaper rather than as country.
//
// Marks are jittered, and the jitter comes off the seeded RNG with a fixed
// label — `Math.random` is banned (CLAUDE.md) and this is decoration, so it
// takes no run stream and looks the same in every game.

import { makeRng, type Rng } from '../rng';
import { ALL_TERRAINS, terrainDef } from '../data/terrain';
import { svgEl } from './svg';
import type { Terrain } from '../state/types';

export const TILE_W = 120;
export const TILE_H = 104;

/** The fill for a hex: the terrain's pattern, dimmed if merely remembered. */
export function terrainFill(terrain: Terrain, visible: boolean): string {
  return `url(#${patternId(terrain, !visible)})`;
}

export function patternId(terrain: Terrain, dim: boolean): string {
  return `terrain-${terrain}${dim ? '-dim' : ''}`;
}

// ---- colour ----

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes `amount` of `towards` into `hex`. The only colour maths here. */
export function mix(hex: string, towards: string, amount: number): string {
  const a = channels(hex);
  const b = channels(towards);
  const out = a.map((v, i) => Math.round(v + (b[i]! - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const lighten = (hex: string, amount: number): string => mix(hex, '#ffffff', amount);
const darken = (hex: string, amount: number): string => mix(hex, '#000000', amount);

// ---- marks ----

/**
 * One mark's placement and its two rolls.
 *
 * The rolls are drawn ONCE, when the mark is scattered, and not while it is
 * being drawn — because a mark near an edge is drawn several times so it can
 * wrap, and those copies have to be identical or the seam shows.
 */
export interface Mark {
  x: number;
  y: number;
  /** 0..1, for size. */
  size: number;
  /** 0..1, for whatever else the recipe wants to vary. */
  roll: number;
}

/**
 * Marks on a jittered grid rather than uniformly at random.
 *
 * Uniform scatter clumps — it leaves bald patches and clusters that read as
 * mistakes at map scale. One mark per cell, jittered inside it, keeps the
 * spacing organic without ever leaving a hex-sized hole.
 */
export function scatter(rng: Rng, cols: number, rows: number, jitter: number): Mark[] {
  const cellW = TILE_W / cols;
  const cellH = TILE_H / rows;
  const marks: Mark[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      marks.push({
        x: (col + 0.5) * cellW + rng.float(-1, 1) * jitter * cellW * 0.5,
        y: (row + 0.5) * cellH + rng.float(-1, 1) * jitter * cellH * 0.5,
        size: rng.next(),
        roll: rng.next(),
      });
    }
  }
  return marks;
}

/**
 * Every place one mark has to be drawn: its own, and again across any edge
 * it reaches over.
 *
 * A pattern tile does not wrap its contents. Anything hanging off the right
 * edge is simply clipped and the next tile starts empty, so the seam reads as
 * a straight line ruled across the country — drawing the overhang again on
 * the far side is what makes the texture continuous.
 *
 * Returned as positions rather than drawn here so the wrap can be tested
 * without a DOM, which is the whole of what could go silently wrong: a mark
 * that should appear twice and appears once leaves a seam nobody sees until
 * they are looking at a map.
 */
export function copies(mark: Mark, reach: number): { x: number; y: number }[] {
  const xs = [mark.x];
  if (mark.x - reach < 0) xs.push(mark.x + TILE_W);
  if (mark.x + reach > TILE_W) xs.push(mark.x - TILE_W);
  const ys = [mark.y];
  if (mark.y - reach < 0) ys.push(mark.y + TILE_H);
  if (mark.y + reach > TILE_H) ys.push(mark.y - TILE_H);
  const out: { x: number; y: number }[] = [];
  for (const x of xs) {
    for (const y of ys) out.push({ x, y });
  }
  return out;
}

// ---- the recipes ----

interface Recipe {
  cols: number;
  rows: number;
  jitter: number;
  /** How far a mark reaches from its point, for the wrap. */
  reach: number;
  draw(x: number, y: number, mark: Mark, base: string): SVGElement[];
}

const stroke = (d: string, ink: string, width: number, opacity: number): SVGElement =>
  svgEl('path', {
    d,
    fill: 'none',
    stroke: ink,
    'stroke-width': width,
    'stroke-linecap': 'round',
    opacity,
  });

export const RECIPES: Record<Terrain, Recipe> = {
  // Chop, not waves: short broken crests, lighter than the water.
  ocean: {
    cols: 6,
    rows: 7,
    jitter: 0.9,
    reach: 9,
    draw(x, y, mark, base) {
      const w = 5 + mark.size * 4;
      return [
        stroke(
          `M ${x - w} ${y} q ${w * 0.5} ${-2.2} ${w} 0 q ${w * 0.5} ${2.2} ${w} 0`,
          lighten(base, 0.34),
          1.2,
          0.55 + mark.roll * 0.25,
        ),
      ];
    },
  },

  // Sand and shingle: stipple, with the odd darker pebble.
  shore: {
    cols: 7,
    rows: 6,
    jitter: 1,
    reach: 4,
    draw(x, y, mark, base) {
      const r = 0.9 + mark.size * 1.3;
      const pebble = mark.roll > 0.72;
      return [
        svgEl('circle', {
          cx: x,
          cy: y,
          r: pebble ? r * 1.3 : r,
          fill: pebble ? darken(base, 0.34) : lighten(base, 0.3),
          opacity: pebble ? 0.7 : 0.6,
        }),
      ];
    },
  },

  // Grazing: sparse tufts, each three strokes fanning off one root.
  meadow: {
    cols: 6,
    rows: 5,
    jitter: 1,
    reach: 7,
    draw(x, y, mark, base) {
      const h = 4.5 + mark.size * 3.5;
      const ink = mark.roll > 0.5 ? lighten(base, 0.42) : darken(base, 0.32);
      return [
        stroke(
          `M ${x} ${y} l ${-h * 0.55} ${-h} M ${x} ${y} l 0 ${-h * 1.25} M ${x} ${y} l ${h * 0.55} ${-h * 0.9}`,
          ink,
          1.2,
          0.72,
        ),
      ];
    },
  },

  // Conifers: a crown and a trunk, in the ink the old per-hex glyphs used.
  forest: {
    cols: 6,
    rows: 5,
    jitter: 0.95,
    reach: 8,
    draw(x, y, mark, base) {
      const h = 7 + mark.size * 4;
      const w = h * 0.42;
      const crown = darken(base, 0.42);
      return [
        stroke(`M ${x} ${y + h * 0.5} l 0 ${h * 0.22}`, darken(base, 0.45), 1, 0.7),
        svgEl('path', {
          d: `M ${x} ${y - h * 0.5} L ${x + w} ${y + h * 0.5} L ${x - w} ${y + h * 0.5} Z`,
          fill: crown,
          opacity: 0.82 + mark.roll * 0.16,
        }),
      ];
    },
  },

  // Rolling ground: overlapping mounds, lit from the north-west.
  hills: {
    cols: 4,
    rows: 4,
    jitter: 0.9,
    reach: 16,
    draw(x, y, mark, base) {
      const w = 9 + mark.size * 5;
      return [
        svgEl('path', {
          d: `M ${x - w} ${y} q ${w} ${-w * 0.9} ${w * 2} 0 Z`,
          fill: darken(base, 0.34),
          opacity: 0.8,
        }),
        stroke(
          `M ${x - w * 0.85} ${y - w * 0.06} q ${w * 0.85} ${-w * 0.72} ${w * 1.7} 0`,
          lighten(base, 0.45),
          1.5,
          0.75,
        ),
      ];
    },
  },

  // Peaks with snow on them — the one terrain that must never be mistaken.
  // Two faces and a ragged cap: a flat triangle at map scale reads as a
  // shard of something, not as a mountain. The light comes from the west,
  // which is where the sea is and where every landing looks back towards.
  mountains: {
    cols: 3,
    rows: 3,
    jitter: 0.75,
    reach: 20,
    draw(x, y, mark, base) {
      const h = 14 + mark.size * 7;
      const w = h * 0.72;
      const apex = y - h * 0.6;
      const foot = y + h * 0.45;
      const cap = h * 0.34;
      const capW = w * 0.42;
      return [
        svgEl('path', {
          d: `M ${x} ${apex} L ${x + w} ${foot} L ${x - w} ${foot} Z`,
          fill: darken(base, 0.38),
          opacity: 0.95,
        }),
        svgEl('path', {
          d: `M ${x} ${apex} L ${x} ${foot} L ${x - w} ${foot} Z`,
          fill: lighten(base, 0.24),
          opacity: 0.95,
        }),
        svgEl('path', {
          d:
            `M ${x} ${apex} L ${x + capW} ${apex + cap} L ${x + capW * 0.42} ${apex + cap * 0.66}` +
            ` L ${x + capW * 0.08} ${apex + cap * 1.15} L ${x - capW * 0.4} ${apex + cap * 0.7}` +
            ` L ${x - capW} ${apex + cap} Z`,
          fill: '#e6e9ec',
          opacity: 0.92,
        }),
      ];
    },
  },

  // Standing water and tussock — dark pools, and reeds standing out of them.
  bog: {
    cols: 6,
    rows: 5,
    jitter: 1,
    reach: 7,
    draw(x, y, mark, base) {
      if (mark.roll > 0.34) {
        const rx = 4.5 + mark.size * 4.5;
        return [
          svgEl('ellipse', {
            cx: x,
            cy: y,
            rx,
            ry: rx * 0.5,
            fill: darken(base, 0.5),
            opacity: 0.85,
          }),
          stroke(
            `M ${x - rx * 0.6} ${y - rx * 0.34} q ${rx * 0.6} ${-1.6} ${rx * 1.2} 0`,
            lighten(base, 0.3),
            0.9,
            0.5,
          ),
        ];
      }
      const h = 3.5 + mark.size * 2;
      return [
        stroke(
          `M ${x - 1.8} ${y} l 0.8 ${-h} M ${x + 0.4} ${y} l 0.2 ${-h * 1.2} M ${x + 2.4} ${y} l -0.6 ${-h * 0.85}`,
          lighten(base, 0.34),
          0.9,
          0.6,
        ),
      ];
    },
  },

  // Sheltered and worked: long furrows with the odd tuft between them.
  valley: {
    cols: 5,
    rows: 5,
    jitter: 0.75,
    reach: 16,
    draw(x, y, mark, base) {
      const w = 10 + mark.size * 5;
      return [
        stroke(
          `M ${x - w} ${y} q ${w * 0.5} ${-3.2} ${w} 0 q ${w * 0.5} ${3.2} ${w} 0`,
          mark.roll > 0.5 ? lighten(base, 0.4) : darken(base, 0.3),
          1.9,
          0.8,
        ),
      ];
    },
  },
};

// ---- building the defs ----

function buildPattern(terrain: Terrain, marks: Mark[], dim: boolean): SVGPatternElement {
  const def = terrainDef(terrain);
  const base = dim ? def.edge : def.fill;
  const recipe = RECIPES[terrain];

  const pattern = svgEl('pattern', {
    id: patternId(terrain, dim),
    patternUnits: 'userSpaceOnUse',
    width: TILE_W,
    height: TILE_H,
  });
  pattern.append(svgEl('rect', { x: 0, y: 0, width: TILE_W, height: TILE_H, fill: base }));

  // Remembered country is drawn fainter as well as darker, which is what the
  // per-hex glyphs did before this. The hex polygon dims further on top.
  const ground = svgEl('g', dim ? { opacity: '0.6' } : {});
  for (const mark of marks) {
    for (const at of copies(mark, recipe.reach)) {
      ground.append(...recipe.draw(at.x, at.y, mark, base));
    }
  }
  pattern.append(ground);
  return pattern;
}

/**
 * Every terrain's pattern, bright and dim.
 *
 * Both variants are stamped from the SAME marks, so a hex the band has walked
 * away from is recognisably the same ground it was when they stood on it —
 * the light goes out of it, the trees do not move.
 */
export function terrainPatterns(): SVGPatternElement[] {
  const art = makeRng('landnam-terrain-art');
  const out: SVGPatternElement[] = [];
  for (const terrain of ALL_TERRAINS) {
    const recipe = RECIPES[terrain];
    const marks = scatter(art.derive(terrain), recipe.cols, recipe.rows, recipe.jitter);
    out.push(buildPattern(terrain, marks, false), buildPattern(terrain, marks, true));
  }
  return out;
}
