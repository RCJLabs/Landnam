// The canvas the country is painted on, and the only stateful thing in the
// oil renderer.
//
// It rides exactly the same discipline as the SVG map: repaintWork says which
// hexes are new and which have changed light, and nothing else is touched. A
// hex is painted ONCE, on the turn it is first charted, and never repainted —
// which is what makes a painting affordable in a game that repaints after
// every action. Measured on this machine: 2.85 ms to paint a revealed hex,
// 1.03 ms to blit the viewport.
//
// The canvas is sized to the SEEN BOUNDING BOX, not to the world. That is not
// thrift, it is the only thing that works: the whole 52x36 map at this scale
// on a dpr-3 phone is 9667x5845 and 215 MB, and iOS Safari refuses any canvas
// past 4096 px on an axis. Replaying runs/long.json, a saga that runs 531 days
// to its end charts 78 hexes in a 17x11 box — 3283x1896, 24 MB, and room to
// spare. The guard below is for the saga that charts far more country than
// either recorded run does.

import { fromKey, toPixel, type Hex } from '../hex';
import type { GameState } from '../state/types';
import type { Camera } from './camera';
import { isIdle, repaintWork, type Lit } from './repaint';
import { HEX_SIZE, describeGround, describeLight } from './travelScene';
import { OIL_SCALE, paintGround, scumble } from './oil';

/** iOS Safari will not allocate a canvas past this on either axis. */
const MAX_AXIS = 4096;
/** Painted margin round the charted country, so a step does not resize. */
const MARGIN = HEX_SIZE * 3;

export interface OilBackdrop {
  /** Sits under the map SVG; the caller mounts it. */
  readonly canvas: HTMLCanvasElement;
  /** Paint whatever the chart has gained or relit since last time. */
  chart(state: GameState): void;
  /** Put the painting on screen for this camera. Cheap; call it on every pan. */
  redraw(camera: Camera): void;
  /** A different world: forget the painting. */
  reset(): void;
  /** What it is holding, for the debug read-out and the bars. */
  stats(): { painted: number; canvas: string; megabytes: number; scale: number };
}

interface Rect { x: number; y: number; w: number; h: number }

/** The world rectangle the charted country needs, with a margin round it. */
function chartedRect(state: GameState): Rect | null {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const k in state.world.seen) {
    const p = toPixel(fromKey(k), HEX_SIZE);
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0 - MARGIN, y: y0 - MARGIN, w: (x1 - x0) + MARGIN * 2, h: (y1 - y0) + MARGIN * 2 };
}

const covers = (outer: Rect, inner: Rect): boolean =>
  outer.x <= inner.x && outer.y <= inner.y
  && outer.x + outer.w >= inner.x + inner.w
  && outer.y + outer.h >= inner.y + inner.h;

export function createOilBackdrop(): OilBackdrop {
  const canvas = document.createElement('canvas');
  canvas.className = 'oil';

  /** The painting, in its own canvas, at OIL_SCALE * dpr device pixels per world unit. */
  let paint: HTMLCanvasElement | null = null;
  let rect: Rect | null = null;
  let ppu = 0;                       // device pixels per world unit
  let seed = '';
  const lit = new Map<string, Lit>();

  /** How many pixels per world unit we can afford for a rectangle this big. */
  function scaleFor(r: Rect): number {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const want = OIL_SCALE * dpr;
    // A saga that charts most of the coast would ask for a canvas iOS will
    // not give it. Rather than fail, paint it coarser — a soft map beats no
    // map, and nothing this side of a 30-hex-wide chart ever reaches it.
    return Math.min(want, (MAX_AXIS - 8) / Math.max(r.w, r.h));
  }

  function context(): CanvasRenderingContext2D | null {
    return paint ? paint.getContext('2d') : null;
  }

  /** Make a canvas for `want`, carrying over whatever is already painted. */
  function resize(want: Rect): void {
    const next = document.createElement('canvas');
    const scale = scaleFor(want);
    next.width = Math.ceil(want.w * scale);
    next.height = Math.ceil(want.h * scale);
    const g = next.getContext('2d');
    if (!g) return;
    // The old painting keeps its place in the WORLD, so it is blitted to the
    // offset its world rectangle has in the new one. Repainting it instead
    // would be correct and would cost 2.85 ms a hex for country that has not
    // changed since the day it was walked.
    if (paint && rect && ppu > 0 && scale === ppu) {
      g.drawImage(paint, (rect.x - want.x) * scale, (rect.y - want.y) * scale);
    } else if (paint && rect && ppu > 0) {
      g.drawImage(
        paint, 0, 0, paint.width, paint.height,
        (rect.x - want.x) * scale, (rect.y - want.y) * scale,
        rect.w * scale, rect.h * scale,
      );
    }
    paint = next;
    rect = want;
    ppu = scale;
  }

  /** Put the context into WORLD units, so the brush never knows about scale. */
  function inWorld(g: CanvasRenderingContext2D): void {
    g.setTransform(ppu, 0, 0, ppu, -rect!.x * ppu, -rect!.y * ppu);
  }

  function chart(state: GameState): void {
    if (state.seed !== seed) { seed = state.seed; paint = null; rect = null; lit.clear(); }
    const want = chartedRect(state);
    if (!want) return;
    if (!paint || !rect || !covers(rect, want)) resize(want);
    const g = context();
    if (!g) return;

    const seen = state.world.seen as Record<string, Lit>;
    const work = repaintWork(lit, seen);
    if (isIdle(work)) return;

    inWorld(g);
    for (const k of work.added) {
      const ground = describeGround(state, k);
      const visible = describeLight(state, k);
      if (!ground || visible === null) continue;
      const at: Hex = fromKey(k);
      paintGround(g, state.seed, at, ground);
      if (!visible) scumble(g, state.seed, at);
      lit.set(k, seen[k]!);
    }
    // A hex going dark takes the glaze. A hex coming BACK into the light has
    // to be painted again from the ground up, because paint does not come
    // off — and it is the same painting, mark for mark, because the stream is
    // derived from the seed and the coordinate rather than rolled.
    for (const k of work.relit) {
      const visible = describeLight(state, k);
      if (visible === null) continue;
      const at: Hex = fromKey(k);
      if (visible) {
        const ground = describeGround(state, k);
        if (ground) paintGround(g, state.seed, at, ground);
      } else {
        scumble(g, state.seed, at);
      }
      lit.set(k, seen[k]!);
    }
    for (const k of work.dropped) lit.delete(k);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function redraw(camera: Camera): void {
    const width = canvas.clientWidth || 390;
    const height = canvas.clientHeight || 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!paint || !rect) return;
    // The same mapping the SVG viewBox uses, so the painting and every mark
    // over it agree to the pixel: world -> screen is a uniform scale by the
    // zoom about the camera. See render/camera.ts.
    const k = camera.zoom * dpr;
    g.setTransform(k, 0, 0, k, w / 2 - camera.x * k, h / 2 - camera.y * k);
    g.imageSmoothingQuality = 'high';
    g.drawImage(paint, rect.x, rect.y, rect.w, rect.h);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function reset(): void {
    paint = null; rect = null; ppu = 0; seed = ''; lit.clear();
  }

  function stats() {
    return {
      painted: lit.size,
      canvas: paint ? `${paint.width}x${paint.height}` : '-',
      megabytes: paint ? +((paint.width * paint.height * 4) / 1048576).toFixed(1) : 0,
      scale: +(ppu / Math.min(2, window.devicePixelRatio || 1)).toFixed(2),
    };
  }

  return { canvas, chart, redraw, reset, stats };
}
