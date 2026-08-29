// Where a rank stands on a side-on field.
//
// The sim has been a line since 8.1c; this is the geometry that draws one.
// It is pure and it is the ONLY place that decides where a fighter is on
// screen, so the renderer, the effects layer and the tap handler cannot
// drift apart about it — which is exactly what happened on the hex field,
// where three files each did their own `toPixel`.
//
// The whole thing is one idea: x = 0 is where the two walls meet. Our line
// runs left from there and theirs runs right, rank 1 closest to the meeting
// in both cases. Everything else is a consequence.

import type { Side } from '../state/types';

/**
 * The gap between neighbouring ranks, in user space.
 *
 * CONSTANT, deliberately, and this is the load-bearing decision in the file.
 *
 * It is NOT the space between ranks any more — see `RANK_STEP` — and the
 * argument that made it so is worth keeping as a warning.
 *
 * It ran: fitting the whole line into a fixed-width field means shrinking
 * the gap as the band deepens, and "that reads well and it fails the one
 * rule this game will not bend: a fighter is a touch target. Six sworn
 * against six raiders is twelve ranks, and twelve ranks in a 320px-wide box
 * is a 27px target." So the gap was fixed and the field grew instead, and a
 * deep fight became a wide field the view pans across.
 *
 * **Twelve ranks are not twelve targets.** `REACH` in `sim/ranks.ts` says
 * `strike: { from: [1, 2], at: [1, 2] }` — a blow can only land on the
 * enemy's first two ranks, and the same holds for the other armed verbs. At
 * most two men on a field are ever tappable; the other ten are scenery you
 * look at. The rule was applied to every figure drawn rather than to every
 * figure you can act on, and the whole panning apparatus was built to pay
 * for that mistake.
 *
 * What it cost, measured on the built page at 390x844 before this was
 * changed: THERE WAS NO PAN POSITION FROM WHICH BOTH LINES WERE VISIBLE.
 * At rest you saw 3 of your 6 and 2 of their 4; panned right, 4/4 of theirs
 * and none of yours; panned left, 5/6 of yours and none of theirs. A
 * tactical view you cannot see the enemy in.
 */
export const RANK_GAP = 96;

/**
 * How far back each rank stands from the one in front, ACROSS the ground.
 *
 * Ranks stack BEHIND each other, which is what a shield wall is. They used
 * to step a whole `RANK_GAP` sideways — wider than a man — so rank two stood
 * beside rank one like a crowd on open ground rather than behind it, and a
 * six-a-side field came out 1223 units wide against a 390px screen.
 *
 * Overlapping at a little under half a man puts the field at 619 units,
 * which frames whole at every size the game is built for. The men do not
 * shrink: `FIGURE_R` still comes off `RANK_GAP`, so this buys the view back
 * without costing a pixel of anybody's size. Depth is carried by `RAISE`
 * and by paint order, the way a side-on picture carries it.
 */
export const RANK_STEP = RANK_GAP * 0.46 * 2.08 * 0.42;

/**
 * How far rank 1 stands from the line where the walls meet.
 *
 * Less than a full gap: the front two are IN CONTACT, and a full gap on each
 * side draws two lines politely waiting for each other.
 */
export const CLOSE = RANK_GAP * 0.62;

/** How much higher each rank back stands. A shallow stage, not a hillside. */
export const RAISE = 8;

/**
 * The field's height in user space. The width is derived — see `extent`.
 *
 * This number decides how much of the LINE you can see, which is not
 * obvious. The view fills the element's height with the field, so the width
 * it can show is `elementWidth * FIELD_H / elementHeight` — a TALLER field
 * shows more ranks, at the cost of drawing the men smaller.
 *
 * 900 is measured against the fight that matters, six sworn against six
 * raiders on a 390x606 field element: about six of the twelve ranks on
 * screen at a 65px gap. At 620 it was four ranks and a 94px gap — men you
 * could admire and an enemy back rank you had to go looking for, which is
 * the wrong trade in a game where the back rank is who you throw at.
 */
export const FIELD_H = 900;

/**
 * Where the men's feet are. Above is sky and far country, below is the
 * ground they stand on.
 *
 * Low, because a side-on scene is composed on its horizon: the wall wants to
 * sit in the lower third with the weather over it, not bisect the frame.
 */
export const GROUND_Y = FIELD_H * 0.7;

export interface Spot {
  x: number;
  y: number;
}

/**
 * Where this fighter stands.
 *
 * `y` is where their FEET are, not their middle: a figure is placed by the
 * ground it stands on, so men of different heights still share a line.
 */
export function standAt(side: Side, rank: number): Spot {
  const out = CLOSE + (rank - 1) * RANK_STEP;
  return {
    x: side === 'warband' ? -out : out,
    y: GROUND_Y - (rank - 1) * RAISE,
  };
}

/**
 * The field's box, sized to the deeper of the two lines.
 *
 * Symmetric even when one side is deeper, because a box that shifted off
 * centre as men fell would slide the whole painting sideways every time
 * somebody went down.
 */
export function extent(deepest: number): { x: number; y: number; w: number; h: number } {
  // A man's own half-width past the last rank, so nobody is drawn against
  // the edge of his own field.
  const reach = CLOSE + Math.max(0, deepest - 1) * RANK_STEP + FIGURE_W * 0.62;
  return { x: -reach, y: 0, w: reach * 2, h: FIELD_H };
}

/**
 * How tall to draw a man.
 *
 * Tied to the gap rather than the field, so a fighter is always the same
 * size in the same wall — a deep line is a longer field, not smaller men.
 */
export const FIGURE_H = Math.min(FIELD_H * 0.52, RANK_GAP * 3.1);

/**
 * The radius `figure()` wants, which is half the shoulder width rather than
 * the height it draws to.
 */
export const FIGURE_R = RANK_GAP * 0.46;

/**
 * The width a man actually occupies, which is what the view scales against.
 *
 * It was `FIGURE_R * 2.08` because the widest thing on a HEAD-ON fighter was
 * his shield, drawn at `rx: radius * 1.04`. Fighters are drawn in profile
 * now and no part of one reaches that far: the widest is the health bar
 * under him, at exactly twice the radius.
 *
 * Four percent, and it cost the touch rule. `NEEDED_SCALE` is
 * `TAP_MIN / FIGURE_W`, so a `FIGURE_W` that overstates the man makes the
 * view zoom too little and hand back a target under the bar — measured on
 * the built page at 320x568, a fighter came out 42px against the 44px
 * minimum. The bar caught it, which is the whole reason it counts pixels on
 * a screen rather than trusting this constant.
 *
 * The test beside this one has warned about the same failure from the other
 * direction since it was written: "reasoning from the radius alone shipped a
 * 42px man against a 44px bar". It is the same 42px.
 */
export const FIGURE_W = FIGURE_R * 2.0;

/**
 * Painting order: back ranks first, so the front of a wall overlaps the men
 * behind it the way a real one does.
 *
 * Both walls interleaved by depth rather than side after side, or one wall
 * would sit wholly in front of the other where they meet.
 */
export function paintOrder<T extends { rank: number }>(line: readonly T[]): T[] {
  return [...line].sort((a, b) => b.rank - a.rank);
}

/**
 * How far above their standing spot a figure's middle sits.
 *
 * `standAt` answers where a man's FEET are; `figure()` draws around a
 * centre and puts its ground-shadow at `cy + radius * 0.85`. One constant
 * so the renderer and the tap test cannot disagree about it.
 */
export const FIGURE_LIFT = FIGURE_R * 0.85;

/**
 * Which fighter is under this point, if any.
 *
 * Here rather than in the renderer because it is the tap half of `standAt`,
 * and a hit test that drifts from the layout is a game where tapping a man
 * hits the one behind him. The hex field had exactly that bug shape waiting
 * in `fromPixel`, and only never fired because a hex tiles the plane.
 *
 * Nobody is "under" a point that is not on a man: a tap on bare ground
 * returns undefined rather than the nearest fighter, because since 8.1c
 * bare ground is not an order and must not become one by rounding.
 */
/**
 * Who was tapped.
 *
 * `radius` is how much ground a man owns, either side of where he stands.
 * It defaults to half a rank step — which, now that ranks overlap, is a
 * narrow strip, and deliberately so: a tap in the middle of a wall should
 * resolve to the man actually standing there.
 *
 * The caller hands a WIDER radius when it is asking a different question:
 * "which of the men I can act on did they mean". There are at most two of
 * those (`REACH` says a strike lands on ranks 1-2), they are far apart, and
 * a generous strip around each is what keeps the 44px rule true of the
 * things that are actually targets. See `battle.ts`'s tap handler.
 */
export function pick<T extends { side: Side; rank: number }>(
  line: readonly T[],
  at: Spot,
  radius = RANK_STEP / 2,
): T | undefined {
  let best: T | undefined;
  let bestDx = Infinity;
  for (const c of line) {
    const spot = standAt(c.side, c.rank);
    const dx = Math.abs(at.x - spot.x);
    if (dx > radius) continue;
    // Vertically: from the shadow at his feet to the top of his head.
    const top = spot.y - FIGURE_LIFT - FIGURE_R;
    if (at.y < top || at.y > spot.y) continue;
    if (dx < bestDx) {
      bestDx = dx;
      best = c;
    }
  }
  return best;
}
