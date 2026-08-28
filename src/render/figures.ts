// A fighter drawn as a person, not a counter.
//
// Every combatant used to be the same circle with a dot — the side told you
// red or blue and nothing told you WHO. But a Person is one object across
// the whole game (CLAUDE.md pillar 1), so their look can be too: the shield
// paint, the cloak and the helm are seeded from the person themselves, and
// the same Ulf carries the same quartered madder shield every time he stands
// on a field this run. That is the data model made visible.
//
// The seeding itself now lives in `look.ts` and the shield in `shield.ts`,
// because this is the HEAD-ON view — a shield filling the middle of the
// picture with a helm over it — and the road and the yard needed the same
// person seen from the side. What is drawn here did not change when they
// moved out; where it is decided did.
//
// Everything must survive ~40px on a phone — the motifs are bold blocks and
// spokes, not linework, and every state signal the old counter carried
// (side, health, active, defending, broken, banner) is still here and still
// reads at a glance.

import { darken, lighten, lookOf, INK, IRON } from './look';
import { crack, shieldFace } from './shield';
import type { Person } from '../state/types';
import { svgEl } from './svg';

export interface FigureState {
  friendly: boolean;
  health: number;
  active: boolean;
  defending: boolean;
  broken: boolean;
  pennant: 'gold' | 'blood' | null;
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
  const look = lookOf(person, s.friendly);
  const rng = look.rng;

  // Marked so the browser bars can find a fighter and measure him. On the
  // hex field they measured a ground polygon, because a fighter's touch
  // target WAS his hex; side-on there is no tile under him and the man
  // himself is the thing a thumb has to land on.
  const g = svgEl('g', s.broken ? { class: 'fighter', opacity: '0.6' } : { class: 'fighter' });

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
      fill: look.cloak,
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

  // Wear is painted on, not only counted below: past two-thirds the paint
  // dulls and a crack opens; past a third, a second crack.
  const wear: SVGElement[] = [];
  if (s.health < 0.67) {
    wear.push(crack(cx, cy, radius, rng.float(0, Math.PI * 2)));
    if (s.health < 0.34) {
      wear.push(
        crack(cx, cy, radius, rng.float(0, Math.PI * 2)),
        svgEl('circle', { cx, cy, r: radius, fill: INK, opacity: 0.22 }),
      );
    }
  }

  // The shield itself. Broken, it sags: tilted and dropped, a line going out
  // of the fight before the body does.
  const shield = svgEl(
    'g',
    s.broken ? { transform: `rotate(16 ${cx} ${cy}) translate(1.5 2)` } : {},
  );
  shield.append(...shieldFace(cx, cy, radius, look, s.friendly, wear));
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
