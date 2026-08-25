// The battlefield, painted rather than drawn.
//
// Same trick as the steading (see colonyOil.ts) and for the same reasons: a
// live canvas in a <foreignObject> placed at the field's own world bounds,
// so the SVG's viewBox carries it and it cannot drift out of register, and
// no PNG encode — measured on the steading, encoding cost 268ms of the 400ms
// it took to open the screen, and nothing wanted the PNG.
//
// What is different is WHAT is painted. A steading is ground seen from above,
// so it is patches of plot. A battlefield seen side-on is three bands: sky,
// the country behind, and the ground the men stand on. The horizon is the
// composition, so it is what everything here is arranged around.
//
// The cache key is deliberately blind to the fight. Men move every turn and
// the sky does not, so a repaint that only moved people keeps the painting.

import { makeRng, type Rng } from '../rng';
import type { Terrain } from '../state/types';
import { openBase } from './fieldArt';
import { mix } from './terrainArt';
import { paintPatch, rampOf } from './oil';
import { GROUND_Y, RANK_GAP } from './line';
import { svgEl } from './svg';

/** iOS Safari will not allocate a canvas past this on either axis. */
const MAX_AXIS = 4096;

/**
 * Painted pixels per world unit, before device pixel ratio.
 *
 * Lower than the steading's 2.4 because the field is far bigger — a full
 * warband's line runs past 1200 world units — and because most of what is
 * painted is sky and distance, which nobody looks at closely. `fit` climbs
 * down from here when a deep line would otherwise blow past iOS's limit.
 *
 * It is also a cost. Every stroke is a filled path rasterised at this scale,
 * and the first cut of this file took 2742ms to open a fight; see `grain`
 * below for where most of that went and this for the rest.
 */
export const FIELD_SCALE = 1.0;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasFit {
  /** Device pixels. */
  w: number;
  h: number;
  /** Painted pixels per world unit, after any climb-down. */
  scale: number;
}

/**
 * The canvas a field of these bounds needs, never past what iOS allows.
 *
 * Pure, so the climb-down is checked without a browser — it is the one part
 * of this file that can silently produce a blank screen rather than a
 * painting, which is exactly what a phone gives you when a canvas allocation
 * fails.
 */
export function fit(box: Box, dpr: number): CanvasFit {
  const want = FIELD_SCALE * Math.max(1, dpr);
  const longest = Math.max(box.w, box.h) * want;
  const scale = longest > MAX_AXIS ? want * (MAX_AXIS / longest) : want;
  return {
    w: Math.max(1, Math.floor(box.w * scale)),
    h: Math.max(1, Math.floor(box.h * scale)),
    scale,
  };
}

/**
 * What the COUNTRY is, as a string.
 *
 * Two fields with the same key are the same painting. Blind to who is
 * standing where and to whose turn it is, because the country does not move
 * when a man does — which is the whole saving.
 */
export function countryKey(box: Box, terrain: Terrain, seed: string): string {
  return `${seed}|${terrain}|${Math.round(box.x)},${Math.round(box.w)},${Math.round(box.h)}`;
}

/** One band's own stream. The same field, the same marks, forever. */
function bandRng(seed: string, terrain: Terrain, band: string): Rng {
  return makeRng(`landnam-field:${seed}:${terrain}:${band}`);
}

/**
 * The far country's silhouette, as a run of heights along the horizon.
 *
 * Derived from the seed, so a fight on the same field looks the same twice
 * and two different fields do not share a skyline. Returned as plain numbers
 * rather than a path so the caller can both clip to it and paint inside it.
 */
function ridgeLine(rng: Rng, box: Box, lift: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    // A slow wave with the seed's own wobble on top: hills, not noise.
    const wave = Math.sin((i / steps) * Math.PI * 2.3) * 0.35 + 0.65;
    out.push(RANK_GAP * lift * wave * rng.float(0.72, 1.12));
  }
  void box;
  return out;
}

/** Trace a ridge as a path on the canvas, ready to fill or clip. */
function ridgePath(ctx: CanvasRenderingContext2D, box: Box, heights: number[]): void {
  const step = box.w / (heights.length - 1);
  ctx.beginPath();
  ctx.moveTo(box.x, GROUND_Y);
  heights.forEach((h, i) => {
    const x = box.x + step * i;
    if (i === 0) ctx.lineTo(x, GROUND_Y - h);
    else {
      const px = box.x + step * (i - 1);
      ctx.quadraticCurveTo((px + x) / 2, GROUND_Y - heights[i - 1]!, x, GROUND_Y - h);
    }
  });
  ctx.lineTo(box.x + box.w, GROUND_Y);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.closePath();
}

/**
 * Lay the brush over a rectangle in overlapping patches.
 *
 * Each patch keeps `paintPatch`'s own hex clip, and they are overlapped
 * enough that no gap shows between them — which is exactly what the world
 * map does, and the reason its surface reads as paint rather than as tiles.
 *
 * The first cut passed `clip: false`, reading it as "no clip". It is not:
 * `paintPatch` skips the `save`/`restore` PAIR but still calls `ctx.clip()`,
 * because its one existing caller opens a clip, lays several things inside it
 * and closes it itself. So every patch intersected the clip with its own hex
 * and never gave it back, and the region shrank to nothing after two or three
 * of them. The sky survived only because its gradient goes down before the
 * brush; the ground had nothing underneath and came out completely
 * transparent, which is how this was found.
 *
 * ## What it costs
 *
 * Both arguments matter, and an earlier draft of this comment said otherwise.
 * It reasoned that total strokes come to `area * STROKES / (1.32 *
 * HEX_SIZE^2 * grain^2)`, concluded the radius cancels out, and told the next
 * reader that patch size is free. The arithmetic is right and the conclusion
 * is wrong: a bigger patch holds proportionally fewer, BIGGER strokes, and
 * what a canvas charges for is painted PIXELS. Measured, raising the ridge
 * radius while holding grain took it from 417ms to 587ms.
 *
 * So: `area` and `grain` set how many marks, `radius * grain` sets how big
 * each one is, and the bill is roughly the product. Tuning one at a time
 * oscillates — this file went 2742 → 604 → 1253 → 815 → 465ms before the
 * real lever turned out to be the CLIP, not either number. See the ridge
 * block in `update` for that.
 */
function brushBand(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  area: Box,
  ramp: readonly [string, string, string],
  radius: number,
  grain: number,
): void {
  const step = radius * 1.15;
  for (let y = area.y; y < area.y + area.h + step; y += step) {
    for (let x = area.x - step; x < area.x + area.w + step; x += step) {
      paintPatch(ctx, {
        x: x + rng.float(-step * 0.2, step * 0.2),
        y: y + rng.float(-step * 0.2, step * 0.2),
        radius,
        ramp,
        rng,
        grain,
      });
    }
  }
}

export interface FieldPaint {
  /** Goes into the battle SVG, under everything else. */
  readonly node: SVGForeignObjectElement;
  /** Paint the country if it has changed; otherwise keep what is there. */
  update(box: Box, terrain: Terrain, seed: string): void;
  /** For the debug read-out and the bars. */
  stats(): {
    painted: number;
    kept: number;
    canvas: string;
    ms: number;
    /**
     * What each band cost, in milliseconds.
     *
     * Kept rather than deleted after the tuning, because the numbers are not
     * intuitive and the next person to touch the brush will reach the same
     * wrong conclusions I did. Canvas defers work, so these do not attribute
     * perfectly between bands — `ms` is the number to trust.
     */
    bands: { sky: number; ridge: number; ground: number };
  };
}

export function createFieldPaint(): FieldPaint {
  const node = svgEl('foreignObject', { class: 'field-paint' });
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  node.append(canvas);
  let country = '';
  let painted = 0;
  let kept = 0;
  let ms = 0;
  let bands = { sky: 0, ridge: 0, ground: 0 };

  function update(box: Box, terrain: Terrain, seed: string): void {
    // Placed every time, even when the paint is reused: a line that gained a
    // rank is a wider field, and the old painting stretched across the new
    // frame would be worse than repainting.
    node.setAttribute('x', String(box.x));
    node.setAttribute('y', String(box.y));
    node.setAttribute('width', String(box.w));
    node.setAttribute('height', String(box.h));

    const next = countryKey(box, terrain, seed);
    if (next === country) {
      kept += 1;
      return;
    }
    country = next;

    const cut = fit(box, globalThis.devicePixelRatio ?? 1);
    canvas.width = cut.w;
    canvas.height = cut.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const began = performance.now();
    ctx.clearRect(0, 0, cut.w, cut.h);
    // The brush works in WORLD units, exactly as it does everywhere else.
    // The transform is the only thing that knows this is a canvas.
    ctx.setTransform(cut.scale, 0, 0, cut.scale, -box.x * cut.scale, -box.y * cut.scale);

    const ground = openBase(terrain);
    const mark = { sky: 0, ridge: 0, ground: 0 };
    let t0 = performance.now();

    // --- Sky ---
    // A gradient under the brush rather than brush alone: a sky is a smooth
    // thing with weather in it, and strokes all the way down read as a wall.
    const sky = ctx.createLinearGradient(0, box.y, 0, GROUND_Y);
    sky.addColorStop(0, '#5d6f84');
    sky.addColorStop(0.65, '#8b9aa8');
    sky.addColorStop(1, '#a8afb2');
    ctx.fillStyle = sky;
    ctx.fillRect(box.x, box.y, box.w, GROUND_Y - box.y);
    // NO brush on the sky, and this took three goes to see.
    //
    // The marks were never the problem. `paintPatch` lays an opaque hex of
    // body colour under its strokes — sensible on a map, where that hex is
    // one tile of country — and at this scale those bodies are 86-unit
    // hexes. Overlapped at any opacity they accumulate into exactly the
    // broken-glass look that kept coming back however the strokes were
    // tuned. Dropping the opacity made it fainter broken glass.
    //
    // A sky is a smooth thing with weather in it. It gets the gradient, and
    // a few very soft banks of cloud, and costs nothing at all.
    const clouds = bandRng(seed, terrain, 'sky');
    for (let i = 0; i < 5; i += 1) {
      const cx = box.x + box.w * clouds.float(0.05, 0.95);
      const cy = box.y + (GROUND_Y - box.y) * clouds.float(0.08, 0.72);
      const r = RANK_GAP * clouds.float(1.8, 4.2);
      const bank = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      bank.addColorStop(0, `rgba(226,232,236,${clouds.float(0.1, 0.2).toFixed(3)})`);
      bank.addColorStop(1, 'rgba(226,232,236,0)');
      ctx.fillStyle = bank;
      ctx.save();
      ctx.translate(cx, cy);
      // Squashed: weather lies in bands, it does not sit in balls.
      ctx.scale(1, clouds.float(0.28, 0.44));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
    }
    mark.sky = Math.round(performance.now() - t0); t0 = performance.now();

    // --- Far country ---
    // Darker and cooler than the sky. Painted inside its own silhouette so
    // the brush marks stop at the skyline instead of fogging it.
    // Measured, and not where it was expected: the ridges cost 417ms of the
    // first cut's 604, against the sky's 49. Cost here goes with painted
    // PIXELS — stroke count times stroke area — so both the grain and the
    // patch radius drive it, which made a first round of tuning oscillate
    // rather than converge.
    //
    // What settled it was not a better constant. The FAR ridge is flat now:
    // distance flattens detail, so brushwork on the furthest band is invisible
    // and was costing half the ridge budget to be invisible in. It gets a
    // gradient; only the near one is painted.
    const far = { lift: 2.4, steps: 5, ink: '#6d7a86', edge: '#5b6874' };
    const farRng = bandRng(seed, terrain, 'ridge-far');
    ridgePath(ctx, box, ridgeLine(farRng, box, far.lift, far.steps));
    const haze = ctx.createLinearGradient(0, GROUND_Y - RANK_GAP * far.lift, 0, GROUND_Y);
    haze.addColorStop(0, far.ink);
    haze.addColorStop(1, far.edge);
    ctx.fillStyle = haze;
    ctx.fill();

    // The near ridge: filled flat, then brushed inside a RECTANGLE.
    //
    // Clipping each patch to the hills' own silhouette ran about 3.6ms a
    // patch against the sky's 0.6ms in a rect — six times the price, because
    // `paintPatch` intersects the live region with its own hex and
    // intersecting a curve is dear. The band BELOW the lowest saddle is
    // always inside the hills, so it can be clipped with a rectangle and the
    // flat fill carries the peaks above it. Same picture, a quarter of the
    // cost.
    const near = { lift: 1.3, steps: 8, ink: '#57645c', edge: '#47544d' };
    const nearRng = bandRng(seed, terrain, 'ridge-near');
    const heights = ridgeLine(nearRng, box, near.lift, near.steps);
    ridgePath(ctx, box, heights);
    const slope = ctx.createLinearGradient(0, GROUND_Y - RANK_GAP * near.lift, 0, GROUND_Y);
    // Ink and edge close together on purpose. Distance flattens contrast — a
    // far hill with the tonal range of a near one reads as a near one, badly
    // drawn.
    slope.addColorStop(0, near.ink);
    slope.addColorStop(1, near.edge);
    ctx.fillStyle = slope;
    ctx.fill();

    const safe = Math.min(...heights) * 0.85;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, GROUND_Y - safe, box.w, safe);
    ctx.clip();
    brushBand(
      ctx, nearRng,
      { x: box.x, y: GROUND_Y - safe, w: box.w, h: safe },
      rampOf(mix(near.ink, near.edge, 0.4), near.edge),
      RANK_GAP * 0.5, 2.2,
    );
    ctx.restore();
    mark.ridge = Math.round(performance.now() - t0); t0 = performance.now();

    // --- The ground they stand on ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, GROUND_Y, box.w, box.y + box.h - GROUND_Y);
    ctx.clip();
    brushBand(
      ctx, bandRng(seed, terrain, 'ground'),
      { x: box.x, y: GROUND_Y, w: box.w, h: box.y + box.h - GROUND_Y },
      // The shadow cut is the ground's OWN colour taken down, not a brown
      // from nowhere — and only a little, for the same reason as the sky. A
      // near-black edge against sand painted the field with dark blades,
      // which reads as leaf litter rather than as ground.
      rampOf(ground, mix(ground, '#2b2a22', 0.18)),
      RANK_GAP * 0.55, 2.0,
    );
    // A little shade along the horizon, so the ground turns away rather than
    // meeting the hills as a flat plane.
    const turn = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + RANK_GAP * 1.4);
    turn.addColorStop(0, mix(ground, '#2b2a22', 0.34));
    turn.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = turn;
    ctx.fillRect(box.x, GROUND_Y, box.w, RANK_GAP * 1.4);
    ctx.restore();
    mark.ground = Math.round(performance.now() - t0);
    bands = mark;

    ms = Math.round(performance.now() - began);
    painted += 1;
  }

  return {
    node,
    update,
    stats: () => ({ painted, kept, canvas: `${canvas.width}x${canvas.height}`, ms, bands }),
  };
}
