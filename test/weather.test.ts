// Weather, and the two things it must never be.
//
// It must never be UNANNOUNCED — this game's oldest promise is that the
// player was told the number and chose; a gale that arrives out of a clear
// sky is a dice roll wearing a sail.
//
// And it must never be FELT BY THE FIRE AND NOT BY THE MARK. `upkeep.ts` has
// carried the comment "the mark and the fire have to move together or the
// mark is lying to the player" since the winter mark was written, and a
// frost that burned wood the forecast never counted would break it silently
// — the exact class of bug item 5 spent a session digging out of `reachable`.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { WEATHER, weatherById } from '../src/data/weather';
import { omenFor, seaShut, weatherNow, weatherOn } from '../src/sim/weather';
import { firewoodPerNight } from '../src/sim/upkeep';
import { forecast, markHaze, PRUDENCE } from '../src/sim/winter';
import { isCoastalWater, moveEffort } from '../src/sim/travel';
import { effectsOn, nextThaw, SEASON_LENGTH, SEASON_ORDER, seasonOf } from '../src/sim/calendar';
import { hardshipById } from '../src/data/hardship';
import { fromKey } from '../src/hex';
import type { Season } from '../src/state/types';

const dayIn = (season: Season): number => SEASON_ORDER.indexOf(season) * SEASON_LENGTH + 12;

describe('the sky is a function of the run, not of the moment', () => {
  it('gives the same day the same weather every time it is asked', () => {
    // The whole design rests on this: no field on GameState, no save bump,
    // and — because asking costs nothing and changes nothing — TOMORROW is
    // knowable today.
    for (let day = 1; day < 200; day += 7) {
      expect(weatherOn('sky-stable', day).id).toBe(weatherOn('sky-stable', day).id);
    }
  });

  it('gives different runs different years', () => {
    const a = Array.from({ length: 120 }, (_, d) => weatherOn('sky-a', d + 1).id).join('');
    const b = Array.from({ length: 120 }, (_, d) => weatherOn('sky-b', d + 1).id).join('');
    expect(a).not.toBe(b);
  });

  it('never puts a hard frost in high summer', () => {
    // A weight table that leaked would be invisible until somebody noticed
    // the fire burning double in July.
    for (let day = 1; day <= SEASON_LENGTH * 4; day += 1) {
      const w = weatherOn('sky-season', day);
      expect(
        (w.weight[seasonOf(day)] ?? 0),
        `${w.id} turned up in ${seasonOf(day)}, which its table forbids`,
      ).toBeGreaterThan(0);
    }
  });

  it('leaves most days alone', () => {
    // Weather every day is not weather, it is a tax — and a tax cannot be
    // planned around, because there is no fair day to save the voyage for.
    let fair = 0;
    const N = 600;
    for (let day = 1; day <= N; day += 1) if (weatherOn('sky-rate', day).id === 'fair') fair += 1;
    expect(fair / N).toBeGreaterThan(0.5);
    expect(fair / N, 'nothing ever happens').toBeLessThan(0.9);
  });
});

describe('nothing arrives unannounced', () => {
  it('announces every rough spell the evening before it begins', () => {
    // Stated on the day weather ARRIVES rather than on every day it is
    // forecast, which is the honest version of the promise: a gale already
    // blowing was announced last night, and saying "a gale by morning" into
    // it a second time is both false and a stutter in the log.
    const state = structuredClone(newGame('sky-omen'));
    let arrivals = 0;
    for (let day = 2; day < 300; day += 1) {
      const today = weatherOn(state.seed, day);
      const yesterday = weatherOn(state.seed, day - 1);
      state.day = day - 1;
      if (today.id !== 'fair' && today.id !== yesterday.id) {
        arrivals += 1;
        expect(omenFor(state), `day ${day}: ${today.id} arrived unannounced`).toBeTruthy();
      } else {
        expect(omenFor(state), `day ${day}: said something it should not have`).toBeUndefined();
      }
    }
    expect(arrivals, 'nothing ever arrived, so nothing was tested').toBeGreaterThan(10);
  });

  it('says what it will cost, not just what it looks like', () => {
    // An omen the player cannot act on is flavour. Every kind that does
    // something has to say what.
    for (const def of WEATHER) {
      if (def.id === 'fair') continue;
      expect(def.omen.length, `${def.id} has no omen`).toBeGreaterThan(0);
      const bites = def.shutsTheSea || def.travel > 0 || def.firewood !== 0 || def.sight !== 0;
      expect(bites, `${def.id} is weather that does nothing`).toBe(true);
    }
  });
});

describe('a gale shuts the sea, and never traps anybody on it', () => {
  it('closes the water and leaves the beach open', () => {
    const state = structuredClone(newGame('sky-gale'));
    const water = Object.keys(state.world.tiles).map(fromKey)
      .find((at) => isCoastalWater(state, at));
    const land = Object.entries(state.world.tiles).find(([, t]) => t.terrain === 'meadow')![0];
    expect(water).toBeTruthy();

    // Find a day this run is blown out, and one it is not.
    let galeDay = 0;
    for (let d = 1; d < 400 && !galeDay; d += 1) if (weatherOn(state.seed, d).shutsTheSea) galeDay = d;
    expect(galeDay, 'this seed never blows').toBeGreaterThan(0);

    state.day = galeDay;
    expect(moveEffort(state, water!), 'the sea stayed open in a gale').toBeNull();
    // THE RULE THAT MATTERS. A band already afloat can always row the one hex
    // ashore — the same guarantee the unseaworthy hull has. Weather may cost
    // a voyage; it may not eat a saga.
    expect(moveEffort(state, fromKey(land)), 'a gale stranded the band on the water')
      .not.toBeNull();
  });

  it('agrees with what it tells the player', () => {
    const state = structuredClone(newGame('sky-agree'));
    for (let day = 1; day < 200; day += 1) {
      state.day = day;
      expect(seaShut(state)).toBe(weatherNow(state).shutsTheSea);
    }
  });
});

describe('the mark and the fire move together', () => {
  /**
   * THE INVARIANT `upkeep.ts` HAS ASKED FOR SINCE THE MARK WAS WRITTEN.
   *
   * Weather is added to the night's burn in `firewoodPerNight` and to the
   * forecast in `plannedFirewood`. Two places, one number. If they ever
   * disagree the mark is short by exactly the frosts between here and the
   * thaw, and the player is told a target that cannot save them.
   */
  it('counts a frost night in the forecast as well as in the woodpile', () => {
    const state = structuredClone(newGame('sky-mark', 'even'));
    // Deep enough into winter that the mark is exact rather than hazy.
    state.day = dayIn('winter') + 8;

    const frostDays: number[] = [];
    for (let d = state.day + 1; d <= dayIn('winter') + SEASON_LENGTH; d += 1) {
      if (weatherOn(state.seed, d).firewood > 0) frostDays.push(d);
    }
    expect(frostDays.length, 'no frost ahead to measure').toBeGreaterThan(0);

    // The burn on a frost day exceeds the burn on a fair one, all else equal.
    const fairDay = [...Array(SEASON_LENGTH).keys()]
      .map((i) => dayIn('winter') + 8 + i)
      .find((d) => weatherOn(state.seed, d).firewood === 0);
    expect(fairDay).toBeTruthy();

    const onFrost = structuredClone(state);
    onFrost.day = frostDays[0]!;
    const onFair = structuredClone(state);
    onFair.day = fairDay!;
    expect(firewoodPerNight(onFrost)).toBeGreaterThan(firewoodPerNight(onFair));

    // THE COUPLING ITSELF, pinned as a formula rather than as a consequence.
    //
    // Two earlier cuts of this bar did not fail when the mark was made to
    // ignore weather. `forecast().firewood > 0` was meaningless. Then
    // "the mark must cover what the nights will burn" ALSO passed — because
    // PRUDENCE is 1.15 and the frosts in a winter come to less than that
    // margin, so the promise held while the coupling was broken. A bar with
    // slack in it cannot pin an invariant; this one recomputes what the mark
    // must be, weather included, and demands the number.
    expect(markHaze(state.day), 'the mark must be exact here, not hazy').toBe(0);
    const terms = hardshipById(state.hardship).winter;
    let expected = 0;
    for (let d = state.day + 1; d <= nextThaw(state.day); d += 1) {
      if (seasonOf(d) !== 'winter') {
        expected += effectsOn(d).firewood;
        continue;
      }
      expected += Math.max(
        0,
        effectsOn(d, state.seed).firewood + weatherOn(state.seed, d).firewood,
      ) * terms;
    }
    expect(
      forecast(state).firewood,
      'the mark is not walking the weather the fire will feel',
    ).toBe(Math.round(expected * PRUDENCE));
  });

  it('never asks the fire for a negative night', () => {
    // A thaw takes firewood OFF the burn. Floored, or a warm spell would pay
    // the band to sit still.
    const state = structuredClone(newGame('sky-thaw'));
    for (let day = 1; day < 300; day += 1) {
      state.day = day;
      expect(firewoodPerNight(state), `day ${day}`).toBeGreaterThanOrEqual(1);
    }
    expect(weatherById('thaw').firewood).toBeLessThan(0);
  });
});
