// A fighter drawn as a person, seen from the side.
//
// ## Why this is not a shield any more
//
// It used to draw every combatant HEAD-ON: a round shield as wide as the
// whole figure, a helm peeping over the rim, a health bar under it. No body,
// no legs, no face — and, worse, head-on in a scene that is otherwise
// entirely side-on. Everything around these men is a profile: the ground
// line, the ridges behind, the ranks receding, the walls meeting left
// against right. Only the men faced the camera.
//
// I asserted the opposite in `walker.ts` while writing Art 13 — that the
// head-on figure "is exactly right on a battlefield, where a shield wall is
// what you are looking at" — and never checked it at the size the field
// actually draws. A player did, and reported it in the plainest possible
// terms: "I only saw shields and not the actual vikings."
//
// So a fighter is a man now, in profile, turned toward the enemy: legs, a
// tunic, a cloak, a helm, and his shield held out at the wall. He is built
// from the same `look.ts` as the walker on the road and the folk in the
// yard, so the man in the line is provably the man who walked there — which
// was Art 13's whole claim and is only now true of all three views.
//
// ## What still has to read at 40px
//
// Every state signal the old counter carried: side (warm paint against
// cold), health, whose turn it is, a braced shield, a broken man, and the
// leader's pennant. They are all still here.

import { darken, lighten, lookOf, INK, IRON } from './look';
import { beltAxes } from './gear';
import { crack, shieldTurned } from './shield';
import type { Person } from '../state/types';
import { svgEl } from './svg';

/** One tone for skin, as `walker.ts` uses; a second one is a smudge here. */
const SKIN = '#c6a184';

/**
 * How much of its face a shield shows when it is turned at the enemy.
 *
 * Edge-on is honest and useless: it would throw away the paint, which is the
 * one thing a player tells two men apart by. See `shieldTurned`.
 */
const SHIELD_TURN = 0.46;

export interface FigureState {
  friendly: boolean;
  health: number;
  active: boolean;
  defending: boolean;
  broken: boolean;
  pennant: 'gold' | 'blood' | null;
  /** +1 faces right, -1 faces left. Each wall faces the other. */
  facing: number;
  /**
   * Hand-axes left to throw. `sim/ranks.ts`: "`throw` is a hand-axe. It
   * reaches anybody, which is what makes the back rank worth standing in" —
   * and the whole of that resource reached the screen as a digit on a
   * button until Art 14.
   */
  throws: number;
}

/**
 * The figure. `radius` is the old shield radius, kept as the size handle
 * because `FIGURE_R`, the tap rule, `fx.ts` and `pick` are all written
 * against it — and `cy` is still the chest, so nothing about where a man
 * stands or what a thumb has to hit moves.
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
  const f = s.facing >= 0 ? 1 : -1;

  // Feet and height chosen so the man occupies the same box the head-on
  // figure did: it stood from `cy - radius * 1.18` to `cy + radius * 0.85`.
  const groundY = cy + radius * 0.85;
  const h = radius * 2.0 * look.build;

  const hipY = groundY - h * 0.46;
  const shoulderY = groundY - h * 0.76;
  const headY = groundY - h * 0.875;
  const headR = h * 0.105;

  const g = svgEl('g', s.broken ? { class: 'fighter', opacity: '0.6' } : { class: 'fighter' });

  // Standing weight.
  g.append(svgEl('ellipse', {
    cx, cy: groundY, rx: h * 0.19, ry: h * 0.05, fill: INK, opacity: 0.35,
  }));

  // The spear, over the rear shoulder and levelled at the enemy. The
  // pennant flies from it, because a leader's flag on a floating mast read
  // as UI rather than as a thing somebody carries.
  const buttX = cx - f * h * 0.2;
  const tipX = cx + f * h * 0.34;
  const spearY = groundY - h * 0.66;
  g.append(
    svgEl('line', {
      x1: buttX, y1: spearY + h * 0.08, x2: tipX, y2: spearY - h * 0.02,
      stroke: '#8a6f43', 'stroke-width': Math.max(1.4, h * 0.026),
      'stroke-linecap': 'round',
    }),
    svgEl('path', {
      d: `M ${tipX} ${spearY - h * 0.02} l ${f * h * 0.07} ${h * 0.02}` +
         ` l ${-f * h * 0.07} ${h * 0.035} Z`,
      fill: '#9fb0c4',
    }),
  );
  if (s.pennant) {
    g.append(svgEl('path', {
      d: `M ${buttX} ${spearY + h * 0.06} l ${-f * h * 0.13} ${h * 0.04}` +
         ` l ${f * h * 0.13} ${h * 0.05} Z`,
      fill: s.pennant === 'gold' ? '#d3a441' : '#b23b2e',
      class: 'leader-pennant',
    }));
  }

  // The cloak, hanging behind him.
  g.append(svgEl('path', {
    d: `M ${cx - f * h * 0.02} ${shoulderY - h * 0.03}` +
       ` C ${cx - f * h * 0.26} ${groundY - h * 0.56},` +
       ` ${cx - f * h * 0.29} ${groundY - h * 0.28},` +
       ` ${cx - f * h * 0.18} ${groundY - h * 0.12}` +
       ` L ${cx + f * h * 0.05} ${groundY - h * 0.22} Z`,
    fill: look.cloak,
    opacity: 0.95,
  }));

  /** One leg, hip to heel, with a knee in it. */
  const leg = (foot: number, shade: number): SVGElement => svgEl('path', {
    d: `M ${cx} ${hipY} L ${cx + foot * 0.55} ${(hipY + groundY) / 2} L ${cx + foot} ${groundY}`,
    fill: 'none',
    stroke: darken(look.tunic, shade),
    'stroke-width': h * 0.058,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  // Braced in a fighting stance: rear foot back, front foot forward. A man
  // in a shield wall is not standing to attention.
  g.append(leg(-f * h * 0.13, 0.45));

  // The body: a tunic, leaning into the wall.
  const lean = f * h * 0.025;
  g.append(
    svgEl('path', {
      d: `M ${cx - h * 0.1 + lean} ${shoulderY} L ${cx + h * 0.1 + lean} ${shoulderY}` +
         ` L ${cx + h * 0.085} ${hipY} L ${cx - h * 0.085} ${hipY} Z`,
      fill: look.tunic,
      stroke: darken(look.tunic, 0.4),
      'stroke-width': 1,
    }),
    svgEl('line', {
      x1: cx - h * 0.085, y1: hipY - h * 0.01, x2: cx + h * 0.085, y2: hipY - h * 0.01,
      stroke: darken(look.tunic, 0.55), 'stroke-width': h * 0.022,
    }),
  );
  g.append(leg(f * h * 0.1, 0.15));

  // Hand-axes on the rear hip, one per throw he has left — gear you can
  // watch being spent, which is the only kind that changes how anybody
  // plays. Drawn after the tunic so they hang on the belt, and before the
  // shield so the shield covers nothing it should not.
  if (s.throws > 0) g.append(...beltAxes(cx, hipY, h, f, s.throws));

  // The head, in profile under a helm. Hair and beard from `look`, so age
  // and colouring are the same man's wherever he is drawn.
  const headX = cx + f * h * 0.03 + lean;
  g.append(svgEl('circle', { cx: headX, cy: headY, r: headR, fill: SKIN }));
  if (look.beard > 0) {
    const long = look.beard === 2 ? 1.6 : 1.1;
    g.append(svgEl('path', {
      d: `M ${headX - f * headR * 0.5} ${headY + headR * 0.4}` +
         ` L ${headX + f * headR * 0.95} ${headY + headR * 0.1}` +
         ` L ${headX + f * headR * 0.35} ${headY + headR * long} Z`,
      fill: look.hair,
    }));
  }
  // The helm: a dome with a nasal, which is what makes it a helm rather
  // than a bump.
  g.append(
    svgEl('path', {
      d: `M ${headX - headR * 1.12} ${headY + headR * 0.18}` +
         ` a ${headR * 1.12} ${headR * 1.2} 0 0 1 ${headR * 2.24} 0 Z`,
      fill: IRON,
    }),
    svgEl('path', {
      d: `M ${headX - headR * 0.75} ${headY - headR * 0.35}` +
         ` a ${headR} ${headR} 0 0 1 ${headR * 0.9} ${-headR * 0.2}`,
      fill: 'none', stroke: lighten(IRON, 0.35), 'stroke-width': 1.1, opacity: 0.9,
    }),
    svgEl('line', {
      x1: headX + f * headR * 0.95, y1: headY + headR * 0.05,
      x2: headX + f * headR * 0.95, y2: headY + headR * 0.75,
      stroke: darken(IRON, 0.3), 'stroke-width': Math.max(1, headR * 0.28),
    }),
  );

  // THE SHIELD, held out at the enemy. Turned rather than flat — see
  // `shieldTurned` for why it is not drawn edge-on — and on the facing
  // side, in front of the body, which is what a shield is for.
  const shieldR = h * 0.29;
  const shieldX = cx + f * h * 0.16;
  const shieldY = groundY - h * 0.55;
  const wear: SVGElement[] = [];
  if (s.health < 0.67) {
    wear.push(crack(shieldX, shieldY, shieldR, rng.float(0, Math.PI * 2)));
    if (s.health < 0.34) {
      wear.push(
        crack(shieldX, shieldY, shieldR, rng.float(0, Math.PI * 2)),
        svgEl('circle', { cx: shieldX, cy: shieldY, r: shieldR, fill: INK, opacity: 0.22 }),
      );
    }
  }
  // Braced: the rim thickens, the signal players already know.
  if (s.defending) {
    g.append(svgEl('ellipse', {
      cx: shieldX, cy: shieldY, rx: (shieldR + 3) * SHIELD_TURN, ry: shieldR + 3,
      fill: 'none', stroke: '#cfd8dc', 'stroke-width': 4, opacity: 0.85,
    }));
  }
  const shield = svgEl(
    'g',
    // Broken, it sags: a shield going out of the fight before the body does.
    s.broken ? { transform: `rotate(${f * 16} ${shieldX} ${shieldY}) translate(1.5 2)` } : {},
  );
  shield.append(shieldTurned(shieldX, shieldY, shieldR, look, s.friendly, SHIELD_TURN, wear));
  g.append(shield);

  // Whose turn it is: a ring on the GROUND he stands on, not a hoop drawn
  // round his body. Ranks overlap in a wall, so a ring round the man swallows
  // the two beside him — and the ground under a man is the one part of him
  // nobody else covers, which is the reason the target marks are drawn there
  // too. One idiom for "this man", in both places that need it.
  if (s.active) {
    g.append(svgEl('ellipse', {
      cx, cy: groundY, rx: h * 0.22, ry: h * 0.06,
      fill: 'none', stroke: '#d3a441', 'stroke-width': 2.6,
    }));
  }

  // Broken: the white-feather mark, kept exactly as it was.
  if (s.broken) {
    g.append(svgEl('path', {
      d: `M ${cx - radius * 0.5} ${groundY - h - 6} l ${radius} 0 l ${-radius * 0.5} ${-radius * 0.6} Z`,
      fill: '#d3a441',
    }));
  }

  // Health bar under the figure — information first, decoration second, and
  // the same geometry the counter had so nothing about reading a line moves.
  const width = radius * 2;
  g.append(
    svgEl('rect', {
      x: cx - width / 2, y: groundY + 4, width, height: 4, fill: INK, opacity: 0.6,
    }),
    svgEl('rect', {
      x: cx - width / 2, y: groundY + 4,
      width: Math.max(0, width * s.health), height: 4,
      fill: s.health > 0.5 ? '#7d9150' : s.health > 0.25 ? '#d3a441' : '#b23b2e',
    }),
  );
  return g;
}
