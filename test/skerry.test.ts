// The coast has teeth, and the band learns where they are.
//
// Water used to be uniform, so the knarr's three-hex day was free speed with
// no case against it. These bars hold the case: that rocks are a fact of the
// seed rather than of the save, that crossing water is what risks them (so
// the fast day gambles three times and the careful one once), and that what
// the band learns is worth what it cost.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { key } from '../src/hex';
import { SHIP_STRAKES } from '../src/data/ships';
import {
  SKERRY_SHARE,
  STRIKE_BLIND,
  STRIKE_CHARTED,
  chart,
  charted,
  crossed,
  rowThrough,
  skerryAt,
} from '../src/sim/skerry';
import { canMove, isCoastalWater, moveOptions } from '../src/sim/road';
import { apply } from '../src/sim/actions';
import { distance } from '../src/hex';
import { fromKey, neighbors } from '../src/hex';
import { springStrake } from '../src/sim/ship';

describe('the rocks are a fact of the seed', () => {
  it('answers the same for the same coast every time', () => {
    const a = newGame('skerry-same');
    const b = newGame('skerry-same');
    let checked = 0;
    for (const k of Object.keys(a.world.tiles).slice(0, 4000)) {
      const at = fromKey(k);
      if (!isCoastalWater(a, at)) continue;
      checked++;
      expect(skerryAt(a, at)).toBe(skerryAt(b, at));
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('is stored nowhere: a fresh save carries no rocks and no chart', () => {
    const state = newGame('skerry-save');
    // The whole point of deriving them — worldgen's hash is a contract with
    // the port, and a coast's rocks are not worth a save field.
    expect(state.world.charted).toBeUndefined();
    expect('skerries' in state.world).toBe(false);
  });

  it('salts the coast rather than paving or sparing it', () => {
    let water = 0;
    let rocks = 0;
    for (let s = 0; s < 6; s++) {
      const state = newGame(`skerry-density:${s}`);
      for (const k of Object.keys(state.world.tiles)) {
        const at = fromKey(k);
        if (!isCoastalWater(state, at)) continue;
        water++;
        if (skerryAt(state, at)) rocks++;
      }
    }
    const share = rocks / water;
    // Loose bars on purpose: this pins the ORDER of the density, not the
    // constant, so tuning SKERRY_SHARE does not have to argue with a test.
    expect(share).toBeGreaterThan(SKERRY_SHARE * 0.6);
    expect(share).toBeLessThan(SKERRY_SHARE * 1.5);
  });

  it('leaves the landing itself clear, because the keel proved that water', () => {
    for (let s = 0; s < 25; s++) {
      const state = newGame(`skerry-landing:${s}`);
      expect(skerryAt(state, state.world.landing)).toBe(false);
    }
  });
});

describe('crossing is what risks them', () => {
  it('counts every hex rowed over, not just the one arrived at', () => {
    // The three-hex day is three chances. That IS the decision the reach was
    // given a case against.
    const from = { q: 0, r: 0 };
    expect(crossed(from, { q: 1, r: 0 })).toHaveLength(1);
    expect(crossed(from, { q: 3, r: 0 })).toHaveLength(3);
    // And never the hex being left — the band is already floating there.
    for (const h of crossed(from, { q: 3, r: 0 })) expect(key(h)).not.toBe(key(from));
  });
});

describe('what it costs and what it teaches', () => {
  /**
   * A real crossing that ends on rocks: a coastal hex to row FROM, and a
   * neighbouring one with a skerry in it.
   *
   * An earlier cut of this probe rowed from a hex to itself and measured
   * zero strikes for both blind and charted — correctly, because standing
   * still crosses no water. The bar was wrong, not the rule.
   */
  function findCrossing(seed: string) {
    const state = newGame(seed);
    for (const k of Object.keys(state.world.tiles)) {
      const from = fromKey(k);
      if (!isCoastalWater(state, from)) continue;
      for (const to of neighbors(from)) {
        if (skerryAt(state, to)) return { seed, from, to };
      }
    }
    return null;
  }

  it('springs strakes on a blind crossing, and charts what it found', () => {
    const found = findCrossing('skerry-cost');
    if (!found) throw new Error('no reachable skerry in a whole world — the probe never ran');
    const { from, to } = found;
    let struck = 0;
    let charts = 0;
    for (let d = 0; d < 120; d++) {
      const state = newGame('skerry-cost');
      state.day = d + 1;
      const out = rowThrough(state, from, to);
      struck += out.struck.length;
      if (charted(state, to)) charts++;
    }
    // Rocks bite sometimes and are learnt EVERY time — passing clear teaches
    // as much as striking does, which is what makes a second voyage along a
    // coast different from the first.
    expect(struck).toBeGreaterThan(0);
    expect(charts).toBe(120);
  });

  it('is far kinder once the rocks are on the chart', () => {
    // The measurement the mechanic rests on: learning has to be worth the
    // strake it cost. Same rocks, same days, blind against charted.
    const found = findCrossing('skerry-learn');
    if (!found) throw new Error('no reachable skerry in a whole world');
    const { from, to } = found;
    let blind = 0;
    let known = 0;
    const DAYS = 400;
    for (let d = 0; d < DAYS; d++) {
      const a = newGame('skerry-learn');
      a.day = d + 1;
      blind += rowThrough(a, from, to).struck.length;

      const b = newGame('skerry-learn');
      b.day = d + 1;
      chart(b, to);
      known += rowThrough(b, from, to).struck.length;
    }
    console.log(`skerries over ${DAYS} crossings of the same rock:`);
    console.log(`  rowed blind   : ${blind} strakes (${(blind / DAYS * 100).toFixed(0)}%)`);
    console.log(`  rowed charted : ${known} strakes (${(known / DAYS * 100).toFixed(0)}%)`);
    expect(known).toBeLessThan(blind);
    expect(known / DAYS).toBeLessThan(STRIKE_BLIND);
    expect(blind / DAYS).toBeGreaterThan(STRIKE_CHARTED);
  });

  it('never sinks her: a hull can lose every strake and still be mended', () => {
    const found = findCrossing('skerry-floor');
    if (!found) throw new Error('no reachable skerry in a whole world');
    const { from, to } = found;
    const state = newGame('skerry-floor');
    for (let d = 0; d < 300; d++) {
      state.day = d + 1;
      for (const _ of rowThrough(state, from, to).struck) springStrake(state.ship);
    }
    // Short of sunk, on purpose — the rule the whole ship file is built on.
    expect(state.ship.strakes).toBeGreaterThanOrEqual(0);
    expect(state.ship.strakes).toBeLessThanOrEqual(SHIP_STRAKES);
  });
});

describe('the decision the rocks are FOR', () => {
  it('prices a fast row against a careful one', () => {
    // The knarr's three-hex day was free speed. This measures what it now
    // costs: the same coast, covered in long hops or short ones, counting
    // strakes lost and days spent. Neither number alone is the answer —
    // together they are the decision.
    let fastStrakes = 0;
    let fastDays = 0;
    let fastHexes = 0;
    let slowStrakes = 0;
    let slowDays = 0;
    let slowHexes = 0;
    let runs = 0;

    for (let s = 0; s < 40; s++) {
      const hops = voyage(`skerry-race:${s}`, 'far');
      const steps = voyage(`skerry-race:${s}`, 'near');
      if (!hops || !steps) continue;
      runs++;
      fastStrakes += hops.strakes;
      fastDays += hops.days;
      fastHexes += hops.hexes;
      slowStrakes += steps.strakes;
      slowDays += steps.days;
      slowHexes += steps.hexes;
    }

    // Days alone is the wrong yardstick and an earlier cut of this bar used
    // it: for the same number of CROSSINGS a long hop covers three times the
    // water, so it compared unequal journeys and read the fast route as
    // simply worse. Ground covered per day is the honest figure.
    const fastRate = fastHexes / fastDays;
    const slowRate = slowHexes / slowDays;
    console.log(`the coast, ${runs} voyages each way:`);
    console.log(`  long hops  : ${fastStrakes} strakes, ${fastHexes} hexes in ${fastDays} days (${fastRate.toFixed(2)}/day)`);
    console.log(`  short steps: ${slowStrakes} strakes, ${slowHexes} hexes in ${slowDays} days (${slowRate.toFixed(2)}/day)`);

    expect(runs).toBeGreaterThan(5);
    // Rowing hard has to cost something, or the reach is still free.
    expect(fastStrakes).toBeGreaterThan(slowStrakes);
    // And it has to BUY something, or nobody would ever take the risk: even
    // paying for the rocks it finds, the long hop covers more water a day.
    expect(fastRate).toBeGreaterThan(slowRate);
  });
});

/** Row a set number of crossings, taking the longest or shortest on offer. */
function voyage(seed: string, how: 'far' | 'near') {
  let state = newGame(seed);
  const startStrakes = state.ship.strakes;
  const startDay = state.day;
  let crossings = 0;
  let hexes = 0;
  for (let turn = 0; turn < 40 && crossings < 8; turn++) {
    if (state.event) {
      state = apply(state, state.event.outcome ? { type: 'DISMISS_EVENT' } : { type: 'CHOOSE', index: 0 });
      continue;
    }
    state.party.food = 300;
    state.party.firewood = 300;
    const afloat = isCoastalWater(state, state.party.at);
    const opts = moveOptions(state).filter((h) => canMove(state, h));
    if (opts.length === 0) break;
    // Head for water first, then work the coast the chosen way.
    const water = opts.filter((h) => isCoastalWater(state, h));
    const pool = afloat && water.length > 0 ? water : opts;
    const spanOf = (h: { q: number; r: number }) => distance(state.party.at, h);
    const pick = afloat
      ? [...pool].sort((a, b) => (how === 'far' ? spanOf(b) - spanOf(a) : spanOf(a) - spanOf(b)))[0]!
      : (water[0] ?? pool[0]!);
    const next = apply(state, { type: 'MOVE', to: pick });
    if (next === state || next.end) break;
    if (afloat) {
      crossings++;
      hexes += spanOf(pick);
    }
    state = next;
  }
  if (crossings < 4) return null;
  return { strakes: startStrakes - state.ship.strakes, days: state.day - startDay, hexes };
}
