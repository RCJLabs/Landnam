// The scripted player, and everything the measurements are taken WITH.
//
// Lifted wholesale out of balance.test.ts on 2026-08-31 so the diagnostic
// probes could live in their own file. Two things changed in the move and
// nothing else did: the `../src/` imports became `../../src/` because this
// file sits a directory deeper, and the four mutable knobs grew setters
// (explained at the foot) because a test in another module can READ an
// imported binding but cannot assign to one.
//
// The move is verified the only way a harness move can be — by what the bot
// DOES, not by what the diff looks like. The curve and the hardship arms have
// to read exactly what they read before it, 77/53/27/42 and 81/55/27; a
// harness that behaves differently prints different numbers. The cut itself
// was checked line by line first: every non-comment line of the old file is
// present in the three new ones verbatim, or with an `export` in front of it,
// or as the setter form of a knob assignment — and the 103 test names, 225
// assertions and 57 printed tables all still exist, in that order.
//
// WHY THIS IS NOT A `.test.ts` FILE. Importing one test file from another
// executes its `describe`s in the importer, so every bar would register and
// run twice. A fixture is a plain module.

import { newGame } from '../../src/state/create';
import { seasonOf } from '../../src/sim/calendar';
import { apply, type Action } from '../../src/sim/actions';
import { atSea } from '../../src/sim/road';
import { canGather, canFish } from '../../src/sim/gathering';
import { abundance } from '../../src/sim/abundance';
import { canFound } from '../../src/sim/site';
import { holed } from '../../src/sim/ship';
import { assign, availableJobs, output, queueBuild } from '../../src/sim/colony';
import { abandonSteading, canAbandon } from '../../src/sim/retreat';
import { foodPerDay, firewoodPerNight } from '../../src/sim/upkeep';
import { leaderOf, sworn } from '../../src/sim/people';
import { KEPT_FOR, canKeepHall, feastCost, sinceKept } from '../../src/sim/hall';
import { crowding } from '../../src/sim/colony';
import { foundSettlement } from '../../src/sim/site';
import { isWarbandTurn } from '../../src/sim/battle';
import { reachTargets, throwTargets } from '../../src/sim/strike';
import { canActFrom } from '../../src/sim/ranks';
import { WARCRY_RANGE } from '../../src/sim/warcry';
import { strikeTargets } from '../../src/sim/battle';
import { offersAt, placeHere, tradeBlocker } from '../../src/sim/places';
import { campStores } from '../../src/sim/plunder';
import { strandTarget } from '../../src/sim/sea';
import { placeKind } from '../../src/data/places';
import { bargainBlocker, canFallOn, neighbourHere } from '../../src/sim/neighbours';
import { canCallThing, hasSpeakers } from '../../src/sim/thing';
import { fieldCrew, launchBlocker, provisionsFor } from '../../src/sim/expedition';
import { sailBlocker } from '../../src/sim/voyage';
import { BARTER_FOOD } from '../../src/data/clans';
import { wintersStood } from '../../src/sim/calendar';
import { terrainDef } from '../../src/data/terrain';
import type { GameState } from '../../src/state/types';
import { jobById, type JobId } from '../../src/data/jobs';
import { type HardshipId } from '../../src/data/hardship';
import { forecast, markVisible } from '../../src/sim/winter';
import { reachable } from '../../src/sim/reach';
import { ROUTE_STOPS, daysBetween, stopAt } from '../../src/sim/route';
import { hasTrod, knowsStop, learnStop, standingAt, walkOptions } from '../../src/sim/coast';
import { groundAtStop } from '../../src/sim/fishery';
import { stopReport } from '../../src/sim/site';

export const CREW: JobId[] = ['farmer','farmer','woodcutter','hunter','builder','warrior'];

/**
 * AUDIT ITEM 7: how this band decides to live.
 *
 * Every number this repo carries describes ONE strategy — settle early, work
 * the jobs, hold the line, trade until somebody will speak for you. Whether
 * the game supports a SECOND way of playing has never been tested, and
 * "there is more than one way to play" is a claim it has been making since
 * phase 4 without evidence either way.
 *
 * So the bot's opinions are a parameter now instead of constants scattered
 * through it. The settler is exactly what the harness has always been and
 * every figure in ROADMAP.md still means what it meant; the other two are
 * the honest alternatives a player would actually try.
 */
export interface Policy {
  id: string;
  /** How good a site has to be before the posts go in. */
  siteFloor: number;
  /**
   * The day the band starts lowering that bar, or undefined to never lower it.
   *
   * OPT-IN, and undefined on every policy that existed before it, so no
   * measurement in this file moves by adding it. A fixed floor is the one
   * thing the settling bot does that no player does: winter comes on day 49,
   * and a band still walking on day 40 does not hold out for good soil, it
   * takes what it can get. Measured, the fixed floor of 9 fails to settle AT
   * ALL in 45 of 120 seeds — the band dies on the road with the posts still
   * in the boat.
   */
  relaxFrom?: number;
  /** Last day a band still looking for a home turns aside for plunder. */
  plunderWindow: number;
  /** How far out it goes under arms once settled. Zero: it never does. */
  raidReach: number;
  /**
   * How many of the sworn go out on an armed errand.
   *
   * Three was hard-coded, and it was never chosen: `raidTarget` only puts a
   * CAMP on the list when the roster is five or more, so the bot picked
   * targets sized for a full band and then sent half of one at them. Whether
   * that is what breaks raiding or merely how this harness raids is the
   * whole of task 31's first question, so it is a knob now.
   */
  raidParty: number;
  /**
   * Winters the band must have stood before it will go out under arms, and
   * whether it only goes in the raiding season.
   *
   * Both were hard-coded in the bot and neither is a rule of the GAME —
   * `launchBlocker` asks for a steading, a crew and provisions, and nothing
   * else. So a measurement of "how often can the raider go" was more than
   * half a measurement of the harness's own scruples: 53% of settled days
   * failed on `wintersStood >= 1` alone. Knobs, so the question can be put
   * to the game instead of to the bot.
   */
  raidAfterWinters: number;
  raidInSeasonOnly: boolean;
  /** Whether it will carry food out to make a friend on the coast. */
  trades: boolean;
  /**
   * And whether it will do so as a matter of course rather than as a means to
   * the Thing. OPT-IN, undefined everywhere it existed before.
   *
   * The bot's trade errand is gated on `!hasSpeakers` and a winter stood,
   * because it goes to market to find somebody who will SPEAK for it, not to
   * buy anything. That is a strategy, not a rule of the game — the only rule
   * is `launchBlocker`, which still applies. So "the market is under-visited"
   * has always been a statement about this file, and this flag is what lets
   * the other reading be measured.
   */
  tradesFreely?: boolean;
  /**
   * And whether it will do so before it has stood a winter. Separate from
   * `tradesFreely` on purpose: dropping both gates at once measures "trades
   * more" and "trades earlier" as one number, and they are not the same
   * claim — the first winter is exactly when a steading can least afford to
   * send two of its hands away.
   */
  tradesEarly?: boolean;
  /**
   * A PLACEBO errand: walks to the counter and comes home having dealt
   * nothing. It exists to separate the two ways a trade errand could cost a
   * band — the goods it swaps, or simply the two pairs of hands that are not
   * at home cutting wood while it is away. Those imply different fixes, so
   * measuring them as one number answers neither.
   */
  tradesNothing?: boolean;
  /**
   * Trades, but never gives FIREWOOD away.
   *
   * The last thing that needs separating. The bot sells wood whenever it
   * holds more than twelve nights of it, and twelve nights is a thin hedge
   * against a winter — so "trading hurts" may be "this bot sells the wrong
   * thing" rather than anything about the market. A player who reads the
   * winter mark would not make that trade, and the harness should not be
   * allowed to answer a design question on the strength of a bad habit.
   */
  keepsWood?: boolean;
  /** Whether it falls on neighbours' camps as a matter of course. */
  robsCamps: boolean;
  /** What it raises, in the order it wants it. */
  want: readonly string[];
  /** What everyone does with their days. */
  crew: readonly JobId[];
  /**
   * Whether this band will send the knarr back across the open sea.
   *
   * A policy flag rather than a hard rule so item 27's probe can run the same
   * landings both ways — which is what separates "the voyage pays" from
   * "bands that could afford one were doing well anyway".
   *
   * FALSE on every policy here, and that is a finding rather than an
   * oversight. The bot models an average player, and item 27's probe measured
   * an average player who sails doing WORSE: forced to take every crossing
   * she could, a band went from 5 of 40 standing at day 400 to 3, and lived
   * a fifth fewer days. A bot that sailed would be modelling bad play, and
   * every published figure in this file would inherit it.
   */
  sails: boolean;
  /**
   * Sail in any season, not only spring. Not a strategy anybody should play —
   * it is the FORCED arm of item 27's probe, which measures what a crossing
   * is worth when the gate is not what is deciding.
   */
  sailAnySeason: boolean;
  /**
   * Days of food the steading keeps back before an armed errand goes out.
   *
   * Mine, not the game's — the game charges `provisionsFor(3)`, which is
   * nine. The first cut of the raid errand added ten days of the steading's
   * own eating on top as a safety buffer, and measured across three policies
   * that buffer was met on ZERO target-days out of a thousand: a settled
   * band in this game never has that much spare, so going out under arms
   * could not happen for anybody. A settler keeps a cushion because he has a
   * steading to feed. A raider does not: eating what you take is the whole
   * of the strategy, and testing him with a farmer's caution measures the
   * caution.
   */
  errandBuffer: number;
  /**
   * Whether the band drops its scruples once the game has told it, in so many
   * words, that it cannot reach spring.
   *
   * `readiness()` ends a hopeless forecast with "What is left is taking it
   * from somebody else, or walking out and wintering elsewhere" — and no
   * policy here could do either before the first winter, because the trade
   * gate wanted a winter already stood and the raid gate wanted both a reach
   * and a food surplus a short band cannot have. So "the first winter is
   * decided by the frost" was measured on a bot with no move to make, which
   * is the harness's scruples again rather than the game's rules.
   *
   * When this is set, and only while the winter mark is visible AND
   * `reachable` says no, the gates that are the BOT's caution come off. The
   * gates that are the GAME's — `launchBlocker`, somebody left to keep the
   * fire — stay exactly where they are.
   */
  desperate: boolean;
  /**
   * Whether the band goes onto short commons when the winter mark says it is
   * short of food.
   *
   * A knob, so the lever can be measured against itself on the same seeds
   * rather than argued about. `readiness()`'s two named ways out were
   * measured this way and saved nobody; a lever that cannot beat that is not
   * worth the save version it costs.
   */
  tightensBelt: boolean;
  /**
   * Whether the band ever moves a pair of hands off a job the season has
   * emptied.
   *
   * AUDIT ITEM 7, and it started as an instrument fault rather than a design
   * question. `ASSIGN` is a verb the player holds every day of the saga;
   * until this knob existed the harness issued it ONCE, on settling day, and
   * never again — the `jobsSet` one-shot below. So "is there anything to do
   * in winter" could not be answered from any measurement this repo has
   * ever taken, because the bot doing the measuring never did any.
   *
   * That matters most in the season it was never checked in. Winter forage
   * is 0.15, so `seasonFactor` pays a farmer 0.15 of a day's work and a
   * fisher 0.575 — and the settler crew is two farmers. Twenty-four days of
   * two people standing in a frozen field, with the water right there.
   */
  recrews: boolean;
  /**
   * Whether the band moves hands onto whatever the winter mark says it is
   * short of, day by day.
   *
   * A knob as of audit item 7, and it should have been one years ago. This
   * is the loop the bot has run since the mark existed — everyone onto wood
   * or onto food according to the forecast gap — and because it was
   * unconditional, NOTHING in this file has ever measured what it is worth.
   * It is the most consequential thing the harness does between settling and
   * the frost and it sat below the bars, not on them.
   */
  crewsToNeed: boolean;
  /**
   * Whether the daily crewing picks the food job the GROUND pays best,
   * instead of always reaching for the hunter.
   *
   * OFF, AND IT IS OFF FOR A REASON THAT IS WORTH MORE THAN THE KNOB.
   *
   * 11.S2 measured what the hardcoded `'hunter'` below is worth: asked of
   * `output()` on the states a saga really passes through, the ground pays
   * FISHER best on 51-94% of settled band-days and hunter best on 4-17%, by
   * 32-49%. The bot reaches for the worst of the three food jobs on most days
   * of most sagas, and turning this on is worth saved 11 / killed 1 at first
   * spring. Evan ruled it ON on 2026-09-03.
   *
   * IT WAS TURNED ON, AND TURNED BACK OFF THE SAME DAY, because it does not
   * ship alone. See 11.S2's entry in ROADMAP.md: the flip re-prices the
   * difficulty menu (84/58/30 -> 87/65/38, measured) and then breaks the
   * WINTER VERDICT, which is calibrated to a game where bands feed themselves
   * badly. `reachable` starts condemning bands that go on to live, and
   * `cliff.test`'s eve-of-winter cliff stops being a cliff. Neither is a
   * stale number to restate; both are decisions about the game.
   *
   * So the flip is a two-part change and only the first part is measured. The
   * knob stays for the reason audit item 7 gave — the arm that measures a
   * lever has to be able to switch it off — and it is the one line that
   * re-does the flip when the verdict is ready for it.
   */
  crewsByOutput?: boolean;
  /**
   * Whether the band walks out on a steading the verdict has written off.
   *
   * AUDIT ITEM 6. `readiness()` named this as a way out for a long time while
   * it was not a verb, and when the promise was withdrawn the note said
   * whether it SHOULD be one was a live question nothing had measured. This
   * knob is how it gets measured, against the standard the escape hatch set:
   * saved nobody, killed two.
   */
  retreats: boolean;

  /**
   * Walk out EARLY, the moment it is legal, if the ground scores below this.
   *
   * 9.14. `retreats` above triggers on the VERDICT, which fires around day 40
   * — so every measurement of walking out so far has measured a band leaving
   * in autumn with its summer already spent. That is not the case the verb
   * was shipped for. src/data/retreat.ts says in as many words that it is
   * "a verb for the OTHER case: ground you took too fast and want to be off
   * before the summer is spent", and that "the harness cannot measure that
   * one". This knob is the harness learning how.
   *
   * Undefined means never. A number means: at the first legal day, read the
   * ground the posts went into and leave if it is worse than this.
   */
  retreatsBelow?: number;
}

/**
 * Move every food-hand onto whatever food job this site and this season
 * actually pay for.
 *
 * DELIBERATELY the smallest move a player could make from the panel they
 * already have, rather than an optimiser. It does not rebalance food against
 * firewood, does not touch the builder or the watch, and does not know
 * anything the steading screen does not show — it is one person noticing
 * that the fields are frozen and the fish are not. If a change this small
 * moves survival, the game has a lever nobody is told about; if it moves
 * nothing, winter genuinely has no work in it and item 7 stands.
 */
/**
 * How good a site has to be TODAY.
 *
 * A flat `policy.siteFloor` unless the policy says to start lowering it, in
 * which case it gives up a point a week and never falls below the bottom of
 * "Hard ground" — the verdict the game itself writes as "it could be held, by
 * people with nothing better". Below that the game says "a place to die in,
 * slowly", and a band that would take THAT is not a player, it is a strawman.
 */
/**
 * The two floors are on DIFFERENT SCALES, because the two countries were.
 *
 * `policy.siteFloor` was 9 of 25 and the hard floor 6, both read off the hex
 * map, where a foundable site totalled a mean of 7.6. A foundable stretch of
 * coast totals a mean of 13.4 — not because a coast is better ground but
 * because a coast is all HARBOUR, and only about one foundable hex site in
 * fifty is coastal at all. Carried over unchanged, a floor of 9 is met by
 * every stretch that will take posts and the bot's whole "hold out for good
 * ground" policy stops existing.
 *
 * Set at the same PERCENTILES of foundable ground, which is what the floor
 * actually means — 9 of 25 is about the 70th percentile of hex sites and 6 is
 * about the 20th. On 428 foundable stretches those land at 14 and 12.
 */
export const COAST_FLOOR = { site: 14, hard: 12 };


export function floorOn(day: number): number {
  // A floor of nought is not a scale reading, it is the ABSENCE of a floor —
  // "take the first legal ground" — and it means that on either map. Shifting
  // it up with the rest turned the harness's rash arm into a band holding out
  // for a 5, which is why its two arms measured the same run twice.
  if (policy.siteFloor <= 0) return 0;
  const base = policy.siteFloor + (COAST_FLOOR.site - 9);
  const hard = COAST_FLOOR.hard;
  if (policy.relaxFrom === undefined || day <= policy.relaxFrom) return base;
  const given = Math.floor((day - policy.relaxFrom) / 7);
  return Math.max(hard, base - given);
}

// --- Walking a line, for every bot below ---
//
// The harness's bots were written against `moveOptions` and `distance` and
// there was nothing wrong with that until the coast became the default build
// on 2026-08-28 — at which point every one of them stood still, because
// `MOVE` is the hex map's verb and a line travels by `WALK` to a stop. What
// they measured then was a band that never went anywhere: 14 of this file's
// claims failed, and about half of those failures were the bot rather than
// the game.
//
// Three helpers, so each rule below converts by swapping "nearest hex" for
// "nearest stretch" and keeps its own reasoning intact.

/** The stretch the band is on, or the steading's if they are settled at home. */
export function whereOn(state: GameState): number {
  return standingAt(state);
}

/**
 * One step of the walk toward a stretch, or null if there is nowhere to go.
 *
 * `walkOptions` already knows what a day buys — one stretch on foot, up to
 * `SHIP_REACH` of them at the oars — so picking the option that ends nearest
 * the target IS the line's version of "move toward it".
 */
export function stepToward(state: GameState, target: number): Action | null {
  const opts = walkOptions(state);
  if (opts.length === 0) return null;
  const best = opts.reduce((a, b) =>
    daysBetween(state.seed, b, target) < daysBetween(state.seed, a, target) ? b : a);
  return { type: 'WALK', to: best };
}

/** The nearest stretch the band knows of that answers `want`, within `days`. */
export function nearestStop(
  state: GameState,
  want: (stop: number) => boolean,
  days: number,
  from?: number,
): number | null {
  const here = from ?? whereOn(state);
  let best: number | null = null;
  let far = days;
  for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
    if (stop === here || !knowsStop(state, stop) || !want(stop)) continue;
    const d = daysBetween(state.seed, here, stop);
    if (d < far) { far = d; best = stop; }
  }
  return best;
}

export function recrew(state: GameState): number {
  let moved = 0;
  for (const p of state.party.people) {
    if (!p.alive || !p.job) continue;
    const current = jobById(p.job);
    if (!current || current.produces !== 'food') continue;
    let best = current;
    for (const j of availableJobs(state)) {
      if (j.produces !== 'food') continue;
      if (output(state, p, j) > output(state, p, best)) best = j;
    }
    if (best.id !== p.job && assign(state, p.id, best.id)) moved += 1;
  }
  return moved;
}

/**
 * What the harness has always been, and every figure in ROADMAP.md still
 * describes: settle early, work the jobs, hold the line, trade until
 * somebody on the coast will speak for you.
 *
 * `raidReach: 0` — it does not go out under arms, and that is its IDENTITY
 * rather than a limitation. The raiding work of 2026-08-09 briefly gave it
 * armed sorties, and the long game answered immediately: jarldoms fell from
 * five in forty sagas to none, because a steading-first band that spends its
 * late summers away from the steading is not a steading-first band. Going
 * out under arms belongs to the policy built for it.
 */
export const SETTLER: Policy = {
  id: 'settler',
  siteFloor: 9,
  /**
   * And gives way as winter closes, which is the whole difference between a
   * player and a search. Measured 2026-08-22: a FIXED floor of 9 never
   * settled at all in 45 of 120 seeds and saw spring in 48; giving way from
   * day 14 settles 98 and sees spring in 67, saved 20 against killed 1.
   */
  relaxFrom: 14,
  plunderWindow: 24,
  raidReach: 0,
  raidParty: 0,
  raidAfterWinters: 1,
  raidInSeasonOnly: true,
  trades: true,
  robsCamps: false,
  want: [
    'longhouse', 'farmplots', 'bud', 'smokehouse', 'palisade',
    'storehouse', 'watchtower', 'meadhall', 'greathall', 'earthworks',
    'hof', 'dock',
    // The late work (9.11), last because it is: nothing reaches it in a
    // first winter, and a bot that wanted it early would be measuring a
    // strategy nobody can play.
    'stonedyke', 'greathof', 'shiphowe',
  ],
  crew: CREW,
  sails: true,
  sailAnySeason: false,
  errandBuffer: 6,
  desperate: false,
  // TIGHTENS. The lever measured saved 32 bands and killed 3 over 240 seeds,
  // and it is signposted on the steading panel the moment the mark says the
  // stores are short — so a competent player presses it, and a bot that
  // represents competent play has to press it too or every figure in this
  // file describes a game nobody plays. The cost of the flip is that the
  // difficulty menu's spring odds are now the odds of the game AS PLAYED
  // (Fair 73%, Even 45%) rather than a floor for a band that never reads its
  // own winter mark, and `src/data/hardship.ts` was restated to match.
  tightensBelt: true,
  recrews: false,
  crewsToNeed: true,
  retreats: false,
};

/**
 * Takes what he needs. Holds out for better ground because he is in no
 * hurry, robs everything within reach on the way, and goes out under arms
 * all his life instead of carrying food to anybody.
 */
export const RAIDER: Policy = {
  id: 'raider',
  // Seven, not eleven. The first cut had him holding out for good ground,
  // which is a strawman of his own strategy — a man who means to live off
  // what he takes does not care what the soil is like, and `the first
  // winter` has said since 6.1 that settling late is close to fatal. Testing
  // him with a settler's site standards measured the delay, not the raiding.
  siteFloor: 7,
  plunderWindow: 40,
  raidReach: 10,
  raidParty: 6,
  raidAfterWinters: 1,
  raidInSeasonOnly: true,
  trades: false,
  robsCamps: true,
  want: [
    'longhouse', 'palisade', 'smokehouse', 'storehouse', 'watchtower',
    'farmplots', 'bud', 'earthworks', 'meadhall', 'greathall', 'hof', 'dock',
    // The late work (9.11), last because it is: nothing reaches it in a
    // first winter, and a bot that wanted it early would be measuring a
    // strategy nobody can play.
    'stonedyke', 'greathof', 'shiphowe',
  ],
  // Two warriors, one hunter and a farmer could not feed six people, and it
  // showed: TWENTY-EIGHT of twenty-eight raider deaths were hunger. A man
  // who lives by taking still has to eat between takings, and the first cut
  // of this policy was the site-floor strawman all over again — a strategy
  // measured with a spec that could not carry it.
  crew: ['warrior','hunter','hunter','farmer','woodcutter','builder'],
  sails: true,
  sailAnySeason: false,
  errandBuffer: 2,
  desperate: false,
  tightensBelt: false,
  recrews: false,
  crewsToNeed: true,
  retreats: false,
};

/**
 * Never leaves the palisade. Settles on the first thing that will take the
 * posts, builds walls before comforts, and answers everything with work.
 */
export const TURTLE: Policy = {
  id: 'turtle',
  siteFloor: 7,
  plunderWindow: 0,
  raidReach: 0,
  raidParty: 0,
  raidAfterWinters: 1,
  raidInSeasonOnly: true,
  trades: false,
  robsCamps: false,
  want: [
    'longhouse', 'farmplots', 'palisade', 'smokehouse', 'watchtower',
    'storehouse', 'earthworks', 'bud', 'meadhall', 'greathall', 'hof', 'dock',
    // The late work (9.11), last for the same reason as the others.
    'stonedyke', 'greathof', 'shiphowe',
  ],
  crew: ['farmer','farmer','farmer','woodcutter','builder','warrior'],
  sails: true,
  sailAnySeason: false,
  errandBuffer: 0,
  desperate: false,
  tightensBelt: false,
  recrews: false,
  crewsToNeed: true,
  retreats: false,
};

/**
 * The settler, exactly — until the winter mark tells him he is dead.
 *
 * Every field is SETTLER's but two, so a difference between the two runs is
 * the escape hatch and nothing else. He does not raid on principle, does not
 * hold out for better ground, does not trade earlier; he simply takes the
 * out the game itself names, at the moment the game names it.
 */
export const DESPERATE: Policy = {
  ...SETTLER,
  id: 'desperate',
  // Four, because #34 measured that three is half a shield wall walking into
  // a fight. A last throw that loses the sworn is not a lever.
  raidParty: 4,
  desperate: true,
};

export const POLICIES = [SETTLER, RAIDER, TURTLE];

/**
 * Which one is playing. Module-level for the same reason `settleNotBefore`
 * is — step() is called from a dozen places and only the policy sweep cares
 * — and reset in a finally, because a leaked value would silently rewrite
 * every figure in this file.
 */
export let policy: Policy = SETTLER;
/**
 * How many hands the bot has moved between jobs since a test last zeroed it.
 *
 * The instrument bar for audit item 7: a re-crewing arm that never actually
 * re-crewed is the same run twice, and this file has shipped that mistake
 * before.
 */
export let recrewed = 0;
/** How many steadings the bot has walked out on since a test zeroed it. */
export let walkedOut = 0;
/**
 * The day the bot may settle again after walking out. PER RUN — reset at the
 * top of `run()`, unlike `settleNotBefore`, which a sweep sets deliberately
 * and holds across a whole sample.
 */
export let walkOutHold = 0;
// NOTE: 'farmplots' has no hyphen. The first version of this list wrote
// 'farm-plots', which matches no building, so that entry silently never
// queued and the measured bot had been building three things while this file
// claimed four. A búð is on the list because 6.2 gave the band a way to grow
// and a harness that cannot grow reports growth as worthless — the same
// mistake as the bot that would not fight back.
/**
 * What an average player raises, in the order they want it.
 *
 * `greathall` and `earthworks` were missing until audit item 4, and that is
 * the whole of why sixty sagas never built one: the upgrade tier shipped
 * with `standsFor()` written for it, `replaces` enforced in `buildBlocker`,
 * and a bot that was never told the two buildings existed. The game side was
 * sound throughout — the measurement simply never asked. Same-commit rule,
 * broken quietly, and only visible once something counted what was reached.
 *
 * The upgrades sit after the basics they replace, which is also the order
 * `buildBlocker` enforces: a great hall needs a longhouse standing to
 * replace, and earthworks need a palisade.
 */


/**
 * A competent-but-not-clairvoyant player: walks toward timber when the
 * woodpile is low, settles on the best ground it has actually seen, and
 * otherwise explores outward from the landing.
 */
/**
 * Item 2's instrument: hold the band off settling until this day.
 *
 * Module-level rather than threaded through every call site because step()
 * is called from five places in this file and only one experiment cares.
 * Always reset in a finally — a leaked value would silently change the
 * curve, which is exactly the class of harness bug this file's header is
 * a monument to.
 */
export let settleNotBefore = 0;

/**
 * Item 2's instrument: which of the four verbs the bot is allowed.
 *
 * `dash` is off, and that is a measured decision rather than an oversight —
 * see `test/wall.test.ts`, which prices it at a third of the wins and a
 * third of the survivors. Spending the turn's action to arrive sooner means
 * arriving alone and arriving having already acted. Kept as a toggle so the
 * claim stays executable.
 */
// `shove` and `dash` were toggles here until 9.1b took both verbs. What is
// left is the two the bot chooses between.
export const VERBS = { throw: true, defend: true };


export function step(state: GameState): Action {
  if (state.event) {
    return state.event.outcome ? { type:'DISMISS_EVENT' } : { type:'CHOOSE', index:0 };
  }
  if (state.aftermath) return { type:'DISMISS_AFTERMATH' };

  // KEEP THE HALL. A hall pays its heart while it is kept and fades when it
  // is not (9.12, sim/hall.ts), so a bot that never feasts measures a player
  // who never noticed the rule — the worst case, reported as the ordinary
  // one.
  //
  // UP HERE, and that is the whole of why it works. It was first written
  // down in the long-game block near the bottom of this function, which
  // `step` never reaches: every branch above it returns, so the bot held
  // exactly zero feasts and every band past its third year read a heart of
  // ZERO. It costs one action a season; a player does it the day it falls
  // due and gets on with the year.
  if (
    state.settlement
    && sinceKept(state) > KEPT_FOR
    && canKeepHall(state)
    && state.party.food > feastCost(state) * 2
  ) {
    return { type: 'KEEP_HALL' };
  }
  if (state.battle) {
    if (state.battle.outcome) return { type:'B_LEAVE' };
    if (!isWarbandTurn(state)) return { type:'B_END_TURN' };
    const b = state.battle;
    const me = b.combatants.find(c => c.personId === b.order[b.turnIndex]);
    if (!me) return { type:'B_END_TURN' };
    const foes = b.combatants.filter(c => c.side === 'foe' && !c.down && !c.fled);
    if (foes.length === 0) return { type:'B_END_TURN' };
    // Nearest is no longer a distance. The man you meet first is the one
    // furthest up his own line, which on a line that closes up is rank 1.
    const near = foes.reduce((a, c) => (c.rank < a.rank ? c : a), foes[0]!);
    // The game gained the war-cry, so the bot cries it in the same commit.
    // The average player spends the leader's action on it when the press is
    // real — two or more foes in earshot — and never on a stray skirmisher.
    if (!me.hasActed && !b.warCried && !me.broken
      && me.personId === leaderOf(state.party.people)?.id
      && foes.filter(f => Math.abs(f.rank - me.rank) <= WARCRY_RANGE).length >= 2) {
      return { type:'B_WARCRY' };
    }
    // --- Audit item 2: the four verbs this harness had never issued. ---
    //
    // B_THROW, B_SHOVE, B_DEFEND and B_DASH were in the engine, in the UI
    // and in nobody's measurement: over sixty sagas the bot produced not one
    // of them. Every claim this repo makes about combat balance was a claim
    // about a bot playing two thirds of the game — and by its own oldest
    // rule, a capability the bot cannot use is measured as worthless. Two of
    // the four were measured and then REMOVED (9.1b); the rules for them are
    // gone from below, and the record of what they were worth is in
    // sim/footwork.ts.
    //
    // Each rule below is the narrow case where an average player reaches for
    // the verb, not the case that flatters it.

    // A SHOVE rule stood here, and 9.1b took the verb. It had been corrected
    // once already — the ported hex rule fired on the half of the verb that
    // does nothing on a line — and even corrected it fired 6 times in 30
    // sagas and the arena priced it at 47/60 wins against 47/60 without it.
    // Everything below used to be gated on `distance(near.at, me.at)`, and
    // since 8.1c that number means nothing: `Combatant.at` is frozen at
    // wherever a fighter deployed and never moves again, so the gates were
    // reading a hex that no longer describes where anybody is. The verbs
    // themselves had already been converted, which made this worse rather
    // than better — a rank-aware `reachTargets` behind a gate measuring
    // stale geometry is a harness that measures noise and reports it as
    // balance. So the gates ask the same question the game asks now: what
    // can I actually touch from where I am standing?
    //
    // The priority ORDER is deliberately unchanged, so the numbers this file
    // holds move because the battlefield moved and not because the bot
    // started playing a different game. "At arm's length" was the old gate's
    // real meaning, and its rank spelling is simply `strikeTargets`.
    const inReach = strikeTargets(state);

    // The game gained the second rank, so the bot fights from it in the same
    // commit. Nothing at arm's length and a mate in front of a foe: thrust.
    // A harness that cannot use a formation reports the formation as
    // worthless, which is the oldest lesson in this file.
    if (!me.hasActed && inReach.length === 0) {
      const spear = reachTargets(state);
      if (spear.length > 0) {
        const marked = spear.find(f => f.personId === b.champion) ?? spear[0]!;
        return { type:'B_REACH', targetId: marked.personId };
      }
    }

    // THROW. Out of arm's length with nothing to thrust past, the turn's
    // action is otherwise spent on nothing at all — so a spear that is
    // carried once and thrown once goes now. Strictly free on an approach
    // turn, which is exactly why never issuing it was a measurement bug
    // rather than a strategy.
    if (VERBS.throw && !me.hasActed && inReach.length === 0) {
      const shots = throwTargets(state);
      if (shots.length > 0) {
        const marked = shots.find(f => f.personId === b.champion) ?? shots[0]!;
        return { type:'B_THROW', targetId: marked.personId };
      }
    }
    if (!me.hasActed && inReach.length > 0) {
      // The game gained named leaders, so the bot hunts them in the same
      // commit: dropping the champion shakes his whole band, and now that he
      // SURVIVES a field he did not die on, killing him is the only way he
      // stops coming back. An average player goes for the man with the
      // pennant when he is in reach.
      const marked = inReach.find(f => f.personId === b.champion);
      return { type:'B_STRIKE', targetId: (marked ?? inReach[0] ?? near).personId };
    }

    // A DASH rule stood here, and it changed my mind three times: a trap on
    // hexes (11 bands seeing spring became 8, because spending the action to
    // arrive sooner means arriving ALONE and already spent), not a trap on a
    // line, and then not a verb at all. 9.1b took it, and what it did — a man
    // who can reach nothing with anything shoulders forward — is now the line
    // closing itself at the top of the turn, for both sides, whether or not
    // any bot thinks to ask.
    // The move scorer stood here. It weighed ground — closing at 4 a hex
    // against shoulders at 3 a mate, and never standing on your own
    // palisade — and there is no ground left to weigh: a fighter's only
    // choice about where to be is which rank, and changing it is the dash
    // above. What the scorer was really buying, a band that arrives
    // together rather than one man at a time, the line now gives for free.

    // DEFEND. In position, nothing left to do, and they are coming — which
    // is the whole case for a shield. The bot used to end this turn having
    // done nothing at all, and "nothing" is strictly worse than "set the
    // shield", so this rule cannot cost anything and can only have been
    // missing because nobody looked. On the line "they are coming" is not a
    // distance: it is standing where there is something to set a shield
    // against, which is the front two and nowhere else.
    if (VERBS.defend && !me.hasActed && canActFrom('defend', me.rank)) {
      return { type:'B_DEFEND' };
    }

    return { type:'B_END_TURN' };
  }

  const days = state.party.food / Math.max(1, foodPerDay(state));
  const nights = state.party.firewood / Math.max(1, firewoodPerNight(state));

  // The game gained the ship's way in, so the bot takes it in the same
  // commit. Off the water it is strictly the better approach when you mean
  // to win — fewer of them, shaken, and a bigger hold — so an average
  // player afloat beside a place takes it from the boat.
  if (strandTarget(state) && sworn(state.party.people).length >= 4) {
    return { type:'STRANDHOGG' };
  }

  // A counter under our feet and a hole in the stores: deal rather than
  // draw. The town and the house will trade as often as you like and only
  // once you have not robbed them, so an average player short of one thing
  // and long on the other buys what he needs and leaves them standing.
  const dealHere = placeHere(state);
  if (dealHere && dealHere.sackedOn === undefined) {
    for (const offer of offersAt(state, dealHere.id)) {
      if (tradeBlocker(state, dealHere.id, offer.id) !== null) continue;
      // Standing at a counter with something to spare, an average player
      // deals — the first cut also demanded they be SHORT of what was on
      // offer, which is narrower than anyone actually is, and left the whole
      // market system firing twice in sixty sagas.
      if (policy.keepsWood && offer.give === 'firewood') continue;
      const spare = offer.give === 'food' ? days > 12 : nights > 12;
      if (spare && !policy.tradesNothing) {
        return { type:'TRADE_AT', id: dealHere.id, offer: offer.id };
      }
    }
  }

  // A place worth taking, under our feet, still standing: take it. The rule
  // that put this here is the same one that taught the bot to swing — the
  // game gained raidable places, so the bot raids them in the same commit,
  // or the measurement reports them as worthless. Soft targets always; the
  // garrisoned town only with a full-strength band and food to fight on —
  // item 10's offensive half, because a bot that never fights FOR anything
  // measures the whole plunder game as worthless.
  const mighty = sworn(state.party.people).length >= 5 && days >= 3;
  const here2 = placeHere(state);
  if (here2 && here2.sackedOn === undefined) {
    const def = placeKind(here2.kind);
    if (def.garrison === null || def.garrison <= 1 || mighty) {
      return { type:'SACK_PLACE', id: here2.id };
    }
  }

  // Standing on a camp with something in it, under arms, strong enough to
  // take it: take it. This is what "living by raiding" MEANS, and until now
  // the bot only ever fell on anybody when it was three days from starving
  // — a desperation rule wearing a strategy's name, which is why even the
  // raider policy sacked 0.3 camps a saga.
  const host = neighbourHere(state);
  // WHO IS ACTUALLY THERE, not who is on the roster.
  //
  // `sworn(state.party.people)` counts the whole band, including everyone
  // sitting at home — so a TRADING party of two, walking past a camp on its
  // way to a counter, passed a test about six people and stormed the place
  // with two. This file's own launch rule says what that is worth: 9% won
  // with three, 47% with six, "half a shield wall walking into a fight".
  //
  // It hardly bit on the hex map, where an errand rarely passes a camp at
  // all. A coast puts every camp on the only road there is, so the raider
  // measured 3.1 of ours against 3.3 of theirs and won 30%, against 5.1 and
  // 63% on the map — both sides scaling together, so it was never the odds.
  // It was the wall.
  const outWith = sworn(fieldCrew(state)).length;
  if (host && policy.robsCamps && canFallOn(state, host.id)
      && outWith >= 4
      && campStores(state, host.sackedOn) >= CAMP_WORTH) {
    return { type:'FALL_ON', id: host.id };
  }

  // Starving on a cold doorstep: the average player robs it before they die.
  // Friends stay friends — this only fires on a camp that already dislikes
  // the band, when there are under three days of food left.
  if (host && days < 3 && host.standing < 10 && canFallOn(state, host.id)) {
    return { type:'FALL_ON', id: host.id };
  }

  // --- The long game, which this harness could not previously reach ---
  //
  // Everything below is the endgame the bot had never once played: it never
  // bartered, never called a Thing, never ruled. Item 9 measures the years
  // after the second winter, and a harness that cannot GET there measures
  // nothing — the same lesson as the bot that would not swing.

  // Proclaimed: keep the rule rather than closing the saga. A bot that lays
  // it down is a bot that ends its own run, which is the opposite of what
  // the long game is for.
  if (state.jarl && state.flags['ruleTaken'] === undefined) return { type:'RULE_ON' };

  // The claim, the moment it is takeable. It costs three days and a feast,
  // and the bot walks into whatever odds it has, as an ordinary player does.
  if (canCallThing(state)) return { type:'CALL_THING' };

  if (state.settlement) {
    // Out on an errand. Which errand decides everything below, because the
    // two are opposites: one carries food in to make a friend, the other
    // takes a place off the coast and is remembered for it.
    const out = state.expedition;
    if (out) {
      if (out.purpose === 'explore') {
        // Walking the country to find out what is in it. Aims at the
        // nearest ground nobody has stood on, which is what turns fog into
        // a place worth coming back for.
        if (!out.returning && (raidWorth(state, policy.raidReach)
            || state.day - out.launchedOn >= RAID_DAYS)) {
          return { type:'TURN_HOME' };
        }
        const homeStop = state.settlement.stop ?? 0;
        const stops = walkOptions(state);
        if (stops.length === 0) return { type:'CAMP' };
        const fresh = (stop: number) => (knowsStop(state, stop) ? 0 : 1);
        const pick = out.returning
          ? stops.reduce((a, b) =>
              daysBetween(state.seed, b, homeStop) < daysBetween(state.seed, a, homeStop) ? b : a)
          : stops.reduce((a, b) => {
              const sa = fresh(a) * 6 + daysBetween(state.seed, a, homeStop);
              const sb = fresh(b) * 6 + daysBetween(state.seed, b, homeStop);
              return sb > sa ? b : a;
            });
        return { type: 'WALK', to: pick };
      }

      if (out.purpose === 'fish') {
        // Out to the fishing. Three things, in order: work the ground under
        // us while it is worth working, come home when it is not, and
        // otherwise row for the nearest one we know.
        // A line is never "at sea" — the sea is off every stretch — so
        // what the crew is standing on is a stretch with a ground off it.
        const at = whereOn(state);
        if (!out.returning && groundAtStop(state.seed, at)
          && abundance(state, 'fish') > 0.5 && canFish(state)) {
          return { type: 'FISH' };
        }
        const near = nearestStop(state, (stop) => groundAtStop(state.seed, stop), 40);
        if (!out.returning && (near === null || state.day - out.launchedOn >= FISH_DAYS)) {
          return { type: 'TURN_HOME' };
        }
        const aim = out.returning ? (state.settlement.stop ?? 0) : near!;
        return stepToward(state, aim) ?? { type: 'CAMP' };
      }

      if (out.purpose === 'raid') {
        // Standing on the prize: take it. (Afloat BESIDE it is handled far
        // above, by the strandhögg rule, which fires wherever it is legal.)
        const under = placeHere(state);
        if (under && under.sackedOn === undefined) return { type:'SACK_PLACE', id: under.id };
        // A holed hull rows at half pace and is mended by a night ashore.
        // A bot that will not mend her measures the sea at half speed and
        // reports the sea as slow.
        if (holed(state.ship) && !atSea(state)) return { type:'CAMP' };
        const mark = raidTargetOn(state);
        if (!out.returning && (!mark || state.day - out.launchedOn >= RAID_DAYS)) {
          return { type: 'TURN_HOME' };
        }
        const aim = out.returning ? (state.settlement.stop ?? 0) : mark!.stop;
        return stepToward(state, aim) ?? { type: 'CAMP' };
      }

      const host = neighbourHere(state);
      if (host && bargainBlocker(state, host.id) === null) return { type:'BARTER', id: host.id };
      // Standing at a counter: deal. This is the other half of the errand
      // and it did not exist — the bot could reach a market only by walking
      // over one on its way to a camp, and would then walk past it.
      const counter = placeHere(state);
      if (counter) {
        for (const offer of offersAt(state, counter.id)) {
          if (tradeBlocker(state, counter.id, offer.id) === null) {
            if (policy.keepsWood && offer.give === 'firewood') continue;
            if (!policy.tradesNothing) {
              return { type:'TRADE_AT', id: counter.id, offer: offer.id };
            }
          }
        }
      }
      if (!out.returning && state.day - out.launchedOn >= 20) return { type:'TURN_HOME' };
      const homeStop = state.settlement.stop ?? 0;
      const aimStop = out.returning ? homeStop : (counterStopOn(state) ?? homeStop);
      return stepToward(state, aimStop) ?? { type: 'CAMP' };
    }

    // A jarldom needs somebody on this coast who will speak for us, and
    // nobody makes a friend from indoors. Sends two out with food to spare,
    // and only when there is genuinely a surplus to carry. First, because
    // the Thing is what a run is FOR and raiding is what costs you it.
    // Cornered: the mark is on screen and `reachable` has said no. Only the
    // bot's own caution comes off here — `launchBlocker` still rules.
    const cornered = policy.desperate
      && !!state.settlement
      && markVisible(state)
      && !reachable(state);

    // A band that trades freely wants the counter itself, so neither the
    // speakers it already has nor the winter it has not yet stood stops it.
    const stoodOne = wintersStood(state.day) >= 1 || cornered;
    const wantsMarket = policy.tradesFreely
      ? (policy.tradesEarly || stoodOne)
      : (!hasSpeakers(state) && stoodOne);
    if (policy.trades && wantsMarket && counterStopOn(state) !== null) {
      const crew = sworn(state.party.people).slice(0, 2).map(p => p.id);
      // A band that has been told it will not see spring does not keep a
      // fortnight's eating back before going to buy food with it.
      const spare = cornered ? provisionsFor(2) : provisionsFor(2) + BARTER_FOOD * 3 + foodPerDay(state) * 7;
      if (crew.length === 2
        && state.party.food > spare
        && launchBlocker(state, crew) === null) {
        return { type:'LAUNCH', members: crew, purpose: 'trade' };
      }
    }

    // Going out under arms — the errand this harness had NEVER once run.
    //
    // The audit's first finding: `moveOptions` returns nothing for a settled
    // band, so an expedition is the only door back onto the map, and behind
    // it lay three sea days, one sea fight and zero strandhöggs in sixty
    // sagas. Hull damage, cargo over the side, the authored sea decks and
    // the strandhögg itself were all shipped unmeasured — the same-commit
    // rule broken by the very feature that named it.
    //
    // An average player with a full band, a full store and a fat monastery
    // still standing down the coast goes and takes it. Gated behind the
    // trade errand above, because a friend is what the Thing needs and
    // steel is what costs you one.
    //
    // Two constraints that are right whatever they do to the numbers, and
    // the first cut of this had neither. It sent three of six away for up
    // to twenty-four days whenever a target was known — including through
    // autumn, with the winter mark unmet — and the curve fell 67/30/8 to
    // 60/27/7 while the fair country's long game went 161 days to 115. That
    // is not the sea being a bad bargain; that is a bot doing something no
    // average player does. The expedition harness has said since 4.2 that
    // emptying the steading kills.
    //
    // So: only in the growing half of the year, when there is time to be
    // back before the mark matters, and only for something close enough to
    // be a raid rather than a voyage.
    const season = seasonOf(state.day);

    // THE VOYAGE HOME, which no bot has ever taken.
    //
    // `sailForHome` has existed since the ship became a place and the harness
    // has never once issued it, so everything behind it — the crossing, what
    // she brings back, the season without those hands — is unmeasured. The
    // door is not shut, unlike the sea before the fishing errand: 'home'
    // rides the same picker as trade and raid. The bot simply never reached
    // for it.
    //
    // An average player sends her when the hall is established and there is
    // food enough to feed it through a season two hands short. In SPRING, so
    // she is back before the year turns — CROSSING is 78 days, and a keel
    // that leaves in autumn is a keel that is somewhere else when the mark
    // matters.
    // AUTUMN, not spring, and the season is the bot's tactic rather than the
    // game's rule. Two measurements decided it. The store is at its thinnest
    // in spring — a median of 13 food on a day she could otherwise have gone
    // — and at its fullest after the harvest. And a crew at sea is off the
    // ration, so sending two away over winter sheds two mouths through the
    // season that kills, and gets them back in summer with the growing still
    // to come. Spring departure does the opposite of both.
    if (policy.sails
        && (season === 'autumn' || policy.sailAnySeason)
        && wintersStood(state.day) >= 1) {
      const crew = sworn(state.party.people).slice(0, 2).map(p => p.id);
      if (crew.length >= 2 && sailBlocker(state, crew) === null) {
        return { type:'LAUNCH', members: crew, purpose: 'home' };
      }
    }

    // THE FISHING ERRAND, and it is asked before every other errand because
    // it answers the thing that actually kills bands.
    //
    // The diagnostic that produced it: on 4492 days a settled band had a
    // known fishing ground within two hexes, and worked one on almost none
    // of them — 2747 of those days it was well fed, and on 1617 it was
    // SETTLED AND COULD NOT MOVE. `moveOptions` returns nothing once the
    // posts are in, so the sea is not declined by a settled band, it is
    // unreachable to one. Starvation is the cause of eleven endings in
    // twenty. The larder was out there and the door was shut.
    //
    // Small crew, and only while genuinely short. The lesson written above
    // holds and is not weakened here: emptying the steading kills, and a
    // fishing trip that costs the hall its hands through harvest would be a
    // worse bargain than the hunger it answers.
    //
    // The two constraints written above for the raid errand apply here and
    // the first cut of this had NEITHER — it launched whenever the store fell
    // under eight days, in any season, for a ground up to seven hexes out.
    // Measured, that cost As It Lies thirteen points of its spring odds
    // (63% to 50%), which is the same failure the raid errand had and the
    // same one the expedition harness has been saying since 4.2: emptying
    // the steading kills. A larder on the water does not repeal it.
    //
    // So: genuinely short rather than merely not full, close enough to be a
    // day's row rather than a voyage, and not in the half of the year when
    // the hands are what stands between the hall and the mark.
    const fedDays = state.party.food / Math.max(1, foodPerDay(state));
    const growing = season === 'spring' || season === 'summer';
    if (fedDays < 5 && growing) {
      const ground = nearestStop(
        state,
        (s) => groundAtStop(state.seed, s),
        5,
        state.settlement!.stop ?? 0,
      );
      const boat = sworn(state.party.people).slice(0, 2).map(p => p.id);
      if (ground !== null && boat.length >= 2 && launchBlocker(state, boat) === null) {
        return { type:'LAUNCH', members: boat, purpose: 'fish' };
      }
    }

    const inSeason = growing;
    // Nothing known worth taking, and a band that lives by taking. The
    // knowledge economy from item 1 hands the country out over a TRADING
    // counter, so a policy that will not trade is blind — measured, the
    // raider knew 0.11 of four places against the settler's 0.47 and could
    // not launch a single armed errand in a thousand target-days. The game
    // has had an `explore` purpose since 4.2 and no bot ever used it.
    const oldEnough = wintersStood(state.day) >= policy.raidAfterWinters || cornered;
    const seasonOk = inSeason || !policy.raidInSeasonOnly || cornered;
    // A settler's reach is zero because he does not go out under arms. A
    // settler who has been told he is dead by spring has a reach.
    const reach = cornered ? Math.max(policy.raidReach, 8) : policy.raidReach;
    const buffer = cornered ? 0 : policy.errandBuffer;
    if (reach > 0 && oldEnough && seasonOk
        && !raidWorth(state, reach)) {
      const scouts = sworn(state.party.people).slice(0, 2).map(p => p.id);
      if (scouts.length === 2
        && state.party.food > provisionsFor(2) + foodPerDay(state) * buffer
        && launchBlocker(state, scouts) === null) {
        return { type:'LAUNCH', members: scouts, purpose: 'explore' };
      }
    }

    if (reach > 0 && oldEnough && seasonOk
        && raidWorth(state, reach)) {
      // The band takes its WALL now, not a detachment of it. Hands hold the
      // yard (see `standAtHome`), so the sworn are free to go — and #34 says
      // the width of the line is the whole of whether the errand is worth
      // flying: 9% won with three, 47% with six. Three was never a raiding
      // party, it was half a shield wall walking into a fight.
      const want = policy.raidParty;
      const crew = sworn(state.party.people).slice(0, want).map(p => p.id);
      // The surplus that funds the errand, counted in DAYS the steading can
      // feed itself rather than in sacks. A flat "+55" was calibrated for a
      // band of exactly six, and item 3's growth broke it silently: more
      // mouths meant the threshold was never met, the errand stopped
      // launching, and the sea went back to nought — the exact content item
      // 1 had just made reachable, undone by a constant in the bot.
      // Take as many as will go rather than an exact count: `launchBlocker`
      // owns the "somebody has to keep the fire" rule, and a band down to
      // four sworn should still be able to raid with four.
      if (crew.length >= Math.min(3, want)
        && state.party.food > provisionsFor(crew.length) + foodPerDay(state) * buffer
        && launchBlocker(state, crew) === null) {
        return { type:'LAUNCH', members: crew, purpose: 'raid' };
      }
    }
    return { type:'CAMP' };
  }

  // Settle on anything workable rather than holding out for perfection.
  if (canFound(state) && state.day >= settleNotBefore
    && state.day >= walkOutHold) {
    // READ THE GROUND THE SIM IS STANDING ON. This asked `siteReport` of
    // `party.at` until the coast arrived, and on a line that was the frozen
    // landing hex — so the bot's whole settling floor was being applied to a
    // stretch it was nowhere near.
    const r = stopReport(state.seed, whereOn(state));
    if (r.total >= floorOn(state.day)) return { type:'FOUND' };
  }

  const at = whereOn(state);
  const country = stopAt(state.seed, at).country;
  if (nights < 6 && (country === 'forest' || country === 'hills' || country === 'valley')) {
    return { type:'CAMP' };
  }

  // THE FISHING GROUND, asked before the land verbs for the reason the hex
  // arm gives below: the order was the constraint, not the reach. On a line
  // there is no "at sea" to be in — the sea is off every stretch — so what
  // is worth walking to is a stretch with a GROUND off it.
  const shortOfFood = days < 6;
  if (shortOfFood && groundAtStop(state.seed, at) && canFish(state)) return { type:'FISH' };
  if (shortOfFood) {
    const ground = nearestStop(state, (s) => groundAtStop(state.seed, s), 8);
    if (ground !== null) {
      const go = stepToward(state, ground);
      if (go) return go;
    }
  }
  if (days < 4 && canGather(state)) return { type:'FORAGE' };
  if (days < 4 && canFish(state)) return { type:'FISH' };

  if (walkOptions(state).length === 0) return { type:'CAMP' };

  // Short on food with a soft larder in sight: the average player robs it.
  if (days < 5) {
    const larder = nearestStop(state, (s) => state.world.places.some((p) => {
      if ((p.stop ?? 0) !== s || p.sackedOn !== undefined) return false;
      const def = placeKind(p.kind);
      return !(def.garrison !== null && def.garrison > 1) && def.loot.food > 0;
    }), 14);
    if (larder !== null) {
      const go = stepToward(state, larder);
      if (go) return go;
    }
  }

  // Wealth in sight and the strength to take it, on the same clock as the
  // hex arm: an average player plunders ON THE WAY to a steading.
  if (!state.settlement && mighty && state.day < policy.plunderWindow) {
    const mark = nearestStop(state, (s) => state.world.places.some(
      (p) => (p.stop ?? 0) === s && p.sackedOn === undefined,
    ), 12);
    if (mark !== null) {
      const go = stepToward(state, mark);
      if (go) return go;
    }
  }

  // Actually go and look for somewhere to live: among coast we have SEEN,
  // the nearest stretch that would take the posts and reads above the hard
  // floor.
  const site = nearestStop(state, (s) => {
    const probe = { ...state, party: { ...state.party, stop: s } } as GameState;
    return canFound(probe)
      && stopReport(state.seed, s).total >= COAST_FLOOR.hard;
  }, 40);
  if (site !== null) {
    const go = stepToward(state, site);
    if (go) return go;
  }

  // Nothing worth stopping for yet: push ON UP THE COAST, which is the
  // line's version of pushing into the dark, favouring wood when short.
  // Outward rather than either way, because a stretch already walked has
  // been read and going back over it learns nothing.
  const opts = walkOptions(state);
  const score = (stop: number) =>
    (nights < 8 ? terrainDef(stopAt(state.seed, stop).country).wood * 6 : 0)
    + stop
    + (hasTrod(state, stop) ? -4 : 0);
  return { type: 'WALK', to: opts.reduce((a, b) => (score(b) > score(a) ? b : a)) };
}

/**
 * How full a camp's stores must be before it is worth the walk and the
 * reprisal. Below this they were robbed too recently to have put anything
 * back — see CAMP_REGROW.
 */
export const CAMP_WORTH = 0.6;


/**
 * And how long they give the errand before turning for home regardless.
 *
 * Ten, not twenty. At twenty a sortie ran TWENTY-FOUR days door to door with
 * half the band away — a season, not a raid — and the expedition harness has
 * said since 4.2 that emptying the steading kills. Shortening it took trips
 * from 23.9 days to 15.7 and doubled how many a band manages.
 *
 * Worth recording that it did NOT fix raiding: sackings stayed at 1.9 a
 * saga either way, because most sorties come home empty. Trip length was
 * not the binding constraint, and the thing that is has not been found yet.
 */
export const RAID_DAYS = 10;
/** A fishing trip is an errand of days, not a fortnight. See the fish case. */
export const FISH_DAYS = 6;

/**
 * WHERE TO GO, ADDRESSED BY STRETCH.
 *
 * Three finders stood here — `raidTarget`, `nearestFriendable` and
 * `nearestMarket` — all ranking by `distance(x.at, ...)` and gating on
 * `world.seen[key(x.at)]`. On a line every one of those `at`s was the
 * placeholder hex, so every distance was zero, every `seen` lookup was
 * undefined, and all three returned null. That is why the raider never went
 * out under arms and the trader struck no deals at all: not a game with
 * nothing in it, a bot asking for a coordinate the game had stopped using.
 * The hex three went with the hexes in 8.5.
 *
 * `within` carried over unchanged, and it is the same number in the same
 * unit: a hex WAS a day's walk, and `daysBetween` is days.
 */
export function raidTargetOn(
  state: GameState,
  within = policy.raidReach + 4,
): { id: string; stop: number } | null {
  const home = state.settlement;
  if (!home) return null;
  const from = home.stop ?? 0;
  const strong = sworn(state.party.people).length >= 5;
  let best: { id: string; stop: number } | null = null;
  let bestScore = within;
  if (strong) {
    for (const n of state.neighbours) {
      if (!n.found || n.stop === undefined) continue;
      if (campStores(state, n.sackedOn) < CAMP_WORTH) continue;
      const d = daysBetween(state.seed, n.stop, from);
      if (d < bestScore) { bestScore = d; best = { id: n.id, stop: n.stop }; }
    }
  }
  for (const p of state.world.places) {
    if (p.sackedOn !== undefined) continue;
    const stop = p.stop ?? 0;
    if (!knowsStop(state, stop)) continue;
    const def = placeKind(p.kind);
    if (def.loot.food <= 0 && def.loot.firewood <= 0) continue;
    if (def.garrison !== null && def.garrison > 1 && !strong) continue;
    const d = daysBetween(state.seed, stop, from);
    if (d >= within) continue;
    // No `seaApproach` bonus: on a line there is no water to come out of.
    // Rowing is a STEP, not a state, so every prize on this coast is already
    // reachable by ship if the hull is sound — `walkOptions` says so.
    if (d < bestScore) { bestScore = d; best = { id: p.id, stop }; }
  }
  return best;
}

/**
 * Is there a prize worth going out for? Asked of whichever country this is.
 *
 * The three gates that gate LAUNCHING a raid all called `raidTarget`, which
 * returns null on a line for the reason above — so the harness reported "the
 * raider never went out under arms at all" and read a whole way of playing as
 * unreachable.
 */
export function raidWorth(state: GameState, within?: number): boolean {
  return raidTargetOn(state, within) !== null;
}

/** Where a trade errand should go, as a stretch. */
export function counterStopOn(state: GameState): number | null {
  const here = whereOn(state);
  let best: number | null = null;
  let bestD = 99;
  const weigh = (stop: number) => {
    const d = daysBetween(state.seed, stop, here);
    if (d < bestD) { bestD = d; best = stop; }
  };
  for (const n of state.neighbours) {
    if (n.standing >= 25 || !n.found || n.stop === undefined) continue;
    weigh(n.stop);
  }
  for (const p of state.world.places) {
    if (p.sackedOn !== undefined) continue;
    const stop = p.stop ?? 0;
    if (!knowsStop(state, stop)) continue;
    if ((placeKind(p.kind).market ?? []).length === 0) continue;
    weigh(stop);
  }
  return best;
}

/**
 * Plays one seed until it dies or reaches `maxDay`, and hands back the state.
 *
 * Deliberately a fresh run per milestone rather than one pass with snapshots.
 * The snapshot version was written first and disagreed with this one by forty
 * points, which is a good reminder that a harness is code and can be wrong in
 * exactly the direction that flatters whatever it is measuring.
 */
export function run(
  seed: string,
  maxDay: number,
  /** Called with every state transition, for measurements the tally misses. */
  watch?: (before: GameState, after: GameState) => void,
  hardship: HardshipId = 'even',
  /**
   * Run once on the fresh world, before the first turn. For planting the
   * things a challenge code carries — a ghost's ruin — which `newGame` cannot
   * know about because they come from somebody else's saga.
   */
  prepare?: (state: GameState) => void,
): GameState {
  let state = structuredClone(newGame(seed, hardship));
  if (prepare) prepare(state);
  let jobsSet = false;
  walkOutHold = 0;
  /** Which season the current crew was picked for. */
  let crewedFor = '';

  for (let i = 0; i < 6000 && !state.end && state.day <= maxDay; i += 1) {
    // WALKING OUT, and it is taken before anything else the day would do:
    // there is no sense crewing or queueing a steading the band is leaving.
    // WALKING OUT EARLY (9.14), on the ground rather than on the verdict.
    // Taken before the verdict branch below so a policy carrying both leaves
    // on the reading it can act on soonest.
    if (policy.retreatsBelow !== undefined && state.settlement && canAbandon(state)
      && stopReport(state.seed, state.settlement.stop ?? 0).total < policy.retreatsBelow) {
      abandonSteading(state);
      walkedOut += 1;
      walkOutHold = state.day + 6;
    }

    if (policy.retreats && state.settlement && markVisible(state)
      && !reachable(state) && canAbandon(state)) {
      abandonSteading(state);
      walkedOut += 1;
      // And it walks. Without this the bot re-founds on the hex it just
      // abandoned the following morning — `foundBlocker` does not care that
      // there is a ruin on it — which is not "wintering elsewhere", it is a
      // loop that pays the cost and moves nowhere. Six days is roughly the
      // week of walking the sentence implies, and it is the BOT's strategy
      // rather than a rule of the game.
      //
      // ITS OWN VARIABLE, NOT `settleNotBefore`, and the first cut used that
      // one. `settleNotBefore` is module-level and shared by every seed in a
      // sample, so one band walking out on day 54 barred all 119 landings
      // after it from ever settling: the arm read 2/120 against 48/120 and
      // "killed 46" off THREE retreats, which is arithmetic that cannot
      // happen and was the tell. Reset per run, below.
      walkOutHold = state.day + 6;
    }

    if (state.settlement && !jobsSet) {
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => assign(state, p.id, policy.crew[ix % policy.crew.length]!));
      jobsSet = true;
      crewedFor = seasonOf(state.day);
    }
    // And the season is allowed to change that opinion, which until audit
    // item 7 it never was. Once per turn of the year, not per day: this is a
    // player looking up when the weather changes, not an optimiser running
    // every morning.
    if (policy.recrews && state.settlement && jobsSet && seasonOf(state.day) !== crewedFor) {
      crewedFor = seasonOf(state.day);
      recrewed += recrew(state);
    }
    // Keep the queue fed. The old one-shot queued the whole list on settle
    // day and never came back — anything unaffordable that day was silently
    // never built. Now: whenever the queue is empty, take the first thing on
    // the list that will queue, and once nothing on it will, keep raising
    // búðs while the steading is over-full. The first roof goes up whatever
    // the woodpile says; after that a winter's burn stays in hand first —
    // firewood spent on posts is firewood not spent on nights.
    if (state.settlement && state.settlement.queue.length === 0) {
      const buffer = state.settlement.built.length === 0 ? 0 : 16;
      if (state.party.firewood >= buffer) {
        // The game puts a checklist on the steading wall after the first
        // thaw naming exactly what a jarl still lacks, so an average player
        // who wants one builds THAT next. Without this the bot worked the
        // list in order and never reached the mead hall at all: fourteen
        // long sagas, four of them past the second winter, and not one hall
        // — which is why nobody ever called a Thing.
        const want = wintersStood(state.day) >= 1
          ? ['meadhall', ...policy.want.filter(b => b !== 'meadhall')]
          : policy.want;
        for (const b of want) {
          // One of each off the list — the repeatable búð would otherwise
          // win this loop forever and the late tier would never be reached.
          if (state.settlement.built.includes(b as never)) continue;
          if (queueBuild(state, b as never)) break;
        }
        if (state.settlement.queue.length === 0 && crowding(state) > 0) {
          queueBuild(state, 'bud');
        }
      }
    }
    // Heed the mark: the game states what the stores must reach, so a
    // competent player moves people onto whatever is short.
    //
    // But it KEEPS A BUILDER while anything is on the stocks, and that line
    // is not a nicety — without it this block reassigned every last person
    // every day the mark was visible, which is most of the year, so the
    // builder was wiped before ever finishing anything. The long-game run
    // found it: sagas reaching day 259 with a hundred and sixty firewood in
    // the pile and NOTHING built, and therefore no mead hall, and therefore
    // no Thing, and therefore an endgame no measurement had ever reached.
    // A real player with wood to spare does not put the whole hall on the
    // woodpile.
    // The winter lever, worked the way a player would: short commons while
    // the mark says the food will not last, full shares the moment it will.
    // Heeded BEFORE the jobs below, because what the band eats changes the
    // number those jobs are being set against.
    if (policy.tightensBelt && state.settlement && markVisible(state)) {
      const short = forecast(state).foodGap < 0;
      const want = short ? 'half' : 'full';
      if ((state.party.rations ?? 'full') !== want) state.party.rations = want;
    }

    if (policy.crewsToNeed && state.settlement && markVisible(state)) {
      const need = forecast(state);
      const shortWood = state.party.firewood < need.firewood;
      const shortFood = state.party.food < need.food;
      const keepBuilder = state.settlement.queue.length > 0;
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => {
          if (keepBuilder && ix === 0) {
            assign(state, p.id, 'builder');
            return;
          }
          // WHICH food job. 'hunter' was hardcoded in all three branches
          // below; `crewsByOutput` asks the game instead — see the flag.
          const eats: JobId = policy.crewsByOutput
            ? (['farmer', 'hunter', 'fisher'] as JobId[])
              .filter((id) => availableJobs(state).some((j) => j.id === id))
              .reduce((best, id) => (output(state, p, jobById(id)!) > output(state, p, jobById(best)!)
                ? id : best), 'hunter' as JobId)
            : 'hunter';
          if (shortWood && shortFood) assign(state, p.id, ix % 2 ? 'woodcutter' : eats);
          else if (shortWood) assign(state, p.id, ix < 4 ? 'woodcutter' : eats);
          else if (shortFood) assign(state, p.id, ix < 4 ? eats : 'woodcutter');
        });
    }

    let next = apply(state, step(state));
    if (next === state && state.battle) {
      // A refused battle action must never end the saga — a player whose tap
      // is refused is still in the fight, and the turn can always be ended.
      // The old break here ate half of every sample: see the header.
      next = apply(state, { type: 'B_END_TURN' });
    }
    if (next === state) break;
    if (watch) watch(state, next);
    state = next;
  }
  return state;
}


/**
 * The seed for arm `arm` of a sweep that plays every seed under two terms.
 *
 * `state.seed` carries no hardship, and neither does any RNG label, so
 * `curve-7` on 'even' and `curve-7` on 'fair' are the same country, the same
 * landing hex, and the same card drawn on the same day. Running both arms
 * over one seed list is thirty landings played twice, reported as sixty —
 * every count doubled and every deviation with it.
 *
 * Found by the content-reach probe, where it mattered most: coverage of a
 * hundred-card deck was being measured against half the sample it claimed.
 */
export function armSeed(arm: number, s: number, seeds: number): string {
  return `curve-${s + arm * seeds}`;
}

/**
 * Founds at the landing if the landing will take posts, else wherever the
 * world will. The wider sea margin (52x36 worldgen) made foundable LANDINGS
 * rare, and a fixture that only ever tried the landing started failing on
 * ground that exists eight hexes away.
 */
export function foundAnywhere(state: GameState): boolean {
  if (foundSettlement(state)) return true;
  // Walked, not scanned. `foundBlocker` reads the stretch underfoot and
  // ignores the hex it is handed, so assigning `party.at` asked the landing
  // twenty-six hundred times over — and since fresh water became the
  // settling gate the landing usually says no. Two of this file's fixtures
  // failed with "nothing foundable" on a coast that has a dozen sites on it.
  for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
    learnStop(state, stop);
    state.party.stop = stop;
    if (canFound(state) && foundSettlement(state)) return true;
  }
  return false;
}

// --- The bars ---

/**
 * Sixty, not thirty.
 *
 * Thirty was enough to be a tripwire and not enough to tune on, and an audit
 * proved it: sweeping the base event chance through 0.28, 0.34 and 0.40 gave
 * 53%, 30% and 43% at the two-winter mark — a fourteen-point swing that went
 * the WRONG WAY in the middle. That is not a response curve, it is noise
 * being read as signal. At a fixed setting the same measurement moved five
 * points between thirty seeds and sixty, so anything smaller than about ten
 * points is below what this harness can see.
 *
 * The bars below are deliberately wide for the same reason. They exist to
 * catch "unwinnable" and "walkover", not to pin a number.
 *
 * `LANDNAM_SEEDS=300 npx vitest run test/balance.test.ts -t 'each setting'`
 * widens the sample when a reading needs to be trusted rather than watched.
 * Sixty is the working default because the whole file runs on it; it is NOT
 * enough to resolve a difference of under about ten points, and item 26 was
 * a whole afternoon spent on a nine-point one.
 */
export const SEEDS = Number(
  (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process?.env?.['LANDNAM_SEEDS'] ?? 60,
);

export interface Curve {
  reachedWinter: number;
  sawSpring: number;
  twoWinters: number;
  settledByWinter: number;
  /**
   * Item 4 of the audit: WHAT kills bands in the wall window (day 40-73,
   * where the curve falls from ~78% to ~25%). Keyed by the person's own
   * fate string, raw and uninterpreted — the instrument counts, it does
   * not editorialise. Run-endings over the same window count beside it.
   */
  deaths: Record<string, number>;
  ends: Record<string, number>;
}

export let cached: Curve | null = null;

/**
 * Measured once, read by every bar below.
 *
 * Async for one reason: the loop is minutes of solid computation, and a
 * worker whose event loop never yields cannot answer the test runner's RPC
 * heartbeat — CI then fails the run with "[vitest-worker]: Timeout calling
 * onTaskUpdate" under 560 green tests. One yielded macrotask per seed keeps the
 * loop breathing and costs nothing anyone can measure.
 */
export async function measured(): Promise<Curve> {
  if (cached) return cached;
  const total: Curve = {
    reachedWinter: 0, sawSpring: 0, twoWinters: 0, settledByWinter: 0,
    deaths: {}, ends: {},
  };
  for (let s = 0; s < SEEDS; s += 1) {
    const atWinter = run(`curve-${s}`, 49);
    if (!atWinter.end) {
      total.reachedWinter += 1;
      if (atWinter.settlement) total.settledByWinter += 1;
    }
    const atSpring = run(`curve-${s}`, 73);
    if (!atSpring.end) total.sawSpring += 1;
    // The wall window: who died between the first frost and the thaw, and of
    // what. `left` is excluded — walking out is not a death, per item 2 of
    // the LAST audit, and this table must not repeat that lie.
    for (const p of atSpring.party.people) {
      if (p.alive || p.left) continue;
      if ((p.diedOn ?? 0) < 40 || (p.diedOn ?? 0) > 73) continue;
      const fate = p.fate ?? 'unrecorded';
      total.deaths[fate] = (total.deaths[fate] ?? 0) + 1;
    }
    if (atSpring.end) total.ends[atSpring.end.cause] = (total.ends[atSpring.end.cause] ?? 0) + 1;
    if (!run(`curve-${s}`, 169).end) total.twoWinters += 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  cached = total;
  return total;
}

// Playing thirty seeds three times over is not a five-second job, and the
// default timeout is the only thing here that has any opinion about that.
/**
 * Two minutes was enough while this file held one sixty-seed sweep. It now
 * holds several, and they share a worker pool with everything else in the
 * run — so tests that pass comfortably on their own timed out in the full
 * suite, which is a scheduling fact rather than a slow test. Generous, and
 * a real hang still ends the run.
 */
export const CURVE_TIMEOUT = 600_000;


/**
 * THE KNOBS, and the one thing the extraction changed about them.
 *
 * Four of this file's bindings were module-level `let`s that the tests
 * assigned to directly — the strategy being measured, and three counters the
 * bot writes and a test reads back. Reads of an imported binding are LIVE and
 * still work untouched, so every READ in the test files is the line it always
 * was; assignment to one is not a thing ES modules can do, so the fifty-one
 * places that set a knob call one of these instead. Nothing else moved, and
 * nothing about WHEN a knob changes did.
 */
export function setPolicy(next: Policy): void {
  policy = next;
}

export function setWalkedOut(next: number): void {
  walkedOut = next;
}

export function setRecrewed(next: number): void {
  recrewed = next;
}

export function setSettleNotBefore(next: number): void {
  settleNotBefore = next;
}
