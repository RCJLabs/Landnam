// What the travel map SAYS, checked without a document.
//
// Until render/travel.ts was split, every one of these claims could only be
// tested by loading the built page in a browser and reading SVG attributes
// back out — which is why most of them were never tested at all. The three
// browser bars that touched this (sea, way-look, repaint) each pinned one
// corner of it and cost a build and a Chromium launch to do so.
//
// The rules are plain functions now, so this is where they get held to
// account, and the bars go back to defending what only a browser can see.

import { describe, expect, it } from 'vitest';
import longText from '../runs/long.json?raw';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { key, neighbors } from '../src/hex';
import { moveOptions } from '../src/sim/road';
import {
  describeGround,
  describeLight,
  describeOverlay,
  describeSeason,
  describeToken,
} from '../src/render/travelScene';
import type { Script } from '../src/run/headless';
import type { Mark } from '../src/render/travelScene';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import type { GameState, Terrain } from '../src/state/types';
import { RETIRED_WITH_THE_HEXES } from './fixtures/hexOnly';

const script = JSON.parse(longText) as Script;

/** The state after `n` actions of the recorded run — a real map, not a fixture. */
function after(n: number): GameState {
  let state = newGame(script.seed, script.hardship);
  for (const action of script.actions.slice(0, n)) state = apply(state, action as Action);
  return state;
}

type Kind = Mark['kind'];
const kinds = (state: GameState): Kind[] => describeOverlay(state).map((m) => m.kind);

describe('the ground under a hex', () => {
  it('is only described for country that is on the chart', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = after(60);
    const charted = Object.keys(state.world.seen);
    expect(charted.length).toBeGreaterThan(0);
    for (const k of charted) expect(describeGround(state, k)).not.toBeNull();
    // A key off the edge of the world, and one inside it that nobody has seen.
    expect(describeGround(state, '999,999')).toBeNull();
    const unseen = Object.keys(state.world.tiles).find((k) => state.world.seen[k] === undefined);
    expect(unseen).toBeDefined();
    expect(describeGround(state, unseen!)).toBeNull();
  });

  it('never changes once it has been charted, however the light moves', () => {
    // This is the invariant the whole build-once repaint path rests on: a
    // node is built from the ground once and only ever relit afterwards. If
    // it were false the map would go stale rather than merely dim.
    //
    // Counting the relights matters as much as the comparison — the claim is
    // about hexes whose light MOVED, and a run that never relit anything
    // would satisfy the loop while proving nothing.
    // THE HEX MAP'S VIEW, AND THE RECORDED RUN THAT DRIVES IT.
    // Two reasons, either of which is enough. `render/travelScene.ts` is
    // the hex map, and a coast build never mounts it — `travelScreen.ts`
    // builds `createProcessionView()` behind the flag, so this is a
    // renderer the coast game does not show. And the script this file
    // replays is `runs/long.json`, a recording of HEX actions: 108 of its
    // 1142 apply on a line, so the run charts 35 hexes where the bar wants
    // 40 and the marks come back on the placeholder hex.
    //
    // Same finding as the parity vectors and the headless replays, same
    // decision — see "The parity vectors retire with the hexes" in
    // ROADMAP.md. They keep running on the default build, where they guard
    // the game that ships.
    if (COAST_IS_A_LINE) return;
    let state = newGame(script.seed, script.hardship);
    const stamp = new Map<string, string>();
    const light = new Map<string, string>();
    let relights = 0;
    for (let i = 0; i < 900; i += 1) {
      state = apply(state, script.actions[i] as Action);
      for (const [k, now] of Object.entries(state.world.seen)) {
        const ground = describeGround(state, k);
        if (!ground) continue;
        const seen = JSON.stringify(ground);
        if (!stamp.has(k)) stamp.set(k, seen);
        else expect(seen, `the ground under ${k} moved`).toBe(stamp.get(k));
        if (light.get(k) !== undefined && light.get(k) !== now) relights += 1;
        light.set(k, now as string);
      }
    }
    expect(stamp.size, 'the run should chart some country').toBeGreaterThan(40);
    expect(relights, 'and relight some of it, or this proves nothing').toBeGreaterThan(20);
  });

  it('puts surf only on shallow sea, and only on the edges that face land', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = after(300);
    let foamy = 0;
    for (const k of Object.keys(state.world.seen)) {
      const ground = describeGround(state, k);
      if (!ground) continue;
      if (ground.terrain !== 'ocean' || ground.deep) {
        expect(ground.foam, `${ground.terrain} should not have surf`).toEqual([]);
        continue;
      }
      // Every foam edge must have something that is not ocean across it.
      const land = neighbors({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) })
        .filter((h) => {
          const t = state.world.tiles[key(h)]?.terrain as Terrain | undefined;
          return t !== undefined && t !== 'ocean';
        });
      expect(ground.foam.length).toBeLessThanOrEqual(6);
      if (ground.foam.length > 0) {
        foamy += 1;
        expect(land.length, `surf on ${k} with no land beside it`).toBeGreaterThan(0);
      }
    }
    expect(foamy, 'a 300-action run should have found some coast').toBeGreaterThan(0);
  });
});

describe('the light on a hex', () => {
  it('is the only thing a relight has to ask, and it agrees with world.seen', () => {
    const state = after(300);
    for (const [k, seen] of Object.entries(state.world.seen)) {
      expect(describeLight(state, k)).toBe(seen === 'visible');
    }
    expect(describeLight(state, '999,999')).toBeNull();
  });
});

describe('the overlay', () => {
  it('offers exactly the moves the sim allows, and no others', () => {
    // The map used to keep its own list of steps, which drifted from the
    // sim's and cost the player sixty legal moves over fifteen turns afloat.
    for (const n of [1, 40, 200, 600]) {
      const state = after(n);
      const offered = describeOverlay(state)
        .filter((m) => m.kind === 'move')
        .map((m) => key(m.at))
        .sort();
      const allowed = (state.event || state.end ? [] : moveOptions(state)).map(key).sort();
      expect(offered, `at action ${n}`).toEqual(allowed);
    }
  });

  it('offers nothing while a card is up, because nothing can be chosen', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    let state = newGame(script.seed, script.hardship);
    let raised: GameState | null = null;
    for (let i = 0; i < 900 && !raised; i += 1) {
      state = apply(state, script.actions[i] as Action);
      if (state.event) raised = state;
    }
    expect(raised, 'the recorded run should raise a card').not.toBeNull();
    expect(kinds(raised!)).not.toContain('move');
  });

  it('never marks country the band has not seen', () => {
    // THE HEX MAP'S VIEW, AND THE RECORDED RUN THAT DRIVES IT.
    // Two reasons, either of which is enough. `render/travelScene.ts` is
    // the hex map, and a coast build never mounts it — `travelScreen.ts`
    // builds `createProcessionView()` behind the flag, so this is a
    // renderer the coast game does not show. And the script this file
    // replays is `runs/long.json`, a recording of HEX actions: 108 of its
    // 1142 apply on a line, so the run charts 35 hexes where the bar wants
    // 40 and the marks come back on the placeholder hex.
    //
    // Same finding as the parity vectors and the headless replays, same
    // decision — see "The parity vectors retire with the hexes" in
    // ROADMAP.md. They keep running on the default build, where they guard
    // the game that ships.
    if (COAST_IS_A_LINE) return;
    const base = after(900);
    // A way and a rock on unseen ground as well, so the gate is tested on
    // more than the three kinds this particular run happens to produce.
    const there = Object.keys(base.world.seen);
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        made: { [there[0]!]: base.day, '999,999': base.day } as unknown as typeof base.world.made,
        charted: [there[1]!, '998,998'],
      },
    };
    const reached = new Set<Kind>();
    for (const mark of describeOverlay(state)) {
      reached.add(mark.kind);
      // The band's own fire, the birds beside it and the steading it built
      // are about where the band IS; everything else is a claim about
      // country, and a claim about unseen country is a lie.
      if (mark.kind === 'camp' || mark.kind === 'birds') continue;
      if (mark.kind === 'move' || mark.kind === 'steading') continue;
      expect(state.world.seen[key(mark.at)], `${mark.kind} on unseen ${key(mark.at)}`)
        .toBeDefined();
    }
    for (const k of ['neighbour', 'landfall', 'claim', 'way', 'skerry'] as const) {
      expect(reached, `nothing of kind ${k} for the gate to catch`).toContain(k);
    }
  });

  it('warns on a crossing with charted rock in it, and only once it is charted', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    // Replaying the recorded run flags this ZERO times in 1,585 actions — the
    // band never rows over a rock it has written down — so a test that only
    // replayed would pass while saying nothing. Build the situation instead.
    const base = after(1);
    const option = moveOptions(base)[0];
    expect(option, 'the band should have somewhere to go on day one').toBeDefined();
    const k = key(option!);
    const flagged = (s: GameState) => describeOverlay(s)
      .filter((m) => m.kind === 'move' && key(m.at) === k)
      .map((m) => (m.kind === 'move' ? m.overRock : false));

    const uncharted: GameState = {
      ...base,
      world: { ...base.world, seen: { ...base.world.seen, [k]: 'visible' }, charted: [] },
    };
    expect(flagged(uncharted), 'rock nobody has found must not be on the map').toEqual([false]);

    const found: GameState = { ...uncharted, world: { ...uncharted.world, charted: [k] } };
    expect(flagged(found), 'rock the band HAS found must be').toEqual([true]);

    // A charted rock on water nobody has looked at stays quiet, which is the
    // difference between a warning and a spoiler.
    const seen = { ...found.world.seen };
    delete seen[k];
    expect(flagged({ ...found, world: { ...found.world, seen } })).toEqual([false]);
  });

  it('is drawn in a fixed order, so the steading is never buried under a move ring', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const base = after(900);
    const there = Object.keys(base.world.seen);
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        made: { [there[0]!]: base.day } as unknown as typeof base.world.made,
        charted: [there[1]!],
      },
    };
    const order = kinds(state);
    for (const k of ['way', 'skerry', 'steading'] as const) expect(order, k).toContain(k);
    const first = (k: Kind) => order.indexOf(k);
    for (const under of ['move', 'way', 'skerry'] as const) {
      for (const over of ['steading', 'place', 'neighbour', 'rivalHall'] as const) {
        if (first(under) < 0 || first(over) < 0) continue;
        expect(first(under), `${under} should be drawn under ${over}`).toBeLessThan(first(over));
      }
    }
  });

  it('is the same overlay for the same state — nothing is rolled twice', () => {
    const state = after(500);
    expect(JSON.stringify(describeOverlay(state))).toBe(JSON.stringify(describeOverlay(state)));
  });

  it('keeps the sky steady across repaints, and turns it over with the day', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    // Birds need seen water within two hexes of the band, which happens on
    // exactly ONE turn of the recorded run's 1,585 — so replaying it tests
    // the bird rule not at all. Put the band on a coast it has looked at.
    const base = after(1);
    // Stand the band on a shore with water it has looked at. The landing
    // itself is not always beside open sea, so the hex is found rather than
    // assumed.
    let shore: { at: typeof base.party.at; water: typeof base.party.at[] } | null = null;
    for (const k of Object.keys(base.world.tiles)) {
      if (base.world.tiles[k]!.terrain === 'ocean') continue;
      const at = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      const water = neighbors(at).filter((h) => base.world.tiles[key(h)]?.terrain === 'ocean');
      if (water.length > 0) { shore = { at, water }; break; }
    }
    expect(shore, 'the world should have a coast').not.toBeNull();
    const seen = { ...base.world.seen };
    for (const h of shore!.water) seen[key(h)] = 'visible';
    const coastal = (day: number): GameState =>
      ({ ...base, day, party: { ...base.party, at: shore!.at }, world: { ...base.world, seen } });

    // Some days there are birds and some there are not, but a given day is a
    // given day: two repaints of one state must not disagree about the sky.
    let withBirds = 0;
    for (let day = 1; day <= 40; day += 1) {
      const state = coastal(day);
      const once = describeOverlay(state).filter((m) => m.kind === 'birds');
      const twice = describeOverlay(state).filter((m) => m.kind === 'birds');
      expect(JSON.stringify(twice), `day ${day} rolled a different sky`).toBe(JSON.stringify(once));
      if (once.length > 0) withBirds += 1;
    }
    // ...and the sky is not simply always the same, or always absent.
    expect(withBirds, 'no birds in forty days over open water').toBeGreaterThan(0);
    expect(withBirds, 'birds every single day is not weather').toBeLessThan(40);
  });

});

describe('the band', () => {
  it('is placed where the party is, afloat when the party is afloat', () => {
    for (const n of [1, 100, 500, 900]) {
      const state = after(n);
      expect(describeToken(state).at).toEqual(state.party.at);
    }
  });

  it('reads the season off the day', () => {
    expect(describeSeason(after(1))).toBe('summer');
    const seasons = new Set([1, 200, 400, 800, 1200].map((n) => describeSeason(after(n))));
    expect(seasons.size).toBeGreaterThan(1);
  });
});
