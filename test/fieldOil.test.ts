// The two pure parts of the painted battlefield.
//
// `fit` is the one thing in fieldOil.ts that can fail SILENTLY: a canvas
// allocation past iOS Safari's limit does not throw, it hands back a blank
// surface, and a blank surface under a shield wall looks like a rendering
// bug rather than a memory limit. So the climb-down is checked here, without
// a browser, exactly as the steading's is.
//
// `countryKey` is the other half of the file's whole performance claim —
// that a fight repaints its country once and keeps it for every turn after.
// Measured, the painting costs about 200ms; a key that changed when a man
// moved would spend that on every action.

import { describe, expect, it } from 'vitest';
import { FIELD_SCALE, countryKey, fit } from '../src/render/fieldOil';
import { extent } from '../src/render/line';

const box = (w: number, h: number) => ({ x: -w / 2, y: 0, w, h });

describe('the canvas a field needs', () => {
  it('paints at the scale it asks for when there is room', () => {
    const cut = fit(box(600, 900), 1);
    expect(cut.scale).toBe(FIELD_SCALE);
    expect(cut.w).toBe(Math.floor(600 * FIELD_SCALE));
    expect(cut.h).toBe(Math.floor(900 * FIELD_SCALE));
  });

  it('takes the device pixel ratio into account', () => {
    expect(fit(box(600, 900), 3).scale).toBe(FIELD_SCALE * 3);
    // A ratio under 1 is not a licence to paint blurrier than asked.
    expect(fit(box(600, 900), 0.5).scale).toBe(FIELD_SCALE);
  });

  it('climbs down rather than asking for a canvas iOS will not give', () => {
    // The failure this function exists for. A deep line on a retina phone is
    // the case: twelve ranks is past 1200 world units, and 1200 * 1.0 * 3 is
    // already 3600 before anything else grows.
    for (const deep of [6, 12, 24, 60]) {
      for (const dpr of [1, 2, 3]) {
        const cut = fit(extent(deep), dpr);
        expect(Math.max(cut.w, cut.h), `${deep} deep at dpr ${dpr}`).toBeLessThanOrEqual(4096);
        expect(cut.w, 'a canvas with no width').toBeGreaterThan(0);
        expect(cut.h, 'a canvas with no height').toBeGreaterThan(0);
      }
    }
  });

  it('keeps the canvas in proportion to the field when it climbs down', () => {
    // A climb-down that squashed one axis would paint the country stretched.
    const wide = extent(40);
    const cut = fit(wide, 3);
    expect(cut.w / cut.h).toBeCloseTo(wide.w / wide.h, 1);
  });

  it('never returns a fractional canvas', () => {
    const cut = fit(extent(7), 2.625);
    expect(Number.isInteger(cut.w)).toBe(true);
    expect(Number.isInteger(cut.h)).toBe(true);
  });
});

describe('when the country has to be painted again', () => {
  it('is the same key for the same field, so the painting is kept', () => {
    expect(countryKey(box(600, 900), 'meadow', 's')).toBe(countryKey(box(600, 900), 'meadow', 's'));
  });

  it('changes when the line deepens, because the field got wider', () => {
    expect(countryKey(extent(4), 'meadow', 's')).not.toBe(countryKey(extent(6), 'meadow', 's'));
  });

  it('changes with the country and with the world', () => {
    expect(countryKey(box(600, 900), 'meadow', 's'))
      .not.toBe(countryKey(box(600, 900), 'forest', 's'));
    expect(countryKey(box(600, 900), 'meadow', 'one'))
      .not.toBe(countryKey(box(600, 900), 'meadow', 'two'));
  });

  it('survives the sub-pixel wobble a fitted box arrives with', () => {
    // `extent` is arithmetic on floats and the caller has been seen handing
    // over `1.1368683772161603e-13` for what should be zero. A key that
    // changed on that would repaint 200ms of country every turn while
    // reporting that it had kept it.
    const clean = box(600, 900);
    const wobbly = { x: clean.x + 1e-13, y: 1.1368683772161603e-13, w: clean.w - 2e-13, h: clean.h };
    expect(countryKey(wobbly, 'meadow', 's')).toBe(countryKey(clean, 'meadow', 's'));
  });
});
