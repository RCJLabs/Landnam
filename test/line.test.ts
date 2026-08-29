// The side-on field's geometry: where a rank stands.
//
// Checked against constructed lines rather than played battles, for the same
// reason `ranks.test.ts` is: what is being tested is the shape of a wall on
// screen, and a real fight would only make it harder to see which claim
// broke.
//
// The claim that matters most is the last one. A fighter is a touch target,
// and the fixed-gap decision in `line.ts` exists entirely to keep it one.

import { describe, expect, it } from 'vitest';
import {
  CLOSE, FIELD_H, FIGURE_LIFT, FIGURE_R, FIGURE_W, GROUND_Y, RANK_GAP, RANK_STEP, RAISE,
  extent, paintOrder, pick, standAt,
} from '../src/render/line';

describe('where the walls meet', () => {
  it('puts x = 0 between them, with rank 1 of each side closest', () => {
    expect(standAt('warband', 1).x).toBeLessThan(0);
    expect(standAt('foe', 1).x).toBeGreaterThan(0);
    expect(Math.abs(standAt('warband', 1).x)).toBe(standAt('foe', 1).x);
  });

  it('runs each line away from the meeting, one step at a time', () => {
    for (let r = 1; r < 8; r++) {
      const here = standAt('warband', r).x;
      const behind = standAt('warband', r + 1).x;
      expect(behind, `our rank ${r + 1} is not behind rank ${r}`).toBeLessThan(here);
      expect(here - behind).toBeCloseTo(RANK_STEP);
    }
    for (let r = 1; r < 8; r++) {
      expect(standAt('foe', r + 1).x - standAt('foe', r).x).toBeCloseTo(RANK_STEP);
    }
  });

  it('stacks the ranks BEHIND each other rather than beside them', () => {
    // The whole of what went wrong: a step wider than a man puts rank two
    // next to rank one like a crowd on open ground, and a six-a-side field
    // came out 1223 units wide against a 390px screen. A shield wall is men
    // standing behind each other.
    expect(RANK_STEP).toBeLessThan(FIGURE_W);
    // But not so far behind that the man in front hides him completely —
    // depth you cannot see is depth the player cannot count.
    expect(RANK_STEP).toBeGreaterThan(FIGURE_W * 0.3);
  });

  it('stands the front ranks closer than a full gap, because they are in contact', () => {
    // Two lines a full gap apart on each side are two lines waiting politely.
    const between = standAt('foe', 1).x - standAt('warband', 1).x;
    expect(between).toBeLessThan(RANK_GAP * 2);
    expect(between).toBe(CLOSE * 2);
  });

  it('raises each rank back a little, and never off the top of the field', () => {
    expect(standAt('warband', 1).y).toBe(GROUND_Y);
    expect(standAt('warband', 3).y).toBe(GROUND_Y - 2 * RAISE);
    // A line ten deep still has its back rank standing on the field.
    expect(standAt('warband', 10).y).toBeGreaterThan(0);
    expect(standAt('warband', 10).y).toBeLessThan(GROUND_Y);
  });

  it('mirrors the two sides exactly', () => {
    for (let r = 1; r <= 6; r++) {
      expect(standAt('foe', r).x).toBe(-standAt('warband', r).x);
      expect(standAt('foe', r).y).toBe(standAt('warband', r).y);
    }
  });
});

describe('the field the line needs', () => {
  it('stays centred on the meeting however deep the lines are', () => {
    for (const deep of [1, 4, 6, 12]) {
      const box = extent(deep);
      expect(box.x + box.w / 2, `${deep} deep is off centre`).toBeCloseTo(0);
    }
  });

  it('holds every man of the deepest line, with room past the last of them', () => {
    for (const deep of [1, 2, 6, 12]) {
      const box = extent(deep);
      const back = standAt('warband', deep);
      expect(back.x, `rank ${deep} falls off the field`).toBeGreaterThan(box.x);
      // Room past him, or the back rank is drawn jammed against the edge.
      expect(back.x - box.x).toBeGreaterThan(RANK_GAP * 0.5);
    }
  });

  it('grows with the fight rather than squeezing it', () => {
    // The whole fixed-gap decision, stated as a property: a deeper line is a
    // WIDER field, never the same field with the men packed tighter.
    expect(extent(6).w).toBeGreaterThan(extent(3).w);
    expect(extent(12).w).toBeGreaterThan(extent(6).w);
  });

  it('is as tall as the field, always', () => {
    expect(extent(1).h).toBe(FIELD_H);
    expect(extent(9).h).toBe(FIELD_H);
    expect(extent(1).y).toBe(0);
  });
});

describe('the wall overlaps itself', () => {
  it('paints the back ranks first, so the front of a line covers them', () => {
    const line = [
      { side: 'warband', rank: 2 },
      { side: 'foe', rank: 1 },
      { side: 'warband', rank: 1 },
      { side: 'foe', rank: 3 },
    ];
    expect(paintOrder(line).map((c) => c.rank)).toEqual([3, 2, 1, 1]);
  });

  it('interleaves the two walls by depth rather than doing one then the other', () => {
    // Side after side would put a whole wall in front of the other where
    // they meet, which is the one place the overlap is visible.
    const order = paintOrder([
      { side: 'warband', rank: 1 },
      { side: 'warband', rank: 2 },
      { side: 'foe', rank: 1 },
      { side: 'foe', rank: 2 },
    ]);
    expect(order.map((c) => `${c.side}${c.rank}`)).toEqual([
      'warband2', 'foe2', 'warband1', 'foe1',
    ]);
  });

  it('changes nothing about the line it is given', () => {
    const line = [{ rank: 2 }, { rank: 1 }];
    paintOrder(line);
    expect(line.map((c) => c.rank)).toEqual([2, 1]);
  });
});

describe('a fighter is a touch target', () => {
  // The rule the fixed gap exists for, and the one that would quietly rot if
  // somebody later "tidied" the field into a fixed width.
  //
  // 320px is the narrowest screen the game holds itself to, and 44px is the
  // thumb minimum the rest of it keeps. The field pans when it cannot frame
  // itself — that is what `fitViewBox` is for — so what has to be true here
  // is that a fighter is big enough ONCE PANNED, which is a fact about the
  // gap and not about the field.
  const TAP_MIN = 44;
  const NARROW = 320;

  it('keeps a man the same size however deep the line gets', () => {
    // The property, stated so it cannot be satisfied by arithmetic that
    // cancels out: what a fighter is worth on screen is the gap, and the gap
    // does not know how many ranks there are. A first draft of this test
    // asserted `RANK_GAP * (TAP_MIN / RANK_GAP) >= TAP_MIN`, which is an
    // identity and could never have failed — a bar that cannot fail is not a
    // bar, which is this repo's oldest lesson about its own tests.
    const gapAt = (deep: number): number => {
      const box = extent(deep);
      return (standAt('warband', 1).x - standAt('warband', 2).x) / box.w;
    };
    // A FIXED-width field would make this constant, and the men shrink.
    // A fixed GAP makes it fall, and the field is what grows.
    expect(gapAt(12)).toBeLessThan(gapAt(6));
    expect(gapAt(6)).toBeLessThan(gapAt(3));
  });

  it('is why the field NO LONGER has to pan, and says so in numbers', () => {
    // THIS TEST USED TO CLAIM THE OPPOSITE, and it was wrong in the way that
    // matters. It read: "scaled so a fighter is exactly a thumb wide, a deep
    // line does not fit on the narrowest screen... That is not a failure to
    // fit — it is the choice, and `fitViewBox` is the other half of it."
    //
    // It was a failure to fit. Measured on the built page at 390x844, there
    // was NO pan position from which both walls were visible: at rest you
    // saw 3 of your 6 and 2 of their 4; panned one way, all four foes and
    // none of your own; panned the other, five of yours and no enemy at all.
    // The reasoning behind the choice counted twelve ranks as twelve touch
    // targets, and `REACH` says a strike lands on ranks 1-2 — at most two
    // men on the field are ever tappable.
    //
    // With the ranks stacked behind each other, a fighter can be a full
    // thumb wide AND the whole fight can be on screen. Both, not either.
    const perUnit = TAP_MIN / FIGURE_W;
    expect(extent(2).w * perUnit, 'a small fight should frame itself')
      .toBeLessThanOrEqual(NARROW);
    expect(extent(6).w * perUnit, 'a full six-a-side should frame itself too')
      .toBeLessThanOrEqual(NARROW);
  });

  it('says how wide a man really is, because the view scales to it', () => {
    // This asserted `FIGURE_R * 2.08` and warned, correctly, that "getting
    // this wrong is not cosmetic: the view scales to whatever this says a
    // target is, and reasoning from the radius alone shipped a 42px man
    // against a 44px bar." The 2.08 was the widest thing on a HEAD-ON
    // fighter — his shield, at `rx: radius * 1.04`.
    //
    // Fighters are drawn in profile now and nothing on one reaches that far.
    // The widest part is the health bar under him, at exactly twice the
    // radius, and leaving the constant at 2.08 shipped THE SAME 42px MAN
    // against the same 44px bar, from the other direction — caught by
    // `scripts/field.mjs` at 320x568, which counts pixels on a screen
    // instead of trusting this number.
    expect(FIGURE_W).toBeCloseTo(FIGURE_R * 2);
  });

  it('draws a man wide enough to fill his place in the line', () => {
    // A target with air on both sides is a number about nothing.
    expect(FIGURE_W).toBeGreaterThan(RANK_GAP * 0.85);
    expect(FIGURE_W).toBeLessThanOrEqual(RANK_GAP);
  });
});

describe('tapping a man', () => {
  const LINE = [
    { side: 'warband' as const, rank: 1 },
    { side: 'warband' as const, rank: 2 },
    { side: 'foe' as const, rank: 1 },
    { side: 'foe' as const, rank: 2 },
  ];
  /** A point on the chest of whoever stands in that rank. */
  const chestOf = (side: 'warband' | 'foe', rank: number) => {
    const spot = standAt(side, rank);
    return { x: spot.x, y: spot.y - FIGURE_LIFT };
  };

  it('finds the man whose place was tapped, on either wall', () => {
    for (const c of LINE) {
      expect(pick(LINE, chestOf(c.side, c.rank))).toBe(c);
    }
  });

  it('does not reach past its own rank into the next one', () => {
    // The bug this function exists to prevent: tapping a man and hitting the
    // one behind him. Just inside the halfway line still belongs to rank 1.
    const one = standAt('warband', 1);
    const nearlyTwo = { x: one.x - RANK_STEP * 0.49, y: one.y - FIGURE_LIFT };
    expect(pick(LINE, nearlyTwo)?.rank).toBe(1);
    const justPast = { x: one.x - RANK_STEP * 0.51, y: one.y - FIGURE_LIFT };
    expect(pick(LINE, justPast)?.rank).toBe(2);
  });

  it('never crosses the meeting line to the other wall', () => {
    expect(pick(LINE, chestOf('warband', 1))?.side).toBe('warband');
    expect(pick(LINE, chestOf('foe', 1))?.side).toBe('foe');
  });

  it('answers nobody for bare ground, rather than the nearest man', () => {
    // Since 8.1c a tap on nothing orders nothing, and it must not become an
    // order by rounding to whoever happens to be closest.
    expect(pick(LINE, { x: 0, y: GROUND_Y })).toBeUndefined();          // between the walls
    expect(pick(LINE, { x: 0, y: 20 })).toBeUndefined();                // the sky
    expect(pick(LINE, { x: standAt('warband', 1).x, y: GROUND_Y + 60 })).toBeUndefined();
    expect(pick(LINE, { x: standAt('warband', 9).x, y: GROUND_Y }))     // an empty rank
      .toBeUndefined();
  });

  it('offers nobody at all when nobody is standing', () => {
    expect(pick([], chestOf('warband', 1))).toBeUndefined();
  });
});
