// The light: how bright the world is, and whether it is night.
//
// ## What "the turning of the day" can mean in this game
//
// There is no hour. `day` is an integer and the atomic unit of play — the
// "everything is turn-based" pillar — so a clock that ran inside a day would
// need a new field, a save bump, and a notion of time the sim does not have
// and has no use for. Measured before building: nothing anywhere in `src/sim`
// knows about an hour, and the road drew exactly the same 108 nodes on a
// walking afternoon and a camped night.
//
// So the light is driven by the two things the game DOES know, and both are
// truer to the setting than a clock would be:
//
//   1. THE SEASON, because at these latitudes the turning of the day IS the
//      turning of the year. A midwinter day this far north is a few hours of
//      blue twilight that never becomes noon; a midsummer night never gets
//      properly dark. Norse settlers did not read hours, they read the year,
//      and `seasonEffects` already pays this in `sight` — the picture just
//      never showed what the number meant.
//
//   2. WHETHER THE BAND HAS CAMPED. `party.hasCamped` has been in state since
//      the gathering work and survives until they walk on, so the night has a
//      real trigger already: camp, and the light goes.
//
// Pure and unit-tested, because everything here is arithmetic over two facts.
// `processionView` draws it; the numbers are decided here.

import type { Season } from '../state/types';

export interface Light {
  /**
   * 0..1, how much light there is. 1 is a summer noon; the floor is a
   * midwinter night, which is dark but never absolute — snow and sea hold
   * more light than a player expects, and a picture nobody can read is a
   * bug rather than a mood.
   */
  level: number;
  /** The colour the light is, washed over the whole picture. */
  tint: string;
  /** How hard the corners fall away, 0..1. Night closes the frame in. */
  vignette: number;
  /** Night, in the sense that matters: the band is stopped and it is dark. */
  night: boolean;
  /** Whether stars are out. A summer night this far north has none. */
  stars: boolean;
}

/**
 * Daylight by season, and by season at night.
 *
 * The numbers are the latitude, not a mood board. Reykjavík runs about four
 * hours of murky twilight at the winter solstice and about twenty-one at the
 * summer one, so:
 *
 *   - a WINTER day is already dim — it is the one season whose daytime is
 *     visibly darker than the others, which is the whole reason this table
 *     is worth having;
 *   - a SUMMER night barely darkens (the "light nights"), so camping in
 *     summer reads as dusk rather than dark and shows no stars;
 *   - autumn and spring sit either side, and are where the year actually
 *     feels like it is turning.
 */
const DAY: Record<Season, number> = {
  summer: 1,
  autumn: 0.82,
  winter: 0.54,
  spring: 0.86,
};

const NIGHT: Record<Season, number> = {
  summer: 0.56,
  autumn: 0.24,
  winter: 0.12,
  spring: 0.3,
};

/**
 * Warm at full light, and near-black blue as it goes.
 *
 * The night tint was a mid-slate (#2b3b57) in the first cut and it did not
 * work: the painted country's sky runs to #a8afb2, and half a coat of a
 * mid-blue over a light grey is another light grey. A winter midnight came
 * out as an overcast afternoon with stars in it. Night has to DARKEN, so the
 * tint is nearly black and the opacity carries the rest.
 */
const DAY_TINT = '#ffe9b8';
const NIGHT_TINT = '#080d1a';

/** Below this the sky is dark enough for stars — a summer night is not. */
export const STAR_LEVEL = 0.4;

export function lightAt(season: Season, camped: boolean): Light {
  const level = camped ? NIGHT[season] : DAY[season];
  // The wash goes blue as the light goes: the same rect carries both the
  // warm low sun of a summer afternoon and the cold of a winter night, so
  // there is one light pass rather than a day one and a night one.
  const tint = level >= 0.7 ? DAY_TINT : NIGHT_TINT;
  return {
    level,
    tint,
    // Dark closes the frame in — you see as far as the fire.
    vignette: Math.min(0.62, 0.16 + (1 - level) * 0.6),
    night: camped,
    stars: level < STAR_LEVEL,
  };
}

/**
 * How strongly to wash the picture with `tint`.
 *
 * Full light needs almost nothing — summer noon is the palette everything
 * else was tuned in, exactly as `seasonTint` treats it. Dark needs a lot,
 * but stops short of hiding the band: the road at midwinter midnight is a
 * picture you can still read, because a player who cannot see their own
 * people has been given a bug and told it is atmosphere.
 */
export function washOpacity(level: number): number {
  if (level >= 0.98) return 0;
  return Math.min(NIGHT_MAX, (1 - level) * 0.82);
}

/**
 * The darkest the picture is ever washed.
 *
 * A midwinter night lands here. It stops short of hiding the band because a
 * player who cannot see their own people has been handed a bug and told it
 * is atmosphere — and because the campfire is drawn ABOVE this wash, so the
 * light in the picture comes from the thing in the picture giving light.
 */
export const NIGHT_MAX = 0.72;
