// What a person is carrying, drawn on them.
//
// The game has always known this and never showed it. Three facts, all of
// them already in state and all of them decisions a player has made or is
// living with:
//
//   - `Combatant.throwsLeft` — hand-axes. `sim/ranks.ts` says plainly that
//     "`throw` is a hand-axe. It reaches anybody, which is what makes the
//     back rank worth standing in", and the whole of that resource reached
//     the screen as a digit on a button: "Throw 1". Drawn on the belt it is
//     gear you can watch being SPENT, which is the only kind that changes
//     how anybody plays.
//
//   - `Person.bond` — `sworn` bear arms and `hand`s do not. `sim/joining.ts`
//     puts it in one line: growth "buys labour, never a wider shield wall".
//     The road drew a painted war shield on the back of every walker, hands
//     included, which is a picture telling a lie about who fights.
//
//   - `Person.job` — a woodcutter carries an axe and a fisher a net. The
//     tool comes off the job's own data (`data/jobs.ts`), so adding a job
//     adds its tool without touching this file's callers.
//
// Everything here is a silhouette. At the sizes these are drawn — 34 units
// in the yard, 44 in the line — a tool is a haft and one bold head, and
// anything finer is a smudge.

import { darken } from './look';
import { svgEl } from './svg';
import type { ToolId } from '../data/jobs';
import { HAFT, MOSS, PALE_IRON, PARCHMENT, ROPE } from './palette';


const darkIron = darken(PALE_IRON, 0.45);

/**
 * A hand-axe on the belt, one per throw the fighter has left.
 *
 * On the REAR hip, where a man reaches for one — and where it does not sit
 * under the shield he is holding out in front of him.
 */
export function beltAxes(
  x: number,
  beltY: number,
  h: number,
  facing: number,
  count: number,
): SVGElement[] {
  const out: SVGElement[] = [];
  const f = facing >= 0 ? 1 : -1;
  // Sized by looking. The first cut drew the head at 0.045 of a man, which
  // is four world units — two and a half pixels once the field is framed,
  // and invisible. Two is as many as read at this size; a third would be a
  // smear on the same hip. The count itself is on the throw button, which is where a
  // player reads the exact number — this says "he still has one" or "he is
  // out", which is the part that belongs in the picture.
  for (let i = 0; i < Math.min(2, count); i += 1) {
    const hx = x - f * (h * 0.11 + i * h * 0.085);
    const hy = beltY + h * 0.03;
    const axe = svgEl('g', { class: 'belt-axe' });
    axe.append(
      svgEl('line', {
        x1: hx, y1: hy - h * 0.06, x2: hx, y2: hy + h * 0.14,
        stroke: HAFT, 'stroke-width': Math.max(1.2, h * 0.026), 'stroke-linecap': 'round',
      }),
      svgEl('path', {
        d: `M ${hx} ${hy - h * 0.075} l ${-f * h * 0.085} ${h * 0.022}` +
           ` l ${f * h * 0.022} ${h * 0.078} l ${f * h * 0.063} ${-h * 0.038} Z`,
        fill: PALE_IRON,
        stroke: darkIron,
        'stroke-width': 0.8,
      }),
    );
    out.push(axe);
  }
  return out;
}

/**
 * A job's tool, held at the shoulder.
 *
 * One haft angled across the body with the head at the top, so every tool
 * shares a silhouette and only the head has to be told apart — which is what
 * makes six of them readable at 34 units instead of six shapeless bundles.
 */
export function toolInHand(
  x: number,
  groundY: number,
  h: number,
  facing: number,
  tool: ToolId,
): SVGElement[] {
  const f = facing >= 0 ? 1 : -1;
  const footX = x + f * h * 0.1;
  const footY = groundY - h * 0.04;
  const headX = x - f * h * 0.11;
  const headY = groundY - h * 0.92;
  const out: SVGElement[] = [];

  // The haft, for everything that has one. A net and a handful of herbs do
  // not, so they are drawn whole below.
  if (tool !== 'net' && tool !== 'herbs') {
    out.push(svgEl('line', {
      x1: footX, y1: footY, x2: headX, y2: headY,
      stroke: HAFT, 'stroke-width': Math.max(1.2, h * 0.028), 'stroke-linecap': 'round',
    }));
  }

  if (tool === 'axe') {
    // A wedge, bit outward.
    out.push(svgEl('path', {
      d: `M ${headX} ${headY + h * 0.02} l ${-f * h * 0.1} ${-h * 0.035}` +
         ` l ${f * h * 0.02} ${h * 0.1} l ${f * h * 0.08} ${-h * 0.045} Z`,
      fill: PALE_IRON,
    }));
  } else if (tool === 'sickle') {
    // A curved blade — the one tool whose shape IS a curve.
    out.push(svgEl('path', {
      d: `M ${headX} ${headY + h * 0.04} q ${-f * h * 0.14} ${-h * 0.02}` +
         ` ${-f * h * 0.1} ${h * 0.09}`,
      fill: 'none', stroke: PALE_IRON, 'stroke-width': Math.max(1.4, h * 0.032),
      'stroke-linecap': 'round',
    }));
  } else if (tool === 'adze') {
    // A heavy block across the haft.
    out.push(svgEl('rect', {
      x: headX - h * 0.055, y: headY, width: h * 0.11, height: h * 0.055,
      fill: PALE_IRON, stroke: darken(PALE_IRON, 0.4), 'stroke-width': 1,
    }));
  } else if (tool === 'bow') {
    // A stave and a string, held upright.
    out.push(
      svgEl('path', {
        d: `M ${headX} ${headY} q ${-f * h * 0.14} ${h * 0.24} 0 ${h * 0.48}`,
        fill: 'none', stroke: HAFT, 'stroke-width': Math.max(1.2, h * 0.026),
      }),
      svgEl('line', {
        x1: headX, y1: headY, x2: headX, y2: headY + h * 0.48,
        stroke: PARCHMENT, 'stroke-width': 1, opacity: 0.8,
      }),
    );
  } else if (tool === 'net') {
    // A net over the shoulder: a slung bundle with mesh in it.
    const nx = x - f * h * 0.14;
    const ny = groundY - h * 0.5;
    out.push(svgEl('path', {
      d: `M ${nx - h * 0.09} ${ny} q ${h * 0.09} ${h * 0.22} ${h * 0.18} 0 Z`,
      fill: ROPE, opacity: 0.85, stroke: '#5a5140', 'stroke-width': 1,
    }));
    for (const t of [-0.04, 0, 0.04]) {
      out.push(svgEl('line', {
        x1: nx + h * t, y1: ny, x2: nx + h * t * 0.5, y2: ny + h * 0.12,
        stroke: '#5a5140', 'stroke-width': 0.8, opacity: 0.9,
      }));
    }
  } else {
    // Herbs: a bound sprig carried at the hip.
    const hx = x - f * h * 0.13;
    const hy = groundY - h * 0.44;
    out.push(svgEl('path', {
      d: `M ${hx} ${hy} l ${-f * h * 0.02} ${h * 0.12} M ${hx} ${hy}` +
         ` l ${-f * h * 0.06} ${h * 0.06} M ${hx} ${hy} l ${f * h * 0.03} ${h * 0.07}`,
      fill: 'none', stroke: MOSS, 'stroke-width': Math.max(1.2, h * 0.024),
      'stroke-linecap': 'round',
    }));
  }
  const held = svgEl('g', { class: `tool tool-${tool}` });
  held.append(...out);
  return [held];
}
