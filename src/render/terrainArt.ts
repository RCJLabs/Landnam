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

/**
 * The hex the map is drawn at. Must match `HEX_SIZE` in render/travel.ts —
 * pinned by a test, because the whole of this file's geometry hangs off it.
 */
export const HEX = 26;

/** Centre to edge. Nothing a hex owns may reach past this or it gets cut. */
export const INRADIUS = (Math.sqrt(3) / 2) * HEX;

/**
 * THE TILE IS THE HEX LATTICE, AND THAT IS THE WHOLE FIX.
 *
 * The first version tiled 120x104 in world space, deliberately NOT a whole
 * number of hexes, so the pattern would land somewhere different on every hex
 * instead of stamping the same three trees on every forest. That reasoning
 * was about REPETITION and it ignored what a pattern fill actually is: the
 * hex polygon CLIPS it. A tree that straddled a hex edge was sliced down the
 * middle, half of it drawn and half missing, and a mountain — reach 20
 * against an inradius of 22.5 — was cut apart on nearly every hex it landed
 * on. Reported from a phone as "the mountains and trees and hills are in the
 * hexes weird", which is exactly what it was.
 *
 * Pointy-top hexes repeat every `sqrt(3) * HEX` across and every `1.5 * HEX`
 * down, with alternate rows offset by half a step. Two columns by four rows
 * is the smallest tile that closes: EIGHT hex centres, each getting its own
 * marks, so a stretch of forest has eight distinct stamps in it rather than
 * one — the variety the old tile was reaching for, without the slicing.
 */
export const TILE_W = 2 * Math.sqrt(3) * HEX;
export const TILE_H = 4 * 1.5 * HEX;

/**
 * Where the eight hexes sit inside one tile.
 *
 * Derived from the axial-to-pixel maths rather than typed out, so it cannot
 * drift from the grid the renderer actually draws: x = sqrt(3)*HEX*(q + r/2),
 * y = 1.5*HEX*r, folded back into the tile.
 */
export function latticeCentres(hexSize: number): { x: number; y: number }[] {
  const tileW = 2 * Math.sqrt(3) * hexSize;
  const out: { x: number; y: number }[] = [];
  const step = Math.sqrt(3) * hexSize;
  for (let r = 0; r < 4; r++) {
    for (let q = -2; q <= 2; q++) {
      const x = step * (q + r / 2);
      if (x < -0.001 || x >= tileW - 0.001) continue;
      out.push({ x, y: 1.5 * hexSize * r });
    }
  }
  return out;
}

export const CENTRES: { x: number; y: number }[] = latticeCentres(HEX);

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
 * Marks laid around each hex's own centre, never across its edges.
 *
 * A hex fill is CLIPPED by the hex, so anything reaching past the inradius is
 * cut in half and reads as a mistake — which is what the first version did to
 * every mountain on the map. Each mark is placed within `spread` of a centre,
 * and every recipe's `spread + reach` is held under the inradius by a test,
 * so nothing can be sliced by construction rather than by luck.
 *
 * Placement is a sunflower — golden angle, radius by the square root of the
 * index — because a handful of points on a ring reads as a ring and a handful
 * placed uniformly at random clump and leave bald patches. Jitter on both
 * keeps it from looking set out with a ruler.
 */
export function scatter(
  rng: Rng,
  perHex: number,
  spread: number,
  centres: { x: number; y: number }[] = CENTRES,
): Mark[] {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const marks: Mark[] = [];
  for (const centre of centres) {
    for (let i = 0; i < perHex; i++) {
      const radius = spread * Math.sqrt((i + 0.5 + rng.float(-0.35, 0.35)) / perHex);
      const angle = i * GOLDEN + rng.float(-0.5, 0.5);
      marks.push({
        x: centre.x + Math.cos(angle) * radius,
        y: centre.y + Math.sin(angle) * radius,
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
export function copies(
  mark: Mark,
  reach: number,
  tileW: number = TILE_W,
  tileH: number = TILE_H,
): { x: number; y: number }[] {
  const xs = [mark.x];
  if (mark.x - reach < 0) xs.push(mark.x + tileW);
  if (mark.x + reach > tileW) xs.push(mark.x - tileW);
  const ys = [mark.y];
  if (mark.y - reach < 0) ys.push(mark.y + tileH);
  if (mark.y + reach > tileH) ys.push(mark.y - tileH);
  const out: { x: number; y: number }[] = [];
  for (const x of xs) {
    for (const y of ys) out.push({ x, y });
  }
  return out;
}

// ---- the recipes ----

interface Recipe {
  /** Marks on each hex. One, for the things that ARE the hex. */
  perHex: number;
  /** How far from the hex's centre a mark may be placed. */
  spread: number;
  /** How far a mark reaches from its point, for the wrap and the clip check. */
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
    perHex: 5,
    spread: 13,
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
    perHex: 7,
    spread: 18,
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
    perHex: 5,
    spread: 15,
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
    perHex: 4,
    spread: 14,
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
    perHex: 2,
    spread: 6,
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
    perHex: 1,
    spread: 2,
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
    perHex: 5,
    spread: 15,
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
    perHex: 4,
    spread: 12,
    reach: 10,
    draw(x, y, mark, base) {
      // Shorter than the first pass, and more of them. One long furrow per
      // hex had to sit dead centre to fit and read as a worm rather than as
      // worked ground.
      const w = 6 + mark.size * 3;
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
    const marks = scatter(art.derive(terrain), recipe.perHex, recipe.spread);
    out.push(buildPattern(terrain, marks, false), buildPattern(terrain, marks, true));
  }
  return out;
}
