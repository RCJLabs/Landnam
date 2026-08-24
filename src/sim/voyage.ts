// The knarr away over the open sea.
//
// The ship could row a coast, fight on the water, carry a strandhögg home and
// spring a strake on rock — and every one of those happened inside the same
// eighteen hundred hexes. There was nowhere to go that was not on the map, so
// the one thing a knarr was actually FOR in the ninth century, crossing open
// water to somewhere else and coming back with what was there, could not
// happen.
//
// A voyage home is not an expedition. An expedition walks the map and can be
// seen and recalled; this leaves the map entirely. The crew are gone, and
// what it costs is their hands for the part of the year that needs them —
// which is the whole decision, because the payoff comes back in the spring
// and the winter does not care that you are expecting it.

import { stream } from '../rng';
import { hold, sprung, springStrake, unseaworthy } from './ship';
import { living } from './people';
import { takeIn } from './joining';
import { atHome } from './site';
import { SEASON_LENGTH } from './calendar';
import { firewoodPerNight, foodPerDay } from './upkeep';
import { chronicle } from './saga';
import type { GameState, Person } from '../state/types';

/**
 * Days over and back, before the sea has its say.
 *
 * Left at seventy-eight after two seasons was tried and measured WORSE — 3
 * of 40 bands standing at day 400 against 4, and 108 souls against 124. The
 * reasoning for shortening it was sound and its premise was wrong: the
 * voyage's problem looked like a payback period, so bringing the hands home
 * sooner should have helped. It did the opposite, because what comes home is
 * not only hands. It is MOUTHS, arriving sooner in a hall whose binding
 * constraint was never labour.
 */
export const CROSSING = 78;

/** Food a head takes for the crossing. */
export const STORES_PER_HEAD = 4;

/** Nobody may sail with fewer than this left at the hall. */
export const MIN_ASHORE = 2;

/** The fewest who can work a knarr across open water. */
export const MIN_ABOARD = 2;

/** Odds the sea takes a strake out of her on the way. */
export const CROSSING_ROUGH = 0.35;

/**
 * What each person who crosses to take land brings with them: one season's
 * eating for one adult.
 *
 * Derived rather than picked. `foodPerDay` feeds an adult on half a share a
 * day, so a season of twenty-four days is twelve — and the point of the
 * number is that a new arrival is not a mouth the hall has to find room for
 * on the day they land. They pay their own way until the next harvest, which
 * is what a person crossing an ocean to settle actually did.
 */
export const SETTLER_STORES = SEASON_LENGTH / 2;

export type SailBlock =
  | 'nosteading' | 'away' | 'already' | 'out' | 'hull' | 'nobody' | 'unmanned'
  | 'shorthanded' | 'hungry' | 'cold';

export const SAIL_REASON: Record<SailBlock, string> = {
  nosteading: 'There is nowhere to come back to yet.',
  away: 'She would have to be launched from the steading.',
  already: 'She is already out over the water.',
  out: 'A party is out on the road. They come home first.',
  hull: 'She will not cross open water in this state.',
  nobody: 'Somebody has to work her.',
  unmanned: 'Somebody has to stay and keep the fire.',
  shorthanded: 'Two at the least, or she does not answer the steering-oar.',
  hungry: 'Not enough in the store to see the hall through a season without them.',
  cold: 'Not enough wood banked. The fire has to last while they are gone.',
};

/**
 * What the hall must have banked before she may sail, and the reason this
 * rule exists at all.
 *
 * The voyage was measured as a TRAP before this: told to take every crossing
 * she could, a band went from 5 of 40 standing at day 400 to 3, and lived a
 * fifth fewer days. The thing that makes it a trap is not the crossing, it is
 * WHAT SHE BRINGS BACK LANDING IN A HALL THAT CANNOT FEED IT. Measured
 * separately: three extra pairs of hands dropped on a going concern take a
 * band from 6 of 40 standing to 7 and add nine per cent to the days it lives
 * — but they eat the surplus down from 2934 to 667. Six pairs take it to 4 of
 * 40, worse than none at all.
 *
 * So people are worth having exactly as far as they can be fed, and a voyage
 * launched out of a lean store is a voyage that fetches mouths. Requiring the
 * store FIRST is what turns it from a thing you stumble into and regret into
 * a thing you spend a year preparing: bank a surplus through the good
 * seasons, then convert it into people.
 *
 * A SEASON of each, and the first cut of this asked for a whole crossing's
 * food — `foodPerDay * CROSSING`, about 312. Measured against what a hall
 * actually holds on a day it could sail, that is absurd: the median is 13,
 * and the ninetieth percentile is 43. The rule opened for nobody, ever, in
 * forty sagas. What it had confused is who eats. A crew at sea takes its
 * provisions with it and comes off the ration — `foodPerDay` says so — so the
 * hall is not feeding them while they are gone. What the voyage costs is
 * their LABOUR, and what the store has to cover is the gap that labour
 * leaves, which is a season's worth and not a year's.
 *
 * The same measurement showed the wood is never the binding half — a hall
 * holds a median 141 against the 48 this asks — and it is kept anyway,
 * because the one that never binds on a well-run steading is exactly the one
 * that bites the band that has been cutting nothing.
 */
export function provisioning(state: GameState): { food: number; firewood: number } {
  return {
    food: Math.ceil(foodPerDay(state) * SEASON_LENGTH),
    firewood: Math.ceil(firewoodPerNight(state) * SEASON_LENGTH),
  };
}

/**
 * Why she cannot sail, or null when she can.
 *
 * A blocker rather than a boolean, for the reason `launchBlocker` gives: each
 * one is a thing the player did or did not do, and a refusal that cannot say
 * which is a refusal nobody can act on.
 */
export function sailBlocker(state: GameState, members: string[]): SailBlock | null {
  if (!state.settlement) return 'nosteading';
  if (state.voyage) return 'already';
  if (state.expedition) return 'out';
  if (!atHome(state)) return 'away';
  // A hull with nothing sound left will not be rowed across a bay, let alone
  // an ocean. One sprung strake is a risk the player may take.
  if (unseaworthy(state.ship)) return 'hull';
  const crew = living(state.party.people);
  const going = crew.filter((p) => members.includes(p.id));
  if (going.length === 0) return 'nobody';
  if (going.length < MIN_ABOARD) return 'shorthanded';
  if (crew.length - going.length < MIN_ASHORE) return 'unmanned';
  // Provisioned, and asked LAST so the reason a player is given is the one
  // they can act on: a hall short of wood should be told about the wood, not
  // about the steering-oar.
  const need = provisioning(state);
  if (state.party.food < need.food) return 'hungry';
  if (state.party.firewood < need.firewood) return 'cold';
  return null;
}

export function canSail(state: GameState, members: string[]): boolean {
  return sailBlocker(state, members) === null;
}

/** Everyone aboard her right now. */
export function aboard(state: GameState): Person[] {
  const away = state.voyage?.members ?? [];
  return living(state.party.people).filter((p) => away.includes(p.id));
}

/** True of somebody who is over the sea and cannot be counted on for anything. */
export function atSeaAway(state: GameState, person: Person): boolean {
  return (state.voyage?.members ?? []).includes(person.id);
}

/** Mutates: she goes. */
export function sailForHome(state: GameState, members: string[]): boolean {
  if (!canSail(state, members)) return false;
  const going = living(state.party.people).filter((p) => members.includes(p.id));
  // What the store can spare, capped by what she holds — the same rule the
  // expedition uses, and the same reason: an empty store must not lock the
  // only door out.
  const carried = Math.min(
    going.length * STORES_PER_HEAD,
    hold(state.ship),
    Math.max(0, state.party.food),
  );
  state.party.food -= carried;
  // A sprung strake is a longer crossing, not merely a wetter one.
  const due = state.day + CROSSING + sprung(state.ship) * 12;
  state.voyage = { members: going.map((p) => p.id), leftOn: state.day, due, carried };
  chronicle(
    state,
    `${going.length} of us took the knarr out past the headland and turned her east, `
      + 'for the country we came from. They will not be back before the year turns.',
    'saga',
  );
  return true;
}

/** Days until the keel is expected back, or 0 when she is home. */
export function daysOut(state: GameState): number {
  return state.voyage ? Math.max(0, state.voyage.due - state.day) : 0;
}

/**
 * One day of her being away, and the day she comes back. Called from the tick.
 *
 * What she brings is the whole point and it is deliberately NOT gold: she
 * brings PEOPLE — the thing a marginal colony actually needs and the thing
 * the period actually did — and the stores to keep them through their first
 * winter, capped by what she holds.
 */
export function voyageDay(state: GameState): boolean {
  const voyage = state.voyage;
  if (!voyage || state.end) return false;
  if (state.day < voyage.due) return false;

  const rng = stream(state.seed, 'events').derive(`voyage:${voyage.leftOn}`);
  const rough = rng.chance(CROSSING_ROUGH);
  if (rough) springStrake(state.ship);

  // What the hold brings back, and who. The knarr's own capacity decides how
  // many, NOT the hall's: people fetched from across an ocean have nowhere
  // else to walk to, so they come in whether there is a bed or not.
  //
  // Measured first, which is why it works this way: gated on `roomLeft` a
  // voyage brought back NOBODY in the ordinary case — a fresh steading holds
  // exactly the six already in it — so the whole thing was 156 hand-days for
  // nine food. A trap, not a decision. Over the roof it is a real choice with
  // a real cost, because crowding is what makes a hall sick.
  const berths = Math.max(0, Math.floor(hold(state.ship) / 8));
  const brought = berths > 0 ? takeIn(state, berths, 'came back on the knarr', true) : [];
  // WHAT THEY BRING WITH THEM, and this is the line that makes a voyage worth
  // taking rather than a way to buy mouths.
  //
  // The hold used to return a flat share of itself — about twenty food,
  // whoever was aboard — and twenty food feeds three new arrivals for two
  // days. Measured, that made the crossing a bad bargain at every setting
  // tried: forced to take every one she could, a band went from 5 of 40
  // standing to 3. Four separate measurements this day said the same thing
  // from different directions — the band is FOOD-limited, not hand-limited.
  // Three extra pairs of hands help a going concern; six sink it; a hex of
  // water that pays food changed the whole shape of the sea. A voyage that
  // converts a banked surplus into people is trading the scarce thing for the
  // plentiful one.
  //
  // So people crossing an ocean to take land arrive with what it takes to
  // start, which is also simply what happened: nobody sailed to a new country
  // empty-handed. Each pays their own way for a season, and the hull's own
  // share comes on top of it.
  const ownStores = brought.length * SETTLER_STORES;
  const hullStores = Math.round(hold(state.ship) * (rough ? 0.5 : 0.85));
  const stores = ownStores + hullStores;
  state.party.food += stores;

  chronicle(
    state,
    rough
      ? `The knarr came back off the open sea with her strakes working and ${stores} of stores `
        + `aboard${brought.length > 0 ? `, and ${brought.length} who had heard there was land` : ''}. `
        + 'It had been a bad crossing both ways.'
      : `The knarr came back on the tide with ${stores} of stores`
        + `${brought.length > 0 ? ` and ${brought.length} who had heard there was land to be had` : ''}. `
        + 'They had been gone since summer.',
    brought.length > 0 ? 'good' : 'plain',
  );
  state.voyage = undefined;
  return true;
}
