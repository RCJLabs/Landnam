// Places: the audit's first item. The map gains destinations — a monastery
// rich and soft, a town rich and hard, a wreck, an iron seam — and "go out
// under arms" finally has somewhere to go. The bars here: the data is sane,
// the seeding is deterministic and respects the ground, taking a place pays
// and provokes, a lost fight leaves it standing, and an old save gains
// exactly the places its seed would have been born with.

import { describe, it, expect } from 'vitest';
import { distance, key } from '../src/hex';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { stream } from '../src/rng';
import { apply } from '../src/sim/actions';
import {
  offersAt,
  placeById,
  placeHere,
  sackBlocker,
  seedPlaces,
  settlePlace,
  spotLandmarks,
  tellOfPlace,
  tradeAt,
  tradeBlocker,
  TRADE_REASON,
  LANDMARK_SIGHT,
} from '../src/sim/places';
import { range } from '../src/hex';
import { sightRadius } from '../src/sim/fog';
import { effectsOn } from '../src/sim/calendar';
import { PLACE_KINDS, PLACE_MAX_FROM_LANDING, placeKind } from '../src/data/places';
import { knows } from '../src/sim/lore';
import { startBattle } from '../src/sim/battleTurn';
import type { GameState, Place } from '../src/state/types';

describe('content lint: places', () => {
  it('ids are unique, and every kind says what it is and what taking it says', () => {
    const ids = PLACE_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of PLACE_KINDS) {
      expect(kind.name.length, kind.id).toBeGreaterThan(5);
      expect(kind.blurb.length, kind.id).toBeGreaterThan(20);
      expect(kind.deed.length, kind.id).toBeGreaterThan(3);
      expect(kind.sackLine.length, kind.id).toBeGreaterThan(20);
      expect(kind.ground.length, kind.id).toBeGreaterThan(0);
      expect(kind.minFromLanding, kind.id).toBeGreaterThan(0);
    }
  });

  it('prices the guarded ones above the free ones, and makes guards mean infamy', () => {
    for (const kind of PLACE_KINDS) {
      const worth = kind.loot.food + kind.loot.firewood;
      if (kind.garrison !== null) {
        // A fight must pay better than salvage, and a fight is REMEMBERED.
        expect(worth, kind.id).toBeGreaterThanOrEqual(15);
        expect(kind.infamy, kind.id).toBeLessThan(0);
        expect(kind.garrison, kind.id).toBeGreaterThanOrEqual(0);
        expect(kind.garrison, kind.id).toBeLessThanOrEqual(6);
      } else {
        expect(kind.infamy, kind.id).toBe(0);
      }
      if (kind.teaches) {
        expect(kind.teaches.odds).toBeGreaterThan(0);
        expect(kind.teaches.odds).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the town out-pays the monastery, because its watch is paid to be awake', () => {
    const monastery = placeKind('monastery');
    const town = placeKind('town');
    expect(town.garrison!).toBeGreaterThan(monastery.garrison!);
    expect(town.loot.food + town.loot.firewood).toBeGreaterThan(
      monastery.loot.food + monastery.loot.firewood,
    );
    expect(town.infamy).toBeLessThan(monastery.infamy);
  });
});

describe('seeding the country', () => {
  it('is deterministic, stands on its own ground, and keeps its distance', () => {
    for (let s = 0; s < 12; s += 1) {
      const state = newGame(`place-seed-${s}`);
      const again = newGame(`place-seed-${s}`);
      expect(again.world.places).toEqual(state.world.places);

      for (const place of state.world.places) {
        const def = placeKind(place.kind);
        const ground = state.world.tiles[key(place.at)]!.terrain;
        expect(def.ground, `${place.id} on ${ground}`).toContain(ground);
        expect(distance(place.at, state.world.landing)).toBeGreaterThanOrEqual(def.minFromLanding);
      }
      // At most one of each kind, and no two in each other's laps.
      const kinds = state.world.places.map((p) => p.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  /**
   * THE BAR THE COUNTRY DID NOT HAVE — the same one the coast was missing,
   * found the same way and one audit later.
   *
   * Every kind had a floor on how near the landing it could be seeded and no
   * ceiling at all, so across forty worlds the fixed places sat a MEDIAN of
   * 30 hexes from the sand and as far as 52, on a map a band sees 2-7% of.
   * Measured in play: 4.00 places still standing per settled day and 0.06 of
   * them ever SEEN. The monastery, the town, the wreck and the seam are the
   * whole plunder economy and the only reason a settled band has to leave
   * home — and they were put where nobody would ever look.
   */
  it('they stand on this coast, and a coast is something you can walk', () => {
    for (let s = 0; s < 24; s += 1) {
      const state = newGame(`place-reach-${s}`);
      for (const place of state.world.places) {
        const d = distance(place.at, state.world.landing);
        expect(d, `${place.id} is ${d} hexes off — a voyage, not a country`)
          .toBeLessThanOrEqual(PLACE_MAX_FROM_LANDING);
      }
    }
  });

  it('most coasts get most places — a map with nothing on it defeats the point', () => {
    let total = 0;
    for (let s = 0; s < 12; s += 1) total += newGame(`place-count-${s}`).world.places.length;
    expect(total / 12).toBeGreaterThanOrEqual(3);
  });
});

/** Stands the band on a specific place, healthy and provisioned. */
function standingOn(seed: string, kind: Place['kind']): GameState | null {
  for (let s = 0; s < 30; s += 1) {
    const state = structuredClone(newGame(`${seed}-${s}`));
    const place = state.world.places.find((p) => p.kind === kind);
    if (!place) continue;
    state.party.at = { ...place.at };
    state.world.seen[key(place.at)] = 'visible';
    return state;
  }
  return null;
}

describe('taking a place', () => {
  it('an unguarded wreck is a day of work: loot, a mark on the map, a line in the saga', () => {
    const state = standingOn('wreck-take', 'wreck')!;
    expect(state).toBeTruthy();
    const place = placeHere(state)!;
    const before = { food: state.party.food, wood: state.party.firewood, day: state.day };

    const next = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(next).not.toBe(state);
    // The day still passes and the fire still burns, so the check is net:
    // the wood gained clearly outweighs a night's burn.
    expect(next.party.firewood).toBeGreaterThan(before.wood + 4);
    expect(placeById(next, place.id)!.sackedOn).toBe(before.day);
    expect(next.day).toBe(before.day + 1);
    expect(next.saga.some((l) => l.text.includes('wreck') || l.text.includes('timber'))).toBe(true);
  });

  it('a monastery is a fight first, and pays only if the field is won', () => {
    const state = standingOn('abbey-take', 'monastery')!;
    expect(state).toBeTruthy();
    const place = placeHere(state)!;
    const foodBefore = state.party.food;

    let next = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(next.battle).toBeTruthy();
    expect(next.battle!.placeId).toBe(place.id);
    expect(placeById(next, place.id)!.sackedOn).toBeUndefined();

    // Break the defenders and take the field.
    for (const c of next.battle!.combatants) {
      if (c.side === 'foe') { c.broken = true; c.nerve = 0; }
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('won');
    next = apply(next, { type: 'B_LEAVE' });

    expect(placeById(next, place.id)!.sackedOn).toBeDefined();
    expect(next.party.food).toBeGreaterThan(foodBefore);
  });

  it('a lost fight leaves the place standing, to come back for', () => {
    const state = standingOn('abbey-lost', 'monastery')!;
    const place = placeHere(state)!;
    let next = apply(state, { type: 'SACK_PLACE', id: place.id });
    for (const c of next.battle!.combatants) {
      if (c.side === 'warband') { c.down = true; }
    }
    next = apply(next, { type: 'B_END_TURN' });
    expect(next.battle!.outcome).toBe('lost');
    next = apply(next, { type: 'B_LEAVE' });
    expect(placeById(next, place.id)!.sackedOn).toBeUndefined();
    expect(sackBlocker(next, place.id)).toBe(null);
  });

  it('word starts where the smoke is seen: the nearest neighbour thinks less of you', () => {
    const state = standingOn('abbey-word', 'monastery')!;
    const place = placeHere(state)!;
    const nearest = [...state.neighbours].sort(
      (a, b) => distance(a.at, place.at) - distance(b.at, place.at),
    )[0]!;
    const before = nearest.standing;
    settlePlace(state, place.id);
    expect(state.neighbours.find((n) => n.id === nearest.id)!.standing).toBeLessThan(before);
  });

  it('a place is taken once — the second visit finds it picked clean', () => {
    const state = standingOn('wreck-twice', 'wreck')!;
    const place = placeHere(state)!;
    const once = apply(state, { type: 'SACK_PLACE', id: place.id });
    expect(sackBlocker(once, place.id)).toBe('taken');
    const twice = apply(once, { type: 'SACK_PLACE', id: place.id });
    expect(twice).toBe(once);
  });

  it('cannot be taken from a hex away', () => {
    const state = standingOn('wreck-away', 'wreck')!;
    const place = placeHere(state)!;
    state.party.at = { q: place.at.q + 2, r: place.at.r };
    expect(sackBlocker(state, place.id)).toBe('away');
    expect(apply(state, { type: 'SACK_PLACE', id: place.id })).toBe(state);
  });

  it('an iron seam can teach the band smithing, and never re-teaches it', () => {
    // The odds are seeded; find a seed where the lesson lands.
    for (let s = 0; s < 40; s += 1) {
      const state = standingOn(`seam-${s}`, 'oreseam');
      if (!state) continue;
      const place = placeHere(state)!;
      settlePlace(state, place.id);
      if (knows(state, 'smithing')) return; // the lesson can land: enough
    }
    throw new Error('no seed taught smithing in 40 tries — the odds are not wired');
  });
});

describe('a place you can deal with', () => {
  /**
   * The gap a player found on a phone: a TRADING TOWN — jetties,
   * warehouses, a watch that is paid to be awake — whose Act panel offered
   * "Fall on the town" and nothing else. Every fixed place was a thing to
   * be robbed, including the two that are described as being full of people
   * who would rather sell you something.
   */
  function standingOnKind(kind: string): GameState {
    for (let s = 0; s < 40; s += 1) {
      const state = structuredClone(newGame(`market-${s}`));
      const place = state.world.places.find((p) => p.kind === kind);
      if (!place) continue;
      state.party.at = { ...place.at };
      state.world.seen[key(place.at)] = 'visible';
      state.party.food = 200;
      state.party.firewood = 200;
      return state;
    }
    throw new Error(`no ${kind} on any coast`);
  }

  it('the town keeps a market, and it deals both ways', () => {
    const state = standingOnKind('town');
    const offers = offersAt(state, state.world.places.find((p) => p.kind === 'town')!.id);
    expect(offers.length).toBeGreaterThan(1);
    expect(new Set(offers.map((o) => o.give))).toEqual(new Set(['food', 'firewood']));
  });

  it('carries goods in and out', () => {
    // The exchange itself, read before the day turns: `apply` also runs a
    // day of upkeep, and a band that has just eaten is not evidence about
    // what the counter paid.
    const state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id).find((o) => o.give === 'food')!;
    const before = { food: state.party.food, wood: state.party.firewood };

    const deal = tradeAt(state, town.id, offer.id);
    expect(deal).not.toBeNull();
    expect(state.party.food).toBe(before.food - offer.cost);
    expect(state.party.firewood).toBe(before.wood + deal!.got);
    expect(deal!.got).toBeGreaterThan(0);
  });

  it('costs the day, and leaves the place standing', () => {
    const state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id)[0]!;
    const day = state.day;

    const next = apply(state, { type: 'TRADE_AT', id: town.id, offer: offer.id });
    expect(next).not.toBe(state);
    expect(next.day).toBe(day + 1);
    expect(next.world.places.find((p) => p.id === town.id)!.sackedOn).toBeUndefined();
    expect(next.saga.some((e) => e.text.includes('jetties'))).toBe(true);
  });

  it('deals again tomorrow — a market is not a thing you use up', () => {
    let state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id)[0]!;
    for (let i = 0; i < 3; i += 1) {
      const next = apply(state, { type: 'TRADE_AT', id: town.id, offer: offer.id });
      expect(next, `refused on deal ${i + 1}`).not.toBe(state);
      state = next;
    }
  });

  it('but steel ends it — there is nobody left to deal with', () => {
    const state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id)[0]!;
    settlePlace(state, town.id, false);
    expect(tradeBlocker(state, town.id, offer.id)).toBe('taken');
    expect(offersAt(state, town.id)).toEqual([]);
    expect(apply(state, { type: 'TRADE_AT', id: town.id, offer: offer.id })).toBe(state);
  });

  it('refuses what the band cannot carry in, and says so', () => {
    const state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id).find((o) => o.give === 'food')!;
    state.party.food = offer.cost - 1;
    expect(tradeBlocker(state, town.id, offer.id)).toBe('stores');
    expect(TRADE_REASON.stores.length).toBeGreaterThan(10);
  });

  it('never from the next hex over', () => {
    const state = standingOnKind('town');
    const town = state.world.places.find((p) => p.kind === 'town')!;
    const offer = offersAt(state, town.id)[0]!;
    state.party.at = { q: town.at.q + 3, r: town.at.r };
    expect(tradeBlocker(state, town.id, offer.id)).toBe('away');
  });

  it('the house sells bread, which is the point of it', () => {
    const state = standingOnKind('monastery');
    const house = state.world.places.find((p) => p.kind === 'monastery')!;
    const offer = offersAt(state, house.id)[0]!;
    expect(offer.give).toBe('firewood');
    expect(offer.take).toBe('food');
    const before = state.party.food;
    const next = apply(state, { type: 'TRADE_AT', id: house.id, offer: offer.id });
    expect(next.party.food).toBeGreaterThan(before);
  });

  /**
   * THE LINT THAT MATTERS. A place that buys and sells the same goods across
   * one counter must lose on the spread, or two deeds standing still make
   * timber out of nothing and the whole economy is a rounding error.
   *
   * Only the SAME-PLACE cycle is barred. Camp-to-town loops can look
   * nominally profitable and are not worth policing: the legs are hexes
   * apart, and a band walking between them eats more in provisions than any
   * spread returns.
   */
  it('no counter pays for standing at it', () => {
    for (const kind of PLACE_KINDS) {
      const market = kind.market ?? [];
      for (const out of market) {
        for (const back of market) {
          if (out.take !== back.give || back.take !== out.give) continue;
          expect(
            out.rate * back.rate,
            `${kind.id}: ${out.id} then ${back.id} makes something from nothing`,
          ).toBeLessThan(1);
        }
      }
    }
  });

  it('every offer is spendable and readable', () => {
    for (const kind of PLACE_KINDS) {
      for (const offer of kind.market ?? []) {
        expect(offer.cost, `${kind.id}/${offer.id}`).toBeGreaterThan(0);
        expect(offer.rate, `${kind.id}/${offer.id}`).toBeGreaterThan(0);
        expect(offer.give, `${kind.id}/${offer.id}`).not.toBe(offer.take);
        expect(offer.deed.length, `${kind.id}/${offer.id}`).toBeGreaterThan(5);
        expect(offer.blurb.length, `${kind.id}/${offer.id}`).toBeGreaterThan(20);
        expect(offer.line.length, `${kind.id}/${offer.id}`).toBeGreaterThan(20);
      }
    }
    // And the one the report was about: the town must have a counter.
    expect((PLACE_KINDS.find((k) => k.id === 'town')?.market ?? []).length).toBeGreaterThan(0);
  });
});

describe('word of the country travels', () => {
  /**
   * A ceiling puts the places within reach; this is how a band LEARNS of
   * them. Clans could be made to come and look at a new steading — a
   * monastery cannot walk over. But people who deal with you talk, so a
   * bargain pays twice: timber, and knowing what is on this coast.
   */
  function coast(seed: string): GameState {
    const state = structuredClone(newGame(seed));
    for (const k of Object.keys(state.world.seen)) delete state.world.seen[k];
    return state;
  }

  it('a trader names the nearest thing they could plausibly know of', () => {
    const state = coast('told-near');
    expect(state.world.places.length).toBeGreaterThan(1);
    const from = state.world.places[0]!.at;

    const told = tellOfPlace(state, from, 'Sealwatch');
    expect(told, 'nobody said anything at all').toBeDefined();
    // Nearest first: nothing unseen is closer to the teller than what they named.
    for (const p of state.world.places) {
      if (p.id === told!.id || state.world.seen[key(p.at)] !== undefined) continue;
      expect(distance(p.at, from)).toBeGreaterThanOrEqual(distance(told!.at, from));
    }
    // Named means findable. A marker under fog is not knowledge — that was
    // exactly how the coast stayed unreachable.
    expect(state.world.seen[key(told!.at)]).toBeTruthy();
    expect(state.saga.some((e) => e.text.includes('Sealwatch'))).toBe(true);
  });

  it('one a bargain, and never the same place twice', () => {
    const state = coast('told-once');
    const from = state.world.places[0]!.at;
    const named: string[] = [];
    for (let i = 0; i < state.world.places.length + 2; i += 1) {
      const told = tellOfPlace(state, from, 'Threefires');
      if (told) named.push(told.id);
    }
    expect(new Set(named).size, 'the same place named twice').toBe(named.length);
    expect(named.length).toBeLessThanOrEqual(state.world.places.length);
    expect(tellOfPlace(state, from, 'Threefires'), 'still talking with nothing left to say')
      .toBeUndefined();
  });

  it('says nothing about ground the band has already stood on', () => {
    const state = coast('told-known');
    for (const p of state.world.places) state.world.seen[key(p.at)] = 'seen';
    expect(tellOfPlace(state, state.world.places[0]!.at, 'Grimsgarth')).toBeUndefined();
  });

  it('and a real bargain is what triggers it', () => {
    // The unit above proves the telling; this proves it is WIRED — the
    // half that the kin line and the watch-mark cap both got wrong.
    const state = structuredClone(newGame('told-wired'));
    for (const k of Object.keys(state.world.seen)) delete state.world.seen[k];
    const host = state.neighbours[0]!;
    state.party.at = { ...host.at };
    state.party.food = 200;
    const before = state.world.places.filter((p) => state.world.seen[key(p.at)] !== undefined).length;
    const next = apply(state, { type: 'BARTER', id: host.id });
    expect(next).not.toBe(state);
    const after = next.world.places.filter((p) => next.world.seen[key(p.at)] !== undefined).length;
    expect(after, 'a bargain taught the band nothing about the coast').toBeGreaterThan(before);
  });
});

describe('a landmark picked out from the high ground', () => {
  /**
   * The second road into the place economy. Word of mouth is gated behind a
   * bargain and bargains happen once or twice a saga, which measured as a
   * hard ceiling nothing about the TELLING could lift — see TOLD_AT_ONCE.
   * A ridge is the channel that is not a bargain, and it is the only one a
   * band that never trades can use.
   */
  function ridge(seed: string, ground: 'hills' | 'meadow'): {
    state: GameState; place: Place; at: { q: number; r: number };
  } {
    const state = structuredClone(newGame(seed));
    for (const k of Object.keys(state.world.seen)) delete state.world.seen[k];
    const place = state.world.places[0]!;
    // Stand a few hexes off the place, on ground we choose, with clear
    // country in between so line of sight is not what is under test.
    const at = { q: place.at.q + 4, r: place.at.r };
    state.party.at = at;
    for (const h of range(at, LANDMARK_SIGHT + 2)) {
      const tile = state.world.tiles[key(h)];
      if (tile) tile.terrain = 'meadow';
    }
    state.world.tiles[key(at)]!.terrain = ground;
    return { state, place, at };
  }

  it('marks a place known from a ridge, and says so', () => {
    const { state, place } = ridge('spot-yes', 'hills');
    const before = state.saga.length;
    const spotted = spotLandmarks(state);
    expect(spotted.map((p) => p.id)).toContain(place.id);
    expect(state.world.seen[key(place.at)]).toBeDefined();
    expect(state.saga.slice(before).some((l) => /high ground/.test(l.text))).toBe(true);
  });

  it('sees nothing at all from flat ground, however close', () => {
    const { state, place } = ridge('spot-flat', 'meadow');
    expect(spotLandmarks(state)).toEqual([]);
    expect(state.world.seen[key(place.at)]).toBeUndefined();
  });

  it('reaches further than the eye reaches over open country', () => {
    // The whole justification for the constant: a landmark is a thing you
    // pick out past the distance you could make out the ground itself.
    const { state, at } = ridge('spot-further', 'hills');
    expect(LANDMARK_SIGHT).toBeGreaterThan(
      sightRadius(state.world, at, effectsOn(state.day).sight),
    );
  });

  it('stops at the edge of what can be picked out', () => {
    const { state, place } = ridge('spot-far', 'hills');
    state.party.at = { q: place.at.q + LANDMARK_SIGHT + 1, r: place.at.r };
    state.world.tiles[key(state.party.at)]!.terrain = 'hills';
    // This place specifically, not "nothing at all" — stepping back can walk
    // a DIFFERENT place into range, which is the mechanism working rather
    // than failing. The first cut of this asserted the empty list and caught
    // the town four hexes the other way.
    expect(spotLandmarks(state).map((p) => p.id)).not.toContain(place.id);
    expect(state.world.seen[key(place.at)]).toBeUndefined();
  });

  it('a mountain in the way hides what is behind it', () => {
    const { state, place, at } = ridge('spot-blocked', 'hills');
    // Only mountains block the view from high ground — that is the existing
    // rule in fog.ts, and this pins that the landmark obeys it.
    const between = { q: place.at.q + 2, r: place.at.r };
    state.world.tiles[key(between)]!.terrain = 'mountains';
    void at;
    expect(spotLandmarks(state).map((p) => p.id)).not.toContain(place.id);
  });

  it('tells you a place is THERE and nothing about what is in it', () => {
    const { state, place } = ridge('spot-blind', 'hills');
    spotLandmarks(state);
    // Sight is not a sacking and not a bargain: the place is untouched.
    const after = state.world.places.find((p) => p.id === place.id)!;
    expect(after.sackedOn).toBeUndefined();
    expect(state.party.food).toBe(structuredClone(newGame('spot-blind')).party.food);
  });

  it('says it once — a place already known is not re-spotted', () => {
    const { state } = ridge('spot-once', 'hills');
    expect(spotLandmarks(state).length).toBeGreaterThan(0);
    const before = state.saga.length;
    expect(spotLandmarks(state)).toEqual([]);
    expect(state.saga.length).toBe(before);
  });

  it('happens through ordinary travel, not only when called directly', () => {
    // The same-commit rule: a capability the player cannot reach by playing
    // is measured as worthless. Walking onto a ridge has to do it.
    const { state, place, at } = ridge('spot-played', 'hills');
    state.party.at = { q: at.q + 1, r: at.r };
    state.world.tiles[key(state.party.at)]!.terrain = 'meadow';
    const next = apply(state, { type: 'MOVE', to: at });
    expect(next).not.toBe(state);
    expect(next.world.seen[key(place.at)]).toBeDefined();
  });
});

describe('the fight carries the stake', () => {
  it('startBattle stamps the placeId before any turn plays', () => {
    const state = standingOn('stamp', 'monastery')!;
    startBattle(state, 'shore', 1, { placeId: placeHere(state)!.id });
    expect(state.battle!.placeId).toBe(placeHere(state)!.id);
  });
});

describe('old saves gain the country they always had', () => {
  it('migrates a pre-place save to exactly the places its seed was born with', () => {
    const fresh = newGame('migrate-places');
    const old = structuredClone(fresh) as unknown as Record<string, unknown>;
    old['version'] = 17;
    delete (old['world'] as { places?: unknown }).places;

    const migrated = migrate(old).save;
    const world = migrated['world'] as { places: Place[] };
    expect(world.places).toEqual(fresh.world.places);
    // The CURRENT version, whatever it is by now — this assertion broke
    // twice pinned to a literal, and the claim was never about the number.
    expect(migrated['version']).toBe(SAVE_VERSION);
  });

  it('reseeding the same world twice gives the same places', () => {
    const state = newGame('reseed');
    const again = seedPlaces(state.world, stream('reseed', 'worldgen').derive('places'));
    expect(again).toEqual(state.world.places);
  });
});
