// The steading, seen from the side.
//
// The milestone's bar is "raising a building visibly changes the steading you
// walk into" — and that is a claim the hex colony map could never have made,
// because it drew the wrong noun. It drew GROUND. Everything a player spends
// a season on lives in `settlement.built`, which that map never touched.
//
// So the claims here are all about the same thing: does what you built show.
// `scripts/hearth.mjs` proves the pixels; this proves the scene.

import { describe, expect, it } from 'vitest';


import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import {
  GROUND_Y, HOUSE_HALF, HOUSE_REACH, ROOF_OVERSAIL, SIZE_MAX, SLOT_W, YARD_H, YARD_W,
  groundOf, sizeOf, slotX, steadingScene,
} from '../src/render/steading';
import { BECK_SHARE, canFound, foundSettlement, stopReport } from '../src/sim/site';
import { learnStop, standingAt } from '../src/sim/coast';
import { makePlots } from '../src/sim/colony';
import { BUILDINGS } from '../src/data/buildings';
import { plotsFor } from '../src/sim/colony';
import { ROUTE_STOPS } from '../src/sim/route';
import { buildingById } from '../src/data/buildings';
import { makeRng } from '../src/rng';
import type { GameState } from '../src/state/types';

const SEED = 'raven-skerry-317';
const SEEDS = [SEED, 'grim-fjord-100', 'curve-7', 'Þórr-vik'];

/**
 * A band with a hall, on the first stretch at or past `from` that will take
 * one.
 *
 * Not a fixed stretch, because a coast REFUSES most of itself: dry ground,
 * a clan's elbow, the other boat's fences. Picking stretch 4 and asserting
 * it works is a test that passes on one seed and lies about the rest.
 */
function withHall(from = 4, seed = SEED): GameState {
  for (let stop = from; stop < ROUTE_STOPS; stop += 1) {
    const state = cloneState(newGame(seed));
    state.party.stop = stop;
    for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
    if (foundSettlement(state)) return state;
  }
  throw new Error(`${seed}: nowhere at or past ${from} would take a hall`);
}

describe('reading a stretch of coast as a site', () => {
  it('answers the same five measures the hex map does, in the same range', () => {
    // Not five new measures — the same five, handed a coast-shaped ring.
    // Rewriting them would mean recalibrating VERDICTS, `nameFor` and the
    // whole settling floor against numbers nobody had measured.
    for (const seed of SEEDS) {
      for (let s = 0; s < ROUTE_STOPS; s += 1) {
        const r = stopReport(seed, s);
        for (const [name, v] of Object.entries(r)) {
          if (name === 'total') continue;
          expect(v, `${seed} stretch ${s} ${name}`).toBeGreaterThanOrEqual(0);
          expect(v, `${seed} stretch ${s} ${name}`).toBeLessThanOrEqual(5);
        }
        expect(r.total).toBe(r.water + r.soil + r.timber + r.harbour + r.defence);
      }
    }
  });

  it('gives a coast a harbour, because that is what a coast has', () => {
    // The sea is down one side of every stretch, so `harbour` should never
    // be the thing that is always nought — it was, on the first ring I
    // wrote, because I gave the sea one slot instead of two.
    let withHarbour = 0;
    for (const seed of SEEDS) {
      for (let s = 0; s < ROUTE_STOPS; s += 1) {
        if (stopReport(seed, s).harbour > 0) withHarbour += 1;
      }
    }
    expect(withHarbour, 'no stretch of any coast could beach a ship')
      .toBeGreaterThan(SEEDS.length * ROUTE_STOPS * 0.5);
  });

  it('makes fresh water something a stretch either has or has not', () => {
    // The one measure a shore cannot supply out of its own country. If every
    // stretch scored the same there would be no reason to prefer one site.
    const scores = new Set<number>();
    for (const seed of SEEDS) {
      for (let s = 0; s < ROUTE_STOPS; s += 1) scores.add(stopReport(seed, s).water);
    }
    expect(scores.size, 'every stretch on every coast has the same water').toBeGreaterThan(1);
    // And the becks come at the rate the constant claims. Checked AGAINST
    // the constant rather than against a number typed beside it, because the
    // first draft hardcoded a third, the constant moved to a half on
    // measurement, and the test then failed for saying something true about
    // the old code. What is worth holding is that the dice agree with the
    // docstring, not what the docstring says this week.
    let becks = 0;
    const n = 2000;
    for (let i = 0; i < n; i += 1) {
      if (makeRng(`landnam-route:sweep-${i}:3:beck`).next() < BECK_SHARE) becks += 1;
    }
    expect(Math.abs(becks / n - BECK_SHARE), `${becks}/${n} becks against ${BECK_SHARE}`)
      .toBeLessThan(0.04);
    // And it is a share, not a certainty either way — a coast where every
    // stretch has running water has no water measure at all.
    expect(BECK_SHARE).toBeGreaterThan(0.2);
    expect(BECK_SHARE).toBeLessThan(0.8);
  });

  it('leaves every coast somewhere to put the posts', () => {
    // The bar BECK_SHARE was actually chosen against, and it is a
    // playability bar rather than a flavour one: fresh water is the only
    // measure a shore cannot supply out of its own country, so this number
    // alone decides whether a coast can be settled. At a third, one seed in
    // three hundred had nowhere at all.
    let starved = 0;
    for (let i = 0; i < 120; i += 1) {
      const seed = `sweep-${i}`;
      const state = cloneState(newGame(seed));
      for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
      let free = 0;
      for (let s = 0; s < ROUTE_STOPS; s += 1) {
        state.party.stop = s;
        if (canFound(state)) free += 1;
      }
      if (free === 0) starved += 1;
    }
    expect(starved, `${starved} coasts of 120 cannot be settled anywhere`).toBe(0);
  });

  it('is the same reading every time it is asked', () => {
    for (const seed of SEEDS) {
      expect(stopReport(seed, 7)).toEqual(stopReport(seed, 7));
    }
    expect(stopReport('a', 7)).not.toEqual(stopReport('b', 7));
  });
});

describe('putting the posts in, on a coast', () => {
  it('founds on the stretch the band is standing on', () => {
    const state = withHall(6);
    const stop = state.settlement!.stop!;
    expect(stop).toBe(standingAt(state));
    expect(state.settlement!.name.length).toBeGreaterThan(0);
    expect(state.settlement!.report).toEqual(stopReport(SEED, stop));
  });

  it('names a hall after its own stretch, so a reload does not rename it', () => {
    const first = withHall(6).settlement!;
    expect(withHall(6).settlement!.name).toBe(first.name);
    // And a hall on a different stretch is a different hall.
    const later = withHall(first.stop! + 1).settlement!;
    expect(later.stop).not.toBe(first.stop);
    expect(later.name).not.toBe(first.name);
  });

  it('refuses a stretch nobody has learned', () => {
    const state = cloneState(newGame(SEED));
    state.party.stop = 9;
    state.world.knownStops = [];
    expect(canFound(state)).toBe(false);
  });

  it('refuses a stretch with no fresh water on it', () => {
    // The hex map's `dry` rule, kept: a steading here would die of thirst
    // before winter. It has to actually bite on some coast, or the check is
    // a comment.
    let dry = 0;
    for (const seed of SEEDS) {
      const state = cloneState(newGame(seed));
      for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
      for (let s = 0; s < ROUTE_STOPS; s += 1) {
        state.party.stop = s;
        if (!canFound(state)) dry += 1;
      }
    }
    expect(dry, 'every stretch of every coast was foundable').toBeGreaterThan(0);
  });
});

describe('the ground a steading works', () => {
  it('gives a coast steading plots to work, without a ring of hexes', () => {
    const home = withHall(4).settlement!;
    expect(home.plots.length).toBeGreaterThan(6);
    expect(home.plots.filter((p) => p.kind === 'hall')).toHaveLength(1);
    // The watch always has somewhere to stand.
    expect(home.plots.filter((p) => p.kind === 'watchpost')).toHaveLength(1);
  });

  it('still gates the jobs that need ground, which is what plots are FOR', () => {
    // `plotsFor(...).length > 0` is the only thing a plot is read for in the
    // sim. If the conversion broke it, farmers and fishers would silently
    // stop being available and nothing would throw.
    let farmable = 0;
    let fishable = 0;
    for (const seed of SEEDS) {
      for (const stop of [3, 7, 12]) {
        const home = withHall(stop, seed).settlement!;
        if (plotsFor(home, 'farmer').length > 0) farmable += 1;
        if (plotsFor(home, 'fisher').length > 0) fishable += 1;
      }
    }
    expect(farmable, 'no steading on any coast could put a farmer to work')
      .toBeGreaterThan(0);
    expect(fishable, 'no steading on any coast could put a fisher to work')
      .toBeGreaterThan(0);
  });

  it('counts its ground for the picture', () => {
    const home = withHall(4).settlement!;
    const ground = groundOf(home);
    const total = ground.field + ground.wood + ground.water + ground.rough;
    // Everything but the hall and the watchpost.
    expect(total).toBe(home.plots.length - 2);
  });
});

describe('THE BAR — raising a building changes the steading', () => {
  it('draws nothing but bare ground on the day the posts go in', () => {
    const scene = steadingScene(withHall(4));
    expect(scene.raised).toEqual([]);
    expect(scene.name.length).toBeGreaterThan(0);
  });

  it('stands a building in the yard the moment it is raised', () => {
    const state = withHall(4);
    state.settlement!.built = ['longhouse'];
    const scene = steadingScene(state);
    expect(scene.raised).toHaveLength(1);
    expect(scene.raised[0]!.id).toBe('longhouse');
    expect(scene.raised[0]!.done).toBe(1);
  });

  it('keeps the order they were raised in, so the yard does not reshuffle', () => {
    const state = withHall(4);
    state.settlement!.built = ['byre', 'longhouse', 'smokehouse'];
    const scene = steadingScene(state);
    expect(scene.raised.map((r) => r.id)).toEqual(['byre', 'longhouse', 'smokehouse']);
    // And each stands further along than the one before it.
    for (let i = 1; i < scene.raised.length; i += 1) {
      expect(scene.raised[i]!.x).toBeGreaterThan(scene.raised[i - 1]!.x);
    }
  });

  it('shows the one being worked on, half up, beside the finished ones', () => {
    const state = withHall(4);
    state.settlement!.built = ['byre'];
    state.settlement!.queue = ['longhouse'];
    state.settlement!.works = 0;
    const started = steadingScene(state);
    expect(started.raised).toHaveLength(2);
    expect(started.raised[1]!.done).toBeLessThan(1);

    // And it visibly rises as the builder-days go in.
    state.settlement!.works = buildingById('longhouse')!.works * 0.75;
    const nearly = steadingScene(state);
    expect(nearly.raised[1]!.done).toBeGreaterThan(started.raised[1]!.done);
    expect(nearly.raised[1]!.done).toBeLessThan(1);
  });

  it('makes a hall stand bigger than a byre, off the work it cost', () => {
    const hall = sizeOf(buildingById('longhouse'));
    const byre = sizeOf(buildingById('byre'));
    expect(hall).toBeGreaterThan(byre);
    // But not so much that the small one is a speck.
    expect(byre / hall).toBeGreaterThan(0.5);
  });

  it('widens the yard rather than piling buildings on top of each other', () => {
    const state = withHall(4);
    const narrow = steadingScene(state).width;
    state.settlement!.built = ['byre', 'longhouse', 'smokehouse', 'well', 'palisade'];
    const wide = steadingScene(state);
    expect(wide.width).toBeGreaterThan(narrow);
    expect(wide.width).toBeGreaterThanOrEqual(slotX(wide.raised.length) + SLOT_W - 1);
  });
});

describe('the folk in the yard', () => {
  it('draws everybody, and no two of them in the same place', () => {
    // The bug this mode has had twice: the second figure IS drawn, exactly
    // underneath the first, so a screenshot cannot tell you.
    const scene = steadingScene(withHall(4));
    expect(scene.folk.length).toBeGreaterThan(1);
    const spots = scene.folk.map((f) => `${Math.round(f.x)},${Math.round(f.y)}`);
    expect(new Set(spots).size, 'two of the band are standing in the same spot')
      .toBe(spots.length);
    for (const f of scene.folk) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.y).toBeGreaterThan(GROUND_Y);
      expect(f.y).toBeLessThan(YARD_H + 60);
    }
  });

  it('says what each of them is doing', () => {
    for (const f of steadingScene(withHall(4)).folk) {
      expect(f.job.length).toBeGreaterThan(0);
    }
  });

  it('has a yard at least as wide as it started', () => {
    expect(steadingScene(withHall(4)).width).toBeGreaterThanOrEqual(YARD_W);
  });
});

describe('a steading that is not there', () => {
  it('says so rather than throwing', () => {
    const state = cloneState(newGame(SEED));
    const scene = steadingScene(state);
    expect(scene.name).toBe('');
    expect(scene.raised).toEqual([]);
    expect(scene.folk).toEqual([]);
  });
});

describe('the plots the hex map still makes', () => {
  it('is untouched when the country is hexes', () => {
    // Guarded here because `makePlots` grew a branch, and the hex path is
    // still the game everybody plays.
    const state = cloneState(newGame(SEED));
    expect(standingAt(state)).toBe(0);
    const plots = makePlots(
      { water: 3, soil: 3, timber: 3, harbour: 2, defence: 2, total: 13 },
      makeRng('plots-test'),
    );
    expect(plots.length).toBeGreaterThan(6);
    expect(plots.filter((p) => p.kind === 'hall')).toHaveLength(1);
  });
});

describe('every house is inside its own yard', () => {
  /**
   * The bug this pins, found by looking at a screenshot rather than at a bar.
   *
   * `slotX` inset the first slot by `SLOT_W * 0.6` — a number with no
   * relationship to how wide a house actually is. `steadingView` drew the
   * walls at `SLOT_W * 0.42` with the roof oversailing by five, and scaled the
   * whole thing by up to `SIZE_MAX`. At full size that reaches 48.7 from the
   * centre against an inset of 44.4, so a large FIRST building — a longhouse,
   * the usual first thing anybody raises — hung four units off the left of the
   * viewBox and was drawn half off the page.
   *
   * The browser bar missed it because it asked whether the house overlapped
   * the picture rather than whether it was inside it. Both are fixed; this is
   * the half that does not need a browser, because the arithmetic is the
   * whole of the claim.
   */
  it('leaves room for the widest roof at both ends', () => {
    // The reach is what the view actually draws: half the walls, plus the
    // oversail, at the largest scale `sizeOf` will ever return.
    expect(HOUSE_REACH).toBeCloseTo((HOUSE_HALF + ROOF_OVERSAIL) * SIZE_MAX, 5);
    expect(slotX(0), 'the first slot is nearer the edge than a roof is wide')
      .toBeGreaterThanOrEqual(HOUSE_REACH);
  });

  it('holds for every building the game can raise, in any order', () => {
    for (const def of BUILDINGS) {
      const size = sizeOf(def);
      expect(size, `${def.id} is drawn larger than the layout allows`)
        .toBeLessThanOrEqual(SIZE_MAX);
      // First in the yard is the tight case: nothing to the left of it.
      const leftmost = slotX(0) - (HOUSE_HALF + ROOF_OVERSAIL) * size;
      expect(leftmost, `${def.id} raised first hangs off the left edge`)
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the last house as much room as the first', () => {
    const state = cloneState(newGame('yard-width'));
    for (let s = 0; s < 26; s += 1) learnStop(state, s);
    // A yard with several things in it, built through the real verb.
    for (let stop = 0; stop < 26 && !state.settlement; stop += 1) {
      state.party.stop = stop;
      if (canFound(state)) foundSettlement(state);
    }
    if (!state.settlement) return;
    state.settlement.built = BUILDINGS.slice(0, 4).map((b) => b.id);
    const scene = steadingScene(state);
    const last = scene.raised[scene.raised.length - 1]!;
    expect(last.x + (HOUSE_HALF + ROOF_OVERSAIL) * last.size, 'the last house runs off the right')
      .toBeLessThanOrEqual(scene.width);
  });
});
