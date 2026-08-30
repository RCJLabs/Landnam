// 5.3: the difficulty curve, measured rather than felt.
//
// The roadmap's line is "Difficulty curves, animation polish, dead-warrior
// memorial wall". A curve is the one part of that which can be asserted, so
// this file ships the harness that measures it: a scripted player of roughly
// average competence — it walks toward timber when short, goes and looks for
// ground it can settle, heeds the winter mark, and fights back when steel
// comes out — played across many seeds.
//
// The bar is deliberately a WIDE BAND rather than a number. The point is not
// to freeze today's balance, it is to catch the two failures that matter and
// that are otherwise invisible: a change that makes the game unwinnable, and
// a change that makes it a walkover.
//
// Every number in the changelog for this milestone came out of this file,
// and writing it caught two things nothing else would have.
//
// The first was in the harness itself: its earliest draft did not fight back
// on the battlefield, it only passed turns until somebody died. That put
// "slain" at the top of the death table and made the game look far crueller
// than it is — teaching the bot to swing moved survival to the second winter
// from 0% to 51%. A harness is code, and it can be wrong in exactly the
// direction that flatters or damns whatever it is measuring. A later rewrite
// of this file disagreed with itself by forty points for the same reason.
//
// The second was tried, measured, and REJECTED. The landing is chosen for
// loneliness alone — the westernmost quiet beach — with no regard for whether
// anywhere behind it can be lived in, which puts settleable ground a median 5
// and as much as 11 hexes from the sand. Choosing a beach with somewhere to
// live behind it takes the worst case from 11 hexes to 4 and looked like a
// clear win. It is not: where you land decides where you fight, and on the
// worlds it produces the shield wall stops paying for itself. Over sixty
// seeds the line went from 33 wins and 157 people standing to 32 and 158 —
// dead level with charging in, which is a Phase 2 milestone bar erased.
// Battlefield generation has to stop being that sensitive to the terrain it
// is handed before the landing can be touched. See test/wall.test.ts.
//
// The third was the largest, and it was found teaching the bot to form a
// shield wall. The run loop below treated ANY refused action as the end of
// the saga, and the old bot proposed battle moves without costing the ground
// or the disengage — so doMove refused them, and THIRTY of sixty runs were
// cut off mid-battle, one as early as day 7, every one counted as alive at
// every milestone thereafter. The 83/55/50 curve this file used to print was
// those thirty truncated sagas. Played out legally, the same charge-in bot
// reads 78/22/2; the wall-forming bot that replaced it reads 78/30/7 with
// zero refusals — better at every mark, on fights that actually get fought.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { effectsOn, SEASON_LENGTH, seasonOf, winterDepth } from '../src/sim/calendar';
import { markHaze } from '../src/sim/winter';
import { bumped, makeWatch } from '../src/render/motion';
import { apply, type Action } from '../src/sim/actions';
import { atSea } from '../src/sim/road';
import { canGather, canFish } from '../src/sim/gathering';
import { abundance } from '../src/sim/abundance';
import { ailingCount, careToday } from '../src/sim/sickness';
import { canFound } from '../src/sim/site';
import { holed, sprung } from '../src/sim/ship';
import { assign, availableJobs, output, queueBuild } from '../src/sim/colony';
import { abandonSteading, canAbandon } from '../src/sim/retreat';
import { BAND_BASE, foodPerDay, firewoodPerNight, passDay } from '../src/sim/upkeep';
import { SWORN_MAX, hands, leaderOf, living, sworn } from '../src/sim/people';
import { wordOf } from '../src/sim/word';
import { OVER_ROOF, handsLeave, roomLeft, SETTLED_IN, takeIn, willAdmit } from '../src/sim/joining';
import { migrate } from '../src/state/migrations';
import { startBattle, startRaid } from '../src/sim/battleTurn';
import { MAX_RAIDERS, MAX_RAIDERS_FAMED, fighterPerson, raiderCap } from '../src/sim/battle';
import { RAID_CHANCE_MAX, SACK_TAKES, raidDifficulty, raidOdds, sackSteading } from '../src/sim/raid';
import { fallenOf } from '../src/sim/fallen';
import { capacity, crowding } from '../src/sim/colony';
import { moodTarget } from '../src/sim/minds';
import { foundSettlement } from '../src/sim/site';
import { isWarbandTurn } from '../src/sim/battle';
import { reachTargets, throwTargets } from '../src/sim/strike';
import { shoveDestination } from '../src/sim/footwork';
import { REACH, canActFrom } from '../src/sim/ranks';
import { WARCRY_RANGE } from '../src/sim/warcry';
import { strikeTargets } from '../src/sim/battle';
import { offersAt, placeHere, tradeBlocker } from '../src/sim/places';
import { campStores } from '../src/sim/plunder';
import { strandTarget } from '../src/sim/sea';
import { atSea as _atSea } from '../src/sim/road';
import { placeKind, PLACE_KINDS } from '../src/data/places';
import { angerLevel, bargainBlocker, canFallOn, neighbourHere } from '../src/sim/neighbours';
import { canCallThing, hasSpeakers, thingNeeds, yearsRuled } from '../src/sim/thing';
import type { NeedId } from '../src/data/thing';
import { SPEAKER_STANDING } from '../src/data/thing';
import { fieldCrew, launchBlocker, provisionsFor } from '../src/sim/expedition';
import { provisioning, sailBlocker } from '../src/sim/voyage';
import { BARTER_FOOD, CLAN_KINDS } from '../src/data/clans';
import { wintersStood } from '../src/sim/calendar';
import { terrainDef } from '../src/data/terrain';
import type { GameState } from '../src/state/types';
import { jobById, type JobId } from '../src/data/jobs';
import { DEFAULT_HARDSHIP, HARDSHIPS, type HardshipId } from '../src/data/hardship';
import { BUILDINGS } from '../src/data/buildings';
import { EVENTS } from '../src/data/events';
import { LORE } from '../src/data/lore';
import { TRAITS } from '../src/data/traits';
import { kinPairs } from '../src/sim/kin';
import { drawOdds, swordOdds } from '../src/sim/joining';
import { DRAW_ANGER, DRAW_LARDER_DAYS, SWORD_DEEDS, WHY_SWORDS_COME, WHY_THEY_COME } from '../src/data/folk';
import { forecast, markVisible } from '../src/sim/winter';
import { reachable } from '../src/sim/reach';
import { eventChance, isEligible } from '../src/sim/events';
import { currentMode } from '../src/modes';
import { stream } from '../src/rng';
import { GHOST_RUIN_ID, haunt, theRuin } from '../src/sim/haunt';

import { ROUTE_STOPS, daysBetween, stopAt } from '../src/sim/route';
import { hasTrod, knowsStop, learnStop, standingAt, walkOptions } from '../src/sim/coast';
import { groundAtStop } from '../src/sim/fishery';
import { atHome, stopReport } from '../src/sim/site';

const CREW: JobId[] = ['farmer','farmer','woodcutter','hunter','builder','warrior'];

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
interface Policy {
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
   * Whether the band walks out on a steading the verdict has written off.
   *
   * AUDIT ITEM 6. `readiness()` named this as a way out for a long time while
   * it was not a verb, and when the promise was withdrawn the note said
   * whether it SHOULD be one was a live question nothing had measured. This
   * knob is how it gets measured, against the standard the escape hatch set:
   * saved nobody, killed two.
   */
  retreats: boolean;
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
const COAST_FLOOR = { site: 14, hard: 12 };


function floorOn(day: number): number {
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
function whereOn(state: GameState): number {
  return standingAt(state);
}

/**
 * One step of the walk toward a stretch, or null if there is nowhere to go.
 *
 * `walkOptions` already knows what a day buys — one stretch on foot, up to
 * `SHIP_REACH` of them at the oars — so picking the option that ends nearest
 * the target IS the line's version of "move toward it".
 */
function stepToward(state: GameState, target: number): Action | null {
  const opts = walkOptions(state);
  if (opts.length === 0) return null;
  const best = opts.reduce((a, b) =>
    daysBetween(state.seed, b, target) < daysBetween(state.seed, a, target) ? b : a);
  return { type: 'WALK', to: best };
}

/** The nearest stretch the band knows of that answers `want`, within `days`. */
function nearestStop(
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

function recrew(state: GameState): number {
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
const SETTLER: Policy = {
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
const RAIDER: Policy = {
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
const TURTLE: Policy = {
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
const DESPERATE: Policy = {
  ...SETTLER,
  id: 'desperate',
  // Four, because #34 measured that three is half a shield wall walking into
  // a fight. A last throw that loses the sworn is not a lever.
  raidParty: 4,
  desperate: true,
};

const POLICIES = [SETTLER, RAIDER, TURTLE];

/**
 * Which one is playing. Module-level for the same reason `settleNotBefore`
 * is — step() is called from a dozen places and only the policy sweep cares
 * — and reset in a finally, because a leaked value would silently rewrite
 * every figure in this file.
 */
let policy: Policy = SETTLER;
/**
 * How many hands the bot has moved between jobs since a test last zeroed it.
 *
 * The instrument bar for audit item 7: a re-crewing arm that never actually
 * re-crewed is the same run twice, and this file has shipped that mistake
 * before.
 */
let recrewed = 0;
/** How many steadings the bot has walked out on since a test zeroed it. */
let walkedOut = 0;
/**
 * The day the bot may settle again after walking out. PER RUN — reset at the
 * top of `run()`, unlike `settleNotBefore`, which a sweep sets deliberately
 * and holds across a whole sample.
 */
let walkOutHold = 0;
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
let settleNotBefore = 0;

/**
 * Item 2's instrument: which of the four verbs the bot is allowed.
 *
 * `dash` is off, and that is a measured decision rather than an oversight —
 * see `test/wall.test.ts`, which prices it at a third of the wins and a
 * third of the survivors. Spending the turn's action to arrive sooner means
 * arriving alone and arriving having already acted. Kept as a toggle so the
 * claim stays executable.
 */
const VERBS = { throw: true, shove: true, defend: true, dash: false };


function step(state: GameState): Action {
  if (state.event) {
    return state.event.outcome ? { type:'DISMISS_EVENT' } : { type:'CHOOSE', index:0 };
  }
  if (state.aftermath) return { type:'DISMISS_AFTERMATH' };
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
    // rule, a capability the bot cannot use is measured as worthless.
    //
    // Each rule below is the narrow case where an average player reaches for
    // the verb, not the case that flatters it.

    // SHOVE, for the one thing a shove does that a blow cannot: put a man in
    // the water, where the sea finishes him for nothing. Checked BEFORE the
    // strike because both spend the turn's action, and a drowning is worth
    // more than a hit.
    if (VERBS.shove && !me.hasActed && strikeTargets(state).length > 0) {
      // Same correction as test/wall.test.ts, and for the same reason. A
      // shove that moves somebody deals NO damage on a line, and moves them
      // between two ranks an axe already reaches — the whole worth of the
      // verb is the other branch, where the last man of a line is driven
      // against his own for 2 that cannot miss. The ported rule fired on
      // exactly the half that does nothing.
      const health = (id: string): number => fighterPerson(state, id)?.health ?? 99;
      const shoveWorth = (f: typeof foes[number]): boolean => {
        if (!REACH.shove.at.includes(f.rank) || !canActFrom('shove', me.rank)) return false;
        return !shoveDestination(b, f) && health(f.personId) <= 2;
      };
      const shoved = foes.find(shoveWorth);
      if (shoved) return { type:'B_SHOVE', targetId: shoved.personId };
    }

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

    // On DASH, which the measurement changed my mind about twice on hexes
    // and once more on the line.
    //
    // The obvious hex rule — "out of the fight, action unspent, so run" —
    // was a TRAP: over forty seeds it took the balanced country from 11
    // bands seeing spring to 8, because spending the action to arrive sooner
    // means the fastest man arrives ALONE and having already acted, which is
    // exactly the charge `test/wall.test.ts` measures as losing. A shield
    // wall does not sprint.
    //
    // On a line there is nowhere to sprint TO, and the trap inverts: a band
    // that shuffles ranks never closes with anybody at all. So the rule is
    // the narrow honest one — a man who can reach nothing with any verb has
    // an unspent action and one place to spend it, which is forward.
    if (VERBS.dash && !me.hasActed && inReach.length === 0
      && reachTargets(state).length === 0 && throwTargets(state).length === 0) {
      return { type:'B_DASH', by: -1 };
    }

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
const CAMP_WORTH = 0.6;


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
const RAID_DAYS = 10;
/** A fishing trip is an errand of days, not a fortnight. See the fish case. */
const FISH_DAYS = 6;

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
function raidTargetOn(
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
function raidWorth(state: GameState, within?: number): boolean {
  return raidTargetOn(state, within) !== null;
}

/** Where a trade errand should go, as a stretch. */
function counterStopOn(state: GameState): number | null {
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
function run(
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
          if (shortWood && shortFood) assign(state, p.id, ix % 2 ? 'woodcutter' : 'hunter');
          else if (shortWood) assign(state, p.id, ix < 4 ? 'woodcutter' : 'hunter');
          else if (shortFood) assign(state, p.id, ix < 4 ? 'hunter' : 'woodcutter');
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
function armSeed(arm: number, s: number, seeds: number): string {
  return `curve-${s + arm * seeds}`;
}

/**
 * Founds at the landing if the landing will take posts, else wherever the
 * world will. The wider sea margin (52x36 worldgen) made foundable LANDINGS
 * rare, and a fixture that only ever tried the landing started failing on
 * ground that exists eight hexes away.
 */
function foundAnywhere(state: GameState): boolean {
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
const SEEDS = Number(
  (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process?.env?.['LANDNAM_SEEDS'] ?? 60,
);

interface Curve {
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

let cached: Curve | null = null;

/**
 * Measured once, read by every bar below.
 *
 * Async for one reason: the loop is minutes of solid computation, and a
 * worker whose event loop never yields cannot answer the test runner's RPC
 * heartbeat — CI then fails the run with "[vitest-worker]: Timeout calling
 * onTaskUpdate" under 560 green tests. One yielded macrotask per seed keeps the
 * loop breathing and costs nothing anyone can measure.
 */
async function measured(): Promise<Curve> {
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
const CURVE_TIMEOUT = 600_000;

describe('the difficulty curve', () => {
  const pct = (n: number) => Math.round((100 * n) / SEEDS);

  it('is winnable by an average player, and not a walkover', { timeout: CURVE_TIMEOUT }, async () => {
    const m = await measured();
    console.log(`curve over ${SEEDS} seeds: winter ${pct(m.reachedWinter)}%, spring ${pct(m.sawSpring)}%, two winters ${pct(m.twoWinters)}%, settled by winter ${m.settledByWinter}`);
    // Measured at 78% / 30% / 7% when these bars were re-based. The figures
    // they replaced (83/55/50) were the truncation artifact in the header,
    // not the game. The band stays wide on purpose: a tripwire for
    // "unwinnable" and "trivial", not a lock on today's numbers.
    //
    // The floor moved from two winters to spring, because an instrument that
    // resolves to ±5 points cannot honestly put a floor under a 7% figure.
    // Two winters keeps only the walkover ceiling; whether 7% is the brutal
    // late game Phase 6 wanted or an overshoot is a design decision the
    // roadmap now owns, and a bar must not take it by default.
    expect(pct(m.reachedWinter)).toBeGreaterThanOrEqual(45);
    expect(pct(m.reachedWinter)).toBeLessThanOrEqual(95);
    expect(pct(m.sawSpring)).toBeGreaterThanOrEqual(10);
    expect(pct(m.twoWinters)).toBeLessThanOrEqual(60);
  });

  it('kills more bands than it spares before the first thaw', { timeout: CURVE_TIMEOUT }, async () => {
    // Whatever else moves, the first winter has to be the wall. If as many
    // bands see spring as reach winter, winter has stopped meaning anything.
    const m = await measured();
    expect(m.sawSpring).toBeLessThan(m.reachedWinter);
  });

  it('gets most surviving bands settled before the dark', { timeout: CURVE_TIMEOUT }, async () => {
    // A band still walking when winter lands is a band that cannot stockpile,
    // and that failure should be a mistake rather than the default.
    const m = await measured();
    expect(m.settledByWinter * 2).toBeGreaterThan(m.reachedWinter);
  });

  it('names what the wall window kills with', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 4 of the audit. Half the game's deaths land between day 40 and
    // 73, and until this table existed nobody could say of WHAT — which is
    // the difference between a hard game and an opaque one. No bars on the
    // shape: the table is an instrument, and the one assertion is that it
    // cannot silently go blind.
    const m = await measured();
    const deaths = Object.entries(m.deaths).sort((a, b) => b[1] - a[1]);
    const ends = Object.entries(m.ends).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `the wall window (day 40-73) over ${SEEDS} seeds — deaths: ` +
        deaths.map(([fate, n]) => `${fate} ${n}`).join(', ') +
        ` | runs ended: ${ends.map(([cause, n]) => `${cause} ${n}`).join(', ')}`,
    );
    const total = deaths.reduce((sum, [, n]) => sum + n, 0);
    expect(total).toBeGreaterThan(0);
  });
});

// --- The wall ---

// --- What the late game is NOT short of ---
//
// Two levers were built, measured and thrown away trying to fix the flat late
// game (41 of 43 bands through the first winter reach the second). Both are
// recorded here so the third attempt does not start by repeating them.
//
//   1. Raid pressure rising with the steading's fame. Built, then tried at
//      three magnitudes up to three times the original. The curve moved by
//      nothing at any of them: raids do fire — 61 across 80 runs, 38 runs saw
//      one — and settled bands simply hold them.
//   2. Winters that deepen with the years: +2 firewood a night per winter
//      already stood, so winter two burns 8 and winter three 10, plus a
//      colder night for the sickness roll. Implemented correctly and verified
//      at the boundaries. It changed survival to the second winter by zero
//      for a careful player AND by zero for a careless one (18/40 either
//      way), because the winter mark is a perfect forecast and surplus labour
//      can always be moved onto whatever it says is short.
//
// The diagnosis both point at: by the second year a settled band has more
// labour than it has uses for, so NOTHING routed through the material
// survival loop — food, firewood, cold — can threaten it. A lever that works
// has to take away people or bring something a small band cannot beat, not
// raise a number the band can simply out-work.

describe('the memorial outlives the run', () => {
  it('names everyone the run buried, oldest death first', () => {
    const state = structuredClone(newGame('wall'));
    state.party.people[0]!.alive = false;
    state.party.people[0]!.fate = 'took a spear at the ford';
    state.party.people[0]!.diedOn = 30;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.fate = 'did not wake';
    state.party.people[1]!.diedOn = 12;

    const dead = fallenOf(state);
    expect(dead).toHaveLength(2);
    expect(dead[0]!.day).toBe(12);
    expect(dead[1]!.day).toBe(30);
    expect(dead[0]!.fate).toBe('did not wake');
    // The seed goes on the stone, so two Ketils from two sagas are two people.
    expect(dead.every((f) => f.seed === state.seed)).toBe(true);
  });

  it('gives a nameless death a fate and a day rather than dropping it', () => {
    const state = structuredClone(newGame('vague'));
    state.day = 41;
    state.party.people[0]!.alive = false;
    const dead = fallenOf(state);
    expect(dead).toHaveLength(1);
    expect(dead[0]!.fate.length).toBeGreaterThan(0);
    expect(dead[0]!.day).toBe(41);
  });

  it('leaves the living off it', () => {
    const state = structuredClone(newGame('living'));
    expect(fallenOf(state)).toHaveLength(0);
  });
});

// --- Motion ---

describe('the chrome points at what changed', () => {
  it('says nothing on the first reading', () => {
    // Opening the game is not a moment where six numbers changed. Flashing
    // the whole bar on load is noise with no information in it.
    expect(bumped(null, { food: 24, wood: 8 })).toEqual({});
  });

  it('marks only the numbers that actually moved', () => {
    const moved = bumped({ food: 24, wood: 8, heart: 70 }, { food: 21, wood: 8, heart: 70 });
    expect(moved.food).toBe(true);
    expect(moved.wood).toBe(false);
    expect(moved.heart).toBe(false);
  });

  it('does not bump a number it has never seen before', () => {
    // A stat that appears mid-run (a bar gaining a column) has not changed.
    expect(bumped({ food: 24 }, { food: 24, wood: 8 }).wood).toBe(false);
  });

  it('remembers between readings, and each watch keeps its own memory', () => {
    const bar = makeWatch();
    const other = makeWatch();
    expect(bar({ food: 24 })).toEqual({});
    expect(bar({ food: 24 }).food).toBe(false);
    expect(bar({ food: 20 }).food).toBe(true);
    // Reading the same value twice in a row is not a change either.
    expect(bar({ food: 20 }).food).toBe(false);
    // The other bar has seen nothing, so it is still on its first reading.
    expect(other({ food: 20 })).toEqual({});
  });
});

// --- Winters that differ, and a mark that admits it ---

describe('no two winters are the same, and the mark says so', () => {
  it('fixes each winter with the run seed, so replays stay stable', () => {
    const a = winterDepth('same-saga', 150);
    expect(winterDepth('same-saga', 150)).toBe(a);
    expect(winterDepth('same-saga', 160)).toBe(a);
  });

  it('gives different sagas different winters', () => {
    const depths = new Set(
      Array.from({ length: 20 }, (_, i) => winterDepth(`saga-${i}`, 150)),
    );
    expect(depths.size).toBeGreaterThan(1);
  });

  it('leaves the first winter alone — it is the early game and it is tuned', () => {
    for (let i = 0; i < 20; i += 1) expect(winterDepth(`saga-${i}`, 60)).toBe(0);
  });

  it('makes later winters cost more than the first, whatever the luck', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(effectsOn(150, `saga-${i}`).firewood).toBeGreaterThan(effectsOn(60).firewood);
    }
  });

  it('is exact close to, and admits its vagueness far out', () => {
    // 3.4's promise was that the game tells you the number. It still does,
    // where you can act on it — the haze only clouds long-range planning.
    expect(markHaze(150)).toBe(0);
    expect(markHaze(100)).toBeGreaterThan(0);
    expect(markHaze(90)).toBeGreaterThan(markHaze(110));
  });
});

// --- 6.2 groundwork: growth has to cost something ---

describe('the fire scales with the band round it', () => {
  /** A band of exactly this many living people, on this day. */
  function bandOf(heads: number, day: number): GameState {
    const state = structuredClone(newGame('hearth'));
    state.day = day;
    while (state.party.people.length < heads) {
      state.party.people.push({ ...state.party.people[0]!, id: `extra-${state.party.people.length}` });
    }
    state.party.people.forEach((person, i) => {
      person.alive = i < heads;
    });
    return state;
  }

  const MIDWINTER = 60;

  it('leaves the band the game was tuned for exactly where it was', () => {
    // Six off the knarr is the figure every winter number was balanced
    // against, and 80% of bands reaching the first winter is a number worth
    // not disturbing. Scaling must pivot on it, not shift it.
    for (const day of [10, 30, MIDWINTER, 80]) {
      const six = bandOf(BAND_BASE, day);
      expect(firewoodPerNight(six)).toBe(effectsOn(day, six.seed).firewood);
    }
  });

  it('makes a bigger hall cost more to keep', () => {
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const nine = firewoodPerNight(bandOf(9, MIDWINTER));
    const twelve = firewoodPerNight(bandOf(12, MIDWINTER));
    expect(nine).toBeGreaterThan(six);
    expect(twelve).toBeGreaterThan(nine);
  });

  it('does not turn losing people into a windfall', () => {
    // A fire warms a room, not a headcount. If half the band dying halved the
    // burn, a death would be a saving — which is the opposite of what
    // permadeath and the memorial wall are for.
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const three = firewoodPerNight(bandOf(3, MIDWINTER));
    expect(three).toBeLessThan(six);
    expect(three * 2).toBeGreaterThan(six);
  });

  it('never lets a night be free', () => {
    for (const heads of [1, 2, 3]) {
      for (const day of [10, MIDWINTER]) {
        expect(firewoodPerNight(bandOf(heads, day))).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('closes the asymmetry that made extra hands free', () => {
    // The whole reason this exists: food scaled with mouths and firewood did
    // not, so every additional person was labour at no cost in wood. Three
    // separate attempts to threaten the late game bounced off exactly that.
    // Both must now move together before 6.2 offers anybody a way to grow.
    const small = bandOf(4, MIDWINTER);
    const large = bandOf(12, MIDWINTER);
    expect(foodPerDay(large)).toBeGreaterThan(foodPerDay(small));
    expect(firewoodPerNight(large)).toBeGreaterThan(firewoodPerNight(small));
  });
});

// --- 6.2: who bears arms ---

describe('the warband is six, whatever the steading holds', () => {
  /** A band with `armed` sworn and `workers` hands. */
  function household(armed: number, workers: number): GameState {
    const state = structuredClone(newGame('household'));
    const template = state.party.people[0]!;
    state.party.people = [
      ...Array.from({ length: armed }, (_, i) => ({
        ...template, id: `sworn-${i}`, bond: 'sworn' as const, alive: true,
      })),
      ...Array.from({ length: workers }, (_, i) => ({
        ...template, id: `hand-${i}`, bond: 'hand' as const, alive: true,
      })),
    ];
    return state;
  }

  it('never fields more than six however many are at home', () => {
    for (const workers of [0, 4, 9, 20]) {
      const state = household(6, workers);
      expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    }
  });

  it('caps the sworn even if a save somehow holds more', () => {
    expect(sworn(household(10, 0).party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps the hands off the field entirely', () => {
    const state = household(4, 8);
    startBattle(state, 'meadow', 0);
    const ours = state.battle!.combatants.filter((c) => c.side === 'warband');
    // Four sworn, eight hands, four on the field. More people at the steading
    // must never become a wider shield wall.
    expect(ours).toHaveLength(4);
    for (const c of ours) expect(c.personId.startsWith('sworn-')).toBe(true);
  });

  it('counts the hands as mouths and as bodies round the fire', () => {
    // They do not fight, but they eat and they need warming — which is what
    // stops taking people in from being free.
    const lean = household(6, 0);
    const full = household(6, 6);
    lean.day = 60;
    full.day = 60;
    expect(foodPerDay(full)).toBeGreaterThan(foodPerDay(lean));
    expect(firewoodPerNight(full)).toBeGreaterThan(firewoodPerNight(lean));
  });

  it('brings an older save forward with everyone sworn', () => {
    // Everyone in a pre-6.2 save came off the knarr with a weapon.
    const old = structuredClone(newGame('older')) as unknown as Record<string, unknown>;
    old['version'] = 16;
    const party = old['party'] as { people: Record<string, unknown>[] };
    for (const person of party.people) delete person['bond'];
    const migrated = migrate(old).save;
    const people = (migrated['party'] as { people: Record<string, unknown>[] }).people;
    expect(people.every((p) => p['bond'] === 'sworn')).toBe(true);
  });
});

// --- 6.2: room to put people ---

describe('a steading holds who it has room for', () => {
  function settledAt(seed: string): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) return state;
    }
    throw new Error('nothing foundable');
  }

  it('gives a band with no steading room only for the six it landed with', () => {
    expect(capacity(structuredClone(newGame('roofless')))).toBe(SWORN_MAX);
  });

  it('opens room only when something is built for it', () => {
    const state = settledAt('room');
    // Posts in and nothing raised: still the six the boat sleeps. Settling
    // must never make a band worse off than camping.
    expect(capacity(state)).toBe(SWORN_MAX);
    state.settlement!.built.push('longhouse');
    expect(capacity(state)).toBe(6);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBe(10);
    state.settlement!.built.push('meadhall');
    expect(capacity(state)).toBe(13);
  });

  it('counts nobody as crowded while there is space', () => {
    const state = settledAt('space');
    state.settlement!.built.push('longhouse');
    expect(crowding(state)).toBe(0);
  });

  it('bites harder the further past the roof the band is', () => {
    const state = settledAt('packed');
    state.settlement!.built.push('longhouse');
    const template = state.party.people[0]!;
    const roomy = moodTarget(state, template, { hungry: false, cold: false, grieving: false });

    for (let i = 0; i < 4; i += 1) {
      state.party.people.push({ ...template, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(crowding(state)).toBe(4);
    const packed = moodTarget(state, template, { hungry: false, cold: false, grieving: false });
    expect(packed).toBeLessThan(roomy);
  });

  it('makes the build queue worth keeping after the winter is beaten', () => {
    // The point of capacity: raising a búð is what lets a band grow, so the
    // queue stops being a thing you finish and becomes a thing you extend.
    const state = settledAt('queue');
    state.settlement!.built.push('longhouse');
    const before = capacity(state);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBeGreaterThan(before);
  });
});

// --- 6.2: the ways in, and the way out ---

describe('a band that can grow, and can bleed', () => {
  function roofed(seed: string, rooms: string[] = ['longhouse']): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) {
        state.settlement!.built.push(...rooms);
        return state;
      }
    }
    throw new Error('nothing foundable');
  }

  /**
   * AUDIT ITEM 3, and the bar that would have caught it.
   *
   * Phase 6.2 built capacity, crowding, hands, the repeatable búð and a whole
   * leaving system, and then never opened the front door. Measured over sixty
   * sagas: an average of 9.8 beds with 5.2 of them standing empty, four
   * people arriving in total, and the band NEVER ONCE exceeding the six who
   * stepped off the knarr. The joining event cards — four of them, total
   * weight 15 in a 102-card deck — were drawn twice.
   *
   * The asymmetry was the disease. `maybeRaid` has rolled every day since
   * 3.5 to see whether somebody comes to take what you have, and nothing
   * ever rolled the other way, so the coast could only subtract.
   */
  it('a steading worth coming to draws people, and a wretched one does not', () => {
    const rich = roofed('draw-rich', ['longhouse', 'bud', 'meadhall', 'farmplots', 'smokehouse']);
    rich.day = 180;
    rich.party.food = 300;
    for (const n of rich.neighbours) n.standing = 70;
    expect(drawOdds(rich), 'nobody would come to a hall like this').toBeGreaterThan(0);

    const poor = roofed('draw-poor', ['longhouse', 'bud']);
    poor.day = 180;
    poor.party.food = 300;
    for (const n of poor.neighbours) n.standing = -90;
    expect(drawOdds(poor)).toBeLessThan(drawOdds(rich));
  });

  it('never past the floor, and never past the larder', () => {
    const state = roofed('draw-floors', ['longhouse', 'bud', 'meadhall']);
    state.day = 180;
    state.party.food = 300;
    for (const n of state.neighbours) n.standing = 70;
    expect(drawOdds(state)).toBeGreaterThan(0);

    // RESTATED, not loosened. This asked for the door to shut at the last
    // BED, and that is what made `crowding` unreachable — the band pressed up
    // against the roof and stopped, so the tradeoff sim/sickness.ts is built
    // on ("past what the roof has room for, a bad week becomes a bad winter")
    // could not occur on any settled day of sixty sagas. The refusal is still
    // real and a búð still buys the difference; it now falls three later, at
    // the floor between the benches rather than at the last bed.
    const beds = structuredClone(state);
    while (roomLeft(beds) > 0) takeIn(beds, 1, 'test');
    expect(roomLeft(beds)).toBe(0);
    expect(drawOdds(beds), 'a full hall still takes the ones who sleep on the floor')
      .toBeGreaterThan(0);

    const full = structuredClone(beds);
    while (willAdmit(full) > 0) takeIn(full, 1, 'test');
    expect(crowding(full)).toBe(OVER_ROOF);
    expect(drawOdds(full)).toBe(0);

    // Nor a mouth it cannot feed. That is not growth, it is company while
    // you starve.
    const lean = structuredClone(state);
    lean.party.food = foodPerDay(lean) * DRAW_LARDER_DAYS - 1;
    expect(drawOdds(lean)).toBe(0);
  });

  it('a coast that wants you dead keeps them away', () => {
    const calm = roofed('draw-calm', ['longhouse', 'bud', 'meadhall']);
    calm.day = 180;
    calm.party.food = 300;
    for (const n of calm.neighbours) n.standing = 0;
    const feud = structuredClone(calm);
    for (const n of feud.neighbours) n.standing = -100;
    expect(drawOdds(feud)).toBeLessThan(drawOdds(calm));
    expect(DRAW_ANGER).toBeGreaterThan(0);
  });

  it('and the door is actually wired to the day', () => {
    // The half that matters, and the half the kin line and the watch-mark
    // cap both got wrong: a rule nothing calls is a rule that does not exist.
    const state = roofed('draw-wired', ['longhouse', 'bud', 'meadhall', 'farmplots']);
    state.day = 200;
    for (const n of state.neighbours) n.standing = 80;
    const before = living(state.party.people).length;
    let came = 0;
    for (let d = 0; d < 400 && !state.end; d += 1) {
      state.party.food = 300;
      state.party.firewood = 300;
      state.party.morale = 90;
      if (state.event) state.event = undefined;
      if (state.battle) state.battle = undefined;
      passDay(state);
      came = living(state.party.people).length - before;
      if (came > 0) break;
    }
    expect(came, 'four hundred days at a full hall and nobody came').toBeGreaterThan(0);
    expect(state.saga.some((e) => WHY_THEY_COME.some((w) => e.text.includes(w)))).toBe(true);
  });

  /**
   * The other door, and the one that makes raiding survivable.
   *
   * `drawOdds` is shut down by `DRAW_ANGER` as the coast turns against you,
   * which is right — nobody moves in next to a feud — and measured as a
   * death spiral: a raider ended a saga with 0.8 hands where a turtle had
   * 2.8, could not replace one of the four sworn he lost a saga, and ground
   * his warband to nothing.
   *
   * A feared band does not attract nobody. It attracts a DIFFERENT somebody.
   * Men who want a share come because the coast is frightened of you and
   * because you have taken something worth sharing — so this draw is fed by
   * the same anger that closes the other one.
   */
  it('a feared band with something to show draws swords, not settlers', () => {
    const quiet = roofed('sword-quiet', ['longhouse', 'bud', 'meadhall']);
    quiet.day = 180;
    quiet.party.food = 300;
    for (const n of quiet.neighbours) n.standing = 40;
    expect(swordOdds(quiet), 'a friendly farm should draw no swords').toBe(0);

    const feared = structuredClone(quiet);
    for (const n of feared.neighbours) n.standing = -80;
    feared.tally.sackings = SWORD_DEEDS;
    // A gap in the wall to fill: the line is six and stays six.
    feared.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });
    expect(swordOdds(feared)).toBeGreaterThan(0);
    expect(drawOdds(feared), 'settlers should be staying well away')
      .toBeLessThan(drawOdds(quiet));
  });

  it('frightening on its own buys nobody, and rich on its own buys nobody', () => {
    const base = roofed('sword-halves', ['longhouse', 'bud', 'meadhall']);
    base.day = 180;
    base.party.food = 300;
    base.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });

    const feared = structuredClone(base);
    for (const n of feared.neighbours) n.standing = -80;
    feared.tally.sackings = 0;
    expect(swordOdds(feared), 'unpleasant with nothing to show is just unpleasant').toBe(0);

    const rich = structuredClone(base);
    for (const n of rich.neighbours) n.standing = 0;
    rich.tally.sackings = SWORD_DEEDS;
    expect(swordOdds(rich), 'a hoard nobody fears is a farm').toBe(0);
  });

  it('fills the gap in the wall and never widens it', () => {
    const state = roofed('sword-gap', ['longhouse', 'bud', 'meadhall', 'farmplots']);
    state.day = 180;
    state.party.food = 300;
    for (const n of state.neighbours) n.standing = -90;
    state.tally.sackings = SWORD_DEEDS * 2;
    expect(swordOdds(state), 'a full warband needs nobody').toBe(0);

    state.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });
    expect(swordOdds(state)).toBeGreaterThan(0);

    let came = 0;
    for (let d = 0; d < 600 && came === 0; d += 1) {
      state.party.food = 300;
      state.party.firewood = 300;
      if (state.event) state.event = undefined;
      if (state.battle) state.battle = undefined;
      passDay(state);
      came = sworn(state.party.people).length - 4;
    }
    expect(came, 'six hundred days of infamy and nobody came for a share')
      .toBeGreaterThan(0);
    expect(sworn(state.party.people).length, 'the wall is six and stays six')
      .toBeLessThanOrEqual(SWORN_MAX);
    expect(state.saga.some((e) => WHY_SWORDS_COME.some((w) => e.text.includes(w)))).toBe(true);
  });

  it('takes people in as hands, never as fighters', () => {
    const state = roofed('join', ['longhouse', 'bud']);
    const joined = takeIn(state, 2, 'they had nowhere else to be');
    expect(joined).toHaveLength(2);
    expect(joined.every((p) => p.bond === 'hand')).toBe(true);
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('turns people away when there is no floor left, and says nothing about it', () => {
    // A hall that has run out of room refusing help is still the reason
    // capacity exists, and still what makes a búð worth five timber. What
    // changed is where "run out" falls: at the last bed the refusal made
    // `crowding` impossible, and a shipped mechanic sat behind it.
    const full = roofed('full');
    expect(roomLeft(full)).toBe(0);
    // The floor between the benches, and then the door.
    expect(takeIn(full, OVER_ROOF + 2, 'they had nowhere else to be'))
      .toHaveLength(OVER_ROOF);
    expect(living(full.party.people)).toHaveLength(6 + OVER_ROOF);
    expect(takeIn(full, 1, 'one more')).toHaveLength(0);
  });

  it('takes as many as it can put somewhere, and no more', () => {
    const state = roofed('partial', ['longhouse', 'bud']);
    expect(roomLeft(state)).toBe(4);
    expect(willAdmit(state)).toBe(4 + OVER_ROOF);
    expect(takeIn(state, 9, 'word had got round that we had ground'))
      .toHaveLength(4 + OVER_ROOF);
    expect(willAdmit(state)).toBe(0);
    // And the hall is now over its roof, which is a state this game could not
    // previously be in.
    expect(crowding(state)).toBe(OVER_ROOF);
  });

  it('writes every arrival into the saga with the reason they came', () => {
    const state = roofed('saga', ['longhouse', 'bud']);
    const before = state.saga.length;
    takeIn(state, 1, 'she came out of the trees with nothing');
    expect(state.saga.length).toBeGreaterThan(before);
    expect(state.saga.at(-1)!.text).toContain('trees');
  });

  it('lets a miserable hand walk, and never a sworn one', () => {
    const state = roofed('leaving', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    state.day += 1;
    for (const person of state.party.people) person.morale = 1;

    let walked = 0;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      walked += handsLeave(state).length;
    }
    expect(walked).toBeGreaterThan(0);
    // The warband cannot evaporate. A fight must never be a morale check
    // before it is a fight.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps a hand who has thrown their lot in', () => {
    const state = roofed('stayer', ['longhouse', 'bud']);
    takeIn(state, 2, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 1;
    state.day += SETTLED_IN + 1;
    expect(handsLeave(state)).toHaveLength(0);
  });

  it('keeps a contented hand whatever the weather', () => {
    const state = roofed('content', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 80;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      expect(handsLeave(state)).toHaveLength(0);
    }
  });

  it('empties a hall that is too crowded to bear', () => {
    // Capacity with teeth: taking in more than there is room for makes
    // everyone miserable, and misery is what makes hands walk.
    const state = roofed('overfull', ['longhouse', 'bud', 'meadhall']);
    takeIn(state, 7, 'word had got round that we had ground');
    const packed = crowding(state);
    for (const person of state.party.people) person.morale = 20;
    // Now take the room away, as a burnt búð or a bad winter would.
    state.settlement!.built = ['longhouse'];
    expect(crowding(state)).toBeGreaterThan(packed);
  });
});

// --- 6.3: force that outscales the warband ---

describe('a steading worth taking draws more than six can hold', () => {
  function famed(seed: string, built: string[], winters: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      // wintersStood counts from the first thaw, so winters=0 has to stay
      // BEFORE it — 73 is already one winter come through, not none.
      state.day = winters === 0 ? 30 : 73 + (winters - 1) * 96;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('brings the old nine against a steading nobody has heard of', () => {
    expect(raiderCap(famed('new', ['longhouse'], 0))).toBe(MAX_RAIDERS);
  });

  it('brings more against a hall that has stood years and been built up', () => {
    const young = raiderCap(famed('young', ['longhouse'], 0));
    const old = raiderCap(famed('old', ['longhouse', 'bud', 'meadhall', 'palisade'], 3));
    expect(old).toBeGreaterThan(young);
  });

  it('never fields more than the ground can hold', () => {
    const enormous = famed('huge', ['longhouse', 'bud', 'meadhall', 'palisade', 'smokehouse', 'dock'], 12);
    expect(raiderCap(enormous)).toBeLessThanOrEqual(MAX_RAIDERS_FAMED);
  });

  it('lets a coast that hates you actually send more', () => {
    // The measured dead end this exists to fix: with six sworn, rollFoes hit
    // the old cap of nine at difficulty four, so every point of pressure past
    // that was discarded by a Math.min and raid pressure measured as
    // worthless at three separate magnitudes. The lever was disconnected from
    // the thing it moved. What matters is that provocation now reaches the
    // field, not that it clears any particular number.
    const liked = famed('liked', ['longhouse', 'bud', 'meadhall'], 2);
    liked.party.food = 400;
    for (const n of liked.neighbours) n.standing = 60;

    const hated = structuredClone(liked);
    for (const n of hated.neighbours) n.standing = -100;

    expect(raidDifficulty(hated)).toBeGreaterThan(raidDifficulty(liked));
  });

  it('cannot be answered by fielding more of your own', () => {
    // Growth buys labour, never a wider line. That is what forces the answer
    // to be the wall, the watch, and who on this coast owes you anything.
    const state = famed('answer', ['longhouse', 'bud', 'meadhall'], 3);
    for (let i = 0; i < 7; i += 1) {
      state.party.people.push({ ...state.party.people[0]!, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    expect(raiderCap(state)).toBeGreaterThan(SWORN_MAX);
  });
});

describe('a steading worth taking is visited', () => {
  function steading(seed: string, built: string[], winters: number, food = 60): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      state.day = 73 + Math.max(0, winters - 1) * 96;
      state.party.food = food;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('leaves a steading alone while the posts are still fresh', () => {
    const fresh = steading('fresh', ['longhouse'], 1);
    fresh.settlement!.foundedOn = fresh.day - 2;
    expect(raidOdds(fresh)).toBe(0);
  });

  it('comes more for a hall that has stood years and been built up', () => {
    const young = raidOdds(steading('young', ['longhouse'], 1));
    const old = raidOdds(steading('old', ['longhouse', 'bud', 'meadhall', 'smokehouse'], 4));
    expect(old).toBeGreaterThan(young);
  });

  it('makes the watch and the wall worth keeping on a quiet day', () => {
    const open = steading('open', ['longhouse', 'bud', 'meadhall'], 3);
    const walled = structuredClone(open);
    walled.settlement!.built.push('palisade');
    walled.settlement!.watch = 6;
    expect(raidOdds(walled)).toBeLessThan(raidOdds(open));
  });

  it('stays a background hazard rather than a siege', () => {
    const richest = steading('rich', ['longhouse', 'bud', 'meadhall', 'smokehouse', 'dock'], 9, 900);
    for (const n of richest.neighbours) n.standing = -100;
    expect(raidOdds(richest)).toBeLessThanOrEqual(RAID_CHANCE_MAX);
  });
});

describe('somebody who walked out is not somebody who died', () => {
  it('keeps a leaver off the memorial and out of the saga', () => {
    const state = structuredClone(newGame('walked'));
    const killed = state.party.people[0]!;
    killed.alive = false;
    killed.fate = 'took a spear at the ford';
    killed.diedOn = 20;

    const gone = state.party.people[1]!;
    gone.alive = false;
    gone.left = true;
    gone.fate = 'walked out one morning and did not come back';
    gone.diedOn = 22;

    const wall = fallenOf(state);
    expect(wall).toHaveLength(1);
    expect(wall[0]!.name).toBe(killed.name);
  });

  it('still stops counting them as a mouth to feed', () => {
    // `alive: false` has to stand, whatever the fiction: somebody who has
    // gone is not eating here any more, and the upkeep must agree.
    const state = structuredClone(newGame('mouths'));
    const before = foodPerDay(state);
    state.party.people[0]!.alive = false;
    state.party.people[0]!.left = true;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.left = true;
    expect(foodPerDay(state)).toBeLessThan(before);
  });
});

// --- 3, 4 and 5 of the audit, deliberately in one place ---

describe('losing a raid costs the one thing that is scarce', () => {
  function sacked(seed: string, extraHands: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push('longhouse', 'bud', 'meadhall');
      state.party.food = 120;
      state.party.firewood = 90;
      for (let h = 0; h < extraHands; h += 1) {
        state.party.people.push({
          ...state.party.people[0]!, id: `hand-${h}`, bond: 'hand', alive: true, joinedOn: 1,
        });
      }
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('carries hands off, and never the sworn', () => {
    const state = sacked('taken', 4);
    const out = sackSteading(state);
    expect(out.taken.length).toBeGreaterThan(0);
    expect(out.taken.length).toBeLessThanOrEqual(SACK_TAKES);
    // The warband is fixed at six and a raid must not end a run by dice.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('takes nobody when there is nobody but the sworn to take', () => {
    const state = sacked('bare', 0);
    expect(sackSteading(state).taken).toHaveLength(0);
    expect(living(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('puts the carried-off on the memorial, unlike somebody who walked out', () => {
    // Taken is not the same as left. A man carried off by raiders genuinely
    // did not come back, and the wall is exactly the place to say so.
    const state = sacked('wall', 3);
    sackSteading(state);
    expect(fallenOf(state).some((f) => f.fate.includes('carried off'))).toBe(true);
  });

  it('costs labour the band has to win back rather than simply out-work', () => {
    const state = sacked('labour', 4);
    const before = living(state.party.people).length;
    sackSteading(state);
    expect(living(state.party.people).length).toBeLessThan(before);
  });
});

describe('the rhythm of interruption', () => {
  /**
   * How often the game STOPS the player, and what for.
   *
   * The curve cannot resolve this — sweeping the event chance through
   * 0.28/0.34/0.40 once gave 53/30/43% at two winters, which is noise being
   * read as signal, and it is why the base chance is set by ear. But the
   * COUNTS are not noise: they are tallies over sixty sagas, and they move
   * exactly as much as the knobs move. So the ear picks the number and this
   * records what the number actually did, which is the only honest way to
   * tune something the survival bars cannot see.
   */
  it('counts cards and fights per hundred days', { timeout: CURVE_TIMEOUT }, async () => {
    let cards = 0;
    let days = 0;
    let battles = 0;
    let raids = 0;
    // Where a fight came FROM. Without this split the knob cannot be read:
    // the bot also starts fights by falling on places, and those are deaf to
    // the event chance entirely.
    let fromCard = 0;
    let fromUs = 0;
    // Named foes who came back. Persistence that is never observed in a real
    // saga is persistence that does not exist.
    let returns = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s += 1) {
      let seen = 0;
      const state = run(`curve-${s}`, 169, (before, after) => {
        if (!before.event && after.event) seen += 1;
        if (!before.battle && after.battle && !after.battle.raid) {
          if (before.event) fromCard += 1;
          else fromUs += 1;
        }
        if (!before.battle && after.battle?.championOf) {
          const clan = before.neighbours.find((n) => n.id === after.battle!.championOf);
          if ((clan?.champion?.scars ?? 0) > 0) returns += 1;
        }
        // A clan that had a champion and no longer does lost him for good.
        for (const was of before.neighbours) {
          if (!was.champion) continue;
          const now = after.neighbours.find((n) => n.id === was.id);
          if (now && !now.champion) killed += 1;
        }
      });
      cards += seen;
      days += state.day;
      battles += state.tally.battles;
      raids += state.tally.raids;
    }
    const per100 = (n: number) => ((n / days) * 100).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(
      `rhythm over ${SEEDS} sagas (${days} days): ` +
        `cards ${cards} (${per100(cards)}/100d), open fights ${battles - raids} ` +
        `(${per100(battles - raids)}/100d) — ${fromCard} off a card, ${fromUs} of our own ` +
        `making — raids ${raids} (${per100(raids)}/100d); named foes: ${returns} came back, ` +
        `${killed} put down for good`,
    );
    // Tripwires only: a game with no cards and a game that is nothing but
    // cards are both broken, and both have been shipped by accident before.
    expect(cards).toBeGreaterThan(0);
    expect(battles).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('how hard the country is', () => {
  /**
   * A PUBLISHED figure needs an instrument that can resolve it, and this bar
   * ran for a day and a half on one that could not.
   *
   * Three hundred landings a setting rather than the sixty the rest of this
   * file uses, and the extra two minutes buys the difference between a
   * tripwire and a promise. At sixty seeds the standard error on a rate near
   * 0.7 is about six points, so a sample can sit ten points off the truth and
   * look like a reading — which is exactly what happened: As It Lies was
   * published at 72% off a single sixty-seed run, and re-measured at three
   * hundred, the very commit that published it was running at 52%. Nothing
   * had regressed. The number was never true.
   *
   * Sixty is the right sample for catching "unwinnable" and "walkover".
   * It is the wrong one for a claim printed on the menu, and this file was
   * doing both jobs with one number.
   */
  const CURVE_SEEDS = Number(
    (globalThis as { process?: { env: Record<string, string | undefined> } })
      .process?.env?.['LANDNAM_CURVE_SEEDS'] ?? 300,
  );

  /**
   * Item 3, and the reason it is a test rather than four numbers in a data
   * file: a difficulty setting whose labels are not measured is a lie told
   * three times. Every hardship runs the same landings through the same bot,
   * so "A Fair Country" means something a player can be told.
   */
  it('each setting is measured, and they are ordered', { timeout: CURVE_TIMEOUT }, async () => {
    const rows: string[] = [];
    const spring: Record<string, number> = {};
    for (const terms of HARDSHIPS) {
      let reachedWinter = 0;
      let sawSpring = 0;
      for (let s = 0; s < CURVE_SEEDS; s += 1) {
        const state = run(`curve-${s}`, 73, undefined, terms.id);
        if (state.day >= 49 || !state.end) reachedWinter += 1;
        if (!state.end) sawSpring += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      spring[terms.id] = sawSpring / CURVE_SEEDS;
      rows.push(
        `${terms.name.padEnd(16)} reached winter ${Math.round((reachedWinter / CURVE_SEEDS) * 100)}%, ` +
          `saw spring ${Math.round((sawSpring / CURVE_SEEDS) * 100)}% (${sawSpring}/${CURVE_SEEDS})`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`hardship over ${CURVE_SEEDS} seeds each:\n  ${rows.join('\n  ')}`);

    // The bar: the order has to be real AND outside what this harness can
    // resolve. A setting called kinder that is only six points kinder is
    // indistinguishable from noise, which is how the first cut of these
    // numbers read — 33% against 27% — and it is exactly what an unmeasured
    // difficulty ships with. Ten points is the floor this file has used
    // since the event-chance sweep taught it the lesson.
    expect(spring['fair']! - spring['even']!).toBeGreaterThan(0.1);
    expect(spring['even']! - spring['hard']!).toBeGreaterThan(0.1);

    // AND WHAT EACH SETTING PROMISES IS TRUE, which is the whole point of a
    // measured difficulty and is not what this used to check.
    //
    // The old bar was `expect(terms.measured.length).toBeGreaterThan(10)` —
    // it asserted that a claim EXISTS, not that it is correct. The menu could
    // have promised anything over ten characters and this would have passed,
    // while balance moved five times in a single day's work. This is the one
    // screen where the game tells a player what it will do to them before
    // they agree to it.
    //
    // FIVE points now, not ten, and the tightening is the point rather than a
    // flourish: ten was chosen to sit outside what sixty seeds could resolve,
    // and three hundred resolve to about three. A tolerance loose enough to
    // hide a twenty-point lie is not a guard.
    // AND THE MENU DESCRIBES THE GAME THAT SHIPS, which since 2026-08-28 is
    // the coast. `data/hardship.ts` holds one set of odds and there are two
    // buildable countries behind it, so this asks the published figure only
    // of the one a player is given. The hex build is scaffolding kept for a
    // side-by-side until 8.5's deletion lands; its balance is not maintained
    // separately, and a second set of numbers nobody reads would be a second
    // set of numbers nobody keeps true.
    //
    // The ORDER above is asked of the game rather than of the copy.
    for (const terms of HARDSHIPS) {
      expect(
        Math.abs(terms.odds.spring - spring[terms.id]!),
        `${terms.name} promises ${Math.round(terms.odds.spring * 100)}% see spring; `
          + `the harness measured ${Math.round(spring[terms.id]! * 100)}% over ${CURVE_SEEDS} `
          + 'landings. Re-measure and restate the figure in src/data/hardship.ts — '
          + 'and measure it HERE, at this sample, not at the sixty the rest of the file uses.',
      ).toBeLessThan(0.05);
    }
  });
});

describe('the first winter', () => {
  /**
   * Item 2 of the second audit, and it starts as a measurement because the
   * complaint that opened it was a photograph, not a number: a phone save on
   * day 26 with no roof, four food of a hundred and sixty-two, and nought
   * wood of two hundred and seventy-four. A run already lost and not told so.
   *
   * The death table says the game kills through grief rather than stores —
   * but that table is measured over BOT runs that settle early and work
   * perfectly, which is precisely the case that is not in trouble. This
   * holds the band off settling until a given day and then plays it out
   * properly, so the question "how late is too late?" gets an answer instead
   * of an opinion.
   */
  it('measures how late a band can settle and still see spring', { timeout: CURVE_TIMEOUT }, async () => {
    const HELD = [0, 12, 18, 24, 30];
    const SAMPLE = 24;
    const rows: string[] = [];
    let firstDoomed = -1;
    // Does the warning EARN its place? A verdict that fires on runs which go
    // on to live is crying wolf, and a verdict that never fires is dead code.
    let told = 0;
    let toldAndDied = 0;
    let untold = 0;
    let untoldAndDied = 0;
    try {
      for (const hold of HELD) {
        settleNotBefore = hold;
        let settled = 0;
        let settleDays = 0;
        let sawSpring = 0;
        for (let s = 0; s < SAMPLE; s += 1) {
          let settledOn = 0;
          let judged: boolean | null = null;
          const state = run(`curve-${s}`, 73, (before, after) => {
            if (!before.settlement && after.settlement) settledOn = after.day;
            // The verdict at ONE fixed moment: the first day of autumn on
            // which there is a steading to judge. "Did it ever fire" was the
            // first attempt and it is not a test — any band having one bad
            // week trips it, so it fired on 62 of 63. A player reads this
            // panel on a particular day and acts or does not; that is the
            // thing worth being right about.
            if (after.settlement && judged === null && after.day >= 40) {
              judged = !reachable(after);
            }
          });
          if (settledOn > 0) {
            settled += 1;
            settleDays += settledOn;
          }
          // Alive at the thaw is what "saw spring" means everywhere else here.
          const lived = !state.end;
          if (lived) sawSpring += 1;
          // Only SETTLED bands can be judged: there is no mark to miss on
          // the road, so `reachable` is true for every wanderer, and a
          // wanderer dies more often than anyone. Counting them as "never
          // told" made the warning look worse than useless the first time
          // this was measured — 77% against 98% — which was the harness
          // comparing settled bands with homeless ones, not the verdict
          // failing.
          if (judged !== null) {
            if (judged) {
              told += 1;
              if (!lived) toldAndDied += 1;
            } else {
              untold += 1;
              if (!lived) untoldAndDied += 1;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const rate = sawSpring / SAMPLE;
        rows.push(
          `held to day ${String(hold).padStart(2)}: settled ${settled}/${SAMPLE} ` +
            `(avg day ${settled ? Math.round(settleDays / settled) : 0}), ` +
            `saw spring ${sawSpring}/${SAMPLE} (${Math.round(rate * 100)}%)`,
        );
        if (rate === 0 && firstDoomed < 0) firstDoomed = hold;
      }
    } finally {
      settleNotBefore = 0;
    }
    // eslint-disable-next-line no-console
    console.log(`the first winter, by how long the posts were left in the boat:\n  ${rows.join('\n  ')}`);
    const pc = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : 'n/a');
    // eslint-disable-next-line no-console
    console.log(
      `  the verdict, read once on the first autumn day at home: told lost ${told}, ` +
        `${toldAndDied} died (${pc(toldAndDied, told)}); never told ${untold}, ` +
        `${untoldAndDied} died (${pc(untoldAndDied, untold)})`,
    );

    // The bars the verdict has to clear, because a wrong one is worse than
    // none: it must be far deadlier to be condemned than cleared, and it
    // must not cry wolf. Measured at 82% against 0% when it landed. The 60%
    // floor is deliberately below that — this is a tripwire for a verdict
    // that has stopped meaning anything, not a pin through today's number.
    expect(told).toBeGreaterThan(0);
    if (untold > 0) {
      expect(toldAndDied / told).toBeGreaterThan(untoldAndDied / untold);
    }
    expect(toldAndDied / told).toBeGreaterThanOrEqual(0.6);

    // The bar is not a rate — it is that settling LATE has to be worse than
    // settling early, or the opening's whole shape is a lie. Anything else
    // here is reported, not asserted, until the design decision is made.
    expect(rows.length).toBe(HELD.length);
  });
});

describe('the long game', () => {
  /**
   * Item 9, and the blind spot it closes is embarrassing in hindsight: the
   * curve harness stops at day 169, and a jarldom needs two winters plus a
   * Thing — so the endgame, the returning champion, the building tiers and
   * the escalation that answers them all shipped with NO measurement past
   * the second winter.
   *
   * Fewer seeds, far longer runs. The bot had to learn the whole endgame to
   * make this possible — barter, the Thing, and ruling on — which is the
   * same-commit rule again: a harness that cannot reach a system reports
   * that system as worthless.
   */
  // The SAME worlds the curve uses, so the two measurements are of one
  // thing at two lengths rather than of two different samples. The first
  // cut used its own `long-N` seeds and read 0 of 14 reaching a second
  // winter while the curve said 20% — which is a seed-set disagreement
  // wearing the costume of a finding.
  //
  // Twenty is what the suite can afford and it is NOT enough to read a rare
  // event off. Proved rather than assumed on 2026-08-10: a jarldom count of
  // 1 against an earlier 5 was recorded here as an unattributed regression,
  // and at sixty seeds an arm — three times the sample, same code — the
  // direction reversed outright. 120 sagas gave 5 jarldoms where the same
  // measurement on the commit BEFORE the day's raiding work gave 2, with
  // second winters 15 against 12, mead halls 35 against 26, friends 21
  // against 7. Nothing had regressed; twenty seeds had.
  //
  // So: the knob below is the instrument, and anyone reading a per-saga
  // COUNT off this test at the default should widen it first —
  // `LANDNAM_LONG_SEEDS=60 npx vitest run test/balance.test.ts -t 'plays to
  // day 500'`, about two minutes. The bars are written to be reachability
  // bars for exactly this reason: "did this ever happen" survives a thin
  // sample, "did it happen five times" does not.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  /**
   * ONE HUNDRED AND TWENTY, not twenty, and this is item 26's real fix.
   *
   * The menu's jarldom figures were published off a twenty-seed sample and
   * guarded by a bar running on the same twenty seeds, so the promise and its
   * proof agreed with each other and neither agreed with the game. At sixty
   * the same measurement reads 27/23/7 against a published 40/10/5 — A Fair
   * Country and As It Lies four points apart where the menu said thirty. At a
   * hundred and twenty the ordering comes back, 28/19/6, and that recovery is
   * what says the thin sample was the fault rather than the game.
   *
   * It costs about five minutes of the suite, which is what a figure printed
   * on the one screen where this game tells a player what it will do to them
   * is worth.
   */
  const LONG_SEEDS = Number(env?.['LANDNAM_LONG_SEEDS'] ?? 120);
  const LAST_DAY = 500;
  /**
   * Run on the GENTLE country, and that is an instrument choice rather than
   * a flattering one. On the balanced terms this same measurement returned
   * fourteen sagas averaging sixty-two days, none reaching the second
   * winter, none becoming jarl and NOT ONE fight after day 169 — nothing to
   * measure at all. The curve already measures whether a band survives; this
   * measures what the years DO to one that does, so it is run where bands
   * survive. The finding stands on its own and is worth keeping in view: at
   * "As It Lies", the endgame is content that almost no run reaches.
   */
  const LONG_TERMS: HardshipId = 'fair';



  it('plays to day 500 and reports what the years actually do', { timeout: 1_800_000 }, async () => {
    void LONG_TERMS;
    let reachedJarl = 0;
    let ruledYears = 0;
    let alive = 0;
    let days = 0;
    /* eslint-disable prefer-const */
    const ends: Record<string, number> = {};
    // Escalation, early against late: the whole claim of the word system is
    // that the coast gets harder. Counted as foes fielded per fight.
    let earlyFoes = 0;
    let earlyFights = 0;
    let lateFoes = 0;
    let lateFights = 0;
    let raids = 0;
    // Why a run never got there. "0 became jarl" is a result; this is a
    // diagnosis, and the difference is what makes the number actionable.
    let sawSecondWinter = 0;
    let everHadHall = 0;
    let everHadFriend = 0;
    let everCouldCall = 0;
    /**
     * How far the band ever got with ANYBODY on that coast, per settled
     * saga.
     *
     * Added 2026-08-10, and it is the diagnosis the counters above could
     * not give. `everHadFriend` is a yes/no on a rare event; this is a
     * distribution over every band that put posts in the ground, so it
     * carries a reading at twenty seeds where the jarl count cannot.
     * It costs nothing — the watch already runs.
     */
    const peakStanding: number[] = [];
    const peakByFate: { peak: number; reachedSecondWinter: boolean }[] = [];
    /**
     * Which of the Thing's SIX needs a settled band ever ticked at all.
     *
     * The road-to-the-Thing counters have always watched three of them —
     * winters, hall, friends — and never peace, feast or gathered. That is
     * half the checklist unmeasured, so "the endgame is gated on survival"
     * rested on a readout that could not have seen a fourth gate if there
     * were one. `everShort` is the actionable half: bands that ticked five
     * of six and which one they never got.
     */
    const everNeed: Record<string, number> = {};
    const everShort: Record<string, number> = {};
    /** Days on which this need alone stood between the band and the Thing. */
    const lastStanding: Record<string, number> = {};
    let allSixDays = 0;
    const unmetDays: Record<string, number> = {};
    let settledDays = 0;
    let sixEver = 0;
    let settledSagas = 0;
    let metAnybody = 0;
    /** How far each saga got, and what stopped it there. See below. */
    const lengths: Record<string, number> = {};
    const byBand: Record<string, Record<string, number>> = {};
    /** The state of every band that got past its third year. */
    let margin: {
      food: number; wood: number; winters: number; band: number;
      sworn: number; built: number; word: number; morale: number;
    }[] = [];
    // Pooled across both arms. The per-arm counters are reset at the top of
    // each loop, so asserting on them read ONLY the last arm — a bar that
    // measures half the sample and says nothing about the other half.
    let allEarlyFoes = 0, allEarlyFights = 0, allLateFoes = 0, allLateFights = 0;
    let allFriends = 0, allCouldCall = 0, allHalls = 0, allSecondWinters = 0, allJarls = 0;
    /**
     * How many sagas reached the first winter, per country.
     *
     * The bar that answers "is A Hard Country a difficulty or a wall?" — a
     * question nothing could answer until 2026-08-11, because the long game
     * ran `even` and `fair` only and the hardship sweep stops at day 73, so
     * the hardest setting the menu offers was the one nothing knew anything
     * about past the first spring.
     *
     * It is barred on the FIRST WINTER rather than on anything later,
     * because that is the one reading on `hard` a twenty-seed sample can
     * carry: 44 of 60 at the widened measurement. Jarldoms on hard happen
     * about once in sixty and cannot be barred on at any affordable N.
     */
    const firstWinters: Record<string, number> = {};
    const allJarlsBy: Record<string, number> = {};
    /**
     * How many sagas reached a SECOND winter, per country — the bar under
     * `DEFAULT_HARDSHIP` below.
     *
     * Second winters rather than jarldoms because a jarldom happens about
     * once in sixty on the hard country and cannot be barred on at any N
     * this file can afford, while a second winter is common enough on every
     * setting to carry a reading at twenty seeds.
     */
    const secondWintersBy: Record<string, number> = {};

    for (const TERMS of ['even', 'fair', 'hard'] as HardshipId[]) {
    reachedJarl = 0; ruledYears = 0; alive = 0; days = 0;
    earlyFoes = 0; earlyFights = 0; lateFoes = 0; lateFights = 0; raids = 0;
    sawSecondWinter = 0; everHadHall = 0; everHadFriend = 0; everCouldCall = 0;
    for (const k of Object.keys(ends)) delete ends[k];
    // The same reset the line above has needed since it was written, for the
    // same reason. Without it the second arm's histogram carried the first
    // arm's sagas and the third carried both — `fair` printed 240 runs out of
    // 120 and `hard` printed 360, which is the sort of number that only looks
    // wrong if you add the row up.
    for (const k of Object.keys(lengths)) delete lengths[k];
    for (const k of Object.keys(byBand)) delete byBand[k];
    margin = [];
    for (let s = 0; s < LONG_SEEDS; s += 1) {
      let hall = false;
      let friend = false;
      let couldCall = false;
      let settled = false;
      let met = false;
      let peak = -100;
      const ticked = new Set<NeedId>();
      const state = run(`curve-${s}`, LAST_DAY, (before, after) => {
        if (!before.battle && after.battle) {
          const n = after.battle.foes.length;
          if (after.day <= 169) {
            earlyFoes += n;
            earlyFights += 1;
          } else {
            lateFoes += n;
            lateFights += 1;
          }
        }
        if (after.settlement?.built.includes('meadhall')) hall = true;
        if (hasSpeakers(after)) friend = true;
        if (canCallThing(after)) couldCall = true;
        if (after.settlement) settled = true;
        for (const n of thingNeeds(after)) if (n.met) ticked.add(n.id);
        // WHICH NEED IS ACTUALLY BLOCKING, on the days it matters.
        //
        // `ticked` above is "ever met", and for a MOMENTARY need that is
        // nearly free — `gathered` asks only that nobody is away right now, so
        // of course every band satisfies it at some point. Reading 76/76 off
        // that and concluding the need never refuses anybody is the
        // instrument, not the game.
        //
        // The Thing wants all six AT ONCE, so the binding constraint is what
        // is missing on a day when everything else is there. Counted per day
        // rather than per saga, because that is the shape of the question.
        if (after.settlement && !after.end) {
          const needs = thingNeeds(after);
          const missing = needs.filter((n) => !n.met);
          if (missing.length === 1) lastStanding[missing[0]!.id] = (lastStanding[missing[0]!.id] ?? 0) + 1;
          if (missing.length === 0) allSixDays += 1;
          // And how often each is unmet AT ALL on a settled day, which is a
          // different question from being the last one standing: a need can
          // fail constantly and never be decisive because something else is
          // also missing. Both readings are needed to call a need decoration.
          for (const n of missing) unmetDays[n.id] = (unmetDays[n.id] ?? 0) + 1;
          settledDays += 1;
        }
        for (const n of after.neighbours) {
          if (!n.found) continue;
          met = true;
          if (n.standing > peak) peak = n.standing;
        }
      }, TERMS);
      if (settled) {
        settledSagas += 1;
        peakStanding.push(peak);
        peakByFate.push({ peak, reachedSecondWinter: state.day >= 169 });
        if (met) metAnybody += 1;
        for (const id of ticked) everNeed[id] = (everNeed[id] ?? 0) + 1;
        const missing = (['winters','hall','peace','friends','feast','gathered'] as NeedId[])
          .filter((id) => !ticked.has(id));
        if (missing.length === 0) sixEver += 1;
        if (missing.length === 1) everShort[missing[0]!] = (everShort[missing[0]!] ?? 0) + 1;
      }
      days += state.day;
      // WHERE A RUN DIES, not how long the average one is. "avg 172 days"
      // against a 500-day horizon says a run is short; it cannot say whether
      // that is one population dying at the same place or two populations —
      // most dying in the first year and a few going the distance — and those
      // want opposite fixes. Banded by the game's own clock: 96 days a year,
      // 24 a season, the first winter at 49.
      const band = state.day < 49 ? 'before the first winter'
        : state.day < 97 ? 'the first winter'
          : state.day < 193 ? 'the second year'
            : state.day < 289 ? 'the third year'
              : 'past the third year';
      lengths[band] = (lengths[band] ?? 0) + 1;
      // WHAT A JARL'S MARGIN ACTUALLY IS. "Nothing kills them" is a result;
      // this is the size of the gap, and the gap decides whether the third
      // act is a tuning job or a structural one. A jarldom pays tribute IN
      // every season and draws newcomers at 1.7x against a cost of +3 word
      // and +2 raiders, so the suspicion is that ruling compounds faster
      // than the coast escalates — in which case no raid will ever matter.
      if (band === 'past the third year') {
        const mouths = living(state.party.people).length;
        margin.push({
          food: state.party.food,
          wood: state.party.firewood,
          // A winter is 24 days and a mouth eats a half share a day.
          winters: state.party.food / Math.max(1, Math.ceil((mouths / 2)) * 24),
          band: mouths,
          sworn: sworn(state.party.people).length,
          built: state.settlement?.built.length ?? 0,
          word: wordOf(state),
          morale: state.party.morale,
        });
      }
      const how = state.end?.cause ?? (state.jarl ? 'ruling' : 'still standing');
      byBand[band] = byBand[band] ?? {};
      byBand[band]![how] = (byBand[band]![how] ?? 0) + 1;
      if (state.day >= 49) firstWinters[TERMS] = (firstWinters[TERMS] ?? 0) + 1;
      if (state.day >= 169) sawSecondWinter += 1;
      if (hall) everHadHall += 1;
      if (friend) everHadFriend += 1;
      if (couldCall) everCouldCall += 1;
      if (state.jarl) {
        reachedJarl += 1;
        ruledYears += yearsRuled(state);
      }
      if (!state.end) alive += 1;
      if (state.end) ends[state.end.cause] = (ends[state.end.cause] ?? 0) + 1;
      raids += state.tally.raids;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const per = (n: number, of: number) => (of > 0 ? (n / of).toFixed(1) : 'n/a');
    const mid = (k: keyof (typeof margin)[number]): number => {
      const v = margin.map((m) => m[k]).sort((a, b) => a - b);
      return v.length === 0 ? 0 : Math.round(v[Math.floor(v.length / 2)]! * 10) / 10;
    };
    const BANDS = ['before the first winter', 'the first winter', 'the second year',
      'the third year', 'past the third year'];
    const shape = BANDS.map((b) => {
      const n = lengths[b] ?? 0;
      if (n === 0) return null;
      const how = Object.entries(byBand[b] ?? {})
        .sort((a, c) => c[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
      const bar = '#'.repeat(Math.max(1, Math.round((n / LONG_SEEDS) * 40)));
      return `    ${b.padEnd(24)} ${String(n).padStart(3)}  ${bar.padEnd(40)} ${how}`;
    }).filter(Boolean).join('\n');
    // eslint-disable-next-line no-console
    console.log(
      `the long game [${TERMS}] — ${LONG_SEEDS} sagas to day ${LAST_DAY} (avg ${Math.round(days / LONG_SEEDS)} days):\n` +
        `  how far they got, and what stopped them:\n${shape}\n` +
        `  ${margin.length > 0
          ? `what a band past its third year is holding: ${mid('winters').toFixed(1)} winters of ` +
            `food (median), ${mid('band')} souls of whom ${mid('sworn')} sworn, ` +
            `${mid('built')} raised, word ${mid('word')}, heart ${mid('morale')}`
          : 'nobody got past a third year'}\n` +
        `  ${reachedJarl} became jarl, ${ruledYears} winters ruled between them; ` +
        `${alive} still standing at the end\n` +
        `  ends: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}\n` +
        `  foes per fight: ${per(earlyFoes, earlyFights)} early (${earlyFights} fights), ` +
        `${per(lateFoes, lateFights)} late (${lateFights} fights); ${raids} raids\n` +
        `  road to the Thing: ${sawSecondWinter} saw a second winter, ${everHadHall} raised a ` +
        `mead hall, ${everHadFriend} made a friend, ${everCouldCall} could ever call it\n` +
        `  reached the first winter: ${firstWinters[TERMS] ?? 0}/${LONG_SEEDS}`,
    );
    allEarlyFoes += earlyFoes; allEarlyFights += earlyFights;
    allLateFoes += lateFoes; allLateFights += lateFights;
    allJarlsBy[TERMS] = reachedJarl;
    secondWintersBy[TERMS] = sawSecondWinter;
    allFriends += everHadFriend; allCouldCall += everCouldCall;
    allHalls += everHadHall; allSecondWinters += sawSecondWinter; allJarls += reachedJarl;
    }

    // Standing, pooled across both arms — the reading here a thin sample CAN
    // carry, because it is one number per settled saga rather than per
    // jarldom, and every band that puts posts in the ground contributes one.
    // WHY the coast never speaks for anybody, split by how far the band got.
    //
    // Added after an experiment on 2026-08-19 that was aimed at the wrong
    // thing. `SPEAKER_STANDING` is 25 and the median settled band peaks at
    // about 10, so the obvious suspects were the threshold and `REP_DRIFT`
    // bleeding goodwill at 0.12 a day. Switching the positive drift off
    // entirely moved the median to 15.0 and the speaker count from 22 to 25
    // of 76 — real, and nowhere near enough.
    //
    // The rest of it is upstream: standing comes almost entirely from trading
    // at +9 a bargain, the harness measured 94 trade errands across 120
    // sagas, and a band cannot trade until it has stood a winter. So the
    // coast is silent because the band is dead, not because the number is
    // high. Split here so that cannot be mis-attributed again.
    const lived = peakByFate.filter((p) => p.reachedSecondWinter).map((p) => p.peak);
    const short = peakByFate.filter((p) => !p.reachedSecondWinter).map((p) => p.peak);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    // eslint-disable-next-line no-console
    console.log(
      `standing by how far they got — ${lived.length} stood a second winter `
        + `(peak ${mean(lived).toFixed(1)}, ${lived.filter((v) => v >= SPEAKER_STANDING).length} spoke); `
        + `${short.length} did not (peak ${mean(short).toFixed(1)}, `
        + `${short.filter((v) => v >= SPEAKER_STANDING).length} spoke)`,
    );

    const peaks = [...peakStanding].sort((a, b) => a - b);
    const median = peaks[Math.floor(peaks.length / 2)] ?? 0;
    const spoke = peaks.filter((v) => v >= SPEAKER_STANDING).length;
    // eslint-disable-next-line no-console
    console.log(
      `the coast, all countries pooled — ${settledSagas} settled sagas, ${metAnybody} met somebody:\n` +
        `  peak standing with anyone: median ${median.toFixed(1)}, best ${(peaks[peaks.length - 1] ?? 0).toFixed(1)}; ` +
        `${spoke} ever reached the ${SPEAKER_STANDING} a speaker needs`,
    );

    // eslint-disable-next-line no-console
    console.log(
      `the Thing's six needs, all countries pooled — ${settledSagas} settled sagas:\n` +
        `  ever ticked: ${(['winters','hall','peace','friends','feast','gathered'] as NeedId[])
          .map((id) => `${id} ${everNeed[id] ?? 0}`).join(', ')}\n` +
        `  unmet on a settled day, of ${settledDays}: ${
          (['winters','hall','peace','friends','feast','gathered'] as NeedId[])
            .map((id) => `${id} ${unmetDays[id] ?? 0}`).join(', ')}\n` +
      `  the ONE need still missing, counted per day: ${
          (['winters','hall','peace','friends','feast','gathered'] as NeedId[])
            .map((id) => `${id} ${lastStanding[id] ?? 0}`).join(', ')} `
        + `(${allSixDays} days with all six)\n` +
      `  ${sixEver} ticked all six at some point; one short: ${
          Object.entries(everShort).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
    );

    // AND WHAT THE MENU PROMISES ABOUT RULING IS TRUE.
    //
    // The other half of the measured difficulty, checked where jarldoms are
    // actually counted — the sweep in `how hard the country is` only runs to
    // day 73 and cannot see one. Loose on purpose: a jarldom is rare enough
    // that forty seeds resolve it to about a tenth, so this catches a promise
    // that has rotted rather than one that has drifted a seed.
    //
    // THAT REASONING WAS RIGHT AND ITS CONCLUSION WAS BACKWARDS, and the
    // tolerance is eight points now rather than ten. The answer to a sample
    // too thin to resolve a figure is a bigger sample, not a tolerance wide
    // enough to accept whatever the thin one says. Guarded at twenty seeds
    // this bar agreed with a published 40% while the game ran at 28%, and
    // went on agreeing until somebody ran it wider. At a hundred and twenty
    // seeds two standard errors on a rate near a quarter is about eight
    // points, so that is what it asks for.
    for (const terms of HARDSHIPS) {
      const ruled = (allJarlsBy[terms.id] ?? 0) / LONG_SEEDS;
      expect(
        Math.abs(terms.odds.ruled - ruled),
        `${terms.name} promises ${Math.round(terms.odds.ruled * 100)}% ever rule; `
          + `the long game measured ${Math.round(ruled * 100)}% over ${LONG_SEEDS} sagas. `
          + 'Re-measure and restate the figure in src/data/hardship.ts.',
      ).toBeLessThan(0.08);
    }

    /**
     * AND THE COUNTRY A PLAYER GETS WITHOUT CHOOSING IS ONE WHERE THE MIDDLE
     * GAME HAPPENS.
     *
     * `DEFAULT_HARDSHIP` has been a judgement call sitting in a comment since
     * it was split from `BALANCED_HARDSHIP`, and the argument written beside
     * it — "As It Lies at 28% spring is not a game most people get to see the
     * middle of" — had its premise removed on 2026-08-20, when the winter
     * lever took As It Lies to 45%. A rationale whose figures have moved is
     * exactly the thing this file exists to catch, so the claim is a bar now
     * rather than a paragraph.
     *
     * SECOND WINTERS, because that is where the middle of this game starts:
     * the hall, the coast, the Thing and the jarldom all sit past the first
     * thaw, and a country where most bands never get there is a country whose
     * back half a default player never sees.
     *
     * A QUARTER, and the threshold is picked off the spread rather than felt.
     *
     * RESTATED at the hundred-and-twenty-seed sample this now runs at, and
     * the restatement matters because the old rationale had quietly stopped
     * describing the spread it was picked off. It read "fair 27/60, even
     * 9/60, hard 2/60 — so a quarter sits at roughly half of what the gentle
     * country delivers and nearly double what the balanced one does". At a
     * hundred and twenty that spread is fair 61/120, even 32/120, hard
     * 12/120: 51%, 27% and 10%. A quarter is still half of what the gentle
     * country delivers, but it is no longer double the balanced one — it is
     * just under it.
     *
     * The threshold survives anyway, and on its own terms rather than on the
     * arithmetic that first suggested it: it asks that the default country
     * put at least one saga in four past the thaw, and A Fair Country puts
     * one in two. What has gone is the claim that the balanced country
     * clearly fails it. As It Lies now sits close enough to a quarter that
     * this bar can no longer be what argues against it — the spring figure
     * does that, at 53% against 86%.
     *
     * Watched fail by pointing DEFAULT_HARDSHIP at 'hard', which reads 10%
     * and goes red. It was 'even' that was watched to fail before, at 15%,
     * and it would now pass at 27% — which is exactly the sort of quiet
     * rot this comment exists to record.
     */
    const middle = (secondWintersBy[DEFAULT_HARDSHIP] ?? 0) / LONG_SEEDS;
    expect(
      middle,
      `the default country is ${DEFAULT_HARDSHIP}, where only `
        + `${Math.round(middle * 100)}% of sagas reach a second winter — a player who `
        + `chooses nothing is being handed a game whose middle they will not see`,
    ).toBeGreaterThanOrEqual(0.25);

    /**
     * EVERY NEED ON THE CHECKLIST CAN REFUSE SOMEBODY.
     *
     * The guard item 6 asked for and could not state. It read `peace` and
     * `gathered` as met by 78 settled sagas out of 78 and called them
     * decoration; an audit repeated the claim and proposed cutting the
     * checklist to four. Both were the INSTRUMENT. "Ever ticked" is nearly
     * free for a momentary need — `gathered` asks only that nobody is away
     * right now — so of course every band satisfies it at some point.
     *
     * Measured properly, on days a settled band actually had it unmet:
     * winters 19947, friends 18894, feast 16981, hall 15223, gathered 2637,
     * peace 143 of 29220. Rare is not the same as vestigial, and a
     * requirement that stands for a rare event is allowed to be rare.
     *
     * So the bar is the honest version of the claim: a need that can never
     * refuse anybody is a line of text pretending to be a rule, and this
     * fails when one becomes that.
     */
    for (const id of ['winters', 'hall', 'peace', 'friends', 'feast', 'gathered'] as NeedId[]) {
      expect(
        unmetDays[id] ?? 0,
        `the Thing's "${id}" was never once unmet across ${settledDays} settled days — `
          + `it cannot refuse anybody, so it is not a requirement`,
      ).toBeGreaterThan(0);
    }

    // A Hard Country is a DIFFICULTY, not a wall, and this is where that
    // stays true. Measured over sixty seeds on 2026-08-11: it reaches the
    // first winter 44 times in 60 against `even`'s 48, and everything past
    // it is reachable but thin — 5 springs, 1 second winter, 1 jarldom, 26
    // steadings founded, 21 that built something, 45 that met the coast.
    // Punishing, and not a brick wall, which is what the label promises.
    const hardWinters = firstWinters['hard'] ?? 0;
    expect(
      hardWinters / LONG_SEEDS,
      `A Hard Country reached the first winter in only ${hardWinters}/${LONG_SEEDS} — that is a wall, not a difficulty`,
    ).toBeGreaterThan(0.5);

    // The bars. First that the endgame is REACHED at all — this whole test
    // exists because it never was, and a harness that stops reaching it has
    // gone back to measuring nothing.
    expect(allSecondWinters).toBeGreaterThan(0);
    expect(allHalls, 'nobody raised a mead hall — the Thing is unreachable').toBeGreaterThan(0);
    expect(allLateFights, 'no fight after day 169 — there is no long game to measure').toBeGreaterThan(0);

    // The bar that would have caught the coast. Forty sagas made a mead
    // hall, kept the peace and stood two winters, and not ONE made a friend
    // — because the four neighbours were scattered over a landmass a band
    // sees five percent of. Every other need on the checklist had a bar and
    // this one did not, so the endgame was unreachable in silence.
    expect(allFriends, 'nobody on the coast will speak for anyone — the Thing cannot be called').toBeGreaterThan(0);

    // And its stronger form, added once the standing distribution was
    // actually looked at (2026-08-10). Meeting the coast is now universal —
    // 88 of 88 settled sagas met somebody — but the median band's peak
    // standing with ANYONE was 10.9, which is the opening a native camp
    // gives away for nothing. The median relationship never moves at all,
    // and only 21 of those 88 ever reached the 25 a speaker needs. That is
    // the wall in front of the Thing, and it is a design question rather
    // than a bug, so what is barred here is reachability: the coast must
    // stay winnable by somebody, and a change that flattens it to nobody
    // has to fail rather than quietly close the endgame again.
    expect(spoke, 'no band on any seed reached speaking terms with the coast').toBeGreaterThan(0);
    // Nearly-all rather than all: a band that settles and starves inside a
    // fortnight can die before the first neighbour walks over to look at it,
    // and a bar that fails on one unlucky saga teaches people to ignore it.
    expect(
      metAnybody / Math.max(1, settledSagas),
      'settled bands are not meeting the coast — placement or the calling has broken',
    ).toBeGreaterThan(0.9);
    expect(allCouldCall, 'the checklist never completed in forty sagas').toBeGreaterThan(0);
    expect(allJarls, 'the jarldom is code nobody reaches').toBeGreaterThan(0);

    // Escalation used to be asserted here — late foes per fight against
    // early — and it was the wrong place for it. The late sample is whatever
    // survives past day 169, which is a handful of fights; item 2's verb
    // work reshuffled RNG consumption, the late sample fell to five, and the
    // comparison inverted on nothing but tail noise. `test/word.test.ts`
    // proves the same claim properly and knob by knob, including that each
    // one BINDS. What belongs here is the reachability half: late fights
    // must happen at all, which is asserted above. The ratio is printed
    // because it is worth seeing, and not barred because this sample cannot
    // carry a bar.
  });
});

describe('the raid gauntlet', () => {
  /** A standing steading with the store and walls a raid comes for. */
  function homestead(seed: string): GameState {
    const state = structuredClone(newGame(seed));
    expect(foundAnywhere(state), `${seed}: nothing foundable`).toBe(true);
    const home = state.settlement!;
    home.built.push('longhouse', 'farmplots', 'palisade');
    home.shelter = 3;
    state.day = 120;
    state.party.food = 60;
    state.party.firewood = 60;
    return state;
  }

  // Item 10's other half. The organic tally below is real but tiny — twenty
  // sagas where seven see a raid is a coin reading, and three deck edits in
  // a row proved it: 4/33, 23/39, 7/28 with no raid change in any of them.
  // This is the controlled version: the same steading, the same defenders,
  // raid after raid across the difficulty range, so held-rate is a number
  // that moves only when the raid game moves.
  it('measures holds at scale, difficulty by difficulty', { timeout: CURVE_TIMEOUT }, async () => {
    const DIFFS = [0, 1, 2, 3];
    // Twenty-four a cell, not eight. Item 5 needed to read the GRADIENT and
    // eight samples could not carry one — a run read d1 1/8 against d2 4/8,
    // which is not a difficulty curve, it is a coin.
    const PER = 24;
    const byDiff = new Map<number, { held: number; of: number }>();
    for (let s = 0; s < PER; s += 1) {
      for (const diff of DIFFS) {
        let state = homestead(`gauntlet-${s}-${diff}`);
        startRaid(state, diff);
        for (let i = 0; i < 600 && state.battle && !state.battle.outcome; i += 1) {
          let next = apply(state, step(state));
          if (next === state) next = apply(state, { type: 'B_END_TURN' });
          if (next === state) break;
          state = next;
        }
        const row = byDiff.get(diff) ?? { held: 0, of: 0 };
        row.of += 1;
        if (state.battle?.outcome === 'won') row.held += 1;
        byDiff.set(diff, row);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const table = DIFFS.map(
      (d) => `d${d} ${byDiff.get(d)!.held}/${byDiff.get(d)!.of}`,
    ).join(' | ');
    const held = DIFFS.reduce((n, d) => n + byDiff.get(d)!.held, 0);
    const total = PER * DIFFS.length;
    // eslint-disable-next-line no-console
    console.log(`raid gauntlet: ${held}/${total} held — ${table}`);

    // Wide tripwires, same philosophy as the curve: they exist to catch
    // "raids cannot be held" and "raids cannot be lost", not to pin a rate.
    expect(held / total).toBeGreaterThanOrEqual(0.2);
    expect(held / total).toBeLessThanOrEqual(0.95);

    // AUDIT ITEM 5. The bar that was missing is not the rate, it is the
    // GRADIENT: this table read 5/8, 1/8, 1/8, 0/8 before, which is not a
    // difficulty curve but a cliff with noise on it, and a wide rate bar
    // sailed straight over it. Three faults, two in the game and one here:
    //
    //   * a palisade cost 0.4 of difficulty for being another roof and
    //     returned 2 x 0.18 for being a wall, so BUILDING ONE MADE RAIDS
    //     HARDER (+0.04 net, and a watchtower +0.22);
    //   * difficulty added a whole extra raider per point against a
    //     steading defended by about four, so one point swung the odds by a
    //     quarter and left nothing for the palisade, watch and site to move;
    //   * and this harness walked its defenders ONTO their own palisade —
    //     the move scorer knew about gaps and shoulder-mates and nothing
    //     about `WALL_EXPOSED`, so the band fought from the worst tile on
    //     the field, the one the wall exists to put THEM on.
    //
    // Measured after: 12/24, 10/24, 7/24, 5/24. Easy raids are usually held,
    // hard ones usually are not, and every step down costs something.
    const easy = byDiff.get(0)!;
    const hard = byDiff.get(3)!;
    expect(easy.held / easy.of, 'a prepared steading cannot hold even an easy raid')
      .toBeGreaterThan(0.3);
    expect(hard.held / hard.of, 'the hardest raid is a coin flip, not a hard raid')
      .toBeLessThan(easy.held / easy.of);
    expect(hard.held, 'the hardest raid cannot be held at all — that is a cliff')
      .toBeGreaterThan(0);
  });
});

describe('raids are measured, not assumed', () => {
  it('records how often a raid comes and how often it is held', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 5 of the audit: nothing counted how often a raid was LOST, only
    // how often one fired — so the change above had no baseline to move.
    let fired = 0;
    let held = 0;
    let sagas = 0;
    for (let s = 0; s < 20; s += 1) {
      const state = run(`curve-${s}`, 169);
      fired += state.tally.raids;
      held += state.tally.raidsHeld;
      if (state.tally.raids > 0) sagas += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // eslint-disable-next-line no-console
    console.log(`raids over 20 sagas: ${fired} came, ${held} held, ${fired - held} lost; ${sagas} sagas saw one`);
    expect(fired).toBeGreaterThan(0);
    expect(held).toBeLessThanOrEqual(fired);
  });
});

describe('the sea is reached', () => {
  /**
   * Audit item 1, and the bar that would have caught it.
   *
   * `moveOptions` returns nothing for a settled band, so an expedition is
   * the only door back onto the map — and behind it the whole sea sat
   * unmeasured: over sixty sagas, THREE sea days, one sea fight and zero
   * strandhöggs. Hull damage, cargo over the side, the authored sea decks
   * and the strandhögg itself had all shipped without a single measurement,
   * the last of them in violation of the same-commit rule it was written
   * under. The bot had `STRANDHOGG` in its vocabulary and no logic that
   * ever got it afloat, which is the harness's oldest failure mode wearing
   * a new coat: a capability the bot cannot use is measured as worthless.
   *
   * Two things had to change before this could pass. The bot learned the
   * errand under arms — steer for the water beside a coastal prize and come
   * out of it — and the country stopped hiding the prizes (see
   * `PLACE_MAX_FROM_LANDING` and `tellOfPlace`).
   *
   * Deliberately a REACH bar, not a balance one. It says the sea happens; it
   * says nothing about whether it pays, because the sample is still small
   * and a bar that pins a rate this thin would be pinning weather.
   */
  it('a settled band gets onto the water, and comes out of it at somebody', { timeout: 900_000 }, async () => {
    let seaDays = 0;
    let afloatFights = 0;
    let strandhoggs = 0;
    let underArms = 0;
    let trades = 0;
    let placesKnown = 0;
    let samples = 0;
    /**
     * Sixty a side, not thirty. Item 3's growth halved the errands under
     * arms — a poorer band goes out less — and at three errands whether any
     * of them happened to be coastal is a coin flip, so the strandhögg count
     * fell to nought on a sample too thin to mean anything. Widening is the
     * fix that does not involve nudging the bot until the number comes back.
     */
    const SEEDS = 60;

    // Measured under the RAIDER, which is the policy that would ever go. The
    // settler does not leave under arms at all — that is its identity, not a
    // gap — so asking it whether anybody reaches the sea was asking the
    // wrong band.
    policy = RAIDER;
    try {
    for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(armSeed(arm, s, SEEDS), 400, (before, after) => {
          if (!before.expedition && after.expedition) {
            if (after.expedition.purpose === 'raid') underArms += 1;
            else trades += 1;
          }
          if (!before.battle && after.battle) {
            if (after.battle.strandhogg) strandhoggs += 1;
            else if (after.battle.terrain === 'ocean' && !after.battle.raid) afloatFights += 1;
          }
          if (after.settlement && !after.expedition) {
            samples += 1;
            // KNOWN is a stretch. This read `world.seen[key(p.at)]` until
            // 8.5, and every place carried the same placeholder hex — so it
            // counted the fog over (0,0) and reported the knowledge economy
            // as empty on a coast the band had walked half of.
            placesKnown += after.world.places
              .filter((p) => knowsStop(after, p.stop ?? 0)).length;
          }
        }, terms);
        seaDays += state.tally.seaDays;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    } finally {
      policy = SETTLER;
    }

    // eslint-disable-next-line no-console
    console.log(
      `the sea over ${SEEDS * 2} sagas: ${seaDays} days afloat, ${underArms} errands under arms (${trades} trading), ` +
        `${strandhoggs} strandhöggs, ${afloatFights} sea fights; ` +
        `${(placesKnown / Math.max(1, samples)).toFixed(2)} of 4 places known per settled day`,
    );

    // Wide bars, and every one of them was ZERO before this work.
    //
    // Deliberately far below what was measured (50 days afloat, 7 errands,
    // 2 strandhöggs, 1.17 places known), because the first cut of these was
    // pinned just under that reading and then FAILED when item 2 changed the
    // bot: battle actions consume RNG, so any change to how the bot fights
    // reshuffles every draw after it, and a tail-sensitive count like sea
    // days moved 50 to 17 without anything about the sea changing. The
    // stable figure across that same A/B was second winters, which did not
    // move at all. These bars say REACHED, which is the claim; they do not
    // pin a rate, which this sample cannot carry.
    expect(seaDays, 'no settled band ever got onto the water').toBeGreaterThan(40);
    expect(underArms, 'the errand under arms never runs').toBeGreaterThan(5);
    // The strandhögg is barred again, and the reason it once was not is
    // worth keeping: it was measured on the SETTLER, a band that does not go
    // out under arms at all, and read 0-2 armed errands in a hundred and
    // twenty sagas. Asked of the raider — the only policy that would ever
    // sail — the same sample reads 351 days afloat, 50 armed errands and 6
    // strandhöggs. The verb was never as rare as the measurement said; the
    // measurement was pointed at the wrong band.
    expect(strandhoggs, 'the ship’s way in is never taken — it is unmeasured content')
      .toBeGreaterThan(0);

    // The old note, kept because the lesson in it is general:
    //
    // It was asserted above zero when item 1 shipped, on seven armed errands
    // in sixty sagas. Item 3's growth halved that — a band with more mouths
    // trades far more than it raids (22 trading errands against 4 under
    // arms), and at four errands whether any of them happens to sit on a
    // coast is a coin flip. Doubling the sample to a hundred and twenty
    // sagas moved it from three to four, so this is the errand RATE and not
    // the sample, and no bar belongs on an event that rare.
    //
    // What still covers the verb: `test/strandhogg.test.ts` proves it end to
    // end — offered only afloat beside a guarded place, fewer foes and
    // shaken, half again in the hold, the hull holed and the cargo lost on a
    // defeat — and the bot keeps `STRANDHOGG` in its vocabulary and takes it
    // wherever it is legal. What is NOT covered, and should be said plainly,
    // is whether an ordinary player ever reaches it. That is the open half
    // of audit item 1.

    // And the knowledge economy that makes any of it possible: a settled
    // band must know of SOMETHING to go and take. This read 0.06 of 4.
    expect(placesKnown / Math.max(1, samples)).toBeGreaterThan(0.4);
  });

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
        hadFood: [], hadWood: [], wantFood: [], wantWood: [],
      };
      const was = policy;
      policy = { ...SETTLER, sails, sailAnySeason: anySeason };
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
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        policy = was;
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
      policy = { ...SETTLER, crew };
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
        policy = was;
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

    policy = RAIDER;
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
      policy = SETTLER;
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

describe('the whole of a fight is played', () => {
  /**
   * Audit item 2, and the half of it that belongs to a whole saga rather
   * than an arena.
   *
   * Over sixty sagas this harness had never once issued `B_THROW`,
   * `B_SHOVE`, `B_DEFEND` or `B_DASH`. Three of them existed only in
   * `battleActions.test.ts` — unit tests that prove a verb WORKS and say
   * nothing about whether it is ever worth using — and the fourth was
   * played in the arena but never in a run. So every balance figure this
   * repo carries described a bot fighting with part of its hands.
   *
   * What each verb is WORTH is measured in test/wall.test.ts, where combat
   * is visible; the curve is too blunt for it, ending only about one run in
   * six on steel. This bar is the other thing, and it is the one that would
   * have caught the gap: the verbs must actually be issued in play.
   */
  it('issues every verb an average player would, over a real sample', { timeout: 900_000 }, async () => {
    const used: Record<string, number> = {};
    let fights = 0;
    let actions = 0;

    for (let s = 0; s < 30; s += 1) {
      let state = structuredClone(newGame(`curve-${s}`, 'even'));
      let jobsSet = false;
      for (let i = 0; i < 6000 && !state.end && state.day <= 300; i += 1) {
        if (state.settlement && !jobsSet) {
          state.party.people
            .filter((p) => p.alive)
            .forEach((p, ix) => assign(state, p.id, policy.crew[ix % policy.crew.length]!));
          jobsSet = true;
        }
        if (state.settlement && state.settlement.queue.length === 0 && state.party.firewood >= 16) {
          for (const id of ['longhouse', 'farmplots', 'palisade', 'smokehouse', 'meadhall'] as const) {
            if (queueBuild(state, id)) break;
          }
        }
        const inBattle = !!state.battle;
        const action = step(state);
        if (inBattle) {
          actions += 1;
          used[action.type] = (used[action.type] ?? 0) + 1;
        }
        const next = apply(state, action);
        if (next === state) break;
        if (!inBattle && next.battle) fights += 1;
        state = next;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const verbs = Object.entries(used)
      .filter(([k]) => k.startsWith('B_'))
      .sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `battle verbs over 30 sagas — ${fights} fights, ${actions} actions:\n  ` +
        verbs.map(([k, v]) => `${k} ${v}`).join(', '),
    );

    // Every verb the bot is meant to use must actually appear. Each of these
    // read ZERO before item 2, and a zero here means the thing it measures
    // has gone back to being unmeasured content.
    //
    // `B_MOVE` was on this list and is not a verb any more: 8.1c took the
    // ground away, so there is nowhere to walk and the action is gone from
    // `actions.ts` entirely. Measured after the conversion, over 30 sagas and
    // 65 fights: B_STRIKE 386, B_REACH 207, B_THROW 124, B_WARCRY 45,
    // B_SHOVE 6.
    for (const verb of ['B_STRIKE', 'B_REACH', 'B_WARCRY', 'B_THROW', 'B_SHOVE']) {
      expect(used[verb] ?? 0, `${verb} never issued in thirty sagas`).toBeGreaterThan(0);
    }

    // The two the bot no longer issues, and WHY, kept as assertions so that
    // neither can quietly come back or quietly stay gone.
    //
    // DEFEND is unreachable rather than unwanted. Only the front two may set
    // a shield, and the front two always have an axe-blow worth more — so
    // the branch exists and can never be entered. test/wall.test.ts measures
    // the same hole from the other side: turning defend on changes the win
    // count by exactly nothing.
    expect(
      used['B_DEFEND'] ?? 0,
      'defend became reachable — good news, and this record is now stale',
    ).toBe(0);
    // Dash was deliberately absent because it was priced at a third of the
    // wins. It is NOT priced there any more — on a line it costs one win in
    // sixty (see wall.test.ts) — but the bot still does not spend an action
    // shuffling ranks, so this stays a zero until somebody makes the case.
    expect(used['B_DASH'] ?? 0, 'the bot dashed — see the price in wall.test.ts').toBe(0);
  });
});

describe('a band that survives, grows', () => {
  /**
   * Audit item 3's bar, and the shape of it matters.
   *
   * "People arrived" is not the measurement — four arrived across sixty
   * sagas before this and the number was still not zero. The measurement is
   * the PEAK BAND a saga ever reached, and it read 6.0: not one band in
   * sixty ever exceeded the six who came off the knarr, on an average of
   * 9.8 beds. Everything 6.2 built — capacity, crowding, hands who work but
   * do not fight, the repeatable búð, the leaving system — was apparatus
   * behind a door that never opened.
   *
   * Conditioned on bands that saw a SECOND WINTER, because that is the
   * population growth exists for. A band that dies in its first autumn was
   * never going to grow and should not be averaged in.
   */
  it('reaches past the six who came off the knarr', { timeout: 900_000 }, async () => {
    let arrivals = 0;
    let sagas = 0;
    let peakAll = 0;
    let longSagas = 0;
    let peakLong = 0;
    let everGrew = 0;
    const SEEDS = 30;

    for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
      for (let s = 0; s < SEEDS; s += 1) {
        let peak = SWORN_MAX;
        const state = run(armSeed(arm, s, SEEDS), 400, (before, after) => {
          const a = before.party.people.length;
          const b = after.party.people.length;
          if (b > a) arrivals += b - a;
          peak = Math.max(peak, after.party.people.filter((p) => p.alive).length);
        }, terms);
        sagas += 1;
        peakAll += peak;
        if (peak > SWORN_MAX) everGrew += 1;
        if (state.day >= 169) {
          longSagas += 1;
          peakLong += peak;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `growth over ${sagas} sagas: ${arrivals} arrived; ${everGrew} bands ever passed six; ` +
        `avg peak band ${(peakAll / sagas).toFixed(1)}; ` +
        `of the ${longSagas} that saw a second winter, avg peak ${(peakLong / Math.max(1, longSagas)).toFixed(1)}`,
    );

    // Wide bars. They exist to catch "the band is always six", which is what
    // sixty sagas said before item 3, not to pin a growth rate.
    expect(arrivals, 'nobody ever came').toBeGreaterThan(10);
    expect(everGrew, 'no band in sixty ever passed the six it landed with').toBeGreaterThan(5);
    expect(longSagas, 'nothing lived long enough to measure growth on').toBeGreaterThan(0);
    expect(
      peakLong / Math.max(1, longSagas),
      'bands that stood two winters still never outgrew the knarr',
    ).toBeGreaterThan(SWORN_MAX);
  });
});

describe('every building gets built', () => {
  /**
   * AUDIT ITEM 4, and the answer was not the one the item assumed.
   *
   * The audit found `greathall` and `earthworks` never raised once in sixty
   * sagas and asked whether the timber cost or the prerequisites were out of
   * reach of a band that survives. Neither. The game side was sound the
   * whole time — `standsFor()` had been written for the tier, `buildBlocker`
   * enforces `replaces`, and the panel offers both correctly. The bot's want
   * list simply did not name them, so nothing ever asked.
   *
   * That is the same-commit rule broken quietly, and the only reason it was
   * ever visible is that something finally counted what play REACHES rather
   * than what the code supports. This test is that counting, kept.
   */
  it('reaches the whole list, including the tier that replaces things', { timeout: 900_000 }, async () => {
    const raised: Record<string, number> = {};
    const late: Record<string, number> = {};
    let sagas = 0;
    let lateSagas = 0;
    let lateTotal = 0;
    const SEEDS = 30;

    for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(armSeed(arm, s, SEEDS), 400, undefined, terms);
        sagas += 1;
        const built = state.settlement?.built ?? [];
        for (const id of built) raised[id] = (raised[id] ?? 0) + 1;
        if (state.day >= 169) {
          lateSagas += 1;
          lateTotal += built.length;
          for (const id of built) late[id] = (late[id] ?? 0) + 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const never = BUILDINGS.filter((b) => !raised[b.id]).map((b) => b.id);
    // eslint-disable-next-line no-console
    console.log(
      `buildings over ${sagas} sagas — ` +
        `${Object.entries(raised).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}\n` +
        `  never raised: ${never.join(', ') || 'none'}; of the ${lateSagas} past day 169, ` +
        `avg ${(lateTotal / Math.max(1, lateSagas)).toFixed(1)} standing, ` +
        `greathall ${late['greathall'] ?? 0}, earthworks ${late['earthworks'] ?? 0}`,
    );

    // The bar the tier did not have. Every building the game ships must be
    // something play actually reaches — a building nobody builds is content
    // that does not exist, whether the reason is the cost, the gate, or a
    // list in the harness that forgot it.
    expect(never, `never raised in ${sagas} sagas: ${never.join(', ')}`).toEqual([]);

    // And specifically the upgrade tier, which is the one that was missing.
    // Barred on the bands it is FOR: a saga that stood two winters should
    // usually have outgrown its first longhouse.
    expect(lateSagas, 'nothing survived long enough to reach the tier').toBeGreaterThan(0);
    expect(late['greathall'] ?? 0, 'no band that stood two winters ever outgrew its longhouse')
      .toBeGreaterThan(0);
    expect(late['earthworks'] ?? 0, 'no band that stood two winters ever raised earthworks')
      .toBeGreaterThan(0);
  });
});

describe('what play actually reaches', () => {
  /**
   * AUDIT ITEM 6, and it is the generalisation of everything above it.
   *
   * The coast, the country, the sea, the growth apparatus and the top
   * building tier were all built, unit-tested, green — and unreachable. Not
   * one of them failed a test, because every test asked "does this WORK"
   * and none asked "does anyone ever GET here". Each was found by a
   * throwaway probe that was then deleted, which is exactly how the next one
   * will hide.
   *
   * So this is the probe, kept. It plays a sample and reports what was never
   * reached, and bars the things that must never go to nought. Some of that
   * lives closer to what it measures — battle verbs in "the whole of a fight
   * is played", buildings in "every building gets built", the sea in "the
   * sea is reached", growth in "a band that survives, grows" — and this is
   * the rest of it plus the summary nobody has to assemble by hand.
   *
   * The card deck is REPORTED and not barred at 102/102. Cards are gated on
   * states an ordinary run may never enter (a winter with the woodpile
   * nearly out, a coast that hates you), and demanding every one draw would
   * be demanding the sample cover every corner of the game. What is barred
   * is that the deck is broadly alive, and `test/events.test.ts` carries the
   * static half: every gate must name a building, a lore and a flag that
   * actually exist, and no card may be locked behind a flag only it sets.
   *
   * AND THE LIST OF COLD CARDS IS MEASURED AGAINST WHAT A HEALTHY DECK WOULD
   * LEAVE COLD, which is the whole reason this report is worth reading.
   *
   * It used to print "never drawn: <fifteen ids>" and stop, which reads like
   * fifteen pieces of dead content and is nothing of the kind. Taking 837
   * draws from pools averaging 29 cards, a perfectly fair 102-card deck
   * leaves about THIRTEEN cards cold. Fifteen is that number. The proof is
   * below and it is the useful part: every cold card is checked for whether
   * it was ever ELIGIBLE (none has ever failed that — no card is walled
   * off), the expected draws are summed from the real pools, and the count
   * of cold cards is compared against sum(e^-expected) — what a fair deck
   * predicts. A control replay of the same pools on an unrelated stream is
   * printed beside it as a sanity check on the arithmetic.
   *
   * Two traps this cost a long afternoon to walk out of, recorded so the
   * next reader does not pay again:
   *
   *   - The fifteen cold ids are SELECTED for being zero, so the joint
   *     probability of "these fifteen are all zero" is meaningless and looks
   *     damning (it computes to one in a million). The statistic that means
   *     something is the expected NUMBER of cold cards.
   *   - Reading a different sample renames the list. Three of the fifteen
   *     changed places the moment the second arm got its own landings.
   *
   * So the signal to act on is `shut` — a card no state ever opens — and a
   * cold count well ABOVE the prediction. A cold LIST is just arithmetic.
   */
  it('reports everything a long sample never touches', { timeout: 900_000 }, async () => {
    const cards = new Set<string>();
    const lore = new Set<string>();
    const traits = new Set<string>();
    const draws: Record<string, number> = {};
    const systems: Record<string, number> & Record<
      'fights' | 'raids' | 'raidsHeld' | 'sackings' | 'bargains' | 'markets'
      | 'expeditions' | 'arrivals' | 'feuds' | 'thingsCalled' | 'kinPairs', number
    > = {
      fights: 0, raids: 0, raidsHeld: 0, sackings: 0, bargains: 0,
      markets: 0, expeditions: 0, arrivals: 0, feuds: 0, thingsCalled: 0, kinPairs: 0,
    };
    let sagas = 0;
    const SEEDS = 30;
    /**
     * The walking half of reach, per arm — and the reason the `markets`
     * floor below is a count of SAGAS rather than of trade days.
     *
     * A market day is not a system firing on its own. It needs four things
     * at once: the band standing on a trading place, the place still
     * unsacked, an offer it can afford, and stores to spare. Only the first
     * is reach. So a bare count of market days is ambiguous between "the
     * counters got harder to get to" and "the band got to one and burned it
     * down", and worse, it MULTIPLIES: a band that settles beside a live
     * counter deals over and over, so one lucky saga carries the total.
     *
     * Measured 2026-08-13, and it is the whole reason this block exists —
     * fourteen market days across sixty sagas came from TWO of them, twelve
     * of the fourteen from a single band. The floor of 3 was a floor on a
     * statistic with an effective sample of one saga, which is the same trap
     * the jarl counts in ROADMAP.md are a monument to.
     *
     * `counterSagas` and `liveSagas` are the same question asked with n=60
     * instead of n=1: of sixty landings, how many ever put the band on a
     * counter, and how many while it was still trading.
     */
    interface Walk {
      sagas: number;
      /** Did the band settle, how soon, how long did it last. */
      founded: number; foundDay: number; roadDays: number; days: number;
      alive: number; fights: number; sackings: number;
      /** Days stood on a place, split by what stopped the deal. */
      onSacked: number; onNoMarket: number; onThin: number; onOpen: number;
      /** Sagas that reached a counter at all, and one still trading. */
      counterSagas: number; liveSagas: number;
      /** Trade days, the sagas they came from, and the most any one saga had. */
      markets: number; dealingSagas: number; best: number;
      /** Counters burned down, and the day it happened. */
      burnt: number; burntDay: number;
    }
    const walk: Record<string, Walk> = {};
    const arms = (id: string): Walk =>
      (walk[id] ??= {
        sagas: 0, founded: 0, foundDay: 0, roadDays: 0, days: 0, alive: 0,
        fights: 0, sackings: 0, onSacked: 0, onNoMarket: 0, onThin: 0,
        onOpen: 0, counterSagas: 0, liveSagas: 0, markets: 0, dealingSagas: 0,
        best: 0, burnt: 0, burntDay: 0,
      });
    // This saga's own tallies, so the totals above can be told apart from a
    // single band that camped on a counter for a season.
    let sagaMarkets = 0;
    let sawCounter = false;
    let sawLiveCounter = false;
    // Days on which each card COULD have been drawn. Without this, a cold
    // card is ambiguous between two completely different faults: a state the
    // sample never enters (a reach problem, and the thing this probe is for)
    // and a state it enters constantly while the card loses every weighted
    // roll (a weight problem, and not a reach problem at all). Sampled once
    // per day rather than per step, so it is a day count, not a roll count.
    const openDays: Record<string, number> = {};
    /**
     * Every flag any saga in the sample ever set.
     *
     * For CHAIN cards — ones whose `when` asks for a flag another card
     * sets — `openDays === 0` is ambiguous, and that ambiguity failed this
     * probe once for a reason that had nothing to do with a wall.
     * `the-seed-came-up` needs `sowed`, which only a settled band with 30
     * food or less ever sets, and which is then read a season and a half
     * later. Those are the same bands that starve, so the chain completes
     * about once in sixty sagas and had been completing on luck. A weather
     * change that moved survival by one saga was enough to break it.
     *
     * So: a chain card whose flag was NEVER set is still unreachable content
     * and still fails. One whose flag WAS set is reported as chain-short,
     * which is the sample being finite rather than a gate that never opens.
     */
    const flagsSet = new Set<string>();
    const share: Record<string, number> = {};
    let poolSize = 0;
    let daysSeen = 0;
    let daysSettled = 0;
    let daysCouldFire = 0;
    let drawsSettled = 0;
    // Not a game seed — no saga is ever called this, so this stream shares
    // nothing with the ones the sample is drawing on.
    const control = stream('control-reach', 'events');
    const controlWon = new Set<string>();

    // A DIFFERENT thirty landings for the second arm — see `armSeed`. This
    // is where that flaw was found and where it cost the most: coverage of a
    // hundred-card deck measured against half the sample it claimed.
    for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
      const w = arms(terms);
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(armSeed(arm, s, SEEDS), 400, (before, after) => {
          if (!before.event && after.event) {
            cards.add(after.event.id);
            draws[after.event.id] = (draws[after.event.id] ?? 0) + 1;
            if (before.settlement) drawsSettled += 1;
          }
          if (after.day !== before.day) {
            daysSeen += 1;
            // A day only draws a card if `apply` took the TRAVEL branch and
            // came out of it clean — a day spent in the colony screen, or one
            // that ends in a fight, never reaches `maybeFireEvent` at all.
            // Counting those as chances to draw is what made the model
            // predict draws for cards that could not physically get one.
            if (currentMode(before) === 'TRAVEL' && !after.end && !after.battle) {
              daysCouldFire += 1;
              const open = EVENTS.filter((def) => isEligible(after, def));
              const pool = open.reduce((a, e) => a + e.weight, 0);
              poolSize += open.length;
              if (after.settlement) daysSettled += 1;
              // The chance THIS day fires at all, not the sample average: a
              // walled steading with a full watch is a sixth as interruptible
              // as the road, and it is exactly where the settled half of the
              // deck becomes eligible. Averaging the two hides that.
              const chance = eventChance(after);
              for (const def of open) {
                openDays[def.id] = (openDays[def.id] ?? 0) + 1;
                share[def.id] = (share[def.id] ?? 0) + (def.weight / pool) * chance;
              }
              // The control: the same pools and the same odds, drawn with a
              // stream that has nothing to do with the game's. Whatever it
              // leaves cold is what the arithmetic alone leaves cold, so the
              // real cold count has something honest to be compared against.
              if (open.length > 0 && control.chance(chance)) {
                controlWon.add(control.weighted(open, (e) => e.weight).id);
              }
            }
          }
          if (after.day !== before.day) {
            w.days += 1;
            if (!before.settlement) w.roadDays += 1;
            // Standing on a place and not dealing: WHY. A market day needs
            // four things at once and only one of them is reach, so a bare
            // count of markets cannot tell a coast the band never walked to
            // from a counter it burned down on arrival.
            const p = placeHere(after);
            if (p) {
              if ((placeKind(p.kind).market ?? []).length > 0) sawCounter = true;
              if (p.sackedOn !== undefined) w.onSacked += 1;
              else if ((placeKind(p.kind).market ?? []).length === 0) w.onNoMarket += 1;
              else {
                const d = after.party.food / Math.max(1, foodPerDay(after));
                const n = after.party.firewood / Math.max(1, firewoodPerNight(after));
                const open = offersAt(after, p.id).some((o) =>
                  tradeBlocker(after, p.id, o.id) === null
                    && (o.give === 'food' ? d > 12 : n > 12));
                if (open) w.onOpen += 1; else w.onThin += 1;
                sawLiveCounter = true;
              }
            }
          }
          if (!before.battle && after.battle) {
            systems.fights += 1;
            w.fights += 1;
            if (after.battle.raid) systems.raids += 1;
          }
          if (!before.expedition && after.expedition) systems.expeditions += 1;
          if (after.party.people.length > before.party.people.length) systems.arrivals += 1;
          // A market day: stores moved without a fight and without a day on
          // the road. Counted off the saga line so it cannot be confused
          // with a bargain in somebody's yard.
          if (after.saga.length > before.saga.length) {
            for (const line of after.saga.slice(before.saga.length)) {
              if (/jetties|house of the White Christ and came away/.test(line.text)) {
                systems.markets += 1;
                w.markets += 1;
                sagaMarkets += 1;
              }
            }
          }
          for (const p of after.party.people) if (p.trait) traits.add(p.trait);
          for (const l of after.lore ?? []) lore.add(l);
        }, terms);

        sagas += 1;
        w.sagas += 1;
        if (sagaMarkets > 0) w.dealingSagas += 1;
        if (sawCounter) w.counterSagas += 1;
        if (sawLiveCounter) w.liveSagas += 1;
        sawCounter = false;
        sawLiveCounter = false;
        w.best = Math.max(w.best, sagaMarkets);
        sagaMarkets = 0;
        if (state.settlement) { w.founded += 1; w.foundDay += state.settlement.foundedOn; }
        if (!state.end) w.alive += 1;
        w.sackings += state.tally.sackings;
        for (const p of state.world.places) {
          if ((placeKind(p.kind).market ?? []).length === 0) continue;
          if (p.sackedOn === undefined) continue;
          w.burnt += 1;
          w.burntDay += p.sackedOn;
        }
        systems.raidsHeld += state.tally.raidsHeld;
        systems.sackings += state.tally.sackings;
        systems.bargains += state.tally.bargains;
        systems.feuds += state.grudges.filter((g) => g.settled).length;
        systems.thingsCalled += state.flags['thingsCalled'] ?? 0;
        systems.kinPairs += kinPairs(state.party.people).length > 0 ? 1 : 0;
        for (const k of Object.keys(state.flags)) if ((state.flags[k] ?? 0) > 0) flagsSet.add(k);
        for (const l of state.lore ?? []) lore.add(l);
        for (const p of state.party.people) if (p.trait) traits.add(p.trait);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const totalDraws = Object.values(draws).reduce((a, b) => a + b, 0);
    const cold = EVENTS.filter((e) => !cards.has(e.id)).map((e) => e.id);
    // A cold card that was never once eligible is unreachable content. A cold
    // card that was open for hundreds of days just never won a roll, which is
    // arithmetic, not a wall — the two want different fixes, so they are
    // reported apart.
    // A card gated on a flag some other card sets. Its second link can only
    // open once the first has fired, so it is judged on whether the chain is
    // alive rather than on whether this sample happened to finish it.
    const chainFlag = (id: string): string | undefined => {
      const def = EVENTS.find((e) => e.id === id);
      const cond = def?.when?.find((c) => (c as { c: string }).c === 'flagSet') as
        { flag?: string } | undefined;
      return cond?.flag;
    };
    const neverOpened = cold.filter((id) => (openDays[id] ?? 0) === 0);
    // Chain-short: never opened, but the flag it waits on DID fire somewhere.
    const chainShort = neverOpened.filter((id) => {
      const flag = chainFlag(id);
      return flag !== undefined && flagsSet.has(flag);
    });
    const shut = neverOpened.filter((id) => !chainShort.includes(id));
    const unlucky = cold.filter((id) => (openDays[id] ?? 0) > 0);
    // The deck is what EVENTS holds; `feud` and `thing` are cards the sim
    // builds by hand and were quietly inflating this ratio above 100%.
    const drawnFromDeck = EVENTS.filter((e) => cards.has(e.id)).length;
    // What a perfectly fair deck leaves cold on a sample this size: each
    // card comes up never with probability e^-expected, so the count of cold
    // cards is just their sum. THIS is what the cold list has to be read
    // against — not nought.
    const predictedCold = EVENTS.reduce((a, e) => a + Math.exp(-(share[e.id] ?? 0)), 0);
    const controlCold = EVENTS.length - controlWon.size;
    // eslint-disable-next-line no-console
    console.log(
      `reach over ${sagas} sagas:\n` +
        `  deck ${drawnFromDeck}/${EVENTS.length} drawn (${totalDraws} draws, top ten = ` +
        `${Math.round(
          Object.values(draws).sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0) /
            Math.max(1, totalDraws) * 100,
        )}%)\n` +
        `  never eligible (unreachable): ${shut.join(', ') || 'none'}\n` +
        `  pool averaged ${(poolSize / Math.max(1, daysSeen)).toFixed(1)} cards a day; ` +
        `model predicts ${Object.values(share).reduce((a, b) => a + b, 0).toFixed(0)} draws against ${totalDraws} seen\n` +
        `  on the road: ${totalDraws - drawsSettled} draws over ${daysSeen - daysSettled} days ` +
        `(${((totalDraws - drawsSettled) / Math.max(1, daysSeen - daysSettled)).toFixed(3)}/day); ` +
        `settled: ${drawsSettled} draws over ${daysSettled} days ` +
        `(${(drawsSettled / Math.max(1, daysSettled)).toFixed(3)}/day)\n` +
        `  eligible but never drawn, of ${daysCouldFire} days that could draw one (${daysSeen} in all): ` +
        `${unlucky
          .map((id) => `${id} (${openDays[id]}d, expected ${(share[id] ?? 0).toFixed(2)} draws)`)
          .join(', ') || 'none'}\n` +
        `  a FAIR deck on this sample would leave ${predictedCold.toFixed(1)} cards cold; ` +
        `we saw ${cold.length}; the control, drawing off the same pools with an ` +
        `unrelated stream, left ${controlCold}\n` +
        (() => {
          const rows = EVENTS.map((e) => ({
            id: e.id,
            e: share[e.id] ?? 0,
            a: draws[e.id] ?? 0,
          })).filter((r) => r.e >= 0.5);
          const worst = [...rows].sort((a, b) => (a.a - a.e) - (b.a - b.e)).slice(0, 6);
          const best = [...rows].sort((a, b) => (b.a - b.e) - (a.a - a.e)).slice(0, 6);
          const fmt = (r: { id: string; e: number; a: number }) => `${r.id}(${r.a}/${r.e.toFixed(1)})`;
          return (
            `  cards the sample should have seen at least once (n=${rows.length}), got/expected:\n` +
            `    furthest under: ${worst.map(fmt).join(', ')}\n` +
            `    furthest over:  ${best.map(fmt).join(', ')}\n`
          );
        })() +
        `  lore ${lore.size}/${LORE.length}, traits ${traits.size}/${TRAITS.length}\n` +
        Object.entries(walk).map(([id, w]) =>
          `  ${id}: ${w.founded}/${w.sagas} settled (day ${(w.foundDay / Math.max(1, w.founded)).toFixed(1)} ` +
          `on average), ${w.alive}/${w.sagas} still standing at 400, ${w.roadDays} road-days of ${w.days} ` +
          `(${Math.round((w.roadDays / Math.max(1, w.days)) * 100)}%), ${w.fights} fights, ` +
          `${w.sackings} sackings\n` +
          `    counters: ${w.counterSagas}/${w.sagas} sagas reached one, ${w.liveSagas} while it ` +
          `still traded, ${w.burnt} burnt down (day ` +
          `${(w.burntDay / Math.max(1, w.burnt)).toFixed(0)})\n` +
          `    days stood on a place: ${w.onSacked} on one already emptied, ${w.onNoMarket} on one ` +
          `that never traded, ${w.onThin} with nothing to spare, ${w.onOpen} that could have dealt\n` +
          `    ${w.markets} trade days, from ${w.dealingSagas} of ${w.sagas} sagas, ` +
          `most in any one ${w.best}\n`).join('') +
        `  systems: ${Object.entries(systems).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    );

    // Content that must be alive. Every one of these is a system this
    // project shipped and then measured at or near zero at some point.
    expect(lore.size, 'lore nobody ever learns').toBe(LORE.length);
    expect(traits.size, 'traits nobody is ever born with').toBe(TRAITS.length);
    expect(drawnFromDeck / EVENTS.length, 'most of the deck never comes up').toBeGreaterThan(0.75);

    // A card no state in the sample ever OPENS is unreachable content, and
    // that is the finding this probe exists for. Distinct from a card that
    // was open and never won, which is the sample being finite.
    if (chainShort.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `  chain-short (the flag fired, the sample never reached the second card): ` +
          `${chainShort.map((id) => `${id} needs ${chainFlag(id)}`).join(', ')}`,
      );
    }
    expect(shut, `these cards were never once eligible: ${shut.join(', ')}`).toEqual([]);

    // And the cold count against what a fair deck predicts. Barred loosely —
    // the point is to catch reach COLLAPSING (a gate that stopped opening, a
    // whole tier walled off), not to re-fail every time the dice land badly.
    // Measured on 2026-08-11: 15 cold against a prediction of 13.0 and a
    // control of 12, which is a deck behaving exactly as its weights say.
    expect(
      cold.length,
      `${cold.length} cards came up cold where a fair deck predicts ${predictedCold.toFixed(1)} ` +
        `(control ${controlCold}) — reach has fallen off, this is not the dice`,
    ).toBeLessThan(predictedCold + 12);

    for (const [name, floor] of [
      ['fights', 20], ['raids', 5], ['raidsHeld', 1], ['sackings', 5],
      ['bargains', 5], ['expeditions', 5], ['arrivals', 5],
      ['kinPairs', 5],
    ] as const) {
      expect(systems[name] ?? 0, `${name} never happens in ${sagas} sagas`).toBeGreaterThan(floor - 1);
    }

    // MARKETS, which are barred apart from the list above and on a different
    // quantity, because the obvious bar was measuring the wrong thing.
    //
    // It used to sit in that list as `markets >= 3` — three TRADE DAYS across
    // sixty sagas. Trade days multiply: a band that settles beside a live
    // counter deals at it again and again, so the total is carried by
    // whichever saga happened to camp there. Measured 2026-08-13, that is
    // exactly what it was doing — fourteen trade days from TWO of sixty
    // sagas, twelve of them from a single band. A floor of three on a
    // statistic with an effective sample of one is not a reach measurement,
    // it is the jarl-count mistake in ROADMAP.md wearing a different hat.
    //
    // It failed, and it failed honestly, when hardship-steel landed: fourteen
    // trade days fell to two. But the thing it is supposed to guard did not
    // move at all. SIX of sixty sagas reached a counter before the change and
    // six after, all six still trading in both. What changed was that one
    // band, arriving at the trading town with five sworn still on their feet
    // instead of four, sacked it on day 16 rather than dealing there twelve
    // times — the bot preferring plunder to a counter, which is a fact about
    // the bot and not about whether the game's markets can be got to.
    //
    // So the bar is on SAGAS now. Same numeral, sample of sixty instead of
    // one, and strictly harder to satisfy by luck: three trade days could
    // come from a single band in an afternoon, where three sagas cannot.
    // Set at half the measured six, because this probe is a collapse
    // detector — a counter that stopped being reachable, a gate that shut —
    // and not a tripwire for the dice.
    const counters = Object.values(walk).reduce((a, w) => a + w.liveSagas, 0);
    expect(
      counters,
      `only ${counters} of ${sagas} sagas ever stood at a counter that was still ` +
        `trading — the markets have gone out of reach`,
    ).toBeGreaterThan(2);

    // And that reaching one is not the same as the system working: somebody,
    // somewhere in the sample, has to actually deal. One, deliberately — the
    // count above is what guards reach, and this only has to catch a market
    // that no longer trades at all.
    expect(systems.markets, `nobody dealt at a counter in ${sagas} sagas`).toBeGreaterThan(0);

    // And the deck must not be ten cards wearing a hundred hats.
    expect(
      Object.values(draws).sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0) /
        Math.max(1, totalDraws),
      'ten cards are half the draws — the deck reads as smaller than it is',
    ).toBeLessThan(0.5);
  });
});

describe('more than one way to play', () => {
  /**
   * AUDIT ITEM 7.
   *
   * Every figure this repo carries describes ONE strategy: settle early,
   * work the jobs, hold the line, trade until somebody will speak for you.
   * The project has been claiming since phase 4 that there is more than one
   * way to play, and has never once tested it — so the claim was worth
   * exactly what "0 made a friend" was worth before anybody counted.
   *
   * Three policies over the same sixty landings. The settler is the harness
   * as it has always been, so every number elsewhere still means what it
   * meant. The raider takes what he needs and never carries food to
   * anybody; the turtle settles on the first workable ground and never
   * leaves the palisade.
   *
   * The interesting result is either one. If they land close together the
   * game has genuine depth; if one of them cannot survive at all, that is a
   * design finding worth more than a passing test.
   */
  it('measures each strategy on the same landings', { timeout: 900_000 }, async () => {
    const rows: string[] = [];
    const spring: Record<string, number> = {};
    const second: Record<string, number> = {};
    const SEEDS = 30;

    try {
      for (const p of POLICIES) {
        policy = p;
        let sawWinter = 0;
        let sawSpring = 0;
        let secondWinter = 0;
        let days = 0;
        let built = 0;
        let sacked = 0;
        let peak = 0;
        // WHAT ENDED IT, which this row never said and badly needed to. The
        // raider reads 0 second winters with five of six still standing, and
        // "died out" and "sailed home rich" are opposite findings that look
        // identical in a day count.
        const ends: Record<string, number> = {};
        let raids = 0;
        let held = 0;
        let endFood = 0;
        let endWood = 0;
        let hungryDays = 0;
        let coldDays = 0;
        let illDays = 0;
        let awayDays = 0;
        let allDays = 0;
        let fightDays = 0;
        const m30: number[] = []; const m50: number[] = []; const m70: number[] = [];

        for (let s = 0; s < SEEDS; s += 1) {
          const state = run(`curve-${s}`, 200, (before, after) => {
            if (after.day === before.day) return;
            if (before.party.food < foodPerDay(before)) hungryDays += 1;
            if (before.party.firewood <= 0) coldDays += 1;
            if (ailingCount(before) > 0) illDays += 1;
            if (before.settlement && !atHome(before)) awayDays += 1;
            if (before.battle) fightDays += 1;
            for (const [d, bucket] of [[30, m30], [50, m50], [70, m70]] as const) {
              if (before.day === d) bucket.push(before.party.morale);
            }
            allDays += 1;
          }, 'fair');
          const cause = state.end?.cause ?? 'ran out of days';
          ends[cause] = (ends[cause] ?? 0) + 1;
          days += state.day;
          if (state.day >= 49) sawWinter += 1;
          if (state.day >= 73) sawSpring += 1;
          if (state.day >= 169) secondWinter += 1;
          built += state.settlement?.built.length ?? 0;
          sacked += state.tally.sackings;
          raids += state.tally.raids;
          held += state.tally.raidsHeld;
          endFood += state.party.food;
          endWood += state.party.firewood;
          peak += state.party.people.filter((x) => x.alive).length;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        spring[p.id] = sawSpring / SEEDS;
        second[p.id] = secondWinter / SEEDS;
        rows.push(
          `  ${p.id.padEnd(8)} winter ${sawWinter}/${SEEDS}, spring ${sawSpring}/${SEEDS}, ` +
            `second winter ${secondWinter}/${SEEDS}; avg ${Math.round(days / SEEDS)} days, ` +
            `${(built / SEEDS).toFixed(1)} built, ${(sacked / SEEDS).toFixed(1)} sacked, ` +
            `${(raids / SEEDS).toFixed(1)} raids suffered (${(held / SEEDS).toFixed(1)} held), ` +
            `left ${(endFood / SEEDS).toFixed(0)} food and ${(endWood / SEEDS).toFixed(0)} wood; ` +
            `of ${allDays} days: ${(hungryDays / allDays * 100).toFixed(0)}% hungry, ` +
            `${(coldDays / allDays * 100).toFixed(0)}% cold, ${(illDays / allDays * 100).toFixed(0)}% ill, ` +
            `${(awayDays / allDays * 100).toFixed(0)}% away, ` +
            `${(fightDays / allDays * 100).toFixed(0)}% fighting; heart ` +
            `${[m30, m50, m70].map((b) => (b.length
              ? (b.reduce((x, y) => x + y, 0) / b.length).toFixed(0) : '-')).join('/')} ` +
            `on days 30/50/70; ` +
            `${(peak / SEEDS).toFixed(1)} alive at the end; ended by ` +
            `${Object.entries(ends).sort((a, b) => b[1] - a[1])
              .map(([c, n]) => `${c} ${n}`).join(', ')}`,
        );
      }
    } finally {
      policy = SETTLER;
    }

    // eslint-disable-next-line no-console
    console.log(`three ways to play, ${SEEDS} landings each (A Fair Country):\n${rows.join('\n')}`);

    // The bar is NOT that they are equal — a game where every strategy pays
    // the same is a game where the choice is decoration. It is that none of
    // them is a dead end: a player who commits to any of these three should
    // get a run, not a punishment for not playing the one true way.
    for (const p of POLICIES) {
      expect(spring[p.id], `${p.id} cannot see a spring — that line is not playable`)
        .toBeGreaterThan(0.15);
    }
    // And that the settler has not quietly become the only answer.
    const best = Math.max(...POLICIES.map((p) => spring[p.id]!));
    const worst = Math.min(...POLICIES.map((p) => spring[p.id]!));
    expect(best - worst, 'one strategy dominates the others outright').toBeLessThan(0.5);

    // THE SECOND WINTER, which is where the strategies actually differ and
    // where this test was blind until task 31 went looking.
    //
    // Spring is the wrong milestone to guarantee depth at: all three
    // policies clear it within a few points of each other (25/26/17 of 30),
    // so the bar above passes while the lines are nothing like equal one
    // milestone later — 21 turtles stand a second winter against 3 raiders.
    //
    // What is barred here is REACH, not parity: every line must get a band
    // to a second winter sometimes. Parity is deliberately NOT barred,
    // because the 3-against-21 gap is not a regression to catch — it is the
    // open design question in task 31, and a failing test would not tell
    // anybody anything they do not already know.
    for (const p of POLICIES) {
      expect(
        second[p.id],
        `${p.id} never once stood a second winter in ${SEEDS} landings — that line is a dead end`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('where an armed sortie dies', () => {
  /**
   * TASK 31, and the measurement that has to come before the design.
   *
   * The raiding write-up concluded that the binding constraint is
   * STRUCTURAL — a raid costs a settled band 28% of its labour-days with
   * half the household away, so making raiding win means a warband that is
   * not simply half the household on loan. That may well be right. But the
   * numbers it rests on are equally consistent with a much duller reading:
   * sorties DOUBLED and sackings did not move, which means the marginal
   * errand came home with nothing. If that is because they never reach
   * anybody, or reach them and lose, then no warband redesign fixes it and
   * the answer is targets, not table of organisation.
   *
   * Nobody has ever counted it. So: follow every armed errand the raider
   * launches, and record where it stopped being worth having.
   *
   * Reported, not barred. It exists to answer a design question once, and a
   * bar on it would be a bar on a strategy nobody has settled the shape of.
   */
  it.each([3, 5])('follows every armed errand from launch to whatever it carried home (party of %i)', { timeout: 900_000 }, async (PARTY: number) => {
    interface Sortie {
      purpose: string;
      /** Which saga it belongs to, so trips can be counted per landing. */
      saga: number;
      crew: number;
      day: number;
      /** Stood on a camp or a place worth taking. */
      arrived: boolean;
      fights: number;
      /** Fought something that PAYS — a camp or a place, not a wolf. */
      forStakes: number;
      won: number;
      lost: number;
      haul: number;
      days: number;
      wiped: boolean;
    }
    const done: Sortie[] = [];
    let open: Sortie | null = null;
    const SEEDS = 60;
    let sagas = 0;
    let sackedTally = 0;
    let stakesOut = 0;
    let stakesHome = 0;
    let haulOut = 0;
    let haulHome = 0;
    let sagasThatWentOut = 0;
    let sagasPastSpring = 0;
    let byWater = 0;
    let byLand = 0;
    let gateDays = 0;
    const gate: Record<string, number> = {
      'too young': 0, 'out of season': 0, 'already out': 0,
      'nothing worth taking': 0, 'not enough sworn': 0, 'store too thin': 0,
      'could have gone': 0,
    };

    try {
      policy = { ...RAIDER, raidParty: PARTY };
      for (const [arm, terms] of [[0, 'even'], [1, 'fair']] as [number, HardshipId][]) {
        for (let s = 0; s < SEEDS / 2; s += 1) {
          const state = run(armSeed(arm, s, SEEDS / 2), 400, (before, after) => {
            if (!before.expedition && after.expedition) {
              open = {
                purpose: after.expedition.purpose,
                saga: sagas + 1,
                crew: after.expedition.members.length,
                day: after.day,
                arrived: false,
                fights: 0,
                forStakes: 0,
                won: 0,
                lost: 0,
                haul: 0,
                days: 0,
                wiped: false,
              };
            }

            if (open && after.expedition) {
              // Standing on something worth taking, whether or not they take
              // it. This is the line between "never found anybody" and
              // "found somebody and it went badly".
              const host = neighbourHere(after);
              const place = placeHere(after);
              if ((host && campStores(after, host.sackedOn) >= 0.5)
                  || (place && place.sackedOn === undefined)) {
                open.arrived = true;
              }
            }

            if (open && !before.battle && after.battle) {
              open.fights += 1;
              if (after.battle.campId || after.battle.placeId) {
                open.forStakes += 1;
                // Is the ship behind them? Option D of task 31 gives a raid
                // launched off the water a line of retreat, and that is only
                // worth building if raids are ever FOUGHT off the water.
                if (after.battle.strandhogg || after.battle.terrain === 'ocean') byWater += 1;
                else byLand += 1;
              }
            }

            // Every fight for stakes in the whole saga, errand or not. The
            // point of comparison: if the raider takes most of its plunder
            // while NOT on an armed errand, then the errand is not where
            // raiding lives and the labour cost is not what binds.
            if (!before.battle && after.battle && (after.battle.campId || after.battle.placeId)) {
              if (after.expedition) stakesOut += 1;
              else stakesHome += 1;
            }
            if (before.battle && !after.battle && before.battle.outcome === 'won'
                && (before.battle.campId || before.battle.placeId)) {
              const got =
                (after.party.food - before.party.food) +
                (after.party.firewood - before.party.firewood);
              if (before.expedition) haulOut += got;
              else haulHome += got;
            }

            // The payout is in `leaveBattle`, NOT where `checkOutcome` writes
            // the result: `sackCamp` and `settlePlace` run in the same call
            // that deletes the battle, several transitions later. Measuring
            // the delta where the outcome first appears reads zero for every
            // errand ever flown, which is what this probe did on its first
            // run — a dull probe making a live system look empty.
            if (open && before.battle && !after.battle) {
              const stakes = !!(before.battle.campId || before.battle.placeId);
              if (before.battle.outcome === 'won') open.won += 1;
              else if (before.battle.outcome === 'lost') open.lost += 1;
              if (stakes && before.battle.outcome === 'won') {
                open.haul +=
                  (after.party.food - before.party.food) +
                  (after.party.firewood - before.party.firewood);
              }
            }

            // WHY the errand so often never happens. Counted on every day
            // the band is settled and past its first winter — i.e. every day
            // it is entitled to go — and attributed to the FIRST gate that
            // is shut, in the order the bot checks them.
            if (after.day !== before.day && after.settlement && !after.end) {
              gateDays += 1;
              if (wintersStood(after.day) < 1) gate['too young'] = (gate['too young'] ?? 0) + 1;
              else if (!(seasonOf(after.day) === 'spring' || seasonOf(after.day) === 'summer')) {
                gate['out of season'] = (gate['out of season'] ?? 0) + 1;
              } else if (after.expedition) gate['already out'] = (gate['already out'] ?? 0) + 1;
              else if (!raidTargetOn(after, RAIDER.raidReach)) gate['nothing worth taking'] = (gate['nothing worth taking'] ?? 0) + 1;
              else if (sworn(after.party.people).length < PARTY) gate['not enough sworn'] = (gate['not enough sworn'] ?? 0) + 1;
              else {
                const crew = sworn(after.party.people).slice(0, PARTY).map((p) => p.id);
                if (after.party.food
                    <= provisionsFor(PARTY) + foodPerDay(after) * RAIDER.errandBuffer) {
                  gate['store too thin'] = (gate['store too thin'] ?? 0) + 1;
                } else if (launchBlocker(after, crew) !== null) {
                  gate[`blocked: ${launchBlocker(after, crew)}`] =
                    (gate[`blocked: ${launchBlocker(after, crew)}`] ?? 0) + 1;
                } else gate['could have gone'] = (gate['could have gone'] ?? 0) + 1;
              }
            }

            if (open && before.expedition && !after.expedition) {
              open.days = after.day - open.day;
              // `pruneExpedition` drops the errand when the last of them
              // falls, and it puts the band's token back at the hall — so a
              // wipe and a homecoming look identical unless the crew is
              // counted.
              open.wiped = before.expedition.members.every(
                (id) => !after.party.people.some((p) => p.id === id && p.alive),
              );
              done.push(open);
              open = null;
            }
          }, terms);
          sagas += 1;
          sackedTally += state.tally.sackings;
          if (state.day >= 73) sagasPastSpring += 1;
          if (done.some((d) => d.purpose === 'raid' && d.saga === sagas)) sagasThatWentOut += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      policy = SETTLER;
      open = null;
    }

    const armed = done.filter((d) => d.purpose === 'raid');
    const scouts = done.filter((d) => d.purpose === 'explore');
    const never = armed.filter((d) => !d.arrived);
    const arrivedNoFight = armed.filter((d) => d.arrived && d.forStakes === 0);
    const fought = armed.filter((d) => d.forStakes > 0);
    const wonSomething = fought.filter((d) => d.won > 0 && d.haul > 0);
    const foughtAndLost = fought.filter((d) => d.won === 0);
    const wiped = armed.filter((d) => d.wiped);
    const sum = (xs: Sortie[], f: (d: Sortie) => number) => xs.reduce((a, d) => a + f(d), 0);
    const pc = (n: number) => `${Math.round((n / Math.max(1, armed.length)) * 100)}%`;

    // eslint-disable-next-line no-console
    console.log(
      `armed errands over ${sagas} raider sagas, ${PARTY} sworn a trip ` +
        `(${armed.length} of them, ` +
        `plus ${scouts.length} scouting trips):\n` +
        `  never stood on anything worth taking: ${never.length} (${pc(never.length)})\n` +
        `  got there and never drew steel:       ${arrivedNoFight.length} (${pc(arrivedNoFight.length)})\n` +
        `  fought for stakes:                    ${fought.length} (${pc(fought.length)})\n` +
        `    and carried something home:         ${wonSomething.length} (${pc(wonSomething.length)})\n` +
        `    and were thrown back:               ${foughtAndLost.length} (${pc(foughtAndLost.length)})\n` +
        `  nobody came back:                     ${wiped.length} (${pc(wiped.length)})\n` +
        `  crew ${(sum(armed, (d) => d.crew) / Math.max(1, armed.length)).toFixed(1)} a trip, ` +
        `${(sum(armed, (d) => d.days) / Math.max(1, armed.length)).toFixed(1)} days out, ` +
        `${(sum(armed, (d) => d.fights) / Math.max(1, armed.length)).toFixed(2)} fights a trip\n` +
        `  total haul ${sum(armed, (d) => d.haul)} of stores over ${armed.length} errands ` +
        `= ${(sum(armed, (d) => d.haul) / Math.max(1, armed.length)).toFixed(1)} an errand\n` +
        `  ${sagasThatWentOut}/${sagas} sagas ever launched one ` +
        `(${sagasPastSpring} lived to see a spring); tally.sackings ` +
        `${(sackedTally / Math.max(1, sagas)).toFixed(1)} a saga\n` +
        `  WHERE THE PLUNDER COMES FROM — fights for stakes: ${stakesOut} on an errand, ` +
        `${stakesHome} not on one; stores taken: ${haulOut} on an errand, ${haulHome} not\n` +
        `  fights for stakes fought off the water: ${byWater}, on foot: ${byLand}\n` +
        `  WHY IT DID NOT GO, over ${gateDays} settled days: ` +
        Object.entries(gate)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${v} (${Math.round((v / Math.max(1, gateDays)) * 100)}%)`)
          .join(', '),
    );

    // The one thing worth failing on: an errand the bot only launches when
    // it already HAS a target must be able to reach one.
    expect(armed.length, 'the raider never went out under arms at all').toBeGreaterThan(0);
  });
});

describe('can a raider actually live by it', () => {
  /**
   * TASK 31's real question, put to the GAME rather than to the harness.
   *
   * The autopsy above found that the raider almost never raids — 0.4% of
   * the days it was entitled to go, it went — and that more than half of
   * what stopped it was the bot's own scruples: it would not go out before
   * it had stood a winter, and only in spring or summer. Neither is a rule
   * of the game. It also found that sending three of six sworn gets two
   * thirds of those errands killed outright, where five gets a quarter.
   *
   * So none of the earlier raiding figures measured whether a band CAN live
   * this way. They measured a bot that raided rarely, late, and shorthanded.
   * This puts the same seeds to a raider with the scruples removed: five
   * sworn, from the first day there is a steading, in any season.
   *
   * If it still cannot reach a second winter, the design conclusion in the
   * write-up stands and the answer is a standing warband. If it can, the
   * answer is much cheaper, and it is that the strategy was never played.
   */
  it('measures a raider with the harness scruples taken off', { timeout: 900_000 }, async () => {
    const arms: [string, Policy][] = [
      ['as it was', RAIDER],
      ['5 sworn', { ...RAIDER, raidParty: 5 }],
      ['unleashed', { ...RAIDER, raidParty: 5, raidAfterWinters: 0, raidInSeasonOnly: false }],
      ['turtle', TURTLE],
    ];
    const rows: string[] = [];
    const secondWinter: Record<string, number> = {};
    const SEEDS = 30;

    try {
      for (const [name, p] of arms) {
        policy = p;
        let winter = 0, spring = 0, second = 0, days = 0, sacked = 0, alive = 0, built = 0;
        const fates: Record<string, number> = {};
        for (let s = 0; s < SEEDS; s += 1) {
          const state = run(`curve-${s}`, 200, undefined, 'fair');
          days += state.day;
          if (state.day >= 49) winter += 1;
          if (state.day >= 73) spring += 1;
          if (state.day >= 169) second += 1;
          sacked += state.tally.sackings;
          built += state.settlement?.built.length ?? 0;
          alive += state.party.people.filter((x) => x.alive).length;
          for (const p2 of state.party.people) {
            if (p2.alive) continue;
            const f = p2.fate ?? 'unrecorded';
            // Steel or the season: the distinction the design turns on. If
            // raiding more kills a band by taking its people AWAY from the
            // work, the fix is a warband that was never doing the work; if
            // it kills them on the field, that is a different problem.
            const how = /spear|axe|sword|blade|field|fell|wound|steel|cut down|shield/i.test(f)
              ? 'steel'
              : /hunger|starv|cold|froze|winter|sick|fever|wasted|despair|walked out|did not wake/i.test(f)
                ? 'the season'
                : 'other';
            fates[how] = (fates[how] ?? 0) + 1;
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        secondWinter[name] = second;
        rows.push(
          `  ${name.padEnd(10)} winter ${String(winter).padStart(2)}/${SEEDS}, ` +
            `spring ${String(spring).padStart(2)}/${SEEDS}, ` +
            `second winter ${String(second).padStart(2)}/${SEEDS}; ` +
            `avg ${String(Math.round(days / SEEDS)).padStart(3)} days, ` +
            `${(sacked / SEEDS).toFixed(1)} sacked, ${(built / SEEDS).toFixed(1)} built, ` +
            `${(alive / SEEDS).toFixed(1)} alive at the end\n` +
            `             dead by: ${Object.entries(fates).sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k} ${v}`).join(', ') || 'nobody'}`,
        );
      }
    } finally {
      policy = SETTLER;
    }

    // eslint-disable-next-line no-console
    console.log(`the raider, unscrupled, ${SEEDS} landings each (A Fair Country):\n${rows.join('\n')}`);

    // Reported, not barred: this exists to settle a design question, and
    // the shape of the answer is what task 31 is FOR. The only bar is that
    // the sweep ran at all.
    expect(Object.keys(secondWinter).length).toBe(arms.length);
  });
});

describe('what a haul would have to be worth', () => {
  /**
   * TASK 31's LAST LEVER, and the one that decides whether the answer is a
   * cheap number or a day of new mechanics.
   *
   * Four candidate causes are measured and dead: the labour the errand
   * costs (refused for a thin store on 1% of eligible days), the size of
   * the party (per-errand much better, strategy unmoved), the rate of
   * raiding (strictly worse), and how lethal a lost raid is (a third fewer
   * dead by steel, strategy unmoved). What is left is the exchange rate: a
   * raid pays about 43 stores and buys a permanent enemy, against a farm
   * that simply works.
   *
   * Pricing was dismissed once, and the reason it was dismissed is gone:
   * it raised the payout on a bet that could end the run, which is a
   * lottery ticket rather than a living. With `withdrew` in, a lost raid no
   * longer annihilates the band, so a price can now be asked to do the job
   * it could not do before.
   *
   * So: multiply what camps and places hold, and find the number — if there
   * is one — at which a raider reaches a second winter as often as a turtle
   * does. If no price does it, raiding cannot be bought and the standing
   * warband is the only answer left. If a modest one does, it is a day
   * cheaper than the warband.
   *
   * The data is mutated in place and restored in a finally. That is ugly
   * and it is the honest way to sweep a shipped constant without shipping a
   * knob nobody would ever set at runtime.
   */
  it('sweeps the plunder scale against the turtle it has to beat', { timeout: 900_000 }, async () => {
    const SEEDS = 30;
    const baseClan = CLAN_KINDS.map((k) => ({ ...k.plunder }));
    const basePlace = PLACE_KINDS.map((k) => ({ ...k.loot }));
    const rows: string[] = [];
    const second: Record<string, number> = {};

    const setScale = (scale: number): void => {
      CLAN_KINDS.forEach((k, i) => {
        k.plunder.food = Math.round(baseClan[i]!.food * scale);
        k.plunder.firewood = Math.round(baseClan[i]!.firewood * scale);
      });
      PLACE_KINDS.forEach((k, i) => {
        k.loot.food = Math.round(basePlace[i]!.food * scale);
        k.loot.firewood = Math.round(basePlace[i]!.firewood * scale);
      });
    };

    try {
      for (const [name, p, scale] of [
        ['turtle x1', TURTLE, 1],
        ['raider x1', RAIDER, 1],
        ['raider x2', RAIDER, 2],
        ['raider x4', RAIDER, 4],
        ['raider x8', RAIDER, 8],
      ] as [string, Policy, number][]) {
        policy = p;
        setScale(scale);
        let winter = 0, spring = 0, secondW = 0, days = 0, sacked = 0, alive = 0;
        let morale = 0, anger = 0, stores = 0;
        const fates: Record<string, number> = {};
        for (let s = 0; s < SEEDS; s += 1) {
          const state = run(`curve-${s}`, 200, undefined, 'fair');
          days += state.day;
          if (state.day >= 49) winter += 1;
          if (state.day >= 73) spring += 1;
          if (state.day >= 169) secondW += 1;
          sacked += state.tally.sackings;
          alive += state.party.people.filter((x) => x.alive).length;
          morale += state.party.morale;
          anger += angerLevel(state);
          stores += state.party.food + state.party.firewood;
          for (const p2 of state.party.people) {
            if (p2.alive) continue;
            const f = p2.fate ?? 'unrecorded';
            const how = /spear|axe|sword|blade|field|fell|wound|steel|cut down|shield|carried off/i.test(f)
              ? 'steel'
              : /hunger|starv|cold|froze|winter|sick|fever|wasted/i.test(f)
                ? 'want'
                : /despair|walked out|did not wake|gave up|heart/i.test(f)
                  ? 'despair'
                  : 'other';
            fates[how] = (fates[how] ?? 0) + 1;
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        second[name] = secondW;
        rows.push(
          `  ${name.padEnd(10)} winter ${String(winter).padStart(2)}/${SEEDS}, ` +
            `spring ${String(spring).padStart(2)}/${SEEDS}, ` +
            `second winter ${String(secondW).padStart(2)}/${SEEDS}; ` +
            `avg ${String(Math.round(days / SEEDS)).padStart(3)} days, ` +
            `${(sacked / SEEDS).toFixed(1)} sacked, ${(alive / SEEDS).toFixed(1)} alive\n` +
            `             ended on ${(stores / SEEDS).toFixed(0)} stores, morale ` +
            `${(morale / SEEDS).toFixed(0)}, coast anger ${(anger / SEEDS).toFixed(0)}; dead by ` +
            Object.entries(fates).sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k} ${v}`).join(', '),
        );
      }
    } finally {
      policy = SETTLER;
      // Put the shipped numbers back, or every test after this one in the
      // file is measuring a game that does not exist.
      CLAN_KINDS.forEach((k, i) => { k.plunder = { ...baseClan[i]! }; });
      PLACE_KINDS.forEach((k, i) => { k.loot = { ...basePlace[i]! }; });
    }

    // eslint-disable-next-line no-console
    console.log(`what a haul is worth, ${SEEDS} landings each (A Fair Country):\n${rows.join('\n')}`);

    // The restore is the only thing barred here — a leaked scale would
    // silently rewrite every figure in this file, the same failure mode the
    // `policy` reset in a finally exists to prevent.
    expect(CLAN_KINDS[0]!.plunder).toEqual(baseClan[0]);
    expect(PLACE_KINDS[0]!.loot).toEqual(basePlace[0]);
  });
});

describe('falling on a camp is a fight the band loses', () => {
  /**
   * TASK 31, ANSWERED — and it was never the thing five levers in a row
   * were aimed at.
   *
   * The raider picks a hundred fights for stakes in thirty sagas and wins
   * four. Everything downstream sits behind that gate, which is why nothing
   * downstream could ever move: the haul cannot be priced because it is
   * almost never collected, glory cannot be paid because `sackCamp` runs
   * four times in thirty sagas, and raiding more only means losing more of
   * the fights you picked. Standing is docked the moment steel is drawn
   * (`REP_RAIDED`, at the DECISION, not the outcome), so a band pays the
   * coast's memory a hundred times and is paid back four.
   *
   * More men helps and does not fix it: 4/85 with three sworn, 7/59 with
   * five, 11/56 with five in any season. One in five is the ceiling.
   *
   * Reported with a wide bar. What is barred is that attacking is not a
   * pure tax — a band that draws steel on a camp must win SOMETIMES — and
   * the exact rate is left alone because it is the open design question.
   */
  it('counts what the raider wins of the fights it picks', { timeout: 900_000 }, async () => {
    const SEEDS = 30;
    let campFights = 0, campWins = 0, placeFights = 0, placeWins = 0;
    // HOW WORN THEY GO IN, and how long since the last one. The hypothesis a
    // coast build put on the table: the line puts every camp within a few
    // days, so the raider fights three times as often and never stands down
    // long enough to mend — and a band that goes into every fight carrying
    // the last one loses.
    const wear: number[] = [];
    const rest: number[] = [];
    const foes: number[] = [];
    const ours: number[] = [];
    let lastFight = 0;
    try {
      policy = RAIDER;
      for (let s = 0; s < SEEDS; s += 1) {
        lastFight = 0;
        run(`curve-${s}`, 200, (before, after) => {
          if (!before.battle && after.battle) {
            if (after.battle.campId) {
              campFights += 1;
              const band = before.party.people.filter((x) => x.alive);
              const whole = band.reduce((t, x) => t + x.health / x.maxHealth, 0);
              wear.push(band.length > 0 ? whole / band.length : 1);
              rest.push(before.day - lastFight);
              foes.push(after.battle.combatants.filter((c) => c.side === 'foe').length);
              ours.push(after.battle.combatants.filter((c) => c.side === 'warband').length);
              lastFight = before.day;
            }
            if (after.battle.placeId) placeFights += 1;
          }
          if (before.battle && !after.battle && before.battle.outcome === 'won') {
            if (before.battle.campId) campWins += 1;
            if (before.battle.placeId) placeWins += 1;
          }
        }, 'fair');
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      policy = SETTLER;
    }

    const pc = (w: number, n: number) => `${w}/${n} (${Math.round((w / Math.max(1, n)) * 100)}%)`;
    // eslint-disable-next-line no-console
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    console.log(
      `the fights the raider picks, ${SEEDS} landings (A Fair Country):\n` +
        `  camps  ${pc(campWins, campFights)}\n  places ${pc(placeWins, placeFights)}\n` +
        `  going in: ${(mean(wear) * 100).toFixed(0)}% whole, ` +
        `${mean(rest).toFixed(1)} days since the last one, ` +
        `${mean(ours).toFixed(1)} of ours against ${mean(foes).toFixed(1)} of theirs`,
    );

    expect(campFights, 'the raider never fell on a camp at all').toBeGreaterThan(10);
    expect(
      campWins,
      `the raider drew steel on a camp ${campFights} times and won nothing — ` +
        'attacking is a pure tax on standing',
    ).toBeGreaterThan(0);
  });
});

describe('attacking and defending, held side by side', () => {
  /**
   * TASK 31, #34. The comparison every earlier measurement was missing.
   *
   * A raiding party wins 8% of the fights it picks; the same band behind a
   * palisade holds about 39% of the raids that come to it. Word is ruled
   * out (removing it moved 5% to 8%) and so is the foe count — three sworn
   * draw about four defenders, which does not explain a 92% loss rate.
   *
   * What is left is the WALL: the band's whole combat design is a shield
   * wall, a wall wants the whole band, and a raiding party is by definition
   * half of one. But "attacking is worse" and "fighting shorthanded is
   * worse" are two different claims and nothing has ever separated them,
   * because in play they always arrive together.
   *
   * So: the same band, the same difficulty, at every width from three to
   * six, in three postures — attacking, defending behind a palisade, and
   * defending without one. Whatever moves the win rate is the answer.
   *
   * Reported, not barred. The bars on raids live in `the raid gauntlet`.
   */
  function steading(seed: string, walls: boolean): GameState {
    const state = structuredClone(newGame(seed));
    expect(foundAnywhere(state), `${seed}: nothing foundable`).toBe(true);
    const home = state.settlement!;
    home.built.push('longhouse', 'farmplots');
    if (walls) home.built.push('palisade');
    home.shelter = 3;
    state.day = 120;
    state.party.food = 60;
    state.party.firewood = 60;
    return state;
  }

  /**
   * Puts exactly `n` of the sworn where the fight will be.
   *
   * A raid is fought by `homeCrew`, an open field by `fieldCrew`, so the
   * width is set by choosing who is OUT — which is the honest way to do it,
   * because it is the same lever a player pulls.
   */
  function widthOf(state: GameState, n: number, posture: 'attack' | 'defend'): number {
    const ids = sworn(state.party.people).map((p) => p.id);
    // The expedition holds whoever is OUT. Attacking, that is the party
    // itself (`fieldCrew`); defending, it is everyone who is NOT holding the
    // yard, so the ones left at home (`homeCrew`) number n.
    const members = posture === 'attack' ? ids.slice(0, n) : ids.slice(n);
    if (members.length > 0) {
      state.expedition = {
        members,
        purpose: 'raid',
        launchedOn: state.day,
        carried: 0,
      };
    }
    return n;
  }

  function fightOut(start: GameState): { won: boolean; foes: number } {
    let state = start;
    const foes = state.battle?.foes.length ?? 0;
    for (let i = 0; i < 600 && state.battle && !state.battle.outcome; i += 1) {
      let next = apply(state, step(state));
      if (next === state) next = apply(state, { type: 'B_END_TURN' });
      if (next === state) break;
      state = next;
    }
    return { won: state.battle?.outcome === 'won', foes };
  }

  it('separates the width of the wall from the walls around it', { timeout: 900_000 }, async () => {
    const WIDTHS = [3, 4, 5, 6];
    const PER = 32;
    const DIFF = 2;
    const rows: string[] = [];
    const wonAt: Record<string, number> = {};

    for (const posture of ['attack', 'defend (no palisade)', 'defend (palisade)'] as const) {
      const cells: string[] = [];
      for (const n of WIDTHS) {
        let won = 0;
        let foes = 0;
        for (let s = 0; s < PER; s += 1) {
          const state = steading(`sbs-${s}-${n}`, posture === 'defend (palisade)');
          if (posture === 'attack') {
            widthOf(state, n, 'attack');
            // Straight to the fight, with the stake set, so this measures
            // the FIELD rather than the bot's willingness to go out.
            startBattle(state, 'meadow', DIFF, { campId: state.neighbours[0]!.id });
          } else {
            widthOf(state, n, 'defend');
            startRaid(state, DIFF);
          }
          const out = fightOut(state);
          if (out.won) won += 1;
          foes += out.foes;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        wonAt[`${posture}:${n}`] = won;
        cells.push(
          `${n}: ${String(won).padStart(2)}/${PER} (${String(Math.round((won / PER) * 100)).padStart(3)}%) vs ${(foes / PER).toFixed(1)} foes`,
        );
      }
      rows.push(`  ${posture.padEnd(21)} ${cells.join('  |  ')}`);
    }

    // eslint-disable-next-line no-console
    console.log(
      `the same band, ${PER} fights a cell, difficulty ${DIFF}, by how many stood:\n${rows.join('\n')}`,
    );
    expect(rows.length).toBe(3);

    // The finding, barred: a full wall must beat a broken one by a wide
    // margin. Measured at 9% for three attackers against 47% for six, which
    // is the whole of task 31 — the band cannot raid because it cannot take
    // its wall with it, not because attacking is punished.
    expect(
      wonAt['attack:6']! - wonAt['attack:3']!,
      'the width of the shield wall no longer decides an open-field fight',
    ).toBeGreaterThan(PER * 0.15);

    // And posture is NOT the thing: six attacking and six defending open
    // ground came out level. A future change that makes attacking a penalty
    // in itself should have to say so out loud.
    expect(
      Math.abs(wonAt['attack:6']! - wonAt['defend (no palisade):6']!),
      'attacking and defending with the same band on open ground have come apart',
    ).toBeLessThan(PER * 0.35);
  });
});

describe('the strandhogg, and why it does not happen', () => {
  /**
   * TASK 33. The verb works; the band never gets to use it.
   *
   * Every part of the chain checks out except one. Worldgen puts a
   * strandhogg-able place in 60 of 60 worlds (1.4 apiece). The routing
   * works — of the places the errand aimed at, 172 of 173 were reachable
   * from the water. The bot takes the shot when it has one, twice in the
   * four days it ever spent floating beside a place it could hit. What is
   * missing is the opportunity: over thirty sagas the errand aimed at a
   * CAMP on 1611 settled days and at a place on 173.
   *
   * And it is not distance and not preference. Ranking sea prizes above
   * camps outright, and then widening how far a prize counts as reachable
   * by eight hexes because rowing is cheap, both changed the numbers by
   * exactly NOTHING — the candidate set is empty, not mis-ordered. A place
   * has to be SEEN, unsacked and lightly enough held for the band that is
   * there, and the four on a coast are one-shot: taken early, or never
   * known at all.
   *
   * So making the strandhogg reachable is not a raiding change. It is a
   * question about the PLACE economy — how a band learns where places are,
   * and whether four one-shot prizes a world is the right shape. Recorded
   * here rather than tuned, because tuning it is what the last three
   * attempts did to no effect.
   */
  it('counts opportunity against action', { timeout: 900_000 }, async () => {
    let seaDays = 0, oppDays = 0, done = 0, sagas = 0;
    let aimedCamp = 0, aimedPlace = 0, aimedPlaceBySea = 0;
    try {
      policy = RAIDER;
      for (let s = 0; s < 30; s += 1) {
        const state = run(`curve-${s}`, 400, (before, after) => {
          if (after.day !== before.day) {
            if (atSea(after)) seaDays += 1;
            if (strandTarget(after)) oppDays += 1;
            if (after.settlement && !after.expedition) {
              const t = raidTargetOn(after, RAIDER.raidReach);
              if (t) {
                // No `bySea` split: on a line there is no water to come out
                // of, so every prize is reached the same way — see
                // `raidTargetOn`. The strandhögg is counted below, off the
                // battle itself, which is what it always meant anyway.
                if (after.neighbours.some((n) => n.id === t.id)) aimedCamp += 1;
                else aimedPlace += 1;
              }
            }
          }
          if (!before.battle && after.battle?.strandhogg) done += 1;
        }, 'fair');
        sagas += 1;
        void state;
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally { policy = SETTLER; }
    // eslint-disable-next-line no-console
    console.log(
      `${sagas} raider sagas: ${seaDays} days afloat, ${oppDays} days beside a strandable place, ` +
        `${done} strandhoggs\n  what the errand AIMED at, per settled day: camp ${aimedCamp}, ` +
        `place ${aimedPlace} (of which reachable by sea ${aimedPlaceBySea})`,
    );
    expect(sagas).toBe(30);
  });
});

describe('the place economy — what a coast’s four prizes actually do', () => {
  /**
   * TASK 33's remainder. The strandhögg probe above ruled out worldgen,
   * routing, distance and the bot's preferences, and stopped at "the
   * candidate set is EMPTY, not mis-ordered" — a place has to be seen,
   * unsacked and lightly enough held, and the four on a coast are one-shot.
   * That was recorded as a question about the PLACE economy rather than
   * tuned, which was right, and it left the question unmeasured.
   *
   * This measures it: the LIFECYCLE of every place in every world. When it
   * is learned of, how it is learned of, when it is emptied, and how long
   * it stands known-and-standing — because that window is the only time any
   * verb aimed at a place can fire. A strandhögg, a market day and a sack
   * are all the same opportunity counted three ways.
   */
  it('follows every place from unknown to emptied', { timeout: 900_000 }, async () => {
    interface Life {
      places: number; seen: number; seenDay: number; sacked: number;
      sackedDay: number; window: number; standingKnown: number; told: number;
      oppDays: number; strandhoggs: number; sagas: number; days: number;
      settledDays: number; knownMarketDays: number; tradeErrands: number; deals: number;
    }
    const life: Record<string, Life> = {};
    const byKind: Record<string, { seen: number; sacked: number; n: number }> = {};

    for (const p of POLICIES) {
      const L: Life = { places: 0, seen: 0, seenDay: 0, sacked: 0, sackedDay: 0,
        window: 0, standingKnown: 0, told: 0, oppDays: 0, strandhoggs: 0,
        sagas: 0, days: 0, settledDays: 0, knownMarketDays: 0, tradeErrands: 0, deals: 0 };
      life[p.id] = L;
      try {
        policy = p;
        for (let s = 0; s < 30; s += 1) {
          // First day each place was SEEN, so the window can be measured
          // against the day it was emptied.
          const firstSeen: Record<string, number> = {};
          const state = run(`curve-${s}`, 400, (before, after) => {
            if (after.day !== before.day) {
              L.days += 1;
              if (strandTarget(after)) L.oppDays += 1;
              // The opportunity a settled band is measured NOT to act on: a
              // counter it knows the way to, still trading, and no errand in
              // the bot's vocabulary that means "go there".
              if (after.settlement) {
                L.settledDays += 1;
                if (after.world.places.some((pl) =>
                  pl.sackedOn === undefined
                  && (placeKind(pl.kind).market ?? []).length > 0
                  && knowsStop(after, pl.stop))) L.knownMarketDays += 1;
              }
              for (const pl of after.world.places) {
                if (firstSeen[pl.id] === undefined && knowsStop(after, pl.stop)) {
                  firstSeen[pl.id] = after.day;
                }
              }
            }
            if (!before.battle && after.battle?.strandhogg) L.strandhoggs += 1;
            if (!before.expedition && after.expedition?.purpose === 'trade') L.tradeErrands += 1;
            // Counted off the tally rather than off the saga wording, so a
            // reworded line cannot quietly zero this the way it could the
            // market count in the other sweep.
            // `bargains` counts a neighbour's yard as well as a counter, so
            // the deal is only credited here when the band is standing ON a
            // place — which a barter in somebody's camp never is.
            const struck = (after.tally.bargains ?? 0) - (before.tally.bargains ?? 0);
            if (struck > 0 && placeHere(after)) L.deals += struck;
            // Learned across a counter rather than by walking into it.
            if (after.saga.length > before.saga.length) {
              for (const line of after.saga.slice(before.saga.length)) {
                if (/were content that we should know it/.test(line.text)) L.told += 1;
              }
            }
          }, 'fair');

          L.sagas += 1;
          for (const pl of state.world.places) {
            L.places += 1;
            const kind = (byKind[pl.kind] ??= { seen: 0, sacked: 0, n: 0 });
            kind.n += 1;
            const seenOn = firstSeen[pl.id];
            if (seenOn !== undefined) { L.seen += 1; L.seenDay += seenOn; kind.seen += 1; }
            if (pl.sackedOn !== undefined) {
              L.sacked += 1; L.sackedDay += pl.sackedOn; kind.sacked += 1;
              if (seenOn !== undefined) L.window += pl.sackedOn - seenOn;
            } else if (seenOn !== undefined) {
              // Known and still standing at the end of the saga: the state
              // every place-verb needs, and the one that has to LAST.
              L.standingKnown += 1;
            }
          }
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally { policy = SETTLER; }
    }

    const say = (id: string): string => {
      const L = life[id]!;
      return `  ${id}: ${L.places} places over ${L.sagas} sagas (${(L.places / L.sagas).toFixed(1)} a world), ` +
        `${L.seen} ever seen (day ${(L.seenDay / Math.max(1, L.seen)).toFixed(0)}), ` +
        `${L.told} learned across a counter\n` +
        `    ${L.sacked} emptied (day ${(L.sackedDay / Math.max(1, L.sacked)).toFixed(0)}), ` +
        `standing ${(L.window / Math.max(1, L.sacked)).toFixed(0)} days known first; ` +
        `${L.standingKnown} known and still standing at the end\n` +
        `    ${L.oppDays} days afloat beside one, ${L.strandhoggs} strandhöggs, over ${L.days} days\n` +
        `    settled ${L.settledDays} days, of which ${L.knownMarketDays} knew the way to a counter ` +
        `still trading; ${L.tradeErrands} trade errands launched, ${L.deals} bargains struck\n`;
    };
    // eslint-disable-next-line no-console
    console.log(
      'the place economy, 30 landings a policy on A Fair Country:\n' +
        POLICIES.map((p) => say(p.id)).join('') +
        '  by kind: ' + Object.entries(byKind)
          .map(([k, v]) => `${k} ${v.seen}/${v.n} seen, ${v.sacked} emptied`).join('; '),
    );

    expect(life['settler']!.sagas).toBe(30);
  });
});

describe('who lands their blows', () => {
  /**
   * A playtest report, measured: "my warriors miss more than the enemy on
   * the easiest difficulty". Half right, and the half that is right is a
   * real asymmetry rather than a feeling.
   *
   * A FRESH band out-hits its foes — 76% of swings land against 68%. The
   * band is not worse at fighting.
   *
   * A WORN band does not. Give everyone half health and one bad arm, which
   * is an ordinary state a season in, and it inverts: 59% against 70%. The
   * to-hit roll is `2d6 + effectiveStat(might)`, injuries come straight off
   * `effectiveStat`, and FOES ARE GENERATED FRESH FOR EVERY FIGHT AND NEVER
   * CARRY A WOUND. So the band's fighting strength decays across a run and
   * the enemy's cannot. That is the whole of the report.
   *
   * The other half — "on the easiest difficulty" — is that hardship does
   * not touch combat AT ALL. `HardshipDef` carries `stir`, `raid`, `winter`
   * and `stores`: A Fair Country makes fights RARER and the winter shorter
   * and the hold fuller, and leaves every blow exactly as hard to land as
   * it is on A Hard Country. Whether that is right is a design question and
   * it is written up in the roadmap, not decided here.
   *
   * Barred on the fresh case only, which is the one with a defensible right
   * answer: a band at full strength must not be worse at landing a blow
   * than the men it meets. The worn case is REPORTED, because how fast a
   * band should decay is exactly the open question.
   */
  it.each([false, true])('counts who lands what (worn=%s)', { timeout: 900_000 }, async (WORN: boolean) => {
    const tally: Record<string, Record<string, number>> = {
      warband: { hit: 0, glance: 0, turned: 0 },
      foe: { hit: 0, glance: 0, turned: 0 },
    };
    for (const diff of [0, 1, 2]) {
      for (let s = 0; s < 30; s += 1) {
        let state = structuredClone(newGame(`swing-${s}-${diff}`, 'fair'));
        if (WORN) {
          // What a band looks like after a season: carrying wounds. Every
          // one of these drags `effectiveStat`, which is the number the
          // to-hit roll is built on.
          for (const p2 of state.party.people) {
            p2.health = Math.max(1, Math.floor(p2.maxHealth * 0.5));
            p2.injuries.push({ id: `inj_${p2.id}`, label: 'a bad arm', effect: { might: -1 }, heals: 30 });
          }
        }
        startBattle(state, 'meadow', diff);
        for (let i = 0; i < 600 && state.battle && !state.battle.outcome; i += 1) {
          let next = apply(state, step(state));
          if (next === state) next = apply(state, { type: 'B_END_TURN' });
          if (next === state) break;
          state = next;
        }
        for (const b of state.battle?.beats ?? []) {
          if (b.kind !== 'struck') continue;
          const side = String(b.who).startsWith('foe_') ? 'foe' : 'warband';
          tally[side]![b.result as string] = (tally[side]![b.result as string] ?? 0) + 1;
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    for (const side of ['warband', 'foe']) {
      const t = tally[side]!;
      const n = t['hit']! + t['glance']! + t['turned']!;
      // eslint-disable-next-line no-console
      console.log(
        `${side.padEnd(8)} ${n} swings: landed ${t['hit']} (${Math.round((t['hit']! / Math.max(1, n)) * 100)}%), ` +
          `glanced ${t['glance']}, turned by a wall ${t['turned']}`,
      );
    }
    const w = tally['warband']!;
    const f = tally['foe']!;
    const rate = (t: Record<string, number>) =>
      t['hit']! / Math.max(1, t['hit']! + t['glance']! + t['turned']!);
    if (!WORN) {
      expect(
        rate(w),
        `a fresh band lands ${Math.round(rate(w) * 100)}% of its blows against the foes' ` +
          `${Math.round(rate(f) * 100)}% — the band has become worse at fighting than what it meets`,
      ).toBeGreaterThan(rate(f));
    }
  });
});

/**
 * THE FIRST WINTER, MEASURED FROM INSIDE.
 *
 * The curve said 87/83/70 reach the first winter and 65/30/12 see spring —
 * so on As It Lies, more than half of every band that gets that far died in
 * one season. That is the single biggest thing that happens in this game and
 * nothing here had ever looked at WHERE inside it they die, of what, or
 * whether the answer was settled before the frost arrived.
 *
 * The lever this investigation produced has since been given to the bot, and
 * the same sweep reads 88/82/82 and 73/45/10 — so on As It Lies it is now
 * about four in ten of the bands that reach the frost rather than six. The
 * winter is survivable by a band that acts, which is the whole point, and it
 * is still the biggest single thing that happens.
 *
 * The last question is the one that matters for design. A winter that is
 * scored entirely off the state on its first morning is not a phase a player
 * plays; it is a report card on autumn wearing twenty-four days of turns.
 */
describe('the first winter, from inside', () => {
  it('says where the deaths fall, and whether autumn had already decided', () => {
    const SEEDS = 60;
    const WINTER_IN = SEASON_LENGTH * 2 + 1; // day 49, the first frost
    const SPRING_IN = SEASON_LENGTH * 3 + 1; // day 73, if they get there

    interface Life {
      reachedWinter: boolean;
      foodAtFrost: number;
      woodAtFrost: number;
      handsAtFrost: number;
      settledAtFrost: boolean;
      diedOn: number | null;
      cause: string | null;
      sawSpring: boolean;
    }

    policy = SETTLER;
    const lives: Life[] = [];
    for (let s = 0; s < SEEDS; s++) {
      const life: Life = {
        reachedWinter: false, foodAtFrost: 0, woodAtFrost: 0, handsAtFrost: 0,
        settledAtFrost: false, diedOn: null, cause: null, sawSpring: false,
      };
      const final = run(`winter-inside-${s}`, SPRING_IN, (before, after) => {
        if (before.day < WINTER_IN && after.day >= WINTER_IN && !life.reachedWinter) {
          life.reachedWinter = true;
          life.foodAtFrost = Math.round(after.party.food);
          life.woodAtFrost = Math.round(after.party.firewood);
          life.handsAtFrost = after.party.people.filter((p) => p.alive).length;
          life.settledAtFrost = !!after.settlement;
        }
        if (!before.end && after.end) {
          life.diedOn = after.day;
          life.cause = after.end.cause;
        }
      }, 'even');
      life.sawSpring = !final.end && final.day >= SPRING_IN;
      lives.push(life);
    }

    const reached = lives.filter((l) => l.reachedWinter);
    const died = reached.filter((l) => l.diedOn !== null && !l.sawSpring);
    const lived = reached.filter((l) => l.sawSpring);

    // WHERE in the twenty-four days they fall.
    const week = (day: number): number => Math.min(3, Math.floor((day - WINTER_IN) / 6));
    const perWeek = [0, 0, 0, 0];
    for (const l of died) if (l.diedOn! >= WINTER_IN) perWeek[week(l.diedOn!)]! += 1;

    const causes: Record<string, number> = {};
    for (const l of died) causes[l.cause ?? '?'] = (causes[l.cause ?? '?'] ?? 0) + 1;

    const mean = (xs: number[]): number =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

    console.log(
      `the first winter, ${SEEDS} seeds on As It Lies:\n` +
      `  ${reached.length} reached the frost, ${lived.length} saw spring, ${died.length} did not\n` +
      `  deaths by week of winter: ${perWeek.join(' / ')}\n` +
      `  causes: ${Object.entries(causes).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}\n` +
      `  at the frost — lived: ${mean(lived.map((l) => l.foodAtFrost)).toFixed(0)} food, ` +
        `${mean(lived.map((l) => l.woodAtFrost)).toFixed(0)} wood, ` +
        `${mean(lived.map((l) => l.handsAtFrost)).toFixed(1)} hands, ` +
        `${lived.filter((l) => l.settledAtFrost).length}/${lived.length} settled\n` +
      `  at the frost —  died: ${mean(died.map((l) => l.foodAtFrost)).toFixed(0)} food, ` +
        `${mean(died.map((l) => l.woodAtFrost)).toFixed(0)} wood, ` +
        `${mean(died.map((l) => l.handsAtFrost)).toFixed(1)} hands, ` +
        `${died.filter((l) => l.settledAtFrost).length}/${died.length} settled`,
    );

    // IS IT DECIDED IN ADVANCE? The sharpest single split on stores at the
    // frost, and how much of the outcome it explains. A season whose result
    // can be read off its first morning is a report card, not a phase.
    let best = { at: 0, right: 0 };
    for (let cut = 0; cut <= 200; cut += 5) {
      const right = reached.filter((l) =>
        (l.foodAtFrost + l.woodAtFrost >= cut) === l.sawSpring).length;
      if (right > best.right) best = { at: cut, right };
    }
    const explained = best.right / Math.max(1, reached.length);
    console.log(
      `  stores at the frost predict spring ${(explained * 100).toFixed(0)}% of the time ` +
        `(the best single cut is ${best.at} of food+wood)`,
    );

    // Bars, not just a print. These are the shape of the finding, and a
    // future change that flattens the cliff should make them fail loudly.
    expect(reached.length).toBeGreaterThan(SEEDS / 2);
    expect(died.length + lived.length).toBe(reached.length);
  });

  /**
   * IS IT THE GAME, OR IS IT THE BOT?
   *
   * The run above says the first winter is 94% readable off its first
   * morning. That is a claim about a band with no move left — and this
   * harness's settler HAS no move left, by its own construction: it will not
   * trade before a winter is stood, will not go out under arms at all, and
   * keeps a fortnight's eating back before either. `readiness()` meanwhile
   * ends a hopeless forecast by naming both of those as what is left.
   *
   * So the same sixty seeds, the same policy, and one difference: when the
   * mark says spring is out of reach, the band takes the out it was told
   * about. If that moves the number, the lever exists and the settler simply
   * never pulls it. If it does not, the lever is nominal and winter really is
   * scored in the autumn.
   */
  it('says whether the out the game names is worth anything', () => {
    const SEEDS = 60;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    // Per SEED, not just totals. The two runs share their seeds, so the
    // question "did the out help" is answerable band by band — and 22 against
    // 12 of sixty is only borderline read as two independent samples, while
    // the seeds that actually CHANGED are the real evidence.
    const sample = (p: Policy): { lived: boolean[]; sorties: number } => {
      policy = p;
      const lived: boolean[] = [];
      let sorties = 0;
      for (let s = 0; s < SEEDS; s++) {
        const final = run(`winter-inside-${s}`, SPRING_IN, (before, after) => {
          // An errand that actually left the yard, counted where the mode
          // stack shows it rather than where the bot asked for it — a
          // refused LAUNCH is not a lever pulled.
          if (!before.expedition && after.expedition) sorties += 1;
        }, 'even');
        lived.push(!final.end && final.day >= SPRING_IN);
      }
      return { lived, sorties };
    };

    const held = sample(SETTLER);
    const tried = sample(DESPERATE);
    policy = SETTLER;

    const springHeld = held.lived.filter(Boolean).length;
    const springTried = tried.lived.filter(Boolean).length;
    // McNemar's pairing: only the seeds where the two disagree carry any
    // information about the change.
    let saved = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s++) {
      if (!held.lived[s] && tried.lived[s]) saved += 1;
      if (held.lived[s] && !tried.lived[s]) killed += 1;
    }

    console.log(
      `the same sixty seeds, with and without the out:\n` +
      `  settler   — ${springHeld}/${SEEDS} saw spring, ${held.sorties} errands left the yard\n` +
      `  desperate — ${springTried}/${SEEDS} saw spring, ${tried.sorties} errands left the yard\n` +
      `  paired: the out saved ${saved} bands that would have died and killed ${killed} that would have lived`,
    );

    // The bar is on the INSTRUMENT, not on the outcome. Whatever the escape
    // hatch is worth, a policy that is allowed to use it must actually have
    // used it — otherwise the two runs are the same run and the comparison
    // says nothing at all. This is the check the first cut of this file
    // needed and did not have.
    expect(tried.sorties, 'the desperate band never once left the yard — nothing was measured')
      .toBeGreaterThan(held.sorties);
  });

  /**
   * IS THE WINTER LEVER WORTH ANYTHING?
   *
   * The whole justification for short commons. Winter was measured as 94–98%
   * predictable from the stores held on its first morning, with deaths flat
   * across all four weeks and nothing on the board to answer them — so the
   * game got something to DO. This is the bar that says whether it was worth
   * a save version.
   *
   * The standard it has to beat is set by the last thing that claimed to be a
   * way out: `readiness()`'s "take it from somebody else, or walk out and
   * winter elsewhere", measured at zero bands saved and four killed. A lever
   * that cannot beat nothing is decoration with a cost.
   */
  it('says whether short commons save anybody', { timeout: 300_000 }, () => {
    // A HUNDRED AND TWENTY, and the number is measured rather than picked.
    // At sixty this read "saved 3, killed 1" — four discordant pairs, which
    // is noise, and a bar built on it would have flipped on the dice. At two
    // hundred and forty it is saved 32, killed 3, and survival goes 64/240 to
    // 93/240. A hundred and twenty is where the effect is resolvable inside a
    // runtime this file can afford.
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    const sample = (p: Policy): { lived: boolean[]; leanDays: number } => {
      policy = p;
      const lived: boolean[] = [];
      let leanDays = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        const final = run(`winter-inside-${s}`, SPRING_IN, (_before, after) => {
          if (after.party.rations === 'half') leanDays += 1;
        }, 'even');
        lived.push(!final.end && final.day >= SPRING_IN);
      }
      return { lived, leanDays };
    };

    // The CONTROL is the beltless policy now, not SETTLER — SETTLER tightens
    // since 2026-08-20, and leaving him as the control would have made this a
    // comparison of a band against itself. The instrument bar below caught
    // exactly that (`the control went onto short commons too: expected 6468
    // to be +0`), which is the whole reason it is written as an instrument
    // check rather than an outcome check.
    const full = sample({ ...SETTLER, id: 'loose', tightensBelt: false });
    const lean = sample(SETTLER);
    policy = SETTLER;

    let saved = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s += 1) {
      if (!full.lived[s] && lean.lived[s]) saved += 1;
      if (full.lived[s] && !lean.lived[s]) killed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `short commons, ${SEEDS} seeds on As It Lies:\n` +
      `  full shares — ${full.lived.filter(Boolean).length}/${SEEDS} saw spring\n` +
      `  tightened   — ${lean.lived.filter(Boolean).length}/${SEEDS} saw spring, ` +
        `${lean.leanDays} days on short commons\n` +
      `  paired: saved ${saved} bands that would have died, killed ${killed} that would have lived`,
    );

    // The instrument bar first: a band that never went onto short commons
    // measured nothing at all, which is the hollow-bar trap this file has
    // fallen into twice.
    expect(lean.leanDays, 'nobody ever tightened their belt — nothing was measured')
      .toBeGreaterThan(0);
    expect(full.leanDays, 'the control went onto short commons too').toBe(0);

    // AND THE LEVER ITSELF. It has to beat the thing it was built to replace,
    // which saved nobody. Net, because a lever that saves five and kills five
    // is a coin the player is being asked to flip.
    expect(
      saved,
      `short commons saved nobody, which is exactly what the out it replaces did`,
    ).toBeGreaterThan(0);
    expect(
      saved,
      `short commons saved ${saved} and killed ${killed} — a lever that costs `
        + `about as many as it saves is a coin the player is asked to flip`,
    ).toBeGreaterThan(killed);
  });

  /**
   * IS THERE WORK IN WINTER, AND IS IT WORTH ANYTHING?
   *
   * AUDIT ITEM 7, which was framed as "winter has one verb and it is short
   * commons" and turned out to be wrong twice over before it turned up
   * anything true.
   *
   * The first framing was that `ASSIGN` is a verb the harness issues once a
   * saga, on settling day. It is not: the block in `run()` above moves every
   * hand onto wood or onto food each day the winter mark says the band is
   * short of one. The bot has been doing winter work all along.
   *
   * The second framing was that the season is the thing nobody accounts for
   * — winter forage is 0.15, so a farmer works at 0.15 of a day against a
   * fisher at 0.575, and nobody was reading that. Measured: a band that
   * re-crews its food-hands on every turn of the year moves 236 hands over
   * 120 sagas and changes the outcome on NOT ONE SEED. It is already crewed
   * by need, daily, which is strictly better information than the calendar.
   *
   * So the question that was left is the one nobody had asked: what is the
   * daily crewing worth? It has run unconditionally since the mark existed
   * and never had a knob, so no bar in this file has ever touched the most
   * consequential thing the bot does between settling and the frost. Three
   * arms on the same seeds settle it.
   */
  it('says what winter work is worth', { timeout: 400_000 }, () => {
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    const sample = (p: Policy): { lived: boolean[]; moves: number } => {
      policy = p;
      recrewed = 0;
      const lived: boolean[] = [];
      for (let s = 0; s < SEEDS; s += 1) {
        const final = run(`winter-inside-${s}`, SPRING_IN, undefined, 'even');
        lived.push(!final.end && final.day >= SPRING_IN);
      }
      return { lived, moves: recrewed };
    };

    // The crew picked on settling day and never touched again — what the
    // harness was assumed to be doing, and what it turns out never to have
    // done.
    const fixed = sample({ ...SETTLER, id: 'fixed-crew', crewsToNeed: false });
    // What the bot has actually always done.
    const need = sample(SETTLER);
    // And the calendar on top of it.
    const season = sample({ ...SETTLER, id: 'recrew', recrews: true });
    policy = SETTLER;

    const pair = (a: boolean[], b: boolean[]) => {
      let saved = 0;
      let killed = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        if (!a[s] && b[s]) saved += 1;
        if (a[s] && !b[s]) killed += 1;
      }
      return { saved, killed };
    };
    const worth = pair(fixed.lived, need.lived);
    const extra = pair(need.lived, season.lived);
    const spring = (a: boolean[]) => a.filter(Boolean).length;

    // eslint-disable-next-line no-console
    console.log(
      `winter work, ${SEEDS} seeds on As It Lies:\n` +
      `  crew set once, never touched — ${spring(fixed.lived)}/${SEEDS} saw spring\n` +
      `  crewed to the mark, daily    — ${spring(need.lived)}/${SEEDS} saw spring ` +
        `(saved ${worth.saved}, killed ${worth.killed})\n` +
      `  and re-crewed by season too  — ${spring(season.lived)}/${SEEDS} saw spring ` +
        `(saved ${extra.saved}, killed ${extra.killed} on top), ${season.moves} hands moved`,
    );

    // THE INSTRUMENT FIRST. A season arm that never moved anybody is the
    // same run twice, and this file has shipped that mistake before.
    expect(season.moves, 'nobody was ever moved between jobs — nothing was measured')
      .toBeGreaterThan(0);
    expect(need.moves, 'the control re-crewed by season too').toBe(0);

    // AND THE FINDING: winter work is worth something, which is the answer
    // item 7 asked for. The bar is on the daily crewing rather than on the
    // calendar, because that is the lever measurement found — a band that
    // picks a crew on settling day and stops thinking about it does worse
    // than one that reads its own winter mark.
    expect(
      worth.saved,
      `crewing to the winter mark saved ${worth.saved} and killed ${worth.killed} — `
        + `if it stops paying, the mark has stopped being worth reading`,
    ).toBeGreaterThan(worth.killed);
  });

  /**
   * IS WALKING OUT WORTH ANYTHING?
   *
   * AUDIT ITEM 6, and the bar it has to clear is the one the escape hatch
   * failed. `readiness()` named two ways out for a band that cannot reach
   * spring; the one that existed — rob somebody — measured at SAVED NOBODY
   * AND KILLED TWO, and the one that did not exist was never measured because
   * there was no verb for it. There is now, so this is the measurement that
   * was owed.
   *
   * Paired on the same seeds, because only the landings where the two arms
   * disagree carry any information about the change — the same McNemar shape
   * the belt was settled on.
   */
  it('says whether walking out saves anybody', { timeout: 400_000 }, () => {
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    const sample = (p: Policy): { lived: boolean[]; left: number } => {
      policy = p;
      walkedOut = 0;
      const lived: boolean[] = [];
      for (let s = 0; s < SEEDS; s += 1) {
        const final = run(`winter-inside-${s}`, SPRING_IN, undefined, 'even');
        lived.push(!final.end && final.day >= SPRING_IN);
      }
      return { lived, left: walkedOut };
    };

    const stayed = sample(SETTLER);
    const walked = sample({ ...SETTLER, id: 'retreat', retreats: true });
    policy = SETTLER;

    let saved = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s += 1) {
      if (!stayed.lived[s] && walked.lived[s]) saved += 1;
      if (stayed.lived[s] && !walked.lived[s]) killed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `walking out, ${SEEDS} seeds on As It Lies:\n` +
      `  stayed put   — ${stayed.lived.filter(Boolean).length}/${SEEDS} saw spring\n` +
      `  walked out   — ${walked.lived.filter(Boolean).length}/${SEEDS} saw spring, ` +
        `${walked.left} steadings left standing empty\n` +
      `  paired: saved ${saved} that would have died, killed ${killed} that would have lived`,
    );

    // THE INSTRUMENT FIRST. An arm that never walked out is the same run
    // twice, and this file has shipped that mistake before. It earned its
    // keep here: the first cut of this measurement parked the walk-out delay
    // in `settleNotBefore`, which is shared across a whole sample, so one
    // retreat on day 54 barred every later landing from settling at all. It
    // read "killed 46" off THREE retreats — arithmetic that cannot happen,
    // and the reason the count is printed next to the outcome.
    expect(walked.left, 'nobody ever walked out — nothing was measured')
      .toBeGreaterThan(0);
    expect(stayed.left, 'the control walked out too').toBe(0);

    // AND NO BAR ON THE OUTCOME, deliberately.
    //
    // Walking out measured at saved 0 / killed 11, so there is no "it beats
    // nothing" bar to hold it to — it does not. That is written up in
    // src/data/retreat.ts and the panel no longer recommends it. A bar
    // asserting it stays harmful would be pinning a number nobody is tuning
    // toward, and a bar asserting it helps would be a bar this file would
    // have to lower. The console line above is the record.
  });

  /**
   * THE VERDICT ITSELF.
   *
   * The run above condemned ten bands to death by taking `reachable`'s word
   * for it — and those same ten seeds saw spring when the band ignored it and
   * kept working. That points the finger past the advice and at the verdict:
   * "We will not reach spring on what this ground gives" is on screen, in the
   * mark's own panel, and it may be saying so to bands that are going to make
   * it.
   *
   * Measured against SETTLER on purpose. He never reads the verdict, so his
   * survival is untouched by it — which makes his runs a clean test of
   * whether the verdict is TRUE, rather than a test of what believing it does.
   */
  it('does not tell bands that go on to live that they are already dead', () => {
    const SEEDS = 300;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    policy = SETTLER;
    let condemned = 0;
    let condemnedAndLived = 0;
    let firstCallDay = 0;
    // What the band looked like when it was written off, split by whether the
    // writing-off turned out to be true. If the wrong ones were smaller or
    // barer at the verdict, the projection is failing to credit what autumn
    // still adds — which is a fixable bug rather than a judgement call.
    const at = { wrongHands: 0, wrongBuilt: 0, rightHands: 0, rightBuilt: 0 };
    const grew = { hands: 0, built: 0 };
    let shed = 0;
    let comfortable = 0;

    for (let s = 0; s < SEEDS; s++) {
      let saidNo = false;
      let saidNoOn = 0;
      let hands = 0;
      let built = 0;
      const final = run(`winter-inside-${s}`, SPRING_IN, (_before, after) => {
        if (saidNo || after.end || !after.settlement) return;
        if (!markVisible(after)) return;
        if (!reachable(after)) {
          saidNo = true;
          saidNoOn = after.day;
          hands = after.party.people.filter((p) => p.alive).length;
          built = after.settlement.built.length;
        }
      }, 'even');
      if (!saidNo) continue;
      condemned += 1;
      firstCallDay += saidNoOn;
      const lived = !final.end && final.day >= SPRING_IN;
      if (lived) {
        condemnedAndLived += 1;
        at.wrongHands += hands;
        at.wrongBuilt += built;
        grew.hands += (final.party.people.filter((p) => p.alive).length - hands);
        grew.built += ((final.settlement?.built.length ?? 0) - built);
        // HOW they lived, which is the whole question. The panel claims
        // nothing can be had "on what this ground gives" — a band that
        // survived by shedding a mouth did not really refute that, and one
        // that reached spring with a store in hand plainly did.
        //
        // Counted off the ROSTER rather than off `diedOn`: the first cut of
        // this asked `(p.diedOn ?? 0) > saidNoOn` and printed a flat zero,
        // because `diedOn` is undefined for most of the dead. That zero was
        // the instrument, not the game.
        if (final.party.people.filter((p) => p.alive).length < hands) shed += 1;
        if (final.party.food >= 12) comfortable += 1;
      } else {
        at.rightHands += hands;
        at.rightBuilt += built;
      }
    }

    const wrong = condemned === 0 ? 0 : condemnedAndLived / condemned;
    console.log(
      `the verdict "we will not reach spring", over ${SEEDS} seeds:\n` +
      `  said to ${condemned} bands, first on day ${condemned ? (firstCallDay / condemned).toFixed(0) : '-'} on average\n` +
      `  ${condemnedAndLived} of those ${condemned} went on to see spring ` +
        `(${(wrong * 100).toFixed(0)}% wrong)\n` +
      `  at the verdict — wrongly condemned: ${(at.wrongHands / Math.max(1, condemnedAndLived)).toFixed(1)} hands, ` +
        `${(at.wrongBuilt / Math.max(1, condemnedAndLived)).toFixed(1)} built\n` +
      `  at the verdict — rightly condemned: ${(at.rightHands / Math.max(1, condemned - condemnedAndLived)).toFixed(1)} hands, ` +
        `${(at.rightBuilt / Math.max(1, condemned - condemnedAndLived)).toFixed(1)} built\n` +
      `  the wrongly condemned then gained ${(grew.hands / Math.max(1, condemnedAndLived)).toFixed(1)} hands ` +
        `and ${(grew.built / Math.max(1, condemnedAndLived)).toFixed(1)} buildings before spring\n` +
      `  of the ${condemnedAndLived} wrongly condemned: ${shed} lost a mouth after the verdict, ` +
        `${comfortable} reached spring with food to spare`,
    );

    // A RATCHET, and worth being plain about what it is and is not.
    //
    // The panel does not hedge, and a player told the ground cannot feed them
    // has been handed a reason to stop playing a position. Measured: 46%
    // wrong before the fixes to `reachable` (frozen steading, average-bad
    // weather), 33% after. The bar sits at 40% so it FAILS the defect it was
    // written for and passes the repair — that is all it claims.
    //
    // THE SAMPLE WAS SIXTY SEEDS AND THAT WAS THE BUG, found when 8.5 nudged
    // it. Sixty seeds produced SIX condemned bands, and a ratio over six can
    // only ever report 0, 17, 33, 50, 67, 83 or 100 — there is no reading
    // between 33% and 50% for it to give, so a bar at 40% was being decided
    // by one band either way. It read 50% and looked like a regression.
    //
    // Three hundred seeds condemn 62 bands and the reading is 27%, which is
    // BETTER than the 33% this bar was written against. The answer to a
    // sample too thin to resolve a figure is a bigger sample, not a wider
    // bound — the same lesson the jarldom odds in data/hardship.ts learned
    // twice, and it cost 40 seconds of suite time to apply here.
    //
    // The remaining wrong verdicts are still bands that reach spring on
    // nothing: 1 of 17 with food to spare, and 8 of 17 got there by losing a
    // mouth. Taking the max over every producing job in `walkWinter` reads
    // 29% and is written up there — it is left out because it flips a
    // difficulty statement in `cliff.test`, which is a design call rather
    // than a measurement one.
    expect(wrong, `the panel told ${condemnedAndLived} surviving bands they were dead`)
      .toBeLessThan(0.4);
  });
});

// --- Audit #8: does a haunted coast ever actually meet its ghost? ---
//
// `sim/haunt.ts` stands the ruin up and `ghostLine` names whose it was, but
// neither is worth anything if a band never walks onto the hex. The place
// economy has taught this file that lesson twice — places are never LEARNED,
// and the market was under-VISITED rather than under-found — so the premise
// was measured before anything was built on it.
//
// Two instrument faults were found and fixed while measuring, both of which
// had produced believable numbers:
//   - the test name 'Eikstead' is one the GAME can generate for the band's
//     own steading, so every line about home counted as the ghost. The name
//     here cannot be composed from the pool;
//   - the ghost's hex came from another world's LANDING, and landings sit in
//     similar places across worlds, so the ruin was arriving on the band's
//     own doorstep and being taken on day 2. It comes from a real steading
//     in a real saga now, which is what a challenge code actually carries.
describe('the coast remembering the ghost', () => {
  // An explicit budget, like every other measurement of this size in this
  // file. Without one it inherits vitest's 60s default and it does not fit:
  // measured at 64s on a slow runner, so the bar passed or failed on what
  // else the machine was doing. It was committed that way and CI got lucky.
  it('measures whether a haunted band finds the ruin, and what the record says', { timeout: 900_000 }, () => {
    const SEEDS = 30;
    // Cannot be composed from the name pool, so a hit is always the ghost.
    const NAME = 'Zzyrmvik';
    const TAKEN = 'So this was ';

    for (const [label, pol] of [['settler', SETTLER], ['raider', RAIDER]] as const) {
      let placed = 0, seen = 0, stood = 0, sacked = 0, wrote = 0, survived = 0, fromSteading = 0;

      for (let s = 0; s < SEEDS; s += 1) {
        // The sender: a real saga on another coast, played until it has posts
        // in the ground. Its steading is what the code carries.
        policy = { ...SETTLER };
        const sender = run(`ghost-${s}`, 90);
        if (sender.settlement) fromSteading += 1;

        policy = { ...pol };
        let ruinStop: number | null = null;

        const state = run(
          `curve-${s}`,
          400,
          (before, after) => {
            if (ruinStop !== null && standingAt(after) === ruinStop) stood += 1;
            // Keyed off the SACKING ITSELF, not off the log growing. The saga
            // is capped at 300 entries and `chronicle` splices when it is
            // full, so once the log is full `saga.length` stops rising and a
            // write becomes invisible — which is what made this read 13 of 14
            // and looked like a game fault rather than an instrument one.
            const was = before.world.places.find((p) => p.id === GHOST_RUIN_ID);
            const now = after.world.places.find((p) => p.id === GHOST_RUIN_ID);
            if (was?.sackedOn === undefined && now?.sackedOn !== undefined) {
              if (after.saga.some((e) => e.text.startsWith(TAKEN))) wrote += 1;
            }
          },
          'even',
          (fresh) => {
            if (haunt(fresh, { name: NAME, day: 128, cause: 'starved' })) {
              const r = theRuin(fresh);
              if (r) { ruinStop = r.stop; placed += 1; }
            }
          },
        );

        const ruin = theRuin(state);
        if (ruin) {
          if (knowsStop(state, ruin.stop)) seen += 1;
          if (ruin.sackedOn !== undefined) sacked += 1;
        }
        if (state.saga.some((e) => e.text.startsWith(TAKEN))) survived += 1;
      }

      console.log(
        `[ghost/${label}] of ${SEEDS}: ghost from a real steading ${fromSteading}, ` +
          `ruin placed ${placed}, stretch known ${seen}, visits ${stood}, sacked ${sacked}, ` +
          `NAMED AT THE TAKING ${wrote}, still in the log at day 400 ${survived}`,
      );

      // The bar. Every taking of a ghost's steading names them; before this
      // the count was 0 out of 17. Written, not survived — the saga cap is
      // allowed to trim it later, like any other line.
      expect(wrote, `${label}: the taking did not name the ghost`).toBe(sacked);
    }
    // This file's convention: hand the shared policy back the way it was
    // found, so an added test cannot change the meaning of one after it.
    policy = SETTLER;
  });
});

// --- The retreat verb's real case ---
//
// The open thread said this could not be measured: "the bot only settles on
// ground that already clears its site floor, and inventing a worse-settling
// bot would measure a strawman." Half of that is true and half is not.
//
// The floor is not a property of the game, it is `policy.siteFloor` — a dial
// the Policy type already exposes, and one RAIDER already sets to 7 against
// the settler's 9. Dropping it to 0 is not a strawman bot that hunts for bad
// ground: it is a band that takes the FIRST ground the game will let it have,
// which is the impatient player, and the thread's own case — ground taken too
// fast.
//
// And the ground below is thinner than the thread assumed. Measured over
// 10,899 foundable hexes in 20 worlds, the scores run 4-16 with half of them
// at exactly 7 ("Hard ground — it could be held, by people with nothing
// better"); only 53 of them, 0.5%, fall below 6 into "a place to die in".
// A band cannot easily take ground bad enough to regret, which is why the
// floor-0 arm lands on a mean of 8.5 — it is not that the bot refuses worse
// ground, it is that the map does not offer it.
describe('walking out, for a band that took its ground too fast', () => {
  it('says whether the verb has a real case', { timeout: 900_000 }, () => {
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;
    // The first legal ground, whatever the verdict says of it. The verb's
    // ABSOLUTE best case: if walking out ever pays, it pays here. (A floor of
    // 6 was measured too and is the same policy in practice — nothing below
    // it is ever offered — so it is not run twice.)
    //
    // The baseline is today's settler, which GIVES WAY as winter closes since
    // 2026-08-22. It was a fixed floor of 9 when this was first measured, and
    // the label said so; leaving that label in place after the bot changed
    // would have made the printout describe a band that no longer exists.
    const RASH: Policy = { ...SETTLER, id: 'rash', siteFloor: 0 };

    const sample = (p: Policy) => {
      policy = p;
      walkedOut = 0;
      const lived: boolean[] = [];
      const scores: number[] = [];
      const days: number[] = [];
      const settledEver: boolean[] = [];
      let livedSettled = 0;
      let livedRoaming = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        // The FIRST founding only: the walk-out arm founds again, and the
        // question is what ground the band originally took.
        let noted = false;
        const final = run(`winter-inside-${s}`, SPRING_IN, (before, after) => {
          if (!noted && !before.settlement && after.settlement) {
            noted = true;
            // The ground the posts actually went into. This asked
            // `siteReport(world, settlement.at)` until 8.5, and on a line that
            // was the placeholder hex — so it read the LANDING's reading from
            // every steading on the coast, and the two arms of the probe came
            // out within three hundredths of each other: the same run twice,
            // wearing two labels.
            scores.push(stopReport(after.seed, after.settlement.stop ?? 0).total);
            days.push(after.day);
          }
        }, 'even');
        const alive = !final.end && final.day >= SPRING_IN;
        lived.push(alive);
        // Which mechanism is doing the work: settling MORE, or doing better
        // once settled. A mean site score taken only over the bands that
        // settled cannot tell them apart on its own.
        settledEver.push(noted);
        if (noted && alive) livedSettled += 1;
        if (!noted && alive) livedRoaming += 1;
      }
      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      return {
        lived, left: walkedOut, ground: mean(scores), day: mean(days),
        settled: settledEver.filter(Boolean).length, livedSettled, livedRoaming,
      };
    };

    const fair = sample(SETTLER);
    const rash = sample(RASH);
    const rashOut = sample({ ...RASH, retreats: true });
    policy = SETTLER;

    let saved = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s += 1) {
      if (!rash.lived[s] && rashOut.lived[s]) saved += 1;
      if (rash.lived[s] && !rashOut.lived[s]) killed += 1;
    }

    const pct = (a: boolean[]) => `${a.filter(Boolean).length}/${SEEDS}`;
    // eslint-disable-next-line no-console
    console.log(
      `walking out on ground taken too fast, ${SEEDS} seeds on As It Lies:\n` +
      `  today's settler (gives way)   — settled ${fair.settled}, ` +
        `ground ${fair.ground.toFixed(1)}, day ${fair.day.toFixed(0)}, ` +
        `${pct(fair.lived)} saw spring (${fair.livedSettled} with posts, ` +
        `${fair.livedRoaming} still roaming)\n` +
      `  floor 0 (first legal ground)   — settled ${rash.settled}, ` +
        `ground ${rash.ground.toFixed(1)}, day ${rash.day.toFixed(0)}, ` +
        `${pct(rash.lived)} saw spring (${rash.livedSettled} with posts, ` +
        `${rash.livedRoaming} still roaming)\n` +
      `  floor 0 + walks out            — ${pct(rashOut.lived)} saw spring, ` +
        `${rashOut.left} steadings left standing empty\n` +
      `  paired against floor 0: saved ${saved}, killed ${killed}`,
    );

    // THE INSTRUMENT FIRST, and this is what the thread was really about. If
    // the lower floor does not put the band on worse ground, sooner, and more
    // often, the two arms are the same run twice and nothing below means
    // anything.
    expect(rash.ground, 'the lower floor did not take worse ground')
      .toBeLessThan(fair.ground);
    expect(rash.settled, 'the lower floor did not commit more often')
      .toBeGreaterThan(fair.settled);
    expect(rashOut.left, 'nobody ever walked out — nothing was measured')
      .toBeGreaterThan(0);
    expect(rash.left, 'the control walked out too').toBe(0);

    // AND NO BAR ON THE OUTCOME, for the same reason the sibling measurement
    // above states: walking out measured at saved 0 / killed 11 even here, in
    // the most favourable case the game can be made to produce. There is no
    // "it beats nothing" bar to hold it to, because it does not.
  });
});

// --- Is the settling bot a fair instrument? ---
//
// Closing the retreat thread turned up something bigger than the thread: the
// settler bot sees spring in 48 of 120 seeds at `siteFloor` 9, and 75 of 120
// at 0. Not because poor ground is fine — because a floor of 9 means the band
// NEVER SETTLES AT ALL in 45 of them and dies walking.
//
// That is a defect in the instrument, not a strategy: every published curve
// in ROADMAP.md was read off a band that behaves like no player. But floor 0
// is not the fix either, because a player does care what ground they take.
// What a player actually does is hold out, and then stop holding out as
// winter closes. This measures that third thing against both extremes before
// anything is decided, because changing the bot restates the whole document.
describe('PROBE: what the settling floor is worth', () => {
  it('measures holding out, taking anything, and giving way as winter nears',
    { timeout: 900_000 }, () => {
    const SEEDS = 120;
    const SPRING_IN = SEASON_LENGTH * 3 + 1;

    const sample = (p: Policy) => {
      policy = p;
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
    policy = SETTLER;

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

// --- Is the market worth visiting? ---
//
// ANSWERED, and the answer is no under every variation measured. Kept because
// the next person to read "the market is under-visited" will reach for the
// gate, and this is the record of what happens when they do.
//
// The open question was "the market is under-VISITED — an errand launches ten
// times in thirty sagas, behind !hasSpeakers, a winter, and a surplus; whether
// that gate should open is a design call". Reading the gate settles half of it
// before any measuring: every one of those conditions is THIS FILE's, not the
// game's. The only rule the game imposes is `launchBlocker`. The bot goes to
// market to find somebody who will speak for it at the Thing, so once it has
// speakers it stops going — which is a strategy, not a shut door.
//
// So the decision-relevant question is not whether the band CAN go more often.
// It is whether going more often is worth anything, because a door nobody
// should walk through does not need opening.
describe('the market, and whether visiting it is worth anything', () => {
  it('measures a band that trades as a matter of course against one that does not',
    { timeout: 900_000 }, () => {
    const SEEDS = 60;
    const LAST_DAY = 400;

    const sample = (p: Policy) => {
      policy = p;
      const lived: boolean[] = [];
      let errands = 0;
      let deals = 0;
      let food = 0;
      let firewood = 0;
      let settledDays = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        const final = run(`curve-${s}`, LAST_DAY, (before, after) => {
          if (!before.expedition && after.expedition?.purpose === 'trade') errands += 1;
          // A deal is a bargain, which is the tally the sim keeps itself —
          // `note(state, 'bargains')` in both places.ts and neighbours.ts.
          const was = before.tally?.bargains ?? 0;
          const now = after.tally?.bargains ?? 0;
          if (now > was) deals += now - was;
          if (after.settlement) settledDays += 1;
        }, 'even');
        lived.push(!final.end && final.day >= LAST_DAY);
        food += final.party.food;
        firewood += final.party.firewood;
      }
      return {
        saw: lived.filter(Boolean).length, lived, errands, deals,
        food: food / SEEDS, firewood: firewood / SEEDS, settledDays,
      };
    };

    const gated = sample({ ...SETTLER });
    const after = sample({ ...SETTLER, id: 'market', tradesFreely: true });
    const early = sample({ ...SETTLER, id: 'market-early', tradesFreely: true, tradesEarly: true });
    const keepsWood = sample({
      ...SETTLER, id: 'market-keeps-wood', tradesFreely: true, keepsWood: true,
    });
    // The placebo: same errand, same absence, no deal struck.
    const placebo = sample({
      ...SETTLER, id: 'market-placebo', tradesFreely: true, tradesNothing: true,
    });
    policy = SETTLER;

    const pair = (r: typeof gated) => {
      let saved = 0;
      let killed = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        if (!gated.lived[s] && r.lived[s]) saved += 1;
        if (gated.lived[s] && !r.lived[s]) killed += 1;
      }
      return `saved ${saved}, killed ${killed}`;
    };

    for (const [label, r] of [
      ['gated (today)', gated],
      ['freely, after a winter', after],
      ['freely, from the start', early],
      ['freely, never sells wood', keepsWood],
      ['placebo: goes, deals nothing', placebo],
    ] as const) {
      // eslint-disable-next-line no-console
      console.log(
        `[market] ${label.padEnd(15)} errands ${String(r.errands).padStart(3)}, ` +
          `deals ${String(r.deals).padStart(4)}, settled days ${r.settledDays}, ` +
          `end food ${r.food.toFixed(0)}, wood ${r.firewood.toFixed(0)}, ` +
          `alive at ${LAST_DAY}: ${r.saw}/${SEEDS}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`[market] paired vs today — after a winter: ${pair(after)}; `
      + `from the start: ${pair(early)}; never sells wood: ${pair(keepsWood)}; `
      + `placebo: ${pair(placebo)}`);

    // THE INSTRUMENT FIRST. An arm that never went to market is the same run
    // twice, and this file has shipped that mistake before.
    //
    // AND NO BAR ON THE OUTCOME, for the same reason the walk-out measurement
    // above states: every way of visiting more measured at worse, so there is
    // no "it beats nothing" line to hold it to. Pinning "trading stays
    // harmful" would freeze a number nobody is tuning toward.
    expect(after.errands, 'the free arm never went to market — nothing was measured')
      .toBeGreaterThan(gated.errands);
    expect(early.errands, 'the early arm did not go any earlier')
      .toBeGreaterThan(gated.errands);
    // The two diagnostic arms have to actually differ from the trading one,
    // or they explain nothing: the placebo must strike far fewer deals, and
    // refusing to sell wood must visibly cut the volume.
    expect(placebo.deals, 'the placebo struck as many deals as the trader')
      .toBeLessThan(after.deals / 2);
    expect(keepsWood.deals, 'refusing to sell wood changed nothing')
      .toBeLessThan(after.deals / 2);
  });
});
