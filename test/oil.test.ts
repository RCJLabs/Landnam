// The one property the painted renderer is built on.
//
// Every stroke comes from a stream derived per PATCH from the seed and the
// patch's own address. That is what makes the painting a function of the
// country rather than of the order somebody walked it — and it is what lets a
// sharper repaint be the SAME painting rather than a second one.
//
// It is also the reason none of this needs a save change: nothing is stored,
// because everything is derived.
//
// The address was a hex until 8.5 and `hexRng` lived in render/oil.ts. It is
// a string now — the ground a patch covers, whatever the caller calls it —
// and the brush's own callers (`fieldOil`, `steadingView`) derive it. The
// property being pinned did not change; only what a patch is addressed by.

import { describe, expect, it } from 'vitest';
import { patchRng } from '../src/render/oil';

const draw = (rng: { next(): number }, n = 12): number[] =>
  Array.from({ length: n }, () => rng.next());

const A = 'r3:c4';
const B = 'r3:c5';

describe('a patch paints itself the same way every time', () => {
  it('gives the same strokes for the same seed, patch and pass', () => {
    expect(draw(patchRng('raven-skerry-317', A, 'ground')))
      .toEqual(draw(patchRng('raven-skerry-317', A, 'ground')));
  });

  it('does not depend on the order patches are painted in', () => {
    const eastFirst = [draw(patchRng('s', A, 'ground')), draw(patchRng('s', B, 'ground'))];
    const westFirst = [draw(patchRng('s', B, 'ground')), draw(patchRng('s', A, 'ground'))];
    expect(eastFirst[0]).toEqual(westFirst[1]);
    expect(eastFirst[1]).toEqual(westFirst[0]);
  });

  it('paints neighbours differently, or the ground would be wallpaper', () => {
    expect(draw(patchRng('s', A, 'ground'))).not.toEqual(draw(patchRng('s', B, 'ground')));
  });

  it('paints the same patch differently in two different worlds', () => {
    expect(draw(patchRng('one', A, 'ground'))).not.toEqual(draw(patchRng('two', A, 'ground')));
  });

  it('keeps the scumble independent of the ground under it', () => {
    // Sharing a stream would make the glaze a function of how many strokes
    // the ground happened to take, so changing the brush would move the fog.
    expect(draw(patchRng('s', A, 'ground'))).not.toEqual(draw(patchRng('s', A, 'scumble')));
  });

  it('is stable across a long draw, not just the first few rolls', () => {
    expect(draw(patchRng('s', A, 'ground'), 400)).toEqual(draw(patchRng('s', A, 'ground'), 400));
  });

  it('spreads over the whole unit interval', () => {
    // A derived stream that clustered would put every stroke in one place.
    const rolls = draw(patchRng('s', A, 'ground'), 2000);
    const buckets = new Array(10).fill(0);
    for (const r of rolls) buckets[Math.min(9, Math.floor(r * 10))] += 1;
    for (const b of buckets) expect(b).toBeGreaterThan(120);
  });
});
