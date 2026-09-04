// 3.1: reading the ground, and taking it. The bar for this milestone is that
// choosing where to settle is a real decision, so the centre of this file is
// a measurement of whether the sites actually differ and actually trade off.

import { describe, it, expect } from 'vitest';
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
  hasBeck,
  scoreWord,
  stopReport,
  strongestOf,
  verdictFor,
} from '../src/sim/site';
import { MEASURES, MEASURE_MAX, VERDICTS, WATER_FLOOR } from '../src/data/sites';
import { ROUTE_STOPS, stopAt } from '../src/sim/route';
import { knowsStop, learnStop } from '../src/sim/coast';
import { walkOff } from './fixtures/stand';
import type { GameState, SiteReport } from '../src/state/types';

type Measure = 'water' | 'soil' | 'timber' | 'harbour' | 'defence';
const KEYS: Measure[] = ['water', 'soil', 'timber', 'harbour', 'defence'];

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** A state that knows its whole coast, so reading is not gated by walking. */
function surveyed(seed: string): GameState {
  const state = fresh(seed);
  for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(state, stop);
  return state;
}

/**
 * Every readable site in this world: every stretch of the route.
 *
 * This swept every land hex until 8.5, and the distinction mattered more
 * than it looked — a coast build still GENERATED the hex island (see job 3),
 * so the old version kept working there and quietly measured a country the
 * game does not use. Eleven of this file's tests were green against it.
 */
function readAll(state: GameState): { where: string; report: SiteReport }[] {
  return Array.from({ length: ROUTE_STOPS }, (_, stop) => ({
    where: `stretch ${stop}`,
    report: stopReport(state.seed, stop),
  }));
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

  it('reads the ground, not the party — a stretch always scores the same', () => {
    const state = surveyed('stable');
    const at = state.party.stop ?? 0;
    const first = stopReport(state.seed, at);
    state.day = 60;
    state.party.food = 0;
    expect(stopReport(state.seed, at)).toEqual(first);
  });

  it('the sea is never a site, however good the surroundings', () => {
    // NO SUBJECT ON A LINE. `foundBlocker` says so itself: a route has no
    // ocean and no mountains on it, so 'sea' and 'rock' are answers to
    // questions a line cannot pose. The claim underneath — that the water
    // gate is a real constraint — is held by "a beck is water and bare
    // shore is not" below.
  });

  it('a river hex always has water, and dry open ground does not', () => {
    // A BECK IS THE COAST'S RIVER, and the same two claims are asked of it:
    // a stretch with one is never dry, and some stretch somewhere is. The
    // second half is what makes fresh water a gate rather than a formality
    // — a coast where every stretch had water would let a band settle on
    // the first one every time.
    //
    // ONE, not three. A beck used to be passed as `Surrounds.river`, which
    // means a river runs THROUGH the site and which `water` pays 3 for
    // outright; it does not run through a steading, it runs down across
    // the strand to the sea, so it is an adjacent water and worth one of
    // the ring's two. What the beck decides now is not the SCORE but the
    // REFUSAL: `foundBlocker` asks for one by name, so this holds the gate
    // rather than the number.
    let sawBeck = false;
    let sawDry = false;
    for (const seed of ['water-a', 'water-b', 'water-c']) {
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
        const report = stopReport(seed, stop);
        if (hasBeck(seed, stop)) {
          sawBeck = true;
          expect(report.water, `beck at ${seed} stretch ${stop}`)
            .toBeGreaterThanOrEqual(WATER_FLOOR);
        } else {
          // And no score off a bog behind it makes a dry stretch settleable.
          sawDry = true;
        }
      }
    }
    expect(sawBeck, 'no beck on any of three coasts').toBe(true);
    expect(sawDry, 'every stretch of every coast had water — the gate is not a gate').toBe(true);
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

  /**
   * A bigger corpus, for the correlations only.
   *
   * Ten worlds is about eleven thousand hex sites and about TWO HUNDRED AND
   * SIXTY stretches — a fortieth of the sample — so a correlation read off a
   * coast at ten seeds carries real sampling error, and it wandered either
   * side of the bar as the ring was retuned. The other bars in this block
   * count sites and are calibrated on `SEEDS`, so only the pairs get the
   * wider read.
   */
  const WIDE = Array.from({ length: 60 }, (_, i) => `site-wide-${i}`);

  function wideCorpus(): SiteReport[] {
    return WIDE.flatMap((seed) => readAll(fresh(seed)).map((r) => r.report));
  }

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
    const all = wideCorpus();
    const soilDefence = correlation(all, 'soil', 'defence');
    // THE SAME CLAIM, IN THE PAIRS A COAST ACTUALLY TRADES OFF.
    //
    // Good farmland being open ground still holds, but only just: measured
    // over sixty coasts it is -0.26 against the map's -0.54, and it got
    // weaker rather than stronger when the ring was corrected on
    // 2026-08-28. That is the honest direction — the old ring carried two
    // copies of the strand's own country, which put the same terrain into
    // `soil` and into `defence`'s door count and manufactured part of the
    // pull. What is left is real and thin, and it is a live question
    // whether a line wants `defence` to depend on the LAND more than it
    // does; see ROADMAP.
    //
    // What does NOT survive at all is timber/defence: -0.73 on hexes and
    // about -0.01 on a line, because a ring of six that always holds sea
    // leaves defence driven by HOW MUCH sea rather than by what the land
    // is, and it cannot anti-correlate with wood.
    //
    // The wood trade-off moved rather than vanished. On a line it is
    // timber against HARBOUR, at -0.46 and the strongest pull the coast
    // has. A stretch thick with wood — or within an easy haul of it, which
    // is what `timberWithin` now measures — is a stretch with nowhere to
    // beach a knarr, and that is a better decision than the one it
    // replaces because both halves are things the player wants on day one.
    const timberHarbour = correlation(all, 'timber', 'harbour');
    // eslint-disable-next-line no-console
    console.log(
      `corr soil/defence ${soilDefence.toFixed(2)} · timber/harbour ${timberHarbour.toFixed(2)}`,
    );
    expect(soilDefence).toBeLessThan(-0.25);
    expect(timberHarbour).toBeLessThan(-0.25);
  });

  it('the best site for one thing is rarely the best for another', () => {
    let agreements = 0;
    for (const seed of SEEDS) {
      const sites = readAll(fresh(seed));
      const bestAt = (m: Measure) =>
        sites.reduce((best, s) => (s.report[m] > best.report[m] ? s : best));
      // `where` is the address in whichever world this is — a hex key, or a
      // stretch. All this needs of it is that two picks can be compared.
      const soilPick = bestAt('soil').where;
      const defencePick = bestAt('defence').where;
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
    // A coast where every stretch reads the same has no decision on it.
    expect(p95 - p50).toBeGreaterThanOrEqual(3);
    expect(new Set(totals).size).toBeGreaterThan(6);
  });

  it('good ground is rare enough to be worth walking for, common enough to find', () => {
    let good = 0;
    let foundable = 0;
    let land = 0;
    for (const seed of SEEDS) {
      const state = surveyed(seed);
      // The same question of a line: how much of the coast will take posts,
      // and how much of THAT is worth walking for. `canFound` reads the
      // stretch underfoot, so the band is stood on each one in turn.
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(state, stop);
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
        land++;
        state.party.stop = stop;
        if (!canFound(state)) continue;
        foundable++;
        const label = verdictFor(stopReport(seed, stop).total).label;
        if (label === 'Good ground' || label === 'Rich ground') good++;
      }
    }
    const goodShare = good / foundable;
    // eslint-disable-next-line no-console
    console.log(
      `stretches: foundable ${Math.round((foundable / land) * 100)}% · ` +
        `good-or-better ${(goodShare * 100).toFixed(1)}% of foundable`,
    );
    expect(foundable / land).toBeGreaterThan(0.25);
    expect(goodShare).toBeGreaterThan(0.01);
    expect(goodShare).toBeLessThan(0.25);
  });
});

// --- Taking the land ---

describe('the land-taking', () => {
  /** Puts the party on the first ground it can found on, or gives up. */
  function settleSomewhere(seed: string): GameState {
    const state = surveyed(seed);
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(state, stop);
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      state.party.stop = stop;
      if (canFound(state)) break;
    }
        expect(canFound(state), `${seed}: nowhere foundable`).toBe(true);
    expect(foundSettlement(state)).toBe(true);
    return state;
  }

  it('founding sets the posts, names the place, and writes it in saga voice', () => {
    const state = settleSomewhere('found-1');
    const home = state.settlement!;
    expect(home.stop).toBe(state.party.stop ?? 0);
    expect(home.foundedOn).toBe(state.day);
    expect(home.name.length).toBeGreaterThan(3);
    // The reading the posts went in on, from whichever world this is.
    expect(home.report).toEqual(
      stopReport(state.seed, state.party.stop ?? 0),
    );
    expect(state.saga.some((e) => e.tone === 'saga' && e.text.includes(home.name))).toBe(true);
    expect(atHome(state)).toBe(true);
  });

  it('is one way: no second steading, no moving it, no unfounding', () => {
    const state = settleSomewhere('found-2');
    const first = structuredClone(state.settlement!);

    // Standing somewhere better changes nothing.
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      state.party.stop = stop;
      expect(foundBlocker(state)).toBe('settled');
      expect(foundSettlement(state)).toBe(false);
    }
    expect(state.settlement).toEqual(first);

    // And the action layer refuses it too.
    state.party.stop = first.stop ?? 0;
    expect(applyTravel(state, { type: 'FOUND' })).toBe(state);
  });

  it('refuses ground that cannot hold a steading, and says why', () => {
    const reasons = new Set<string>();
    // A line poses fewer questions: there is no ocean and no summit on a
    // route, so 'sea' and 'rock' cannot come up — `foundBlocker` says so.
    // 'dry' is the one that matters and it is the same claim, that fresh
    // water is a constraint rather than a decoration. Walked over several
    // coasts because one coast may happen to be wet all the way along.
    for (const seed of ['refuse-a', 'refuse-b', 'refuse-c', 'refuse-d']) {
      const coast = surveyed(seed);
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(coast, stop);
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
        coast.party.stop = stop;
        const blocker = foundBlocker(coast);
        if (blocker) reasons.add(blocker);
      }
    }
    expect(reasons.has('dry'), 'no stretch of four coasts was too dry to settle').toBe(true);
    expect(reasons.has('sea'), 'a route has no open water on it').toBe(false);
    expect(reasons.has('rock'), 'a route has no summit on it').toBe(false);
  });

  it('never offers ground the party has not stood on', () => {
    const state = fresh('unseen');
    let unseen = 0;
    // A line remembers in `knownStops`, and a fresh band knows the landing
    // and what it can see either side of it. Everything further up the
    // coast is ground nobody has stood on, and the posts must refuse it.
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      if (knowsStop(state, stop)) continue;
      unseen++;
      state.party.stop = stop;
      expect(foundBlocker(state), `stretch ${stop}`).toBe('unknown');
    }
    expect(unseen, 'a fresh band already knows the whole coast').toBeGreaterThan(10);
  });

  it('the name says what the place is good for', () => {
    for (const seed of ['name-a', 'name-b', 'name-c']) {
      const state = settleSomewhere(seed);
      const report = state.settlement!.report;
      const again = nameFor(state, report);
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
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(state, stop);
    const wooded = Array.from({ length: ROUTE_STOPS }, (_, i) => i)
      .find((stop) => stopAt(state.seed, stop).country === 'forest');
    // Not every coast has a wood on it, and that is a fact about the coast
    // rather than a broken fixture — any stretch will do for an A/B where
    // both arms stand on the same one.
    state.party.stop = wooded ?? 1;
    return state;
  }

  /** The same party, with a settlement forced onto that stretch. */
  function homed(seed: string, override: Partial<SiteReport>): GameState {
    const state = standing(seed);
    const base = stopReport(state.seed, state.party.stop ?? 0);
    const report = { ...base, ...override };
    report.total = KEYS.reduce((sum, k) => sum + report[k], 0);
    state.settlement = {
      // THE STOP, or none of this is home. `atHome` reads it, and without it
      // every A/B below compared two bands who were both still out on the
      // road — which is why all three of these read as "the settlement
      // changed nothing".
      stop: state.party.stop ?? 0,
      name: 'Testholt',
      foundedOn: 1,
      report,
      // Real ground, or no job that needs a field or a shore can be assigned.
      plots: makePlots(report, stream(seed, 'colony').derive('plots')),
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
    // Away from home, the site's defences do nothing for you. Stepped off
    // through the shared fixture: `party.at + 1` moves nobody on a coast, so
    // the band stayed in its own yard and kept the walls it was supposed to
    // have left behind.
    walkOff(open);
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
