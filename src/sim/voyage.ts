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
import { chronicle } from './saga';
import type { GameState, Person } from '../state/types';

/** Days over and back, before the sea has its say. */
export const CROSSING = 78;

/** Food a head takes for the crossing. */
export const STORES_PER_HEAD = 4;

/** Nobody may sail with fewer than this left at the hall. */
export const MIN_ASHORE = 2;

/** The fewest who can work a knarr across open water. */
export const MIN_ABOARD = 2;

/** Odds the sea takes a strake out of her on the way. */
export const CROSSING_ROUGH = 0.35;

export type SailBlock =
  | 'nosteading' | 'away' | 'already' | 'out' | 'hull' | 'nobody' | 'unmanned' | 'shorthanded';

export const SAIL_REASON: Record<SailBlock, string> = {
  nosteading: 'There is nowhere to come back to yet.',
  away: 'She would have to be launched from the steading.',
  already: 'She is already out over the water.',
  out: 'A party is out on the road. They come home first.',
  hull: 'She will not cross open water in this state.',
  nobody: 'Somebody has to work her.',
  unmanned: 'Somebody has to stay and keep the fire.',
  shorthanded: 'Two at the least, or she does not answer the steering-oar.',
};

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
  const stores = Math.round(hold(state.ship) * (rough ? 0.5 : 0.85));
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
