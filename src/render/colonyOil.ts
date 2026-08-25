// The steading, painted rather than drawn.
//
// The world map's backdrop is a careful thing: 1872 hexes, a canvas sized to
// the charted bounding box, and a ledger proving every hex is painted once
// because repainting them all after every action would cost seconds. None of
// that applies here. A steading is a handful of plots inside a box you can
// see all of at once, so the ground is simply painted whole.
//
// What it is careful about instead is WHEN. `describeColony` rebuilds its
// whole description on every repaint, and most repaints change only where
// people are standing — somebody took a job, somebody died. The ground did
// not move. So the painting is kept until the GROUND changes, and a repaint
// that only moved people reuses it. That is the same bargain the world map
// makes, arrived at from the other end.
//
// It mounts INSIDE the colony SVG, in a <foreignObject> at the scene's own
// world bounds. The colony map has no camera: it sizes itself with a viewBox
// and `preserveAspectRatio`, letterboxed into whatever box the panel gives
// it. A sibling canvas would have to reproduce that fit and stay in step with
// it through every resize; a foreignObject is carried by the viewBox for free
// and cannot drift out of register.
//
// It holds the LIVE canvas rather than a snapshot of it. The first cut put a
// `canvas.toDataURL()` into an <image>, which works and is 85% waste:
// measured on the real steading, laying the paint costs 47 ms and encoding it
// into a PNG cost 268 ms of the 400 ms it took to open the screen. Nothing
// needs the PNG — the canvas is already a thing the page can draw.

import { key, toPixel } from '../hex';
import { PLOTS } from '../data/jobs';
import { hexRng, paintPatch, rampOf } from './oil';
import { HEX, type ColonyBounds, type ColonyScene } from './colonyScene';
import { svgEl } from './svg';

/** iOS Safari will not allocate a canvas past this on either axis. */
const MAX_AXIS = 4096;

/**
 * Painted pixels per world unit, before device pixel ratio.
 *
 * Higher than the world map's 1.35 because it can be: the steading is a box a
 * few hundred world units across, not a country, so there is room to paint it
 * sharp. The map's number is a ceiling forced by the 4096 limit over charted
 * country; this one is a choice, and `fit` below still climbs down from it if
 * a steading ever grows big enough to need it.
 */
export const STEADING_SCALE = 2.4;

export interface CanvasFit {
  /** Device pixels. */
  w: number;
  h: number;
  /** Painted pixels per world unit, after any climb-down. */
  scale: number;
}

/**
 * The canvas a steading of these bounds needs, never past what iOS allows.
 *
 * Pure, so the climb-down is checked without a browser — it is the one part
 * of this file that could ever silently produce a blank screen instead of a
 * painting, and a blank screen is exactly what a phone gives you when a
 * canvas allocation fails.
 */
export function fit(bounds: ColonyBounds, dpr: number): CanvasFit {
  const want = STEADING_SCALE * Math.max(1, dpr);
  const longest = Math.max(bounds.w, bounds.h) * want;
  const scale = longest > MAX_AXIS ? want * (MAX_AXIS / longest) : want;
  return {
    w: Math.max(1, Math.floor(bounds.w * scale)),
    h: Math.max(1, Math.floor(bounds.h * scale)),
    scale,
  };
}

/**
 * What the GROUND is, as a string.
 *
 * Two scenes with the same key are the same painting, so the one already
 * painted is kept. Deliberately blind to `folk` and to raised buildings:
 * people move constantly and buildings are drawn as SVG marks on top, so
 * neither is a reason to load the brush again.
 */
export function groundKey(scene: ColonyScene, seed: string): string {
  if (!scene.bounds) return '';
  const b = scene.bounds;
  const plots = scene.plots.map((p) => `${p.kind}@${key(p.at)}`).join(',');
  return `${seed}|${b.x},${b.y},${b.w},${b.h}|${plots}`;
}

export interface SteadingPaint {
  /** Goes into the colony SVG, under everything else. */
  readonly node: SVGForeignObjectElement;
  /** Paint the ground if it has changed; otherwise keep what is there. */
  update(scene: ColonyScene, seed: string): void;
  /** For the debug read-out and the bars. */
  stats(): { painted: number; kept: number; canvas: string };
}

/**
 * Paint one plot. Its colours come from the same PLOTS table the SVG renderer
 * reads, so the painted steading and the drawn one are recognisably the same
 * place rather than two different art directions of it.
 */
function plotRamp(kind: string): readonly [string, string, string] {
  const def = PLOTS[kind as keyof typeof PLOTS];
  return def ? rampOf(def.fill, def.edge) : rampOf('#6d6446', '#57503a');
}

export function createSteadingPaint(): SteadingPaint {
  const node = svgEl('foreignObject', { class: 'steading-paint' });
  const canvas = document.createElement('canvas');
  // The canvas fills the foreignObject, and the foreignObject is placed in
  // world units — so the device pixels below are free to be however many the
  // screen deserves, independent of how big the steading is drawn.
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  node.append(canvas);
  let ground = '';
  let painted = 0;
  let kept = 0;

  function update(scene: ColonyScene, seed: string): void {
    const b = scene.bounds;
    if (!b) {
      node.setAttribute('width', '0');
      node.setAttribute('height', '0');
      ground = '';
      return;
    }
    const next = groundKey(scene, seed);
    // Place it every time: the frame has to sit on the scene's bounds even
    // when the paint itself is reused, or a steading that grew a plot would
    // show the old ground stretched across the new frame.
    node.setAttribute('x', String(b.x));
    node.setAttribute('y', String(b.y));
    node.setAttribute('width', String(b.w));
    node.setAttribute('height', String(b.h));
    if (next === ground) {
      kept += 1;
      return;
    }
    ground = next;

    const box = fit(b, globalThis.devicePixelRatio ?? 1);
    canvas.width = box.w;
    canvas.height = box.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, box.w, box.h);
    // The brush works in WORLD units, exactly as it does on the map. The
    // transform is the only thing that knows this is a canvas.
    ctx.setTransform(box.scale, 0, 0, box.scale, -b.x * box.scale, -b.y * box.scale);

    for (const plot of scene.plots) {
      const p = toPixel(plot.at, HEX);
      paintPatch(ctx, {
        x: p.x,
        y: p.y,
        radius: HEX,
        ramp: plotRamp(plot.kind),
        rng: hexRng(seed, plot.at, 'steading'),
        // Barely past its own edge. A plot is cleared, walled, worked ground
        // with a boundary somebody put there — and the steading has an
        // outside, so the map's generous bleed would fringe it with spikes.
        bleed: 1.02,
        // Finer marks than the world map's, and more of them. A plot is a
        // third bigger than a world hex and seen at much the same size, so
        // marks that scaled with it read as scattered grains rather than as
        // brushwork.
        grain: 0.62,
      });
    }

    painted += 1;
  }

  return {
    node,
    update,
    stats: () => ({ painted, kept, canvas: `${canvas.width}x${canvas.height}` }),
  };
}
