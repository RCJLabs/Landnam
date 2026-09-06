// The shared geometry layer. EVERY panel draws this and only this — the
// difference between two panels is the treatment, never the subject.
//
// Nothing here is invented. Positions come from `standAt`, heights from
// FIGURE_H and each person's own `build`, colours from `lookOf`, the roofline
// from `steadingScene().raised`, the weather and season from
// `processionScene`. See scene.test.ts for how they were taken.

export const W = 440;
export const H = 260;

// World -> panel. Ground at 638 sits at y 215; scale 0.55 so the tallest head
// clears the top edge. Men are the SAME height in every rank (line.ts: "a
// deep line is a longer field, not smaller men"), so there is no perspective
// scaling here — only the 8-unit lift per rank the game already applies.
const S = 0.55;
export const px = (wx) => wx * S + 220;
export const py = (wy) => 215 - (638 - wy) * S;

export function figures(scene) {
  const h = scene.line.figureH * S;
  const w = scene.line.figureW * S;
  // Back ranks first, so the front of a wall overlaps the men behind it —
  // `paintOrder` in line.ts, kept because it is what makes a wall read as one.
  return [...scene.figures]
    .sort((a, b) => b.rank - a.rank)
    .map((f) => ({
      ...f,
      cx: px(f.x),
      feet: py(f.y),
      h: h * f.build,
      w,
      facing: f.side === 'warband' ? 1 : -1,
    }));
}

/**
 * One man, in parts, in his own unit box.
 *
 * x runs -0.5..0.5 across his shoulders, y runs 0 at the crown to 1 at his
 * feet. Every treatment gets the same parts and decides what to do with them
 * — that is what makes the ten comparable rather than ten different drawings.
 */
export function parts(f) {
  const d = f.facing;
  // Proportions, in his own unit box: crown at 0, feet at 1, shoulders half a
  // FIGURE_W across. A head is a seventh of him, which is why he reads as a
  // man at 48 pixels wide and did not when this box was twice as wide.
  const s = f.stride;
  return {
    shadow: { cx: 0, cy: 0.995, rx: 0.62, ry: 0.035 },
    legBack: `M ${-0.14 * d} 0.54 L ${(-0.30 - s * 0.16) * d} 0.99 L ${(-0.08 - s * 0.16) * d} 0.99 L ${0.04 * d} 0.54 Z`,
    legFront: `M ${0.10 * d} 0.54 L ${(0.24 + s * 0.14) * d} 0.99 L ${(0.46 + s * 0.14) * d} 0.99 L ${0.30 * d} 0.54 Z`,
    // The cloak hangs off the shoulder away from the enemy and reaches his calf.
    cloak: `M ${-0.30 * d} 0.17 Q ${-0.78 * d} 0.36 ${-0.56 * d} 0.86 Q ${-0.30 * d} 0.78 ${-0.14 * d} 0.55 Z`,
    // Tunic: shoulder, waist, hem.
    body: `M ${-0.42 * d} 0.18 Q ${-0.34 * d} 0.36 ${-0.40 * d} 0.58 L ${0.42 * d} 0.58 Q ${0.36 * d} 0.36 ${0.44 * d} 0.18 Z`,
    head: { cx: 0.07 * d, cy: 0.085, r: 0.072 },
    hair: `M ${-0.02 * d} 0.085 Q ${-0.01 * d} -0.005 ${0.10 * d} 0.015 Q ${0.20 * d} 0.035 ${0.19 * d} 0.10 Q ${0.10 * d} 0.045 ${-0.02 * d} 0.085 Z`,
    beard: f.beard === 0 ? null
      : `M ${0.02 * d} 0.115 Q ${(0.19 + f.beard * 0.03) * d} 0.135 ${0.09 * d} ${0.175 + f.beard * 0.028} Q ${-0.01 * d} 0.16 ${0.02 * d} 0.115 Z`,
    // Side-on: the shield is edge-on to us, held out in front of his chest.
    shield: { cx: 0.44 * d, cy: 0.33, rx: 0.115, ry: 0.185 },
    // The spear rakes forward over the man in front — the reason the back
    // ranks are worth drawing at all.
    spear: { x1: -0.42 * d, y1: 0.44, x2: 1.30 * d, y2: -0.10 },
    arm: `M ${0.20 * d} 0.22 Q ${0.42 * d} 0.27 ${0.40 * d} 0.34`,
  };
}

/** A man on the ground. Drawn long and low so he reads as fallen, not short. */
export function fallenParts(f) {
  const d = f.facing;
  return {
    body: `M ${-1.25 * d} 0.975 Q ${-0.55 * d} 0.86 ${0.15 * d} 0.885 Q ${0.85 * d} 0.91 ${1.20 * d} 0.995 Z`,
    head: { cx: 1.05 * d, cy: 0.915, r: 0.055 },
    shield: { cx: -0.55 * d, cy: 0.955, rx: 0.30, ry: 0.035 },
  };
}

/**
 * The roofline of the steading, far off behind the fight.
 *
 * Eleven buildings stand at Steinlund and their `size` comes off what each
 * cost to raise, so the hall really is the tall one. Compressed onto the
 * horizon rather than laid out at yard scale — it is a skyline here, not a
 * plan.
 */
export function roofline(scene, y, x0, x1) {
  const b = scene.steading.raised;
  const span = (x1 - x0) / b.length;
  return b.map((h, i) => {
    const cx = x0 + span * (i + 0.5);
    const w = span * 0.78;
    const ht = 9 + h.size * 15;
    return { cx, w, h: ht, y, name: h.name, peak: y - ht };
  });
}

/** Trees for forest country — the band is standing in forest (processionScene). */
export function trees(scene, rng, y, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    out.push({ x: 12 + t * (W - 24) + (rng() - 0.5) * 26, y, h: 22 + rng() * 26 });
  }
  return out;
}

/** Deterministic, because a gallery that reshuffles itself cannot be compared. */
export function makeRng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
