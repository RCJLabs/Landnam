// The brush. Everything about how painted country LOOKS lives here.
//
// One rule holds the whole thing together: every stroke comes from a stream
// derived per hex from the seed and the coordinate, the same
// derived-not-stored trick skerries, landmarks and fishing grounds already
// use. Two consequences, and both are why this is affordable at all:
//
//   - a hex paints the same marks at any scale, so a sharper repaint is the
//     SAME painting rather than a different one, and the map can never
//     flicker between two worlds when the camera moves;
//   - nothing has to be stored. No save change, no SAVE_VERSION bump, no
//     migration — the painting is derived from the country like the rest of it.
//
// `Math.random` is banned project-wide and it is banned twice over here.

import { corners, key, toPixel, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import { mix } from './terrainArt';
import { makeRng, type Rng } from '../rng';
import type { Terrain } from '../state/types';
import { HEX_SIZE, type HexGround } from './travelScene';

/**
 * World units per painted pixel.
 *
 * 1.35 is the camera's opening zoom, and it is a ceiling rather than a taste:
 * measured, a canvas painted at 2.0 over the country a long saga charts comes
 * to 4864 pixels on its long axis and iOS Safari refuses anything past 4096.
 * At 1.35 the same country is 3283x1896 and 24 MB on a dpr-3 phone.
 *
 * The cost is at full pinch: paint stretched from 1.35 to 2.6 keeps 46% of
 * its sharpness, measured as mean |Laplacian| against the same patch painted
 * natively there. It reads as a painting you have moved closer to rather than
 * as a broken image, which is the one thing this style has that a pixel or
 * vector one would not.
 */
export const OIL_SCALE = 1.35;

/** Strokes per hex. Enough to cover, few enough that a reveal stays under 3 ms. */
const STROKES = 44;
/**
 * How far a stroke may stray past its own hex, so the seam is painted over.
 *
 * 1.34 with long strokes made a handsome surface and an unreadable map: every
 * terrain bled into its neighbours until a whole screen of bog, meadow and
 * valley was one khaki. A map has to be read before it is admired, so the
 * bleed is a suggestion of a soft edge and no more.
 */
const BLEED = 1.16;
/**
 * How far the FLAT layers reach — the opaque ground under a hex, and the
 * translucent glaze over it.
 *
 * Pointy-top hexes tile exactly at their circumradius, so at 1.0 two
 * neighbours meet and never overlap. That matters only for the glaze, and it
 * matters a lot: at 1.12 two remembered hexes stacked two half-dark plates in
 * the band they shared, and the map grew a dark grid along every seam —
 * measured at 24% darker on the edges than in the middles, which is a lattice
 * you can see from across a room.
 *
 * So flat layers tile, and only the STROKES cross the seam. The ground gets a
 * hair of overlap because it is opaque, where overlap costs nothing and hides
 * the anti-aliased hairline between two fills.
 */
const GROUND = 1.03;
const GLAZE = 1.0;

/**
 * Three cuts of one colour: the light, the body and the shadow.
 *
 * A flat brush loaded with a single colour reads as plastic. Three cuts of
 * the same colour is the smallest thing that reads as paint, and taking them
 * from a fill and an edge the data already carries means the steading's plots
 * and the world's terrain go through the same mixer.
 */
export function rampOf(fill: string, edge: string, dim = 0): [string, string, string] {
  const body = dim > 0 ? mix(fill, '#000000', dim) : fill;
  const shade = dim > 0 ? mix(edge, '#000000', dim) : edge;
  return [mix(body, '#e8dcc0', 0.13), body, shade];
}

/** Three cuts of one terrain: the light, the body and the shadow. */
function ramp(terrain: Terrain, deep: boolean): [string, string, string] {
  const def = terrainDef(terrain);
  return rampOf(def.fill, def.edge, deep ? 0.22 : 0);
}

/** One hex's own stream. The same hex, the same marks, forever. */
export function hexRng(seed: string, at: Hex, salt: string): Rng {
  return makeRng(`landnam-oil:${seed}:${key(at)}:${salt}`);
}

/**
 * A loaded flat brush: a body of colour and the bristle streaks that are the
 * whole reason oil reads as oil rather than as an airbrush.
 */
function stroke(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number, y: number,
  length: number, width: number,
  colour: string, alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng.float(0, Math.PI));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i += 1) {
    // Bristles cut from the STROKE's own colour, not from a global warm and
    // cold pair — a shared highlight dragged every terrain towards the same
    // hue and was most of why the map went monochrome.
    ctx.globalAlpha = alpha * rng.float(0.1, 0.28);
    ctx.fillStyle = rng.chance(0.55) ? mix(colour, '#ffffff', 0.34) : mix(colour, '#000000', 0.44);
    ctx.fillRect(-length / 2, rng.float(-0.4, 0.4) * width, length * rng.float(0.4, 0.9), width * 0.17);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** A hex path at `r` world units, for clipping and for grounds. */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const ring = corners(cx, cy, r);
  ctx.beginPath();
  ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/** A patch of ground for the brush to cover: where, how big, in what colours. */
export interface Patch {
  /** Middle of the patch, in world units. */
  x: number;
  y: number;
  /** A hex of this radius, in world units. Every mark sizes off it. */
  radius: number;
  /** Light, body and shadow — see rampOf. */
  ramp: readonly [string, string, string];
  /** This patch's own stream. The same patch, the same marks, forever. */
  rng: Rng;
  /**
   * How far past its own edge the brush is allowed to run, as a multiple of
   * the radius.
   *
   * On the world map generous bleed is the whole trick: it dissolves the
   * lattice, and a hex's overspill lands on the country next to it. A
   * steading has an OUTSIDE — beyond the last plot is the page — so the same
   * bleed leaves the ground fringed with spikes against the dark, which reads
   * as torn paper rather than as paint.
   */
  bleed?: number;
  /**
   * Mark size, as a multiple of the size the radius would imply. Below 1 the
   * brush is finer AND busier: coverage is held by putting proportionally
   * more marks down, so the patch does not go bald.
   */
  grain?: number;
  /**
   * Whether to open and close the clip, or leave it to the caller.
   *
   * paintGround has more to lay down inside the same clip — surf, a river —
   * so it opens the clip once and closes it itself.
   */
  clip?: boolean;
}

/**
 * A patch of ground, painted once. Everything sizes off `radius`, so this is
 * the same brush on the world map at HEX 26 and in the steading at HEX 34.
 *
 * Stroke count goes with AREA rather than being fixed: a bigger patch needs
 * proportionally more marks or the paint thins out and the flat ground colour
 * shows through as a flat ground colour. At radius === HEX_SIZE it comes to
 * exactly STROKES and draws exactly what the world map drew before this was
 * pulled out of it.
 */
export function paintPatch(ctx: CanvasRenderingContext2D, patch: Patch): void {
  const { x, y, radius, ramp: [light, body, shade], rng } = patch;
  const scale = radius / HEX_SIZE;
  const grain = patch.grain ?? 1;
  const strokes = Math.round((STROKES * scale * scale) / (grain * grain));

  if (patch.clip !== false) ctx.save();
  hexPath(ctx, x, y, radius * (patch.bleed ?? BLEED));
  ctx.clip();

  // a ground colour under the strokes, so there are no holes for what is
  // behind to show through where the brush happened not to land
  ctx.fillStyle = body;
  hexPath(ctx, x, y, radius * GROUND);
  ctx.fill();

  for (let i = 0; i < strokes; i += 1) {
    const angle = rng.float(0, Math.PI * 2);
    // sqrt so the strokes spread evenly over the area rather than crowding
    // the middle, which is where a naive polar scatter puts them
    const away = Math.sqrt(rng.next()) * radius * 1.25;
    stroke(
      ctx, rng,
      x + Math.cos(angle) * away,
      y + Math.sin(angle) * away,
      rng.float(6.5, 14) * scale * grain, rng.float(2.6, 5.2) * scale * grain,
      [light, body, shade][rng.int(0, 2)]!, rng.float(0.55, 0.95),
    );
  }

  if (patch.clip !== false) ctx.restore();
}

/**
 * One hex of country, painted once.
 *
 * `ctx` is expected to be in WORLD units — the caller owns the transform, so
 * this is the same code at any scale, which is the point.
 *
 * The clip is generous on purpose. Clipping tight to the hex made every tile
 * read as its own scribble and the surface never became a painting; letting
 * strokes run a third of a hex past the edge, in reveal order, is what turns
 * a lattice of paint into paint.
 */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  seed: string,
  at: Hex,
  ground: HexGround,
): void {
  const p = toPixel(at, HEX_SIZE);
  const rng = hexRng(seed, at, 'ground');
  const cuts = ramp(ground.terrain, ground.deep);
  const body = cuts[1];

  ctx.save();
  paintPatch(ctx, { x: p.x, y: p.y, radius: HEX_SIZE, rng, ramp: cuts, clip: false });

  // Surf, laid over the wet ground rather than beside it. The edges come
  // from the scene, which read them off the static tiles.
  if (ground.foam.length > 0) {
    const ring = corners(p.x, p.y, HEX_SIZE - 1.5);
    for (const i of ground.foam) {
      const a = ring[i]!;
      const b = ring[(i + 1) % 6]!;
      for (let s = 0; s <= 6; s += 1) {
        const t = s / 6;
        stroke(
          ctx, rng,
          a.x + (b.x - a.x) * t + rng.float(-2, 2),
          a.y + (b.y - a.y) * t + rng.float(-2, 2),
          rng.float(5, 11), rng.float(2, 4),
          rng.chance(0.5) ? '#e8f0f2' : '#bcd2d8', rng.float(0.35, 0.8),
        );
      }
    }
  }

  // A river runs THROUGH a hex; the first cut dabbed a blob in the middle of
  // it and it read as a puddle dropped on the grass.
  if (ground.river) {
    const lean = rng.float(0, Math.PI);
    for (let i = 0; i < 11; i += 1) {
      const along = rng.float(-1, 1) * HEX_SIZE * 0.8;
      stroke(
        ctx, rng,
        p.x + Math.cos(lean) * along + rng.float(-2.6, 2.6),
        p.y + Math.sin(lean) * along + rng.float(-2.6, 2.6),
        rng.float(6, 12), rng.float(2.4, 4.4),
        rng.chance(0.5) ? mix('#3f7d94', body, 0.3) : mix('#5b9ab0', body, 0.2),
        rng.float(0.45, 0.8),
      );
    }
  }

  ctx.restore();
}

/**
 * Country the band remembers rather than sees.
 *
 * NOT an opacity wash — that greys an oil painting and kills it. A scumble:
 * a cold, thin, dry glaze dragged over the marks already there, so the ground
 * underneath still shows and a hex walked away from is recognisably the
 * ground it was. That is the property terrainPatterns() already guarantees
 * for the SVG map — the light goes out of it, the trees do not move — and it
 * is the one that decided oil was viable at all.
 */
export function scumble(ctx: CanvasRenderingContext2D, seed: string, at: Hex): void {
  const p = toPixel(at, HEX_SIZE);
  const rng = hexRng(seed, at, 'scumble');
  ctx.save();
  hexPath(ctx, p.x, p.y, HEX_SIZE * BLEED);
  ctx.clip();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#141c2c';
  hexPath(ctx, p.x, p.y, HEX_SIZE * GLAZE);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let i = 0; i < 30; i += 1) {
    const angle = rng.float(0, Math.PI * 2);
    const away = Math.sqrt(rng.next()) * HEX_SIZE * 1.1;
    stroke(
      ctx, rng,
      p.x + Math.cos(angle) * away,
      p.y + Math.sin(angle) * away,
      rng.float(7, 16), rng.float(2.6, 5.4),
      rng.chance(0.6) ? '#26314a' : '#10161f', rng.float(0.2, 0.42),
    );
  }
  ctx.restore();
}
