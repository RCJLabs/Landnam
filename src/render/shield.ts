// The round shield, drawn once.
//
// It is the thing a player actually reads a person off — at phone size the
// face and the tunic are a few pixels each, and the shield is a third of the
// figure. So it is worth exactly one implementation: the fighter in battle
// carries it on his arm, the walker on the road carries it slung on his
// back, and it is the SAME shield, because both ask this file for it.
//
// Everything here survives ~40px: the motifs are bold blocks and spokes, not
// linework.

import { darken, lighten, INK, IRON, type Look } from './look';
import { svgEl } from './svg';

/** One wedge of a round shield, for quarters and rays. Angles in radians. */
function sector(cx: number, cy: number, r: number, a0: number, a1: number): SVGElement {
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  return svgEl('path', {
    d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`,
  });
}

/** The painted face: one of five period motifs in the accent colour. */
export function motif(
  kind: number,
  cx: number,
  cy: number,
  r: number,
  accent: string,
  tilt: number,
): SVGElement[] {
  const out: SVGElement[] = [];
  if (kind === 0) {
    // Halved.
    const a0 = tilt;
    const a1 = tilt + Math.PI;
    out.push(sector(cx, cy, r, a0, a1));
  } else if (kind === 1) {
    // Quartered: two opposite quarters carry the paint.
    out.push(sector(cx, cy, r, tilt, tilt + Math.PI / 2));
    out.push(sector(cx, cy, r, tilt + Math.PI, tilt + Math.PI * 1.5));
  } else if (kind === 2) {
    // Sunwheel: six spokes off the boss.
    for (let i = 0; i < 6; i++) {
      const a = tilt + (i * Math.PI) / 3;
      out.push(
        svgEl('line', {
          x1: cx + Math.cos(a) * r * 0.26,
          y1: cy + Math.sin(a) * r * 0.26,
          x2: cx + Math.cos(a) * r * 0.92,
          y2: cy + Math.sin(a) * r * 0.92,
          stroke: accent,
          'stroke-width': r * 0.18,
          'stroke-linecap': 'round',
        }),
      );
    }
    return out;
  } else if (kind === 3) {
    // Rayed: three alternating wedges.
    for (let i = 0; i < 3; i++) {
      const a = tilt + (i * 2 * Math.PI) / 3;
      out.push(sector(cx, cy, r, a, a + Math.PI / 3));
    }
  } else {
    // Ringed.
    out.push(
      svgEl('circle', {
        cx,
        cy,
        r: r * 0.58,
        fill: 'none',
        stroke: accent,
        'stroke-width': r * 0.2,
      }),
    );
    return out;
  }
  for (const shape of out) shape.setAttribute('fill', accent);
  return out;
}

/** The iron boss: a dark seat and one catch of light. */
export function boss(cx: number, cy: number, r: number): SVGElement[] {
  return [
    svgEl('circle', {
      cx, cy, r: r * 0.24, fill: IRON, stroke: darken(IRON, 0.35), 'stroke-width': 1.2,
    }),
    svgEl('circle', {
      cx: cx - r * 0.07,
      cy: cy - r * 0.08,
      r: r * 0.07,
      fill: lighten(IRON, 0.5),
      opacity: 0.9,
    }),
  ];
}

/**
 * A whole shield, face on.
 *
 * `wear` goes between the paint and the boss because that is where the
 * fighter's cracks have always gone — over the motif, under the iron.
 */
export function shieldFace(
  cx: number,
  cy: number,
  r: number,
  look: Look,
  friendly: boolean,
  wear: SVGElement[] = [],
): SVGElement[] {
  return [
    svgEl('circle', {
      cx, cy, r,
      fill: look.field,
      stroke: friendly ? '#e8dcc0' : '#9fb0c4',
      'stroke-width': 2,
    }),
    ...motif(look.motifKind, cx, cy, r, look.accent, look.motifTilt),
    ...wear,
    ...boss(cx, cy, r),
  ];
}

/**
 * A crack across the paint, from the rim toward the boss.
 *
 * Painted wear rather than only counted: past two-thirds of health the shield
 * opens once, past a third twice.
 */
export function crack(cx: number, cy: number, r: number, angle: number): SVGElement {
  const x0 = cx + Math.cos(angle) * r * 0.95;
  const y0 = cy + Math.sin(angle) * r * 0.95;
  const midA = angle + 0.45;
  return svgEl('path', {
    d:
      `M ${x0} ${y0} L ${cx + Math.cos(midA) * r * 0.5} ${cy + Math.sin(midA) * r * 0.5}` +
      ` L ${cx + Math.cos(angle + 0.2) * r * 0.18} ${cy + Math.sin(angle + 0.2) * r * 0.18}`,
    fill: 'none',
    stroke: INK,
    'stroke-width': 1.3,
    opacity: 0.75,
    'stroke-linejoin': 'round',
  });
}

/**
 * The same shield, TURNED — held out toward an enemy rather than shown flat
 * to the viewer.
 *
 * A round shield presented at a foe is edge-on to anybody watching from the
 * side, and an edge is a line: it would throw away the paint, which is the
 * thing a player reads a man by. So it is foreshortened instead — squashed
 * about its own centre, motif and all, which is what a turned disc actually
 * does. `squash` of 1 is face-on and 0 is edge-on; around 0.45 reads as a
 * shield held toward the enemy while keeping its ground and its motif
 * legible at phone size.
 */
export function shieldTurned(
  cx: number,
  cy: number,
  r: number,
  look: Look,
  friendly: boolean,
  squash: number,
  wear: SVGElement[] = [],
): SVGGElement {
  const g = svgEl('g', {
    transform: `translate(${cx} ${cy}) scale(${squash} 1) translate(${-cx} ${-cy})`,
  });
  g.append(...shieldFace(cx, cy, r, look, friendly, wear));
  return g;
}
