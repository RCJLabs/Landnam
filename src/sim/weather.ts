// What tomorrow looks like.
//
// Weather is a PURE FUNCTION of the run seed and the day — exactly the shape
// `bite()` already uses for how hard a given winter is. That is not a
// shortcut, it is the whole design:
//
//   - it needs no field on GameState, so no save bump, no migration, and no
//     new parity facet;
//   - a replay of the same seed sees the same sky, which is what `runs/*.json`
//     and the C++ port both require;
//   - and, most of all, TOMORROW is knowable today. A gale that shuts the sea
//     is a decision if the band can see it coming and a coin toss if it
//     cannot, and this game has held since the winter mark that the player is
//     told the number and then chooses.
//
// Nothing here reaches into state. Callers apply what they are entitled to
// feel: travel pays `travel` and `shutsTheSea`, the night pays `firewood`,
// the map pays `sight`.

import type { GameState } from '../state/types';
import { WEATHER, type WeatherDef } from '../data/weather';
import { seasonOf } from './calendar';
import { stream } from './../rng';

/** The sky on a given day of a given run. */
export function weatherOn(seed: string, day: number): WeatherDef {
  const season = seasonOf(day);
  const pool = WEATHER.filter((w) => (w.weight[season] ?? 0) > 0);
  // Derived per day rather than drawn in sequence, so asking about tomorrow
  // costs nothing and changes nothing — which is what makes the forecast
  // possible at all.
  const rng = stream(seed, 'worldgen').derive(`weather:${day}`);
  return rng.weighted(pool, (w) => w.weight[season] ?? 0);
}

/** Today's sky. */
export function weatherNow(state: GameState): WeatherDef {
  return weatherOn(state.seed, state.day);
}

/** Tomorrow's, which is the whole point. */
export function weatherNext(state: GameState): WeatherDef {
  return weatherOn(state.seed, state.day + 1);
}

/** True when no hull leaves the shore today. */
export function seaShut(state: GameState): boolean {
  return weatherNow(state).shutsTheSea;
}

/**
 * The warning, or nothing when tomorrow is fair.
 *
 * Deliberately the omen rather than the name: a band on a beach in the year
 * 900 reads the swell and the sky, it does not read a forecast. The mechanical
 * consequence is spelled out after it, because a warning the player cannot act
 * on is flavour.
 */
export function omenFor(state: GameState): string | undefined {
  const next = weatherNext(state);
  if (next.id === 'fair') return undefined;
  // Only when it CHANGES. A gale that has been blowing since yesterday is not
  // "a gale by morning", it is the weather — and saying so two nights running
  // put a literal stutter in the saga log, which `travel.test` caught: three
  // consecutive identical entries is the bug that test exists for, and it came
  // off a phone screenshot the first time.
  if (weatherNow(state).id === next.id) return undefined;
  const bites: string[] = [];
  if (next.shutsTheSea) bites.push('no hull leaves the shore');
  if (next.travel > 0) bites.push('hard going overland');
  if (next.firewood > 0) bites.push(`${next.firewood} more firewood a night`);
  if (next.sight < 0) bites.push('nothing seen far off');
  return `${next.omen} — ${next.label.toLowerCase()} by morning${
    bites.length ? `: ${bites.join(', ')}` : ''
  }.`;
}
