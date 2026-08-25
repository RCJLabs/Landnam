// The two decisions the painted steading makes that a browser cannot be asked
// about cheaply: how big a canvas to allocate, and when NOT to load the brush.
//
// The first matters because a canvas past 4096px on an axis is not a slow
// painting, it is a blank rectangle on iOS Safari — the failure looks like
// "the steading disappeared" and would be found by a player, not by us.
//
// The second matters because describeColony rebuilds whole on every repaint.
// If the brush went with it, every job change would repaint the ground.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { fromKey } from '../src/hex';
import { canFound, foundSettlement } from '../src/sim/site';
import { describeColony, type ColonyBounds } from '../src/render/colonyScene';
import { fit, groundKey, STEADING_SCALE } from '../src/render/colonyOil';
import type { GameState } from '../src/state/types';

const MAX_AXIS = 4096;

function settled(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  for (const k of Object.keys(state.world.tiles)) {
    state.party.at = fromKey(k);
    if (canFound(state, state.party.at)) break;
  }
  expect(foundSettlement(state), `${seed}: nowhere to settle`).toBe(true);
  return state;
}

const box = (w: number, h: number): ColonyBounds => ({ x: -w / 2, y: -h / 2, w, h });

describe('the canvas the steading asks for', () => {
  it('paints a real steading sharper than the screen, and nowhere near the limit', () => {
    for (const seed of ['raven-skerry-317', 'grim-fjord-100', 'kelda-vik-42']) {
      const scene = describeColony(settled(seed));
      expect(scene.bounds, seed).not.toBeNull();
      const got = fit(scene.bounds!, 3);
      expect(got.scale, `${seed}: climbed down for an ordinary steading`)
        .toBeCloseTo(STEADING_SCALE * 3);
      expect(Math.max(got.w, got.h), `${seed}: ${got.w}x${got.h}`).toBeLessThan(MAX_AXIS);
    }
  });

  it('never asks for a canvas iOS would refuse, however big the ground gets', () => {
    for (const side of [100, 400, 800, 1600, 4000, 20000]) {
      for (const dpr of [1, 2, 3, 4]) {
        const got = fit(box(side, side * 0.6), dpr);
        expect(Math.max(got.w, got.h), `${side} world units at dpr ${dpr}`)
          .toBeLessThanOrEqual(MAX_AXIS);
      }
    }
  });

  it('climbs down in scale rather than in shape, so nothing is squashed', () => {
    const bounds = box(9000, 3000);
    const got = fit(bounds, 3);
    expect(got.w / got.h).toBeCloseTo(bounds.w / bounds.h, 2);
  });

  it('still allocates something for a steading of one plot', () => {
    const got = fit(box(0.2, 0.2), 1);
    expect(got.w).toBeGreaterThanOrEqual(1);
    expect(got.h).toBeGreaterThanOrEqual(1);
  });
});

describe('when the brush is loaded again', () => {
  it('says the same ground twice for a steading that has not changed', () => {
    const state = settled('raven-skerry-317');
    const a = describeColony(state);
    const b = describeColony(structuredClone(state));
    expect(groundKey(a, state.seed)).toBe(groundKey(b, state.seed));
  });

  it('does not repaint because somebody took a job or died', () => {
    const state = settled('raven-skerry-317');
    const before = groundKey(describeColony(state), state.seed);

    const working = structuredClone(state);
    for (const person of working.party.people) person.job = 'farmer';
    expect(describeColony(working).folk.length).toBeGreaterThan(0);
    expect(groundKey(describeColony(working), working.seed)).toBe(before);

    const bereaved = structuredClone(working);
    bereaved.party.people[0]!.alive = false;
    expect(describeColony(bereaved).folk.length)
      .toBeLessThan(describeColony(working).folk.length);
    expect(groundKey(describeColony(bereaved), bereaved.seed)).toBe(before);
  });

  it('does not repaint because something was raised — that is drawn on top', () => {
    const state = settled('raven-skerry-317');
    const before = groundKey(describeColony(state), state.seed);
    const built = structuredClone(state);
    built.settlement!.built = ['longhouse'];
    expect(describeColony(built).marks.some((m) => m.kind === 'raised')).toBe(true);
    expect(groundKey(describeColony(built), built.seed)).toBe(before);
  });

  it('DOES repaint when the steading gains ground', () => {
    const state = settled('raven-skerry-317');
    const before = groundKey(describeColony(state), state.seed);
    const grown = structuredClone(state);
    const home = grown.settlement!;
    home.plots = [...home.plots, { ...home.plots[0]!, kind: 'field', at: { q: 99, r: 99 } }];
    expect(groundKey(describeColony(grown), grown.seed)).not.toBe(before);
  });

  it('DOES repaint when a plot becomes a different kind of ground', () => {
    const state = settled('raven-skerry-317');
    const before = groundKey(describeColony(state), state.seed);
    const changed = structuredClone(state);
    const plot = changed.settlement!.plots.find((p) => p.kind !== 'hall')!;
    plot.kind = plot.kind === 'field' ? 'wood' : 'field';
    expect(groundKey(describeColony(changed), changed.seed)).not.toBe(before);
  });

  it('DOES repaint in a different world, because the marks come off the seed', () => {
    const state = settled('raven-skerry-317');
    const scene = describeColony(state);
    expect(groundKey(scene, 'one')).not.toBe(groundKey(scene, 'two'));
  });

  it('says nothing at all for a steading that does not exist yet', () => {
    const state = structuredClone(newGame('raven-skerry-317'));
    expect(groundKey(describeColony(state), state.seed)).toBe('');
  });
});
