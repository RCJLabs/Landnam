// Where a scattered mark goes, and what colour it is drawn in.
//
// This was `terrainArt.ts`, and until 12.7 it was two files in one: this
// geometry, and a full set of eight per-terrain SVG <pattern> recipes that
// textured the HEX MAP. The map went in 8.5 (2026-08-28) and the patterns
// went with it in every sense but the literal — nothing had appended
// `terrainPatterns()`, `reliefDef()` or `deepOceanFill()` to a document since,
// and `terrainFill`, `patternId`, `RECIPES`, `HEX`, `INRADIUS`, `CENTRES`,
// `TILE_W` and `TILE_H` were reachable only from each other and from tests
// that measured them. Four hundred lines describing a lattice that is not
// drawn. They are deleted rather than kept "in case", because a file that
// still names the hex is a file the next reader has to rule out.
//
// What is left is what the BATTLEFIELD's texture is built from
// (`render/fieldArt.ts` owns the recipes now) plus the colour mix five
// renderers share. Both halves are pure and both are where a fault would be
// SILENT — a seam ruled across the ground, or a bald patch — so they are here
// with a test rather than inline in a renderer.
//
// Jitter comes off the seeded RNG with a fixed label: `Math.random` is banned
// (CLAUDE.md) and this is decoration, so it takes no run stream and looks the
// same in every game.

import type { Rng } from '../rng';

/**
 * Where the eight hexes sit inside one tile of a pointy-top lattice.
 *
 * The BATTLEFIELD is a plain rectangle (CLAUDE.md, "one address") and does
 * not stand on hexes — but a pattern tile still has to close, and a lattice
 * is the smallest arrangement of stamp points that tiles without stamping the
 * same mark in the same place on every repeat. Pointy-top hexes repeat every
 * `sqrt(3) * size` across and every `1.5 * size` down with alternate rows
 * offset by half a step; two columns by four rows is the smallest tile that
 * closes, giving eight distinct stamps.
 *
 * Derived from the axial-to-pixel maths rather than typed out, so it cannot
 * drift: x = sqrt(3)*size*(q + r/2), y = 1.5*size*r, folded back into the
 * tile.
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
 * Marks laid around each centre, never further than `spread` from one.
 *
 * Placement is a sunflower — golden angle, radius by the square root of the
 * index — because a handful of points on a ring reads as a ring and a handful
 * placed uniformly at random clump and leave bald patches. Jitter on both
 * keeps it from looking set out with a ruler.
 *
 * `centres` was defaulted to the map's own lattice until 12.7 and is required
 * now: there is one caller, it has always passed its own, and a default that
 * described a deleted coordinate system was the last thing in this file
 * pointing at the hex map.
 */
export function scatter(
  rng: Rng,
  perHex: number,
  spread: number,
  centres: { x: number; y: number }[],
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
 * a straight line ruled across the ground — drawing the overhang again on
 * the far side is what makes the texture continuous.
 *
 * Returned as positions rather than drawn here so the wrap can be tested
 * without a DOM, which is the whole of what could go silently wrong: a mark
 * that should appear twice and appears once leaves a seam nobody sees until
 * they are looking at it.
 */
export function copies(
  mark: Mark,
  reach: number,
  tileW: number,
  tileH: number,
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
