// Where the map is looking, and the one rule that makes it feel right.
//
// The camera is a world point and a zoom; `applyCamera` in travel.ts turns
// those into the SVG viewBox. Two things then need to convert between screen
// and world: a tap, which asks "which hex is under this finger", and a zoom,
// which asks the harder question.
//
// ZOOMING KEEPS A POINT STILL. That is the whole of it. Pinch and the hex
// between your fingers stays between your fingers; roll the wheel and the hex
// under the cursor stays under the cursor. Without it the camera scales about
// the middle of the screen, so pinching anything not already centred walks it
// away from you and you chase it — which is what the map did until now, and
// it is the sort of thing that reads as "cheap" without ever being noticed
// as a bug.
//
// Pure, and tested, because it is exactly the kind of arithmetic that looks
// right in a diff and is wrong by a factor of the zoom on a phone.

export interface Camera {
  /** The world point in the middle of the view. */
  x: number;
  y: number;
  zoom: number;
}

/** The element's size in CSS pixels — a DOMRect, or anything shaped like one. */
export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The map never zooms out past the whole coast, nor in past a thumb's worth. */
export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 2.6;

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

/**
 * The world point under a screen offset, measured from the element's corner.
 *
 * The viewBox is `camera.x - w/2, camera.y - h/2, w, h` with `w =
 * view.width / zoom`, so the scale is uniform and the mapping is this. It
 * holds under `preserveAspectRatio: slice` precisely because the viewBox is
 * derived FROM the element's size and therefore always shares its aspect.
 */
export function worldAt(camera: Camera, view: Viewport, offset: Point): Point {
  return {
    x: camera.x + (offset.x - view.width / 2) / camera.zoom,
    y: camera.y + (offset.y - view.height / 2) / camera.zoom,
  };
}

/**
 * A camera zoomed to `zoom` that holds `hold` under `anchor`.
 *
 * `hold` is a world point — normally the one that WAS under the fingers —
 * and `anchor` is where on screen it has to end up. Passing a moved anchor
 * is how a two-finger drag pans and zooms at the same time, which is what a
 * hand actually does.
 */
export function anchored(hold: Point, view: Viewport, anchor: Point, zoom: number): Camera {
  const next = clampZoom(zoom);
  return {
    x: hold.x - (anchor.x - view.width / 2) / next,
    y: hold.y - (anchor.y - view.height / 2) / next,
    zoom: next,
  };
}

/** The point between two fingers. Undefined until there are two. */
export function midpoint(points: Iterable<Point>): Point | null {
  const [a, b] = [...points];
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** How far apart two fingers are. Zero until there are two. */
export function spread(points: Iterable<Point>): number {
  const [a, b] = [...points];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
