// A person seen from the side, walking or standing.
//
// ## Why this file exists
//
// The roadmap said Art 13 was "mostly making the other two views ask
// `figures.ts` for the same person rather than inventing anything". They
// already did. Measured on the built page: the procession and the elevation
// both call `figure()` for every person, and both looked like coloured
// discs anyway — because `figure()` draws a fighter HEAD-ON, which is a
// round shield the width of the whole figure with a helm peeping over the
// top. That is exactly right on a battlefield, where a shield wall is what
// you are looking at. On a road it is a disc, and six of them is six discs.
//
// So the missing piece was not a shared call. It was a second VIEW of the
// same person: a body with legs under it, a face, and the shield slung on
// the back where the paint is still the thing you read them by. Both views
// take their colours from `look.ts`, so this is provably the same Ulf —
// same shield ground, same motif, same cloak — and not a lookalike.
//
// ## What has to survive
//
// A walker is about 68 units tall in a 640-unit scene, which on a phone is
// roughly 90 real pixels. At that size a face is four pixels: the shield and
// the cloak carry the identity, the silhouette carries the pose, and nothing
// is drawn in linework that a thumb-width of screen would swallow.

import { darken, lookOf, BUILD_MAX, INK } from './look';
import { crack, shieldFace } from './shield';
import type { Person } from '../state/types';
import { svgEl } from './svg';

/** One tone for skin; at this size a second one is a smudge. */
const SKIN = '#c6a184';

/**
 * How far a walker reaches from the ground he stands on, in heights.
 *
 * Stated rather than left implicit because the caller has to lay several of
 * them out inside a picture, and "roughly this wide" is how a file ends up
 * walking off the left edge — which is exactly what the road did. The same
 * discipline as `HOUSE_REACH` in `steading.ts`, and for the same reason.
 *
 * BEHIND is the far edge of the shield slung on the back (0.21 back, 0.17
 * across); AHEAD is the spear butt a leader plants (0.13), which is wider
 * than the shadow (0.17 halved) or the head. TOP is a leader's spear tip.
 */
export const WALKER_BEHIND = 0.38;
export const WALKER_AHEAD = 0.17;
export const WALKER_TOP = 1.12;

/** The box a walker of this height draws in, at the tallest build. */
export function walkerBox(
  x: number,
  groundY: number,
  height: number,
  facing: number,
): { left: number; right: number; top: number; bottom: number } {
  const h = height * BUILD_MAX;
  const back = h * WALKER_BEHIND;
  const front = h * WALKER_AHEAD;
  const f = facing >= 0 ? 1 : -1;
  return {
    left: f > 0 ? x - back : x - front,
    right: f > 0 ? x + front : x + back,
    top: groundY - h * WALKER_TOP,
    bottom: groundY,
  };
}

export interface WalkerState {
  friendly: boolean;
  /** 0..1, as `FigureState.health` is. */
  health: number;
  /** +1 faces the way the road runs, -1 back the way they came. */
  facing: number;
  /** Standing still plants both feet; walking swings them. */
  walking: boolean;
  /** They are at the head of the file, and carry the band's spear. */
  leader: boolean;
  /**
   * A word for what they are doing, drawn under them. The yard uses it for
   * the job; the road has nothing to say and passes nothing.
   */
  doing?: string;
}

/**
 * One person, side on, standing on the ground at (`x`, `groundY`).
 *
 * `height` is the whole figure, crown to heel, before the person's own build
 * is applied — so a caller sizes the BAND and the seed decides who in it is
 * the tall one.
 */
export function walker(
  x: number,
  groundY: number,
  height: number,
  person: Person,
  s: WalkerState,
): SVGGElement {
  const look = lookOf(person, s.friendly);
  const rng = look.rng;
  const h = height * look.build;
  const f = s.facing >= 0 ? 1 : -1;

  const g = svgEl('g', { class: 'walker' });

  // The gait. Seeded per person so a file does not march in lockstep — which
  // is the single cheapest thing that makes six figures read as six people
  // rather than one sprite repeated.
  const swing = s.walking ? Math.sin(look.stride * Math.PI * 2) : 0;
  const lead = h * 0.11 * swing;

  const hipY = groundY - h * 0.46;
  const shoulderY = groundY - h * 0.76;
  const headY = groundY - h * 0.875;
  const headR = h * 0.105;

  // Hurt people walk bent. It is the same fact the shield's cracks carry,
  // said again in the silhouette, because a silhouette is what reads first.
  const stoop = s.health < 0.5 ? h * 0.035 : 0;

  // Standing weight. Without the shadow a figure floats over the painting
  // instead of standing on it — the yard had exactly that bug.
  g.append(svgEl('ellipse', {
    cx: x, cy: groundY, rx: h * 0.17, ry: h * 0.045, fill: INK, opacity: 0.32,
  }));

  // The spear leans back over the shoulder, the way a spear is carried on a
  // day nobody is fighting.
  if (s.leader) {
    const butt = x + f * h * 0.13;
    const tip = x - f * h * 0.06;
    const tipY = groundY - h * 1.12;
    g.append(
      svgEl('line', {
        x1: butt, y1: groundY - h * 0.02, x2: tip, y2: tipY,
        stroke: '#8a6f43', 'stroke-width': Math.max(1.2, h * 0.022),
      }),
      svgEl('path', {
        d: `M ${tip} ${tipY - h * 0.05} l ${h * 0.028} ${h * 0.055} l ${-h * 0.028} ${-h * 0.016}` +
           ` l ${-h * 0.028} ${h * 0.016} Z`,
        fill: '#9fb0c4',
      }),
    );
  }

  // The cloak, hanging behind and swinging with the walk. Drawn before the
  // body so the body sits in front of it, which is what a cloak does.
  g.append(svgEl('path', {
    d: `M ${x - f * h * 0.02} ${shoulderY - h * 0.03}` +
       ` C ${x - f * h * 0.24} ${groundY - h * 0.58},` +
       ` ${x - f * h * (0.27 + 0.04 * swing)} ${groundY - h * 0.30},` +
       ` ${x - f * h * (0.17 + 0.05 * swing)} ${groundY - h * 0.13}` +
       ` L ${x + f * h * 0.05} ${groundY - h * 0.22} Z`,
    fill: look.cloak,
    opacity: 0.95,
  }));

  /** One leg, hip to heel, with a knee in it. */
  const leg = (foot: number, shade: number): SVGElement => svgEl('path', {
    d: `M ${x} ${hipY} L ${x + foot * 0.55} ${(hipY + groundY) / 2} L ${x + foot} ${groundY}`,
    fill: 'none',
    stroke: darken(look.tunic, shade),
    'stroke-width': h * 0.055,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  // Far leg first and darker, so the two legs separate instead of reading as
  // one thick post.
  g.append(leg(f * -lead, 0.45));

  // The shield, slung on the back. This is the identity: the same ground,
  // the same motif, the same paint the player learned in a fight, and the
  // only part of the figure big enough to carry it at this size.
  //
  // Set far enough back that the BODY is the middle of the figure and the
  // shield rides behind it. The first cut hung it 0.15 back at 0.2 across,
  // which covered the trunk completely — and the screenshot came out six
  // discs with legs under them, which is the exact thing Art 13 exists to
  // stop. Measured by looking at it, which is the only instrument this
  // particular claim has.
  const shieldR = h * 0.17;
  const shieldX = x - f * h * 0.21;
  const shieldY = groundY - h * 0.62;
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
  g.append(...shieldFace(shieldX, shieldY, shieldR, look, s.friendly, wear));

  // The body: a tunic, wider at the shoulders than the hip, leaning into the
  // walk (and further when the walker is hurt).
  const lean = f * (s.walking ? h * 0.02 : 0) + f * stoop;
  g.append(svgEl('path', {
    d: `M ${x - h * 0.1 + lean} ${shoulderY} L ${x + h * 0.1 + lean} ${shoulderY}` +
       ` L ${x + h * 0.085} ${hipY} L ${x - h * 0.085} ${hipY} Z`,
    fill: look.tunic,
    stroke: darken(look.tunic, 0.4),
    'stroke-width': 1,
  }));

  // A belt. One line, and it is what turns a trapezoid into a tunic.
  g.append(svgEl('line', {
    x1: x - h * 0.085, y1: hipY - h * 0.01, x2: x + h * 0.085, y2: hipY - h * 0.01,
    stroke: darken(look.tunic, 0.55), 'stroke-width': h * 0.022,
  }));

  // Near leg and near arm, both swinging opposite each other.
  g.append(leg(f * lead, 0.15));
  g.append(svgEl('path', {
    d: `M ${x + lean * 0.6} ${shoulderY + h * 0.03}` +
       ` L ${x + f * h * 0.055 - lead * 0.5} ${shoulderY + h * 0.13}` +
       ` L ${x + f * h * 0.04 - lead} ${shoulderY + h * 0.24}`,
    fill: 'none',
    stroke: look.tunic,
    'stroke-width': h * 0.048,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  // The head, in profile: skin, then hair over the crown and down the back,
  // then a beard if they wear one. Age comes in through `look.hair`.
  const headX = x + f * h * 0.02 + lean;
  g.append(svgEl('circle', { cx: headX, cy: headY, r: headR, fill: SKIN }));
  g.append(svgEl('path', {
    d: `M ${headX - f * headR} ${headY + headR * 0.35}` +
       ` A ${headR} ${headR} 0 0 ${f > 0 ? 1 : 0} ${headX + f * headR * 0.85} ${headY - headR * 0.4}` +
       ` L ${headX + f * headR * 0.5} ${headY - headR * 0.75}` +
       ` L ${headX - f * headR * 1.05} ${headY + headR * 0.9} Z`,
    fill: look.hair,
  }));
  if (look.beard > 0) {
    const long = look.beard === 2 ? 1.55 : 1.05;
    g.append(svgEl('path', {
      d: `M ${headX - f * headR * 0.45} ${headY + headR * 0.45}` +
         ` L ${headX + f * headR * 0.9} ${headY + headR * 0.15}` +
         ` L ${headX + f * headR * 0.35} ${headY + headR * long} Z`,
      fill: look.hair,
    }));
  }

  // What they are at, when the caller has something to say. The yard does;
  // the road does not, because on the road everyone is doing the same thing.
  if (s.doing) {
    g.append(svgEl('text', {
      x, y: groundY + h * 0.17, 'text-anchor': 'middle', class: 'walker-doing',
      'font-size': Math.max(7, h * 0.13),
    }, [document.createTextNode(s.doing)]));
  }

  return g;
}
