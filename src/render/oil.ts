// The brush. Everything about how painted country LOOKS lives here.
//
// One rule holds the whole thing together: every stroke comes from a seeded
// stream carried in on the patch, the same derived-not-stored trick landmarks
// and fishing grounds already use. Two consequences, and both are why this is
// affordable at all:
//
//   - a patch paints the same marks at any scale, so a sharper repaint is the
//     SAME painting rather than a different one, and nothing can ever flicker
//     between two paintings when the camera moves;
//   - nothing has to be stored. No save change, no SAVE_VERSION bump, no
//     migration — the painting is derived from the ground like the rest of it.
//
// This painted the hex world map first, and the map is gone; what is left is
// the brush itself, which the battlefield and the steading paint with.
//
// `Math.random` is banned project-wide and it is banned twice over here.

import { mix } from './terrainArt';
import { makeRng, type Rng } from '../rng';

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

/**
 * The radius the brush's mark sizes are calibrated against, in world units.
 *
 * 26 because that was the world map's hex radius — every stroke length and
 * width below was tuned by eye against a patch that size, and the map is gone
 * but the calibration is what makes the paint read as paint. A patch of any
 * other radius scales off this, which is how one brush covers the battlefield
 * at 34 and the steading's ground at whatever the yard needs.
 */
const PATCH_UNIT = 26;

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

/**
 * One patch's own stream. The same patch, the same marks, forever.
 *
 * Took a `Hex` until 8.5 and takes the patch's address as a string now —
 * whatever the caller calls the ground it is covering. Keeping it here rather
 * than letting each caller invent its own key is the whole of why a repaint
 * is the same painting: two callers deriving differently would paint the
 * same ground twice, differently.
 */
export function patchRng(seed: string, where: string, salt: string, family = 'oil'): Rng {
  return makeRng(`landnam-${family}:${seed}:${where}:${salt}`);
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

/**
 * A six-sided path at `r` world units, for clipping a patch of paint.
 *
 * The geometry came from `hex/coords.ts`'s `corners` until 8.5 and is written
 * out here now. It is not a coordinate system and never was — the brush clips
 * to a hexagon because a hexagon has no long straight edge for the eye to
 * catch, which is what keeps a field of patches reading as paint rather than
 * as tiles. The battlefield is the only thing left that uses it, and it is a
 * rectangle.
 */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
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
 * shows through as a flat ground colour. At radius === PATCH_UNIT it comes to
 * exactly STROKES and draws exactly what the world map drew before this was
 * pulled out of it.
 */
export function paintPatch(ctx: CanvasRenderingContext2D, patch: Patch): void {
  const { x, y, radius, ramp: [light, body, shade], rng } = patch;
  const scale = radius / PATCH_UNIT;
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

