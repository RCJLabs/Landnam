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

/** Three cuts of one terrain: the light, the body and the shadow. */
function ramp(terrain: Terrain, deep: boolean): [string, string, string] {
  const def = terrainDef(terrain);
  const body = deep ? mix(def.fill, '#000000', 0.22) : def.fill;
  const edge = deep ? mix(def.edge, '#000000', 0.22) : def.edge;
  return [mix(body, '#e8dcc0', 0.13), body, edge];
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
  const [light, body, shade] = ramp(ground.terrain, ground.deep);

  ctx.save();
  hexPath(ctx, p.x, p.y, HEX_SIZE * BLEED);
  ctx.clip();

  // a ground colour under the strokes, so there are no holes for the sea to
  // show through where the brush happened not to land
  ctx.fillStyle = body;
  hexPath(ctx, p.x, p.y, HEX_SIZE * 1.12);
  ctx.fill();

  for (let i = 0; i < STROKES; i += 1) {
    const angle = rng.float(0, Math.PI * 2);
    // sqrt so the strokes spread evenly over the area rather than crowding
    // the middle, which is where a naive polar scatter puts them
    const away = Math.sqrt(rng.next()) * HEX_SIZE * 1.25;
    stroke(
      ctx, rng,
      p.x + Math.cos(angle) * away,
      p.y + Math.sin(angle) * away,
      rng.float(6.5, 14), rng.float(2.6, 5.2),
      [light, body, shade][rng.int(0, 2)]!, rng.float(0.55, 0.95),
    );
  }

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
  hexPath(ctx, p.x, p.y, HEX_SIZE * 1.12);
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
