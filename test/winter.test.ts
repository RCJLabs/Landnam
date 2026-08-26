// 3.4: the first winter. The bar is that an unprepared colony dies and it is
// clearly the player's fault — which is only true if the number the game
// telegraphed in the autumn was an honest one. So the centre of this file is
// a measurement of the forecast's predictive accuracy.

import { settled as settleSomewhere } from './fixtures/settle';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The verbs the game actually has, read off the source rather than listed
 * here. A second hand-typed list of action names is a second thing that can
 * drift from the first, which is the defect this whole file keeps finding.
 *
 * BOTH files, because the union in actions.ts is assembled from parts —
 * `FALL_ON` and the rest of the road live in travel.ts. The first cut read
 * only actions.ts and went red on a verb that does exist, which is the right
 * way for a bar like this to be wrong.
 */
const SOURCE = ['src/sim/actions.ts', 'src/sim/travel.ts']
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
import { newGame } from '../src/state/create';
import { EVENTS } from '../src/data/events';
import { isEligible } from '../src/sim/events';
import { seasonOf } from '../src/sim/calendar';
import { assign, buildable, queueBuild } from '../src/sim/colony';
import { suggestedBuild } from '../src/sim/needs';
import { checkRunEnd, foodPerDay, passDay, SURVIVAL_DAY } from '../src/sim/upkeep';
import { YEAR_LENGTH } from '../src/sim/calendar';
import { forecast, markVisible, MARK_WINDOW, PRUDENCE, WINTER_DAY } from '../src/sim/winter';
import { coldNight, sickCount } from '../src/sim/cold';
import { readiness } from '../src/sim/reach';
import { telegraphWinter, winterVerdict } from '../src/sim/telegraph';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';
import { willAdmit } from '../src/sim/joining';
import { living } from '../src/sim/people';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/**
 * How the run finished. Read through a call rather than off the property:
 * an early `if (state.end) continue` narrows it to undefined for the rest of
 * the block, and passDay's mutation is invisible to that narrowing.
 */
function endCause(state: GameState): string {
  return state.end?.cause ?? 'running';
}

function settledWell(seed: string, radius = 14): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed, { radius });
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  return state;
}

/** Plays to the turn of autumn, building sensibly on the way. */
function toAutumn(seed: string): GameState {
  const state = settledWell(seed);
  while (state.day < 25 && !state.end) {
    if (state.settlement!.queue.length === 0) {
      const pick = suggestedBuild(state, buildable(state));
      if (pick) queueBuild(state, pick.id);
    }
    passDay(state);
  }
  return state;
}

// --- The forecast ---

describe('the winter mark', () => {
  it('is a target, not a mood: it names food and wood and days', () => {
    const state = toAutumn('mark-1');
    const f = forecast(state);
    expect(f.days).toBe(SURVIVAL_DAY - state.day);
    expect(f.food).toBeGreaterThan(0);
    expect(f.firewood).toBeGreaterThan(0);
    expect(f.foodGap).toBe(Math.round(state.party.food) - f.food);
    expect(f.firewoodGap).toBe(Math.round(state.party.firewood) - f.firewood);
    expect(readiness(state)).toMatch(/\d/);
  });

  it('shrinks as the winter is walked through', () => {
    const state = toAutumn('mark-shrink');
    state.party.food = 500;
    state.party.firewood = 500;
    // A confound pinned out rather than an assertion weakened. This band is
    // rich, which is exactly what makes it eligible to bear, and a child is a
    // mouth — so a birth mid-walk raises the mark by more than twenty days of
    // countdown lowers it. That is the larder telling the truth, and it is
    // not what this test is about: the property here is that the mark counts
    // DOWN as the winter is walked through, all else equal. The cooldown
    // holds all else equal.
    state.flags['lastBorn'] = state.day;
    // The same confound, through a second door, opened when the roof became a
    // soft limit: somebody JOINS mid-walk and is another mouth, exactly as a
    // child is. Pinned out the same way rather than the assertion weakened —
    // fill the hall to what it will admit, so `drawOdds` is nought and the
    // roster is constant across the twenty days. Safe to leave crowded here:
    // spread needs somebody already down, nobody is, and the fire is lit.
    const seed0 = state.party.people[0]!;
    while (willAdmit(state) > 0) {
      state.party.people.push({
        ...structuredClone(seed0), id: `pin${state.party.people.length}`,
        name: `Pinned${state.party.people.length}`, bond: 'hand', injuries: [], kin: undefined,
      } as never);
    }
    const roster = living(state.party.people).length;
    const early = forecast(state);
    // INTO the winter, not merely towards it, and the walk used to stop
    // short. `forecast` accumulates `max(0, mouths - grown)` a day, so a day
    // the fields cover contributes nothing and dropping it off the front of
    // the count changes the food figure not at all. Walking from autumn to
    // autumn asked the mark to shrink over days that were never in it. Thirty
    // days clears WINTER_DAY, and the days it drops are days that cost
    // something — which is what "walked through" was always supposed to mean.
    for (let d = 0; d < 30 && !state.end; d++) passDay(state);
    expect(seasonOf(state.day)).toBe('winter');
    expect(living(state.party.people).length, 'the roster moved — the pin leaks')
      .toBe(roster);
    const late = forecast(state);
    expect(late.days).toBeLessThan(early.days);
    expect(late.food).toBeLessThan(early.food);
    expect(late.days).toBeLessThan(SURVIVAL_DAY - 25);
  });

  it('is put away once the ice has broken, and comes back for the next winter', () => {
    const state = toAutumn('mark-done');
    state.day = SURVIVAL_DAY;
    // The mark now points at the NEXT winter rather than at nothing, because
    // there is a next winter — but it is not shown through spring and summer.
    expect(markVisible(state)).toBe(false);
    expect(forecast(state).days).toBe(YEAR_LENGTH);
    expect(readiness(state)).toContain('ice');
  });

  /**
   * THE PANEL DOES NOT NAME A VERB THE GAME DOES NOT HAVE.
   *
   * `readiness()` offered a dying band two ways out: rob somebody, or walk
   * out and winter elsewhere. The second one does not exist. `foundBlocker`
   * answers `settled` the moment the posts are in, and nothing anywhere
   * clears `state.settlement` — so a player who took that advice would find
   * the game refusing them, at the worst moment it could.
   *
   * The bar is ONE-DIRECTIONAL and the comment used to overstate it. It said
   * "build the verb and this test tells you to put the sentence back", which
   * the code below never did: it only checks that the prose does not promise
   * walking out while `ABANDON` is absent. Worth being exact about, because
   * the verb arrived on 2026-08-20 and the sentence deliberately did NOT come
   * back — walking out measured at saved 0 and killed 11 over 120 paired
   * landings, so this panel, which is the one place the game tells a dying
   * band what to try, does not spend itself on it. See src/data/retreat.ts.
   *
   * The direction that remains is the one that was ever a defect: the game
   * must not advertise a move it would refuse. Whether it advertises a move
   * it merely disagrees with is a design call, and it is not one a string
   * search should be making.
   */
  it('offers no way out that the player cannot actually take', () => {
    // A band the mark has written off: settled, the frost close, and nothing
    // in the store to meet it with.
    const state = toAutumn('no-way-out');
    state.party.food = 0;
    state.party.firewood = 0;
    state.party.people.forEach((p) => { p.job = undefined; });
    expect(markVisible(state)).toBe(true);
    const line = readiness(state);
    const canLeave = SOURCE.includes('ABANDON');
    if (!canLeave) {
      expect(
        line.toLowerCase(),
        'the panel tells a dying band to walk out, and nothing in the game lets them',
      ).not.toContain('walking out');
    }
    // And the one it DOES name is real: falling on a place is a verb.
    if (line.includes('taking it from somebody else')) {
      expect(SOURCE).toContain('FALL_ON');
    }

    // Autumn of the second year, and it is back on screen counting down.
    state.day = SURVIVAL_DAY + YEAR_LENGTH - MARK_WINDOW;
    expect(markVisible(state)).toBe(true);
    expect(forecast(state).days).toBe(MARK_WINDOW);
  });

  /**
   * The forecast projects the CURRENT plan. A band that has put everyone in
   * the fields is told a bigger number than one that has hands on wood,
   * because its fields are about to stop and its stack is not growing.
   */
  it('answers to the plan the band is actually on', () => {
    const farming = toAutumn('mark-plan');
    const cutting = structuredClone(farming);
    for (const p of farming.party.people) assign(farming, p.id, 'farmer');
    for (const p of cutting.party.people) assign(cutting, p.id, 'woodcutter');

    const a = forecast(farming);
    const b = forecast(cutting);
    // eslint-disable-next-line no-console
    console.log(
      `same steading, same day — all farming needs ${a.food} food / ${a.firewood} wood; ` +
        `all cutting needs ${b.food} / ${b.firewood}`,
    );
    // Cutters bank wood and grow nothing; farmers the reverse. Both must show.
    expect(b.firewood).toBeLessThan(a.firewood);
    expect(b.food).toBeGreaterThan(a.food);
  });

  it('carries a margin, because the weather is not an average', () => {
    expect(PRUDENCE).toBeGreaterThan(1);
  });
});

// --- The milestone's bar ---

describe('an unprepared colony dies and it is clearly your fault', () => {
  // Eight winters could not tell a three-seed gap from weather. Twenty-four.
  const SEEDS = Array.from({ length: 24 }, (_, i) => `w-${i}`);

  /**
   * Plays a settled run to spring. The heedful band reads the mark each day
   * and moves hands to close whichever gap is open; the heedless band keeps
   * the plan it started with whatever the mark says.
   *
   * This is the honest form of the milestone. Simply handing one band a
   * smaller stockpile measures nothing about the telegraph — what matters is
   * whether a player who ACTS on the number lives and one who ignores it does
   * not.
   */
  function overwinter(seed: string, heed: boolean) {
    const state = toAutumn(seed);
    if (state.end) return null;
    const toldReady = forecast(state).ready;

    while (state.day < SURVIVAL_DAY && !state.end) {
      if (state.settlement!.queue.length === 0) {
        const pick = suggestedBuild(state, buildable(state));
        if (pick) queueBuild(state, pick.id);
      }

      if (heed) {
        const f = forecast(state);
        // Whichever gap is worse gets the next pair of hands. A band that
        // can read the mark can always put someone on wood.
        const want: JobId | null =
          f.firewoodGap < 0 && f.firewoodGap <= f.foodGap
            ? 'woodcutter'
            : f.foodGap < 0
              ? 'hunter'
              : null;
        if (want) {
          const spare = state.party.people.find(
            (p) => p.alive && p.job !== want && p.job !== 'woodcutter',
          );
          if (spare) assign(state, spare.id, want);
        }
      }

      passDay(state);
    }
    return {
      toldReady,
      // The thaw no longer ends the run, so coming through it means being
      // alive and unended when the loop stops.
      survived: !state.end,
      day: state.day,
      cause: endCause(state),
      verdict: winterVerdict(state),
    };
  }

  it('the mark is actionable: heed it and you live, ignore it and you do not', () => {
    let heedLived = 0;
    let heedDays = 0;
    let deafLived = 0;
    let deafDays = 0;
    let runs = 0;
    const causes = new Set<string>();

    for (const seed of SEEDS) {
      const heedful = overwinter(seed, true);
      const heedless = overwinter(seed, false);
      if (!heedful || !heedless) continue;
      runs++;
      if (heedful.survived) heedLived++;
      else causes.add(`heeded:${heedful.cause}`);
      if (heedless.survived) deafLived++;
      else causes.add(heedless.cause);
      heedDays += heedful.day;
      deafDays += heedless.day;
    }

    // eslint-disable-next-line no-console
    console.log(
      `over ${runs} winters — heeding the mark: ${heedLived} survived (${Math.round(heedDays / runs)} avg days) | ` +
        `ignoring it: ${deafLived} survived (${Math.round(deafDays / runs)}) | deaths: ${[...causes].join(', ')}`,
    );

    // THIS is the milestone. The number printed in the autumn has to be worth
    // acting on, or "it is your fault" is a thing the game says rather than a
    // thing it means.
    expect(runs).toBeGreaterThan(0);
    expect(heedLived).toBeGreaterThan(deafLived);
    expect(heedDays).toBeGreaterThan(deafDays);
    expect(heedLived / runs).toBeGreaterThan(0.6);
    // And ignoring it has to be genuinely bad, not merely slightly worse.
    expect(deafLived / runs).toBeLessThan(0.5);
  });

  it('a band that goes in with nothing dies, and dies of the winter', () => {
    let died = 0;
    const causes = new Set<string>();
    for (const seed of SEEDS) {
      const state = toAutumn(seed);
      if (state.end) continue;
      // Everything spent, and the mark says so plainly.
      state.party.food = 2;
      state.party.firewood = 2;
      expect(forecast(state).ready).toBe(false);
      while (state.day < SURVIVAL_DAY && !state.end) passDay(state);
      if (endCause(state) !== 'survived') {
        died++;
        causes.add(endCause(state));
      }
    }
    // eslint-disable-next-line no-console
    console.log(`empty stores at the turn of autumn: ${died}/${SEEDS.length} died of ${[...causes].join(', ')}`);
    expect(died).toBe(SEEDS.length);
  });

  it('every colony is told the number, and told again when it is short', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const state = toAutumn(seed);
      if (state.end) continue;
      state.party.food = 1;
      state.party.firewood = 1;
      while (state.day < WINTER_DAY && !state.end) passDay(state);

      expect(state.flags['winterTargetGiven'], `${seed}: never told the mark`).toBe(1);
      expect(state.flags['winterLastWarning'], `${seed}: never warned it was short`).toBe(1);
      const saga = state.saga.map((e) => e.text).join(' ');
      expect(saga).toMatch(/To see spring|would need/);
    }
  });

  it('the ending says whether the band was warned', () => {
    const state = toAutumn('verdict');
    if (state.end) return;
    state.party.food = 1;
    state.party.firewood = 1;
    while (state.day < SURVIVAL_DAY && !state.end) passDay(state);
    expect(state.end).toBeDefined();
    const verdict = winterVerdict(state);
    expect(verdict).toBeTruthy();
    expect(state.end!.lines.some((l) => l === verdict)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`verdict on a warned colony that ignored it: "${verdict}"`);
  });

  it('a warning is given once, not nagged every day', () => {
    const state = toAutumn('nag');
    if (state.end) return;
    state.party.food = 1;
    state.party.firewood = 1;
    for (let d = 0; d < 20 && !state.end; d++) passDay(state);
    const given = state.saga.filter((e) => e.text.includes('To see spring')).length;
    expect(given).toBeLessThanOrEqual(1);
  });

  it('says nothing at all before there is anything to say', () => {
    const state = settledWell('early');
    state.day = 5;
    telegraphWinter(state);
    expect(state.flags['winterTargetGiven']).toBeUndefined();
  });
});

// --- Sickness ---

describe('the ending names what actually killed them', () => {
  /**
   * AUDIT ITEM 8.
   *
   * "Despair ends more runs than hunger, cold and steel put together" sat in
   * ROADMAP.md for three audits. It drove three separate sweeps of the
   * morale levers — winter sickness, bereavement, kin grief — every one of
   * which moved nothing, and it is a large part of why the kin system was
   * built. Measured properly it was a LABELLING ARTIFACT: of thirty runs
   * ending in despair, twenty-eight had an empty larder the day before,
   * averaging one food between them.
   *
   * They had not stopped listening to each other. They had not eaten for
   * weeks. The death table is the player's only feedback about what to do
   * differently, and it was telling most of them to manage morale when the
   * answer was food.
   *
   * Now: break with nothing in the store and you are told you starved.
   * Despair keeps the case it was always for — fed, and out of heart anyway
   * — which in sixty sagas happens twice, late, to a band of five with food
   * on the shelf.
   */
  function broken(seed: string, food: number): GameState {
    const state = structuredClone(newGame(seed));
    state.party.morale = 0;
    state.party.food = food;
    state.day = 90;
    checkRunEnd(state, 0);
    return state;
  }

  it('a band that breaks with an empty store is told it starved', () => {
    const state = broken('end-hungry', 0);
    expect(state.end?.cause).toBe('starved');
    expect(state.end?.title).toBe('The Stores Gave Out');
    expect(state.end?.lines.join(' ')).toContain('nothing in the store');
  });

  it('and one that breaks with food on the shelf is told the truth too', () => {
    const state = broken('end-fed', 200);
    expect(state.end?.cause).toBe('despair');
    expect(state.end?.title).toBe('The Band Broke');
    expect(state.end?.lines.join(' ')).toContain('food in the store');
  });

  it('the line between them is whether there was a day\u2019s food', () => {
    // Not an arbitrary number: enough for today, which is the same test the
    // upkeep uses to decide whether anybody eats.
    const lean = structuredClone(newGame('end-edge'));
    lean.party.morale = 0;
    lean.day = 90;
    lean.party.food = foodPerDay(lean);
    checkRunEnd(lean, 0);
    expect(lean.end?.cause).toBe('despair');

    const leaner = structuredClone(newGame('end-edge'));
    leaner.party.morale = 0;
    leaner.day = 90;
    leaner.party.food = foodPerDay(leaner) - 1;
    checkRunEnd(leaner, 0);
    expect(leaner.end?.cause).toBe('starved');
  });
});

describe('sickness in the dark', () => {
  it('a cold night puts people down, and shelter is what stops it', () => {
    const bare = settledWell('sick-bare');
    bare.day = 55;
    bare.settlement!.shelter = 0;
    const roofed = structuredClone(bare);
    roofed.settlement!.shelter = 6;

    let bareFell = 0;
    let roofedFell = 0;
    for (let i = 0; i < 30; i++) {
      const a = structuredClone(bare);
      const b = structuredClone(roofed);
      a.day = 50 + i;
      b.day = 50 + i;
      bareFell += coldNight(a, 3).length;
      roofedFell += coldNight(b, 3).length;
    }
    // eslint-disable-next-line no-console
    console.log(`thirty cold nights — bare hall: ${bareFell} fell ill, full roof: ${roofedFell}`);
    expect(bareFell).toBeGreaterThan(roofedFell);
    expect(bareFell).toBeGreaterThan(0);
  });

  it('illness docks a stat and drags the whole band', () => {
    const state = settledWell('sick-cost');
    state.day = 55;
    state.settlement!.shelter = 0;
    const before = state.party.morale;
    const fell = coldNight(state, 4);
    if (fell.length === 0) return;
    expect(state.party.morale).toBeLessThan(before);
    for (const person of fell) {
      const ill = person.injuries.find((i) => i.id.startsWith('ill_'))!;
      expect(ill).toBeDefined();
      expect(Object.values(ill.effect).some((v) => (v ?? 0) < 0)).toBe(true);
    }
    expect(sickCount(state)).toBe(fell.length);
  });

  it('nothing mends while the ground is frozen', () => {
    const state = settledWell('sick-mend');
    state.day = 50;
    state.party.food = 900;
    state.party.firewood = 900;
    const person = state.party.people[0]!;
    person.injuries.push({ id: 'ill_50_x', label: 'Fever', effect: { spirit: -1 }, heals: 3 });

    for (let d = 0; d < 8 && !state.end; d++) passDay(state);
    expect(seasonOf(state.day)).toBe('winter');
    // Still carrying it after eight days of a three-day illness: a winter
    // sickness that ticked down like a summer scratch would take the teeth
    // out of the whole season.
    expect(person.injuries.some((i) => i.id === 'ill_50_x')).toBe(true);
  });

  it('and mends again once the season lets it', () => {
    // Autumn rather than the far side of winter: the run ends on day 73, so
    // there is no room after the thaw to measure anything.
    const state = settledWell('sick-thaw');
    state.day = 30;
    state.party.food = 900;
    state.party.firewood = 900;
    const person = state.party.people[0]!;
    person.injuries.push({ id: 'ill_30_x', label: 'Fever', effect: { spirit: -1 }, heals: 3 });

    for (let d = 0; d < 5 && !state.end; d++) passDay(state);
    expect(seasonOf(state.day)).toBe('autumn');
    expect(person.injuries.some((i) => i.id === 'ill_30_x')).toBe(false);
  });

  it('a sickness that goes untreated can kill', () => {
    const state = settledWell('sick-kill');
    state.day = 55;
    state.settlement!.shelter = 0;
    for (const p of state.party.people) p.health = 2;
    let died = 0;
    for (let i = 0; i < 12; i++) {
      state.day = 50 + i;
      coldNight(state, 5);
      died = state.party.people.filter((p) => !p.alive).length;
      if (died > 0) break;
    }
    expect(died).toBeGreaterThan(0);
    const dead = state.party.people.find((p) => !p.alive)!;
    expect(dead.fate).toContain('sickness');
    expect(dead.diedOn).toBeGreaterThan(0);
  });
});

// --- Winter content ---

describe('the winter events', () => {
  it('there are winter cards, and they only fire in winter', () => {
    const winterOnly = EVENTS.filter((e) =>
      (e.when ?? []).some((c) => c.c === 'season' && c.any.length === 1 && c.any[0] === 'winter'),
    );
    expect(winterOnly.length).toBeGreaterThanOrEqual(5);

    const summer = settledWell('cards-summer');
    summer.day = 10;
    for (const def of winterOnly) {
      expect(isEligible(summer, def), `${def.id} fired in summer`).toBe(false);
    }
  });

  it('scarcity conditions gate on the actual store', () => {
    const state = settledWell('cards-scarce');
    state.day = 55;
    const empty = EVENTS.find((e) => e.id === 'empty-store')!;
    const lowWood = EVENTS.find((e) => e.id === 'wood-runs-low')!;

    state.party.food = 400;
    state.party.firewood = 400;
    expect(isEligible(state, empty)).toBe(false);
    expect(isEligible(state, lowWood)).toBe(false);

    state.party.food = 3;
    state.party.firewood = 3;
    expect(isEligible(state, empty)).toBe(true);
    expect(isEligible(state, lowWood)).toBe(true);
  });

  it('the sickness card waits until somebody is sick', () => {
    const state = settledWell('cards-sick');
    state.day = 55;
    const card = EVENTS.find((e) => e.id === 'lung-sickness')!;
    expect(isEligible(state, card)).toBe(false);
    state.party.people[0]!.injuries.push({
      id: 'ill_55_a',
      label: 'Fever',
      effect: { spirit: -1 },
      heals: 12,
    });
    expect(isEligible(state, card)).toBe(true);
  });

  it('a homeless band never sees the steading cards', () => {
    const wandering = structuredClone(newGame('cards-homeless'));
    wandering.day = 55;
    for (const id of ['the-long-dark', 'empty-store', 'wood-runs-low']) {
      const def = EVENTS.find((e) => e.id === id)!;
      expect(isEligible(wandering, def), id).toBe(false);
    }
  });
});
