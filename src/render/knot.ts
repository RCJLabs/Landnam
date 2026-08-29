// Knotwork, done as a pattern (art queue item 16).
//
// Art 8 tried this and backed out, and its reason is on the record: "knotwork
// corners at 1px inset cost real nodes on every paint of the slot and read as
// noise at phone size". Both halves of that were worth re-measuring, because
// the first is only true of knotwork drawn as SHAPES.
//
// A plait is periodic. One period is a TILE, and a tile is a paint rather
// than a tree: as a CSS `background-image` it costs the document exactly zero
// nodes however long the rule is, and as an SVG `<pattern>` it costs one
// definition and one `<rect>` per use. The whole item is that sentence.
//
// This file is the ONE place the knot is drawn. It has no DOM in it, so
// `test/knot.test.ts` can ask whether the thing actually tiles and actually
// weaves.

export interface PlaitOpts {
  /** One full period. The tile abuts itself at 0 and at `w`. */
  w?: number;
  /** Band height. The strands fill it. */
  h?: number;
  /** Stroke width of a strand. */
  thick?: number;
  ink?: string;
  /** Half the gap opened in a strand that passes under, as a curve fraction. */
  gap?: number;
}

export interface Plait {
  /** Every stroke in the tile, in the order it is drawn. */
  strokes: string[];
  w: number;
  h: number;
  thick: number;
  ink: string;
}

type Pt = [number, number];

const round = (n: number): number => Math.round(n * 1000) / 1000;
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** de Casteljau. Splits one cubic into the piece before `t` and the piece after. */
function split(c: [Pt, Pt, Pt, Pt], t: number): [[Pt, Pt, Pt, Pt], [Pt, Pt, Pt, Pt]] {
  const [p0, p1, p2, p3] = c;
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const s = lerp(r0, r1, t);
  return [[p0, q0, r0, s], [s, r1, q2, p3]];
}

const d = (c: [Pt, Pt, Pt, Pt]): string => {
  const n = (p: Pt): string => `${round(p[0])} ${round(p[1])}`;
  return `M${n(c[0])}C${n(c[1])} ${n(c[2])} ${n(c[3])}`;
};

/**
 * Two strands in antiphase, woven, as a list of strokes in paint order.
 *
 * THE WEAVE IS A GAP, NOT AN OVERPAINT, and getting there took being wrong
 * first. The strands were originally drawn twice each — once fat in a
 * "casing" colour to cut the strand beneath, once thin in ink — and the
 * casing was set to `transparent` so a band could sit on any surface. A
 * transparent stroke paints NOTHING; it cuts nothing. Rendered side by side
 * at 8x against a casing painted in the surface colour, the transparent one
 * is plainly a lattice: the strands cross and overlap, brighter where they
 * meet, with no over and under anywhere in it.
 *
 * The honest fix is the one an inker would use. A strand that passes UNDER
 * simply stops before the crossing and starts again after it. That needs no
 * casing, no surface colour and no second copy of every path — so the tile
 * works on a card, on a chart and on a picture without being told what it is
 * lying on, which is the property that lets one definition serve them all.
 *
 * The two strands cross at a quarter and three quarters of the period, which
 * is the midpoint of each half-period cubic, so the splits are all at t=0.5
 * give or take the gap. B goes under at the first crossing, A at the second:
 * under, over, under, over, all the way along.
 *
 * NO IDS AND NO `<defs>`, which is a constraint and not an accident: an id
 * makes the tile unusable twice in one document and unusable as a data URI
 * at all, and the data URI is the entire mechanism.
 */
export function plait(opts: PlaitOpts = {}): Plait {
  const w = opts.w ?? 22;
  const h = opts.h ?? 11;
  const thick = opts.thick ?? 2.1;
  // 0.16 was compared against 0.24 at 8x: the wider gap severs the cord and
  // the band reads as a row of separate S-hooks rather than one woven thing.
  const gap = opts.gap ?? 0.16;
  // The strands swing as far as the band allows once the ink is paid for, so
  // a band is as woven as it can be at whatever height it is given.
  const amp = Math.max(0, h / 2 - thick / 2);
  const mid = h / 2;
  const q = w / 4;
  const half = w / 2;
  const lo = mid + amp;
  const hi = mid - amp;

  // Each strand is two half-period cubics. A runs low-high-low; B is the
  // same a half-period out of phase, so it runs high-low-high.
  const a1: [Pt, Pt, Pt, Pt] = [[0, lo], [q, lo], [q, hi], [half, hi]];
  const a2: [Pt, Pt, Pt, Pt] = [[half, hi], [w - q, hi], [w - q, lo], [w, lo]];
  const b1: [Pt, Pt, Pt, Pt] = [[0, hi], [q, hi], [q, lo], [half, lo]];
  const b2: [Pt, Pt, Pt, Pt] = [[half, lo], [w - q, lo], [w - q, hi], [w, hi]];

  // The piece before the crossing and the piece after, with the crossing
  // itself left unpainted.
  const broken = (c: [Pt, Pt, Pt, Pt]): [string, string] => [
    d(split(c, 0.5 - gap)[0]),
    d(split(c, 0.5 + gap)[1]),
  ];
  const [b1a, b1b] = broken(b1);
  const [a2a, a2b] = broken(a2);

  return {
    // Order is only bookkeeping now that nothing overpaints anything, but it
    // is kept as it reads: first crossing, then second.
    strokes: [d(a1), b1a, b1b, a2a, a2b, d(b2)],
    w, h, thick,
    ink: opts.ink ?? 'rgba(211,164,65,0.62)',
  };
}

/**
 * The tile's markup, without the `<svg>` around it.
 *
 * BUTT CAPS, and this one is visible at 8x and invisible at 1x, which is
 * why it is written down. The ink is a translucent gold, so anywhere two
 * strokes overlap the alpha doubles and prints a bright pip. Round caps put
 * a half-disc past the end of every path — at the two junctions inside the
 * tile, and again where each tile abuts the next — so a rule came out beaded
 * with little dots at the top and bottom of every crossing. Butt caps end
 * exactly on the point they share, so the junctions are seamless and the
 * tile seam disappears. It also happens to be how interlace is inked.
 */
export function knotBody(p: Plait): string {
  const paths = p.strokes.map((s) => `<path d="${s}"/>`).join('');
  return `<g fill="none" stroke="${p.ink}" stroke-width="${p.thick}" ` +
    `stroke-linecap="butt">${paths}</g>`;
}

/** One tile as a standalone document, sized so it repeats at its own scale. */
export function knotSvg(p: Plait): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" ` +
    `viewBox="0 0 ${p.w} ${p.h}">${knotBody(p)}</svg>`;
}

/**
 * The tile as a CSS `url()` value.
 *
 * `encodeURIComponent` rather than base64: it is shorter for markup, it stays
 * readable in devtools, and — the part that matters — it survives the
 * singlefile build, which inlines the stylesheet as text.
 *
 * THE PARENTHESES ARE ENCODED BY HAND, because `encodeURIComponent` leaves
 * them alone and the ink is an `rgba(...)`. Quoted, as it is written here, a
 * `)` inside the URI is harmless — which is exactly why this was invisible:
 * it built, it rendered, and `test/knot.test.ts` was what noticed. Unquoted
 * anywhere, ever, the first `)` would end the url() and hand CSS a third of
 * a tile. Four characters is a cheap price for the value not caring.
 */
export function knotUri(p: Plait): string {
  const body = encodeURIComponent(knotSvg(p)).replace(/\(/g, '%28').replace(/\)/g, '%29');
  return `url("data:image/svg+xml,${body}")`;
}

/**
 * Puts the knot on the document root, so the STYLESHEET can use it.
 *
 * Every ornament in the game is a rule or an edge, and all of them live in
 * CSS. Writing the tile into `style.css` by hand would have been shorter and
 * would have made this file a lie — there would be two knots, and the one
 * nobody looked at would drift. The custom properties are set once at boot
 * from the same `plait()` every other user calls.
 *
 * Two of them, because a rule and a frame want different weights: `--knot`
 * is the band that replaces a rule, `--knot-dim` the same weave for an edge
 * that should be felt rather than read.
 *
 * The period was CHOSEN BY LOOKING, five weights stacked on the real ending
 * card and compared at 390x844: 18x9 is a chain rather than a plait — the
 * crossings are too close to separate — and 30x12 is a lazy wave that has
 * stopped reading as interlace. 26x13 weaves best of all and is thirteen
 * pixels tall, which under a heading is a fence and not a rule. 22x11 is the
 * one that reads as two strands and still sits under type.
 */
export function installKnot(root: HTMLElement = document.documentElement): void {
  const base = { w: 22, h: 11, thick: 2.1 } as const;
  root.style.setProperty('--knot', knotUri(plait({ ...base, ink: 'rgba(211,164,65,0.62)' })));
  root.style.setProperty('--knot-dim', knotUri(plait({ ...base, ink: 'rgba(211,164,65,0.3)' })));
}
