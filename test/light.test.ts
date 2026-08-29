// Night, and the turning of the day.
//
// The premise was measured before any of this was built, and it changed the
// design. THERE IS NO HOUR IN THIS GAME: `day` is an integer and the atomic
// unit of play, and nothing in `src/sim` knows about a time within a day. A
// clock would need a new field, a save bump, and a concept the sim has no
// use for. Measured on the built page: the road drew the same 108 nodes on a
// walking afternoon and on a camped night — camping changed nothing at all.
//
// So the light runs off the two things the game does know, and both are
// truer to the setting than a clock: the SEASON (at these latitudes the
// turning of the day IS the turning of the year) and whether the band has
// CAMPED (`party.hasCamped` already survives from CAMP until the next WALK).

import { describe, expect, it } from 'vitest';
import { NIGHT_MAX, STAR_LEVEL, lightAt, washOpacity } from '../src/render/light';
import type { Season } from '../src/state/types';

const SEASONS: Season[] = ['summer', 'autumn', 'winter', 'spring'];

describe('the turning of the year is the turning of the day', () => {
  it('gives midwinter less daylight than any other season', () => {
    const winter = lightAt('winter', false).level;
    for (const season of SEASONS) {
      if (season === 'winter') continue;
      expect(lightAt(season, false).level,
        `${season} is no brighter than midwinter`).toBeGreaterThan(winter);
    }
  });

  it('makes a winter DAY darker than a summer NIGHT', () => {
    // The claim that makes this a latitude and not a dimmer switch. Four
    // hours of blue twilight at the solstice against a midsummer night that
    // never gets dark: the year matters more than the hour up here.
    expect(lightAt('winter', false).level).toBeLessThan(lightAt('summer', true).level);
  });

  it('never lets a summer night go properly dark, and never gives it stars', () => {
    const night = lightAt('summer', true);
    expect(night.level).toBeGreaterThan(STAR_LEVEL);
    expect(night.stars, 'the light nights have stars in them').toBe(false);
  });

  it('gives the dark seasons their stars', () => {
    for (const season of ['autumn', 'winter', 'spring'] as const) {
      expect(lightAt(season, true).stars, `no stars on a ${season} night`).toBe(true);
    }
  });

  it('is always darker camped than walking, in every season', () => {
    for (const season of SEASONS) {
      expect(lightAt(season, true).level).toBeLessThan(lightAt(season, false).level);
    }
  });

  it('calls it night when the band has stopped, and only then', () => {
    for (const season of SEASONS) {
      expect(lightAt(season, true).night).toBe(true);
      expect(lightAt(season, false).night).toBe(false);
    }
  });
});

describe('the picture stays a picture you can read', () => {
  it('leaves a summer noon exactly as it was painted', () => {
    // Summer full light is the palette everything else was tuned in — the
    // same stance `seasonTint` takes, and the reason no wash is drawn at all.
    expect(washOpacity(lightAt('summer', false).level)).toBe(0);
  });

  it('never washes the road past the point of reading it', () => {
    for (const season of SEASONS) {
      for (const camped of [true, false]) {
        const wash = washOpacity(lightAt(season, camped).level);
        expect(wash).toBeGreaterThanOrEqual(0);
        expect(wash, `a ${season} ${camped ? 'night' : 'day'} blacks the road out`)
          .toBeLessThanOrEqual(NIGHT_MAX);
      }
    }
  });

  it('washes harder the darker it gets, without exception', () => {
    const ordered = SEASONS.flatMap((s) => [lightAt(s, false), lightAt(s, true)])
      .sort((a, b) => a.level - b.level);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(washOpacity(ordered[i]!.level))
        .toBeLessThanOrEqual(washOpacity(ordered[i - 1]!.level));
    }
  });

  it('closes the frame in as the light goes, and never shuts it', () => {
    const day = lightAt('summer', false);
    const night = lightAt('winter', true);
    expect(night.vignette).toBeGreaterThan(day.vignette);
    expect(night.vignette).toBeLessThan(1);
    expect(day.vignette).toBeGreaterThan(0);
  });

  it('turns the wash from warm to cold as the day goes', () => {
    // One light pass, not a day one and a night one: the same rect carries
    // the low warm sun of an afternoon and the cold of a winter night.
    expect(lightAt('summer', false).tint).not.toBe(lightAt('winter', true).tint);
    expect(lightAt('winter', true).tint).toBe(lightAt('autumn', true).tint);
  });
});
