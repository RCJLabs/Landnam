// What to actually DO about the winter mark.
//
// THE MEASUREMENT THIS EXISTS FOR, RE-TAKEN 2026-09-05 (12.3). The balance
// harness runs the arms over the same 120 landings on As It Lies: a band that
// picks a crew on settling day and never touches it sees spring 29 times; a
// band that moves hands onto whatever the mark says it is short of, day by
// day, sees spring 89 times. **Paired: saved 60, killed 0** (floor 7). It is
// the largest single effect this project has ever measured — short commons,
// the other winter lever, is saved 35 against killed 5 on 809 seeds — and
// adding a season-aware layer on top of it changed the outcome on NOT ONE
// SEED.
//
// The figures this file shipped with — 21 against 48, saved 30 killed 3 —
// are HEX-ERA and must not be quoted. They are kept in this sentence only so
// that a reader who finds them elsewhere knows what they were.
//
// So the most valuable thing a player can know about this game is "read the
// mark and move somebody". And until this file existed the game never said
// it. `readiness()` told the player the gap, and when the gap was hopeless it
// named the two ways out it knew: rob somebody, or walk out and winter
// elsewhere. Both of those were measured at ZERO bands saved and two killed.
// The advice named the two things that do not work and omitted the one that
// doubles survival.
//
// WHY THIS RE-RUNS THE MARK INSTEAD OF DOING ITS OWN ARITHMETIC. `forecast()`
// already walks every remaining day against the CURRENT assignments — that is
// its documented behaviour and the whole reason the mark moves when the plan
// changes. So the honest way to ask "would two more at the woodpile close
// it?" is to move two hands on a copy and read the mark again. A second copy
// of the projection could disagree with the first, and the one thing worse
// than no advice is advice that contradicts the panel it sits under. This is
// the `foodPerDay` lesson: one formula, not two.

import type { GameState } from '../state/types';
import type { JobId } from '../data/jobs';
import { availableJobs, jobOf, output } from './colony';
import { distanceFromHome, homeCrew } from './expedition';
import { atHome } from './site';
import { forecast, markVisible } from './winter';

export interface Counsel {
  /** Where the hands should go. */
  job: JobId;
  /** How many of them it takes. */
  hands: number;
  /** Which shortfall this closes. */
  closes: 'food' | 'firewood';
  /** Who was counted, worst-first. See the note on `tryClosing`. */
  who: string[];
}

/**
 * The smallest move that closes the mark, or nothing if no safe one does.
 *
 * DELIBERATELY CONSERVATIVE, and the conservatism is the point. It will only
 * move a hand that is not already answering a shortfall — somebody idle,
 * somebody on the watch or the walls, or somebody producing a thing the band
 * has enough of. It will never rob food to pay for wood. Advice that can
 * backfire is worse than no advice, because a player who follows it once and
 * is punished stops reading the panel, and the panel is the most valuable
 * thing on the screen.
 *
 * That means it stays silent exactly when the band is already crewed as well
 * as it can be — which is correct. At that point the gap is not an assignment
 * problem and `readiness()` has the rest to say.
 */
export function counsel(state: GameState): Counsel | undefined {
  if (!state.settlement || !markVisible(state)) return undefined;
  const now = forecast(state);
  if (now.ready) return undefined;

  // Worst shortfall first: a band short of both should be told about the one
  // that is further away, because that is the one that decides the winter.
  const wants: ('food' | 'firewood')[] = [];
  if (now.foodGap < 0) wants.push('food');
  if (now.firewoodGap < 0) wants.push('firewood');
  wants.sort((a, b) => gapOf(now, a) - gapOf(now, b));

  for (const closes of wants) {
    const found = tryClosing(state, closes);
    if (found) return found;
  }
  return undefined;
}

function gapOf(f: ReturnType<typeof forecast>, which: 'food' | 'firewood'): number {
  return which === 'food' ? f.foodGap : f.firewoodGap;
}

function tryClosing(state: GameState, closes: 'food' | 'firewood'): Counsel | undefined {
  const answer = bestFor(state, closes);
  if (!answer) return undefined;

  // Who can move without giving up something the mark is also asking for.
  const movable = homeCrew(state)
    .filter((p) => p.alive && p.job !== answer)
    .filter((p) => {
      const job = jobOf(p);
      if (!job) return true; // idle hands first, and they cost nothing at all
      if (job.produces === 'food') return gapOf(forecast(state), 'food') >= 0;
      if (job.produces === 'firewood') return gapOf(forecast(state), 'firewood') >= 0;
      return true; // shelter and watch are not what the mark measures
    })
    // WORST FIRST, and this is the whole reason the counsel can be trusted.
    //
    // The first cut sorted best-first, which gives the smallest number that
    // works — and the bar in test/counsel.test.ts failed 22 of 51, because
    // the panel says "two more hands at the woodpile" without naming WHICH
    // two, and a player who moves their two weakest is left short. A promise
    // the player cannot reliably keep is not a promise.
    //
    // Counting the least productive hands makes the number conservative: if
    // the worst two close it, then ANY two of the eligible do. It sometimes
    // asks for one more pair of hands than a perfect player would need, and
    // that is the right way round to be wrong.
    .sort((a, b) => yieldOf(state, a, answer) - yieldOf(state, b, answer));
  if (movable.length === 0) return undefined;

  // Move them one at a time and ask the mark again after each. Exact by
  // construction: whatever this reports, the panel above it will agree.
  const trial = structuredClone(state);
  const who: string[] = [];
  for (let hands = 1; hands <= movable.length; hands += 1) {
    const person = trial.party.people.find((p) => p.id === movable[hands - 1]!.id);
    if (!person) continue;
    person.job = answer;
    who.push(person.id);
    if (!gapRemains(trial, closes)) return { job: answer, hands: who.length, closes, who };
  }
  return undefined;
}

/** Whether the named store still falls short once the plan is re-read. */
function gapRemains(state: GameState, closes: 'food' | 'firewood'): boolean {
  return gapOf(forecast(state), closes) < 0;
}

/** The job at this site that best answers a shortfall of the named store. */
function bestFor(state: GameState, closes: 'food' | 'firewood'): JobId | undefined {
  const crew = homeCrew(state).filter((p) => p.alive);
  if (crew.length === 0) return undefined;
  let best: { id: JobId; worth: number } | undefined;
  for (const job of availableJobs(state)) {
    if (job.produces !== closes) continue;
    // Scored on the whole band rather than on one person, because this is
    // "which work does this ground reward", not "who should do it".
    const worth = crew.reduce((sum, p) => sum + output(state, p, job), 0);
    if (!best || worth > best.worth) best = { id: job.id, worth };
  }
  return best?.id;
}

function yieldOf(state: GameState, person: { id: string }, job: JobId): number {
  const def = availableJobs(state).find((j) => j.id === job);
  const who = state.party.people.find((p) => p.id === person.id);
  return def && who ? output(state, who, def) : 0;
}

/**
 * The counsel as the sentence the player reads.
 *
 * Generated from the numbers rather than written beside them, for the reason
 * `measuredLine` in src/data/hardship.ts is: prose kept next to data drifts
 * away from it and nothing notices.
 */
export function counselLine(c: Counsel): string {
  const where = WHERE[c.job] ?? 'to that work';
  const who = c.hands === 1 ? 'One more hand' : `${cap(WORDS[c.hands] ?? `${c.hands}`)} more hands`;
  return `${who} ${where} would close it.`;
}

/**
 * The same counsel, asked from the road — or nothing, when the band is
 * standing in its own yard and the colony panel already has this.
 *
 * 11.U3: `counsel` is rendered in exactly one place, `renderNeeds` on the
 * colony panel, and `ENTER_COLONY` refuses unless `atHome` — so a settled
 * band away from home has never been able to reach the one sentence this
 * project measures at saved 60 / killed 0 (see the head of this file; the
 * saved-30 figure this line used to quote is hex-era). MEASURED 2026-09-03
 * (20 sagas an arm, `fair`, to day 400): a settled band spends 453 days
 * away from home as a settler and 551 as a raider; 216 and 161 of those
 * fall inside the mark's own window, and **109 of 216 (settler) and 122 of 161
 * (raider) have a live counsel behind them** — a denser hit rate than the
 * at-home window's own 38% and 50%. `homeCrew` was empty on NONE of them,
 * so the advice is never the empty steading's.
 */
export function roadCounsel(state: GameState): Counsel | undefined {
  if (!state.settlement || atHome(state)) return undefined;
  // `counsel` owns the rest of the gate — the mark's window, the ready
  // store, and whether a safe move exists at all. One formula, not two.
  return counsel(state);
}

/**
 * The counsel as the ROAD reads it: the same move, and then the walk that
 * stands between the band and making it.
 *
 * The colony's sentence cannot simply be reprinted here. A band away from
 * home cannot re-crew at all — `ENTER_COLONY` refuses unless `atHome` — so
 * the bare line would name a move the player cannot take from where they
 * are standing, which is the exact fault `test/winter.test.ts` bars
 * `readiness()` for. The verb the road HAS is the walk, so the road's line
 * names the walk, and `counselLine` is reused whole rather than rephrased.
 */
export function roadCounselLine(state: GameState, c: Counsel): string {
  const days = Math.round(distanceFromHome(state));
  const move = counselLine(c);
  // Not home and yet no distance to cover is not a sentence worth risking:
  // say the move alone rather than promise a walk of nought days.
  if (days < 1) return move;
  const walk = WORDS[days] ?? `${days}`;
  return `${move} ${cap(walk)} ${days === 1 ? "day's" : "days'"} walk home.`;
}

/** Where a job puts a person, in the game's own voice. */
const WHERE: Partial<Record<JobId, string>> = {
  woodcutter: 'at the woodpile',
  hunter: 'at the tree line',
  fisher: 'on the water',
  farmer: 'in the fields',
};

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;
