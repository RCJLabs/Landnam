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

import { describe, it, expect } from 'vitest';
import { distance, fromKey } from '../src/hex';
import { stream } from '../src/rng';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign } from '../src/sim/colony';
import { eventChance, isEligible } from '../src/sim/events';
import { raidDifficulty } from '../src/sim/raid';
import { startRaid } from '../src/sim/battleTurn';
import { EVENTS } from '../src/data/events';
import {
  BARTER_FOOD,
  CLAN_COUNT,
  CLAN_MIN_GAP,
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
  bargainBlocker,
  driftStandings,
  fallOn,
  friendliest,
  goodwillLevel,
  neighbourAt,
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
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const landing = state.world.landing;
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    if (distance(at, landing) > radius) continue;
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > bestScore) {
      bestScore = report.total;
      best = at;
    }
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
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
    state.party.at = { ...n.at };
    expect(fallOn(state, n.id)).not.toBeNull();
  }
  state.party.at = { ...state.settlement!.at };
}

/** Deals honestly with every neighbour, the same number of times. */
function makeFriends(state: GameState, rounds = 4): void {
  for (const n of state.neighbours) {
    state.party.at = { ...n.at };
    for (let i = 0; i < rounds; i++) {
      state.party.food = 200;
      expect(bargain(state, n.id)).not.toBeNull();
    }
  }
  state.party.at = { ...state.settlement!.at };
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
        const tile = state.world.tiles[`${n.at.q},${n.at.r}`];
        expect(tile, `${seed}: ${n.name} is nowhere`).toBeTruthy();
        expect(['ocean', 'mountains'], `${seed}: ${n.name}`).not.toContain(tile!.terrain);
        expect(distance(n.at, state.world.landing), `${seed}: ${n.name} on the beach`)
          .toBeGreaterThanOrEqual(CLAN_MIN_GAP);
        expect(n.found).toBeFalsy();
      }
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

  it('a place is only on the map once somebody has seen it', () => {
    const state = structuredClone(newGame('nb-sight'));
    expect(state.neighbours.every((n) => !n.found)).toBe(true);
    const target = state.neighbours[0]!;
    seeNeighbours(state);
    expect(target.found, 'seen without looking').toBeFalsy();

    state.world.seen[`${target.at.q},${target.at.r}`] = 'seen';
    seeNeighbours(state);
    expect(target.found).toBe(true);
    expect(state.saga.some((e) => e.text.includes(target.name))).toBe(true);
  });
});

describe('standing is a memory', () => {
  it('falling on somebody costs exactly what it says, and it sticks', () => {
    const state = settled('nb-stick');
    const target = state.neighbours[0]!;
    const before = target.standing;

    state.party.at = { ...target.at };
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
    state.party.at = { ...target.at };
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
    state.party.at = { ...target.at };

    target.standing = TRADE_FLOOR;
    expect(bargainBlocker(state, target.id)).toBeNull();
    target.standing = TRADE_FLOOR - 1;
    expect(bargainBlocker(state, target.id)).toBe('standing');
    expect(bargain(state, target.id)).toBeNull();

    target.standing = 20;
    state.party.food = BARTER_FOOD - 1;
    expect(bargainBlocker(state, target.id)).toBe('stores');

    state.party.food = 90;
    state.party.at = { ...state.settlement!.at };
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
        state.party.at = { ...target.at };
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
    state.party.at = { ...target.at };

    const next = apply(state, { type: 'FALL_ON', id: target.id });
    expect(next).not.toBe(state);
    expect(next.battle, 'nobody drew steel').toBeTruthy();
    expect(next.battle!.raid).toBeFalsy();
    expect(neighbourAt(next, target.at)!.standing).toBe(before + REP_RAIDED);
    expect(next.saga.some((e) => e.text.includes(target.name))).toBe(true);
  });

  it('you cannot fall on somebody you are not standing in front of', () => {
    const state = settled('nb-reach');
    const target = state.neighbours[0]!;
    state.party.at = { ...state.settlement!.at };
    expect(apply(state, { type: 'FALL_ON', id: target.id })).toBe(state);
    expect(apply(state, { type: 'FALL_ON', id: 'nb_nobody' })).toBe(state);
    expect(target.standing).toBe(state.neighbours[0]!.standing);
  });

  it('bartering through the action path costs a day', () => {
    const state = settled('nb-day');
    const target = state.neighbours[0]!;
    target.standing = 30;
    state.party.at = { ...target.at };
    const day = state.day;

    const next = apply(state, { type: 'BARTER', id: target.id });
    expect(next).not.toBe(state);
    expect(next.day).toBe(day + 1);
    expect(next.party.food).toBeLessThan(state.party.food);
    expect(next.party.firewood).toBeGreaterThan(state.party.firewood);
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
    const world = newGame('nb-det').world;
    const place = (): GameState['neighbours'] =>
      placeNeighbours(world, stream('nb-det', 'worldgen').derive('neighbours'));
    expect(place()).toEqual(place());
    expect(newGame('nb-det').neighbours).toEqual(newGame('nb-det').neighbours);
    expect(newGame('nb-det').neighbours).not.toEqual(newGame('nb-other').neighbours);
  });
});
