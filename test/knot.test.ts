import { describe, expect, it } from 'vitest';
import { knotBody, knotSvg, knotUri, plait } from '../src/render/knot';

const nums = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const start = (d: string): [number, number] => {
  const n = nums(d);
  return [n[0]!, n[1]!];
};
const end = (d: string): [number, number] => {
  const n = nums(d);
  return [n[n.length - 2]!, n[n.length - 1]!];
};

// strokes are [A's first half, B's broken half (before, after), A's broken
// half (before, after), B's second half].
const parts = (p: ReturnType<typeof plait>) => {
  const [a1, b1a, b1b, a2a, a2b, b2] = p.strokes as [string, string, string, string, string, string];
  return { a1, b1a, b1b, a2a, a2b, b2 };
};

describe('the plait tiles', () => {
  it('leaves each strand at the height it entered on, so the tile abuts itself', () => {
    const p = plait({ w: 22, h: 11 });
    const { a1, b1a, b2 } = parts(p);
    expect(start(a1)[0]).toBe(0);
    expect(start(b1a)[0]).toBe(0);
    expect(end(b2)[0]).toBe(p.w);
    // A enters low and B enters high; A leaves low and B leaves high.
    expect(end(parts(p).a2b)[0]).toBe(p.w);
    expect(end(parts(p).a2b)[1]).toBeCloseTo(start(a1)[1], 6);
    expect(end(b2)[1]).toBeCloseTo(start(b1a)[1], 6);
  });

  it('starts its two strands on opposite sides of the band', () => {
    const p = plait({ w: 22, h: 11 });
    const mid = p.h / 2;
    expect(start(parts(p).a1)[1]).toBeGreaterThan(mid);
    expect(start(parts(p).b1a)[1]).toBeLessThan(mid);
  });

  it('keeps every strand inside the band at any height it is given', () => {
    for (const h of [6, 9, 11, 13, 20]) {
      const p = plait({ w: 22, h, thick: 2.1 });
      for (const s of p.strokes) {
        for (const y of nums(s).filter((_, i) => i % 2 === 1)) {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it('flattens rather than inverting when the band is too thin to weave', () => {
    const p = plait({ w: 22, h: 2, thick: 2.1 });
    expect(start(parts(p).a1)[1]).toBeCloseTo(1, 6);
    expect(start(parts(p).b1a)[1]).toBeCloseTo(1, 6);
  });
});

describe('the plait actually weaves', () => {
  // THE TEST THIS FILE EXISTS FOR. The first version drew every strand twice
  // — once fat in a "casing" colour meant to cut the strand beneath, once
  // thin in ink — and set the casing to `transparent` so a band could sit on
  // any surface. A transparent stroke paints nothing and cuts nothing, so
  // what shipped was a LATTICE: two strands crossing and overlapping, with
  // no over and under in it anywhere. It built, it rendered, and it looked
  // like knotwork at a glance.
  it('breaks the strand that passes under, on both crossings', () => {
    const p = plait({ w: 22, h: 11, thick: 2.1 });
    const { b1a, b1b, a2a, a2b } = parts(p);
    // B goes under at the first crossing, a quarter of the way along.
    expect(end(b1a)[0]).toBeLessThan(p.w / 4);
    expect(start(b1b)[0]).toBeGreaterThan(p.w / 4);
    // A goes under at the second, three quarters along.
    expect(end(a2a)[0]).toBeLessThan((p.w * 3) / 4);
    expect(start(a2b)[0]).toBeGreaterThan((p.w * 3) / 4);
  });

  it('opens a gap wide enough to read as a gap', () => {
    const p = plait({ w: 22, h: 11, thick: 2.1 });
    const { b1a, b1b } = parts(p);
    const dx = start(b1b)[0] - end(b1a)[0];
    const dy = start(b1b)[1] - end(b1a)[1];
    const across = Math.hypot(dx, dy);
    // A gap narrower than the strand is a nick, not a crossing.
    expect(across).toBeGreaterThan(p.thick);
  });

  it('cuts its caps flat, so translucent ink does not bead at the junctions', () => {
    // Visible at 8x and invisible at 1x, which is why it is asserted rather
    // than left to the eye. The ink is translucent, so two strokes that
    // overlap print brighter — and a round cap puts a half-disc past the end
    // of every path, at both junctions inside the tile and again where one
    // tile abuts the next. The rule came out beaded with pips.
    expect(knotBody(plait())).toContain('stroke-linecap="butt"');
  });

  it('paints every stroke the same, so nothing is cutting by overpainting', () => {
    // The guard against the casing coming back: one colour, one width, six
    // paths. A second, wider stroke anywhere is the lattice bug returning.
    const p = plait();
    const body = knotBody(p);
    expect(body.match(/<path /g)).toHaveLength(6);
    expect(body.match(/stroke-width/g)).toHaveLength(1);
    expect(body.match(/stroke=/g)).toHaveLength(1);
  });
});

describe('the plait is a pattern, not a picture', () => {
  it('defines nothing and names nothing', () => {
    // A tile with an id cannot be used twice in one document without
    // renaming and cannot be a CSS data URI at all — which is what makes a
    // rule of any length cost the document zero nodes.
    const svg = knotSvg(plait());
    expect(svg).not.toContain('id=');
    expect(svg).not.toContain('<defs');
    expect(svg).not.toContain('url(#');
  });

  it('sizes the tile to one period, so the repeat is the period', () => {
    const svg = knotSvg(plait({ w: 22, h: 11 }));
    expect(svg).toContain('width="22"');
    expect(svg).toContain('height="11"');
    expect(svg).toContain('viewBox="0 0 22 11"');
  });
});

describe('the tile survives being a CSS value', () => {
  it('is a url() with nothing in it that would close the quote or the rule', () => {
    const uri = knotUri(plait({ ink: 'rgba(211,164,65,0.62)' }));
    expect(uri.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(uri.endsWith('")')).toBe(true);
    const inner = uri.slice('url("'.length, -2);
    expect(inner).not.toContain('"');
    expect(inner).not.toContain(')');
    // A raw # would end the URI at the fragment and hand CSS half a tile.
    expect(inner.slice('data:image/svg+xml,'.length)).not.toContain('#');
  });

  it('round-trips: what CSS decodes is the tile that was drawn', () => {
    const p = plait({ w: 22, h: 11, ink: 'rgba(211,164,65,0.62)' });
    const inner = knotUri(p).slice('url("data:image/svg+xml,'.length, -2);
    expect(decodeURIComponent(inner)).toBe(knotSvg(p));
  });
});
