// The PROBES: the sweeps that were run to answer a question, not to hold a
// line. They print tables and assert almost nothing.
//
// They are here rather than in balance.test.ts because the two files are read
// for opposite reasons. A BAR is a claim the game must keep meeting, and it
// fails when the game changes under it. A PROBE is an instrument that was
// pointed at the game once, on a date, at some N — and CLAUDE.md's rule that a
// number is a reading and not a fact is the reason they are kept at all rather
// than deleted after their answer was written down: the way to honour that rule
// is to be able to RE-TAKE the reading, which means the instrument has to
// survive. What it must not do is sit among the bars looking like one.
//
// Almost every finding these produced is already recorded in ROADMAP.md next
// to the instrument, the date and the N. Read that first; run these when you
// mean to take the reading again.
//
// The scripted player they all measure with is test/fixtures/harness.ts, which
// balance.test.ts shares. That sharing is the whole reason this split is safe:
// there is still exactly one bot, so a probe and a bar cannot drift apart.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { SEASON_LENGTH, YEAR_LENGTH, seasonOf } from '../src/sim/calendar';
import { ailingCount, careToday } from '../src/sim/sickness';
import { sprung } from '../src/sim/ship';
import { foodPerDay, firewoodPerNight } from '../src/sim/upkeep';
import { leaderOf, living, sworn } from '../src/sim/people';
import { KEPT_FOR, NEGLECTED_AFTER, feastCost, sinceKept } from '../src/sim/hall';
import { takeIn } from '../src/sim/joining';
import { autumnChance, autumnRaidDay } from '../src/sim/raid';
import { fallenOf } from '../src/sim/fallen';
import { buildBlocker, capacity, crowding, heartRaised, output, shelterSaving, standsFor } from '../src/sim/colony';
import { CROSSING, provisioning, sailBlocker } from '../src/sim/voyage';
import { wintersStood } from '../src/sim/calendar';
import { PLOTS, jobById, type JobId } from '../src/data/jobs';
import { type HardshipId } from '../src/data/hardship';
import { BUILDINGS } from '../src/data/buildings';
import { EVENTS } from '../src/data/events';
import { DEATHS } from '../src/data/injuries';
import { rivalBlocks } from '../src/sim/rival';
import { ROUTE_STOPS } from '../src/sim/route';
import { knowsStop, standingAt, walkOptions } from '../src/sim/coast';
import { apply } from '../src/sim/actions';
import { activeCombatant, beginBattle, fighterPerson, standing, strikeTargets } from '../src/sim/battle';
import { reachTargets, throwTargets } from '../src/sim/strike';
import { effectiveStat } from '../src/sim/people';
import type { Combatant, GameState } from '../src/state/types';
import { groundAtStop } from '../src/sim/fishery';
import { atHome, stopReport } from '../src/sim/site';
import { countryHere } from '../src/sim/coast';
import { terrainDef } from '../src/data/terrain';
import { reckoningDue } from '../src/sim/landnam';
import { reachable } from '../src/sim/reach';
import { markVisible } from '../src/sim/winter';
import {
  CREW,
  Policy,
  RAIDER,
  SETTLER,
  armSeed,
  nearestStop,
  policy,
  run,
  setPolicy,
  setWalkedOut,
  walkedOut,
} from './fixtures/harness';

describe('PROBE: can a band actually afford to keep its hall', () => {
  /**
   * The question 9.12a has to answer about itself: is this a rule you FORGET,
   * or a rule you cannot afford? A fine on morale compounds — no feast, no
   * heart, hands walk out, less labour, less food, no feast — and the first
   * cut of this, at two food a mouth, built exactly that spiral.
   *
   * MEASURED ON THE DAY IT FALLS DUE, and that is not a detail. The obvious
   * reading — "of all overdue days, how many had no food?" — cannot answer
   * anything, because a band with food feasts at once and never lands in the
   * sample. Every day in it is therefore a day somebody was short, and it
   * duly read 64% with no bearing on whether the rule is fair. The day the
   * season turns is the one moment every band reaches, rich or poor.
   */
  it('measures whether the larder can meet the feast on the day it falls due',
    { timeout: 900_000 }, () => {
      const SEEDS = 40;
      for (const TERMS of ['even', 'fair'] as HardshipId[]) {
        let due = 0;        // the day the feast fell due, sampled once each
        let couldNot = 0;   // ... and the larder could not meet it
        let bare = 0;       // ... of those, the band had nothing at all
        let cold = 0;       // days the hall paid nothing above the free point
        let days = 0;       // days with a hall worth keeping at all
        let feasts = 0;
        let sagas = 0;
        for (let s = 0; s < SEEDS; s += 1) {
          let held = 0;
          let counted = false;
          run(`curve-${s}`, 500, (before, after) => {
            if (before.settlement?.kept !== after.settlement?.kept
              && after.settlement?.kept !== undefined) held += 1;
            const home = after.settlement;
            if (!home || after.end) return;
            if (heartRaised(after) <= 1) return;
            counted = true;
            days += 1;
            const since = sinceKept(after);
            if (since >= NEGLECTED_AFTER) cold += 1;
            // The turn of the season, taken once. Not `canKeepHall`, which
            // also refuses mid-battle and mid-card: the question is the
            // LARDER and nothing else.
            if (since !== KEPT_FOR + 1) return;
            due += 1;
            if (after.party.food < feastCost(after)) {
              couldNot += 1;
              if (after.party.food <= 0) bare += 1;
            }
          }, TERMS);
          feasts += held;
          if (counted) sagas += 1;
        }
        const share = due > 0 ? couldNot / due : 0;
        // eslint-disable-next-line no-console
        console.log(
          `keeping the hall [${TERMS}] over ${SEEDS} sagas — ${sagas} ever had a hall worth ` +
          `keeping, ${feasts} feasts held across ${days} such days:\n` +
          `  fell due ${due} times; the larder could not meet it ${couldNot} ` +
          `(${(share * 100).toFixed(0)}%), of which ${bare} had nothing at all\n` +
          `  gone properly cold ${cold} days (${days > 0 ? ((cold / days) * 100).toFixed(0) : 'n/a'}%)`,
        );
        // THE BAR: on the day it falls due, a band should usually be able to
        // pay. A rule you cannot meet is a fine, and a fine on morale is the
        // spiral. Set at a third rather than at nothing, because a band that
        // is genuinely starving SHOULD miss its feast — that is winter, and
        // it is the game.
        if (due > 0) expect(share).toBeLessThan(1 / 3);
      }
    });
});

describe('PROBE: does the wall ever actually protect the hall', () => {
  /**
   * The question the ruling of 2026-08-30 has to answer about itself.
   *
   * The mead hall burns unless a wall stands, and the reason that was chosen
   * over sparing it outright is that sparing it gave back the whole of the
   * pressure autumn was built to add. But the long game came back BYTE
   * IDENTICAL to the run before the rule — same average days, same ends, same
   * count past the third year, on all three arms. A rule that changes the
   * burnable list changes which building `rng.pick` lands on, so identical
   * numbers do not mean "no effect", they mean the list never changed: no
   * sack ever found an unwalled mead hall standing.
   *
   * That is a claim about how often the rule is REACHED, and it is worth a
   * number rather than a shrug — a rule that never fires is decoration, and
   * the roadmap should say so either way.
   */
  it('counts the sacks that found a hall, and whether a wall was up', { timeout: 900_000 }, () => {
    const SEEDS = 60;
    for (const TERMS of ['even', 'fair'] as HardshipId[]) {
      let raids = 0;        // raids that came
      let withHall = 0;     // ... with a mead hall standing
      let walled = 0;       // ... of those, behind a wall
      let hallBurned = 0;   // ... and the hall actually fired
      let everHall = 0;     // sagas that ever raised a mead hall
      let everWall = 0;     // sagas that ever raised a wall
      for (let s = 0; s < SEEDS; s += 1) {
        let hall = false;
        let wall = false;
        run(`curve-${s}`, 500, (before, after) => {
          if (standsFor(after, 'meadhall')) hall = true;
          if (standsFor(after, 'palisade')) wall = true;
          // A sack is a building list that shrank, or stores that went, on a
          // day the band was at home. The cheap tell is the tally.
          // A raid COMING, not a raid lost — a held raid sacks nothing, so
          // this is the generous count and the finding below survives it.
          if (after.tally.raids > before.tally.raids) {
            raids += 1;
            if (standsFor(before, 'meadhall')) {
              withHall += 1;
              if (standsFor(before, 'palisade')) walled += 1;
              if (!standsFor(after, 'meadhall')) hallBurned += 1;
            }
          }
        }, TERMS);
        if (hall) everHall += 1;
        if (wall) everWall += 1;
      }
      // eslint-disable-next-line no-console
      console.log(
        `the wall and the hall [${TERMS}] over ${SEEDS} sagas — ${everHall} ever raised a ` +
        `mead hall, ${everWall} ever raised a wall\n` +
        `  ${raids} raids came; ${withHall} of them found a mead hall standing ` +
        `(${walled} behind a wall, ${withHall - walled} open)\n` +
        `  mead halls fired: ${hallBurned}`,
      );
    }
  });
});

describe('PROBE: where a raid actually costs a band', () => {
  /**
   * WHICH LEVER, before building one. 6.5's goal is that fighting makes the
   * WINTER worse rather than ending runs itself, and 6.5b established that
   * which building burns is not it. There are three candidates left — how
   * often a raid comes, how often it is lost, and what losing one takes —
   * and they want opposite work, so guessing is not allowed.
   *
   * This is the diagnostic that picks between them, and it is deliberately
   * NOT a sweep: it asks whether a band that loses a raid before its first
   * winter dies more than one that holds. If it does, the sack already bites
   * and the lever is the hold rate. If it does not, the sack is too cheap and
   * the lever is what it takes.
   *
   * WHAT IT ANSWERED, 2026-08-30, and the answer was none of the three.
   * Losing a raid is one of the sharpest things in the game — 92% of bands
   * that held saw spring against 63% that did not, with half the larder at
   * the frost — so severity is not loose. But swept, neither of the other two
   * moves the total at all:
   *
   *   AUTUMN_WORTH_K  0.155 -> 0.80   roll 15% -> 57%, spring 74% -> 73%
   *   RAID_PER_POINT  0.5   -> 1.0    spring 74% -> 76% (noise)
   *
   * Quadrupling how often raiders come costs ONE point of first-winter
   * survival, and doubling how many they bring costs nothing. The reason is
   * the same for both, and it is structural rather than a tuning miss: every
   * term in the raid system is proportional to what a band HAS. `worth` is
   * roofs and stores, so a first-year band is rarely worth coming for;
   * `raidDifficulty` is roofs and stores, so the multiplier has almost
   * nothing to multiply; and `SACK_SHARE` takes two fifths of a larder that
   * holds 23. Raiders come for plunder, and in year one there is none.
   *
   * So autumn cannot be made to spoil the FIRST winter from inside this
   * system, and that is a design fact worth keeping rather than a bug. What
   * the sweep does buy cheaply is REACH: at K = 0.5 the never-raided share
   * falls from 58% to 43% for one point of spring, so more bands get an
   * autumn that is about fighting. Making it spoil year one needs a raider
   * who wants something other than goods — the land, or people — which is
   * new design and not a constant.
   *
   * THE CONFOUND, STATED. Raiders are drawn against `worth`, so a band that
   * gets raided is a RICHER band, and richer bands see spring more often.
   * That biases this AGAINST finding an effect — so an effect that shows up
   * here is real and understated, and a null result is genuinely null.
   * Reported as three arms rather than two so the confound is visible: if
   * "raided and held" already beats "never raided", the bias is doing the
   * talking and the arms cannot be compared naively.
   */
  it('splits the first winter by what autumn did, and says which lever is loose',
    { timeout: 900_000 }, () => {
      // 200 seeds to day 80, not 300 to day 500. The question is entirely
      // about the FIRST winter, so every day after the thaw is spent
      // measuring nothing — and at 500 the probe was killed for memory.
      const SEEDS = 200;
      const LAST = 80;
      for (const TERMS of ['even', 'fair'] as HardshipId[]) {
        const arms = {
          none: { n: 0, spring: 0, food: 0 },
          held: { n: 0, spring: 0, food: 0 },
          lost: { n: 0, spring: 0, food: 0 },
        };
        const chances: number[] = [];
        let settledN = 0;
        let springN = 0;
        let sacks = 0;
        for (let s = 0; s < SEEDS; s += 1) {
          let came = 0;
          let held = 0;
          let atWinter = 0;
          let chance = -1;   // the autumn roll on the day it was decided
          const state = run(`curve-${s}`, LAST, (before, after) => {
            // Only what autumn did, so the arms are about the FIRST winter
            // and not about a raid three years later.
            if (after.day <= 48) {
              if (after.tally.raids > before.tally.raids) came += 1;
              if (after.tally.raidsHeld > before.tally.raidsHeld) held += 1;
            }
            // WHY it comes or does not: the chance itself, read on the day
            // this autumn's raid would land. That is the number the frequency
            // is made of, and without it "58% were never raided" has no cause
            // attached to it.
            //
            // GATED ON THE FIRST AUTUMN — days 25 to 48 — and that gate is
            // the whole reading. `autumnRaidDay` is derived from whatever
            // season it is asked in, so without it this sampled the SUMMER
            // roll of a band that had just come off the knarr, and duly
            // reported a median of 0% with a confident wrong cause attached.
            if (after.settlement && after.day >= 25 && after.day <= 48
              && after.day === autumnRaidDay(after) && chance < 0) {
              chance = autumnChance(after);
            }
            // The larder as the frost comes down, which is what winter eats.
            if (before.day < 49 && after.day >= 49) atWinter = after.party.food;
          }, TERMS);
          // A band that never settled never had a steading to sack, and
          // belongs in none of these arms.
          if (!state.settlement) continue;
          const arm = came === 0 ? 'none' : held >= came ? 'held' : 'lost';
          if (arm === 'lost') sacks += 1;
          if (chance >= 0) chances.push(chance);
          const a = arms[arm];
          a.n += 1;
          a.food += atWinter;
          settledN += 1;
          if (state.day >= 73 || !state.end) springN += 1;
          // Saw spring: alive past the thaw, which is day 73.
          if (state.day >= 73 || !state.end) a.spring += 1;
        }
        const pct = (a: { n: number; spring: number }) =>
          (a.n > 0 ? `${((a.spring / a.n) * 100).toFixed(0)}%` : 'n/a');
        const mid = (a: { n: number; food: number }) =>
          (a.n > 0 ? (a.food / a.n).toFixed(0) : 'n/a');
        const sorted = [...chances].sort((a, b) => a - b);
        const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : 0;
        // eslint-disable-next-line no-console
        console.log(
          `what autumn did [${TERMS}] over ${SEEDS} seeds — ${sacks} bands lost a raid ` +
          `before their first winter:\n` +
          `  never raided   ${String(arms.none.n).padStart(3)} bands, saw spring ${pct(arms.none)}, ` +
          `${mid(arms.none)} food at the frost\n` +
          `  raided, held   ${String(arms.held.n).padStart(3)} bands, saw spring ${pct(arms.held)}, ` +
          `${mid(arms.held)} food at the frost\n` +
          `  raided, lost   ${String(arms.lost.n).padStart(3)} bands, saw spring ${pct(arms.lost)}, ` +
          `${mid(arms.lost)} food at the frost\n` +
          `  the first autumn's roll, where a steading stood for it: ` +
          `median ${(median * 100).toFixed(0)}% over ${chances.length} readings\n` +
          `  ALL SETTLED: ${settledN} bands, saw spring ` +
          `${settledN > 0 ? ((springN / settledN) * 100).toFixed(0) : 'n/a'}%, ` +
          `${((arms.lost.n / Math.max(1, settledN)) * 100).toFixed(0)}% lost a raid`,
        );
      }
    });
});

describe('PROBE: is there any moment at which walking out is right', () => {
  /**
   * 9.14, and the question the two existing measurements never asked.
   *
   * Both of them trigger the retreat on the VERDICT — "we will not reach
   * spring on what this ground gives" — which fires around day 40. So both
   * measured a band leaving in autumn with its summer already spent, and both
   * found it lethal: saved 0 / killed 11 on the first, saved 1 / killed 18 on
   * the arm that was supposed to be testing rash ground.
   *
   * BUT THAT IS NOT THE CASE THE VERB SHIPPED FOR. src/data/retreat.ts is
   * explicit: it is "a verb for the OTHER case: ground you took too fast and
   * want to be off before the summer is spent", and it says plainly that "the
   * harness cannot measure that one, because the bot only ever settles on
   * ground that already clears its site floor". The bot can now settle rashly
   * — RASH exists — and it can now leave on the GROUND rather than on the
   * verdict, at the first day the ten-day floor allows.
   *
   * So this sweeps the one thing that was never tried: how bad does the
   * ground have to be before getting off it early is worth what it costs?
   * If there is a threshold that pays, the panel should point at it. If there
   * is not, then walking out is never right at any moment, and the game
   * should say so rather than offer it in silence.
   */
  it('sweeps how bad the ground must be for leaving it early to pay',
    { timeout: 900_000 }, () => {
      const SEEDS = 120;
      const SPRING_IN = SEASON_LENGTH * 3 + 1;
      // Takes the first legal ground, which is the band this verb is for: one
      // that settled in a hurry and has something to regret. Defined here as
      // well as in the sibling below, because the two live far apart and a
      // shared constant between them would tie two independent measurements
      // together.
      const RASH: Policy = { ...SETTLER, id: 'rash', siteFloor: 0 };

      const sample = (p: Policy): { lived: boolean[]; left: number; ground: number } => {
        setPolicy(p);
        const lived: boolean[] = [];
        const scores: number[] = [];
        let out = 0;
        for (let i = 0; i < SEEDS; i += 1) {
          setWalkedOut(0);
          let noted = false;
          const final = run(`winter-inside-${i}`, SPRING_IN, (before, after) => {
            if (!noted && !before.settlement && after.settlement) {
              noted = true;
              scores.push(stopReport(after.seed, after.settlement.stop ?? 0).total);
            }
          }, 'even');
          lived.push(!final.end && final.day >= SPRING_IN);
          out += walkedOut;
        }
        const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
        return { lived, left: out, ground: mean(scores) };
      };

      const stay = sample(RASH);
      // eslint-disable-next-line no-console
      console.log(
        `walking out EARLY, on the ground rather than the verdict — ${SEEDS} seeds, even:\n` +
        `  floor 0, stays put — ${stay.lived.filter(Boolean).length}/${SEEDS} saw spring, ` +
        `ground ${stay.ground.toFixed(1)} on average`,
      );

      let anyPaid = false;
      let everLeft = 0;
      for (const below of [12, 14, 16, 18]) {
        const arm = sample({ ...RASH, retreatsBelow: below });
        everLeft += arm.left;
        let saved = 0;
        let killed = 0;
        for (let i = 0; i < SEEDS; i += 1) {
          if (!stay.lived[i] && arm.lived[i]) saved += 1;
          if (stay.lived[i] && !arm.lived[i]) killed += 1;
        }
        if (saved > killed) anyPaid = true;
        // eslint-disable-next-line no-console
        console.log(
          `  leaves ground under ${String(below).padStart(2)} — ` +
          `${String(arm.lived.filter(Boolean).length).padStart(3)}/${SEEDS} saw spring, ` +
          `${String(arm.left).padStart(3)} walked out ` +
          `(saved ${saved}, killed ${killed})`,
        );
      }
      setPolicy(SETTLER);

      // THE INSTRUMENT FIRST, and this file has shipped the mistake it
      // guards against: an arm that never walked out is the control run
      // again under a different name.
      expect(everLeft, 'nobody ever walked out early — nothing was measured')
        .toBeGreaterThan(0);
      expect(stay.left, 'the control walked out too').toBe(0);

      // READ THE FIRST ARM, AND DISCOUNT THE REST. Above a threshold of 12 the
      // walk-out count runs past the seed count — 141, 246, 275 retreats over
      // 120 landings — which is a band founding, leaving, founding on ground
      // just as poor and leaving again. Those arms are measuring a loop, not a
      // strategy, and their death tolls are inflated by it. The honest reading
      // is `under 12`: 37 retreats over 120 seeds, at most one a band, a
      // genuine "this ground is bad, get off it". It still saved 4 and killed
      // 10.
      //
      // NO BAR ON THE OUTCOME, for the same reason the sibling above carries
      // none: nobody is tuning toward a number here. What the console line is
      // for is the ruling — whether the verb has a right moment anywhere, or
      // whether the panel is offering a choice that is wrong at every hour.
      // `anyPaid` is reported rather than asserted so that a future change
      // which GIVES it a case shows up as a changed line and not a failure.
      // eslint-disable-next-line no-console
      console.log(`  a threshold that pays: ${anyPaid ? 'YES' : 'none of them'}`);
    });
});

describe('PROBE: is the wall up before it is needed', () => {
  /**
   * 9.4, AND THE ITEM'S HEADLINE IS AN ARTIFACT. It was written on "the
   * rarest of twelve buildings at 13 of 60", which is `settlement.built` read
   * at the END — and a tier that `replaces` its predecessor CONSUMES it, so
   * every earthworks in the tally is a palisade that was raised and then
   * buried. Counted as it happens: palisade 38 of 60, fifth of twelve, ahead
   * of the storehouse and the mead hall. The wall is not rare.
   *
   * What survives of the item is the half about TIMING — "no reason the
   * player feels before their first raid". That is a real question and this
   * is the measurement for it: when the first raid lands, was there a wall?
   *
   * Reported, not barred. Whether the answer wants a change is a design call,
   * and this file has shipped enough numbers that got read as verdicts.
   */
  it('says whether a wall stood when the first raid came', { timeout: 900_000 }, () => {
    const SEEDS = 120;
    for (const TERMS of ['even', 'fair'] as HardshipId[]) {
      let raided = 0;        // sagas that saw a raid at all
      let walled = 0;        // ... with a wall standing when the first came
      let everWalled = 0;    // sagas that raised a wall at some point
      let wallDay = 0;       // the day the wall went up, summed
      let firstRaidDay = 0;  // the day the first raid came, summed
      let lateWall = 0;      // raised a wall, but only AFTER the first raid
      for (let s = 0; s < SEEDS; s += 1) {
        let wallOn: number | null = null;
        let firstRaid: number | null = null;
        run(`curve-${s}`, 400, (before, after) => {
          if (wallOn === null && standsFor(after, 'palisade')) wallOn = after.day;
          if (firstRaid === null && after.tally.raids > before.tally.raids) {
            firstRaid = after.day;
          }
        }, TERMS);
        if (wallOn !== null) { everWalled += 1; wallDay += wallOn; }
        if (firstRaid === null) continue;
        raided += 1;
        firstRaidDay += firstRaid;
        if (wallOn !== null && wallOn <= firstRaid) walled += 1;
        else if (wallOn !== null) lateWall += 1;
      }
      const pc = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : 'n/a');
      // eslint-disable-next-line no-console
      console.log(
        `the wall and the first raid [${TERMS}] over ${SEEDS} seeds — ` +
        `${everWalled} ever raised one (day ${everWalled ? Math.round(wallDay / everWalled) : 0} on average):\n` +
        `  ${raided} sagas were raided, first on day ` +
        `${raided ? Math.round(firstRaidDay / raided) : 0} on average\n` +
        `  a wall stood when it came: ${walled} (${pc(walled, raided)}); ` +
        `raised one only afterwards: ${lateWall}; never: ${raided - walled - lateWall}`,
      );
    }
  });
});

describe('PROBE: what becomes of the named foe', () => {
  /**
   * 9.5, and the item's ratio needs three things checked before it is read as
   * "the villain never recurs".
   *
   * ONE: the tally it comes from runs to DAY 169 — under two years. A
   * champion put down on day 100 has sixty-nine days for his clan to anoint
   * another and send him at us again, and most sagas are over before that.
   *
   * TWO: it counts a "return" only when the champion carries SCARS, so a
   * newly anointed one — the clan's second man, a real recurrence of the
   * threat if not of the person — is invisible to it.
   *
   * THREE: the bot hunts him with every verb it has. `step` picks the
   * champion first for strike, for the spear and for the throw, which is an
   * optimal player rather than an average one; a player who simply hits
   * whoever is in front sees a different game.
   *
   * So this counts FATES over a full run: how a champion-led fight ended for
   * the man with the pennant, and how often the same man came back.
   */
  it('counts how a champion leaves the field, and how often he comes back',
    { timeout: 900_000 }, () => {
      const SEEDS = 60;
      for (const TERMS of ['even', 'fair'] as HardshipId[]) {
        let led = 0;        // fights a named foe led
        let ofClan = 0;     // ... of which a CLAN's, so he could return at all
        let down = 0;       // he was put down
        let fled = 0;       // he ran
        let stood = 0;      // still standing when it ended
        let scarred = 0;    // fights led by a man who had led before
        for (let s = 0; s < SEEDS; s += 1) {
          run(`curve-${s}`, 400, (before, after) => {
            if (!before.battle && after.battle?.champion) {
              led += 1;
              if (after.battle.championOf) {
                ofClan += 1;
                const clan = before.neighbours.find((n) => n.id === after.battle!.championOf);
                if ((clan?.champion?.scars ?? 0) > 0) scarred += 1;
              }
            }
            // The moment the field settles, read what became of him.
            if (before.battle && !before.battle.outcome && after.battle?.outcome
              && after.battle.champion) {
              const him = after.battle.combatants.find(
                (c) => c.personId === after.battle!.champion);
              if (!him) return;
              if (him.down) down += 1;
              else if (him.fled) fled += 1;
              else stood += 1;
            }
          }, TERMS);
        }
        const pc = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : 'n/a');
        // eslint-disable-next-line no-console
        console.log(
          `the named foe [${TERMS}] over ${SEEDS} sagas — ${led} fights he led, ` +
          `${ofClan} of them a clan's (only those can ever return):\n` +
          `  he was put down ${down} (${pc(down, down + fled + stood)}), ` +
          `ran ${fled} (${pc(fled, down + fled + stood)}), ` +
          `was still standing ${stood} (${pc(stood, down + fled + stood)})\n` +
          `  led by a man who had led before: ${scarred} of ${ofClan} (${pc(scarred, ofClan)})`,
        );
      }
    });
});

describe('the sea is reached — the probes', () => {
  /**
   * PROBE: what is a pair of hands worth?
   *
   * Written for the voyage, because every lever that would make a crossing
   * pay runs through this one number. She brings back three people; if three
   * people are worth little, no amount of them makes the season back.
   *
   * Three extra hands landed on the same day, same seeds, against nothing.
   * `takeIn` over the roof, which is what the voyage itself does.
   */
  it('PROBE: what a pair of hands is worth', { timeout: 1_800_000 }, async () => {
    const SEEDS = 40;
    const rows: string[] = [];
    for (const extra of [0, 3, 6]) {
      let lived = 0;
      let days = 0;
      let souls = 0;
      let food = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        let landed = false;
        const state = run(`hands-${s}`, 400, (_before, after) => {
          // On the first settled day past the first winter, so the gift lands
          // on a going concern rather than on a band still walking.
          if (!landed && extra > 0 && after.settlement && after.day > 100 && !after.end) {
            landed = true;
            takeIn(after, extra, 'a probe put them there', true);
          }
        }, 'even');
        days += state.day;
        souls += living(state.party.people).length;
        food += state.party.food;
        if (!state.end) lived += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      rows.push(
        `  +${extra} hands  ${lived}/${SEEDS} standing at day 400, ${days} days lived, ` +
        `${souls} souls between them, ${food} food in store`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`PROBE what a pair of hands is worth — ${SEEDS} landings each:\n${rows.join('\n')}`);
    expect(rows).toHaveLength(3);
  });

  /**
   * PROBE, for queue item 27: does anybody ever sail home, and does it pay?
   *
   * Item 27 proposes two elaborations of the voyage — a cargo manifest so
   * loading is a decision, and a season of cards at sea so the crossing is
   * lived through rather than waited out. Both assume there is a voyage to
   * elaborate. There was not: `sailForHome` has existed since the ship became
   * a place and no bot had ever issued it, so the crossing, what she brings
   * back and the season without those hands were all unmeasured.
   *
   * Unlike the sea before the fishing errand, the door was never shut —
   * 'home' rides the same picker as trade and raid. The bot simply never
   * reached for it, so the first thing this needed was a bot that does.
   *
   * The A/B runs the same landings with the voyage available and with it
   * refused, which is what separates "the voyage pays" from "bands that can
   * afford a voyage were doing well anyway".
   *
   * WHAT IT FOUND, and neither half of item 27 was built on the strength of
   * it: the voyage is a bad bargain, not merely a rare one.
   *
   * Under a sane gate she sails about five times in forty sagas and changes
   * nothing — spring only, because 78 days away means she must be back before
   * the mark matters, and spring is the leanest the store ever is. Of 2527
   * spring days past the first winter, 2471 were simply too poor to spare a
   * season. Loosening the purse from thirty days of food to ten moved that
   * to five crossings and left survival flat.
   *
   * The forced arm is the one that answers it. Told to take every crossing
   * `sailBlocker` allowed, bands sailed 26 times, fetched 40 people across
   * the ocean — and went from 5 of 40 standing at day 400 to 3, living a
   * fifth fewer days. There is no setting at which the voyage is both common
   * and good. Two hands gone through a growing season cost more than twenty
   * food and three people return.
   *
   * Which makes sense of a note left in sim/voyage.ts when it was written.
   * Gated on `roomLeft` the voyage brought back nobody and was called "a
   * trap, not a decision"; the fix was to land people over the roof, on the
   * grounds that "crowding is what makes a hall sick". Item 25 then measured
   * `crowding` returning zero on every settled day of sixty sagas. So the
   * extra people cost the hall nothing AND buy it too little, and the fix
   * for the trap was resting on a mechanic that never fires.
   *
   * A cargo manifest and a season of cards at sea would both be elaborations
   * of that. The crossing has to be worth taking before it is worth
   * decorating.
   *
   * AND THEN IT WAS MADE WORTH TAKING, on 2026-08-24, and this probe is what
   * drove it. Two changes, both of which this readout argued for:
   *
   *   - `provisioning` — a season of food and a season of wood banked before
   *     she may sail at all. Not a tax: the store is what decides whether the
   *     people she brings are hands or mouths.
   *   - settlers arrive with a season's eating each (`SETTLER_STORES`). The
   *     hold used to return a flat share of itself whoever was aboard, and
   *     twenty food feeds three arrivals for two days.
   *
   * The second is the one that mattered, and the first cut of the fix was a
   * different change that made things WORSE: shortening the crossing to two
   * seasons, on the theory that the problem was a payback period. It read 3
   * of 40 standing against 4, because what comes home sooner is not only
   * hands, it is mouths. The band is food-limited, not hand-limited, and
   * every measurement taken this day says so from a different direction.
   *
   * Where it landed: 6 of 40 standing at day 400 against 5 with the voyage
   * refused, 138 souls against 127. The forced arm — every crossing she can
   * take, any season — reads 6 and 141, which is the part that says it is no
   * longer a trap. It was 3 and 108 before.
   */
  it('PROBE: whether the voyage home pays for the season it costs', { timeout: 1_800_000 }, async () => {
    const SEEDS = 40;
    interface Arm {
      sailed: number;      // sagas that ever sent her
      voyages: number;     // crossings begun
      returned: number;    // crossings that came home
      brought: number;     // people fetched across the ocean
      rough: number;       // crossings the sea took a strake out of
      lived: number;
      days: number;
      souls: number;       // living at the end, summed
      settledDays: number;
      notSpring: number;
      tooSoon: number;
      tooPoor: number;
      couldHaveGone: number;
      blocked: Record<string, number>;
      hadFood: number[];
      hadWood: number[];
      wantFood: number[];
      wantWood: number[];
      /**
       * PER SEED, because the aggregates above cannot answer the question in
       * this probe's own name.
       *
       * Only six of forty sagas ever sail, so thirty-four of the rows in each
       * arm are the SAME RUN TWICE and every aggregate difference is driven
       * by six. "205 souls against 200" reads like a finding and is six sagas
       * of noise. Paired on the seeds that actually differ, it is a reading.
       */
      per: { sailed: boolean; lived: boolean; souls: number; days: number }[];
    }
    const arms: Record<string, Arm> = {};

    for (const [label, sails, anySeason] of [
      ['no voyage', false, false],
      ['may sail', true, false],
      // THE FORCED ARM, kept from the measurement that found the voyage was a
      // trap: sails in any season the moment `sailBlocker` allows. It is not
      // a strategy, it is the control that separates "the gate never opens"
      // from "the crossing is not worth taking".
      ['whenever', true, true],
    ] as const) {
      const arm: Arm = {
        sailed: 0, voyages: 0, returned: 0, brought: 0, rough: 0, lived: 0, days: 0, souls: 0,
        settledDays: 0, notSpring: 0, tooSoon: 0, tooPoor: 0, couldHaveGone: 0, blocked: {},
        hadFood: [], hadWood: [], wantFood: [], wantWood: [], per: [],
      };
      const was = policy;
      setPolicy({ ...SETTLER, sails, sailAnySeason: anySeason });
      try {
        for (let s = 0; s < SEEDS; s += 1) {
          let sentOne = false;
          const state = run(`sail-${s}`, 400, (before, after) => {
            // WHY SHE DOES NOT GO, counted at the moment of the choice. The
            // gate has six clauses and "she rarely sails" says nothing about
            // which one is doing the refusing.
            if (before.settlement && !before.end) {
              arm.settledDays += 1;
              const crew = sworn(before.party.people).slice(0, 2).map(p => p.id);
              if (seasonOf(before.day) !== 'autumn' && !anySeason) arm.notSpring += 1;
              else if (wintersStood(before.day) < 1) arm.tooSoon += 1;
              else {
                const why = sailBlocker(before, crew);
                if (why) arm.blocked[why] = (arm.blocked[why] ?? 0) + 1;
                else arm.couldHaveGone += 1;
                // What a band ACTUALLY has standing on an eligible day,
                // against what the rule asks of it. A threshold picked
                // without this is a threshold picked by feel.
                const need = provisioning(before);
                arm.hadFood.push(before.party.food);
                arm.hadWood.push(before.party.firewood);
                arm.wantFood.push(need.food);
                arm.wantWood.push(need.firewood);
              }
            }
            if (!before.voyage && after.voyage) { arm.voyages += 1; sentOne = true; }
            if (before.voyage && !after.voyage) {
              arm.returned += 1;
              const home = living(after.party.people).length - living(before.party.people).length;
              if (home > 0) arm.brought += home;
              if (sprung(after.ship) > sprung(before.ship)) arm.rough += 1;
            }
          }, 'even');
          if (sentOne) arm.sailed += 1;
          arm.days += state.day;
          arm.souls += living(state.party.people).length;
          if (!state.end) arm.lived += 1;
          arm.per.push({
            sailed: sentOne,
            lived: !state.end,
            souls: living(state.party.people).length,
            days: state.day,
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        setPolicy(was);
      }
      arms[label] = arm;
    }

    const pct = (xs: number[], p: number): string => {
      if (xs.length === 0) return '-';
      const sorted = [...xs].sort((x, y) => x - y);
      return String(Math.round(sorted[Math.floor((sorted.length - 1) * p)]!));
    };
    const med = (xs: number[]): string => pct(xs, 0.5);
    void med;
    const rows = Object.entries(arms).map(([label, a]) =>
      `  ${label.padEnd(10)} ${a.sailed}/${SEEDS} sagas sailed, ${a.voyages} crossings ` +
      `(${a.returned} came home, ${a.rough} rough), ${a.brought} people fetched; ` +
      `${a.lived}/${SEEDS} still standing at day 400, ${a.souls} souls between them, ` +
      `${a.days} days lived\n` +
      `             of ${a.settledDays} settled days: ${a.notSpring} not spring, ${a.tooSoon} ` +
      `before the first winter, ${a.tooPoor} too poor to spare a season, ` +
      `${a.couldHaveGone} clear to go; blocked ` +
      `${Object.entries(a.blocked).map(([k, v]) => `${k} ${v}`).join(', ') || 'never'}\n` +
      `             on an eligible day the hall HAD food ${med(a.hadFood)} wood ${med(a.hadWood)}; ` +
      `the rule WANTS food ${med(a.wantFood)} wood ${med(a.wantWood)} ` +
      `(food 90th pct ${pct(a.hadFood, 0.9)}, wood 90th pct ${pct(a.hadWood, 0.9)})`,
    );
    // eslint-disable-next-line no-console
    console.log(`PROBE the voyage home — ${SEEDS} landings each, same seeds:\n${rows.join('\n')}`);

    // PAIRED ON THE SEEDS THAT ACTUALLY SAILED, which is the only comparison
    // in this probe that can answer its own title.
    //
    // Six of forty sagas ever send her, so thirty-four rows of each arm above
    // are the same run twice and every aggregate difference is six sagas
    // wide. Read straight, "205 souls against 200" looks like the crossing
    // costing five lives; restricted to the sagas that differ, it is a
    // reading about six of them and is reported with its own N attached so
    // nobody mistakes it for forty.
    // WHAT IT READ AT A SAMPLE THE TREATMENT ACTUALLY FIRES IN, 2026-08-30.
    // Forty seeds gives six sailing sagas, which cannot answer anything; run
    // once at 200 it gives thirty, and the answer is clear:
    //
    //   no voyage  0/200 sailed,                          26/200 standing, 1179 souls
    //   may sail  30/200 sailed, 43 crossings, 82 fetched, 22/200 standing, 1169 souls
    //   whenever  32/200 sailed, 47 crossings, 91 fetched, 24/200 standing, 1160 souls
    //   paired on the 30 that sailed [may sail] — saved 3, KILLED 7, -10 souls
    //   paired on the 32 that sailed [whenever] — saved 4, KILLED 6, -19 souls
    //
    // The crossing kills about two bands for every one it saves, and brings
    // home eighty-two people while leaving fewer alive at the end. src/sim/
    // voyage.ts already named the cause before this confirmed it: what comes
    // home is not only hands, it is MOUTHS, and the hall's binding constraint
    // was never labour.
    //
    // Left at 40 here because that is what the suite can afford every run;
    // the number above is what it says when asked properly.
    const control = arms['no voyage']!;
    for (const label of ['may sail', 'whenever']) {
      const arm = arms[label]!;
      const idx = arm.per.map((r, i) => (r.sailed ? i : -1)).filter((i) => i >= 0);
      if (idx.length === 0) continue;
      let saved = 0;
      let killed = 0;
      let souls = 0;
      let days = 0;
      for (const i of idx) {
        const a = arm.per[i]!;
        const c = control.per[i]!;
        if (!c.lived && a.lived) saved += 1;
        if (c.lived && !a.lived) killed += 1;
        souls += a.souls - c.souls;
        days += a.days - c.days;
      }
      // eslint-disable-next-line no-console
      console.log(
        `  paired on the ${idx.length} sagas that sailed [${label}] — ` +
        `saved ${saved}, killed ${killed}; ` +
        `${souls >= 0 ? '+' : ''}${souls} souls, ${days >= 0 ? '+' : ''}${days} days`,
      );
    }

    // A probe: it asserts its instrument ran, not a rate. The bot has to be
    // ABLE to sail, or this measures nothing at all — which is the state it
    // was written to end.
    expect(arms['may sail']!.voyages, 'the bot still never sails — this probe measures nothing')
      .toBeGreaterThan(0);
    expect(arms['no voyage']!.voyages).toBe(0);
  });

  /**
   * PROBE, for queue item 25: what is illness worth, and what is a healer?
   *
   * Item 25 proposes herbs as the healer's input — a stock gathered in summer
   * that tending draws on. Its own framing carries the doubt worth measuring
   * first: does gating care behind a stock make the healer a DECISION, or
   * just a chore? A resource nobody gathers, feeding a job nobody crews, to
   * answer a problem nobody has, would be three layers of decoration.
   *
   * So this measures the layers underneath before anything is built on them:
   * how much illness a saga actually carries, how much of it is the spread
   * rule rather than the cold nights that were always there, and what
   * crewing a healer is worth against the same landings crewed without one.
   *
   * The A/B is the point. "The bot never crews a healer" is not evidence the
   * healer is worthless — the default crew simply has no healer in it, which
   * is a fact about the harness. Running the same seeds both ways is what
   * separates the two.
   *
   * WHAT IT FOUND, in two passes, and the first pass was WRONG.
   *
   * It read "a healer crewed for 364 days took illness from 0.48 person-days
   * per day lived to 0.46 and changed survival by nothing at all — 17 of 30
   * saw spring in both arms", and concluded the healer was a job with no
   * measurable output. That conclusion was the INSTRUMENT, and it is exactly
   * the error this file has caught three times before in other clothes.
   *
   * `saw spring` was the outcome being counted, and nearly every band sees a
   * first spring — so the number could not separate two arms and read 17 of
   * 30 whatever happened downstream of it. Counting bands STILL STANDING when
   * the harness stops, on the same seeds and the same code, the two arms are
   * 4 of 30 against 7, and the days lived between them differ by an eighth:
   * 4570 against 5147. The healer was never worthless. The measure was blunt.
   *
   * So item 25's verdict stands only in its narrow part — herbs would have
   * been a chore — and its stated reason was false. The job pays.
   *
   * The mechanism is the second line of the readout. `crowding` returned
   * zero on EVERY settled day of sixty sagas, because the roof runs a long
   * way ahead of the band: 8.1 souls to 14.6 of room on the average settled
   * day, and the most crowded moment any saga ever reached was 19 souls to
   * 19 of roof. So `CROWD_BITE` never multiplies anything, spread runs at
   * its floor rate of `CATCHING * down`, and `CARE_GUARD` is a guard against
   * a floor. The crowding tradeoff item 8 was built around — another pair of
   * hands is more work and one more chest by the fire — cannot happen.
   *
   * Kept as an instrument. Any work that means to make crowding bite has to
   * move the second line — it is still zero, and still means `CROWD_BITE`
   * multiplies nothing.
   *
   * A LESSON ABOUT THIS PROBE ITSELF, since it has now misled once: an A/B
   * is only as sharp as the thing it counts. Pick an outcome most bands do
   * not reach, or the arms will agree no matter what the code does.
   *
   * The first cut of this measured neither, and its error is worth keeping:
   * it swapped the BUILDER out for the healer and read the healer arm as
   * twice as ill per day lived. That is what losing the builder does — no
   * builder, no shelter, and shelter is what stops the cold nights that hand
   * out `ill_`. An A/B is only an A/B if one thing changed.
   */
  it('PROBE: what illness costs, and what a healer buys', { timeout: 900_000 }, async () => {
    const SEEDS = 30;
    // A FARMER's place, not the builder's. The first cut of this swapped the
    // builder out and read the healer arm as more than twice as ill per day
    // lived — which is not what care does, it is what losing the builder
    // does: no builder means no shelter, and shelter is what stops the cold
    // nights that hand out `ill_` in the first place. The arm was measuring
    // the hole, not the healer.
    const HEALER: JobId[] = ['farmer','healer','woodcutter','hunter','builder','warrior'];

    interface Arm {
      illDays: number;   // person-days spent carrying something
      newlyIll: number;  // new illnesses of any cause, cold nights included
      crowdDays: number; // settled days with more bodies than roof
      lived: number;     // still standing when the harness stopped
      settled: number;
      days: number;
      careDays: number;  // settled days with any tending at all
      mostSouls: number; // the largest the band ever got
      mostRoom: number;  // and the most roof it ever had
      settledDays: number;
      soulSum: number;
      roomSum: number;
      roofFrom: Record<string, number>;
      slack: number[];
    }
    const arms: Record<string, Arm> = {};

    for (const [label, crew] of [['no healer', CREW], ['a healer', HEALER]] as const) {
      const arm: Arm = {
        illDays: 0, newlyIll: 0, crowdDays: 0, lived: 0, settled: 0, days: 0, careDays: 0,
        mostSouls: 0, mostRoom: 0, settledDays: 0, soulSum: 0, roomSum: 0, roofFrom: {}, slack: [],
      };
      const was = policy;
      setPolicy({ ...SETTLER, crew });
      try {
        for (let s = 0; s < SEEDS; s += 1) {
          const state = run(`ill-${s}`, 400, (before, after) => {
            const down = ailingCount(after);
            arm.illDays += down;
            // New illness of ANY cause. Not the spread rule's own count —
            // cold nights hand out `ill_` too, and most of this is them.
            if (down > ailingCount(before)) arm.newlyIll += 1;
            if (after.settlement) {
              if (crowding(after) > 0) arm.crowdDays += 1;
              if (careToday(after) > 0) arm.careDays += 1;
              const souls = living(after.party.people).length;
              if (souls > arm.mostSouls) arm.mostSouls = souls;
              const room = capacity(after);
              if (room > arm.mostRoom) arm.mostRoom = room;
              // WHAT THE ROOF IS MADE OF. Item 30's question: the roof runs
              // far ahead of the band, and whether that is fixable depends
              // entirely on whether the room was BUILT FOR or came free with
              // something the band wanted anyway.
              for (const id of after.settlement.built) {
                const def = BUILDINGS.find((b) => b.id === id);
                if (!def?.room) continue;
                arm.roofFrom[id] = (arm.roofFrom[id] ?? 0) + def.room;
              }
              // HOW CLOSE IT EVER COMES. "Never crowded" is a fact about a
              // threshold; the slack is a fact about the shape, and it says
              // whether crowding is a near miss or was never in the running.
              arm.slack.push(room - souls);
              arm.settledDays += 1;
              arm.soulSum += souls;
              arm.roomSum += room;
            }
          }, 'even');
          arm.days += state.day;
          if (state.settlement) arm.settled += 1;
          // STILL STANDING, not "saw spring". Nearly every band sees a first
          // spring, so that number cannot separate two arms — it read 17 of
          // 30 both ways while the days lived between them differed by an
          // eighth.
          if (!state.end) arm.lived += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        setPolicy(was);
      }
      arms[label] = arm;
    }

    const pct = (xs: number[], p: number): string => {
      if (xs.length === 0) return '-';
      const sorted = [...xs].sort((x, y) => x - y);
      return String(Math.round(sorted[Math.floor((sorted.length - 1) * p)]!));
    };
    const med = (xs: number[]): string => pct(xs, 0.5);
    void med;
    const sortPct = (xs: number[], p: number): number => {
      const sorted = [...xs].sort((x, y) => x - y);
      return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
    };
    const rows = Object.entries(arms).map(([label, a]) =>
      `  ${label.padEnd(10)} ${a.illDays} person-days ill (${(a.illDays / Math.max(1, a.days)).toFixed(2)} ` +
      `per day lived), ${a.newlyIll} new illnesses, ${a.crowdDays} crowded days, ` +
      `${a.careDays} days tended; ${a.lived}/${SEEDS} still standing at day 400, over ${a.days} days lived\n` +
      `             band ${(a.soulSum / Math.max(1, a.settledDays)).toFixed(1)} souls to ` +
      `${(a.roomSum / Math.max(1, a.settledDays)).toFixed(1)} of roof on the average settled day ` +
      `(most ever ${a.mostSouls} souls, ${a.mostRoom} roof)\n` +
      `             the roof came from: ${Object.entries(a.roofFrom)
        .sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `${k} ${Math.round((v / Math.max(1, a.roomSum)) * 100)}%`)
        .join(', ') || 'nothing'}\n` +
      `             spare beds on a settled day: tightest ${Math.min(...a.slack)}, ` +
      `10th pct ${sortPct(a.slack, 0.1)}, median ${sortPct(a.slack, 0.5)}`,
    );
    // eslint-disable-next-line no-console
    console.log(`PROBE illness and the healer — ${SEEDS} landings each, same seeds:\n${rows.join('\n')}`);

    // A probe: it asserts its instrument ran, not a rate.
    expect(arms['no healer']!.settled).toBeGreaterThan(0);
    expect(arms['a healer']!.settled).toBeGreaterThan(0);
  });

  /**
   * PROBE, for queue item 23: how much water does a saga actually touch?
   *
   * Named waters and tidal races are both bets on the same premise — that
   * the sea is a place the band moves AROUND in, with stretches distinct
   * enough to be worth a name and pinches narrow enough to be worth a cost.
   * The world's geometry says that premise is plausible: 12 worlds measured
   * 123 coastal-water hexes each in 4.6 connected bodies, 2.7 of them eight
   * hexes or more, and 5.2 gates — water with land on four sides and its two
   * wet neighbours not touching, so a hull must pass THROUGH rather than
   * around.
   *
   * But geometry is the map, not the saga. What decides whether either
   * feature is content or decoration is how much of that water a band ever
   * enters, and the answer was no: 0.0 true gates entered in forty sagas,
   * 0.0 waters ever a third uncovered. Neither feature was built.
   *
   * The line that says WHY is the last one, and it is the reason this probe
   * is kept rather than deleted with the idea it killed. The sea is not
   * refused — it is OFFERED, on a fifth of every band's moving days, a third
   * of the menu on those days — and declined 94 times in a hundred. Nothing
   * on the water is worth going to, so nobody goes, so every feature laid on
   * top of the water is content behind a door nobody opens.
   *
   * Measured on the RAIDER, deliberately: it is the most sea-inclined band
   * the harness has, the only policy that leaves under arms at all. The
   * settler does not sail by identity rather than by gap. So this is the
   * GENEROUS reading, and it still reads 5.6%.
   *
   * Kept as a probe rather than a bar because it is an instrument, not a
   * promise: any future work that means to give the sea a reason should move
   * these numbers, and this is what it will be read against.
   */
  it('PROBE: how much of the coast a saga actually rows', { timeout: 900_000 }, async () => {
    // The hex version of this probe measured water BODIES: coastal hexes,
    // gates, pinches, and how much of each named water a saga uncovered. A
    // line has none of that — rowing is a step, not a state, and the sea is
    // off every stretch — so what is left to ask is the only question the
    // original was really for: does the band ever spend a day at the oars,
    // and does it ever work a fishing ground.
    const SEEDS = 40;
    let sagas = 0;
    let wetSagas = 0;
    let stretchesRowed = 0;
    let groundsOnCoast = 0;
    let groundsKnown = 0;
    let groundsWorked = 0;
    let sagasSeeingOne = 0;
    let dayGroundNear = 0;
    let dayNearButFed = 0;
    let dayNearButSettled = 0;
    let dayNearButStuck = 0;
    let dayNearAndFree = 0;
    let daysWithAChoice = 0;
    const spans: number[] = [];

    setPolicy(RAIDER);
    try {
      for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
        for (let s = 0; s < SEEDS / 2; s += 1) {
          const wet = new Set<number>();
          const state = run(armSeed(arm, s, SEEDS / 2), 400, (before, after) => {
            if (walkOptions(before).length > 0) daysWithAChoice += 1;
            // A ground the band knows of and could reach in a day or two: the
            // number that says whether reach or reward is the binding thing.
            const here = standingAt(before);
            const near = nearestStop(before, (st) => groundAtStop(before.seed, st), 3);
            if (near !== null || groundAtStop(before.seed, here)) {
              dayGroundNear += 1;
              const fed = before.party.food / Math.max(1, foodPerDay(before));
              if (fed >= 6) dayNearButFed += 1;
              else if (before.settlement && !before.expedition) dayNearButSettled += 1;
              else if (walkOptions(before).length === 0) dayNearButStuck += 1;
              else dayNearAndFree += 1;
            }
            const to = standingAt(after);
            const span = Math.abs(to - here);
            // A day that covered more than one stretch was rowed, and how far
            // it covered is what the ship bought.
            if (span > 1) { wet.add(to); spans.push(span); }
          }, terms);
          sagas += 1;
          if (wet.size > 0) wetSagas += 1;
          stretchesRowed += wet.size;
          let onCoast = 0;
          let known = 0;
          for (let st = 0; st < ROUTE_STOPS; st += 1) {
            if (!groundAtStop(state.seed, st)) continue;
            onCoast += 1;
            if (knowsStop(state, st)) known += 1;
            if (wet.has(st)) groundsWorked += 1;
          }
          groundsOnCoast += onCoast;
          groundsKnown += known;
          if (known > 0) sagasSeeingOne += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      setPolicy(SETTLER);
    }

    const per = (n: number) => (n / Math.max(1, sagas)).toFixed(1);
    const reach = spans.reduce((a, b) => a + b, 0) / Math.max(1, spans.length);
    // eslint-disable-next-line no-console
    console.log(
      `PROBE the water a saga touches — ${sagas} raider sagas to day 400:\n` +
        `  ${wetSagas} ever rowed; ${per(stretchesRowed)} stretches reached by oar per saga\n` +
        `  mean stretches per rowed day: ${reach.toFixed(2)}\n` +
        `  fishing grounds: ${per(groundsOnCoast)} on the coast, ${per(groundsKnown)} ever known ` +
        `(${sagasSeeingOne}/${sagas} sagas knew one), ${per(groundsWorked)} ever worked\n` +
        `  days with a ground within three: ${dayGroundNear} — ${dayNearButFed} well fed, ` +
        `${dayNearButSettled} settled and cannot move, ${dayNearButStuck} no move at all, ` +
        `${dayNearAndFree} hungry and free to go`,
    );

    // The probe asserts only that its instrument still works — that the
    // sample ran, and that the game is still OFFERING what it is being
    // measured for declining. Pinning the take-rate would pin the bot rather
    // than the sea, and the take-rate is the finding, not the promise.
    expect(sagas).toBe(SEEDS);
    expect(daysWithAChoice, 'the band never had a step to choose — this probe measures nothing')
      .toBeGreaterThan(200);
  });
});

describe('PROBE: what the settling floor is worth', () => {
  it('measures holding out, taking anything, and giving way as winter nears',
    { timeout: 900_000 }, () => {
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    const sample = (p: Policy) => {
      setPolicy(p);
      const lived: boolean[] = [];
      let settled = 0;
      let ground = 0;
      let day = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        let noted = false;
        const final = run(`winter-inside-${s}`, SPRING_IN, (before, after) => {
          if (!noted && !before.settlement && after.settlement) {
            noted = true;
            // The ground the posts actually went into — see the note on the
            // same read in the settling probe above.
            ground += stopReport(after.seed, after.settlement.stop ?? 0).total;
            day += after.day;
            settled += 1;
          }
        }, 'even');
        lived.push(!final.end && final.day >= SPRING_IN);
      }
      return {
        saw: lived.filter(Boolean).length,
        lived,
        settled,
        ground: settled ? ground / settled : 0,
        day: settled ? day / settled : 0,
      };
    };

    // The old bot is named explicitly rather than spelled `SETTLER`, because
    // SETTLER now RELAXES — this measurement is why. Pairing is against the
    // old one, so the table reads as "what the change bought".
    const arms: [string, Policy][] = [
      ['the old bot (fixed floor 9)', { ...SETTLER, id: 'fixed', relaxFrom: undefined }],
      ['today (gives way from 14)', { ...SETTLER }],
      ['takes anything (floor 0)', { ...SETTLER, id: 'rash', siteFloor: 0 }],
    ];
    const out = arms.map(([label, p]) => ({ label, r: sample(p) }));
    setPolicy(SETTLER);

    for (const { label, r } of out) {
      // eslint-disable-next-line no-console
      console.log(
        `[floor] ${String(label).padEnd(26)} settled ${String(r.settled).padStart(3)}/${SEEDS}, ` +
          `ground ${r.ground.toFixed(1)}, day ${r.day.toFixed(0)}, ` +
          `saw spring ${r.saw}/${SEEDS}`,
      );
    }
    // Paired against the OLD bot, so the table reads as what the change
    // bought; the seeds where the two agree carry no information either way.
    const base = out[0]!.r;
    for (const { label, r } of out.slice(1)) {
      let saved = 0;
      let killed = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        if (!base.lived[s] && r.lived[s]) saved += 1;
        if (base.lived[s] && !r.lived[s]) killed += 1;
      }
      // eslint-disable-next-line no-console
      console.log(`[floor]   ${String(label).padEnd(24)} vs the old bot: `
        + `saved ${saved}, killed ${killed}`);
    }
  });
});

describe('PROBE: what a lineage actually amounts to', () => {
  /**
   * 9.9's premise, re-taken before anything is built on it. The item reads
   * "the memorial, the lineage and the generations exist and do not talk to
   * each other", and two of those three claims are checkable in the source
   * without a harness at all:
   *
   * - `hallPasses` (sim/household.ts) imports `childrenOf` and names the dead
   *   leader's children, so GENERATIONS talks to LINEAGE;
   * - `maybeBirth` (sim/lineage.ts) reads `kinOf` to record a father, so
   *   LINEAGE talks to the households `maybePair` makes.
   *
   * The one that is genuinely deaf is the MEMORIAL: `fallenOf` maps a person
   * to `{name, byname, fate, day, seed}` and nothing else, so the wall cannot
   * say whose husband, whose mother, or what anybody left.
   *
   * What no source reading can settle is the SIZE — whether a lineage is a
   * thing that happens in a played saga or a feature the odds never reach. A
   * bequest with nothing to bequeath and nobody to bequeath it to is 6.5b's
   * mistake again: a rule that fires twice in a hundred and twenty runs.
   *
   * So this counts, over full runs: births, marriages made after the landing,
   * children who got a father's name, deaths of a leader who left children,
   * and how long the wall's rows are.
   */
  it('counts births, marriages and what the wall is given', { timeout: 900_000 }, () => {
    const SEEDS = 60;
    for (const TERMS of ['even', 'fair'] as HardshipId[]) {
      let sagas = 0;
      let withChild = 0;      // sagas that ever saw a birth
      let births = 0;
      let fathered = 0;       // children recorded with a father
      let weddings = 0;       // households made after the landing
      let withWedding = 0;
      let heirlessLeader = 0; // a leader died leaving no child
      let leaderWithChild = 0;
      let deaths = 0;         // rows the wall would get
      let deadWithKin = 0;    // ... of the dead, how many were bound to somebody
      let deadWithChild = 0;  // ... and how many left a child behind
      let bladeMoved = 0;     // sagas where the blade changed hands at all
      let bladeHands = 0;     // hands it went through, all sagas
      let bladeLaid = 0;      // sagas that ended with it in a chest for a child
      let bladeRows = 0;      // wall rows that carry it
      for (let s = 0; s < SEEDS; s += 1) {
        const end = run(`curve-${s}`, 400, (before, after) => {
          const was = before.settlement?.children.length ?? 0;
          const now = after.settlement?.children.length ?? 0;
          if (now > was) {
            births += now - was;
            for (const c of after.settlement!.children.slice(was)) {
              if (c.father) fathered += 1;
            }
          }
          if ((after.flags['lastPaired'] ?? -1) !== (before.flags['lastPaired'] ?? -1)) {
            weddings += 1;
          }
        }, TERMS);
        sagas += 1;
        // 9.9: does the blade actually move in a played saga, or is it the
        // 6.5b rule again — correct, tested, and fired twice in 128 runs?
        const blade = end.party.blade;
        if (blade) {
          bladeHands += blade.borne.length;
          if (blade.borne.length > 1) bladeMoved += 1;
          if (blade.laidFor) bladeLaid += 1;
          bladeRows += fallenOf(end).filter((row) => row.blade !== undefined).length;
        }
        const kids = end.settlement?.children ?? [];
        if (kids.length > 0) withChild += 1;
        if (end.flags['lastPaired'] !== undefined) withWedding += 1;
        const wall = fallenOf(end);
        deaths += wall.length;
        for (const p of end.party.people) {
          if (p.alive || p.left) continue;
          if (p.kin) deadWithKin += 1;
          if (kids.some((c) => c.mother === p.id || c.father === p.id)) deadWithChild += 1;
          // Whether the hall passed through them: sworn, and nobody ahead.
          if (p.bond !== 'sworn') continue;
          const seat = end.party.people.findIndex((q) => q.id === p.id);
          const ahead = end.party.people.slice(0, Math.max(0, seat))
            .some((q) => q.alive && q.bond === 'sworn');
          if (ahead) continue;
          if (kids.some((c) => c.mother === p.id || c.father === p.id)) leaderWithChild += 1;
          else heirlessLeader += 1;
        }
      }
      const pc = (n: number, of: number) => (of === 0 ? '—' : `${Math.round((n / of) * 100)}%`);
      console.log(
        `a lineage [${TERMS}] over ${sagas} sagas:\n`
        + `  sagas that saw a child born: ${withChild} (${pc(withChild, sagas)}), `
        + `${births} children in all, ${fathered} with a father named\n`
        + `  sagas that saw a wedding after the landing: ${withWedding} `
        + `(${pc(withWedding, sagas)}), ${weddings} weddings in all\n`
        + `  the hall passed from a man who left a child ${leaderWithChild} times, `
        + `from one who left none ${heirlessLeader}\n`
        + `  the wall was given ${deaths} names; ${deadWithKin} (${pc(deadWithKin, deaths)}) `
        + `were bound to somebody, ${deadWithChild} (${pc(deadWithChild, deaths)}) left a child\n`
        + `  the blade changed hands in ${bladeMoved} sagas (${pc(bladeMoved, sagas)}), `
        + `${bladeHands} hands in all, laid by for a child in ${bladeLaid}; `
        + `${bladeRows} wall rows carry it (${pc(bladeRows, deaths)})`,
      );
    }
  });
});

describe('PROBE: what the colony loop actually is', () => {
  /**
   * 9.11's three numbers, re-taken before the largest item in the phase is
   * opened on them. All three date from before 9.12a, and 9.12a exists
   * BECAUSE of them — "the hall must be kept" was built as the answer to
   * "the colony is the least pressured system in the game". A premise that
   * has already been half-answered is exactly the kind this project has been
   * caught inheriting all week.
   *
   * The item reads: 53% of a saga's actions, 33 of 60 bands ever passed six
   * people, the hall runs 9.0 souls to 14.2 of roof and is never full, and by
   * year two the band has more labour than uses for it.
   *
   * The LOAD-BEARING claim is the last one, and it is the only one the other
   * three are evidence for. So this measures it directly rather than by
   * proxy: on a settled day, is there anything left the band could build, and
   * is anybody standing about with no job.
   */
  it('counts the actions, the roster, the roof and the idle hands',
    { timeout: 1_800_000 }, async () => {
      const SEEDS = 60;
      let colony = 0;
      let travel = 0;
      let battle = 0;
      let everPastSix = 0;
      let sagas = 0;
      const whyBlocked = new Map<string, number>();
      // Settled days, split by year, so "by year two" can be checked rather
      // than assumed.
      const byYear = new Map<number, {
        days: number; souls: number; roof: number; crowded: number;
        idle: number; nothingLeft: number; cantAfford: number; queueEmpty: number;
        wood: number;
      }>();
      const bump = (y: number) => {
        if (!byYear.has(y)) {
          byYear.set(y, {
            days: 0, souls: 0, roof: 0, crowded: 0,
            idle: 0, nothingLeft: 0, cantAfford: 0, queueEmpty: 0, wood: 0,
          });
        }
        return byYear.get(y)!;
      };

      for (let s = 0; s < SEEDS; s += 1) {
        let peak = 0;
        let lastDay = 0;
        run(`curve-${s}`, 400, (before, after) => {
          // WHERE THE SAGA'S TIME GOES, and the first cut of this counter read
          // a flat 0% for the colony — because it asked `currentMode(before)
          // === 'COLONY'` and this harness never opens the colony screen: the
          // bot calls `assign` and `queueBuild` on the state directly. That is
          // a reading of the BOT's mode stack, not of the game, and it is the
          // same fault as every other one this file has caught.
          //
          // So it asks where the band is standing instead, which is what "how
          // much of a saga is the colony" actually means.
          if (before.battle) battle += 1;
          else if (before.settlement && atHome(before)) colony += 1;
          else travel += 1;

          const alive = after.party.people.filter((p) => p.alive).length;
          if (alive > peak) peak = alive;

          const home = after.settlement;
          if (!home || after.day === lastDay) return;
          lastDay = after.day;
          const row = bump(Math.floor((after.day - 1) / YEAR_LENGTH) + 1);
          row.days += 1;
          row.souls += alive;
          row.roof += capacity(after);
          if (crowding(after) > 0) row.crowded += 1;
          row.idle += after.party.people.filter((p) => p.alive && !p.job).length;
          if (home.queue.length === 0) row.queueEmpty += 1;
          // THE TWO REASONS THERE IS NOTHING TO START, kept apart, because a
          // count that merges them is a ratio whose denominator selected
          // itself. `buildBlocker` answers 'timber' for a band that is simply
          // out of wood — which is the colony being PRESSED, the opposite of
          // the item's claim — and answers something else when the list is
          // genuinely finished.
          // `standsFor`, NOT `home.built.includes` — and the first cut of this
          // probe used the latter and read "list finished 0%" in every year.
          // A tier that has been UPGRADED is not in `built` any more, so a
          // longhouse replaced by a great hall counted as still to build, and
          // `buildBlocker` duly answered 'built' 5208 times. That is 9.4's
          // finding exactly, made again by the person who wrote it up, and it
          // is the first trap named in CLAUDE.md.
          const unbuilt = BUILDINGS.filter((b) => !standsFor(after, b.id));
          const couldStart = unbuilt.filter((b) => buildBlocker(after, b) === null);
          row.wood += after.party.firewood;
          if (unbuilt.length === 0) row.nothingLeft += 1;
          else if (couldStart.length === 0) {
            row.cantAfford += 1;
            // WHICH refusal, per building, on a day when nothing can start.
            // "Blocked" with a thousand wood in the store is not a store
            // problem, and naming the blocker is the only way to know what it
            // is instead.
            for (const b of unbuilt) {
              const why = buildBlocker(after, b) ?? 'none';
              whyBlocked.set(`${why}`, (whyBlocked.get(`${why}`) ?? 0) + 1);
            }
          }
        }, 'even');
        sagas += 1;
        if (peak > 6) everPastSix += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const acts = colony + travel + battle;
      const pc = (n: number, of: number) => (of === 0 ? '—' : `${Math.round((n / of) * 100)}%`);
      const rows = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, r]) =>
        `  year ${y}: ${r.days} settled days, ${(r.souls / r.days).toFixed(1)} souls to `
        + `${(r.roof / r.days).toFixed(1)} of roof, crowded ${pc(r.crowded, r.days)}, `
        + `${(r.idle / r.days).toFixed(1)} idle hands, `
        + `${(r.wood / r.days).toFixed(0)} wood in store, `
        + `list finished ${pc(r.nothingLeft, r.days)}, `
        + `blocked ${pc(r.cantAfford, r.days)}, `
        + `queue empty ${pc(r.queueEmpty, r.days)}`);
      // eslint-disable-next-line no-console
      console.log(
        `the colony loop over ${sagas} sagas — ${acts} turns: `
        + `colony ${pc(colony, acts)}, travel ${pc(travel, acts)}, battle ${pc(battle, acts)}\n`
        + `  bands that ever passed six people: ${everPastSix} of ${sagas}\n`
        + rows.join('\n')
        + `\n  why nothing could start, per building per blocked day: `
        + [...whyBlocked.entries()].sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${v}`).join(', '),
      );

      // THE INSTRUMENT FIRST. A probe that never sees a settled day, or never
      // sees a second year, measures nothing about a colony loop.
      expect([...byYear.keys()], 'no settled days at all').not.toHaveLength(0);
      expect(byYear.get(2)?.days ?? 0, 'no band reached a second year — nothing to say')
        .toBeGreaterThan(0);
    });
});

describe('PROBE: is the rival ever actually seen', () => {
  /**
   * 9.10's premise, re-taken. The item says there is "no way to watch him",
   * and that is not quite true: `render/strip.ts` marks his hall and every
   * stretch he has fenced, and `render/procession.ts` draws the hall. What is
   * genuinely absent is the SAGA — `sagagen.ts` does not mention him at all,
   * so a run ends without ever saying what the other boat did.
   *
   * But every one of those marks, and every chronicle line he has, is gated
   * on `rival.met` — which needs the band to stand within one stretch of his
   * hall. So the question that decides what 9.10 should build is not "is he
   * drawn" but "is he ever MET". A rival nobody meets is invisible whatever
   * the renderer would have done.
   */
  it('counts how often a band meets him, and how much coast he ends up holding',
    { timeout: 900_000 }, async () => {
      const SEEDS = 60;
      for (const TERMS of ['even', 'fair'] as HardshipId[]) {
        let sagas = 0;
        let exists = 0;
        let met = 0;
        let metBy = 0;          // day of first sight, summed over those met
        let heldSum = 0;        // stretches he holds at the end
        let oursSum = 0;        // stretches the band has trodden
        let blockedEver = 0;    // sagas where his ground ever refused our posts
        let far = 0;            // sagas that ran the whole 400 days
        let farHeld = 0;
        let short = 0;          // sagas that ended first
        let shortHeld = 0;
        for (let s = 0; s < SEEDS; s += 1) {
          let sawOn = 0;
          let blocked = false;
          const end = run(`curve-${s}`, 400, (before, after) => {
            if (!sawOn && !before.rival?.met && after.rival?.met) sawOn = after.day;
            if (!blocked && after.rival && rivalBlocks(after)) blocked = true;
          }, TERMS);
          sagas += 1;
          // Breathe: sixty full sagas twice over is long enough to starve the
          // runner's RPC heartbeat, which fails the run with every test green.
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!end.rival) continue;
          exists += 1;
          const held = (end.rival.claimStops ?? []).length;
          heldSum += held;
          oursSum += Object.keys(end.world.trodStops ?? {}).length;
          // SPLIT BY WHETHER THE SAGA RAN ITS COURSE. `rival.ts` records that
          // he ends holding "a median of six of a possible seven" — measured
          // over 150 coasts walked to the horizon. A played saga mostly ends
          // long before that, so the two numbers are about different things
          // and only one of them is about the game.
          const wentFar = !end.end && end.day >= 400;
          if (wentFar) { far += 1; farHeld += held; }
          else { short += 1; shortHeld += held; }
          if (end.rival.met) { met += 1; metBy += sawOn; }
          if (blocked) blockedEver += 1;
        }
        const pc = (n: number, of: number) => (of === 0 ? '—' : `${Math.round((n / of) * 100)}%`);
        // eslint-disable-next-line no-console
        console.log(
          `the rival [${TERMS}] over ${sagas} sagas — he exists on ${exists}:\n`
          + `  ever came in sight of his hall: ${met} (${pc(met, exists)}), `
          + `first on day ${met ? (metBy / met).toFixed(0) : '-'} on average\n`
          + `  at the end he held ${(heldSum / Math.max(1, exists)).toFixed(1)} stretches; `
          + `we had walked ${(oursSum / Math.max(1, exists)).toFixed(1)}\n`
          + `  his ground refused our posts in ${blockedEver} sagas (${pc(blockedEver, exists)})\n`
          + `  held at the end — ${far} sagas that ran all 400 days: `
          + `${far ? (farHeld / far).toFixed(1) : '-'}; `
          + `${short} that ended sooner: ${short ? (shortHeld / short).toFixed(1) : '-'}`,
        );
      }
    });
});

describe('PROBE: 9.2 sweep — the two levers on the departure side', () => {
  /**
   * 9.2 left three prongs and priced only one. What shipped was the record;
   * what remains is a choice between two levers that the item itself marks
   * UNMEASURED — and a fork nobody can price is a coin flip, not a decision.
   *
   * The finding this has to move: every arm that sails does worse than the
   * arm that never does, and the harm tracks the NUMBER OF CROSSINGS rather
   * than anything about what comes back. Two named causes have already failed
   * a test here (unfunded mouths, and stores landed too late), so the bar for
   * a third explanation is that it survives being swept.
   *
   * The arm is `whenever` — sails the moment `sailBlocker` allows, in any
   * season. Not a strategy: the control that separates "the gate never opens"
   * from "the crossing is not worth taking". Paired against never sailing on
   * the same seeds, because only the seeds that differ carry information.
   *
   * Driven from OUTSIDE: `CROSSING` and `provisioning` are module constants,
   * so the sweep patches src between runs and this probe reports whatever it
   * is handed. It prints the two constants it actually ran under, so a row
   * can never be attributed to the wrong setting.
   */
  it('prices sailing against never sailing, at whatever the constants say',
    { timeout: 1_800_000 }, async () => {
      const SEEDS = 200;
      const outcome = (sails: boolean, anySeason: boolean) => {
        const was = policy;
        setPolicy({ ...SETTLER, sails, sailAnySeason: anySeason });
        const per: { lived: boolean; sailed: boolean }[] = [];
        let voyages = 0;
        let souls = 0;
        try {
          for (let s = 0; s < SEEDS; s += 1) {
            let sent = false;
            const end = run(`sail-${s}`, 400, (before, after) => {
              if (!before.voyage && after.voyage) { voyages += 1; sent = true; }
            });
            per.push({ lived: !end.end && end.day >= 400, sailed: sent });
            souls += end.party.people.filter((p) => p.alive).length;
          }
        } finally { setPolicy(was); }
        return { per, voyages, souls };
      };

      const base = outcome(false, false);
      const arm = outcome(true, true);
      let saved = 0;
      let killed = 0;
      let sailed = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        if (arm.per[i]!.sailed) sailed += 1;
        if (!base.per[i]!.lived && arm.per[i]!.lived) saved += 1;
        if (base.per[i]!.lived && !arm.per[i]!.lived) killed += 1;
      }
      const stood = (r: typeof base) => r.per.filter((p) => p.lived).length;
      // eslint-disable-next-line no-console
      console.log(
        `9.2 sweep — CROSSING=${CROSSING}, a season's provisioning is `
        + `${provisioning(structuredClone(newGame('sail-0'))).food} food:\n`
        + `  never sails: ${stood(base)}/${SEEDS} standing at day 400, ${base.souls} souls\n`
        + `  whenever:    ${stood(arm)}/${SEEDS} standing, ${arm.souls} souls, `
        + `${sailed} sagas sailed, ${arm.voyages} crossings\n`
        + `  PAIRED: sailing saved ${saved} and killed ${killed}`,
      );
      // THE INSTRUMENT FIRST. An arm that never sails is the control twice
      // over, and this file has shipped that mistake before.
      expect(sailed, 'nobody sailed — the sweep measured nothing').toBeGreaterThan(0);
    });
});

describe('PROBE: 9.7 — is warmth ever the thing that decides a winter', () => {
  /**
   * What 9.7 has left to authorise is two WARMTH mechanics — who sleeps under
   * which roof, and what gets burned when the wood runs low. Both are new
   * content, and this phase's lesson is that a mechanic gets measured for a
   * gap before it gets built.
   *
   * EVERY COUNT HERE COMES FROM THE DAY TICK'S OWN BEATS, and the first draft
   * did not. It asked `party.firewood < need` on the state before the tick,
   * which is a second copy of arithmetic the sim already does — and a wrong
   * one, because the fire is banked AFTER the day's labour lands, so wood cut
   * that morning is invisible to it. It read 632 cold nights against the
   * sim's 518: a 22% overcount, in a probe whose whole job is to say whether
   * cold is rare. The naive figure is still taken and printed beside the real
   * one, because the size of that gap is the useful part.
   *
   * The denominator is every night the band banked a fire — not the nights it
   * was short, which could only ever report that bands were short (trap 2).
   */
  it('counts cold nights, hungry nights and what actually ended the run', { timeout: 1_800_000 }, async () => {
    const SEEDS = 120;
    const rows: string[] = [];

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      let nights = 0;
      let winterNights = 0;
      let coldNights = 0;
      let coldWinterNights = 0;
      let hungryNights = 0;
      let naiveCold = 0;
      let anyNights = 0;
      let anyCold = 0;
      let bandsEverCold = 0;
      const ends: Record<string, number> = {};
      let frozenFolk = 0;

      setPolicy(SETTLER);
      for (let i = 0; i < SEEDS; i += 1) {
        let sawCold = false;
        let mark = 0;
        const end = run(armSeed(0, i, SEEDS), 400, (before, after) => {
          if (after.day <= before.day) return;
          const home = Boolean(before.settlement) && atHome(before);
          // The naive reading, kept only to price the trap it fell into.
          if (home) {
            const need = Math.max(0, firewoodPerNight(before) - shelterSaving(before));
            if (before.party.firewood < need) naiveCold += 1;
          }
          for (const b of after.beats ?? []) {
            if (b.n <= mark) continue;
            mark = b.n;
            const winter = seasonOf(b.day) === 'winter';
            if (b.kind === 'burned') {
              const short = (b as { short: number }).short > 0;
              anyNights += 1;
              if (short) anyCold += 1;
              // The home-scoped counters are the ones the naive reading can be
              // compared with, and the ones 9.7's roofs would touch. Keeping
              // both populations apart is not fussiness: the first pass at
              // this scanned every beat and compared it against a home-only
              // predicate, which made the sim look like it was UNDER-counting
              // by a hundred nights when the two were simply not the same
              // nights.
              if (!home) continue;
              nights += 1;
              if (winter) winterNights += 1;
              if (short) {
                coldNights += 1;
                sawCold = true;
                if (winter) coldWinterNights += 1;
              }
            } else if (b.kind === 'ate' && (b as { short: number }).short > 0 && home) {
              hungryNights += 1;
            }
          }
        }, terms);
        if (sawCold) bandsEverCold += 1;
        const cause = end.end?.cause ?? 'still going';
        ends[cause] = (ends[cause] ?? 0) + 1;
        frozenFolk += end.party.people.filter((p) => p.fate === 'the cold').length;
      }

      const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((100 * n) / d)}%`);
      rows.push(
        `  ${terms.padEnd(5)} nights with a fire to bank ${nights}, of them winter ${winterNights}\n`
        + `        cold nights ${coldNights} (${pct(coldNights, nights)} of all, `
        + `${pct(coldWinterNights, winterNights)} of winter ones)\n`
        + `        hungry nights ${hungryNights} (${pct(hungryNights, nights)})\n`
        + `        bands that ever had one cold night: ${bandsEverCold}/${SEEDS}\n`
        + `        people dead of the cold: ${frozenFolk}\n`
        + `        endings: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', ')}\n`
        + `        away from the steading too: ${anyCold} cold of ${anyNights} nights banked anywhere\n`
        + `        (the naive before-the-tick count would have said ${naiveCold})`,
      );

      // The instrument fires. Without this a broken detector and a game where
      // nobody is ever cold print the same zero.
      expect(coldNights, 'no cold night was seen at all — suspect the probe').toBeGreaterThan(0);
      // And the naive count's bias has the sign the docstring explains. If it
      // ever came in LOWER, the explanation above is wrong.
      expect(naiveCold, 'the naive count was not the overcount it is documented as')
        .toBeGreaterThanOrEqual(coldNights);
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 9.7 does warmth bind — ${SEEDS} landings an arm:\n${rows.join('\n')}`);
    expect(rows.length).toBe(2);
  });
});

describe('PROBE: the Phase 10 audit — what a whole saga is actually made of', () => {
  /**
   * Phase 9 closed with every item ruled, and the parking lot holds ideas
   * rather than readings. This is the reading a next phase should be opened
   * from, taken the way 9's own lesson demands: not one item below the line
   * gets written down as a finding until the number under it has been taken
   * fresh, at a stated N, with the instrument named.
   *
   * TWO POLICIES, REPORTED APART AND NEVER MERGED. Half of Phase 9's bad
   * numbers came from reading one bot's habits as a rule of the game, so the
   * settler and the raider are run over the same seeds and printed side by
   * side. Where they disagree, that IS the finding.
   *
   * Everything here is counted off `state.tally`, the fates of the dead and
   * `state.end` — the game's own bookkeeping, not a second copy of it.
   */
  it('counts how sagas end, what battle costs, and how much content is reached', { timeout: 1_800_000 }, async () => {
    const SEEDS = 120;
    const lines: string[] = [];

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as [string, Policy][]) {
      setPolicy(pol);
      const ends: Record<string, number> = {};
      const fates: Record<string, number> = {};
      let battles = 0;
      let raids = 0;
      let sackings = 0;
      let sagasWithAFight = 0;
      let days = 0;
      const everBuilt = new Set<string>();
      let builtHere = 0;
      let settled = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), 400);
        days += s.day;
        ends[s.end?.cause ?? 'still standing'] = (ends[s.end?.cause ?? 'still standing'] ?? 0) + 1;
        const t = s.tally;
        if (t) {
          battles += t.battles;
          raids += t.raids;
          sackings += t.sackings;
          if (t.battles + t.raids > 0) sagasWithAFight += 1;
        }
        for (const p of s.party.people) {
          if (p.alive || p.left) continue;
          fates[p.fate ?? 'unrecorded'] = (fates[p.fate ?? 'unrecorded'] ?? 0) + 1;
        }
        if (s.settlement) {
          settled += 1;
          builtHere += s.settlement.built.length;
          for (const b of s.settlement.built) everBuilt.add(b);
        }
      }

      const top = (r: Record<string, number>, n: number) => Object.entries(r)
        .sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, v]) => `${k} ${v}`).join(', ');

      lines.push(
        `  ${label}: avg ${Math.round(days / SEEDS)} days, settled ${settled}/${SEEDS}\n`
        + `      ends: ${top(ends, 6)}\n`
        + `      the dead, by fate: ${top(fates, 6)}\n`
        + `      fights: ${battles} open + ${raids} at the wall + ${sackings} fallen on`
        + `, over ${sagasWithAFight}/${SEEDS} sagas that saw one\n`
        // STANDING AT THE END, not ever raised — `built` loses a building the
        // day something replaces it, which is the counter CLAUDE.md opens on.
        // So this is a LOWER bound on reach and is labelled as one.
        + `      buildings: ${everBuilt.size} of ${BUILDINGS.length} kinds standing somewhere at the end`
        + `, ${settled > 0 ? (builtHere / settled).toFixed(1) : '0'} standing per settled band`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE Phase 10 audit — ${SEEDS} landings a policy, same seeds:\n${lines.join('\n')}`);
    expect(lines.length).toBe(2);
  });
});

describe('PROBE: 10.1 — is starvation one ending or several', () => {
  /**
   * 10.1 opened on "food ends the game and almost nothing else does": starved
   * plus despair is 100 of 120 sagas. That is a reading about the ENDING
   * SCREEN, and 9.12a already caught this exact class once — the despair
   * ending was renamed starvation when it turned out 28 of 30 despairing
   * bands had an empty larder. **The name of an ending is not the decision
   * that caused it**, so before anyone treats one terminal cause as one
   * repeated decision, the upstream has to be looked at.
   *
   * Two questions, and neither needs a judgement about monotony:
   *   1. Do the starved sagas share a story, or several?
   *   2. Is it already settled by the first winter? A run whose ending is
   *      readable on day 49 is a game decided in its first act, whatever the
   *      last screen says.
   *
   * Same seed run twice — to day 49 and to day 400 — which is the pattern
   * `measured()` already uses, and is sound because the RNG is seeded.
   *
   * DENOMINATORS. The day-49 table is conditioned on the ENDING, which is
   * legitimate (it asks what the doomed looked like early) but is NOT a base
   * rate, so the surviving arm is printed beside it to make the comparison
   * possible. Nothing here reports a ratio whose denominator selected itself.
   */
  it('reads the upstream of every starved saga, and what it looked like on day 49', { timeout: 1_800_000 }, async () => {
    const SEEDS = 120;
    const out: string[] = [];

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      setPolicy(SETTLER);
      // Keyed by ending, so every group is described the same way.
      const group: Record<string, {
        n: number; settled: number; foundedOn: number; day: number;
        band: number; built: number; placeSacks: number; neighbourFalls: number; raids: number;
        violentDead: number; hungerDead: number;
        aliveAt49: number; settledAt49: number; foodAt49: number; bandAt49: number;
      }> = {};

      for (let i = 0; i < SEEDS; i += 1) {
        const seed = armSeed(0, i, SEEDS);
        const early = run(seed, 49, undefined, terms);
        // `tally.sackings` MERGES TWO DIFFERENT DEEDS -- `fallOn` a
        // neighbour's steading and `sackPlace` a coastal prize both note it.
        // The first version of this probe read the merged figure under the
        // SETTLER, whose policy is `raidReach: 0` and `robsCamps: false` -- a
        // bot that never goes out under arms at all -- and reported "despair
        // bands went out raiding most". They cannot have. They plundered
        // PLACES inside `plunderWindow`, before they ever had a steading.
        // Split by watching which of the two actually fired.
        let placeSacks = 0;
        let neighbourFalls = 0;
        const s = run(seed, 400, (before, after) => {
          const was = before.tally?.sackings ?? 0;
          const now = after.tally?.sackings ?? 0;
          if (now <= was) return;
          const sackedBefore = (before.world.places ?? []).filter((pl) => pl.sackedOn !== undefined).length;
          const sackedAfter = (after.world.places ?? []).filter((pl) => pl.sackedOn !== undefined).length;
          if (sackedAfter > sackedBefore) placeSacks += now - was;
          else neighbourFalls += now - was;
        }, terms);
        const key = s.end?.cause ?? 'still standing';
        const g = group[key] ?? (group[key] = {
          n: 0, settled: 0, foundedOn: 0, day: 0, band: 0, built: 0, placeSacks: 0, neighbourFalls: 0,
          raids: 0, violentDead: 0, hungerDead: 0,
          aliveAt49: 0, settledAt49: 0, foodAt49: 0, bandAt49: 0,
        });
        g.n += 1;
        g.placeSacks += placeSacks;
        g.neighbourFalls += neighbourFalls;
        g.day += s.day;
        g.band += living(s.party.people).length;
        if (s.settlement) { g.settled += 1; g.foundedOn += s.settlement.foundedOn; g.built += s.settlement.built.length; }
        g.raids += s.tally?.raids ?? 0;
        for (const p of s.party.people) {
          if (p.alive || p.left) continue;
          const f = p.fate ?? '';
          if (/press|bled out|wound|axe|spear|slain|cut down/i.test(f)) g.violentDead += 1;
          else if (/hunger/i.test(f)) g.hungerDead += 1;
        }
        if (!early.end) {
          g.aliveAt49 += 1;
          if (early.settlement) g.settledAt49 += 1;
          g.foodAt49 += early.party.food;
          g.bandAt49 += living(early.party.people).length;
        }
      }

      const rows = Object.entries(group)
        .sort((a, b) => b[1].n - a[1].n)
        .map(([k, g]) => {
          const per = (x: number) => (g.n === 0 ? 0 : Math.round((10 * x) / g.n) / 10);
          const perAlive = (x: number) => (g.aliveAt49 === 0 ? '—' : String(Math.round((10 * x) / g.aliveAt49) / 10));
          return `    ${k.padEnd(15)} n=${String(g.n).padStart(3)}`
            + ` | ended day ${Math.round(g.day / Math.max(1, g.n))}`
            + ` | settled ${g.settled}/${g.n}${g.settled ? ` on day ${Math.round(g.foundedOn / g.settled)}` : ''}`
            + ` | ${per(g.built)} standing`
            + ` | dead: hunger ${per(g.hungerDead)}, violence ${per(g.violentDead)}`
            + ` | raids at us ${per(g.raids)}, places plundered ${per(g.placeSacks)}, neighbours fallen on ${per(g.neighbourFalls)}`
            + ` || alive at day 49: ${g.aliveAt49}/${g.n}`
            + `, of those settled ${g.settledAt49}, food ${perAlive(g.foodAt49)}, band ${perAlive(g.bandAt49)}`;
        });
      out.push(`  ${terms}:\n${rows.join('\n')}`);
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 10.1 the upstream of starvation — ${SEEDS} landings an arm, settler:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: 10.3 — is it the raiding that loses, or the bundle', () => {
  /**
   * 10.3 opened on "the raider settles more often and dies sooner, 2 bands
   * standing against the settler's 12". That compares two POLICIES, and the
   * two policies differ on at least six axes: `siteFloor` 7 against 9, no
   * `relaxFrom` at all (the settler's is worth saved 20 / killed 1 by its own
   * comment), `plunderWindow` 40 against 24, `trades: false`, a different
   * build order, and a different CREW — `warrior,hunter,hunter,farmer,...`
   * against `farmer,farmer,woodcutter,...`.
   *
   * So the opening reading cannot say anything about raiding. It is the same
   * fault as testing the raider with a settler's site floor, which this
   * harness already made once and wrote down: "a strategy measured with a
   * spec that could not carry it".
   *
   * ONE VARIABLE. The settler, with raiding switched on and NOTHING else
   * changed — same crew, same site rule, same build order, same trading, same
   * seeds. Paired, because the aggregate difference between two arms is only
   * ever as wide as the sagas that actually differ.
   */
  it('turns raiding on for the settler and changes nothing else', { timeout: 1_800_000 }, async () => {
    const SEEDS = 200;
    const RAIDING: Policy = { ...SETTLER, raidReach: 10, raidParty: 6, robsCamps: true };

    const take = (pol: Policy) => {
      setPolicy(pol);
      const rows: { day: number; end: string; jarl: boolean; falls: number; foundedOn: number }[] = [];
      for (let i = 0; i < SEEDS; i += 1) {
        let falls = 0;
        const s = run(armSeed(0, i, SEEDS), 400, (before, after) => {
          const was = before.tally?.sackings ?? 0;
          const now = after.tally?.sackings ?? 0;
          if (now <= was) return;
          const b = (before.world.places ?? []).filter((pl) => pl.sackedOn !== undefined).length;
          const a = (after.world.places ?? []).filter((pl) => pl.sackedOn !== undefined).length;
          if (a <= b) falls += now - was;
        });
        rows.push({
          day: s.day,
          end: s.end?.cause ?? 'still standing',
          jarl: Boolean(s.jarl),
          falls,
          // -1 for a band that never got a roof at all. Needed because an arm
          // that ties its control EXACTLY is usually a knob that never fired,
          // and `relaxFrom` cannot fire for a band already settled by day 14.
          foundedOn: s.settlement?.foundedOn ?? -1,
        });
      }
      return rows;
    };

    // The obvious defence of raiding is that the settler's crew cannot carry
    // it -- two farmers and one warrior. This harness has made that mistake in
    // the other direction and written it down twice ("a strategy measured with
    // a spec that could not carry it"), so the war-crew is a third arm rather
    // than an objection left hanging. Raiding is held ON across B and C, so
    // C-against-B isolates the CREW exactly as B-against-A isolates raiding.
    const WARCREW: Policy = {
      ...RAIDING,
      crew: ['warrior', 'hunter', 'hunter', 'farmer', 'woodcutter', 'builder'],
    };

    // And the rest of the bundle. Arm B is the settler raiding at 7%; the full
    // RAIDER policy came in at 1.7%, so something outside raiding costs more
    // than raiding does. The prime suspect is `relaxFrom`, which RAIDER does
    // not set at all: the settler's own comment prices that rule at saved 20 /
    // killed 1, because a FIXED site floor never settles in 45 of 120 seeds.
    // If E recovers most of the gap, the raider's collapse is a harness rule
    // it was never given rather than the game punishing raiding.
    const RAIDER_RELAXED: Policy = { ...RAIDER, relaxFrom: 14 };

    const off = take(SETTLER);
    const on = take(RAIDING);
    const war = take(WARCREW);
    const raider = take(RAIDER);
    const relaxed = take(RAIDER_RELAXED);

    let saved = 0, killed = 0, same = 0, longer = 0, shorter = 0;
    for (let i = 0; i < SEEDS; i += 1) {
      const a = off[i]!, b = on[i]!;
      if (a.day === b.day && a.end === b.end) same += 1;
      const as = a.end === 'still standing', bs = b.end === 'still standing';
      if (bs && !as) saved += 1;
      if (as && !bs) killed += 1;
      if (b.day > a.day) longer += 1;
      if (b.day < a.day) shorter += 1;
    }
    const standing = (r: typeof off) => r.filter((x) => x.end === 'still standing').length;
    const avg = (r: typeof off) => Math.round(r.reduce((t, x) => t + x.day, 0) / r.length);
    const falls = (r: typeof off) => r.reduce((t, x) => t + x.falls, 0);
    const settling = (r: typeof off) => {
      const got = r.filter((x) => x.foundedOn >= 0);
      const late = got.filter((x) => x.foundedOn >= 14).length;
      return got.length === 0 ? 'never settled'
        : `settled ${got.length}/${r.length} on day ${Math.round(got.reduce((t, x) => t + x.foundedOn, 0) / got.length)}`
          + `, still searching at day 14: ${late}`;
    };

    let rSaved = 0, rKilled = 0;
    for (let i = 0; i < SEEDS; i += 1) {
      const d = raider[i]!, e = relaxed[i]!;
      const ds = d.end === 'still standing', es = e.end === 'still standing';
      if (es && !ds) rSaved += 1;
      if (ds && !es) rKilled += 1;
    }

    let wSaved = 0, wKilled = 0;
    for (let i = 0; i < SEEDS; i += 1) {
      const b = on[i]!, c = war[i]!;
      const bs = b.end === 'still standing', cs = c.end === 'still standing';
      if (cs && !bs) wSaved += 1;
      if (bs && !cs) wKilled += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 10.3 raiding as ONE knob on the settler — ${SEEDS} seeds, paired:\n`
      + `  A raiding off        : ${standing(off)}/${SEEDS} standing, avg ${avg(off)} days, ${falls(off)} fallen on\n`
      + `  B raiding on         : ${standing(on)}/${SEEDS} standing, avg ${avg(on)} days, ${falls(on)} fallen on\n`
      + `  C raiding + war crew : ${standing(war)}/${SEEDS} standing, avg ${avg(war)} days, ${falls(war)} fallen on\n`
      + `  B against A (raiding): ${same}/${SEEDS} identical, saved ${saved}, killed ${killed}, longer ${longer}, shorter ${shorter}\n`
      + `  C against B (the crew): saved ${wSaved}, killed ${wKilled}\n`
      + `  D RAIDER as it stands: ${standing(raider)}/${SEEDS} standing, avg ${avg(raider)} days\n`
      + `  E RAIDER + relaxFrom : ${standing(relaxed)}/${SEEDS} standing, avg ${avg(relaxed)} days\n`
      + `  E against D (the relax rule): saved ${rSaved}, killed ${rKilled}\n`
      + `  WHY: D ${settling(raider)}\n`
      + `       A ${settling(off)}`,
    );

    // The knob has to actually DO something, or the arms are the same run
    // twice and every number above is noise wearing a table. This is the
    // check 9.1 needed and did not have.
    expect(falls(on), 'raiding was switched on and nobody was fallen on')
      .toBeGreaterThan(falls(off));
  });
});

describe('PROBE: 10.2 — what the tactical layer actually costs', () => {
  /**
   * 10.2 was opened on "battle fates are 100 of roughly 475 deaths", read off
   * the top six rows of a table with a regex written from memory. Both halves
   * of that were wrong.
   *
   * THE FATES ARE A DATA CONSTANT, so they are imported and matched exactly
   * rather than pattern-matched. `DEATHS` in `data/injuries.ts` is the pool a
   * fighter draws from when he dies on the field, and it contains **"went
   * under and was not seen again"** — which the earlier reading took for
   * drowning and dropped, on its own worth 52 deaths in a 120-saga arm. A
   * regex invented at the keyboard cannot know that; the constant can.
   *
   * Every fate that lands in no bucket is PRINTED rather than swallowed, so
   * a classification that silently loses a category says so.
   */
  it('prices every death against the fate constants, and every fight by who chose it', { timeout: 1_800_000 }, async () => {
    const SEEDS = 200;
    const rows: string[] = [];

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as [string, Policy][]) {
      setPolicy(pol);
      const bucket: Record<string, number> = {};
      const unclassified: Record<string, number> = {};
      // WHO STARTED IT, attributed per battle rather than inferred from the
      // totals. Two wrong accounts were written before this one: `battles`
      // ALREADY CONTAINS `raids`, so adding them double-counted; and a
      // fall-on was assumed to skip the tactical layer when `travel.ts` in
      // fact calls `startBattle` for it. Both were caught by reading the code
      // that writes the counters, which is the only thing that settles it.
      let defended = 0, chosen = 0, met = 0, sacksNoFight = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), 400, (before, after) => {
          const dB = (after.tally?.battles ?? 0) - (before.tally?.battles ?? 0);
          const dR = (after.tally?.raids ?? 0) - (before.tally?.raids ?? 0);
          const dS = (after.tally?.sackings ?? 0) - (before.tally?.sackings ?? 0);
          if (dB > 0) {
            // A raid at the steading is defended; a battle that lands with a
            // sacking is one the band went out and started; anything else is
            // met on the road.
            if (dR > 0) defended += dR;
            else if (dS > 0) chosen += dB;
            else met += dB;
          }
          // An unguarded prize is "a day's work, taken on the spot" -- a
          // sacking with no battle behind it.
          if (dS > 0 && dB === 0) sacksNoFight += dS;
        });
        for (const p of s.party.people) {
          if (p.alive || p.left) continue;
          const f = p.fate ?? 'unrecorded';
          if (DEATHS.includes(f)) bucket['on the field'] = (bucket['on the field'] ?? 0) + 1;
          else if (f === 'hunger' || f === 'short commons') bucket['hunger'] = (bucket['hunger'] ?? 0) + 1;
          else if (f === 'the cold') bucket['the cold'] = (bucket['the cold'] ?? 0) + 1;
          else if (f === 'the sickness of that winter') bucket['sickness'] = (bucket['sickness'] ?? 0) + 1;
          else if (f.startsWith('was carried off')) bucket['carried off'] = (bucket['carried off'] ?? 0) + 1;
          else { bucket['other'] = (bucket['other'] ?? 0) + 1; unclassified[f] = (unclassified[f] ?? 0) + 1; }
        }
      }

      const dead = Object.values(bucket).reduce((t, n) => t + n, 0);
      const pct = (n: number) => `${Math.round((100 * n) / Math.max(1, dead))}%`;
      const battles = defended + chosen + met;
      const share = (n: number) => `${Math.round((100 * n) / Math.max(1, battles))}%`;
      rows.push(
        `  ${label}: ${dead} dead over ${SEEDS} sagas\n`
        + `      ${Object.entries(bucket).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${v} (${pct(v)})`).join(', ')}\n`
        + `      battles ${battles}: defended ${defended} (${share(defended)})`
        + `, met on the road ${met} (${share(met)})`
        + `, WE started ${chosen} (${share(chosen)})`
        + ` | plus ${sacksNoFight} prizes taken without a fight\n`
        + `      dead on the field per battle: ${((bucket['on the field'] ?? 0) / Math.max(1, battles)).toFixed(2)}\n`
        + `      fates in no bucket: ${Object.keys(unclassified).length === 0 ? 'none'
            : Object.entries(unclassified).map(([k, v]) => `"${k}" ${v}`).join('; ')}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 10.2 what battle costs — ${SEEDS} landings a policy:\n${rows.join('\n')}`);
    expect(rows.length).toBe(2);
  });
});

describe("PROBE: 10.3b — which of the raider's other knobs costs it", () => {
  /**
   * 10.3 left a hole. Raiding as ONE knob on the settler takes standing from
   * 27/200 to 14/200 — that is the game. But the full `RAIDER` policy stands
   * 4/200, so something outside raiding costs about as much again, and the
   * first suspect (`relaxFrom`) came back an exact tie because at
   * `siteFloor: 7` the raider settles on day 6 and the rule has nothing left
   * to relax.
   *
   * Four differences remain between the settler-who-raids and the raider: the
   * site policy, `plunderWindow`, `trades`, and the build order. This starts
   * from the RAIDER and adds each settler trait back ONE at a time, paired
   * against the raider itself — which isolates each knob inside the strategy
   * it belongs to, rather than asking what it does to a settler that would
   * never use it.
   *
   * The site policy goes back as a PAIR (`siteFloor` with `relaxFrom`),
   * because 10.3 established the relax rule cannot act while the floor is low
   * enough to settle on day 6. Splitting them again would re-run a knob
   * already known to be inert.
   */
  it('adds each settler trait back to the raider, one at a time', { timeout: 3_600_000 }, async () => {
    const SEEDS = 200;

    const take = (pol: Policy) => {
      setPolicy(pol);
      const rows: { day: number; end: string }[] = [];
      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), 400);
        rows.push({ day: s.day, end: s.end?.cause ?? 'still standing' });
      }
      return rows;
    };

    const base = take(RAIDER);
    const arms: [string, Policy][] = [
      ['+ trades', { ...RAIDER, trades: true }],
      ['+ plunderWindow 24', { ...RAIDER, plunderWindow: 24 }],
      ['+ settler build order', { ...RAIDER, want: SETTLER.want }],
      ['+ settler site policy', { ...RAIDER, siteFloor: 9, relaxFrom: 14 }],
    ];

    const standing = (r: typeof base) => r.filter((x) => x.end === 'still standing').length;
    const avg = (r: typeof base) => Math.round(r.reduce((t, x) => t + x.day, 0) / r.length);

    const lines = [`  RAIDER as it stands   ${standing(base)}/${SEEDS} standing, avg ${avg(base)} days`];
    for (const [label, pol] of arms) {
      const arm = take(pol);
      let saved = 0;
      let killed = 0;
      let same = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const a = base[i]!;
        const b = arm[i]!;
        if (a.day === b.day && a.end === b.end) same += 1;
        const as = a.end === 'still standing';
        const bs = b.end === 'still standing';
        if (bs && !as) saved += 1;
        if (as && !bs) killed += 1;
      }
      lines.push(
        `  ${label.padEnd(21)} ${standing(arm)}/${SEEDS} standing, avg ${avg(arm)} days`
        + ` | paired: saved ${saved}, killed ${killed}, ${same}/${SEEDS} identical`,
      );
      // A knob that leaves EVERY saga byte-identical did not run at all, and
      // 10.3 spent a whole arm learning that the hard way. Said out loud here
      // rather than left for a reader to notice in a table.
      if (same === SEEDS) lines.push('      ^^ INERT: every saga identical — this knob did nothing');
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 10.3b the rest of the raider's bundle — ${SEEDS} seeds, each arm paired against the raider:\n${lines.join('\n')}`);
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });
});

describe('PROBE: 10.4b — are `survived` and `jarl` reachable at all', () => {
  /**
   * 10.4 fixed the endings that were being MISNAMED. Two were left, and they
   * are a different problem: `survived` and `jarl` had never once been given
   * the chance to fire in any measurement this repo has taken.
   *
   * `wintersStood(day) >= LONG_LIFE_WINTERS` is the gate on `layDownSaga`,
   * and it first goes true on **day 457** — computed, not taken from the
   * comment in `household.ts` that says so, though the comment is right.
   * Every probe in this file stops at day 400, where `wintersStood` is 4. The
   * measurements were one winter short of the ending they were asking about.
   *
   * WHAT THIS DOES NOT DO, and the restraint is the point. It does not teach
   * the bot to lay the saga down. Both endings are player DEEDS — `layDownSaga`
   * and `layDownRule` — so how OFTEN they fire is a fact about when a player
   * chooses to stop, not about the game, and a bot that laid down at the first
   * opportunity would simply measure the rule I had just written. The
   * well-posed question is REACHABILITY: does a band ever stand in a place
   * where the deed is legal?
   */
  it('runs past the reckoning and counts who could lay the saga down', { timeout: 3_600_000 }, async () => {
    const SEEDS = 200;
    const HORIZON = 620;
    const lines: string[] = [];

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as [string, Policy][]) {
      setPolicy(pol);
      let aliveAtReckoning = 0;
      let couldLayDown = 0;
      let ruling = 0;
      let couldLayDownRule = 0;
      let diedInTheFifthWinter = 0;
      let stillGoing = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), HORIZON);
        if (!s.end) stillGoing += 1;
        if (s.end && s.day > 400) diedInTheFifthWinter += 1;
        if (!s.end && reckoningDue(s)) {
          aliveAtReckoning += 1;
          // Exactly the guard `layDownSaga` applies, minus the deed itself.
          if (!s.battle && !s.event && living(s.party.people).length > 0) couldLayDown += 1;
          if (s.jarl) {
            ruling += 1;
            if (!s.battle && !s.event) couldLayDownRule += 1;
          }
        }
      }

      lines.push(
        `  ${label}: ${stillGoing}/${SEEDS} still going at day ${HORIZON}`
        + `, ${diedInTheFifthWinter} ended after day 400\n`
        + `      past the reckoning (day 457): ${aliveAtReckoning}`
        + ` | could lay the saga down: ${couldLayDown}`
        + ` | ruling: ${ruling}, could lay down rule: ${couldLayDownRule}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 10.4b reaching the reckoning — ${SEEDS} landings a policy, run to day ${HORIZON}:\n${lines.join('\n')}`);
    expect(lines.length).toBe(2);
  });
});

describe('PROBE: 10.1b — is the MIDDLE of a saga the same every time', () => {
  /**
   * 10.1's open half asks whether one dominant terminal threat reads as
   * monotony or as identity, and says it needs a person. Before it goes to
   * one, this separates two things the item runs together.
   *
   * **Monotony is a fact about the MIDDLE, not the end.** Two sagas can share
   * an ending and share nothing else on the way to it — a band that starved
   * having never raised a hall and a band that starved as a jarl in its fifth
   * winter are the same word on the last screen and not the same game. The
   * ending distribution cannot answer the question the item asks, so this
   * measures what a saga is MADE of instead: which of the 103 authored events
   * it saw, and which buildings it ever raised.
   *
   * `built` is a set that LOSES a building the day something replaces it, so
   * the union is accumulated over the whole run rather than read at the end —
   * that is the counter CLAUDE.md opens on, and reading it at the end would
   * undercount every upgrade.
   *
   * Overlap is mean pairwise Jaccard across every pair of sagas. High overlap
   * means the same run over and over; low means the ending is the only thing
   * they share.
   */
  it('counts the content a saga reaches, and how much two sagas share', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 620;
    const lines: string[] = [];

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as [string, Policy][]) {
      setPolicy(pol);
      const eventSets: Set<string>[] = [];
      const builtSets: Set<string>[] = [];
      const allEvents = new Set<string>();
      const allBuilt = new Set<string>();
      // `ActiveEvent.id` is NOT only an id from `data/events`. Its own comment
      // says "or 'feud'", and `travel.ts` raises a 'thing' the same way. The
      // first cut of this probe compared the id space against
      // `EVENTS.length` and printed "104 of 103 authored ever fired" — an
      // impossible number, which is the only reason it was caught. Partitioned
      // now, so the denominator matches what is being counted.
      const authoredIds = new Set(EVENTS.map((e) => e.id));

      for (let i = 0; i < SEEDS; i += 1) {
        const seen = new Set<string>();
        const raised = new Set<string>();
        run(armSeed(0, i, SEEDS), HORIZON, (_before, after) => {
          if (after.event?.id) { seen.add(after.event.id); allEvents.add(after.event.id); }
          for (const b of after.settlement?.built ?? []) { raised.add(b); allBuilt.add(b); }
        });
        eventSets.push(seen);
        builtSets.push(raised);
      }

      const jaccard = (a: Set<string>, b: Set<string>) => {
        if (a.size === 0 && b.size === 0) return 1;
        let hit = 0;
        for (const x of a) if (b.has(x)) hit += 1;
        return hit / (a.size + b.size - hit);
      };
      const meanPair = (sets: Set<string>[]) => {
        let total = 0;
        let n = 0;
        for (let i = 0; i < sets.length; i += 1) {
          for (let j = i + 1; j < sets.length; j += 1) { total += jaccard(sets[i]!, sets[j]!); n += 1; }
        }
        return n === 0 ? 0 : total / n;
      };
      const mean = (sets: Set<string>[]) => sets.reduce((t, x) => t + x.size, 0) / sets.length;

      const authoredSeen = [...allEvents].filter((id) => authoredIds.has(id));
      const synthetic = [...allEvents].filter((id) => !authoredIds.has(id)).sort();
      lines.push(
        `  ${label}: events — ${authoredSeen.length} of ${EVENTS.length} authored ever fired`
        + ` (plus ${synthetic.length} not from the deck: ${synthetic.join(', ') || 'none'})`
        + `, ${mean(eventSets).toFixed(1)} per saga`
        + `, two sagas share ${Math.round(100 * meanPair(eventSets))}%\n`
        + `      buildings — ${allBuilt.size} of ${BUILDINGS.length} kinds ever raised`
        + `, ${mean(builtSets).toFixed(1)} per saga`
        + `, two sagas share ${Math.round(100 * meanPair(builtSets))}%`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 10.1b what a saga is made of — ${SEEDS} landings a policy, run to day ${HORIZON}:\n${lines.join('\n')}`);
    expect(lines.length).toBe(2);
  });
});

describe('PROBE: 11.S3 — how much of the coast a saga actually stands on', () => {
  /**
   * 11.S3 asks whether the coast is a PROLOGUE. `walkOptions` returns `[]` for
   * a settled band with no expedition, so the twenty-six stops stop being
   * reachable the day a steading goes up — and 9.11 found the same door from
   * the other side. What nobody had measured is how much of the route a saga
   * ever stands on, and how much of that comes AFTER founding.
   *
   * `world.trodStops` is a record of stop → the day the band first stood
   * there, so before-and-after founding is an exact split rather than an
   * inference. That is the whole reason this is cheap to ask.
   *
   * DENOMINATORS. Bands that never settle walk further BY CONSTRUCTION — they
   * are still looking — and pooling them would inflate every number here. So
   * the settled and the never-settled are counted apart and printed apart, and
   * the question S3 actually asks is answered only by the settled column.
   */
  it('counts the stops a band treads, before and after it founds a steading', { timeout: 3_600_000 }, async () => {
    const SEEDS = 200;
    const HORIZON = 620;
    const out: string[] = [];

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as [string, Policy][]) {
      setPolicy(pol);
      let settled = 0;
      let neverSettled = 0;
      let trodSettled = 0;
      let trodNever = 0;
      let afterFounding = 0;
      let everWentBack = 0;
      let daysBeforeFounding = 0;
      let daysAfter = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), HORIZON);
        const trod = s.world.trodStops ?? {};
        const stops = Object.keys(trod).length;
        const home = s.settlement;
        if (!home) { neverSettled += 1; trodNever += stops; continue; }
        settled += 1;
        trodSettled += stops;
        const after = Object.values(trod).filter((day) => day > home.foundedOn).length;
        afterFounding += after;
        if (after > 0) everWentBack += 1;
        daysBeforeFounding += home.foundedOn;
        daysAfter += Math.max(0, s.day - home.foundedOn);
      }

      const per = (n: number, d: number) => (d === 0 ? '—' : (n / d).toFixed(1));
      out.push(
        `  ${label}: settled ${settled}/${SEEDS}, never settled ${neverSettled}\n`
        + `      SETTLED bands — ${per(trodSettled, settled)} of ${ROUTE_STOPS} stops ever trodden`
        + `, of which ${per(afterFounding, settled)} after founding\n`
        + `      settled bands that ever trod NEW ground after founding: ${everWentBack}/${settled}\n`
        + `      their days: ${per(daysBeforeFounding, settled)} looking, ${per(daysAfter, settled)} settled\n`
        + `      never-settled bands (they are still looking, so they walk further):`
        + ` ${per(trodNever, neverSettled)} stops`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.S3 the coast a saga stands on — ${SEEDS} landings a policy, to day ${HORIZON}:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: 11.S1 — does it matter WHO stands in which rank', () => {
  /**
   * 11.S1's own first job, and it is a premise check rather than a build.
   *
   * VERIFIED IN CODE before any of this ran: `rank` is handed out at
   * `battle.ts:440` as `combatants.filter(side==='warband').length + 1` over
   * `sworn(fieldCrew(state))`, and `sworn` is roster order sliced to six. So
   * the front rank of every fight in the game is `state.party.people[0]` —
   * which `leaderOf` also returns. **The leader stands at the front of every
   * battle a band ever fights, and nobody chose that.**
   *
   * Whether that is a MISSING DECISION or a non-decision is the question, and
   * 9.1's lesson decides how to ask it: a verb the bot cannot use measures as
   * worthless, so before building a deploy screen, measure whether the line
   * ORDER moves an outcome at all.
   *
   * THE INSTRUMENT IS AN ARENA, and that is a deliberate trade against
   * CLAUDE.md's trap 1 (a figure from a fixture is not a figure about the
   * game). Here the fixture is the only thing that can answer the question:
   * a whole-saga arm buries one line-up inside five hundred days of weather,
   * hunger and travel, and the survival curve only ends about one run in six
   * on steel. The arena isolates the single variable. What it can say is
   * "order moves / does not move a fight"; what it CANNOT say is what that is
   * worth to a saga, and if it moves, that is the next reading, not this one.
   *
   * THREE ARMS, and the third is there so a tie is diagnosable. If best-front
   * and best-back BOTH tie the control, the reorder never ran or rank is
   * inert — trap 3 — and `reordered` below is what tells the two apart.
   */
  const ARENA_FIGHTS = 300;
  const ARENA_DIFFICULTY = 2;

  /** What a fighter is worth where the blows land: might swings, wits evades. */
  function worth(state: GameState, c: Combatant): number {
    const p = fighterPerson(state, c.personId);
    if (!p) return 0;
    return effectiveStat(p, 'might') + effectiveStat(p, 'wits') + p.health;
  }

  /** `undefined` leaves the game's own deployment alone — that is the control. */
  type Deploy = ((state: GameState, ours: Combatant[]) => Combatant[]) | undefined;

  const ARMS: [string, Deploy][] = [
    // THE CONTROL IS WHATEVER THE GAME DOES, not a permutation this file
    // spells. It was the same thing when this probe was written — rank was
    // roster order — and 11.S1's fix moved it, so this row re-prices itself
    // rather than going stale, which is the whole reason probes are kept.
    ['the line the game forms (the control)', undefined],
    ['FORCED roster order — the line the game formed before 11.S1',
      (_s, ours) => ours],
    ['best men front', (s, ours) => [...ours].sort((a, b) => worth(s, b) - worth(s, a))],
    ['best men back', (s, ours) => [...ours].sort((a, b) => worth(s, a) - worth(s, b))],
    // THE ARM THAT READ THE OTHER TWO. Best-front and best-back both beat
    // the control by about the same margin, which is not a gradient — it is
    // the signature of something that changes when the line stops agreeing
    // with the roster. This permutation is uncorrelated with `worth`, so it
    // separates "quality decides" from "any reordering decides". It won MORE
    // than either quality arm, which settles it: quality is not the variable.
    ['reversed roster (no quality gradient)', (_s, ours) => [...ours].reverse()],
    // THE TWO THAT NAME THE VARIABLE. `leaderOf` is `sworn(people)[0]`, and
    // rank is handed out in that same roster order, so the band's leader
    // stands at rank 1 in every fight the game plays — and `leaderFell`
    // costs the WHOLE side 25 nerve, distance-independent, the largest
    // single morale event in the mode.
    //
    // Moving him one place is not a test of that on its own, because it also
    // promotes whoever was behind him. So the placebo moves the SECOND man
    // instead and leaves the leader at the front: same shape of permutation,
    // same promotion, no leader moved. If the placebo does nothing and the
    // first arm does what reversing did, the variable is the leader.
    ['leader to the back, roster order otherwise', (_s, ours) => [...ours.slice(1), ours[0]!]],
    ['PLACEBO: second man to the back, leader stays at the front',
      (_s, ours) => [ours[0]!, ...ours.slice(2), ours[1]!]],
    // THE ARM THE PLACEBO FORCED. The placebo kept the leader at rank 1 and
    // took his fall 292/300 — the leader numbers are the control's to within
    // noise — and still won 36 more. So a second thing is in here, and
    // `bindKin` names it: it pairs `free[0]` with `free[1]` and `free[2]`
    // with `free[3]`, and rank is roster order, so in the game as it ships
    // both kin pairs stand SHOULDER TO SHOULDER, at ranks 1-2 and 3-4.
    //
    // `witnessFall` then lands NERVE_ALLY_DOWN + NERVE_WALL_SHATTERED on the
    // shoulder-mate and NERVE_KIN_FELL on the kin — and when they are the
    // same man he eats all of it at once. Nerve is a per-man threshold, so
    // concentrated shock breaks somebody and the same total spread over two
    // men breaks nobody.
    //
    // This arm changes nothing about the line: same roster order as the
    // control, kin simply unbound, exactly as test/wall.test.ts unbinds them
    // and for the same stated reason. If it lands near the placebo, kin
    // adjacency is what the placebo was measuring and the deployment
    // question was never in it at all.
    ['DIAGNOSTIC: roster order, kin unbound', (s, ours) => {
      for (const person of s.party.people) delete person.kin;
      return ours;
    }],
    // WHERE THE SHIPPED LINE SITS IN THE FIELD OF ALL LINES. Unbinding kin
    // recovered only 10 of the placebo's 36, so a residual is unexplained —
    // and rather than keep guessing at mechanisms, this arm asks the question
    // that does not need one: is roster order an ordinary draw from the
    // permutations, or is it near the bottom of them?
    //
    // Its own tiny LCG rather than the game's RNG, deliberately: a probe that
    // pulled on `stream(seed, ...)` would be perturbing the same randomness
    // it is measuring.
    ['a line drawn at random, fresh each fight', (s, ours) => {
      let x = 0;
      for (let i = 0; i < s.seed.length; i += 1) x = (x * 31 + s.seed.charCodeAt(i)) % 2147483647;
      const shuffled = [...ours];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        x = (x * 1103515245 + 12345) % 2147483647;
        const j = x % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      return shuffled;
    }],
  ];

  interface Fought {
    won: boolean;
    stood: number;
    /** The rank each warband combatant ended up deployed at, in roster order. */
    line: string;
    /** Did the band's leader go down in this fight? The mechanism instrument. */
    leaderDown: boolean;
    /** What rank the leader was deployed at. Proves each arm did what it says. */
    leaderRank: number;
    /**
     * How many times `leaderFell` fired on OUR side in this fight — the 25
     * nerve to every man standing, the largest morale event in the mode.
     *
     * Counted off the log line rather than the beat stream because beats are
     * trimmed to BEATS_MAX and a long fight would silently drop the early
     * ones. It is a prose match, which is brittle — so `leaderDown` is
     * printed beside it: an arm reporting men down and zero falls would be
     * the phrasing having changed, and it would be visible rather than quiet.
     */
    leaderFalls: number;
  }

  /**
   * One fight, deployed by `deploy` and then played by a bot that is the SAME
   * in every arm — strike what is in reach, else thrust, else throw.
   *
   * `beginBattle` rather than `startBattle`, because `startBattle` ends with
   * `playUntilOurTurn`: foes with the initiative would have already swung
   * before the line was ordered, which is a deploy screen shown after the
   * first blow.
   */
  function fought(seed: string, deploy: Deploy): Fought {
    const start = structuredClone(newGame(seed));
    beginBattle(start, 'meadow', ARENA_DIFFICULTY);
    const ours = start.battle!.combatants.filter((c) => c.side === 'warband');
    if (deploy) deploy(start, ours).forEach((c, i) => { c.rank = i + 1; });
    const line = ours.map((c) => c.rank).join('');
    const leaderId = leaderOf(start.party.people)?.id;
    const leaderRank = ours.find((c) => c.personId === leaderId)?.rank ?? 0;

    let s: GameState = start;
    for (let i = 0; i < 2000 && !s.battle?.outcome; i += 1) {
      const active = activeCombatant(s.battle!);
      if (!active || active.side !== 'warband') { s = apply(s, { type: 'B_END_TURN' }); continue; }
      if (!active.hasActed) {
        const weakest = (list: Combatant[]) => [...list].sort(
          (a, b) => (fighterPerson(s, a.personId)?.health ?? 99)
            - (fighterPerson(s, b.personId)?.health ?? 99),
        )[0]!;
        const hits = strikeTargets(s);
        const spear = reachTargets(s);
        const shots = throwTargets(s);
        if (hits.length > 0) s = apply(s, { type: 'B_STRIKE', targetId: weakest(hits).personId });
        else if (spear.length > 0) s = apply(s, { type: 'B_REACH', targetId: weakest(spear).personId });
        else if (shots.length > 0) s = apply(s, { type: 'B_THROW', targetId: weakest(shots).personId });
      }
      s = apply(s, { type: 'B_END_TURN' });
    }
    const end = s.battle!;
    return {
      won: end.outcome === 'won',
      stood: standing(end, 'warband').length,
      line,
      leaderDown: end.combatants.some((c) => c.personId === leaderId && (c.down || c.fled)),
      leaderRank,
      leaderFalls: end.log.filter((l) => l.includes('left holding the line')).length,
    };
  }

  it('plays the same fight three ways, changing only who stands where', { timeout: 3_600_000 }, async () => {
    const control: Fought[] = [];
    const out: string[] = [];

    for (const [label, deploy] of ARMS) {
      let wins = 0;
      let stood = 0;
      let leaderLost = 0;
      let leaderRankSum = 0;
      let falls = 0;
      /** THE INSTRUMENT CHECK: fights where this arm deployed a DIFFERENT
       * line from the control. A tie on an arm that never reordered anybody
       * is trap 3 — evidence the arm did not run, not that rank is inert. */
      let reordered = 0;
      let wonWhereControlLost = 0;
      let lostWhereControlWon = 0;
      const isControl = control.length === 0;

      for (let i = 0; i < ARENA_FIGHTS; i += 1) {
        const r = fought(`line-${i}`, deploy);
        if (isControl) control.push(r);
        else {
          const c = control[i]!;
          if (r.line !== c.line) reordered += 1;
          if (r.won && !c.won) wonWhereControlLost += 1;
          if (!r.won && c.won) lostWhereControlWon += 1;
        }
        if (r.won) wins += 1;
        stood += r.stood;
        if (r.leaderDown) leaderLost += 1;
        leaderRankSum += r.leaderRank;
        falls += r.leaderFalls;
      }

      out.push(
        `  ${label}: won ${wins}/${ARENA_FIGHTS}`
        + `, ${(stood / ARENA_FIGHTS).toFixed(2)} of six still standing`
        + `\n      leader stood at rank ${(leaderRankSum / ARENA_FIGHTS).toFixed(2)} on average`
        + ` and went down in ${leaderLost}/${ARENA_FIGHTS} fights`
        + `\n      "the heart went out of them" fired ${falls} times`
        + ` — ${(falls / ARENA_FIGHTS).toFixed(2)} a fight`
        + (isControl ? '   [control]'
          : `\n      paired against the control: won ${wonWhereControlLost} it lost`
            + `, lost ${lostWhereControlWon} it won`
            + `\n      fights where this arm actually deployed a different line:`
            + ` ${reordered}/${ARENA_FIGHTS}`),
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S1 the line-up, in the arena — ${ARENA_FIGHTS} fights an arm`
      + `, difficulty ${ARENA_DIFFICULTY}, one bot:\n${out.join('\n')}`,
    );
    expect(out.length).toBe(ARMS.length);
  });

  /**
   * WHAT THE ARENA CANNOT SAY, said. CLAUDE.md trap 1: a figure measured in a
   * fixture is not a figure about the game, and the arena reading above is
   * exactly that — 300 fights with nothing else in them. A saga has weather,
   * hunger, travel and a survival curve that only ends about one run in six
   * on steel, so a big arena effect can still come out at nothing.
   *
   * The line is reordered from `run`'s watch hook, on the transition where a
   * battle first appears. That is one beat LATE — `startBattle` ends with
   * `playUntilOurTurn`, so foes holding the initiative have already swung
   * once at the roster line before the reorder lands. The bias is therefore
   * AGAINST the arms and toward the control, which is the right direction for
   * a bias to run: whatever this reads is a floor, not a ceiling.
   */
  it('prices the same reorder in whole sagas rather than in an arena', { timeout: 3_600_000 }, async () => {
    const SEEDS = 150;
    const HORIZON = 500;

    type Line = ((ours: Combatant[]) => Combatant[]) | undefined;
    const sample = (line: Line) => {
      setPolicy(SETTLER);
      const lived: boolean[] = [];
      let standing6 = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          if (line && !before.battle && after.battle) {
            const ours = after.battle.combatants.filter((c) => c.side === 'warband');
            // A fight the band is not standing in has no line to order, and
            // `ours[0]!` on an empty array is how this probe first crashed.
            if (ours.length > 0) line(ours).forEach((c, ix) => { c.rank = ix + 1; });
          }
        });
        lived.push(!final.end && final.day >= HORIZON);
        standing6 += living(final.party.people).length;
      }
      return { lived, standing6 };
    };

    const control = sample(undefined);
    const rows: string[] = [
      `  as they turn up (the game today): ${control.lived.filter(Boolean).length}/${SEEDS}`
      + ` still standing at day ${HORIZON}`
      + `, ${(control.standing6 / SEEDS).toFixed(2)} people alive on average   [control]`,
    ];

    const ARMS_IN_PLAY: [string, (ours: Combatant[]) => Combatant[]][] = [
      ['leader to the back', (ours) => [...ours.slice(1), ours[0]!]],
      ['reversed roster', (ours) => [...ours].reverse()],
    ];

    for (const [label, line] of ARMS_IN_PLAY) {
      const arm = sample(line);
      let saved = 0;
      let killed = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        if (!control.lived[i] && arm.lived[i]) saved += 1;
        if (control.lived[i] && !arm.lived[i]) killed += 1;
      }
      rows.push(
        `  ${label}: ${arm.lived.filter(Boolean).length}/${SEEDS} still standing`
        + `, ${(arm.standing6 / SEEDS).toFixed(2)} people alive on average`
        + `\n      paired against the control: saved ${saved}, killed ${killed}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S1b the line-up, in whole sagas — ${SEEDS} landings an arm`
      + `, settler, to day ${HORIZON}:\n${rows.join('\n')}`,
    );
    expect(rows.length).toBe(ARMS_IN_PLAY.length + 1);
  });
});

describe('PROBE: 11.S2 — does the ground ever cap anything', () => {
  /**
   * 11.S2 proposes that plots cap the job: "three field plots means three
   * farmers." Before building that, the question 9.1 forces is whether the cap
   * would ever BIND — a rule nobody runs into is a rule worth nothing, and
   * this file has now shipped that finding twice.
   *
   * RE-VERIFIED IN CODE first, not inherited: `plotsFor` is called in exactly
   * two places, `colony.ts:403-404`, both inside `availableJobs` and both as
   * booleans — "can anyone farm here at all". The ground caps nothing. The
   * item's premise holds.
   *
   * BUT THE ITEM'S SPELLING OF THE FIX DOES NOT SURVIVE READING THE DATA, and
   * that is why this measures per PLOT KIND rather than per job:
   *
   *   - `wood` is worked by TWO jobs, `woodcutter` and `hunter`, so a cap on
   *     the ground is shared between them and "three plots, three farmers"
   *     has no equivalent spelling for wood;
   *   - `hall` is exactly one plot and works `builder`; `watchpost` is exactly
   *     one and works `warrior`. Taken literally the proposal caps a steading
   *     at ONE builder and ONE warrior, which is a far larger change than the
   *     item describes and is not obviously wanted.
   *
   * So the reading below is: for every day a band is settled, how many hands
   * are set to work each kind of ground, against how many plots of that kind
   * it has. `over` is the days a cap would have bitten.
   *
   * WHOSE BEHAVIOUR THIS IS. The hands are placed by the HARNESS's policy,
   * not by a rule of the game — `crewsToNeed` puts up to four on one job —
   * and CLAUDE.md's own warning is that a bot policy read as a rule of the
   * game is how four Phase 9 items went wrong. So this says what the cap
   * would do to THIS bot. A player who spreads their hands differently would
   * meet it more or less often, and that is not measured here.
   */
  it('counts the ground against the hands set to work it', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 500;
    const KINDS = ['field', 'wood', 'water', 'hall', 'watchpost'] as const;

    const sample = (pol: Policy) => {
      setPolicy(pol);
      const days: Record<string, number> = {};
      const over: Record<string, number> = {};
      const worst: Record<string, number> = {};
      const plotSum: Record<string, number> = {};
      /** THE INSTRUMENT CHECK, and it is what turned this probe around. A cap
       * that never bites can mean the ground is generous OR that nobody ever
       * holds the job — trap 3 — and those two read identically in `over`. */
      const handSum: Record<string, number> = {};
      const handMax: Record<string, number> = {};
      for (const k of KINDS) {
        days[k] = 0; over[k] = 0; worst[k] = 0; plotSum[k] = 0;
        handSum[k] = 0; handMax[k] = 0;
      }
      let settled = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        let lastDay = 0;
        let counted = false;
        run(armSeed(0, i, SEEDS), HORIZON, (_before, after) => {
          const home = after.settlement;
          if (!home || after.day === lastDay) return;
          lastDay = after.day;
          if (!counted) {
            counted = true;
            settled += 1;
            for (const k of KINDS) {
              plotSum[k] = (plotSum[k] ?? 0) + home.plots.filter((pl) => pl.kind === k).length;
            }
          }
          for (const k of KINDS) {
            const plots = home.plots.filter((pl) => pl.kind === k).length;
            // Everyone whose job happens on this kind of ground, read off the
            // same table `plotsFor` reads so the two cannot disagree.
            const hands = living(after.party.people)
              .filter((pe) => !!pe.job && PLOTS[k].worked.includes(pe.job as JobId)).length;
            days[k] = (days[k] ?? 0) + 1;
            handSum[k] = (handSum[k] ?? 0) + hands;
            handMax[k] = Math.max(handMax[k] ?? 0, hands);
            if (hands > plots) {
              over[k] = (over[k] ?? 0) + 1;
              worst[k] = Math.max(worst[k] ?? 0, hands - plots);
            }
          }
        });
      }
      return { days, over, worst, plotSum, handSum, handMax, settled };
    };

    /**
     * THREE BOTS, because the first reading was a fact about ONE of them.
     *
     * SETTLER opens with `['farmer','farmer','woodcutter','hunter','builder',
     * 'warrior']` — two farmers — and `crewsToNeed` reassigns the whole band
     * to wood and game the first day the winter mark shows them short, which
     * is most days. And `recrews` is FALSE in all three shipped policies, so
     * `recrew` — the game's own "take the food job with the best output here"
     * — is never called at all.
     *
     * So the shipped bot's yard is one job wide, and asking it whether a plot
     * cap would bind measures the policy rather than the game. These two arms
     * are the same band playing its ground: one that re-picks the best food
     * job each season, and one that simply keeps the crew it landed with.
     */
    const ARMS: [string, Policy][] = [
      ['the harness as it ships', SETTLER],
      ['+ recrews: takes the best food job for this ground, each season',
        { ...SETTLER, recrews: true }],
      ['+ keeps its landing crew (two farmers), never crews to need',
        { ...SETTLER, crewsToNeed: false }],
    ];

    const out: string[] = [];
    for (const [label, pol] of ARMS) {
      const r = sample(pol);
      const rows = KINDS.map((k) => {
        const pct = r.days[k] === 0 ? 0 : Math.round((r.over[k]! / r.days[k]!) * 100);
        return `      ${k.padEnd(10)} ${(r.plotSum[k]! / Math.max(1, r.settled)).toFixed(1)} plots`
          + `, ${(r.handSum[k]! / Math.max(1, r.days[k]!)).toFixed(1)} hands a day`
          + ` (most ${r.handMax[k]})`
          + ` — a cap bites ${pct}% of days, worst excess ${r.worst[k]}`;
      });
      out.push(`  ${label} — ${r.settled}/${SEEDS} settled:\n${rows.join('\n')}`);
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S2 the ground against the hands — ${SEEDS} landings an arm, to day ${HORIZON}`
      + `:\n${out.join('\n')}`,
    );
    expect(out.length).toBe(ARMS.length);
  });

  /**
   * RE-TAKING A NUMBER THIS FILE'S OWN RULE SAYS TO DISTRUST.
   *
   * `recrews` is false in all three shipped policies, and the reading it was
   * switched off on (2026-08-20) is in ROADMAP.md as **"and re-crewed by
   * season too — 48/120, saved 0, killed 0 on top"**: an EXACT tie with the
   * daily crewing alone.
   *
   * CLAUDE.md names that shape: "an arm that ties its control exactly is
   * usually evidence the feature never ran, not that it is worthless." And
   * the mechanism fits — `recrew` fires once a season and `crewsToNeed`
   * reassigns every hand the next day, so a seasonal choice is overwritten
   * before it can be worked.
   *
   * The probe above says it is not quite nothing: with `recrews` on, hands on
   * water go from 0.0 a day to 1.2, so the verb DOES move people. A verb that
   * moves people and changes no outcome at all is worth re-measuring rather
   * than inheriting — especially now, because 11.S1 moved the survival curve
   * three points under every one of these figures.
   *
   * TWO HORIZONS on purpose. Spring is where the old reading was taken, and
   * it is also where fishing should matter most: winter forage is 0.15, so
   * `seasonFactor` pays a farmer 0.15 of a day and a fisher 0.575.
   */
  it('re-takes what re-crewing by season is worth', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const sample = (pol: Policy, horizon: number) => {
      setPolicy(pol);
      const lived: boolean[] = [];
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), horizon);
        lived.push(!final.end && final.day >= horizon);
      }
      return lived;
    };

    const rows: string[] = [];
    for (const [label, horizon] of [['spring (day 73)', 73], ['day 500', 500]] as [string, number][]) {
      const base = sample(SETTLER, horizon);
      const arm = sample({ ...SETTLER, recrews: true }, horizon);
      let saved = 0;
      let killed = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        if (!base[i] && arm[i]) saved += 1;
        if (base[i] && !arm[i]) killed += 1;
      }
      rows.push(
        `  ${label}: as it ships ${base.filter(Boolean).length}/${SEEDS}`
        + `, re-crewing by season ${arm.filter(Boolean).length}/${SEEDS}`
        + ` — saved ${saved}, killed ${killed}`,
      );
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.S2b what re-crewing by season is worth — ${SEEDS} landings an arm:\n${rows.join('\n')}`);
    expect(rows.length).toBe(2);
  });

  /**
   * THE QUESTION UNDER 11.S2, asked of the GAME rather than of any bot.
   *
   * 11.S2 proposes plot caps so "the reading you settled on keeps mattering
   * all game". But the reading ALREADY reaches every day of the game:
   * `output()` is `job.floor + report[job.measure] * job.perPoint`, evaluated
   * fresh each day for each job, and `recrew` picks the best food job from
   * it. If the yard is scenery it is not because that channel is missing.
   *
   * So: for a settled steading on a real day, which of the three food jobs
   * actually pays best? This asks `output` directly, on the states a saga
   * really passes through, with the SAME person for all three so the answer
   * is about ground and season and not about who happens to be free. No bot
   * policy is in it — which is the point, after the reading above turned out
   * to be a fact about `crewsToNeed`.
   */
  it('asks which food job the ground actually pays best', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 500;
    const FOOD: JobId[] = ['farmer', 'hunter', 'fisher'];
    const wins: Record<string, Record<string, number>> = {};
    const daysIn: Record<string, number> = {};
    /** How far ahead the winner is — a lead of nothing is not a decision. */
    const leadSum: Record<string, number> = {};

    setPolicy(SETTLER);
    for (let i = 0; i < SEEDS; i += 1) {
      let lastDay = 0;
      run(armSeed(0, i, SEEDS), HORIZON, (_before, after) => {
        if (!after.settlement || after.day === lastDay) return;
        lastDay = after.day;
        const who = living(after.party.people)[0];
        if (!who) return;
        const season = seasonOf(after.day);
        const scored = FOOD
          .map((id) => ({ id, n: output(after, who, jobById(id)!) }))
          .sort((a, b) => b.n - a.n);
        const top = scored[0]!;
        const second = scored[1]!;
        wins[season] ??= {};
        wins[season]![top.id] = (wins[season]![top.id] ?? 0) + 1;
        daysIn[season] = (daysIn[season] ?? 0) + 1;
        leadSum[season] = (leadSum[season] ?? 0)
          + (top.n === 0 ? 0 : (top.n - second.n) / top.n);
      });
    }

    const rows = Object.keys(daysIn).sort().map((season) => {
      const n = daysIn[season]!;
      const parts = FOOD.map((id) => {
        const w = wins[season]?.[id] ?? 0;
        return `${id} ${Math.round((w / n) * 100)}%`;
      });
      return `  ${season.padEnd(7)} (${n} band-days): ${parts.join(', ')}`
        + ` — the winner leads the runner-up by ${Math.round((leadSum[season]! / n) * 100)}%`;
    });

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S2c which food job the ground pays best — ${SEEDS} landings to day ${HORIZON}`
      + `, asked of \`output()\` on the states a saga really passes through:\n${rows.join('\n')}`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  /**
   * WHAT THE HARDCODED HUNTER COSTS.
   *
   * 11.S2c says the ground pays fisher best on 51-94% of settled band-days
   * and hunter best on 4-17%, by a margin of 32-49%. The harness's daily
   * crewing — the lever ROADMAP.md calls "the largest single effect this
   * project has measured" — spells `'hunter'` in all three of its branches.
   *
   * So this is not a proposal, it is a price: what does the bot lose by
   * reaching for one named job instead of asking the ground? `crewsByOutput`
   * is off in every shipped policy, so nothing in balance.test.ts moves;
   * this arm is the only thing that turns it on.
   *
   * If it is large, then every food figure in ROADMAP.md describes a band
   * playing its yard badly, and 11.S2's plot caps are aimed at a yard that
   * was never the problem.
   */
  it('prices the hardcoded hunter against asking the ground', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const sample = (pol: Policy, horizon: number) => {
      setPolicy(pol);
      const lived: boolean[] = [];
      let souls = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), horizon);
        lived.push(!final.end && final.day >= horizon);
        souls += living(final.party.people).length;
      }
      return { lived, souls };
    };

    const rows: string[] = [];
    for (const [label, horizon] of [['spring (day 73)', 73], ['day 500', 500]] as [string, number][]) {
      const base = sample(SETTLER, horizon);
      const arm = sample({ ...SETTLER, crewsByOutput: true }, horizon);
      let saved = 0;
      let killed = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        if (!base.lived[i] && arm.lived[i]) saved += 1;
        if (base.lived[i] && !arm.lived[i]) killed += 1;
      }
      rows.push(
        `  ${label}: reaches for the hunter ${base.lived.filter(Boolean).length}/${SEEDS}`
        + ` (${(base.souls / SEEDS).toFixed(2)} souls)`
        + `, asks the ground ${arm.lived.filter(Boolean).length}/${SEEDS}`
        + ` (${(arm.souls / SEEDS).toFixed(2)} souls)`
        + ` — saved ${saved}, killed ${killed}`,
      );
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.S2d what the hardcoded hunter costs — ${SEEDS} landings an arm:\n${rows.join('\n')}`);
    expect(rows.length).toBe(2);
  });
});

describe('PROBE: 11.S4 — how big a chore is crewing, and is it a decision', () => {
  /**
   * 11.S4 proposes standing orders: set the intent, let the band follow it,
   * surface the exceptions. It rests on a PREMISE and carries an UNMEASURED
   * clause, and both are checkable before any UI gets built.
   *
   * THE PREMISE — "for a human, a 500-day chore". Nobody has counted the taps.
   * The daily crewing is worth saved 45 / killed 0, the largest effect in the
   * repo, and a player who wants it has to issue ASSIGN by hand. How many
   * times? If it is a handful, there is no chore and the item is answering
   * nothing.
   *
   * THE UNMEASURED CLAUSE — "whether an automated crew is still a decision or
   * just a number going up". Its measurable form is CHURN: if the right crew
   * is the same crew all game, a standing order removes no decision because
   * there was none, and the feature is pure convenience. If it changes often,
   * the order is executing a live policy and which order you set matters.
   *
   * WHERE THE COUNT COMES FROM, because it is not the obvious place. The
   * harness recrews by mutating `state` BEFORE `apply`, so `watch(before,
   * after)` sees a state that has already been reassigned — comparing within
   * a transition misses every tap. The jobs are therefore compared across
   * transitions: this turn's `before` against last turn's `after`.
   */
  it('counts the taps a player would make to crew the way the bot does', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 500;

    const sample = (pol: Policy, label: string) => {
      setPolicy(pol);
      let taps = 0;
      let settledDays = 0;
      let sagas = 0;
      let worstSaga = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        let last: Record<string, string> = {};
        let seen = false;
        let here = 0;
        let days = 0;
        let lastDay = 0;
        run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          if (before.settlement) {
            const now: Record<string, string> = {};
            for (const pe of living(before.party.people)) now[pe.id] = pe.job ?? '';
            if (seen) {
              for (const id of Object.keys(now)) {
                // A hand that was not in the band last turn was not RE-crewed;
                // counting them would price births and joinings as taps.
                if (last[id] !== undefined && last[id] !== now[id]) here += 1;
              }
            }
            seen = true;
            if (after.day !== lastDay) { lastDay = after.day; days += 1; }
          }
          const kept: Record<string, string> = {};
          for (const pe of living(after.party.people)) kept[pe.id] = pe.job ?? '';
          last = kept;
        });
        if (days > 0) sagas += 1;
        taps += here;
        settledDays += days;
        worstSaga = Math.max(worstSaga, here);
      }
      return `  ${label}: ${taps} assignments changed over ${settledDays} settled band-days`
        + ` in ${sagas} sagas — ${(taps / Math.max(1, sagas)).toFixed(0)} taps a saga`
        + `, ${(taps / Math.max(1, settledDays)).toFixed(2)} a day, worst saga ${worstSaga}`;
    };

    const rows = [
      sample(SETTLER, 'the harness as it ships (crews to the mark daily)'),
      sample({ ...SETTLER, crewsToNeed: false }, 'crew set on settling day and never touched'),
      sample({ ...SETTLER, crewsByOutput: true }, 'crews to the mark AND asks the ground'),
    ];
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S4 the price of the chore — ${SEEDS} landings an arm, to day ${HORIZON}`
      + `:\n${rows.join('\n')}`,
    );
    expect(rows.length).toBe(3);
  });
});

describe('PROBE: the winter verdict — is it broken, or is it honest', () => {
  /**
   * 11.S2's flip is RULED and blocked on this. Post-flip, `reachable`
   * condemned 157 bands over 900 seeds and 91 saw spring anyway — 58% wrong
   * against 38% before — and two bars went red.
   *
   * TWO READINGS OF THE SAME NUMBER, and they call for opposite work.
   *
   * (a) The verdict is BROKEN: its projection under-models what a band that
   *     works its ground can do, so it condemns bands that were always going
   *     to live. Fix the model.
   * (b) The verdict is HONEST: it claims only "we will not reach spring on
   *     what THIS GROUND gives", and says so with "we can still rob the
   *     coast" underneath. A band that lives by robbing, trading, or burying
   *     a mouth has not falsified it. Fix the claim, or the bar's denominator.
   *
   * The absolute figures already argue for (b) — the verdict wrongly condemns
   * 87 bands per 900 seeds before the flip and 91 after, so the mistake moved
   * by four bands while the RATIO moved twenty points, purely because the
   * flip rescued the easy cases out of the condemned pool (229 -> 157). That
   * is CLAUDE.md trap 2, a denominator reselecting itself.
   *
   * But absolute stability is not the same as honesty, and P(live | told
   * dead) is the number a player actually feels. So this attributes the
   * survivals: after the day it was condemned, what did each surviving band
   * actually DO? `canGather` and `canFish` both require `!atHome`, so a
   * settled band cannot forage its way out — which already rules out the
   * obvious missing capability and is why this asks about the rest.
   */
  it('attributes what the wrongly-condemned bands did after the verdict', { timeout: 3_600_000 }, async () => {
    // MIRRORS THE BAR EXACTLY, and the first cut of this did not — it used
    // `curve-` seeds and a day-200 horizon and read 7% wrong against the
    // bar's 38%, which is not a disagreement about the verdict but two
    // different questions: P(alive at the thaw | condemned) is not P(alive at
    // day 200 | condemned), because bands die between the two. Five bands is
    // also no sample to attribute anything from. Same seeds, same horizon,
    // same definition of lived as `balance.test.ts`.
    const SEEDS = 900;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;
    setPolicy(SETTLER);

    let condemned = 0;
    let lived = 0;
    const by = { shed: 0, robbed: 0, dealt: 0, wentOut: 0, nothing: 0 };
    /**
     * BOTH ERRORS, COUNTED ABSOLUTELY, and this is the instrument the
     * deferred fix in `walkWinter` was never judged on.
     *
     * The bar reads `wronglyCondemned / condemned`, and a projection fix
     * moves BOTH halves of that: a kinder projection condemns fewer bands, so
     * the denominator shrinks and the ratio can RISE while the number of
     * players lied to falls. That is how "taking the max over every producing
     * job reads 44%" got recorded as a rejection — trap 2 inside the
     * evaluation of a fix, not inside the fix.
     *
     * So: false-dead (told dead, lived) and false-alive (never told, died),
     * both as counts per 900 seeds. A projection cannot game these together —
     * buying fewer false-deads by condemning nobody shows up immediately as
     * false-alives.
     */
    let settledEver = 0;
    let clearedAndDied = 0;
    let cleared = 0;

    for (let i = 0; i < SEEDS; i += 1) {
      let judgedOn = 0;
      let at = { souls: 0, sackings: 0, bargains: 0, expeditions: 0 };
      const final = run(`winter-inside-${i}`, SPRING_IN, (_before, after) => {
        if (judgedOn || !after.settlement) return;
        if (reachable(after)) return;
        judgedOn = after.day;
        at = {
          souls: living(after.party.people).length,
          sackings: after.tally?.sackings ?? 0,
          bargains: after.tally?.bargains ?? 0,
          expeditions: after.tally?.expeditions ?? 0,
        };
      });
      const wasSettled = !!final.settlement || judgedOn > 0;
      const survived = !final.end && final.day >= SPRING_IN;
      if (wasSettled) settledEver += 1;
      if (!judgedOn) {
        if (wasSettled) {
          cleared += 1;
          if (!survived) clearedAndDied += 1;
        }
        continue;
      }
      condemned += 1;
      if (!survived) continue;
      lived += 1;
      // Not exclusive: a band may have done several. Counted per escape so
      // the shares can overlap, and `nothing` is the residue that matters —
      // a band that lived on the ground alone IS the projection being wrong.
      const shed = living(final.party.people).length < at.souls;
      const robbed = (final.tally?.sackings ?? 0) > at.sackings;
      const dealt = (final.tally?.bargains ?? 0) > at.bargains;
      const wentOut = (final.tally?.expeditions ?? 0) > at.expeditions;
      if (shed) by.shed += 1;
      if (robbed) by.robbed += 1;
      if (dealt) by.dealt += 1;
      if (wentOut) by.wentOut += 1;
      if (!shed && !robbed && !dealt && !wentOut) by.nothing += 1;
    }

    const pc = (n: number) => (lived === 0 ? '—' : `${Math.round((n / lived) * 100)}%`);
    // eslint-disable-next-line no-console
    console.log(
      `PROBE the verdict — ${SEEDS} landings, settler, to the thaw (day ${SPRING_IN}):\n`
      + `  condemned ${condemned}, of whom ${lived} saw spring`
      + ` (${condemned ? Math.round((lived / condemned) * 100) : 0}% wrong)\n`
      + `  what the survivors did after the verdict (overlapping):\n`
      + `    buried a mouth      ${by.shed} (${pc(by.shed)})\n`
      + `    robbed somebody     ${by.robbed} (${pc(by.robbed)})\n`
      + `    traded or dealt     ${by.dealt} (${pc(by.dealt)})\n`
      + `    went out on the road ${by.wentOut} (${pc(by.wentOut)})\n`
      + `  NONE OF THOSE — lived on the ground alone: ${by.nothing} (${pc(by.nothing)})`
      + ` <- this is the only share that is the projection being wrong\n`
      + `  BOTH ERRORS, absolute, over ${SEEDS} seeds (${settledEver} ever settled):\n`
      + `    false-dead  (told dead, lived)  ${lived}\n`
      + `    false-alive (never told, died)  ${clearedAndDied} of ${cleared} cleared`,
    );
    expect(condemned).toBeGreaterThan(0);
  });
});

describe('PROBE: does the leader\'s stance still matter after 11.S1', () => {
  /**
   * 11.S1 shipped `formUp`, which stands the fit at the front by health and
   * might. That already moves the leader off the roster's rank 1 — so before
   * building a stance control, this asks whether he still has anywhere
   * INTERESTING to stand: is `formUp` already putting him where a player
   * would, or is there a real choice left?
   *
   * THE MECHANISM, re-confirmed rather than assumed: `leaderFell` costs the
   * WHOLE side 25 nerve, and `doWarCry` reaches `|rank - leader.rank| <= 2`
   * on BOTH sides — so a leader at the back dreads no enemy and hearten only
   * the men already safest; a leader at the front buys the cry's real range
   * and the heavy blow, and pays with 25 nerve if he falls. That is a real
   * trade only if it moves an outcome.
   */
  it('measures front-forced vs back-forced vs formUp default, arena and saga', { timeout: 3_600_000 }, async () => {
    const ARENA_FIGHTS = 300;
    const seed = (i: number) => `stance-${i}`;

    const deploy = (stance: 'default' | 'front' | 'back') => (s: GameState, ours: Combatant[]) => {
      const leaderId = leaderOf(s.party.people)?.id;
      const line = [...ours];
      if (stance !== 'default' && leaderId) {
        const idx = line.findIndex((c) => c.personId === leaderId);
        if (idx >= 0) {
          const [leader] = line.splice(idx, 1);
          if (stance === 'front') line.unshift(leader!);
          else line.push(leader!);
        }
      }
      return line;
    };

    function fought(i: number, stance: 'default' | 'front' | 'back') {
      const start = structuredClone(newGame(seed(i)));
      beginBattle(start, 'meadow', 2);
      const ours = start.battle!.combatants.filter((c) => c.side === 'warband');
      // THE BUG THIS FIXED IN ITSELF: `battle.ts` already assigns rank from
      // `formUp`, which is NOT roster order. `ours` is in PUSH order (roster
      // order) with `.rank` set separately. The first cut of this arm
      // reassigned rank by array position for 'default' too — silently
      // re-deploying by roster order, the exact bug 11.S1 fixed, and that is
      // why it read the leader at rank 1.00 in 300/300 fights. 'default'
      // means "leave beginBattle's own ranks alone".
      if (stance !== 'default') {
        deploy(stance)(start, ours).forEach((c, ix) => { c.rank = ix + 1; });
      }
      const leaderId = leaderOf(start.party.people)?.id;
      const leaderRank = ours.find((c) => c.personId === leaderId)?.rank ?? 0;
      let s: GameState = start;
      for (let n = 0; n < 2000 && !s.battle?.outcome; n += 1) {
        const active = activeCombatant(s.battle!);
        if (!active || active.side !== 'warband') { s = apply(s, { type: 'B_END_TURN' }); continue; }
        if (!active.hasActed) {
          const weakest = (list: Combatant[]) => [...list].sort(
            (a, b) => (fighterPerson(s, a.personId)?.health ?? 99) - (fighterPerson(s, b.personId)?.health ?? 99),
          )[0]!;
          const hits = strikeTargets(s);
          const spear = reachTargets(s);
          const shots = throwTargets(s);
          if (hits.length > 0) s = apply(s, { type: 'B_STRIKE', targetId: weakest(hits).personId });
          else if (spear.length > 0) s = apply(s, { type: 'B_REACH', targetId: weakest(spear).personId });
          else if (shots.length > 0) s = apply(s, { type: 'B_THROW', targetId: weakest(shots).personId });
        }
        s = apply(s, { type: 'B_END_TURN' });
      }
      const end = s.battle!;
      return {
        won: end.outcome === 'won',
        stood: standing(end, 'warband').length,
        leaderDown: end.combatants.some((c) => c.personId === leaderId && (c.down || c.fled)),
        leaderRank,
      };
    }

    const rows: string[] = [];
    for (const stance of ['default', 'front', 'back'] as const) {
      let wins = 0; let stood = 0; let leaderLost = 0; let rankSum = 0;
      for (let i = 0; i < ARENA_FIGHTS; i += 1) {
        const r = fought(i, stance);
        if (r.won) wins += 1;
        stood += r.stood;
        if (r.leaderDown) leaderLost += 1;
        rankSum += r.leaderRank;
      }
      rows.push(
        `  ${stance.padEnd(8)} won ${wins}/${ARENA_FIGHTS}, ${(stood / ARENA_FIGHTS).toFixed(2)} of six standing`
        + `, leader at rank ${(rankSum / ARENA_FIGHTS).toFixed(2)} on average, went down in ${leaderLost}/${ARENA_FIGHTS}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE leader stance after 11.S1 — ${ARENA_FIGHTS} fights an arm:\n${rows.join('\n')}`);
    expect(rows.length).toBe(3);
  });

  /**
   * THE ARENA READING IS INCOMPLETE ON ITS OWN, and worth saying why rather
   * than trusting it. The scripted bot above never issues B_WARCRY — it only
   * strikes, thrusts and throws — so "back beats default" there is entirely a
   * SURVIVAL reading: the leader stands where nerve punishes his fall least,
   * and the war cry's tactical value (which enemies it can dread, keyed off
   * the crier's own rank) is not in the number at all.
   *
   * So this asks in WHOLE SAGAS, with the real harness bot — which DOES issue
   * B_WARCRY (test/fixtures/harness.ts) — reordering the leader on the watch
   * hook exactly as 11.S1b did, at every battle transition rather than once.
   */
  it('prices the stance in whole sagas, with the real bot and the real war cry', { timeout: 3_600_000 }, async () => {
    const SEEDS = 150;
    const HORIZON = 500;

    const sample = (stance: 'default' | 'front' | 'back') => {
      setPolicy(SETTLER);
      const lived: boolean[] = [];
      let standing6 = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          if (stance === 'default' || !after.battle || before.battle) return;
          const ours = after.battle.combatants.filter((c) => c.side === 'warband');
          const leaderId = leaderOf(after.party.people)?.id;
          const idx = ours.findIndex((c) => c.personId === leaderId);
          if (idx < 0) return;
          const [leader] = ours.splice(idx, 1);
          const line = stance === 'front' ? [leader!, ...ours] : [...ours, leader!];
          line.forEach((c, ix) => { c.rank = ix + 1; });
        });
        lived.push(!final.end && final.day >= HORIZON);
        standing6 += living(final.party.people).length;
      }
      return { lived, standing6 };
    };

    const base = sample('default');
    const rows = [
      `  formUp default: ${base.lived.filter(Boolean).length}/${SEEDS} still standing`
      + `, ${(base.standing6 / SEEDS).toFixed(2)} people alive on average   [control]`,
    ];
    for (const stance of ['front', 'back'] as const) {
      const arm = sample(stance);
      let saved = 0;
      let killed = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        if (!base.lived[i] && arm.lived[i]) saved += 1;
        if (base.lived[i] && !arm.lived[i]) killed += 1;
      }
      rows.push(
        `  leader forced ${stance}: ${arm.lived.filter(Boolean).length}/${SEEDS} still standing`
        + `, ${(arm.standing6 / SEEDS).toFixed(2)} people alive on average`
        + `\n      paired against the control: saved ${saved}, killed ${killed}`,
      );
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(
      `PROBE the leader's stance, in whole sagas — ${SEEDS} landings an arm, settler, to day ${HORIZON}`
      + `:\n${rows.join('\n')}`,
    );
    expect(rows.length).toBe(3);
  });
});

describe('PROBE: 11.S5 — how much of a saga is winters that stopped varying', () => {
  /**
   * 6.1's own status note calls it a prerequisite that "measured at no
   * change to the curve". The arithmetic says why, and it is worth pinning
   * down before touching anything: `winterDepth` is
   * `min(WINTER_DEPTH_MAX, floorDepth(day) + bite(seed, day))`, floorDepth
   * grows WINTER_DEEPENING (2) a winter, and WINTER_DEPTH_MAX is 6 — so by
   * the FOURTH winter the floor alone (3 * 2 = 6) already meets the ceiling,
   * and every winter after that is bit-for-bit identical regardless of the
   * seeded `bite()` roll:
   *
   *   winter   floor   depth range   spread
   *   1          0       0..4          4
   *   2          2       2..6          4
   *   3          4       4..6          2
   *   4          6       6..6          0   <- no variance left, forever
   *
   * So "winters that vary" stops varying by the game's fourth winter. This
   * asks what that costs in a real saga: of every winter a band actually
   * lives through, how many still have any spread left?
   */
  it('counts how many lived winters still have any severity variance left', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 500;
    setPolicy(SETTLER);

    let wintersLived = 0;
    let flatlined = 0;
    const byIndex: Record<number, number> = {};

    for (let i = 0; i < SEEDS; i += 1) {
      let lastStood = -1;
      run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
        if (!after.settlement) return;
        // Count once per winter actually entered, on the day it starts.
        if (seasonOf(after.day) !== 'winter' || seasonOf(before.day) === 'winter') return;
        const idx = wintersStood(after.day);
        if (idx === lastStood) return;
        lastStood = idx;
        wintersLived += 1;
        byIndex[idx] = (byIndex[idx] ?? 0) + 1;
        const floor = idx * 2;
        if (floor >= 6) flatlined += 1;
      });
    }

    const rows = Object.keys(byIndex).map(Number).sort((a, b) => a - b).map(
      (idx) => `    winter #${idx + 1}: lived ${byIndex[idx]} times, floor ${idx * 2}`
        + `${idx * 2 >= 6 ? ' (flatlined)' : ''}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S5 winters lived, and how many still vary — ${SEEDS} landings, settler, to day ${HORIZON}:\n`
      + `${rows.join('\n')}\n`
      + `  total winters lived: ${wintersLived}, of which flatlined (zero spread left): ${flatlined}`
      + ` (${wintersLived ? Math.round((flatlined / wintersLived) * 100) : 0}%)`,
    );
    expect(wintersLived).toBeGreaterThan(0);
  });
});

describe('PROBE: 11.S5 — what restoring the bite past year three costs', () => {
  /**
   * The FIX, priced. `winterDepth` used to cap the SUM of floor and bite at
   * WINTER_DEPTH_MAX (6); now it caps the floor alone and lets bite add on
   * top, so a winter past the third can land as high as 10 instead of a
   * fixed 6. That is a real balance change on the tail of the difficulty
   * curve, not a cosmetic one, and it gets the same treatment every other
   * balance change in this file gets: paired seeds, saved/killed, stated.
   */
  it('prices the restored variance in whole sagas', { timeout: 3_600_000 }, async () => {
    const SEEDS = 150;
    const HORIZON = 500;
    setPolicy(SETTLER);
    const lived: boolean[] = [];
    for (let i = 0; i < SEEDS; i += 1) {
      const final = run(armSeed(0, i, SEEDS), HORIZON);
      lived.push(!final.end && final.day >= HORIZON);
    }
    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.S5 the fix, in whole sagas — ${SEEDS} landings, settler, to day ${HORIZON}: `
      + `${lived.filter(Boolean).length}/${SEEDS} still standing\n`
      + `  bitstring: ${lived.map((l) => (l ? '1' : '0')).join('')}`,
    );
    expect(lived.length).toBe(SEEDS);
  });
});

describe('PROBE: 11.M3 — can a starving band actually trade its way out', () => {
  /**
   * The item's own caveat: 10.1's "despair bands fall on neighbours 2.9x"
   * reading is the HARNESS's rule, not the game's, and the item proposes
   * making the neighbour card "name both sides of the trade" so a player,
   * unlike the untuned bot, sees the peaceful door.
   *
   * RE-VERIFIED IN CODE FIRST, and it changes the shape of the fix. The
   * desperation branch this is about fires on `days < 3` — FOOD nearly
   * gone — and `bargain()` is fixed in ONE direction: food OUT, firewood
   * IN. A neighbour's barter, unlike a PLACE's market (`data/places.ts` has
   * offers running firewood-for-food too), cannot buy food with anything.
   * So the "trade" the card would be naming, in exactly the crisis that
   * triggers it, spends the one store the band is short of to buy a store
   * it did not ask for.
   *
   * `barterBeforeFallOn` (test/fixtures/harness.ts) tries barter first in
   * this exact branch when the game allows it, and this asks the question
   * structurally rather than assuming the answer: does trying it help, do
   * nothing, or actively cost the band that fires it?
   */
  it('prices trying to barter before falling on, in whole sagas', { timeout: 3_600_000 }, async () => {
    const SEEDS = 150;
    const HORIZON = 500;
    const base = (() => {
      setPolicy(SETTLER);
      const lived: boolean[] = [];
      let sackings = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON);
        lived.push(!final.end && final.day >= HORIZON);
        sackings += final.tally?.sackings ?? 0;
      }
      return { lived, sackings };
    })();
    // THE INSTRUMENT CHECK, and it is what a tied arm needs before it is
    // trusted (CLAUDE.md trap 3): if the branch almost never actually FIRES
    // — `bargainBlocker` refuses it because a band this desperate usually
    // has under BARTER_FOOD in store too — the tie proves nothing about
    // whether the trade helps, only that it rarely happens. Watched
    // directly: a bargain struck while the band was inside the days<3
    // window this branch gates on, whichever exact line dispatched it.
    let firedInCrisis = 0;
    const arm = (() => {
      setPolicy({ ...SETTLER, barterBeforeFallOn: true });
      const lived: boolean[] = [];
      let sackings = 0;
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          const struck = (after.tally?.bargains ?? 0) > (before.tally?.bargains ?? 0);
          if (!struck || !before.settlement) return;
          const days = before.party.food / Math.max(1, foodPerDay(before));
          if (days < 3) firedInCrisis += 1;
        });
        lived.push(!final.end && final.day >= HORIZON);
        sackings += final.tally?.sackings ?? 0;
      }
      return { lived, sackings };
    })();
    setPolicy(SETTLER);

    let saved = 0;
    let killed = 0;
    for (let i = 0; i < SEEDS; i += 1) {
      if (!base.lived[i] && arm.lived[i]) saved += 1;
      if (base.lived[i] && !arm.lived[i]) killed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.M3 trying to barter before falling on — ${SEEDS} landings, settler, to day ${HORIZON}:\n`
      + `  as it ships     : ${base.lived.filter(Boolean).length}/${SEEDS} standing, ${base.sackings} sackings\n`
      + `  barters first   : ${arm.lived.filter(Boolean).length}/${SEEDS} standing, ${arm.sackings} sackings\n`
      + `  paired against the control: saved ${saved}, killed ${killed}\n`
      + `  bargains struck WHILE inside the days<3 crisis window: ${firedInCrisis} across ${SEEDS} landings`,
    );
    expect(base.lived.length).toBe(SEEDS);
  });
});

describe('PROBE: 11.M4 — what actually separates the doomed from the survivors', () => {
  /**
   * 11.M4 opened on 10.1's reading: food in store on day 49 read 33.6 /
   * 35.7 / 33.7 across starved / despair / still-standing bands — no
   * separation at all, on the most-watched number in the game.
   *
   * RE-TAKEN FIRST, on the identical instrument, because six items and five
   * balance changes sit between that reading and this one (11.S1's
   * deployment fix, 11.S2's flip, 11.V's verdict repair, 11.S5's winter
   * depth fix, 11.M2, 11.M3 — several of them touch survival directly). It
   * did NOT hold: on `even` terms, day-49 food now reads 34.4 (starved) /
   * 35.1 (despair) / 46.9 (still standing) — still-standing bands are
   * carrying about twelve MORE food at the same day than either doomed
   * group. `fair` agrees in shape: 53.4 / 47.0 / 60.3.
   *
   * So the premise survives only in a narrower form: food does not tell the
   * TWO WAYS of being doomed apart from EACH OTHER (starved vs. despair),
   * and the existing day-49 data says band size does not either (6.0 / 5.9 /
   * 6.1) nor does having settled by then (33/35, 19/19, 18/18 — all near
   * saturated). This asks the two named candidates that data could not
   * answer: the SITE READING, and the JOB MIX.
   */
  it('checks the site reading and the job mix against the same three groups', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const out: string[] = [];

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      setPolicy(SETTLER);
      const group: Record<string, {
        n: number; total: number; jobs: Record<string, number>;
      }> = {};

      for (let i = 0; i < SEEDS; i += 1) {
        const seed = armSeed(0, i, SEEDS);
        const early = run(seed, 49, undefined, terms);
        const full = run(seed, 400, undefined, terms);
        const key = full.end?.cause ?? 'still standing';
        if (!early.settlement) continue;
        const g = group[key] ?? (group[key] = { n: 0, total: 0, jobs: {} });
        g.n += 1;
        g.total += stopReport(early.seed, early.settlement.stop ?? 0).total;
        for (const p of living(early.party.people)) {
          const j = p.job ?? 'idle';
          g.jobs[j] = (g.jobs[j] ?? 0) + 1;
        }
      }

      const rows = Object.entries(group)
        .sort((a, b) => b[1].n - a[1].n)
        .map(([k, g]) => {
          const jobLine = Object.entries(g.jobs)
            .sort((a, b) => b[1] - a[1])
            .map(([j, n]) => `${j} ${(n / g.n).toFixed(1)}`)
            .join(', ');
          return `    ${k.padEnd(15)} n=${String(g.n).padStart(3)}`
            + ` | site reading ${(g.total / g.n).toFixed(1)}/25`
            + ` | jobs (avg per band): ${jobLine}`;
        });
      out.push(`  ${terms}, settled by day 49:\n${rows.join('\n')}`);
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.M4 site reading and job mix, day 49 — ${SEEDS} landings an arm, settler:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: 11.M1 — what actually kills a band that never finds land', () => {
  /**
   * 10.1 opened this item on "23 of 74 starved sagas on even never founded a
   * steading at all — 31%". RE-TAKEN in the same run as 11.M4 (identical
   * instrument, same seeds): 22/60 (37%) on even, 3/65 (5%) on fair. The
   * population is real and, if anything, larger than the item opened on.
   *
   * WHAT THE ITEM PROPOSES IS A FIX FOR COLD, NOT FOR HUNGER — "heavier
   * firewood, survivable if provisioned" describes a shelter cost, and
   * 11.M3 is the reason that distinction is not a technicality: a fix aimed
   * at the wrong store measures as nothing, because it does not touch the
   * thing that is actually killing anybody. So before designing a camp,
   * this asks what kills the bands that never find land — the cold a camp
   * would answer, or the hunger it would not.
   */
  it('breaks down the fate of every band that never founded a steading', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 400;
    const out: string[] = [];

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      setPolicy(SETTLER);
      let never = 0;
      let frozen = 0;
      let hungered = 0;
      let violent = 0;
      let stillWandering = 0;
      let daysAlive = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), HORIZON, undefined, terms);
        if (s.settlement) continue;
        never += 1;
        daysAlive += s.day;
        if (!s.end) { stillWandering += 1; continue; }
        for (const p of s.party.people) {
          if (p.alive || p.left) continue;
          const f = p.fate ?? '';
          if (f === 'the cold') frozen += 1;
          else if (f === 'hunger' || f === 'short commons') hungered += 1;
          else if (DEATHS.includes(f)) violent += 1;
        }
      }

      out.push(
        `  ${terms}: ${never}/${SEEDS} never founded a steading at all`
        + ` (avg day ${never ? Math.round(daysAlive / never) : 0})\n`
        + `      of the fallen among them: cold ${frozen}, hunger ${hungered}, violence ${violent}\n`
        + `      still wandering, alive, at day ${HORIZON}: ${stillWandering}/${never}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.M1 what kills the never-founded — ${SEEDS} landings an arm, settler:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });

  /**
   * THE AVERAGE END DAY WAS 31 — BEFORE WINTER EVEN OPENS (day 49). That
   * means most of the "never founded" population is not a band caught out
   * by an unroofed winter at all; it is a band that failed during ordinary
   * summer travel, for reasons a winter camp cannot touch. Split the same
   * population by whether the end came before or after winter opens, so the
   * item's actual target — bands caught BY winter — is not averaged away
   * inside a bigger population it was never about.
   */
  it('splits the never-founded by whether they even reached winter', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 400;
    const WINTER_OPENS = 49;
    const out: string[] = [];

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      setPolicy(SETTLER);
      let never = 0;
      let beforeWinter = 0;
      let afterWinter = 0;
      let afterFrozen = 0;
      let afterHungered = 0;
      let afterViolent = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const s = run(armSeed(0, i, SEEDS), HORIZON, undefined, terms);
        if (s.settlement || !s.end) continue;
        never += 1;
        if (s.day < WINTER_OPENS) { beforeWinter += 1; continue; }
        afterWinter += 1;
        for (const p of s.party.people) {
          if (p.alive || p.left) continue;
          const f = p.fate ?? '';
          if (f === 'the cold') afterFrozen += 1;
          else if (f === 'hunger' || f === 'short commons') afterHungered += 1;
          else if (DEATHS.includes(f)) afterViolent += 1;
        }
      }

      out.push(
        `  ${terms}: ${never} never-founded deaths total`
        + ` — ${beforeWinter} before winter even opened (day < ${WINTER_OPENS}, a camp cannot touch these)`
        + `, ${afterWinter} at or after\n`
        + `      of the AFTER-WINTER fallen: cold ${afterFrozen}, hunger ${afterHungered}, violence ${afterViolent}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.M1b before vs after winter opens — ${SEEDS} landings an arm, settler:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: 11.M5 — the road verb nobody has ever tried', () => {
  /**
   * 9.1 swept the battle verbs and found the shield was not dead, only
   * mis-measured — every arm had put it last in priority, so it never got
   * offered a turn. 11.M5 asks the same question of colony and travel: has
   * anything there been silently unused the same way?
   *
   * `HUNT` is: `doHunt` in `sim/gathering.ts` is a full verb with its own
   * reducer case, its own stat term and its own depletion pool, structurally
   * identical to `doForage` — and no policy in `test/fixtures/harness.ts`
   * has ever dispatched it on the road (confirmed by grep and by the
   * instrument check below: the base arm hunts zero times). The road's food
   * fallback only ever tries FORAGE then FISH.
   *
   * Unlike the shield, this is not a priority-ordering bug — `terrainDef`
   * (src/data/terrain.ts) prices hunt BELOW forage on four of seven
   * countries and only strictly above it on one: hills, 3 against 2.
   * (Forest, mountains and bog tie; ocean/shore/valley/meadow all favour
   * forage.) So the honest question is the narrow one 9.1 asked of the
   * shield: does taking hunt in exactly its one good case move anything, or
   * is the gap too small to matter next to everything else a saga survives?
   *
   * `huntsBetterGround` (harness.ts) swaps FORAGE for HUNT precisely where
   * `terrainDef` says hunt pays more — which on the current data is hills
   * and hills alone — leaving every other country's choice untouched.
   */
  it('prices hunting hills instead of foraging them, in whole sagas', { timeout: 3_600_000 }, async () => {
    const SEEDS = 150;
    const HORIZON = 500;

    let baseHunts = 0;
    const base = (() => {
      setPolicy(SETTLER);
      const lived: boolean[] = [];
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          const prevN = before.beats?.[before.beats.length - 1]?.n ?? 0;
          const last = after.beats?.[after.beats.length - 1];
          if (last && last.n !== prevN && last.kind === 'gathered' && last.how === 'hunt') {
            baseHunts += 1;
          }
        });
        lived.push(!final.end && final.day >= HORIZON);
      }
      return { lived };
    })();

    // THE INSTRUMENT CHECK (CLAUDE.md trap 3): the item's whole claim rests
    // on HUNT never firing today. If it turns out the base arm already
    // hunts sometimes, "nobody has tried it" is wrong and the reading below
    // needs a different frame.
    const neverHuntedBefore = baseHunts === 0;

    let armHunts = 0;
    let huntsOffHills = 0;
    const arm = (() => {
      setPolicy({ ...SETTLER, huntsBetterGround: true });
      const lived: boolean[] = [];
      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          const prevN = before.beats?.[before.beats.length - 1]?.n ?? 0;
          const last = after.beats?.[after.beats.length - 1];
          if (last && last.n !== prevN && last.kind === 'gathered' && last.how === 'hunt') {
            armHunts += 1;
            if (countryHere(before) === 'hills') huntsOffHills += 1;
          }
        });
        lived.push(!final.end && final.day >= HORIZON);
      }
      return { lived };
    })();
    setPolicy(SETTLER);

    let saved = 0;
    let killed = 0;
    for (let i = 0; i < SEEDS; i += 1) {
      if (!base.lived[i] && arm.lived[i]) saved += 1;
      if (base.lived[i] && !arm.lived[i]) killed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `PROBE 11.M5 hunting hills instead of foraging them — ${SEEDS} landings, settler, to day ${HORIZON}:\n`
      + `  terrainDef hills: forage ${terrainDef('hills').forage}, hunt ${terrainDef('hills').hunt}\n`
      + `  as it ships     : ${base.lived.filter(Boolean).length}/${SEEDS} standing, hunts dispatched ${baseHunts}`
      + ` (never tried before this knob existed: ${neverHuntedBefore})\n`
      + `  hunts hills     : ${arm.lived.filter(Boolean).length}/${SEEDS} standing, hunts dispatched ${armHunts}`
      + ` (${huntsOffHills} of them off hills terrain — should equal the total)\n`
      + `  paired against the control: saved ${saved}, killed ${killed}`,
    );
    expect(base.lived.length).toBe(SEEDS);
  });
});

describe('PROBE: 11.U4 — what the fighting has actually cost', () => {
  /**
   * The item rests on two claims and they need separating.
   *
   * The FIRST is 10.2's: battle is 39% of the settler's dead and 47% of the
   * raider's. That is a share of deaths and it is re-taken here on the same
   * instrument rather than inherited.
   *
   * The SECOND is the reason the item gives for wanting a panel — "the bleed
   * that is about to kill them by hunger" — and it is a CAUSAL claim: losing
   * people to violence is what starves the band. 11.M4 measured the
   * neighbouring fact one day earlier and it does not agree: hands at day 49
   * came out 6.0 / 5.9 / 6.1 across starved / despair / still-standing, flat.
   * If band size does not separate the doomed from the survivors, then
   * violent losses may not either, and a panel sold as "see the bleed that
   * will starve you" would be selling a chain the game does not have.
   *
   * So this asks both at once: the share, and whether the bleed predicts the
   * ending. Violent losses are counted BY DAY 49 — before winter opens — so
   * the reading is what a mid-run panel could have shown while there was
   * still a decision to make, not a post-hoc count that includes the deaths
   * of the losing itself.
   */
  it('re-takes the share of dead the fighting owns, and asks whether the bleed predicts the ending', { timeout: 3_600_000 }, async () => {
    const SEEDS = 120;
    const HORIZON = 400;
    const WINTER_OPENS = 49;
    const out: string[] = [];

    for (const [name, pol] of [['settler', SETTLER], ['raider', RAIDER]] as const) {
      setPolicy(pol);
      let dead = 0;
      let violent = 0;
      // Violent losses by day 49, grouped by how the saga finished — the
      // reading the item's causal clause needs and nobody has taken.
      const byEnd: Record<string, { sagas: number; bledBy49: number; anyBled: number }> = {};

      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, undefined, 'fair');
        let bledBy49 = 0;
        for (const p of final.party.people) {
          if (p.alive || p.left) continue;
          dead += 1;
          const fate = p.fate ?? '';
          if (!DEATHS.includes(fate)) continue;
          violent += 1;
          if ((p.diedOn ?? HORIZON) < WINTER_OPENS) bledBy49 += 1;
        }
        // ONLY BANDS THAT REACHED THE WINDOW. A saga that ended on day 30 had
        // thirty days in which to bleed against another's forty-nine, so
        // counting them together compares exposure and calls it a finding —
        // CLAUDE.md's trap 2, and the bias runs in exactly the direction that
        // would manufacture the raider reading. A band whose saga was already
        // over is also not one a mid-run autumn panel could ever have warned.
        if (final.day < WINTER_OPENS) continue;
        const how = final.end?.cause ?? 'still standing';
        const row = byEnd[how] ?? { sagas: 0, bledBy49: 0, anyBled: 0 };
        row.sagas += 1;
        row.bledBy49 += bledBy49;
        if (bledBy49 > 0) row.anyBled += 1;
        byEnd[how] = row;
      }

      const groups = Object.entries(byEnd)
        .sort((a, b) => b[1].sagas - a[1].sagas)
        .map(([how, r]) => `      ${how.padEnd(14)} n=${String(r.sagas).padStart(3)}`
          + ` | violent losses by day 49: ${(r.bledBy49 / r.sagas).toFixed(2)} a saga`
          + ` | sagas that bled at all: ${r.anyBled}/${r.sagas}`)
        .join('\n');

      out.push(
        `  ${name}: ${dead} dead over ${SEEDS} sagas, ${violent} of them to violence`
        + ` — ${dead > 0 ? Math.round((violent / dead) * 100) : 0}% (10.2 said`
        + ` ${name === 'settler' ? '39' : '47'}%)\n${groups}`,
      );
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.U4 the cost of fighting — ${SEEDS} landings an arm, fair terms, to day ${HORIZON}:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: 11.U5 — is there a thread of known foes to draw', () => {
  /**
   * The item says "the data is all there and appears once, in one log line",
   * and proposes a "who we have fought" list to make the named foe a thread.
   *
   * BOTH HALVES NEED CHECKING, and the first fails on a code read alone.
   * A champion is not a record of a fight, it is a slot on a NEIGHBOUR:
   * `clan.champion` holds ONE man, is overwritten every time that clan sends
   * another, and is DELETED outright when he is put down (`battleTurn.ts`).
   * So the state cannot answer "who have we fought" — only "who does each
   * clan have right now", with everyone you killed erased. A history would
   * be new persisted shape, a SAVE_VERSION bump and a migration, not a
   * readout of what is already kept.
   *
   * The second half is the thread itself, and 9.5 already measured it and
   * wrote the figure into `battleTurn.ts`: a champion who walks away leads a
   * repeat fight in 5% of clan fights on even and 3% on fair, and only 22%
   * of champion fights belong to a clan at all. Re-taken here rather than
   * inherited, and asked in the shape the PANEL needs: how many rows would
   * it have, and how many of them would name a man met more than once?
   */
  it('counts the rows such a list would have, and the foes ever met twice', { timeout: 3_600_000 }, async () => {
    const SEEDS = 80;
    const HORIZON = 400;
    const out: string[] = [];

    for (const [name, pol] of [['settler', SETTLER], ['raider', RAIDER]] as const) {
      setPolicy(pol);
      let championFights = 0;
      let clanFights = 0;
      let returns = 0;
      let killed = 0;
      let rowsAtEnd = 0;
      let sagasWithAnyRow = 0;
      let sagasWithTwoRows = 0;
      let scarredAtEnd = 0;

      for (let i = 0; i < SEEDS; i += 1) {
        const final = run(armSeed(0, i, SEEDS), HORIZON, (before, after) => {
          // A fight that has just begun, and whose man it is.
          if (!before.battle && after.battle) {
            if (after.battle.champion) championFights += 1;
            const of = after.battle.championOf;
            if (of) {
              clanFights += 1;
              // Scars are added when he WALKS OFF, at the end of a fight, so
              // any he already carries as this one opens were earned on an
              // earlier field: this is a man met before, not a new one.
              const clan = after.neighbours.find((n) => n.id === of);
              if ((clan?.champion?.scars ?? 0) > 0) returns += 1;
            }
          }
          // Held a champion a moment ago and does not now: put down, and
          // gone from the record with him.
          for (const was of before.neighbours) {
            if (!was.champion) continue;
            const now = after.neighbours.find((n) => n.id === was.id);
            if (now && !now.champion) killed += 1;
          }
        }, 'fair');

        const rows = final.neighbours.filter((n) => n.champion);
        rowsAtEnd += rows.length;
        if (rows.length >= 1) sagasWithAnyRow += 1;
        if (rows.length >= 2) sagasWithTwoRows += 1;
        scarredAtEnd += rows.filter((n) => (n.champion?.scars ?? 0) > 0).length;
      }

      out.push(
        `  ${name}: ${championFights} fights with a named man, ${clanFights} of them a clan's`
        + ` — ${championFights > 0 ? Math.round((clanFights / championFights) * 100) : 0}%`
        + ` (the item said 22%)\n`
        + `      a man met BEFORE: ${returns} of ${clanFights} clan fights`
        + ` — ${clanFights > 0 ? Math.round((returns / clanFights) * 100) : 0}%`
        + ` (9.5 said 3% on fair)\n`
        + `      champions put down (erased from the record): ${killed}\n`
        + `      THE LIST AT SAGA END: ${(rowsAtEnd / SEEDS).toFixed(2)} rows a saga`
        + ` | sagas with any row at all ${sagasWithAnyRow}/${SEEDS}`
        + ` | with two or more ${sagasWithTwoRows}/${SEEDS}`
        // NOT "met twice": scars are earned by walking off a field alive, so
        // scars>0 on a surviving row means he survived the ONE meeting he
        // had. Whether anybody was ever met a second time is `returns`
        // above, and only that. The first cut of this line called it "met
        // twice" and would have reported five of them where the honest
        // number is nought.
        + ` | rows naming a man who walked off alive ${scarredAtEnd}`,
      );
    }
    setPolicy(SETTLER);

    // eslint-disable-next-line no-console
    console.log(`PROBE 11.U5 known foes — ${SEEDS} landings an arm, fair terms, to day ${HORIZON}:\n${out.join('\n')}`);
    expect(out.length).toBe(2);
  });
});

describe('PROBE: where the wrongly-condemned actually got their food', () => {
  /**
   * THE LAST UNANSWERED PIECE OF 11.S2's BLOCKER, and it decides which of two
   * different repairs is the right one.
   *
   * `reachable` says "we will not reach spring on what THIS GROUND gives".
   * The bar allows 40% of the condemned to live anyway; post-flip it reads
   * 58%. 11.S2 attributed the survivals and found **54% lived on the ground
   * ALONE** — no mouth buried, nobody robbed, nothing traded, no road taken —
   * and called that share "the projection being wrong and nothing else".
   *
   * BUT THAT ATTRIBUTION HAS A HOLE, and it is the shape of a trap this file
   * keeps finding: it is a list of four things ruled OUT, so anything not on
   * the list falls into "the ground alone" by default. An EVENT CARD that
   * hands a band food is none of the four. If the cards are feeding them,
   * the projection is not wrong at all — it is being judged against luck it
   * cannot see and should not model, and the repair is to the BAR rather
   * than to `walkWinter`.
   *
   * Instrument: food that arrives WITHOUT the day advancing is food no day's
   * work produced — a card, a choice, a gift. Food arriving as the day turns
   * is the ground. Both are counted only AFTER the verdict, because that is
   * the window the panel's claim covers.
   *
   * Mirrors the bar exactly — same seeds, same `even` terms, same horizon —
   * so the two populations are the same bands.
   */
  it('names the action behind every unit of food they took in', { timeout: 3_600_000 }, async () => {
    const SEEDS = 300;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    /**
     * ATTRIBUTED BY CAUSE, NOT BY COMPANY, since 2026-09-04, and the third
     * version of this instrument in two days.
     *
     * The first cut called every unit that arrived without the day advancing
     * "a card", which was a guess. The second proved the card half — an event
     * is present on `state.event` and `sim/events.ts` deletes it when it
     * resolves — and reported **0 of 183**: the lead was refuted, and the
     * residue got bigger, not smaller. 183 units reaching condemned bands
     * with no day and no card is more food than the 150 every worked day
     * produced between them, and it was unexplained.
     *
     * The ROADMAP's own next step was "attribute by what else moved alongside
     * the food". That would have been a fourth guess. `run` now hands the
     * watcher the ACTION it applied, so each unit is filed under the thing
     * that actually caused it. Buckets are collected by observation rather
     * than declared, so an unforeseen source appears as its own row instead
     * of being absorbed into a residue.
     */
    setPolicy(SETTLER);
    let condemned = 0;
    let lived = 0;
    /**
     * AND THE SHARP NUMBER THE TOTALS CANNOT GIVE. Units summed across bands
     * say what the population ate; they do not say how many BANDS the ground
     * fed on its own. A survivor who took one unit from a card is not a
     * survivor the projection got wrong, and one who took ninety is not
     * ninety of them. So each surviving band is also classed by whether any
     * of its post-verdict food came from anywhere but the day's work.
     */
    let livedOnGroundAlone = 0;
    let livedOnLuck = 0;
    const all = new Map<string, number>();
    const among = new Map<string, number>();
    let withDay = 0;
    let withoutDay = 0;
    let fromCards = 0;
    const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

    for (let s = 0; s < SEEDS; s += 1) {
      let saidNo = false;
      const mine = new Map<string, number>();
      let day = 0;
      let still = 0;
      let card = 0;
      const final = run(`winter-inside-${s}`, SPRING_IN, (before, after, action) => {
        if (after.end || !after.settlement) return;
        if (!saidNo) {
          if (!markVisible(after) || reachable(after)) return;
          saidNo = true;
          return;
        }
        const gained = after.party.food - before.party.food;
        if (gained <= 0) return;
        add(mine, action.type, gained);
        if (after.day > before.day) day += gained; else still += gained;
        if (before.event && !after.event) card += gained;
      }, 'even');
      if (!saidNo) continue;
      condemned += 1;
      withDay += day;
      withoutDay += still;
      fromCards += card;
      const survived = !final.end && final.day >= SPRING_IN;
      if (survived) {
        lived += 1;
        const notTheGround = [...mine.entries()]
          .filter(([k]) => k !== 'CAMP')
          .reduce((a, [, n]) => a + n, 0);
        if (notTheGround > 0) livedOnLuck += 1; else livedOnGroundAlone += 1;
      }
      for (const [k, n] of mine) {
        add(all, k, n);
        if (survived) add(among, k, n);
      }
    }

    const total = [...all.values()].reduce((a, b) => a + b, 0);
    const rows = [...all.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `    ${k.padEnd(16)} ${Math.round(n).toString().padStart(5)}`
        + ` (${total ? Math.round((n / total) * 100) : 0}%)`
        + `   of which to bands that LIVED: ${Math.round(among.get(k) ?? 0)}`);

    // eslint-disable-next-line no-console
    console.log(
      `PROBE what fed the wrongly-condemned — ${SEEDS} seeds, even terms, to day ${SPRING_IN}:\n`
      + `  condemned ${condemned}, of whom ${lived} lived`
      + ` (${condemned ? Math.round((lived / condemned) * 100) : 0}% — the bar's ratio)\n`
      + `  ${Math.round(total)} units of food after the verdict, BY THE ACTION THAT BROUGHT IT:\n`
      + `${rows.join('\n')}\n`
      + `  OF THE ${lived} SURVIVORS, by band rather than by unit:\n`
      + `    lived on the ground alone (every unit from the day's work): ${livedOnGroundAlone}\n`
      + `    took food a card or a fight gave them:                      ${livedOnLuck}\n`
      + `  cross-check against the old split: ${Math.round(withDay)} arrived as the day turned,`
      + ` ${Math.round(withoutDay)} with no day, ${Math.round(fromCards)} seen by the`
      + ` deleted-event detector (which fires a turn too late — see the note)`,
    );
    expect(condemned).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
    // Every unit is filed under some action by construction; this asserts the
    // buckets and the day/no-day split are two views of ONE population, so a
    // future edit cannot let them drift apart unnoticed.
    expect(Math.round(total)).toBe(Math.round(withDay + withoutDay));
  });
});
