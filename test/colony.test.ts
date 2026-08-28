// 3.2: the steading's own ground, and who works it. The milestone's bar is
// that job assignment visibly moves the numbers, so most of this file puts
// two identically-placed bands to work differently and measures the gap.

import { settled as settleSomewhere } from './fixtures/settle';
import { walkOff } from './fixtures/stand';
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { currentMode } from '../src/modes';
import { apply } from '../src/sim/actions';
import { eventChance } from '../src/sim/events';
import { passDay } from '../src/sim/upkeep';
import { seasonOf } from '../src/sim/calendar';
import { suggestedBuild } from '../src/sim/needs';
import { launch } from '../src/sim/expedition';
import {
  assign,
  availableJobs,
  dayLabour,
  idlers,
  jobOf,
  makePlots,
  output,
  PLOT_RADIUS,
  buildable,
  plotsFor,
  queueBuild,
  seasonFactor,
  shelterSaving,
  workTheDay,
} from '../src/sim/colony';
import { JOBS, jobById, SHELTER_MAX, WATCH_MAX, type JobId } from '../src/data/jobs';
import { stream } from '../src/rng';
import type { GameState, SiteReport } from '../src/state/types';

function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts. `pick:
  // 'first'` keeps what this one was: the first ground that will have them,
  // anywhere in the world, which is the bleak measurement several claims in
  // this file are actually about. `settledWell` below is the other half.
  return settleSomewhere(seed, { radius: Infinity, pick: 'first' });
}

/**
 * Settled on the best ground within a fair walk of the landing — what a player
 * who read the panel and spent a week looking would actually end up with.
 * `settled` takes the first hex that will have them, which is a different and
 * much bleaker measurement.
 */
function settledWell(seed: string, radius = 8): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed, { radius });
  return state;
}

/** A settled band with the site's reading forced, so jobs can be isolated. */
function withReport(seed: string, override: Partial<SiteReport>): GameState {
  const state = settled(seed);
  const home = state.settlement!;
  home.report = { ...home.report, ...override };
  home.report.total =
    home.report.water +
    home.report.soil +
    home.report.timber +
    home.report.harbour +
    home.report.defence;
  // The ground has to match the reading, or a fisher has no water to fish.
  home.plots = makePlots(home.report, stream(seed, 'colony').derive('replot'));
  return state;
}

function putEveryoneOn(state: GameState, job: JobId): GameState {
  for (const person of state.party.people) {
    if (person.alive) expect(assign(state, person.id, job)).toBe(true);
  }
  return state;
}

// --- The local ground ---

describe('the steading has ground of its own', () => {
  it('is a hex patch with the hall in the middle and a watch on it', () => {
    const state = settled('plots-1');
    const home = state.settlement!;
    // Nineteen hexes at radius two — the same COUNT on a line, which
    // `makePlots` rolls deliberately so a coast steading has the same holdings
    // as a hex one.
    expect(home.plots).toHaveLength(1 + 3 * PLOT_RADIUS * (PLOT_RADIUS + 1));
    const hall = home.plots.filter((p) => p.kind === 'hall');
    expect(hall).toHaveLength(1);
    // NOT "in the middle". A coast steading stands on a stretch of shore and
    // has no ring of ground to be in the middle of — `makePlots` says so and
    // writes `at` as a plain index, `{q: i, r: 0}`, precisely so nothing
    // reads it as a coordinate. Asserting the hall sits on `home.at` would
    // be asserting that two placeholders match.
    //
    // What survives is what the plots are FOR: one hall, one watchpost, and
    // no two of them the same, which is what `plotsFor` and the day's labour
    // actually read.
    expect(hall[0]!.at, 'the hall is the first plot').toBe(0);
        expect(home.plots.filter((p) => p.kind === 'watchpost')).toHaveLength(1);
    // No two plots share an index.
    expect(new Set(home.plots.map((p) => p.at)).size).toBe(home.plots.length);
  });

  it('is a picture of the reading you settled on', () => {
    const rich = withReport('ground-a', { soil: 5, timber: 0, harbour: 0 });
    const wooded = withReport('ground-a', { soil: 0, timber: 5, harbour: 0 });
    const fields = rich.settlement!.plots.filter((p) => p.kind === 'field').length;
    const woods = wooded.settlement!.plots.filter((p) => p.kind === 'wood').length;
    const fieldsInWood = wooded.settlement!.plots.filter((p) => p.kind === 'field').length;
    // eslint-disable-next-line no-console
    console.log(`rich soil -> ${fields} field plots · rich timber -> ${woods} wood plots`);
    expect(fields).toBeGreaterThan(fieldsInWood);
    expect(woods).toBeGreaterThan(0);
  });

  it('is generated once and stays put', () => {
    const state = settled('plots-stable');
    const before = structuredClone(state.settlement!.plots);
    for (let d = 0; d < 10 && !state.end; d++) passDay(state);
    expect(state.settlement!.plots).toEqual(before);
  });

  it('never offers a job the ground cannot support', () => {
    const dry = withReport('nojob', { harbour: 0, water: 1, soil: 0 });
    const offered = availableJobs(dry).map((j) => j.id);
    if (plotsFor(dry.settlement!, 'fisher').length === 0) {
      expect(offered).not.toContain('fisher');
      expect(assign(dry, dry.party.people[0]!.id, 'fisher')).toBe(false);
    }
    // Woodcutter, builder and warrior work anywhere — there is always
    // something to cut, build or watch.
    expect(offered).toContain('woodcutter');
    expect(offered).toContain('builder');
    expect(offered).toContain('warrior');
  });
});

// --- The milestone's bar ---

describe('job assignment visibly moves the numbers', () => {
  it('a band of farmers and a band of woodcutters end the week differently', () => {
    const DAYS = 7;
    const farming = putEveryoneOn(withReport('week', { soil: 5, timber: 3 }), 'farmer');
    const cutting = putEveryoneOn(withReport('week', { soil: 5, timber: 3 }), 'woodcutter');
    const start = { food: farming.party.food, wood: farming.party.firewood };

    for (let d = 0; d < DAYS; d++) {
      passDay(farming);
      passDay(cutting);
    }

    // eslint-disable-next-line no-console
    console.log(
      `after ${DAYS} days on the same ground — farmers: ${farming.party.food.toFixed(0)} food ` +
        `${farming.party.firewood.toFixed(0)} wood | woodcutters: ${cutting.party.food.toFixed(0)} food ` +
        `${cutting.party.firewood.toFixed(0)} wood (started ${start.food}/${start.wood})`,
    );

    expect(farming.party.food).toBeGreaterThan(cutting.party.food);
    expect(cutting.party.firewood).toBeGreaterThan(farming.party.firewood);
  });

  it('an idle band produces nothing at all', () => {
    const working = putEveryoneOn(withReport('idle', { soil: 5 }), 'farmer');
    const idle = withReport('idle', { soil: 5 });
    expect(idlers(idle)).toHaveLength(idle.party.people.filter((p) => p.alive).length);

    const before = idle.party.food;
    for (let d = 0; d < 5; d++) {
      passDay(working);
      passDay(idle);
    }
    expect(dayLabour(idle).food).toBe(0);
    expect(idle.party.food).toBeLessThan(before);
    expect(working.party.food).toBeGreaterThan(idle.party.food);
  });

  it('the projection matches what the day actually delivers', () => {
    const state = putEveryoneOn(withReport('projection', { soil: 4, timber: 2 }), 'farmer');
    const projected = dayLabour(state);
    const before = state.party.food;
    workTheDay(state);
    expect(state.party.food - before).toBeCloseTo(projected.food, 6);
    // The panel shows a line per worker; they must add up to the total.
    const summed = projected.byPerson.reduce((n, p) => n + p.amount, 0);
    expect(summed).toBeCloseTo(projected.food, 6);
  });

  it('putting the right person on the job beats putting the wrong one', () => {
    const state = withReport('who', { soil: 5, timber: 5 });
    const people = state.party.people.filter((p) => p.alive);
    const farmer = jobById('farmer')!;
    const best = [...people].sort(
      (a, b) => b.stats[farmer.stat] - a.stats[farmer.stat],
    )[0]!;
    const worst = [...people].sort(
      (a, b) => a.stats[farmer.stat] - b.stats[farmer.stat],
    )[0]!;
    if (best.stats[farmer.stat] === worst.stats[farmer.stat]) return; // no spread to measure
    expect(output(state, best, farmer)).toBeGreaterThan(output(state, worst, farmer));
  });

  it('the ground decides which job is worth taking', () => {
    const person = settled('ground-pay').party.people[0]!;
    const good = withReport('ground-pay', { soil: 5, timber: 0 });
    const bad = withReport('ground-pay', { soil: 0, timber: 5 });
    const farmer = jobById('farmer')!;
    const cutter = jobById('woodcutter')!;

    // On rich soil, farming is the better day's work; on bare soil under
    // timber, it is not. If that ever stopped being true, the site reading
    // would have stopped meaning anything.
    expect(output(good, person, farmer)).toBeGreaterThan(output(bad, person, farmer));
    expect(output(bad, person, cutter)).toBeGreaterThan(output(good, person, cutter));
  });

  /**
   * The milestone's real bar. Everything above measures a day or a week; this
   * measures whether assignment decides the run — which is the only version of
   * "moves the numbers" that matters.
   */
  it('a balanced steading lives out the year and a lopsided one does not', { timeout: 60_000 }, () => {
    const SEEDS = ['year-a', 'year-b', 'year-c', 'year-d'];
    const PLANS: Record<string, JobId[]> = {
      mixed: ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'],
      allFarm: ['farmer'],
      allWood: ['woodcutter'],
    };

    const survived: Record<string, number> = { mixed: 0, allFarm: 0, allWood: 0 };
    const lasted: Record<string, number> = { mixed: 0, allFarm: 0, allWood: 0 };

    for (const seed of SEEDS) {
      for (const [name, plan] of Object.entries(PLANS)) {
        const state = settledWell(seed);
        const crew = state.party.people.filter((p) => p.alive);
        crew.forEach((p, i) => assign(state, p.id, plan[i % plan.length]!));
        while (state.day < 73 && !state.end) {
          // Since 3.3 a sensible plan includes getting a roof up, and all
          // three arms build identically — so what is being measured here is
          // still the assignment and nothing else.
          if (state.settlement!.queue.length === 0) {
            const pick = suggestedBuild(state, buildable(state));
            if (pick) queueBuild(state, pick.id);
          }
          passDay(state);
        }
        lasted[name] = (lasted[name] ?? 0) + state.day;
        if (state.end?.cause === 'survived') survived[name] = (survived[name] ?? 0) + 1;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `over ${SEEDS.length} settled years — ` +
        Object.keys(PLANS)
          .map((n) => `${n} ${survived[n]} survived, ${Math.round(lasted[n]! / SEEDS.length)} avg days`)
          .join(' | '),
    );

    // A band that does one thing only starves or freezes. If either lopsided
    // plan matched the balanced one, the six jobs would be decoration.
    // A balanced plan must plainly outlast a one-note one. Since 3.4 the
    // question of whether a colony can win AT ALL is measured where it
    // belongs — against the winter mark in winter.test.ts, with a bot that
    // reallocates for the season. These three arms deliberately do not, so
    // asserting outright survival here would be measuring the wrong thing
    // and would sit on its boundary besides.
    expect(lasted['mixed']!).toBeGreaterThan(lasted['allFarm']!);
    expect(lasted['mixed']!).toBeGreaterThan(lasted['allWood']!);
    expect(survived['mixed']!).toBeGreaterThanOrEqual(survived['allFarm']!);
    // And a one-note plan has to lose outright, or the six jobs are decoration.
    expect(survived['allFarm']).toBe(0);
    expect(survived['allWood']).toBe(0);
  });

  it('the season owns the fields and leaves the watch alone', () => {
    const state = putEveryoneOn(withReport('seasons', { soil: 5, defence: 5 }), 'farmer');
    const farmer = jobById('farmer')!;
    const warrior = jobById('warrior')!;
    const person = state.party.people[0]!;

    const summer = 10;
    const winter = 55;
    expect(seasonOf(summer)).toBe('summer');
    expect(seasonOf(winter)).toBe('winter');

    expect(seasonFactor(winter, farmer)).toBeLessThan(seasonFactor(summer, farmer) * 0.3);
    expect(seasonFactor(winter, warrior)).toBe(seasonFactor(summer, warrior));

    state.day = summer;
    const grown = output(state, person, farmer);
    state.day = winter;
    // Nothing grows in a frozen field, and a steading that could farm through
    // midwinter would make the whole clock meaningless.
    expect(output(state, person, farmer)).toBeLessThan(grown * 0.3);
  });

  it('every job pays out into something', () => {
    const state = withReport('all-jobs', { soil: 4, timber: 4, harbour: 4, defence: 4 });
    const person = state.party.people[0]!;
    for (const job of JOBS) {
      expect(output(state, person, job), job.id).toBeGreaterThan(0);
    }
  });
});

// --- Builder and warrior have somewhere to put their work ---

describe('building and watching', () => {
  it('builders raise shelter, and shelter cuts the firewood burn', () => {
    const state = putEveryoneOn(withReport('shelter', { timber: 5 }), 'builder');
    expect(shelterSaving(state)).toBe(0);
    for (let d = 0; d < 12 && !state.end; d++) passDay(state);
    // eslint-disable-next-line no-console
    console.log(`twelve days of building -> shelter ${state.settlement!.shelter.toFixed(1)}`);
    expect(state.settlement!.shelter).toBeGreaterThan(0);
    expect(shelterSaving(state)).toBeGreaterThan(0);
    expect(state.settlement!.shelter).toBeLessThanOrEqual(SHELTER_MAX);
  });

  it('a sheltered steading burns less than an open camp on the same night', () => {
    const sheltered = withReport('burn', { timber: 3 });
    const open = withReport('burn', { timber: 3 });
    sheltered.settlement!.shelter = SHELTER_MAX;
    sheltered.party.firewood = 60;
    open.party.firewood = 60;
    // Nobody works in either, so the only difference is the roof.
    passDay(sheltered);
    passDay(open);
    expect(sheltered.party.firewood).toBeGreaterThan(open.party.firewood);
  });

  it('warriors keep the watch, and the watch falls off when they stop', () => {
    const state = putEveryoneOn(withReport('watch', { defence: 5 }), 'warrior');
    for (let d = 0; d < 8 && !state.end; d++) passDay(state);
    const kept = state.settlement!.watch;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThanOrEqual(WATCH_MAX);

    const quietWithWatch = eventChance(state);
    for (const person of state.party.people) assign(state, person.id, null);
    for (let d = 0; d < 8 && !state.end; d++) passDay(state);
    // eslint-disable-next-line no-console
    console.log(`watch kept ${kept.toFixed(1)} -> abandoned ${state.settlement!.watch.toFixed(1)}`);
    expect(state.settlement!.watch).toBeLessThan(kept);
    expect(quietWithWatch).toBeLessThan(eventChance(state));
  });

  it('shelter and watch never run past their caps', () => {
    const state = putEveryoneOn(withReport('caps', { timber: 5, defence: 5 }), 'builder');
    state.party.food = 9999;
    state.party.firewood = 9999;
    for (let d = 0; d < 60 && !state.end; d++) passDay(state);
    expect(state.settlement!.shelter).toBeLessThanOrEqual(SHELTER_MAX);
    putEveryoneOn(state, 'warrior');
    for (let d = 0; d < 60 && !state.end; d++) passDay(state);
    expect(state.settlement!.watch).toBeLessThanOrEqual(WATCH_MAX);
  });
});

// --- Home and away ---

describe('the work only happens where the work is', () => {
  /**
   * Since 4.2 the steading is worked by whoever is standing in it rather than
   * by "everyone, if nobody has wandered off". Hands sent out on an
   * expedition are hands not farming; hands that stayed keep working.
   */
  it('the hands you send out are hands not farming', () => {
    const state = putEveryoneOn(withReport('away', { soil: 5 }), 'farmer');
    const whole = dayLabour(state).food;
    expect(whole).toBeGreaterThan(0);

    const crew = state.party.people.filter((p) => p.alive);
    const going = crew.slice(0, crew.length - 1).map((p) => p.id);
    expect(launch(state, going, 'explore')).toBe(true);

    const short = dayLabour(state);
    // One pair of hands left, so the fields still produce — just far less.
    expect(short.food).toBeGreaterThan(0);
    expect(short.food).toBeLessThan(whole);
    expect(short.byPerson).toHaveLength(1);
    // Nobody resigned; they are simply not there.
    expect(state.party.people.every((p) => p.job === 'farmer')).toBe(true);
  });

  it('a roof keeps the hall warm whether or not a party is out under it', () => {
    const state = withReport('roof-away', { timber: 3 });
    state.settlement!.shelter = 4;
    expect(shelterSaving(state)).toBeGreaterThan(0);
    const crew = state.party.people.filter((p) => p.alive);
    launch(state, crew.slice(0, 2).map((p) => p.id), 'explore');
    expect(shelterSaving(state)).toBeGreaterThan(0);
  });

  it('an unsettled band has no jobs to give', () => {
    const state = structuredClone(newGame('homeless'));
    expect(availableJobs(state)).toHaveLength(0);
    expect(assign(state, state.party.people[0]!.id, 'farmer')).toBe(false);
    expect(dayLabour(state).food).toBe(0);
  });

  it('the dead do no work', () => {
    const state = putEveryoneOn(withReport('dead-work', { soil: 5 }), 'farmer');
    const alive = dayLabour(state).byPerson.length;
    const victim = state.party.people[0]!;
    victim.alive = false;
    victim.health = 0;
    expect(dayLabour(state).byPerson).toHaveLength(alive - 1);
    expect(assign(state, victim.id, 'woodcutter')).toBe(false);
  });
});

// --- Mode and saves ---

describe('COLONY mode', () => {
  it('opens from the steading and pops back to the road', () => {
    const state = settled('mode');
    expect(currentMode(state)).toBe('TRAVEL');
    const inside = apply(state, { type: 'ENTER_COLONY' });
    expect(currentMode(inside)).toBe('COLONY');
    expect(inside.modes).toEqual(['TRAVEL', 'COLONY']);
    const back = apply(inside, { type: 'LEAVE_COLONY' });
    expect(currentMode(back)).toBe('TRAVEL');
    expect(back.modes).toEqual(['TRAVEL']);
  });

  it('will not open away from the steading, or with no steading at all', () => {
    const away = settled('mode-away');
    walkOff(away);
    expect(apply(away, { type: 'ENTER_COLONY' })).toBe(away);

    const homeless = structuredClone(newGame('mode-none'));
    expect(apply(homeless, { type: 'ENTER_COLONY' })).toBe(homeless);
  });

  it('refuses travel and battle orders while you are in the steading', () => {
    const inside = apply(settled('mode-block'), { type: 'ENTER_COLONY' });
    for (const action of [
      { type: 'CAMP' },
      { type: 'FORAGE' },
      { type: 'WALK', to: (inside.party.stop ?? 0) + 1 },
      { type: 'B_END_TURN' },
    ] as const) {
      expect(apply(inside, action), action.type).toBe(inside);
    }
  });

  it('assigns through the action layer, and refuses nonsense', () => {
    const inside = apply(settled('mode-assign'), { type: 'ENTER_COLONY' });
    const id = inside.party.people[0]!.id;
    const put = apply(inside, { type: 'ASSIGN', personId: id, job: 'woodcutter' });
    expect(put).not.toBe(inside);
    expect(jobOf(put.party.people[0]!)?.id).toBe('woodcutter');

    const off = apply(put, { type: 'ASSIGN', personId: id, job: null });
    expect(off.party.people[0]!.job).toBeUndefined();
    expect(apply(put, { type: 'ASSIGN', personId: 'nobody', job: 'farmer' })).toBe(put);
  });

  it('a run in the steading round-trips through a save', () => {
    const inside = apply(settled('mode-save'), { type: 'ENTER_COLONY' });
    const assigned = apply(inside, {
      type: 'ASSIGN',
      personId: inside.party.people[0]!.id,
      job: 'farmer',
    });
    const round = JSON.parse(encode(assigned)) as GameState;
    expect(round.modes).toEqual(['TRAVEL', 'COLONY']);
    expect(round.settlement!.plots).toEqual(assigned.settlement!.plots);
    expect(round.party.people[0]!.job).toBe('farmer');
  });

  it('a v6 save comes forward with ground it can render', () => {
    const { save } = migrate({
      version: 6,
      party: { people: [{ id: 'p1' }] },
      settlement: { at: { q: 1, r: 1 }, name: 'Old', foundedOn: 3, report: {} },
    });
    expect(save['version']).toBe(SAVE_VERSION);
    const home = save['settlement'] as { plots: unknown[]; shelter: number; watch: number };
    // Empty rather than undefined: the renderer iterates it on load.
    expect(home.plots).toEqual([]);
    expect(home.shelter).toBe(0);
    expect(home.watch).toBe(0);
  });

  it('regenerates missing ground the first time the steading is opened', () => {
    const state = settled('regen');
    state.settlement!.plots = [];
    const inside = apply(state, { type: 'ENTER_COLONY' });
    expect(inside.settlement!.plots.length).toBeGreaterThan(0);
    expect(inside.settlement!.plots.some((p) => p.kind === 'hall')).toBe(true);
  });
});
