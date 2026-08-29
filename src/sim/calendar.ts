// The year turns. Day 1 is high summer; the first winter bites on day 49,
// which is the whole point of Phase 1 — get ready or die.

import type { Season } from '../state/types';
import { stream } from '../rng';

export const SEASON_LENGTH = 24;

/** Four seasons to the year. */
export const YEAR_LENGTH = SEASON_LENGTH * 4;

/** Order of play, starting at landfall. */
export const SEASON_ORDER: readonly Season[] = ['summer', 'autumn', 'winter', 'spring'] as const;

export function seasonOf(day: number): Season {
  const index = Math.floor((Math.max(1, day) - 1) / SEASON_LENGTH) % SEASON_ORDER.length;
  return SEASON_ORDER[index]!;
}

/** Which day this season began on — used to telegraph what's coming. */
export function seasonStartDay(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / SEASON_LENGTH) * SEASON_LENGTH + 1;
}

export function daysUntilNextSeason(day: number): number {
  return seasonStartDay(day) + SEASON_LENGTH - day;
}

export function nextSeason(day: number): Season {
  return seasonOf(seasonStartDay(day) + SEASON_LENGTH);
}

/** Winter counts from day 49; useful for "N days until winter" warnings. */
/**
 * Days until the next autumn begins, or 0 if it is autumn now.
 *
 * The steading's watch panel counts down to it, because autumn is when the
 * raiders come and a wall takes a summer to raise. Here rather than in the
 * renderer so there is one place that knows where autumn is.
 */
export function daysUntilAutumn(day: number): number {
  if (seasonOf(day) === 'autumn') return 0;
  const yearStart = Math.floor((Math.max(1, day) - 1) / YEAR_LENGTH) * YEAR_LENGTH + 1;
  const thisAutumn = yearStart + SEASON_LENGTH;
  return (day < thisAutumn ? thisAutumn : thisAutumn + YEAR_LENGTH) - day;
}

export function daysUntilWinter(day: number): number {
  const winterStart = SEASON_ORDER.indexOf('winter') * SEASON_LENGTH + 1;
  return day >= winterStart ? 0 : winterStart - day;
}

/** 1-based. Day 1 is the first summer of year one. */
export function yearOf(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / YEAR_LENGTH) + 1;
}

/**
 * The first day of the next spring — when the winter ahead lets go. Before
 * 4.6 this was a single constant, because the run ended at the first thaw.
 * Now the year comes round again, and everything that used to count toward
 * day 73 counts toward whichever thaw is next.
 */
export function nextThaw(day: number): number {
  const here = Math.max(1, day);
  const springStart = SEASON_ORDER.indexOf('spring') * SEASON_LENGTH + 1;
  const thaw = (yearOf(here) - 1) * YEAR_LENGTH + springStart;
  return here < thaw ? thaw : thaw + YEAR_LENGTH;
}

/** How many winters the band has come out the other side of. */
export function wintersStood(day: number): number {
  const springStart = SEASON_ORDER.indexOf('spring') * SEASON_LENGTH + 1;
  if (day < springStart) return 0;
  return Math.floor((day - springStart) / YEAR_LENGTH) + 1;
}

export interface SeasonEffects {
  /** Multiplier on forage/hunt/fish yields. */
  forage: number;
  /** Extra movement cost per hex, in effort. */
  travelPenalty: number;
  /** Sight radius on the world map. */
  sight: number;
  /** Firewood burned per night. */
  firewood: number;
  /** Flavour used in the top bar and saga lines. */
  label: string;
}

const EFFECTS: Record<Season, SeasonEffects> = {
  summer: { forage: 1.35, travelPenalty: 0, sight: 3, firewood: 1, label: 'Summer' },
  autumn: { forage: 1.0, travelPenalty: 0, sight: 2, firewood: 2, label: 'Autumn' },
  // Six a night is what makes winter a season you survive on stores rather
  // than one you work through: no crew of woodcutters can cut that fast in
  // the dark, so the stack has to be built in the autumn.
  winter: { forage: 0.15, travelPenalty: 1, sight: 1, firewood: 6, label: 'Winter' },
  spring: { forage: 0.7, travelPenalty: 0, sight: 2, firewood: 2, label: 'Spring' },
};

export function seasonEffects(season: Season): SeasonEffects {
  return EFFECTS[season];
}

/**
 * Extra firewood a night for every winter the band has already come through.
 *
 * Tried once on its own and it changed survival by exactly zero, because the
 * winter mark was a perfect forecast: raise the cost and the mark simply
 * reported a bigger number that the band stocked to. It ships now because the
 * mark has been made vague at long range (see markHaze), so a deeper winter
 * is a deeper winter you cannot see the bottom of.
 *
 * The FIRST winter is deliberately untouched. It is the shape of the early
 * game, it is already tuned, and 80% of bands reaching it is the number we
 * want.
 */
export const WINTER_DEEPENING = 2;
export const WINTER_DEPTH_MAX = 6;

/** Which winter of the saga a day belongs to. 0 is the first. */
export function winterIndex(day: number): number {
  return wintersStood(day);
}

/**
 * How much harder this particular winter is than the first.
 *
 * Two parts, and the second is the point. A floor that grows with the years —
 * the sagas' own logic, that the winters which follow a good run are the ones
 * that kill — plus a SEEDED bite that varies from year to year and is not
 * knowable in advance. A run's winters are fixed the moment its seed is, so
 * replays stay stable; what the player cannot do is see which kind of winter
 * is coming until it is close.
 *
 * That variance is the whole mechanism. A fixed deepening was tried on its
 * own and moved survival by exactly zero, because the mark simply reported
 * the bigger number and the band stocked to it. A winter that might be mild
 * and might be terrible is a decision; a winter that is reliably worse is
 * arithmetic.
 */
export function winterDepth(seed: string, day: number): number {
  if (seasonOf(day) !== 'winter') return 0;
  return Math.min(WINTER_DEPTH_MAX, floorDepth(day) + bite(seed, day));
}

/** The part that grows with the years, and that the band can count on. */
export function floorDepth(day: number): number {
  return wintersStood(day) * WINTER_DEEPENING;
}

/**
 * The part it cannot: 0..WINTER_BITE_MAX, fixed per run and per winter.
 *
 * Zero for the FIRST winter. That season is the shape of the early game, it
 * is tuned to 80% of bands reaching it, and a run that opens with an unlucky
 * roll it could not have seen coming is not a harder game — it is a coin
 * toss before the player has had a chance to be good or bad at anything.
 */
export function bite(seed: string, day: number): number {
  if (winterIndex(day) === 0) return 0;
  return stream(seed, 'worldgen').derive(`winter:${winterIndex(day)}`).int(0, WINTER_BITE_MAX);
}

/** The widest a single winter's luck can swing. */
export const WINTER_BITE_MAX = 4;

/**
 * Season effects as they actually bite. Needs the seed, because how hard THIS
 * winter is was decided when the run was.
 */
export function effectsOn(day: number, seed = ''): SeasonEffects {
  const base = EFFECTS[seasonOf(day)];
  const deeper = seed ? winterDepth(seed, day) : 0;
  if (deeper === 0) return base;
  return { ...base, firewood: base.firewood + deeper };
}
