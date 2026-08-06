// The year turns. Day 1 is high summer; the first winter bites on day 49,
// which is the whole point of Phase 1 — get ready or die.

import type { Season } from '../state/types';

export const SEASON_LENGTH = 24;

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
export function daysUntilWinter(day: number): number {
  const winterStart = SEASON_ORDER.indexOf('winter') * SEASON_LENGTH + 1;
  return day >= winterStart ? 0 : winterStart - day;
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
  winter: { forage: 0.15, travelPenalty: 1, sight: 1, firewood: 4, label: 'Winter' },
  spring: { forage: 0.7, travelPenalty: 0, sight: 2, firewood: 2, label: 'Spring' },
};

export function seasonEffects(season: Season): SeasonEffects {
  return EFFECTS[season];
}

export function effectsOn(day: number): SeasonEffects {
  return EFFECTS[seasonOf(day)];
}
