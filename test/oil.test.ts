// The one property the painted renderer is built on.
//
// Every stroke comes from a stream derived per hex from the seed and the
// coordinate. That is what makes the painting a function of the country
// rather than of the order somebody walked it — and it is what would let a
// sharper repaint at full pinch be the SAME painting rather than a second
// one, which is the difference between zooming in and the map flickering
// between two worlds.
//
// It is also the reason none of this needs a save change: nothing is stored,
// because everything is derived.

import { describe, expect, it } from 'vitest';
import { hexRng } from '../src/render/oil';
import type { Hex } from '../src/hex';

const draw = (rng: { next(): number }, n = 12): number[] =>
  Array.from({ length: n }, () => rng.next());

const A: Hex = { q: 12, r: 7 };
const B: Hex = { q: 13, r: 7 };

describe('a hex paints itself the same way every time', () => {
  it('gives the same strokes for the same seed, hex and pass', () => {
    expect(draw(hexRng('raven-skerry-317', A, 'ground')))
      .toEqual(draw(hexRng('raven-skerry-317', A, 'ground')));
  });

  it('does not depend on the order hexes are painted in', () => {
    // Walk east then west, or west then east: the country looks the same.
    const eastFirst = [draw(hexRng('s', A, 'ground')), draw(hexRng('s', B, 'ground'))];
    const westFirst = [draw(hexRng('s', B, 'ground')), draw(hexRng('s', A, 'ground'))];
    expect(eastFirst[0]).toEqual(westFirst[1]);
    expect(eastFirst[1]).toEqual(westFirst[0]);
  });

  it('paints neighbours differently, or the coast would be wallpaper', () => {
    expect(draw(hexRng('s', A, 'ground'))).not.toEqual(draw(hexRng('s', B, 'ground')));
  });

  it('paints the same hex differently in two different worlds', () => {
    expect(draw(hexRng('one', A, 'ground'))).not.toEqual(draw(hexRng('two', A, 'ground')));
  });

  it('keeps the scumble independent of the ground under it', () => {
    // Sharing a stream would make the glaze a function of how many strokes
    // the ground happened to take, so changing the brush would move the fog.
    expect(draw(hexRng('s', A, 'ground'))).not.toEqual(draw(hexRng('s', A, 'scumble')));
  });

  it('is stable across a long draw, not just the first few rolls', () => {
    expect(draw(hexRng('s', A, 'ground'), 400)).toEqual(draw(hexRng('s', A, 'ground'), 400));
  });

  it('spreads over the whole unit interval', () => {
    // A derived stream that clustered would put every stroke in one place.
    const rolls = draw(hexRng('s', A, 'ground'), 2000);
    const buckets = new Array(10).fill(0);
    for (const r of rolls) buckets[Math.min(9, Math.floor(r * 10))] += 1;
    for (const b of buckets) expect(b).toBeGreaterThan(120);
  });
});
