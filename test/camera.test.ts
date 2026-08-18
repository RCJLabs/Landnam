// The one property the map's camera has to have: zooming keeps a point still.
//
// Everything else here is arithmetic in service of that. The old renderer
// changed `zoom` and left `x` and `y` alone, which scales about the middle of
// the screen — so this suite would have failed on every case that pinches
// anywhere but dead centre, and passed on the one case somebody would try by
// hand.

import { describe, expect, it } from 'vitest';
import {
  anchored,
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  midpoint,
  spread,
  worldAt,
  type Camera,
} from '../src/render/camera';

const VIEW = { width: 390, height: 844 };
const START: Camera = { x: 100, y: -40, zoom: 1.35 };

/** Zoom about a screen point the way the renderer does, and report the camera. */
function pinch(camera: Camera, at: { x: number; y: number }, zoom: number): Camera {
  return anchored(worldAt(camera, VIEW, at), VIEW, at, zoom);
}

describe('worldAt', () => {
  it('puts the middle of the screen at the camera', () => {
    expect(worldAt(START, VIEW, { x: 195, y: 422 })).toEqual({ x: 100, y: -40 });
  });

  it('divides by the zoom, not multiplies', () => {
    // The whole class of bug this file exists for. Zoomed IN, a screen pixel
    // is a smaller step through the world, so the offset shrinks.
    const near = worldAt({ ...START, zoom: 2 }, VIEW, { x: 195 + 100, y: 422 });
    const far = worldAt({ ...START, zoom: 0.5 }, VIEW, { x: 195 + 100, y: 422 });
    expect(near.x).toBe(100 + 50);
    expect(far.x).toBe(100 + 200);
  });
});

describe('zooming holds a point still', () => {
  // The corners and the edges, because centre is the one place the broken
  // version was right and it is the only place a hand test would land.
  const spots = [
    { x: 0, y: 0 },
    { x: 390, y: 0 },
    { x: 0, y: 844 },
    { x: 390, y: 844 },
    { x: 195, y: 422 },
    { x: 40, y: 700 },
    { x: 330, y: 120 },
  ];

  for (const at of spots) {
    it(`holds (${at.x}, ${at.y}) through a zoom in and out`, () => {
      const before = worldAt(START, VIEW, at);
      for (const zoom of [2.4, 1.8, 1.0, 0.6]) {
        const camera = pinch(START, at, zoom);
        const after = worldAt(camera, VIEW, at);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
      }
    });
  }

  it('holds the point through a whole run of small steps, not just one', () => {
    // A pinch arrives as dozens of pointermove events. Drift of a pixel per
    // event is invisible in a single-step test and obvious in the hand.
    let camera = START;
    const at = { x: 60, y: 640 };
    const before = worldAt(camera, VIEW, at);
    for (let i = 0; i < 60; i++) {
      camera = pinch(camera, at, camera.zoom * 1.02);
    }
    const after = worldAt(camera, VIEW, at);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(camera.zoom).toBe(MAX_ZOOM);
  });

  it('still holds the point when the zoom is clamped', () => {
    // Clamping is where an anchored zoom usually breaks: the camera is moved
    // for the zoom that was ASKED for and then the zoom is clamped to
    // something else, so the point slides at the limit. `anchored` clamps
    // first and positions against what it actually used.
    const at = { x: 20, y: 90 };
    const before = worldAt(START, VIEW, at);
    for (const asked of [12, 0.01]) {
      const camera = pinch(START, at, asked);
      expect(camera.zoom).toBe(asked > 1 ? MAX_ZOOM : MIN_ZOOM);
      const after = worldAt(camera, VIEW, at);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
  });
});

describe('two fingers that move as well as spread', () => {
  it('pans by the distance the midpoint travelled', () => {
    // No zoom change at all: the hand slid. The world under the fingers has
    // to come with it, which is the same call doing the panning.
    const from = { x: 100, y: 300 };
    const to = { x: 160, y: 380 };
    const hold = worldAt(START, VIEW, from);
    const camera = anchored(hold, VIEW, to, START.zoom);
    expect(worldAt(camera, VIEW, to).x).toBeCloseTo(hold.x, 9);
    expect(worldAt(camera, VIEW, to).y).toBeCloseTo(hold.y, 9);
    // And it moved the right way: the map followed the fingers.
    expect(camera.x).toBeCloseTo(START.x - 60 / START.zoom, 9);
  });
});

describe('clampZoom', () => {
  it('holds the range the map is legible in', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.35)).toBe(1.35);
  });
});

describe('two fingers', () => {
  it('has no midpoint or spread until there are two', () => {
    expect(midpoint([])).toBeNull();
    expect(midpoint([{ x: 1, y: 1 }])).toBeNull();
    expect(spread([{ x: 1, y: 1 }])).toBe(0);
  });

  it('measures between them', () => {
    const two = [{ x: 0, y: 0 }, { x: 6, y: 8 }];
    expect(midpoint(two)).toEqual({ x: 3, y: 4 });
    expect(spread(two)).toBe(10);
  });
});
