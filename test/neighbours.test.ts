// 4.3: the other people on this coast.
//
// The roadmap's line is "persistent rival clans and native settlements", and
// the word that has to be true is PERSISTENT. A raid must not be a card that
// resolves and clears; it has to be a thing a named place is still holding
// against you a season later. So the bar this file holds itself to is:
//
//   they remember.
//
// A band that falls on its neighbours must take measurably more and bigger
// raids, and get measurably worse prices, than one that deals with them — and
// the difference must still be there long after the deed.

import { settled as settleSomewhere } from './fixtures/settle';
import { goHome, standBeside } from './fixtures/stand';
import { ROUTE_STOPS, daysBetween, onRoute, stopAt } from '../src/sim/route';
import { learnStop } from '../src/sim/coast';
import { describe, it, expect } from 'vitest';
import { stream } from '../src/rng';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { foundBlocker, hasBeck, stopReport } from '../src/sim/site';
import { WATER_FLOOR } from '../src/data/sites';
import { campStores, sackCamp } from '../src/sim/plunder';
import { assign } from '../src/sim/colony';
import { eventChance, isEligible } from '../src/sim/events';
import { raidDifficulty } from '../src/sim/raid';
import { startRaid } from '../src/sim/battleTurn';
import { EVENTS } from '../src/data/events';
import {
  BARTER_FOOD,
  CAMP_PICKED_CLEAN,
  CAMP_REGROW,
  CLAN_CALLS_EVERY,
  CLAN_COUNT,
  CLAN_ELBOW,
  CLAN_KINDS,
  CLAN_MAX_GAP,
  REP_DRIFT,
  REP_RAIDED,
  REP_TRADED,
  TRADE_FLOOR,
  clanKind,
  standingFor,
} from '../src/data/clans';
import {
  angerLevel,
  angriest,
  bargain,
  bargainEstimate,
  bargainBlurb,
  bargainBlocker,
  driftStandings,
  fallOn,
  friendliest,
  goodwillLevel,
  neighboursCallOn,
  noteRaidSent,
  placeNeighbours,
  raidPressure,
  seeNeighbours,
  shiftStanding,
  stirFactor,
  tradeRate,
} from '../src/sim/neighbours';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/** A steading on the best ground within reach, crewed and stocked. */
function settled(seed: string, radius = 14): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed, { radius });
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.party.food = 90;
  state.party.firewood = 90;
  state.day = 30;
  seeNeighbours(state);
  return state;
}

/** Falls on every neighbour once, without fighting anybody. */
function makeEnemies(state: GameState): void {
  for (const n of state.neighbours) {
    standBeside(state, n);
    expect(fallOn(state, n.id)).not.toBeNull();
  }
  goHome(state);
}

/** Deals honestly with every neighbour, the same number of times. */
function makeFriends(state: GameState, rounds = 4): void {
  for (const n of state.neighbours) {
    standBeside(state, n);
    for (let i = 0; i < rounds; i++) {
      state.party.food = 200;
      expect(bargain(state, n.id)).not.toBeNull();
    }
  }
  goHome(state);
  state.party.food = 90;
}

/** Which cards can end in somebody coming over the ridge. */
function isRaidCard(def: (typeof EVENTS)[number]): boolean {
  return def.choices.some((c) =>
    [c.success, c.failure].some((o) => o?.effects.some((f) => f.t === 'raid')),
  );
}

/**
 * Expected raids per travel action: how often the country stirs at all, times
 * the share of the drawable pool that ends in a fight at the gate. This is the
 * honest reading of "more raids" — both levers, one number.
 */
function raidsPerAction(state: GameState): number {
  const pool = EVENTS.filter((def) => isEligible(state, def));
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total === 0) return 0;
  const raidy = pool.filter(isRaidCard).reduce((sum, e) => sum + e.weight, 0);
  return eventChance(state) * (raidy / total);
}

const SEEDS = ['nb-a', 'nb-b', 'nb-c', 'nb-d', 'nb-e', 'nb-f', 'nb-g', 'nb-h'];

describe('the coast has people on it', () => {
  it('every seed places neighbours, off the landing and apart from each other', () => {
    for (const seed of SEEDS) {
      const state = newGame(seed);
      const placed = state.neighbours;
      expect(placed.length, seed).toBeGreaterThanOrEqual(2);
      expect(placed.length, seed).toBeLessThanOrEqual(CLAN_COUNT);

      const names = new Set(placed.map((n) => n.name));
      expect(names.size, `${seed}: duplicate names`).toBe(placed.length);
      const ids = new Set(placed.map((n) => n.id));
      expect(ids.size, `${seed}: duplicate ids`).toBe(placed.length);

      for (const n of placed) {
        // The same two claims in the address a line has. Nobody lives on
        // water or on bare rock — which holds by construction here, since
        // `stopAt` never calls a stretch ocean or mountains, and is asserted
        // rather than assumed so that changing the country mix has to be a
        // decision. And nobody camps on the beach the band lands on:
        // `neighbourStops` is handed CLAN_ELBOW as its floor.
        expect(n.stop, `${seed}: ${n.name} is nowhere`).not.toBeUndefined();
        const country = stopAt(seed, n.stop!).country;
        expect(['ocean', 'mountains'], `${seed}: ${n.name}`).not.toContain(country);
        expect(n.stop, `${seed}: ${n.name} on the beach`).toBeGreaterThanOrEqual(CLAN_ELBOW);
        expect(n.found).toBeFalsy();
      }
      // Apart from each other, which on a line is what "apart" means: no
      // two households at the same stretch.
      const at = placed.map((n) => n.stop);
      expect(new Set(at).size, `${seed}: two households on one stretch`).toBe(placed.length);
          }
  });

  it('both kinds of people are on every coast that holds four', () => {
    let full = 0;
    for (const seed of SEEDS) {
      const placed = newGame(seed).neighbours;
      if (placed.length < CLAN_COUNT) continue;
      full += 1;
      const kinds = new Set(placed.map((n) => clanKind(n.kind).id));
      expect(kinds.has('native'), seed).toBe(true);
      expect(kinds.has('clan'), seed).toBe(true);
    }
    expect(full, 'no seed managed a full coast').toBeGreaterThan(0);
  });

  it('the people already here open warmer than the people who came last year', () => {
    // Not a per-seed rule — there is a jitter on the opening — but the
    // difference has to be visible across a handful of coasts.
    let native = 0;
    let clan = 0;
    let natives = 0;
    let clans = 0;
    for (const seed of SEEDS) {
      for (const n of newGame(seed).neighbours) {
        if (clanKind(n.kind).id === 'native') {
          native += n.standing;
          natives += 1;
        } else {
          clan += n.standing;
          clans += 1;
        }
      }
    }
    expect(native / natives).toBeGreaterThan(clan / clans);
  });

  /**
   * THE BAR THE COAST DID NOT HAVE.
   *
   * There was a floor on how close a neighbour could be placed and no
   * ceiling at all, so on a landmass of eighteen hundred tiles the four of
   * them scattered — measured at 23, 24, 25 and 38 hexes from one steading.
   * A band sees two to seven percent of that map in five hundred days.
   * Everything downstream (standing, barter, tribute, the friend a jarldom
   * needs) was real code nobody could reach, and it took the long-game
   * harness reporting "0 made a friend" over forty sagas to notice.
   */
  it('they share a coast, and a coast is something you can walk', () => {
    for (const seed of SEEDS) {
      const state = newGame(seed);
      // On a line every stretch is walkable from every other — that is what
      // a route IS — so "within CLAN_MAX_GAP of the landing" cannot be the
      // claim for all four without emptying the far half of the coast of
      // people. `neighbourStops` spreads one per quarter and puts a CEILING
      // on the first: the NEAREST of them is a neighbour in the ordinary
      // sense of the word, and the rest are further up the same coast.
      //
      // So that is what is checked, and it is the same thing the hex
      // ceiling was protecting: somebody close enough to reach in the time
      // a band has, rather than four households nobody ever meets.
      const walks = state.neighbours.map((n) => daysBetween(seed, 0, n.stop!));
      expect(walks.length, `${seed}: nobody on this coast`).toBeGreaterThan(0);
      expect(
        Math.min(...walks),
        `${seed}: the nearest household is ${Math.min(...walks)} days off — not a neighbour`,
      ).toBeLessThanOrEqual(CLAN_MAX_GAP);
      for (const n of state.neighbours) {
        expect(onRoute(n.stop!), `${seed}: ${n.name} is off the end of the coast`).toBe(true);
      }
    }
  });

  it('a walkable coast still leaves room to found a steading on it', () => {
    // The ceiling brings them near the landing, so the ground they live on
    // has to refuse the posts — otherwise the hall goes up in a native
    // camp's home field and "neighbour" means "in the yard".
    let refused = 0;
    for (const seed of SEEDS) {
      const state = structuredClone(newGame(seed));
      // The elbow, in stretches. On a line the ground a household holds is
      // its own stretch and the ones inside CLAN_ELBOW of it — there is no
      // ring of hexes to walk round, so the check walks the route instead.
      // `insideElbow` is what `foundBlocker` consults, and this pins that
      // it actually refuses.
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(state, stop);
      for (const n of state.neighbours) {
        // `insideElbow` is `< CLAN_ELBOW`, so the home field is their own
        // stretch and the one either side — which is exactly what the hex
        // arm below walks, `neighbors(n.at).concat([n.at])` being distance
        // 0 and 1. The first draft of this walked to ±CLAN_ELBOW and read
        // the sim's correct `null` at two stretches out as a hole in the
        // elbow.
        for (let d = -(CLAN_ELBOW - 1); d <= CLAN_ELBOW - 1; d += 1) {
          const stop = n.stop! + d;
          if (!onRoute(stop)) continue;
          // Only stretches that would otherwise TAKE a hall, so what is
          // being measured is the elbow and not the water — the same guard
          // the hex arm applies, and for the same reason: `foundBlocker`
          // answers 'dry' before it ever looks at who lives nearby.
          //
          // A BECK, not the water score. Since fresh water became the
          // settling gate the two are different questions: a stretch can
          // score a 1 or 2 off a bog behind it and still have nothing to
          // drink, and `foundBlocker` calls that dry.
          if (!hasBeck(seed, stop)) continue;
          if (stopReport(seed, stop).water < WATER_FLOOR) continue;
          state.party.stop = stop;
          expect(foundBlocker(state), `${seed}: founded in ${n.name}'s camp`)
            .toBe('taken');
          refused += 1;
        }
      }
    }
    expect(refused, 'no seed put foundable ground inside a camp').toBeGreaterThan(0);
    expect(CLAN_ELBOW).toBeGreaterThan(0);
  });

  it('a place is only on the map once somebody has seen it', () => {
    const state = structuredClone(newGame('nb-sight'));
    expect(state.neighbours.every((n) => !n.found)).toBe(true);
    const target = state.neighbours[0]!;
    seeNeighbours(state);
    expect(target.found, 'seen without looking').toBeFalsy();

    // A LINE HAS NO FOG, so "somebody has laid eyes on that ground" has no
    // mechanism behind it — `seeNeighbours` says so and uses the narrow
    // answer instead: you have come to where they live. Walking there is
    // the coast's version of seeing, and everything else about meeting
    // people runs through `neighboursCallOn`, which the next test holds.
    state.party.stop = target.stop;
        seeNeighbours(state);
    expect(target.found).toBe(true);
    expect(state.saga.some((e) => e.text.includes(target.name))).toBe(true);
  });

  /**
   * The other half of the same fix. Walking onto somebody's exact hex was
   * the only way to learn they existed — a search problem with no tools —
   * and the harness measured what it was worth: nought of thirty-two clans
   * met across eight full-length sagas. Being found is how it actually goes.
   */
  it('once the posts are in, the coast comes and looks at you', () => {
    const state = settled('nb-callson');
    // `settled` hands over a fully revealed map, which is the opposite of
    // what this measures. Put the fog back over the camps and forget them.
    for (const n of state.neighbours) {
      n.found = false;
      state.world.knownStops = (state.world.knownStops ?? []).filter((s) => s !== n.stop);
          }
    state.settlement!.foundedOn = state.day;
    expect(state.neighbours.some((n) => n.found), 'met somebody before settling').toBe(false);

    // One a fortnight, nearest first, and all of them inside the first
    // year. Driven by the rule rather than by passDay: a real steading is
    // interrupted by weather, raids and cards, and this measures the
    // schedule, not whether day 61 happened to be quiet.
    const seenOrder: number[] = [];
    const foundedOn = state.settlement!.foundedOn;
    for (let i = 1; i <= state.neighbours.length; i += 1) {
      state.day = foundedOn + CLAN_CALLS_EVERY * i - 1;
      neighboursCallOn(state);
      expect(state.neighbours.filter((n) => n.found).length, `called early, fortnight ${i}`)
        .toBe(i - 1);
      state.day = foundedOn + CLAN_CALLS_EVERY * i;
      neighboursCallOn(state);
      const after = state.neighbours.filter((n) => n.found);
      expect(after.length, `no caller in fortnight ${i}`).toBe(i);
      const last = after[after.length - 1]!;
      seenOrder.push(daysBetween(state.seed, last.stop!, state.settlement!.stop!));
    }

    expect(state.neighbours.every((n) => n.found), 'somebody never came').toBe(true);
    expect(state.day - foundedOn, 'the coast took longer than a year to notice').toBeLessThan(72);
    // Nearest first: the order is non-decreasing in distance from home.
    for (let i = 1; i < seenOrder.length; i += 1) {
      expect(seenOrder[i]!, 'the far camp came before the near one').toBeGreaterThanOrEqual(seenOrder[i - 1]!);
    }
    // And found means findable — a marker under fog is not knowledge.
    for (const n of state.neighbours) {
      // ON A LINE `found` IS THE KNOWLEDGE, and `revealNeighbour` says so:
      // there is no fog to lift, and marking (0,0) seen would write the
      // landing into the seen map of a world with no hexes in it.
      //
      // So the hex claim — a marker under fog is not knowledge — has to be
      // asked of what could still go wrong HERE, which is a household the
      // band has met and cannot act on. Two things carry that, and neither
      // consults `knownStops`: the chart draws a neighbour on `n.found`
      // alone (`render/strip.ts`), and `walkOptions` never asks whether a
      // stretch is known. So what must hold is that the stretch is a real
      // one on the route.
      expect(n.found, `${n.name} called and was not remembered`).toBe(true);
      expect(onRoute(n.stop!), `${n.name} named but off the end of the coast`).toBe(true);
    }
  });

  it('a raid names whoever sent it', () => {
    const state = settled('nb-tracks');
    for (const n of state.neighbours) n.found = false;
    const worst = state.neighbours.reduce((a, b) => (b.standing < a.standing ? b : a));
    worst.standing = -60;

    noteRaidSent(state);
    expect(worst.found, 'robbed by nobody in particular').toBe(true);
    expect(worst.raidsSent).toBe(1);
    expect(state.saga.some((e) => e.text.includes(worst.name))).toBe(true);
  });
});

describe('standing is a memory', () => {
  it('falling on somebody costs exactly what it says, and it sticks', () => {
    const state = settled('nb-stick');
    const target = state.neighbours[0]!;
    const before = target.standing;

    standBeside(state, target);
    expect(fallOn(state, target.id)).toBe(target.might);
    expect(target.standing).toBe(before + REP_RAIDED);

    // A season of drift must not wash it out. This is the milestone: if the
    // tally quietly reset, none of the rest of it would mean anything.
    for (let day = 0; day < 40; day++) driftStandings(state);
    expect(target.standing).toBeLessThan(before + REP_RAIDED + 40 * REP_DRIFT + 0.001);
    expect(target.standing, 'forty days wiped the slate').toBeLessThan(before - 30);
  });

  it('drift walks toward nothing and stops there, from either side', () => {
    const state = settled('nb-drift');
    const [a, b] = state.neighbours;
    a!.standing = 0.05;
    b!.standing = -0.05;
    for (let i = 0; i < 5; i++) driftStandings(state);
    expect(a!.standing).toBe(0);
    expect(b!.standing).toBe(0);
  });

  it('the whole tally survives a save and comes back the same', () => {
    const state = settled('nb-save');
    makeEnemies(state);
    const before = state.neighbours.map((n) => ({ ...n }));

    const round = migrate(JSON.parse(encode(state)) as Record<string, unknown>);
    expect(round.applied).toBe(0);
    const back = round.save as unknown as GameState;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.neighbours).toEqual(before);
  });

  it('a save from before the coast had people on it still loads', () => {
    const old = JSON.parse(encode(settled('nb-old'))) as Record<string, unknown>;
    delete old['neighbours'];
    old['version'] = 12;

    const { save, applied } = migrate(old);
    // v12 -> v13 -> v14: the coast, then what the band knows.
    expect(applied).toBe(SAVE_VERSION - 12);
    const back = save as unknown as GameState;
    expect(back.neighbours).toEqual([]);
    // And an empty coast is a coherent thing to be: nothing reads off it.
    expect(angriest(back)).toBeUndefined();
    expect(raidPressure(back)).toBe(0);
    expect(stirFactor(back)).toBe(1);
    expect(passDay(back)).toBe(true);
  });
});

describe('bartering', () => {
  it('the better they think of you, the more your food is worth', () => {
    expect(tradeRate(60)).toBeGreaterThan(tradeRate(25));
    expect(tradeRate(25)).toBeGreaterThan(tradeRate(-10));
    expect(tradeRate(-10)).toBeGreaterThan(tradeRate(TRADE_FLOOR));
  });

  it('a bargain moves food out, goods in, and the tally up', () => {
    const state = settled('nb-bargain');
    const target = state.neighbours[0]!;
    target.standing = 30;
    standBeside(state, target);
    const food = state.party.food;
    const wood = state.party.firewood;

    const deal = bargain(state, target.id)!;
    expect(deal).toBeTruthy();
    expect(state.party.food).toBe(food - BARTER_FOOD);
    expect(state.party.firewood).toBe(wood + deal.firewood);
    expect(deal.firewood).toBeGreaterThan(0);
    expect(target.standing).toBe(30 + REP_TRADED);
    expect(target.lastDealt).toBe(state.day);
  });

  it('nobody deals with you below the floor, and the panel says why', () => {
    const state = settled('nb-floor');
    const target = state.neighbours[0]!;
    standBeside(state, target);

    target.standing = TRADE_FLOOR;
    expect(bargainBlocker(state, target.id)).toBeNull();
    target.standing = TRADE_FLOOR - 1;
    expect(bargainBlocker(state, target.id)).toBe('standing');
    expect(bargain(state, target.id)).toBeNull();

    target.standing = 20;
    state.party.food = BARTER_FOOD - 1;
    expect(bargainBlocker(state, target.id)).toBe('stores');

    state.party.food = 90;
    goHome(state);
    expect(bargainBlocker(state, target.id)).toBe('nobody');
  });

  it('the same food buys less after you have raided them', () => {
    // Averaged across seeds because a single bargain carries a small roll —
    // the claim is about the rate, not about one afternoon.
    let friendly = 0;
    let hostile = 0;
    let refused = 0;
    for (const seed of SEEDS) {
      const good = settled(`${seed}-trade-good`);
      const bad = settled(`${seed}-trade-bad`);
      for (const [state, delta] of [
        [good, 40],
        [bad, REP_RAIDED],
      ] as const) {
        const target = state.neighbours[0]!;
        shiftStanding(state, target.id, delta);
        standBeside(state, target);
        state.party.food = 200;
        // A refusal is the worst price there is, and counts as one.
        const deal = bargain(state, target.id);
        if (!deal) refused += 1;
        if (delta > 0) friendly += deal?.firewood ?? 0;
        else hostile += deal?.firewood ?? 0;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `barter over ${SEEDS.length} coasts — dealt with: ${friendly}, ` +
        `raided: ${hostile} (${refused} refused outright)`,
    );
    expect(refused, 'a good neighbour turned us away').toBeLessThanOrEqual(SEEDS.length);
    expect(friendly).toBeGreaterThan(hostile);
  });

  /**
   * 11.M3: the deed sheet needed a preview of what `bargain()` will pay,
   * struck BEFORE the dice touch it — `bargainEstimate` is that formula with
   * the RNG term dropped to its midpoint (1.0).
   */
  it('estimates close to what bargain() actually pays, on average', () => {
    const state = settled('nb-estimate');
    const target = state.neighbours[0]!;
    target.standing = 30;
    standBeside(state, target);

    const estimate = bargainEstimate(state, target.id);
    expect(estimate).toBeGreaterThan(0);

    let total = 0;
    const N = 60;
    for (let i = 0; i < N; i += 1) {
      const s = settled(`nb-estimate-${i}`);
      const n = s.neighbours[0]!;
      n.standing = 30;
      standBeside(s, n);
      total += bargain(s, n.id)!.firewood;
    }
    const avg = total / N;
    // Within the RNG's own ±10% band, not pinned to one draw.
    expect(Math.abs(avg - estimate)).toBeLessThan(estimate * 0.15);
  });

  it('never touches the RNG stream — a preview cannot perturb the roll it previews', () => {
    const state = settled('nb-pure');
    const target = state.neighbours[0]!;
    target.standing = 30;
    standBeside(state, target);
    const before = bargainEstimate(state, target.id);
    // Called ten times over; a function that draws from `stream(...)` would
    // answer differently as the derived stream advanced.
    for (let i = 0; i < 10; i += 1) expect(bargainEstimate(state, target.id)).toBe(before);
    // And the real roll is unaffected by how many times the preview ran.
    const deal = bargain(state, target.id)!;
    expect(deal.firewood).toBeGreaterThan(0);
  });

  describe('the record on a trade that cannot fill an empty larder (11.M3)', () => {
    /**
     * `bargain()` runs one way — food out, firewood in — so it structurally
     * cannot rescue a band that is short of FOOD specifically. MEASURED
     * (`PROBE: 11.M3`): trying it first in that exact crisis moved nothing,
     * saved 4 / killed 4 over 150 paired landings, the arm firing 55 times.
     * `bargainBlurb`'s `starving` flag says so on the deed sheet rather than
     * leaving a player to find out the hard way.
     */
    it('says nothing extra when the band is not starving', () => {
      const state = settled('nb-blurb-fine');
      const target = state.neighbours[0]!;
      target.standing = 30;
      standBeside(state, target);
      expect(bargainBlurb(state, target.id, false)).not.toMatch(/will not fill/);
    });

    it('warns plainly when it is', () => {
      const state = settled('nb-blurb-starving');
      const target = state.neighbours[0]!;
      target.standing = 30;
      standBeside(state, target);
      const blurb = bargainBlurb(state, target.id, true);
      expect(blurb).toMatch(/will not fill an empty larder/);
      // The warning is additional, not instead of — the numbers still show.
      expect(blurb).toContain(`${bargainEstimate(state, target.id)}`);
    });
  });
});

describe('THE BAR — they remember', () => {
  it('a raided coast sends more raids than a coast you have dealt with', () => {
    let worse = 0;
    for (const seed of SEEDS) {
      const raider = settled(`${seed}-more-raid`);
      const dealer = settled(`${seed}-more-deal`);
      makeEnemies(raider);
      makeFriends(dealer);

      const hot = raidsPerAction(raider);
      const calm = raidsPerAction(dealer);
      expect(hot, `${seed}: raiding bought peace`).toBeGreaterThan(calm);
      if (hot > calm) worse += 1;
    }
    expect(worse).toBe(SEEDS.length);
  });

  it('and bigger ones: more of them come over the wall', () => {
    let bigger = 0;
    let raiderFoes = 0;
    let dealerFoes = 0;

    for (const seed of SEEDS) {
      const raider = settled(`${seed}-big-raid`);
      const dealer = settled(`${seed}-big-deal`);
      makeEnemies(raider);
      makeFriends(dealer);

      expect(raidPressure(raider), seed).toBeGreaterThan(raidPressure(dealer));
      expect(raidDifficulty(raider), seed).toBeGreaterThan(raidDifficulty(dealer));

      startRaid(raider, raidDifficulty(raider));
      startRaid(dealer, raidDifficulty(dealer));
      const hot = raider.battle!.foes.length;
      const calm = dealer.battle!.foes.length;
      raiderFoes += hot;
      dealerFoes += calm;
      if (hot > calm) bigger += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `raiders fielded against us over ${SEEDS.length} coasts — ` +
        `after raiding them: ${raiderFoes}, after dealing with them: ${dealerFoes}`,
    );
    expect(raiderFoes).toBeGreaterThan(dealerFoes);
    expect(bigger, 'the wronged coast was no bigger anywhere').toBeGreaterThanOrEqual(
      SEEDS.length - 1,
    );
  });

  it('a card only the wronged can draw, and one only the trusted can', () => {
    const raider = settled('nb-cards-raid');
    const dealer = settled('nb-cards-deal');
    makeEnemies(raider);
    makeFriends(dealer, 6);

    const remembered = EVENTS.find((e) => e.id === 'they-remember')!;
    expect(isEligible(raider, remembered), 'the wronged cannot be found').toBe(true);
    expect(isEligible(dealer, remembered), 'a good neighbour was hunted anyway').toBe(false);

    const basket = EVENTS.find((e) => e.id === 'a-basket-at-the-door')!;
    expect(isEligible(dealer, basket)).toBe(true);
    expect(isEligible(raider, basket)).toBe(false);

    const tribute = EVENTS.find((e) => e.id === 'tribute-asked')!;
    expect(isEligible(raider, tribute)).toBe(true);
    expect(isEligible(dealer, tribute)).toBe(false);
  });

  it('the grievance is still worth something a whole season later', () => {
    const raider = settled('nb-season-raid');
    const dealer = settled('nb-season-deal');
    makeEnemies(raider);
    makeFriends(dealer);

    // Two whole seasons of forgetting, with nothing done either way.
    for (let day = 0; day < 48; day++) {
      driftStandings(raider);
      driftStandings(dealer);
    }
    expect(angerLevel(raider)).toBeGreaterThan(20);
    expect(raidsPerAction(raider)).toBeGreaterThan(raidsPerAction(dealer));
    expect(raidDifficulty(raider)).toBeGreaterThan(raidDifficulty(dealer));
  });

  it('and it can be bought back — tribute is a real lever, not flavour', () => {
    const state = settled('nb-mend');
    makeEnemies(state);
    const hot = raidsPerAction(state);
    const hotAnger = angerLevel(state);
    const worst = angriest(state)!;

    // What the tribute card pays out, three times over.
    for (let i = 0; i < 3; i++) shiftStanding(state, worst.id, 22);
    expect(worst.standing).toBeGreaterThan(0);
    expect(raidsPerAction(state)).toBeLessThan(hot);
    // Squaring it with one of them is not squaring it with the coast — the
    // next-angriest is now the one who comes.
    expect(angerLevel(state)).toBeLessThan(hotAnger);
    expect(angriest(state)!.id).not.toBe(worst.id);
  });
});

describe('falling on a neighbour, in play', () => {
  it('draws steel through the real action path and docks the tally at once', () => {
    const state = settled('nb-inplay');
    const target = state.neighbours[0]!;
    const before = target.standing;
    standBeside(state, target);

    const next = apply(state, { type: 'FALL_ON', id: target.id });
    expect(next).not.toBe(state);
    expect(next.battle, 'nobody drew steel').toBeTruthy();
    expect(next.battle!.raid).toBeFalsy();
    expect(next.neighbours.find((n) => n.id === target.id)!.standing).toBe(before + REP_RAIDED);
    expect(next.saga.some((e) => e.text.includes(target.name))).toBe(true);
  });

  it('you cannot fall on somebody you are not standing in front of', () => {
    const state = settled('nb-reach');
    const target = state.neighbours[0]!;
    goHome(state);
    expect(apply(state, { type: 'FALL_ON', id: target.id })).toBe(state);
    expect(apply(state, { type: 'FALL_ON', id: 'nb_nobody' })).toBe(state);
    expect(target.standing).toBe(state.neighbours[0]!.standing);
  });

  it('bartering through the action path costs a day', () => {
    const state = settled('nb-day');
    const target = state.neighbours[0]!;
    target.standing = 30;
    standBeside(state, target);
    const day = state.day;

    const next = apply(state, { type: 'BARTER', id: target.id });
    expect(next).not.toBe(state);
    expect(next.day).toBe(day + 1);
    expect(next.party.food).toBeLessThan(state.party.food);
    expect(next.party.firewood).toBeGreaterThan(state.party.firewood);
  });
});

describe('a camp is a crop, not a windfall', () => {
  /**
   * Making raiding a way to LIVE rather than four one-off events.
   *
   * The audit measured what falling on a camp was worth: a native camp at
   * might two paid 24 food — eight days of eating for six people — against
   * forty-five standing, a permanent enemy, and a fight that kills people
   * for good. Nobody sane takes that trade, and the harness agreed: even the
   * policy built around plunder sacked 0.3 camps a saga.
   *
   * The haul is worth the reprisal now. What stops it being free money is
   * that a robbed camp has nothing left in it: their stores grow back over
   * `CAMP_REGROW`, so a band that means to live this way works a circuit of
   * the coast instead of standing on one camp forever.
   */
  it('pays a real haul the first time', () => {
    const state = settled('crop-first');
    const n = state.neighbours[0]!;
    const before = state.party.food + state.party.firewood;
    sackCamp(state, n.id);
    const took = state.party.food + state.party.firewood - before;
    // A third of a winter or thereabouts, which is what makes it worth the
    // forty-five standing it costs.
    expect(took).toBeGreaterThan(30);
    expect(n.sackedOn).toBe(state.day);
  });

  it('and next to nothing the morning after', () => {
    const state = settled('crop-again');
    const n = state.neighbours[0]!;
    const empty = state.party.food + state.party.firewood;
    sackCamp(state, n.id);
    const before = state.party.food + state.party.firewood;
    const first = before - empty;
    sackCamp(state, n.id);
    const second = state.party.food + state.party.firewood - before;
    expect(campStores(state, n.sackedOn)).toBeCloseTo(CAMP_PICKED_CLEAN, 5);

    // THE RATIO, NOT AN ABSOLUTE. This asserted `second < 15`, which was
    // never a property of the rule — it was one seed's neighbour. Measured
    // over forty seeds the second haul runs 10 to 25 on the HEX build alone,
    // so the threshold held here by luck and broke the moment a coast drew a
    // neighbour with more might.
    //
    // What is actually true is tighter, and identical on both builds: both
    // sacks fall on the same day, so `sackCamp` derives the SAME rng for each
    // and the only thing that differs is how full the camp was. The second
    // haul is therefore CAMP_PICKED_CLEAN of the first, give or take the
    // rounding of two numbers. Measured: 17-21% on hexes, 17-21% on a coast.
    expect(first, 'the first sack paid nothing, so there is no ratio').toBeGreaterThan(20);
    expect(second / first, `${first} then ${second}`).toBeGreaterThan(CAMP_PICKED_CLEAN * 0.8);
    expect(second / first, `${first} then ${second}`).toBeLessThan(CAMP_PICKED_CLEAN * 1.5);
    expect(state.saga.some((e) => e.text.includes('little left to take'))).toBe(true);
  });

  it('and a season later it is worth the walk again', () => {
    const state = settled('crop-grown');
    const n = state.neighbours[0]!;
    sackCamp(state, n.id);
    expect(campStores(state, n.sackedOn)).toBeLessThan(0.3);
    state.day += CAMP_REGROW;
    expect(campStores(state, n.sackedOn)).toBe(1);
  });

  it('a camp nobody has touched is full', () => {
    const state = settled('crop-virgin');
    expect(campStores(state, undefined)).toBe(1);
  });

  it('an old save reads as a coast nobody has robbed', () => {
    // `sackedOn` is absent in every save written before this, and the
    // kindest true thing to say about a history the file does not contain
    // is that it never happened — which is also what the old code did.
    const state = settled('crop-old');
    for (const n of state.neighbours) delete n.sackedOn;
    const rolled = migrate(JSON.parse(encode(state)) as Record<string, unknown>);
    expect(rolled.save.version).toBe(SAVE_VERSION);
    for (const n of (rolled.save as unknown as GameState).neighbours) {
      expect(campStores(state, n.sackedOn)).toBe(1);
    }
  });
});

describe('the plunder economy — winning a fight you picked pays', () => {
  /** Fall on `target`, break their line, and walk off the field. */
  function winFallOn(state: GameState, targetId: string): GameState {
    let next = apply(state, { type: 'FALL_ON', id: targetId });
    expect(next.battle, 'nobody drew steel').toBeTruthy();
    expect(next.battle!.campId).toBe(targetId);
    for (const c of next.battle!.combatants) {
      if (c.side === 'foe') { c.broken = true; c.nerve = 0; }
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('won');
    return apply(next, { type: 'B_LEAVE' });
  }

  it('a won camp pays the band in heart as well as in stores', () => {
    // The gap task 31 turned up. A sacked PLACE has always paid morale
    // (`loot.morale`); a sacked camp paid none, while a lost fight costs 15
    // plus bereavement and a sacking of your own steading costs 14 — so a
    // raider's heart could only ever go one way. Camps are the repeatable
    // circuit the whole idea of living by raiding rests on, and coming home
    // from one loaded has to be worth something.
    const state = settled('plunder-heart');
    const target = state.neighbours[0]!;
    target.might = 2;
    standBeside(state, target);
    // Well clear of the cap, or a win against 100 would read as no change.
    state.party.morale = 40;

    const after = winFallOn(state, target.id);
    expect(after.party.morale).toBeGreaterThan(40);
  });

  it('but a camp already picked clean is worth little heart', () => {
    // Scaled by how full it was, so a band cannot farm one camp for glory
    // any more than it can for stores.
    const full = settled('heart-full');
    const picked = settled('heart-picked');
    for (const s of [full, picked]) {
      standBeside(s, s.neighbours[0]!);
      s.party.morale = 40;
      s.neighbours[0]!.might = 2;
    }
    picked.neighbours[0]!.sackedOn = picked.day;

    const gotFull = winFallOn(full, full.neighbours[0]!.id).party.morale - 40;
    const gotPicked = winFallOn(picked, picked.neighbours[0]!.id).party.morale - 40;
    expect(gotPicked).toBeLessThan(gotFull);
  });

  it('a won camp is emptied: their stores come home and it is chronicled', () => {
    const state = settled('plunder-win');
    const target = state.neighbours[0]!;
    target.might = 2;
    standBeside(state, target);
    const before = state.party.food + state.party.firewood;

    const after = winFallOn(state, target.id);
    // Net of the fight's own loot and costs, the haul must be unmissable —
    // this is the bar the audit set: aggression was strictly worse than
    // bartering, and now it cannot be.
    expect(after.party.food + after.party.firewood).toBeGreaterThan(before + 15);
    expect(after.saga.some((e) => e.text.includes('took what a season had put there'))).toBe(true);
  });

  it('a lost fight pays nothing, and leaves their stores where they were', () => {
    const state = settled('plunder-loss');
    const target = state.neighbours[0]!;
    standBeside(state, target);
    const mightBefore = target.might;

    let next = apply(state, { type: 'FALL_ON', id: target.id });
    for (const c of next.battle!.combatants) {
      if (c.side === 'warband') c.down = true;
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('lost');
    next = apply(next, { type: 'B_LEAVE' });
    expect(next.saga.some((e) => e.text.includes('took what a season had put there'))).toBe(false);
    expect(next.neighbours.find((n) => n.id === target.id)!.might).toBe(mightBefore);
  });

  it('a sacked camp arms: the second visit is dearer than the first', () => {
    const state = settled('plunder-arms');
    const target = state.neighbours[0]!;
    target.might = 1;
    standBeside(state, target);
    const after = winFallOn(state, target.id);
    expect(after.neighbours.find((n) => n.id === target.id)!.might).toBe(2);
  });

  it('somebody can be carried home as a hand, and only if there is a bed', () => {
    // Odds are seeded per day and camp; sweep seeds until one lands. The
    // claim under test is that the thrall arrives as a HAND through takeIn —
    // room rules and all — not any particular roll.
    for (let s = 0; s < 30; s += 1) {
      const state = settled(`plunder-thrall-${s}`);
      state.settlement!.built.push('longhouse', 'bud');
      const target = state.neighbours[0]!;
      standBeside(state, target);
      const headsBefore = state.party.people.filter((p) => p.alive).length;
      const after = winFallOn(state, target.id);
      const heads = after.party.people.filter((p) => p.alive).length;
      if (heads > headsBefore) {
        const newest = after.party.people[after.party.people.length - 1]!;
        expect(newest.bond).toBe('hand');
        return;
      }
    }
    throw new Error('no seed carried a thrall home in 30 tries — the odds are not wired');
  });

  it('the stores are data with a floor under them', () => {
    // The audit's number: the old pay was 2 food a foe, ~15 a fight. Every
    // kind's stores must beat that before might scaling even starts.
    for (const kind of CLAN_KINDS) {
      expect(kind.plunder.food + kind.plunder.firewood, kind.id).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('reading the coast', () => {
  it('anger and goodwill read off the two ends of the coast', () => {
    const state = settled('nb-read');
    const [a, b] = state.neighbours;
    a!.standing = -60;
    b!.standing = 45;
    expect(angriest(state)!.id).toBe(a!.id);
    expect(friendliest(state)!.id).toBe(b!.id);
    expect(angerLevel(state)).toBe(60);
    expect(goodwillLevel(state)).toBe(45);
    expect(standingFor(-60).id).toBe('hostile');
    expect(standingFor(-20).id).toBe('cold');
    expect(standingFor(45).id).toBe('friendly');
  });

  it('placement is deterministic for a seed and different across seeds', () => {
    const place = (): GameState['neighbours'] =>
      placeNeighbours(stream('nb-det', 'worldgen').derive('neighbours'), 'nb-det');
    expect(place()).toEqual(place());
    expect(newGame('nb-det').neighbours).toEqual(newGame('nb-det').neighbours);
    expect(newGame('nb-det').neighbours).not.toEqual(newGame('nb-other').neighbours);
  });
});
