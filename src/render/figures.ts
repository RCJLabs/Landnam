// A fighter drawn as a person, not a counter.
//
// Every combatant used to be the same circle with a dot — the side told you
// red or blue and nothing told you WHO. But a Person is one object across
// the whole game (CLAUDE.md pillar 1), so their look can be too: the shield
// paint, the cloak and the helm are seeded from the person themselves, and
// the same Ulf carries the same quartered madder shield every time he stands
// on a field this run. That is the data model made visible.
//
// Seeded like terrainArt's marks: decoration takes no run stream, consumes
// nothing the sim rolls, and the same person looks the same on every paint.
//
// Everything must survive ~40px on a phone — the motifs are bold blocks and
// spokes, not linework, and every state signal the old counter carried
// (side, health, active, defending, broken, banner) is still here and still
// reads at a glance.

import { makeRng } from '../rng';
import type { Person } from '../state/types';
import { mix } from './terrainArt';
import { svgEl } from './svg';

const darken = (hex: string, amount: number): string => mix(hex, '#000000', amount);
const lighten = (hex: string, amount: number): string => mix(hex, '#ffffff', amount);

/**
 * Period shield paint, split by side so the one glance that decides a fight
 * — who is ours — never has to be read off a motif. The warband paints warm
 * (madder, ochre, oxblood, parchment); the foes cold (woad, sea, iron,
 * slate). Any pairing within a family stays inside that read.
 */
const WARM = ['#b23b2e', '#d3a441', '#8a2f24', '#e8dcc0', '#8a6f43'];
const COLD = ['#3f4a5a', '#2e5468', '#6a7684', '#4a555f', '#8fa0b4'];

const IRON = '#5b6570';
const INK = '#14110d';

export interface FigureState {
  friendly: boolean;
  health: number;
  active: boolean;
  defending: boolean;
  broken: boolean;
  pennant: 'gold' | 'blood' | null;
}

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
function motif(
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

/**
 * The figure. `radius` is the shield's, in world units — the same 0.42 of a
 * hex the old counter used, so nothing about tap targets or spacing moves.
 */
export function figure(
  cx: number,
  cy: number,
  radius: number,
  person: Person,
  s: FigureState,
): SVGGElement {
  // The person's look, drawn once from who they are. `name` joins the id so
  // two runs' "p3" are not condemned to the same shield.
  const rng = makeRng(`landnam-figure:${person.id}:${person.name}`);
  const palette = s.friendly ? WARM : COLD;
  const fieldIx = rng.int(0, palette.length - 1);
  let accentIx = rng.int(0, palette.length - 2);
  if (accentIx >= fieldIx) accentIx += 1;
  const field = palette[fieldIx]!;
  const accent = palette[accentIx]!;
  const cloak = darken(palette[rng.int(0, palette.length - 1)]!, 0.35);
  const motifKind = rng.int(0, 4);
  const motifTilt = rng.float(0, Math.PI * 2);

  const g = svgEl('g', s.broken ? { opacity: '0.6' } : {});

  // Standing weight: the shadow is what makes a figure stand ON the ground
  // instead of floating over it.
  g.append(
    svgEl('ellipse', {
      cx,
      cy: cy + radius * 0.85,
      rx: radius * 1.0,
      ry: radius * 0.34,
      fill: INK,
      opacity: 0.35,
    }),
  );

  // The spear stands behind everything, and the banner flies from it — a
  // leader's pennant on its own floating mast read as UI, not as a thing
  // somebody carries.
  const spearX = cx + radius * 0.68;
  const spearTop = cy - radius - (s.pennant ? 12 : 7);
  g.append(
    svgEl('line', {
      x1: spearX,
      y1: cy + radius * 0.85,
      x2: spearX,
      y2: spearTop + 3,
      stroke: '#8a6f43',
      'stroke-width': 1.6,
    }),
    svgEl('path', {
      d: `M ${spearX} ${spearTop - 3} l 2.4 4.4 l -2.4 -1.4 l -2.4 1.4 Z`,
      fill: '#9fb0c4',
    }),
  );
  if (s.pennant) {
    g.append(
      svgEl('path', {
        d: `M ${spearX} ${spearTop + 2} l 11 3.5 l -11 3.5 Z`,
        fill: s.pennant === 'gold' ? '#d3a441' : '#b23b2e',
        class: 'leader-pennant',
      }),
    );
  }

  // Shoulders and cloak, just proud of the shield's edge.
  g.append(
    svgEl('ellipse', {
      cx,
      cy: cy + radius * 0.3,
      rx: radius * 1.04,
      ry: radius * 0.74,
      fill: cloak,
      opacity: 0.95,
    }),
  );

  // The helm over the rim: dome, and the nasal that makes it a helm rather
  // than a bump.
  const helmW = radius * 0.62;
  const helmTop = cy - radius * 1.18;
  g.append(
    svgEl('path', {
      d: `M ${cx - helmW} ${cy - radius * 0.62} a ${helmW} ${helmW * 1.05} 0 0 1 ${helmW * 2} 0 Z`,
      fill: IRON,
    }),
    svgEl('path', {
      d: `M ${cx - helmW * 0.72} ${cy - radius * 0.98} a ${helmW} ${helmW} 0 0 1 ${helmW * 0.8} ${-helmW * 0.24}`,
      fill: 'none',
      stroke: lighten(IRON, 0.35),
      'stroke-width': 1.2,
      opacity: 0.9,
    }),
    svgEl('line', {
      x1: cx,
      y1: helmTop + radius * 0.34,
      x2: cx,
      y2: cy - radius * 0.58,
      stroke: darken(IRON, 0.3),
      'stroke-width': 1.6,
    }),
  );

  // A braced shield reads as a heavier rim — kept from the old counter, the
  // signal players already know.
  if (s.defending) {
    g.append(
      svgEl('circle', {
        cx,
        cy,
        r: radius + 3,
        fill: 'none',
        stroke: '#cfd8dc',
        'stroke-width': 4,
        opacity: 0.85,
      }),
    );
  }

  // The shield itself. Broken, it sags: tilted and dropped, a line going out
  // of the fight before the body does.
  const shield = svgEl(
    'g',
    s.broken ? { transform: `rotate(16 ${cx} ${cy}) translate(1.5 2)` } : {},
  );
  shield.append(
    svgEl('circle', {
      cx,
      cy,
      r: radius,
      fill: field,
      stroke: s.friendly ? '#e8dcc0' : '#9fb0c4',
      'stroke-width': 2,
    }),
    ...motif(motifKind, cx, cy, radius, accent, motifTilt),
  );

  // Wear is painted on, not only counted below: past two-thirds the paint
  // dulls and a crack opens; past a third, a second crack.
  if (s.health < 0.67) {
    const crack = (angle: number): SVGElement => {
      const x0 = cx + Math.cos(angle) * radius * 0.95;
      const y0 = cy + Math.sin(angle) * radius * 0.95;
      const midA = angle + 0.45;
      return svgEl('path', {
        d:
          `M ${x0} ${y0} L ${cx + Math.cos(midA) * radius * 0.5} ${cy + Math.sin(midA) * radius * 0.5}` +
          ` L ${cx + Math.cos(angle + 0.2) * radius * 0.18} ${cy + Math.sin(angle + 0.2) * radius * 0.18}`,
        fill: 'none',
        stroke: INK,
        'stroke-width': 1.3,
        opacity: 0.75,
        'stroke-linejoin': 'round',
      });
    };
    shield.append(crack(rng.float(0, Math.PI * 2)));
    if (s.health < 0.34) {
      shield.append(
        crack(rng.float(0, Math.PI * 2)),
        svgEl('circle', { cx, cy, r: radius, fill: INK, opacity: 0.22 }),
      );
    }
  }

  // The boss: iron, a dark seat and one catch of light.
  shield.append(
    svgEl('circle', { cx, cy, r: radius * 0.24, fill: IRON, stroke: darken(IRON, 0.35), 'stroke-width': 1.2 }),
    svgEl('circle', {
      cx: cx - radius * 0.07,
      cy: cy - radius * 0.08,
      r: radius * 0.07,
      fill: lighten(IRON, 0.5),
      opacity: 0.9,
    }),
  );
  g.append(shield);

  if (s.active) {
    g.append(
      svgEl('circle', {
        cx,
        cy,
        r: radius + 5,
        fill: 'none',
        stroke: '#d3a441',
        'stroke-width': 3,
      }),
    );
  }

  // Broken: the white-feather mark, kept exactly as it was.
  if (s.broken) {
    g.append(
      svgEl('path', {
        d: `M ${cx - radius * 0.5} ${cy - radius - 6} l ${radius} 0 l ${-radius * 0.5} ${-radius * 0.6} Z`,
        fill: '#d3a441',
      }),
    );
  }

  // Health bar under the figure — the exact geometry the counter had, because
  // it is information first and decoration second.
  const width = radius * 2;
  g.append(
    svgEl('rect', {
      x: cx - width / 2,
      y: cy + radius + 4,
      width,
      height: 4,
      fill: INK,
      opacity: 0.6,
    }),
    svgEl('rect', {
      x: cx - width / 2,
      y: cy + radius + 4,
      width: Math.max(0, width * s.health),
      height: 4,
      fill: s.health > 0.5 ? '#7d9150' : s.health > 0.25 ? '#d3a441' : '#b23b2e',
    }),
  );
  return g;
}
