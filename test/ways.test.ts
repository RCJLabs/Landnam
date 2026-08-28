// The one mark the band leaves on the country.
//
// Everything else in this game happens TO the band. The map was a fixed
// thing to be walked over, identically, on the four hundredth day as on the
// first. A made way is the exception: slow, permanent, and worth exactly as
// much as the journeys you take again.
//
// These bars hold what makes it a decision rather than a button: that it
// refuses ground where it would pay nothing, that it costs real days up
// front, that the saving is real afterwards, and that it outlives the day it
// was dug.

import { describe, expect, it } from 'vitest';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { ROUTE_STOPS } from '../src/sim/route';
import { learnStop } from '../src/sim/coast';
import { newGame } from '../src/state/create';
import { fromKey, key } from '../src/hex';
import { terrainDef } from '../src/data/terrain';
import { applyTravel } from '../src/sim/travel';
import { daysForMove, moveEffort } from '../src/sim/road';
import {
  WAY_EFFORT,
  breakGround,
  canMakeWay,
  madeWay,
  wayBlocker,
  wayDays,
} from '../src/sim/ways';
import type { GameState, Terrain } from '../src/state/types';
import { canMove, moveOptions } from '../src/sim/road';
import { neighbors, distance } from '../src/hex';
import { WAY_REACH } from '../src/sim/ways';
import { RETIRED_WITH_THE_HEXES } from './fixtures/hexOnly';

/** A run of walkable hexes stepping away from the band, for road bars. */
function chainFrom(state: GameState, want: number) {
  const chain = [state.party.at];
  while (chain.length < want) {
    const last = chain[chain.length - 1]!;
    const next = neighbors(last).find((h) => {
      const tile = state.world.tiles[key(h)];
      return tile !== undefined && tile.terrain !== 'ocean'
        && !chain.some((c) => key(c) === key(h));
    });
    if (!next) break;
    chain.push(next);
  }
  return chain;
}

/** Put the band on the first hex of this terrain, fed and warm. */
function stand(seed: string, terrain: Terrain): GameState | null {
  const state = newGame(seed);
  for (const k of Object.keys(state.world.tiles)) {
    if (state.world.tiles[k]!.terrain !== terrain) continue;
    state.party.at = fromKey(k);
    state.world.seen[k] = 'visible';
    state.party.food = 400;
    state.party.firewood = 400;
    return state;
  }
  return null;
}

describe('the verb is withdrawn on a line, and withdrawn completely', () => {
  /**
   * The other half of the three skips above, and the more useful half.
   *
   * `MAKE_WAY` was still being OFFERED on a coast when 8.5 went looking: it
   * appeared exactly once a saga, cost a day, marked a hex nobody was
   * standing on, and could never appear again — a day spent on nothing, which
   * `sim/ways.ts`'s own header says a way must never be. Withdrawing it is
   * the fix; this is what stops it creeping back half-converted, and it is a
   * stronger claim than the three it replaces because it asks the question of
   * EVERY stretch rather than of one hex of forest.
   *
   * A made way would suit a coast — "the journey you take again" is exactly
   * what a leg walked out and back is. What stopped it being written is a
   * real tension recorded in ROADMAP.md: `route.daysBetween` is pure and a
   * made way is history, so discounting the walk leaves the chart, the road
   * and the strip all drawing the raw leg while the price disagrees. When
   * that is decided, this test is where the decision lands.
   */
  it('refuses every stretch, and spends nothing doing it', () => {
    if (!COAST_IS_A_LINE) return;
    const state = newGame('ways-withdrawn');
    state.party.food = 400;
    state.party.firewood = 400;
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      learnStop(state, stop);
      state.party.stop = stop;
      expect(wayBlocker(state, state.party.at), `stretch ${stop}`).toBe('coast');
      expect(canMakeWay(state, state.party.at), `stretch ${stop}`).toBe(false);
    }
    // And the verb costs nothing when it is refused — the bug was a DAY.
    state.party.stop = 3;
    const before = state.day;
    expect(applyTravel(state, { type: 'MAKE_WAY' })).toBe(state);
    expect(state.day, 'a withdrawn verb still took a day').toBe(before);
  });
});

describe('what may be broken', () => {
  it('allows easy ground, because a chain that jumps a meadow is not a road', () => {
    // NO SUBJECT ON A LINE. `MAKE_WAY` is withdrawn on a coast — see
    // `wayBlocker`, which answers 'coast' everywhere — so this measures a
    // mechanic that is not offered. It is not skipped silently: the
    // withdrawal itself is held below, positively, by "the verb is withdrawn
    // on a line, and withdrawn completely".
    if (COAST_IS_A_LINE) return;
    // An earlier cut refused this on the grounds that a lone meadow way pays
    // nothing. True of a lone hex, wrong about the mechanic.
    for (const easy of ['meadow', 'shore', 'valley'] as Terrain[]) {
      const state = stand('ways-easy', easy);
      if (!state) continue;
      expect(canMakeWay(state, state.party.at)).toBe(true);
    }
  });

  it('will not break the same ground twice, or open water', () => {
    // NO SUBJECT ON A LINE. `MAKE_WAY` is withdrawn on a coast — see
    // `wayBlocker`, which answers 'coast' everywhere — so this measures a
    // mechanic that is not offered. It is not skipped silently: the
    // withdrawal itself is held below, positively, by "the verb is withdrawn
    // on a line, and withdrawn completely".
    if (COAST_IS_A_LINE) return;
    const state = stand('ways-twice', 'forest');
    if (!state) throw new Error('no forest in a whole world');
    expect(canMakeWay(state, state.party.at)).toBe(true);
    breakGround(state, state.party.at);
    expect(wayBlocker(state, state.party.at)).toBe('made');

    for (const k of Object.keys(state.world.tiles)) {
      if (state.world.tiles[k]!.terrain !== 'ocean') continue;
      expect(wayBlocker(state, fromKey(k))).toBe('sea');
      return;
    }
  });
});

describe('what it costs and what it buys', () => {
  it('charges the ground its own price in days', () => {
    for (const t of ['forest', 'hills', 'bog', 'mountains'] as Terrain[]) {
      const state = stand(`ways-cost:${t}`, t);
      if (!state) continue;
      expect(wayDays(state, state.party.at)).toBe(Math.round(terrainDef(t).cost));
    }
  });

  it('carries a day two hexes along a chain, which is the whole point', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    // The measurement that killed the first design: a way was to buy one
    // point of effort, and a day is ceil(effort/2), so on forest and hills
    // — the commonest hard ground — it cost two days and saved NOTHING per
    // crossing. Ground covered is the answer, exactly as it was for rowing.
    const state = stand('ways-chain', 'forest');
    if (!state) throw new Error('no forest in a whole world');
    const from = state.party.at;
    const mid = neighbors(from)[0]!;
    const far = neighbors(mid).find((h) => distance(h, from) === 2
      && state.world.tiles[key(h)] !== undefined
      && state.world.tiles[key(h)]!.terrain !== 'ocean');
    if (!far) throw new Error('no two-hex line of land — the bar never ran');

    // Before: two hexes is two days, and the far one is not on offer at all.
    expect(canMove(state, far)).toBe(false);

    for (const h of [from, mid, far]) breakGround(state, h);
    // After: one day covers both, and the map offers it.
    expect(canMove(state, far)).toBe(true);
    expect(moveOptions(state).map(key)).toContain(key(far));
    expect(daysForMove(state, far)!).toBe(1);
  });

  it('makes hard ground walk like a meadow, ever after', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    const state = stand('ways-buy', 'bog');
    if (!state) throw new Error('no bog in a whole world');
    const at = state.party.at;
    const before = moveEffort(state, at);
    breakGround(state, at);
    const after = moveEffort(state, at);
    expect(after).toBeLessThan(before!);
    expect(after).toBe(WAY_EFFORT);
    // And it is the DAY count that the player actually feels.
    expect(daysForMove(state, at)!).toBeLessThanOrEqual(1);
  });

  it('pays back after a countable number of journeys', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    // The decision, priced as the player actually meets it: a ROAD of some
    // length, cut once, walked again and again.
    const rows: string[] = [];
    for (const t of ['forest', 'hills', 'bog'] as Terrain[]) {
      const state = stand(`ways-payback:${t}`, t);
      if (!state) continue;
      const chain = chainFrom(state, 4);
      if (chain.length < 4) continue;

      // What the journey costs before any of it is dug.
      let before = 0;
      for (let i = 1; i < chain.length; i++) {
        const step = { ...state, party: { ...state.party, at: chain[i - 1]! } } as GameState;
        before += daysForMove(step, chain[i]!) ?? 0;
      }

      let cost = 0;
      for (const h of chain) {
        cost += wayDays(state, h);
        breakGround(state, h);
      }

      // And after: two hexes a day along the whole length.
      let after = 0;
      for (let i = 0; i < chain.length - 1; i += WAY_REACH) {
        const to = chain[Math.min(i + WAY_REACH, chain.length - 1)]!;
        const step = { ...state, party: { ...state.party, at: chain[i]! } } as GameState;
        after += daysForMove(step, to) ?? 0;
      }

      const saved = before - after;
      // The chain follows whatever ground lies that way, so `t` is where it
      // STARTS, not what it is all made of — labelled honestly.
      rows.push(
        saved > 0
          ? `road of ${chain.length} from ${t}: ${cost} days to cut, ${before} -> ${after} days to walk `
            + `(${saved} saved) — pays back on journey ${Math.ceil(cost / saved)}`
          : `road of ${chain.length} from ${t}: ${cost} days to cut, saves NOTHING`,
      );
    }
    for (const r of rows) console.log(`  ${r}`);
    expect(rows.length).toBeGreaterThan(1);
    // Every road measured must actually save something, or the verb is a
    // button that costs days and does nothing.
    for (const r of rows) expect(r).not.toContain('NOTHING');
  });
});

describe('the ground stays broken', () => {
  it('survives the day it was dug and everything after', () => {
    // NO SUBJECT ON A LINE. `MAKE_WAY` is withdrawn on a coast — see
    // `wayBlocker`, which answers 'coast' everywhere — so this measures a
    // mechanic that is not offered. It is not skipped silently: the
    // withdrawal itself is held below, positively, by "the verb is withdrawn
    // on a line, and withdrawn completely".
    if (COAST_IS_A_LINE) return;
    const state = stand('ways-last', 'forest');
    if (!state) throw new Error('no forest in a whole world');
    const at = state.party.at;
    const next = applyTravel(state, { type: 'MAKE_WAY' });
    expect(next).not.toBe(state);
    expect(madeWay(next, at)).toBe(true);
    // Days were actually spent: this is not a free button.
    expect(next.day).toBeGreaterThan(state.day);
    // And it is in the save, because the player wrote it and nothing can
    // derive it back.
    expect(next.world.made?.[key(at)]).toBeDefined();
  });

  it('refuses the verb where it is blocked, spending nothing', () => {
    // Retires with the hexes — see test/fixtures/hexOnly.ts.
    if (RETIRED_WITH_THE_HEXES) return;
    // Ground already broken: the day must not be taken twice for the same
    // work. (Easy ground is no longer a refusal — see the chain bar above.)
    const state = stand('ways-refuse', 'forest');
    if (!state) throw new Error('no forest in a whole world');
    breakGround(state, state.party.at);
    const before = state.day;
    const next = applyTravel(state, { type: 'MAKE_WAY' });
    expect(next).toBe(state);
    expect(state.day).toBe(before);
  });
});
