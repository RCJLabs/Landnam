// Where your people STAND, checked without a document.
//
// Drawing the steading exists to make assignment visible: put someone on the
// fields and a figure appears in the fields. That is a promise the game makes
// on every colony screen, and until render/colony.ts was split it could only
// be checked by loading the built page and reading SVG attributes — so it was
// never checked at all. Neither was which plot a raised building lands on,
// nor the spreading that stops two people on one plot hiding each other.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { fromKey, key } from '../src/hex';
import { canFound, foundSettlement } from '../src/sim/site';
import { PLOTS, type JobId } from '../src/data/jobs';
import { describeColony, HEX } from '../src/render/colonyScene';
import type { GameState } from '../src/state/types';

/** A band on ground that will have them, with the whole map charted. */
function settled(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  for (const k of Object.keys(state.world.tiles)) {
    state.party.at = fromKey(k);
    if (canFound(state, state.party.at)) break;
  }
  expect(canFound(state, state.party.at), `${seed}: nowhere to settle`).toBe(true);
  expect(foundSettlement(state)).toBe(true);
  return state;
}

/** Everybody alive put to the same job, so one plot kind has to carry them. */
function allDoing(state: GameState, job: JobId): GameState {
  const next = structuredClone(state);
  for (const person of next.party.people) if (person.alive) person.job = job;
  return next;
}

/** A band of exactly `n` people, every one of them put to the same job. */
function crowd(state: GameState, job: JobId, n: number): GameState {
  const next = structuredClone(state);
  const seed = next.party.people.find((p) => p.alive);
  expect(seed, 'nobody alive to copy').toBeDefined();
  next.party.people = Array.from({ length: n }, (_, i) => ({
    ...structuredClone(seed!),
    id: `crowd-${i}`,
    name: `Crowd ${i}`,
    job,
  }));
  return next;
}

/** The closest two of them, in world units. */
function closest(folk: readonly { nudge: readonly [number, number] }[]): number {
  let min = Infinity;
  for (let i = 0; i < folk.length; i++) {
    for (let j = i + 1; j < folk.length; j++) {
      const a = folk[i]!.nudge;
      const b = folk[j]!.nudge;
      min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
  }
  return min;
}

/**
 * How wide a person is drawn: render/colony.ts gives each one a head of
 * r = HEX * 0.11, so two of them closer than this overlap on screen.
 */
const HEAD = HEX * 0.11 * 2;

const SEEDS = ['raven-skerry-317', 'grim-fjord-100', 'kelda-vik-42'];

describe('a steading with no ground', () => {
  it('describes nothing at all rather than an empty frame', () => {
    const state = structuredClone(newGame('raven-skerry-317'));
    const scene = describeColony(state);
    expect(scene.bounds).toBeNull();
    expect(scene.plots).toEqual([]);
    expect(scene.folk).toEqual([]);
    expect(scene.marks).toEqual([]);
  });
});

describe('the ground', () => {
  it('draws every plot the settlement holds, and no others', () => {
    for (const seed of SEEDS) {
      const state = settled(seed);
      const scene = describeColony(state);
      const drawn = scene.plots.map((p) => key(p.at)).sort();
      const held = state.settlement!.plots.map((p) => key(p.at)).sort();
      expect(drawn, seed).toEqual(held);
    }
  });

  it('marks exactly one plot as the hall', () => {
    for (const seed of SEEDS) {
      const scene = describeColony(settled(seed));
      expect(scene.plots.filter((p) => p.hall).length, seed).toBe(1);
    }
  });

  it('frames every plot with room to spare', () => {
    for (const seed of SEEDS) {
      const state = settled(seed);
      const scene = describeColony(state);
      const b = scene.bounds!;
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
      for (const plot of state.settlement!.plots) {
        // Hex CENTRES sit inside the box with at least most of a hex of air,
        // so no plot is clipped by the edge of the frame.
        const x = HEX * Math.sqrt(3) * (plot.at.q + plot.at.r / 2);
        const y = HEX * 1.5 * plot.at.r;
        expect(x, `${seed} ${key(plot.at)}`).toBeGreaterThanOrEqual(b.x + HEX * 0.8);
        expect(x).toBeLessThanOrEqual(b.x + b.w - HEX * 0.8);
        expect(y).toBeGreaterThanOrEqual(b.y + HEX * 0.8);
        expect(y).toBeLessThanOrEqual(b.y + b.h - HEX * 0.8);
      }
    }
  });
});

describe('the people', () => {
  it('puts a worker on ground their job is actually worked on', () => {
    // The whole promise of the screen. A farmer standing in the water would
    // be a lie about what the band is doing today.
    for (const seed of SEEDS) {
      const base = settled(seed);
      for (const job of ['farmer', 'woodcutter', 'fisher', 'warrior'] as JobId[]) {
        const state = allDoing(base, job);
        const home = state.settlement!;
        const scene = describeColony(state);
        const worksHere = new Set(
          home.plots.filter((p) => PLOTS[p.kind].worked.includes(job)).map((p) => key(p.at)),
        );
        if (worksHere.size === 0) {
          expect(scene.folk, `${seed} ${job}: no ground for it, so nobody should stand`).toEqual([]);
          continue;
        }
        expect(scene.folk.length, `${seed} ${job}`).toBeGreaterThan(0);
        for (const person of scene.folk) {
          expect(worksHere.has(key(person.at)), `${seed}: a ${job} on ${key(person.at)}`).toBe(true);
        }
      }
    }
  });

  it('nobody stands anywhere with no job', () => {
    const base = settled('raven-skerry-317');
    const idle = structuredClone(base);
    for (const person of idle.party.people) person.job = undefined;
    expect(describeColony(idle).folk).toEqual([]);
  });

  it('spreads a crowd across the plots that job has', () => {
    // Six farmers and three fields should stand on three fields, not one.
    for (const seed of SEEDS) {
      const state = allDoing(settled(seed), 'farmer');
      const home = state.settlement!;
      const fields = home.plots.filter((p) => p.kind === 'field');
      const scene = describeColony(state);
      if (fields.length < 2 || scene.folk.length < 2) continue;
      const stood = new Set(scene.folk.map((f) => key(f.at)));
      expect(stood.size, `${seed}: ${scene.folk.length} farmers piled onto ${stood.size} of ${fields.length} fields`)
        .toBe(Math.min(fields.length, scene.folk.length));
    }
  });

  it('never hides one person exactly under another', () => {
    for (const seed of SEEDS) {
      const state = allDoing(settled(seed), 'farmer');
      const scene = describeColony(state);
      if (scene.folk.length < 2) continue;
      const spots = scene.folk.map((f) => `${key(f.at)}@${f.nudge[0].toFixed(2)},${f.nudge[1].toFixed(2)}`);
      expect(new Set(spots).size, `${seed}: two people drawn in the same place`).toBe(spots.length);
    }
  });

  it('spreads people of DIFFERENT jobs who share a plot', () => {
    // The wood is worked by the hunter AND the woodcutter. Counting the crowd
    // per job says each of them is the first to arrive, so both stand dead
    // centre — six people with jobs drew four, and the two that vanished were
    // simply underneath the two that did not.
    const state = settled('raven-skerry-317');
    const alive = state.party.people.filter((p) => p.alive);
    expect(alive.length, 'need a band to share ground').toBeGreaterThanOrEqual(4);
    const shared = ['hunter', 'woodcutter'];
    alive.forEach((p, i) => { p.job = shared[i % shared.length]; });

    const scene = describeColony(state);
    expect(scene.folk.length, 'everyone with a job stands somewhere').toBe(alive.length);
    const spots = scene.folk.map((f) => `${key(f.at)}@${f.nudge[0].toFixed(3)},${f.nudge[1].toFixed(3)}`);
    expect(new Set(spots).size, 'two people drawn in the same place').toBe(spots.length);

    // And they are far enough apart to be two people rather than one smudge.
    const byPlot = new Map<string, { nudge: readonly [number, number] }[]>();
    for (const person of scene.folk) {
      const at = key(person.at);
      byPlot.set(at, [...(byPlot.get(at) ?? []), person]);
    }
    for (const [at, folk] of byPlot) {
      if (folk.length < 2) continue;
      expect(closest(folk), `${folk.length} sharing ${at}`).toBeGreaterThanOrEqual(HEAD);
    }
  });

  it('keeps a whole band on one plot from standing on each other', () => {
    // `warrior` is worked by the watchpost and nothing else, so every warrior
    // in the band lands on ONE hex and only the nudge separates them. A ring
    // is not enough here: the eighth of them comes within 5.7px of a
    // neighbour and a head is HEAD wide, which is hiding again by another
    // name. Twenty-one is where the geometry genuinely runs out — the plot
    // cannot hold more heads than that without shrinking them.
    for (const size of [2, 4, 8, 12, 16, 21]) {
      const state = crowd(settled('raven-skerry-317'), 'warrior', size);
      const byPlot = new Map<string, { nudge: readonly [number, number] }[]>();
      for (const person of describeColony(state).folk) {
        const at = key(person.at);
        byPlot.set(at, [...(byPlot.get(at) ?? []), person]);
      }
      // The premise: one watchpost, so the whole band is on it. If the
      // steading ever grows a second one this says so rather than going quiet.
      const biggest = Math.max(...[...byPlot.values()].map((f) => f.length));
      expect(biggest, `${size} warriors spread over ${byPlot.size} plots`).toBe(size);
      for (const [at, folk] of byPlot) {
        expect(closest(folk), `${size} on a plot: closest pair on ${at}`).toBeGreaterThanOrEqual(HEAD);
      }
    }
  });

  it('never nudges anyone off the plot they belong to, even in a full band', () => {
    for (const size of [2, 12, 25]) {
      const state = crowd(settled('raven-skerry-317'), 'warrior', size);
      for (const person of describeColony(state).folk) {
        expect(Math.hypot(person.nudge[0], person.nudge[1]), `${size} on a plot`)
          .toBeLessThan(HEX * 0.75);
      }
    }
  });

  it('keeps the nudge inside the plot it belongs to', () => {
    const state = allDoing(settled('raven-skerry-317'), 'farmer');
    for (const person of describeColony(state).folk) {
      expect(Math.hypot(person.nudge[0], person.nudge[1])).toBeLessThan(HEX * 0.75);
    }
  });

  it('leaves the dead standing nowhere', () => {
    const state = allDoing(settled('raven-skerry-317'), 'farmer');
    const before = describeColony(state).folk.length;
    expect(before).toBeGreaterThan(0);
    const buried = structuredClone(state);
    for (const person of buried.party.people) person.alive = false;
    expect(describeColony(buried).folk).toEqual([]);
  });
});

describe('what has been raised', () => {
  it('stands on a plot, and never on the hall', () => {
    const state = settled('raven-skerry-317');
    const home = state.settlement!;
    const spots = home.plots.filter((p) => p.kind !== 'hall');
    if (spots.length === 0) return;
    const withBuilt = structuredClone(state);
    withBuilt.settlement!.built = ['longhouse', 'palisade', 'dock'];
    const hall = key(home.plots.find((p) => p.kind === 'hall')!.at);
    const raised = describeColony(withBuilt).marks.filter((m) => m.kind === 'raised');
    expect(raised.length).toBe(3);
    const ground = new Set(spots.map((p) => key(p.at)));
    for (const mark of raised) {
      expect(ground.has(key(mark.at)), 'a building off the steading’s ground').toBe(true);
      expect(key(mark.at), 'a building raised on the hall').not.toBe(hall);
    }
  });

  it('is drawn over the ground it stands on, never under it', () => {
    const state = settled('raven-skerry-317');
    state.settlement!.built = ['longhouse'];
    const marks = describeColony(state).marks;
    const lastPlot = marks.map((m) => m.kind).lastIndexOf('plot');
    const firstRaised = marks.map((m) => m.kind).indexOf('raised');
    expect(firstRaised).toBeGreaterThan(lastPlot);
  });
});

describe('the description', () => {
  it('says the same thing twice for the same state', () => {
    const state = allDoing(settled('raven-skerry-317'), 'farmer');
    expect(JSON.stringify(describeColony(state))).toBe(JSON.stringify(describeColony(state)));
  });
});
