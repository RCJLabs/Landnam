// The first winter. Twenty-four days on which the land gives nothing back and
// the fire has to be fed four times a night.
//
// The whole design of this milestone is one claim: when a colony dies in the
// dark, the player was told the number and chose not to meet it. Everything
// here exists to make that claim true — the forecast walks the remaining days
// with YOUR people on YOUR jobs at the season factors they will actually face,
// so the target it prints is a simulation of your plan rather than a rule of
// thumb someone tuned by feel.

import type { GameState } from '../state/types';
import {
  effectsOn,
  floorDepth,
  nextThaw,
  seasonOf,
  WINTER_BITE_MAX,
  WINTER_DEPTH_MAX,
} from './calendar';
import { dayLabour, jobOf, output, seasonFactor, shelterSaving } from './colony';
import { hardshipById } from './../data/hardship';
import { living } from './people';
import { firewoodPerNight, foodPerDay } from './upkeep';
import { weatherOn } from './weather';

/** Winter opens on day 49. Spring — and survival — on day 73. */
export const WINTER_DAY = 49;

/** How much more than the forecast to bank. The weather is not a mean. */
export const PRUDENCE = 1.15;

/**
 * How far out the mark starts being shown: the turn of autumn. Before 4.6 the
 * panel was gated on "day 25 or later", which meant the same thing exactly
 * once. It has to be a window now, because the year comes round again.
 */
export const MARK_WINDOW = 48;

/** Inside this many days the mark is exact, as it always was. */
export const HAZE_CLEARS = 20;
/** Over this many further days the haze grows to its full width. */
export const HAZE_RANGE = 40;
/** The most the mark can be out by, as a fraction of what it asks for. */
export const HAZE_MAX = 0.3;

export interface Forecast {
  /** Days between now and the ice breaking. */
  days: number;
  /** Food that must be in the store today to reach spring on this plan. */
  food: number;
  /** Firewood likewise. */
  firewood: number;
  /** What is actually in hand, minus what is needed. Negative is a shortfall. */
  foodGap: number;
  firewoodGap: number;
  /** True when both stores clear the target. */
  ready: boolean;
  /**
   * How far the true figure may sit either side of the one shown, as a
   * fraction. Zero once winter is close enough to read properly.
   */
  haze: number;
}

/**
 * Walks every remaining day and adds up what the band will fail to produce.
 *
 * Deliberately projects the CURRENT assignments forward: a colony that has
 * everyone farming is told, correctly, that its fields will stop in twenty
 * days and it will starve. Change the plan and the number changes with it.
 */
export function forecast(state: GameState): Forecast {
  // Whichever thaw is next. Before 4.6 this was the single day the run ended
  // on; the mark now points at the winter actually coming.
  const days = Math.max(0, nextThaw(state.day) - state.day);
  const home = state.settlement;
  const crew = living(state.party.people);

  let food = 0;
  let firewood = 0;
  const saved = shelterSaving(state);

  for (let i = 1; i <= days; i++) {
    const day = state.day + i;
    // The larder's own helper, never a second copy of its arithmetic — see
    // the note on `foodPerDay`. The projected crew IS the living band here,
    // so this is the same number it always was, and it stays the same number
    // when what a mouth means changes.
    const mouths = foodPerDay(state);
    // Same helper the day tick burns from, so the mark cannot lie.
    // What the band can HONESTLY plan on. Close to, it knows this winter;
    // far out it knows only the floor and the middle of the range, which is
    // exactly the gamble — stock to the mark and a hard year catches you.
    const fire = Math.max(0, plannedFirewood(state, day) - saved);

    let grown = 0;
    let cut = 0;
    if (home) {
      for (const person of crew) {
        const job = jobOf(person);
        if (!job) continue;
        // Same maths the day tick will use, at that day's season factor.
        const amount = output(state, person, job) * ratio(state.day, day, job.seasonal);
        if (job.produces === 'food') grown += amount;
        else if (job.produces === 'firewood') cut += amount;
      }
    }

    food += Math.max(0, mouths - grown);
    firewood += Math.max(0, fire - cut);
  }

  const haze = markHaze(state.day);
  const needFood = Math.round(food * PRUDENCE);
  const needWood = Math.round(firewood * PRUDENCE);
  return {
    days,
    haze,
    food: needFood,
    firewood: needWood,
    foodGap: Math.round(state.party.food) - needFood,
    firewoodGap: Math.round(state.party.firewood) - needWood,
    ready: state.party.food >= needFood && state.party.firewood >= needWood,
  };
}

/**
 * How vague the mark is, as a fraction of what it asks for.
 *
 * This is the answer to a measured failure. Three separate attempts to make
 * the late game dangerous — raid pressure at three magnitudes, winters that
 * deepen with the years — moved survival to the second winter by exactly
 * zero, and the reason was this function's absence: the mark walked every
 * remaining day with your actual people on their actual jobs and told you the
 * true number, so raising winter's cost only raised a figure the player was
 * handed for free and could always out-work.
 *
 * A forecast far out is a guess. Close to, it is a reading. The haze shuts
 * fully once the ice is near enough to see, so 3.4's promise — the game told
 * you the number — still holds where the band can act on it, and the risk
 * lands on the long-range planning where it belongs.
 */
export function markHaze(day: number): number {
  const out = Math.max(0, nextThaw(day) - day);
  if (out <= HAZE_CLEARS) return 0;
  const far = Math.min(1, (out - HAZE_CLEARS) / HAZE_RANGE);
  return HAZE_MAX * far;
}

/**
 * The firewood a night the band should plan for.
 *
 * Once the haze has cleared this is simply the truth. Before that it is the
 * floor the years guarantee plus the MIDDLE of the range the luck can add —
 * so a band that stocks exactly to the mark has provisioned for an average
 * winter and will come up short in a bad one. That shortfall is the entire
 * point: the forecast used to be an oracle, and an oracle is what made every
 * attempt to threaten the late game bounce off.
 */
/**
 * EXPORTED FOR `reach.ts` AND NOTHING ELSE. It and `ratio` below are the two
 * halves of the projection the mark walks, and `reachable` walks the same
 * ground at full effort — sharing them is what stops the two from being
 * parallel models that can disagree, which is the rule the whole file is
 * written to. They are not part of the public surface of the mark.
 */
export function plannedFirewood(state: GameState, day: number, best = false): number {
  const terms = hardshipById(state.hardship).winter;
  if (seasonOf(day) !== 'winter') return effectsOn(day).firewood;
  const base = effectsOn(day).firewood + floorDepth(day);
  // Close enough to read, so the weather is part of the reading — the same
  // term `firewoodPerNight` adds to the actual burn. If the fire felt a frost
  // the mark did not, the mark would be quietly short by exactly the frosts
  // between here and the thaw, which is the one thing it must never be.
  //
  // NOT added to the hazy branch below, deliberately: a band cannot see a
  // gale forty days out, and that branch exists to be a guess.
  if (markHaze(state.day) === 0) {
    const sky = weatherOn(state.seed, day).firewood;
    return Math.max(0, effectsOn(day, state.seed).firewood + sky) * terms;
  }
  // The MARK plans for a middling winter on purpose — an oracle is what made
  // every attempt to threaten the late game bounce off. The VERDICT is a
  // different question: "is there any version of this that works" cannot be
  // answered against a winter that has not happened yet and might not. So the
  // ceiling gets the mildest winter the years guarantee, the same best case
  // `bestShelter` already grants the roof.
  if (best) return base * terms;
  return (
    Math.min(
      effectsOn(day).firewood + WINTER_DEPTH_MAX,
      base + Math.round(WINTER_BITE_MAX / 2),
    ) * terms
  );
}

/** Re-scales today's output to another day's season. */
export function ratio(today: number, then: number, seasonal: number): number {
  const now = 1 + seasonal * (effectsOn(today).forage - 1);
  const later = 1 + seasonal * (effectsOn(then).forage - 1);
  if (now <= 0) return 0;
  return Math.max(0, later) / now;
}



// --- Sickness ---



/**
 * Whether the mark is worth putting on screen. A number the player cannot act
 * on yet is noise, and a winter target shown through high summer is noise for
 * two whole seasons.
 */
export function markVisible(state: GameState): boolean {
  if (state.end || !state.settlement) return false;
  const days = forecast(state).days;
  return days > 0 && days <= MARK_WINDOW;
}




// --- Telegraphing it ---




/** The projected daily take, for the panel. Zero away from home. */
export function todaysTake(state: GameState): { food: number; firewood: number } {
  const take = dayLabour(state);
  return { food: take.food, firewood: take.firewood };
}

/** Re-exported so the panel does not have to reach into two modules. */
export { seasonFactor, shelterSaving, firewoodPerNight, foodPerDay };
