// Whether the mark can still be met, and what to tell the band about it.
//
// Split out of `winter.ts` on 2026-08-21. That file was 655 lines and these
// two are 265 of them: `reachable` alone is the longest function in the sim,
// because it is a whole second projection — it reassigns a clone and asks the
// forecast again, at full effort, to answer "is this still winnable from
// here". The mark says what is needed; this says whether it can be got.
//
// A stray doc comment was reunited with its function in the move. "One line
// naming where the band stands against the winter" had been sitting above
// `reachable` and describing `readiness`, 226 lines below it, which had none
// of its own. Nothing catches that but reading, and nobody reads 655 lines.

import type { GameState } from '../state/types';
import { nextThaw } from './calendar';
import { availableJobs, buildBlocker, output, shelterSaving } from './colony';
import { SHELTER_SAVES } from '../data/jobs';
import { BUILDINGS, buildingById } from '../data/buildings';
import { living } from './people';
import { bonus } from './lore';
import { foodPerDay } from './upkeep';
import { forecast, markVisible, plannedFirewood, ratio } from './winter';

/**
 * Whether the mark can still be met AT ALL, from here, at full effort.
 *
 * The winter mark has always told the truth about the gap and never about
 * whether the gap can be closed. A phone playtest found the difference the
 * hard way: day 26, no roof, nought wood of two hundred and seventy-four, a
 * band with forty-seven days to spring and no arrangement of six people that
 * reaches it — told only that they were "274 short", which reads like a
 * target. The harness then put a number on it: a band that settles by day 16
 * sees spring 21% of the time and one that settles on day 29 sees it 4%.
 * That is a cliff, and a cliff nobody is warned about is not difficulty.
 *
 * Deliberately NOT a parallel model. It reassigns a clone and asks the very
 * forecast the mark itself reads, so the two can never disagree — the same
 * rule that keeps the mark honest against the day tick.
 */
export function reachable(state: GameState): boolean {
  if (!state.settlement) return true;
  if (forecast(state).ready) return true;

  const crew = living(state.party.people);
  if (crew.length === 0) return false;
  const jobs = availableJobs(state);
  const onFoodJob = jobs.find((j) => j.id === 'hunter') ?? jobs.find((j) => j.produces === 'food');
  const onWoodJob = jobs.find((j) => j.produces === 'firewood');
  if (!onFoodJob || !onWoodJob) return false;

  // One projection, with the band free to move people between food and wood
  // as each day demands. A FIXED split was the first attempt and it fired on
  // 62 of 63 settled bands — no information at all beside a 76% base death
  // rate — because no single split survives a whole year: real bands hunt
  // while hunting is good and cut while the wood is dry, and a verdict has
  // to grant them that much sense before calling them dead.
  void crew;
  void onFoodJob;
  void onWoodJob;
  return survivesWinter(state);
}

/**
 * The shelter to plan the best case around.
 *
 * A roofless band burns firewood at a rate no six people can cut, which is
 * most of what killed the reported save — so a projection that leaves them
 * roofless condemns every band that has not built yet, including every band
 * that is about to. The best case therefore assumes the longhouse goes up:
 * free, instantly, timber and builder-days ignored. That is not a claim
 * about what will happen, it is the ceiling on what could, and a verdict
 * that only fires beneath the ceiling is a verdict worth trusting.
 */
function bestShelter(state: GameState): number {
  const roof = buildingById('longhouse')?.shelter ?? 3;
  return Math.max(shelterSaving(state), roof * SHELTER_SAVES + bonus(state, 'warmth'));
}

/**
 * The steading to plan the best case around — the same argument as
 * `bestShelter`, finally applied to the work as well as to the warmth.
 *
 * `bestShelter` has said since 6.1 that a projection which leaves the band
 * roofless condemns everyone who is about to build. That reasoning stopped at
 * the roof, and the harness caught what it cost: the verdict "we will not
 * reach spring on what this ground gives" was put to 26 bands in 60 sagas and
 * 12 of them saw spring anyway — 46% wrong, on a panel that does not hedge.
 * The wrongly condemned were not luckier or larger (5.4 hands against 5.3);
 * they were further along and still building, and they raised four and a half
 * more houses before the thaw that this walk credited them with none of.
 *
 * So the ceiling grants the buildings the band can actually PAY for, and
 * charges the wood — builder-days are forgiven, timber is not. The first cut
 * of this forgave timber too, on `bestShelter`'s precedent, and `cliff.test`
 * caught it immediately: a band on the best ground in the world with nought
 * wood was handed a whole steading and read as saveable. Timber IS firewood
 * here — the very store the walk goes on to spend — so a grant that ignores
 * it is not an optimistic projection, it is a different game.
 *
 * What it will not grant is anything the site itself refuses:
 * `buildBlocker` reads the raw report for that, so a band on bad ground is
 * still told the truth about it, which is the whole reason this verdict
 * exists.
 */
function bestSteading(state: GameState): GameState {
  const home = state.settlement;
  if (!home) return state;
  const built = [...home.built];
  // Its own party, because granting a building spends the wood.
  const probe: GameState = {
    ...state,
    party: { ...state.party },
    // The queue is emptied so `buildBlocker` reports what the ground allows
    // rather than what is already on the stocks.
    settlement: { ...home, built, queue: [] },
  };

  // Cheapest first, so a hut the band can afford is never crowded out by a
  // hall it cannot. Passes, not one sweep: `after` chains and `replaces`
  // mean granting one house is what makes the next one legal.
  const order = [...BUILDINGS].sort((a, b) => a.timber - b.timber);
  for (let pass = 0; pass < BUILDINGS.length; pass += 1) {
    let added = false;
    for (const b of order) {
      if (built.includes(b.id)) continue;
      // Null only — 'timber' means the wood is not there, and this ceiling
      // does not conjure wood.
      if (buildBlocker(probe, b) !== null) continue;
      // An upgrade takes the place of what it replaces rather than standing
      // beside it — without this the great hall would leave the longhouse in
      // the list and the band would be sheltered by both.
      if (b.replaces) {
        const at = built.indexOf(b.replaces);
        if (at >= 0) built.splice(at, 1);
      }
      built.push(b.id);
      probe.party.firewood -= b.timber;
      added = true;
    }
    if (!added) break;
  }
  return probe;
}

/**
 * Walks the stores forward day by day, letting the band move between food
 * and wood as each day demands, and reports whether they ever go under.
 *
 * This is NOT the forecast, and the difference is why the first cut of
 * `reachable` was wrong twice. `forecast` answers "what must be banked
 * TODAY", flooring each day's surplus at zero — deliberately, because a mark
 * that spends an imagined autumn is a mark that lies. That makes it useless
 * for "can they get there": it never credits the productive days still
 * ahead, so a healthy day-10 band with twenty of each read as doomed.
 * Replacing it with a projection under a FIXED split was the second miss —
 * no single split survives a year, so it condemned 62 of 63 settled bands.
 *
 * Same per-day helpers as the forecast and the day tick, so the three cannot
 * drift apart.
 */
function survivesWinter(state: GameState): boolean {
  // Two strategies, and the ceiling is the better of them: spend the wood on
  // the houses it will buy, or keep it and burn it. Building is not always
  // right — timber spent in a cold autumn is timber not burned in the dark —
  // so a "can this be done at all" verdict has to try both rather than
  // assume the band builds.
  // And on short commons, which is the winter lever: a verdict that ignored
  // it would go on telling bands they are dead when the game now hands them
  // something to do about it. The band eats less in every one of these walks
  // — `foodPerDay` reads `party.rations`, so this is one clone and no second
  // copy of the arithmetic.
  const lean = { ...state, party: { ...state.party, rations: 'half' as const } };
  return walkWinter(state, state)
    || walkWinter(state, bestSteading(state))
    || walkWinter(lean, lean)
    || walkWinter(lean, bestSteading(lean));
}

/**
 * One projection: `state` for the calendar and the crew, `steading` for what
 * they have to work with and what is in the store.
 */
function walkWinter(state: GameState, steading: GameState): boolean {
  const days = Math.max(0, nextThaw(state.day) - state.day);
  const crew = living(state.party.people);
  const saved = bestShelter(steading);
  const jobs = availableJobs(steading);
  // NOTE — a measured, deliberate limitation, not an oversight. This picks
  // the hunter by name rather than the best food trade available, so a band
  // whose ground and houses make a farmer the better bet is projected on the
  // wrong work. Taking the max over every producing job instead reads truer
  // and cuts the verdict's error from 33% to 29% — but it also flips
  // `cliff.test`'s pivot band (nought of both, day 40, the best site in the
  // world) from doomed to saveable, and that band being lost is a statement
  // about the game's difficulty rather than about this projection. Left
  // alone until that call is made.
  const foodJob = jobs.find((j) => j.id === 'hunter') ?? jobs.find((j) => j.produces === 'food');
  const woodJob = jobs.find((j) => j.produces === 'firewood');
  if (!foodJob || !woodJob) return false;

  // What each person is worth on either job. Fixed for the run: output()
  // reads the person and the steading, neither of which this changes.
  const asFood = crew.map((p) => output(steading, p, foodJob));
  const asWood = crew.map((p) => output(steading, p, woodJob));

  let food = steading.party.food;
  let wood = steading.party.firewood;

  for (let i = 1; i <= days; i += 1) {
    const day = state.day + i;
    // The larder's own helper, never a second copy of its arithmetic — see
    // the note on `foodPerDay`. The projected crew IS the living band here,
    // so this is the same number it always was, and it stays the same number
    // when what a mouth means changes.
    const mouths = foodPerDay(state);
    const fire = Math.max(0, plannedFirewood(state, day, true) - saved);
    const foodRatio = ratio(state.day, day, foodJob.seasonal);
    const woodRatio = ratio(state.day, day, woodJob.seasonal);

    // Today's best arrangement: the one leaving the band furthest from
    // running out of EITHER store, counted in days of cover so a day's food
    // and a day's fire weigh the same. It is what a person would do.
    let keepFood = -Infinity;
    let keepWood = -Infinity;
    let best = -Infinity;
    for (let onFood = 0; onFood <= crew.length; onFood += 1) {
      let grown = 0;
      let cut = 0;
      for (let p = 0; p < crew.length; p += 1) {
        if (p < onFood) grown += asFood[p]! * foodRatio;
        else cut += asWood[p]! * woodRatio;
      }
      const nextFood = food + grown - mouths;
      const nextWood = wood + cut - fire;
      const worst = Math.min(nextFood / Math.max(1, mouths), nextWood / Math.max(1, fire));
      if (worst > best) {
        best = worst;
        keepFood = nextFood;
        keepWood = nextWood;
      }
    }
    food = keepFood;
    wood = keepWood;
    if (food < 0 || wood < 0) return false;
  }
  return true;
}

/** One line naming where the band stands against the winter. */
export function readiness(state: GameState): string {
  const f = forecast(state);
  // Out of season the mark is not a live target, so it does not read like one.
  if (!markVisible(state)) return 'The ice has broken. We lived.';
  if (f.ready) {
    return `Stores will reach spring: ${f.food} food and ${f.firewood} wood is the mark, and we are past both.`;
  }
  const short: string[] = [];
  if (f.foodGap < 0) short.push(`${-f.foodGap} short of food`);
  if (f.firewoodGap < 0) short.push(`${-f.firewoodGap} short of wood`);
  const gap = `To see spring we need ${f.food} food and ${f.firewood} wood. We are ${short.join(' and ')}.`;
  // The one thing the mark never said. Told plainly and told EARLY, with
  // what is actually left to try — a band in this position can still rob
  // the coast, and being told so on day 26 is fair where finding out on
  // day 50 is not.
  if (!reachable(state)) {
    // STILL ONE WAY OUT, AND NOW FOR A BETTER REASON THAN LAST TIME.
    //
    // This line read "taking it from somebody else, or walking out and
    // wintering elsewhere" for a long time while walking out was not a verb
    // at all — nothing cleared `state.settlement` and `foundBlocker` answered
    // `settled` forever. That promise was withdrawn earlier on 2026-08-20 as
    // a thing the rules would refuse, with a note that whether it SHOULD be a
    // verb was unmeasured.
    //
    // It is a verb now (`ABANDON`, src/sim/retreat.ts) and it is MEASURED,
    // and the measurement says do not put it in this sentence. A band that
    // walks out when the verdict condemns it does worse than one that stays:
    // 120 paired landings, 50 retreats, SAVED NOBODY AND KILLED ELEVEN, and
    // spring fell 48/120 to 37/120.
    //
    // Which is obvious once said. What dooms a band here is no stores and no
    // time, and retreating spends the buildings and a week of walking to make
    // both worse. The door exists and the player may take it; this panel is
    // the one place in the game that tells a dying band what to try, and it
    // must not spend that on the thing measured to kill them.
    return `${gap} We cannot cut or hunt our way to that from here. What is left is taking it from somebody else.`;
  }
  return gap;
}
