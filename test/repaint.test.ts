// The repaint bar: a map that costs what CHANGED, not what is on it.
//
// The claim being pinned is a number, so it is measured against a real run
// rather than asserted. `runs/long.json` is 1320 actions and 457 days — the
// same script the C++ port is checked against — and every action redraws the
// map, so it is exactly the shape of a long session on a phone.
//
// The old renderer cleared the terrain layer and rebuilt a polygon for every
// seen hex on every repaint. That total is computed here too, from the same
// run, so the comparison is between two measurements and not between a
// measurement and a memory.

import { describe, expect, it } from 'vitest';
import longText from '../runs/long.json?raw';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { isIdle, repaintWork, type Lit } from '../src/render/repaint';
import type { Script } from '../src/run/headless';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import type { GameState } from '../src/state/types';

const LONG = JSON.parse(longText) as Script;

/** Every state the run passes through, in order — one repaint each. */
function replay(script: Script): GameState[] {
  let state = newGame(script.seed, script.hardship);
  const states: GameState[] = [state];
  for (const action of script.actions as Action[]) {
    const next = apply(state, action);
    if (next === state) continue;
    state = next;
    states.push(state);
  }
  return states;
}

/** What the renderer holds, walked forward exactly as the view walks it. */
function drive(states: GameState[]) {
  const drawn = new Map<string, Lit>();
  let made = 0;
  let touched = 0;
  let idle = 0;

  for (const state of states) {
    const seen = state.world.seen as Record<string, Lit>;
    const work = repaintWork(drawn, seen);
    if (isIdle(work)) idle++;

    made += work.added.length;
    touched += work.relit.length;
    for (const k of work.added) {
      const lit = seen[k];
      if (lit !== undefined) drawn.set(k, lit);
    }
    for (const k of work.relit) {
      const lit = seen[k];
      if (lit !== undefined) drawn.set(k, lit);
    }
    for (const k of work.dropped) drawn.delete(k);
  }

  return { made, touched, idle, held: drawn.size };
}

// THE RECORDED RUN RETIRES WITH THE HEXES, and so does the map it measures.
//
// Every number in this block is measured over `runs/long.json`, a recording
// of HEX actions — `MOVE` carrying `{q, r}`, which on a line does not exist
// because travel is `WALK` to a stop. A coast build applies 108 of its 1142,
// so the replay stops short and the chart it builds is a fraction of the one
// the ratios are about. And `render/repaint.ts` is the hex map's cache:
// `travelScreen.ts` mounts `createProcessionView()` behind the flag, so a
// coast build never draws a polygon for a hex at all.
//
// Same finding as the parity vectors and the headless replays, same decision
// — see "The parity vectors retire with the hexes" in ROADMAP.md. The block
// below keeps running on the default build, where it guards the map that
// ships; `repaintWork`'s own unit bars underneath are about the diff itself
// and hold on either build, so they are not skipped.
describe.skipIf(COAST_IS_A_LINE)('a repaint costs what changed', () => {
  const states = replay(LONG);

  it('replays the long run', () => {
    // If this moves, every number below is measuring a different run and the
    // comparison is worthless — so it is stated rather than assumed.
    expect(states.length).toBeGreaterThan(1000);
  });

  it('builds each hex once instead of once per repaint', () => {
    const { made, held } = drive(states);

    // What the old renderer did: clear, then one polygon per seen hex, every
    // repaint. Computed from the same states, so this is a measurement of the
    // code that was there and not an estimate of it.
    let before = 0;
    for (const state of states) before += Object.keys(state.world.seen).length;

    // Every hex the band ever charts is built exactly once and then kept.
    expect(made).toBe(held);

    // The real bar. The old cost is quadratic in the length of the run — a
    // map that grows, redrawn a number of times that also grows — and the new
    // one is linear in the size of the country.
    expect(made).toBeLessThan(before / 100);

    // Printed because the ratio is the point, and a number nobody reads is a
    // number nobody notices moving.
    console.log(
      `repaint: ${before.toLocaleString()} polygons built before, ` +
        `${made.toLocaleString()} after (${(before / made).toFixed(0)}x), ` +
        `${held.toLocaleString()} hexes charted`,
    );
  });

  it('relights a hex without rebuilding it', () => {
    const { touched, made } = drive(states);

    // The band's sight moves every day, so hexes flip between lit and
    // remembered constantly — that is the case the cache exists to survive.
    // If this were zero the diff would not be detecting the flip at all and
    // the map would be lying about what can be seen.
    expect(touched).toBeGreaterThan(made);
  });

  it('costs nothing per repaint on a map that is fully charted', () => {
    // The ceiling, and the case the scripted runs cannot reach: both of them
    // settle on day 11 and stop walking, so their charts stay at 78 hexes of
    // 1872. A band that keeps travelling charts far more, and the old cost
    // was the size of the chart EVERY repaint — so this is where the two
    // curves are furthest apart.
    const state = structuredClone(states[states.length - 1]!);
    for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
    const seen = state.world.seen as Record<string, Lit>;

    const drawn = new Map<string, Lit>();
    expect(repaintWork(drawn, seen).added).toHaveLength(Object.keys(state.world.tiles).length);
    for (const k in seen) drawn.set(k, seen[k]!);

    // Drawn once. Every repaint after it is free, however many there are.
    expect(isIdle(repaintWork(drawn, seen))).toBe(true);
  });

  it('does nothing on a repaint that changed nothing', () => {
    const { idle } = drive(states);
    // Most actions in a run are not a step: choosing, dismissing, assigning,
    // queueing. None of them move the fog, and none of them should cost the
    // map anything at all.
    expect(idle).toBeGreaterThan(states.length / 3);
  });
});

describe('repaintWork', () => {
  it('reports a hex it has never drawn as added', () => {
    const work = repaintWork(new Map(), { '0,0': 'visible' });
    expect(work).toEqual({ added: ['0,0'], relit: [], dropped: [] });
  });

  it('reports a hex whose light changed as relit, not added', () => {
    const drawn = new Map<string, Lit>([['0,0', 'visible']]);
    expect(repaintWork(drawn, { '0,0': 'seen' })).toEqual({
      added: [],
      relit: ['0,0'],
      dropped: [],
    });
  });

  it('reports nothing for a hex that did not change', () => {
    const drawn = new Map<string, Lit>([['0,0', 'visible']]);
    expect(isIdle(repaintWork(drawn, { '0,0': 'visible' }))).toBe(true);
  });

  it('drops country that is no longer on the chart', () => {
    // A mounted view handed a different world — a load, or a new game — has
    // to let the old island go. Without this it draws two coasts at once.
    const drawn = new Map<string, Lit>([
      ['0,0', 'visible'],
      ['1,0', 'seen'],
    ]);
    expect(repaintWork(drawn, { '9,9': 'visible' })).toEqual({
      added: ['9,9'],
      relit: [],
      dropped: ['0,0', '1,0'],
    });
  });

  it('drops without being confused by a same-sized replacement', () => {
    // The count shortcut compares how many drawn hexes were found against
    // how many are held. Two in, two out, none of them the same: if the
    // shortcut compared SIZES rather than matches it would skip the drop
    // pass here and leave the old island on the map.
    const drawn = new Map<string, Lit>([
      ['0,0', 'visible'],
      ['1,0', 'visible'],
    ]);
    const work = repaintWork(drawn, { '5,5': 'visible', '6,5': 'visible' });
    expect(work.dropped).toEqual(['0,0', '1,0']);
    expect(work.added).toEqual(['5,5', '6,5']);
  });
});
