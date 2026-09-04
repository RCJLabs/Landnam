// The coast as a line: what a route has to be before anything walks it.
//
// Same arrangement as `ranks.test.ts`, and for the same reason — this is the
// shape 8.2 rests on, written and proved before a single caller exists, so
// that when travel moves onto it a failure here means the SHAPE is wrong
// rather than some caller misusing it.
//
// The claim that matters most is the last group. This milestone's own bar is
// "a saga can be walked end to end on the route", and a coast with a leg
// nobody can afford, or a far end nobody can reach, fails it silently.

import { describe, expect, it } from 'vitest';
import {
  LEG_MAX, LEG_MIN, ROUTE_STOPS,
  daysBetween, neighbourStops, onRoute, placeAt, placesOn, reachable, richness,
  route, stopAt,
} from '../src/sim/route';
import { PLACE_KINDS } from '../src/data/places';

const SEEDS = ['raven-skerry-317', 'grim-fjord-100', 'curve-7', 'Þórr-vik'];

describe('the coast is the same coast every time', () => {
  it('gives the same stop for the same seed and index', () => {
    for (const seed of SEEDS) {
      for (const i of [0, 1, 7, ROUTE_STOPS - 1]) {
        expect(stopAt(seed, i)).toEqual(stopAt(seed, i));
      }
    }
  });

  it('does not depend on the order stops are asked for', () => {
    // The property the whole derived-not-stored discipline rests on: a strip
    // map can draw country the band has never walked, and it draws the same
    // country whichever end it starts from.
    const forward = Array.from({ length: 8 }, (_, i) => stopAt('s', i));
    const backward = Array.from({ length: 8 }, (_, i) => stopAt('s', 7 - i)).reverse();
    expect(forward).toEqual(backward);
  });

  it('gives two worlds different coasts', () => {
    const a = route('one').map((s) => `${s.country}/${s.leg}`).join(',');
    const b = route('two').map((s) => `${s.country}/${s.leg}`).join(',');
    expect(a).not.toBe(b);
  });

  it('does not make one long stretch of the same country', () => {
    // A coast that is meadow for nine stops is a coast with nothing to
    // notice, and it is what a badly salted stream produces.
    for (const seed of SEEDS) {
      const countries = route(seed).map((s) => s.country);
      let run = 1;
      let longest = 1;
      for (let i = 1; i < countries.length; i += 1) {
        run = countries[i] === countries[i - 1] ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
      expect(longest, `${seed} runs ${longest} stops of one country`).toBeLessThanOrEqual(4);
    }
  });
});

describe('the landing, and the shape of the coast', () => {
  it('beaches the knarr on shore, with nothing walked yet', () => {
    for (const seed of SEEDS) {
      expect(stopAt(seed, 0).country).toBe('shore');
      expect(stopAt(seed, 0).leg).toBe(0);
    }
  });

  it('runs exactly as many stops as it says, and nothing beyond', () => {
    expect(route('s')).toHaveLength(ROUTE_STOPS);
    expect(onRoute(0)).toBe(true);
    expect(onRoute(ROUTE_STOPS - 1)).toBe(true);
    expect(onRoute(ROUTE_STOPS)).toBe(false);
    expect(onRoute(-1)).toBe(false);
    expect(onRoute(1.5), 'half a stop up the coast').toBe(false);
  });

  it('walks every leg in between one and three days', () => {
    for (const seed of SEEDS) {
      for (const stop of route(seed).slice(1)) {
        expect(stop.leg, `${seed} stop ${stop.index}`).toBeGreaterThanOrEqual(LEG_MIN);
        expect(stop.leg, `${seed} stop ${stop.index}`).toBeLessThanOrEqual(LEG_MAX);
      }
    }
  });
});

describe('distance costs the same both ways', () => {
  // Not a symmetry for tidiness. It is the whole decision: a day spent
  // walking out is a day that has to be spent again walking home, which is
  // what makes "how far do I push" a question at all.
  it('is the same walk whichever way you are facing', () => {
    for (const seed of SEEDS) {
      expect(daysBetween(seed, 3, 11)).toBe(daysBetween(seed, 11, 3));
    }
  });

  it('costs nothing to stand still', () => {
    expect(daysBetween('s', 6, 6)).toBe(0);
  });

  it('adds up along the way', () => {
    expect(daysBetween('s', 2, 9)).toBe(daysBetween('s', 2, 5) + daysBetween('s', 5, 9));
  });

  it('is further to a further stop, always', () => {
    for (const seed of SEEDS) {
      for (let i = 1; i < ROUTE_STOPS; i += 1) {
        expect(daysBetween(seed, 0, i)).toBeGreaterThan(daysBetween(seed, 0, i - 1));
      }
    }
  });
});

describe('how far you could get', () => {
  it('gets nowhere on no days', () => {
    expect(reachable('s', 4, 0)).toBe(4);
  });

  it('never claims a stop the days do not pay for', () => {
    for (const seed of SEEDS) {
      for (const days of [1, 2, 5, 13, 40]) {
        const got = reachable(seed, 0, days);
        expect(daysBetween(seed, 0, got), `${seed}, ${days} days`).toBeLessThanOrEqual(days);
      }
    }
  });

  it('claims the furthest one they do pay for', () => {
    for (const seed of SEEDS) {
      for (const days of [1, 2, 5, 13, 40]) {
        const got = reachable(seed, 0, days);
        if (got >= ROUTE_STOPS - 1) continue;
        expect(daysBetween(seed, 0, got + 1), `${seed}, ${days} days`).toBeGreaterThan(days);
      }
    }
  });

  it('turns back as well as out', () => {
    for (const seed of SEEDS) {
      const home = reachable(seed, 10, 4, false);
      expect(home).toBeLessThan(10);
      expect(daysBetween(seed, 10, home)).toBeLessThanOrEqual(4);
    }
  });

  it('stops at the ends of the coast rather than walking off them', () => {
    expect(reachable('s', 0, 999, false)).toBe(0);
    expect(reachable('s', ROUTE_STOPS - 1, 999, true)).toBe(ROUTE_STOPS - 1);
    expect(reachable('s', 0, 999, true)).toBe(ROUTE_STOPS - 1);
  });
});

describe('the coast is worth more the further you go', () => {
  it('is worth nothing at the landing and everything at the headland', () => {
    expect(richness(0)).toBe(0);
    expect(richness(ROUTE_STOPS - 1)).toBe(1);
  });

  it('never pays less for going further', () => {
    for (let i = 1; i < ROUTE_STOPS; i += 1) {
      expect(richness(i), `stop ${i}`).toBeGreaterThan(richness(i - 1));
    }
  });

  it('does not pay much for nibbling at the near coast', () => {
    // A straight line would make three stops out worth an eighth of the
    // whole coast, and a band could call that a voyage. The curve is what
    // stops "how far" having one cheap answer.
    expect(richness(3)).toBeLessThan(richness(ROUTE_STOPS - 1) / 8);
  });
});

describe('what is on the coast', () => {
  it('puts nothing on the landing itself', () => {
    for (const seed of SEEDS) expect(placeAt(seed, 0)).toBeUndefined();
  });

  it('never seeds a kind nearer than its own floor allows', () => {
    // `minFromLanding` already meant "how far out before this is allowed",
    // which is the one thing that survives the change of coordinate
    // completely unaltered.
    for (const seed of SEEDS) {
      for (const { index, kind } of placesOn(seed)) {
        const def = PLACE_KINDS.find((k) => k.id === kind)!;
        expect(index, `${seed}: ${kind} at ${index}`).toBeGreaterThanOrEqual(def.minFromLanding);
      }
    }
  });

  it('never seeds a kind worldgen is not allowed to grow', () => {
    // A ruin is somebody else's dead steading arriving on a challenge code.
    // A coast that grew its own would be a coast where the ghost meant
    // nothing — see data/places.ts.
    const unseeded = PLACE_KINDS.filter((k) => k.seeded === false).map((k) => k.id);
    for (const seed of SEEDS) {
      for (const { kind } of placesOn(seed)) expect(unseeded).not.toContain(kind);
    }
  });

  it('puts at most one thing at a stop', () => {
    for (const seed of SEEDS) {
      const at = placesOn(seed).map((p) => p.index);
      expect(new Set(at).size).toBe(at.length);
    }
  });

  it('gives every coast somewhere to go, and does not pave it', () => {
    for (const seed of SEEDS) {
      const n = placesOn(seed).length;
      expect(n, `${seed} has nothing on it`).toBeGreaterThanOrEqual(2);
      expect(n, `${seed} is wall to wall places`).toBeLessThanOrEqual(ROUTE_STOPS / 2);
    }
  });

  it('puts more of them out where the coast is rich', () => {
    // Across enough coasts to be a claim about the rule rather than one
    // world's luck: the far half must hold more than the near half.
    let near = 0;
    let far = 0;
    for (let i = 0; i < 60; i += 1) {
      for (const p of placesOn(`spread-${i}`)) {
        if (p.index < ROUTE_STOPS / 2) near += 1;
        else far += 1;
      }
    }
    expect(far, `near ${near}, far ${far}`).toBeGreaterThan(near);
  });
});

describe('THE BAR — a saga can be walked end to end', () => {
  it('reaches the far headland from the landing, one stop at a time', () => {
    for (const seed of SEEDS) {
      let at = 0;
      let days = 0;
      for (let guard = 0; guard < ROUTE_STOPS * 2 && at < ROUTE_STOPS - 1; guard += 1) {
        const next = at + 1;
        days += stopAt(seed, next).leg;
        at = next;
      }
      expect(at, `${seed}: the coast ran out before its far end`).toBe(ROUTE_STOPS - 1);
      expect(days).toBe(daysBetween(seed, 0, ROUTE_STOPS - 1));
    }
  });

  it('is a walk a settled band can make and a landing one cannot', () => {
    // The number ROUTE_STOPS was chosen against, stated so that changing it
    // has to be a decision rather than a nudge. A first winter comes at day
    // 90-ish; the far headland and back must be well past that, or depth is
    // free. And it must not be so far that a hall with a summer to spend
    // could never reach it either.
    for (const seed of SEEDS) {
      const thereAndBack = daysBetween(seed, 0, ROUTE_STOPS - 1) * 2;
      expect(thereAndBack, `${seed}: the whole coast inside one season`).toBeGreaterThan(90);
      expect(thereAndBack, `${seed}: the far end is scenery`).toBeLessThan(240);
    }
  });
});

describe('where the people already on this coast live', () => {
  // Fixed rather than imported from data/clans, so this file stays a test of
  // the COAST. If somebody adds a fifth clan, `neighbours.test.ts` is where
  // that should be felt.
  const COUNT = 4;
  const NEAR = 13;
  const ROOM = 2;
  const stops = (seed: string) => neighbourStops(seed, COUNT, NEAR, ROOM);

  it('puts one on every quarter of the coast', () => {
    // The claim the whole placement exists for. A coast whose people all live
    // inside the first fortnight answers "how far do I push" with "never
    // far", because there is nobody out there to push toward.
    for (const seed of SEEDS) {
      const got = stops(seed);
      expect(got.length, seed).toBe(COUNT);
      const band = (ROUTE_STOPS - 1) / COUNT;
      got.forEach((s, i) => {
        expect(Math.floor((s - 1) / band), `${seed}: stop ${s} of quarter ${i}`).toBe(i);
      });
    }
  });

  it('leaves the landing foundable', () => {
    // Not tidiness. `site.foundBlocker` refuses ground inside somebody's
    // elbow, the landing is the only site a band has seen on day one, and a
    // camp on stop 1 would take it away from them.
    for (const seed of SEEDS) {
      for (const s of stops(seed)) {
        expect(Math.abs(s - 0), `${seed}: somebody on stop ${s}`).toBeGreaterThanOrEqual(ROOM);
      }
    }
  });

  it('keeps the nearest of them near enough to be a neighbour', () => {
    for (const seed of SEEDS) {
      const nearest = Math.min(...stops(seed));
      expect(daysBetween(seed, 0, nearest), seed).toBeLessThanOrEqual(NEAR);
    }
  });

  it('reaches the far half of the coast', () => {
    // The other end of the same claim: pushing out has to find PEOPLE and
    // not only plunder, or trade and standing are landing-side systems and
    // depth buys loot alone.
    for (const seed of SEEDS) {
      const furthest = Math.max(...stops(seed));
      expect(furthest, seed).toBeGreaterThan((ROUTE_STOPS - 1) / 2);
    }
  });

  it('gives everyone their own stop, and keeps off the places where it can', () => {
    for (const seed of SEEDS) {
      const got = stops(seed);
      expect(new Set(got).size, `${seed}: two of them in one camp`).toBe(got.length);
      // Not an absolute — a quarter with something on every stop still gets
      // its neighbour rather than being left empty. The bar is that it does
      // not happen when there is anywhere else to stand.
      for (const s of got) {
        if (!placeAt(seed, s)) continue;
        const band = (ROUTE_STOPS - 1) / COUNT;
        const i = Math.floor((s - 1) / band);
        const lo = Math.max(1, ROOM, Math.round(1 + i * band));
        const hi = Math.min(ROUTE_STOPS - 1, Math.round((i + 1) * band));
        let free = 0;
        for (let t = lo; t <= hi; t += 1) if (!placeAt(seed, t)) free += 1;
        expect(free, `${seed}: stop ${s} shares with a place for no reason`).toBe(0);
      }
    }
  });

  it('is the same coast every time it is asked', () => {
    for (const seed of SEEDS) expect(stops(seed)).toEqual(stops(seed));
    expect(stops('a')).not.toEqual(stops('b'));
  });
});
