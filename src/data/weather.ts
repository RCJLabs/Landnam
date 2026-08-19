// The weather, as a table.
//
// Until now there was none. `effectsOn` returned the same four numbers on
// every day of a season, with one per-winter constant on top — so "weather"
// in this game meant "which season is it", and a day in it was exactly like
// the day before. The band could be told winter was coming and never told
// anything about tomorrow.
//
// The rule these are written against is the one the winter mark is written
// against: the player is TOLD, and then chooses. A gale that shuts the sea is
// a decision if you can see it a day out and a dice roll if you cannot, so
// every kind here has an `omen` — what the sky looked like the evening
// before — and nothing here ever fires unannounced.

import type { Season } from '../state/types';

export type WeatherId = 'fair' | 'gale' | 'frost' | 'thaw' | 'seafog';

export interface WeatherDef {
  id: WeatherId;
  /** Named in the top bar on the day. */
  label: string;
  /** What the evening before looked like. Shown as tomorrow's warning. */
  omen: string;
  /** Extra effort per land hex. */
  travel: number;
  /** No hull leaves the shore. Rowing the one hex ASHORE is always allowed. */
  shutsTheSea: boolean;
  /** Extra firewood a night. */
  firewood: number;
  /** Change to the sight radius on the world map. */
  sight: number;
  /**
   * How often it turns up, per season. Absent means never — a hard frost in
   * high summer is not weather, it is a bug.
   */
  weight: Partial<Record<Season, number>>;
}

/**
 * Fair weather is deliberately the great majority of every season.
 *
 * Weather that happens most days is not weather, it is a tax — and a tax the
 * player cannot plan around, because there is no fair day to save the voyage
 * for. The weights below leave roughly three days in four clear.
 */
export const WEATHER: WeatherDef[] = [
  {
    id: 'fair',
    label: 'Fair',
    omen: 'a red sky, and the air still',
    travel: 0,
    shutsTheSea: false,
    firewood: 0,
    sight: 0,
    weight: { summer: 30, autumn: 22, winter: 20, spring: 24 },
  },
  {
    id: 'gale',
    label: 'A gale',
    omen: 'a long swell coming in with no wind behind it',
    // ZERO overland: a gale's identity is that the sea is shut, and ashore it
    // is only wet. The first cut charged a day's effort on land as well.
    //
    // Kept honest about WHY it changed: the curve read 82% to the first
    // winter without weather and 77% with, and taking this penalty off left
    // it at 77% — because three sagas in sixty is about one standard error,
    // and the difference was noise I had over-read. Spring and two-winters
    // moved the other way by the same margin. The land penalty went for the
    // design reason above, not because it was measured to cost anything.
    travel: 0,
    shutsTheSea: true,
    firewood: 1,
    sight: -1,
    weight: { summer: 2, autumn: 6, winter: 6, spring: 4 },
  },
  {
    id: 'frost',
    label: 'Hard frost',
    omen: 'the sky clearing off cold after sunset',
    travel: 0,
    shutsTheSea: false,
    // The one that reaches the winter mark: a frost night burns more, and
    // because the forecast walks the real days it is a number the band is
    // told rather than one it discovers in the dark.
    firewood: 2,
    sight: 0,
    weight: { autumn: 3, winter: 8, spring: 2 },
  },
  {
    id: 'thaw',
    label: 'Thaw',
    omen: 'a warm wind off the water and the ice going grey',
    // Mud. Everything overland costs, and the fire costs less.
    travel: 1,
    shutsTheSea: false,
    firewood: -1,
    sight: 0,
    weight: { winter: 3, spring: 6 },
  },
  {
    id: 'seafog',
    label: 'Sea fog',
    omen: 'the far shore going soft at dusk',
    travel: 0,
    shutsTheSea: false,
    firewood: 0,
    sight: -1,
    weight: { summer: 4, autumn: 5, winter: 2, spring: 5 },
  },
];

export function weatherById(id: WeatherId): WeatherDef {
  const found = WEATHER.find((w) => w.id === id);
  if (!found) throw new Error(`no weather ${id}`);
  return found;
}
