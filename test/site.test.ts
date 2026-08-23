// 3.1: reading the ground, and taking it. The bar for this milestone is that
// choosing where to settle is a real decision, so the centre of this file is
// a measurement of whether the sites actually differ and actually trade off.

import { describe, it, expect } from 'vitest';
import { fromKey, key, type Hex } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { applyTravel } from '../src/sim/travel';
import { canGather } from '../src/sim/gathering';
import { assign, makePlots } from '../src/sim/colony';
import { stream } from '../src/rng';
import { YEAR_LENGTH } from '../src/sim/calendar';
import { eventChance } from '../src/sim/events';
import { passDay } from '../src/sim/upkeep';
import { layDownSaga } from '../src/sim/landnam';
import {
  atHome,
  canFound,
  foundBlocker,
  foundSettlement,
  nameFor,
  scoreWord,
  siteReport,
  strongestOf,
  verdictFor,
} from '../src/sim/site';
import { MEASURES, MEASURE_MAX, VERDICTS, WATER_FLOOR } from '../src/data/sites';
import type { GameState, SiteReport } from '../src/state/types';

type Measure = 'water' | 'soil' | 'timber' | 'harbour' | 'defence';
const KEYS: Measure[] = ['water', 'soil', 'timber', 'harbour', 'defence'];

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** A state with the fog lifted, so site reading is not gated by exploration. */
function surveyed(seed: string): GameState {
  const state = fresh(seed);
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  return state;
}

/** Every land hex of a world, read. */
function readAll(state: GameState): { at: Hex; report: SiteReport }[] {
  const out: { at: Hex; report: SiteReport }[] = [];
  for (const k of Object.keys(state.world.tiles)) {
    if (state.world.tiles[k]!.terrain === 'ocean') continue;
    const at = fromKey(k);
    out.push({ at, report: siteReport(state.world, at)! });
  }
  return out;
}

// --- Reading the ground ---

describe('reading a site', () => {
  it('every measure stays inside its band, and the total is their sum', () => {
    for (const seed of ['read-a', 'read-b', 'read-c']) {
      for (const { report } of readAll(fresh(seed))) {
        let sum = 0;
        for (const k of KEYS) {
          expect(report[k], k).toBeGreaterThanOrEqual(0);
          expect(report[k], k).toBeLessThanOrEqual(MEASURE_MAX);
          expect(Number.isInteger(report[k])).toBe(true);
          sum += report[k];
        }
        expect(report.total).toBe(sum);
      }
    }
  });

  it('reads the ground, not the party — the same hex always scores the same', () => {
    const state = surveyed('stable');
    const at = state.party.at;
    const first = siteReport(state.world, at)!;
    state.day = 60;
    state.party.food = 0;
    expect(siteReport(state.world, at)).toEqual(first);
  });

  it('a hex off the map has no reading at all', () => {
    const state = fresh('offmap');
    expect(siteReport(state.world, { q: 9999, r: -9999 })).toBeNull();
  });

  it('the sea is never a site, however good the surroundings', () => {
    const state = surveyed('sea');
    for (const k of Object.keys(state.world.tiles)) {
      if (state.world.tiles[k]!.terrain !== 'ocean') continue;
      expect(foundBlocker(state, fromKey(k))).toBe('sea');
    }
  });

  it('a river hex always has water, and dry open ground does not', () => {
    const state = surveyed('water');
    let sawRiver = false;
    let sawDry = false;
    for (const { at, report } of readAll(state)) {
      if (state.world.tiles[key(at)]!.river) {
        sawRiver = true;
        expect(report.water, `river at ${key(at)}`).toBeGreaterThanOrEqual(3);
      }
      if (report.water === 0) sawDry = true;
    }
    expect(sawRiver).toBe(true);
    // If nothing were ever dry, the water gate would not be a constraint.
    expect(sawDry).toBe(true);
  });

  it('the verdict bands cover every total and never go backwards', () => {
    for (let total = 0; total <= MEASURE_MAX * KEYS.length; total++) {
      expect(verdictFor(total)).toBeDefined();
    }
    for (let i = 1; i < VERDICTS.length; i++) {
      expect(VERDICTS[i]!.from).toBeGreaterThan(VERDICTS[i - 1]!.from);
    }
    expect(verdictFor(0).label).toBe(VERDICTS[0]!.label);
    expect(verdictFor(25).label).toBe(VERDICTS[VERDICTS.length - 1]!.label);
  });

  it('every score has a word for it', () => {
    for (let score = 0; score <= MEASURE_MAX; score++) {
      expect(scoreWord(score)).toBeTruthy();
    }
  });
});

// --- The milestone's bar ---

describe('choosing where to settle is a real decision', () => {
  const SEEDS = Array.from({ length: 10 }, (_, i) => `site-${i}`);

  function corpus(): SiteReport[] {
    return SEEDS.flatMap((seed) => readAll(fresh(seed)).map((r) => r.report));
  }

  function correlation(all: SiteReport[], a: Measure, b: Measure): number {
    const xs = all.map((r) => r[a]);
    const ys = all.map((r) => r[b]);
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      dx += (xs[i]! - mx) ** 2;
      dy += (ys[i]! - my) ** 2;
    }
    return num / Math.sqrt(dx * dy);
  }

  it('no site is good at everything', () => {
    const all = corpus();
    const excellent = all.filter((r) => KEYS.every((k) => r[k] >= 4));
    // eslint-disable-next-line no-console
    console.log(
      `sites read: ${all.length} | best total ${Math.max(...all.map((r) => r.total))}/25 | ` +
        `sites scoring 4+ on all five: ${excellent.length}`,
    );
    // If a hex existed that was rich in everything, the choice would collapse
    // into "walk until you find it" and there would be nothing to weigh.
    expect(excellent).toHaveLength(0);
  });

  it('soil and defensibility pull against each other', () => {
    const all = corpus();
    const soilDefence = correlation(all, 'soil', 'defence');
    const timberDefence = correlation(all, 'timber', 'defence');
    // eslint-disable-next-line no-console
    console.log(
      `corr soil/defence ${soilDefence.toFixed(2)} · timber/defence ${timberDefence.toFixed(2)}`,
    );
    // Good farmland is open ground and open ground cannot be held. This is
    // the trade-off the whole decision rests on, so it is asserted, not hoped.
    expect(soilDefence).toBeLessThan(-0.25);
    expect(timberDefence).toBeLessThan(-0.25);
  });

  it('the best site for one thing is rarely the best for another', () => {
    let agreements = 0;
    for (const seed of SEEDS) {
      const sites = readAll(fresh(seed));
      const bestAt = (m: Measure) =>
        sites.reduce((best, s) => (s.report[m] > best.report[m] ? s : best));
      const soilPick = key(bestAt('soil').at);
      const defencePick = key(bestAt('defence').at);
      if (soilPick === defencePick) agreements++;
    }
    // eslint-disable-next-line no-console
    console.log(`worlds where the best soil is also the best defence: ${agreements}/${SEEDS.length}`);
    expect(agreements).toBe(0);
  });

  it('sites are spread out enough to be worth comparing', () => {
    const totals = corpus()
      .map((r) => r.total)
      .sort((a, b) => a - b);
    const p50 = totals[Math.floor(totals.length * 0.5)]!;
    const p95 = totals[Math.floor(totals.length * 0.95)]!;
    // eslint-disable-next-line no-console
    console.log(`totals p50 ${p50} · p95 ${p95} · max ${totals[totals.length - 1]}`);
    // A map where every hex reads the same is a map with no decision on it.
    expect(p95 - p50).toBeGreaterThanOrEqual(3);
    expect(new Set(totals).size).toBeGreaterThan(6);
  });

  it('good ground is rare enough to be worth walking for, common enough to find', () => {
    let good = 0;
    let foundable = 0;
    let land = 0;
    for (const seed of SEEDS) {
      const state = surveyed(seed);
      for (const { at, report } of readAll(state)) {
        land++;
        if (!canFound(state, at)) continue;
        foundable++;
        if (verdictFor(report.total).label === 'Good ground') good++;
        if (verdictFor(report.total).label === 'Rich ground') good++;
      }
    }
    const goodShare = good / foundable;
    // eslint-disable-next-line no-console
    console.log(
      `land ${land} · foundable ${Math.round((foundable / land) * 100)}% · ` +
        `good-or-better ${(goodShare * 100).toFixed(1)}% of foundable`,
    );
    expect(foundable / land).toBeGreaterThan(0.25);
    expect(goodShare).toBeGreaterThan(0.01);
    expect(goodShare).toBeLessThan(0.25);
  });
});

// --- Taking the land ---

describe('the land-taking', () => {
  /** Walks the party onto the first foundable hex it can reach, or gives up. */
  function settleSomewhere(seed: string): GameState {
    const state = surveyed(seed);
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      state.party.at = at;
      if (canFound(state, at)) break;
    }
    expect(canFound(state, state.party.at), `${seed}: nowhere foundable`).toBe(true);
    expect(foundSettlement(state)).toBe(true);
    return state;
  }

  it('founding sets the posts, names the place, and writes it in saga voice', () => {
    const state = settleSomewhere('found-1');
    const home = state.settlement!;
    expect(home.at).toEqual(state.party.at);
    expect(home.foundedOn).toBe(state.day);
    expect(home.name.length).toBeGreaterThan(3);
    expect(home.report).toEqual(siteReport(state.world, state.party.at));
    expect(state.saga.some((e) => e.tone === 'saga' && e.text.includes(home.name))).toBe(true);
    expect(atHome(state)).toBe(true);
  });

  it('is one way: no second steading, no moving it, no unfounding', () => {
    const state = settleSomewhere('found-2');
    const first = structuredClone(state.settlement!);

    // Standing somewhere better changes nothing.
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      if (state.world.tiles[k]!.terrain === 'ocean') continue;
      state.party.at = at;
      expect(foundBlocker(state, at)).toBe('settled');
      expect(foundSettlement(state)).toBe(false);
    }
    expect(state.settlement).toEqual(first);

    // And the action layer refuses it too.
    state.party.at = first.at;
    expect(applyTravel(state, { type: 'FOUND' })).toBe(state);
  });

  it('refuses ground that cannot hold a steading, and says why', () => {
    const state = surveyed('refuse');
    const reasons = new Set<string>();
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      const blocker = foundBlocker(state, at);
      if (blocker) reasons.add(blocker);
    }
    // Open water and bare rock are always refused; dry ground is the one that
    // makes fresh water a constraint rather than a decoration.
    expect(reasons.has('sea')).toBe(true);
    expect(reasons.has('rock')).toBe(true);
    expect(reasons.has('dry')).toBe(true);
  });

  it('never offers ground the party has not stood on', () => {
    const state = fresh('unseen');
    let unseen = 0;
    for (const k of Object.keys(state.world.tiles)) {
      if (state.world.seen[k]) continue;
      unseen++;
      expect(foundBlocker(state, fromKey(k))).toBe('unknown');
    }
    expect(unseen).toBeGreaterThan(100);
  });

  it('the name says what the place is good for', () => {
    for (const seed of ['name-a', 'name-b', 'name-c']) {
      const state = settleSomewhere(seed);
      const report = state.settlement!.report;
      const again = nameFor(state, state.party.at, report);
      // Naming is seeded on the hex, so the same ground always earns the
      // same name — a saved run and a replayed one agree.
      expect(again).toBe(state.settlement!.name);
      expect(strongestOf(report)).toBeTruthy();
    }
  });

  it('a founded run round-trips through a save', () => {
    const state = settleSomewhere('save-home');
    expect(encode(state)).toBe(encode(structuredClone(state)));
    const round = JSON.parse(encode(state)) as GameState;
    expect(round.settlement).toEqual(state.settlement);
  });

  it('a v5 save comes forward still homeless', () => {
    const { save } = migrate({ version: 5, party: { people: [] } });
    expect(save['version']).toBe(SAVE_VERSION);
    expect(save['settlement']).toBeUndefined();
  });
});

// --- What the ground pays back ---

describe('home ground pays for itself', () => {
  /**
   * A party standing on wooded ground in the given world. Both arms of every
   * A/B below stand on the SAME hex, so the terrain contributes identically
   * and the settlement is the only difference.
   */
  function standing(seed: string): GameState {
    const state = surveyed(seed);
    const forest = Object.keys(state.world.tiles).find(
      (k) => state.world.tiles[k]!.terrain === 'forest',
    );
    expect(forest, `${seed}: no forest to stand in`).toBeTruthy();
    state.party.at = fromKey(forest!);
    return state;
  }

  /** The same party, with a settlement forced onto that hex. */
  function homed(seed: string, override: Partial<SiteReport>): GameState {
    const state = standing(seed);
    const base = siteReport(state.world, state.party.at)!;
    const report = { ...base, ...override };
    report.total = KEYS.reduce((sum, k) => sum + report[k], 0);
    state.settlement = {
      at: state.party.at,
      name: 'Testholt',
      foundedOn: 1,
      report,
      // Real ground, or no job that needs a field or a shore can be assigned.
      plots: makePlots(report, state.party.at, stream(seed, 'colony').derive('plots')),
      shelter: 0,
      watch: 0,
      built: [],
      queue: [],
      works: 0,
    children: [],
    };
    return state;
  }

  /**
   * Since 3.2 the site's payoff is paid through the steading's jobs, not
   * through foraging on your own doorstep — the party and the workforce are
   * the same six people, and paying both was paying twice.
   */
  it('rich soil feeds the steading and bare soil does not', () => {
    let rich = 0;
    let poor = 0;
    for (let i = 0; i < 20; i++) {
      const good = homed(`yield-${i}`, { soil: 5 });
      const bad = homed(`yield-${i}`, { soil: 0 });
      for (const person of good.party.people) {
        expect(assign(good, person.id, 'farmer')).toBe(true);
      }
      for (const person of bad.party.people) assign(bad, person.id, 'farmer');
      const before = good.party.food;
      passDay(good);
      passDay(bad);
      rich += good.party.food - before;
      poor += bad.party.food - before;
    }
    // eslint-disable-next-line no-console
    console.log(`twenty days farmed — rich soil ${rich} food gained, bare soil ${poor}`);
    expect(rich).toBeGreaterThan(poor);
  });

  it('the party cannot forage its own doorstep on top of the day\'s work', () => {
    const state = homed('double-pay', { soil: 5, timber: 5 });
    expect(canGather(state)).toBe(false);
    for (const action of [{ type: 'FORAGE' }, { type: 'HUNT' }, { type: 'FISH' }] as const) {
      expect(applyTravel(state, action), action.type).toBe(state);
    }
    // Resting at home still passes the day and still mends, but nobody is
    // assigned to cut, so the stack only goes down by the night's burn.
    const before = state.party.firewood;
    const rested = applyTravel(state, { type: 'CAMP' });
    expect(rested).not.toBe(state);
    expect(rested.party.firewood).toBeLessThan(before);
  });

  it('timber pays out in firewood, and a night at home mends more', () => {
    const woodedHome = homed('wood', { timber: 5 });
    const bareHome = homed('wood', { timber: 0 });
    for (const person of woodedHome.party.people) assign(woodedHome, person.id, 'woodcutter');
    for (const person of bareHome.party.people) assign(bareHome, person.id, 'woodcutter');
    const wooded = applyTravel(woodedHome, { type: 'CAMP' });
    const bare = applyTravel(bareHome, { type: 'CAMP' });
    expect(wooded.party.firewood).toBeGreaterThan(bare.party.firewood);

    // Same hex, same night — but one band has a roof of their own.
    const away = standing('mend');
    for (const p of away.party.people) p.health = 4;
    const home = homed('mend', {});
    for (const p of home.party.people) p.health = 4;
    const restedAway = applyTravel(away, { type: 'CAMP' });
    const restedHome = applyTravel(home, { type: 'CAMP' });
    const total = (s: GameState) => s.party.people.reduce((n, p) => n + p.health, 0);
    expect(total(restedHome)).toBeGreaterThan(total(restedAway));
  });

  it('a defensible site is a quieter one', () => {
    const safe = homed('quiet', { defence: 5 });
    const open = homed('quiet', { defence: 0 });
    expect(eventChance(safe)).toBeLessThan(eventChance(open));
    // Away from home, the site's defences do nothing for you.
    open.party.at = { q: open.party.at.q + 1, r: open.party.at.r };
    expect(eventChance(open)).toBe(eventChance({ ...open, settlement: undefined }));
  });

  it('the steading is named in the ending you choose by enduring', () => {
    const state = homed('ending', {});
    // Since 4.6 one winter is not an ending. A whole life on that coast is —
    // and since the landnám change that life is a RECKONING you answer, not
    // an ending that fires at you. The steading still has to be named in it.
    state.day = 4 * YEAR_LENGTH + 72;
    state.party.food = 9999;
    state.party.firewood = 9999;
    passDay(state);
    expect(state.end).toBeUndefined();
    // A card raised on the way there would block the deed; it is the day's
    // business, not this bar's.
    state.event = undefined;
    expect(layDownSaga(state)).toBe(true);
    expect(state.end?.cause).toBe('survived');
    expect(state.end!.title).toContain('Testholt');
    expect(state.end!.lines.some((l) => l.includes('Testholt'))).toBe(true);
  });

  it('every measure carries a meaning the player can read', () => {
    expect(MEASURES).toHaveLength(KEYS.length);
    for (const measure of MEASURES) {
      expect(KEYS).toContain(measure.id as Measure);
      expect(measure.meaning.length).toBeGreaterThan(20);
    }
    expect(WATER_FLOOR).toBeGreaterThan(0);
  });

  it('travel actions are still refused while a fight is on', () => {
    const state = fresh('blocked-found');
    state.modes = ['TRAVEL', 'BATTLE'];
    expect(apply(state, { type: 'FOUND' })).toBe(state);
  });
});
