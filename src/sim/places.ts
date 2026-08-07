// Places: seeding them onto the map, and what taking one is worth.
//
// The kinds live in data/places.ts. This file owns three things: where they
// land at worldgen, when the party may take one, and the settling-up when it
// falls — loot, lessons, and what the coast now thinks of you. That last is
// the point of the whole system: robbing this coast is how a player CHOOSES
// escalation, and the pressure machinery (4.3, 6.3) is already listening.

import { distance, fromKey, key, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import type { GameState, Place, World } from '../state/types';
import { PLACE_KINDS, placeKind } from '../data/places';
import { chronicle } from './saga';
import { learn, knows } from './lore';
import { shiftStanding } from './neighbours';
import { note } from './tally';

/** Places keep out of each other's way, and out of the landing's. */
const PLACE_MIN_GAP = 5;

/**
 * Seeds one place of each kind onto a generated world, where the ground
 * allows. Deliberately tolerant: a world with no bog and no hills simply has
 * no iron seam, and that is a fact about the country rather than a failure.
 *
 * Deterministic from the rng handed in. The migration for old saves calls
 * this with the same derived stream `newGame` uses, so a save from before
 * places existed gains exactly the places its seed would have been born with.
 */
export function seedPlaces(world: World, rng: Rng): Place[] {
  const placed: Place[] = [];

  for (const kind of PLACE_KINDS) {
    const candidates: Hex[] = [];
    for (const [k, tile] of Object.entries(world.tiles)) {
      if (!kind.ground.includes(tile.terrain)) continue;
      const at = fromKey(k);
      if (distance(at, world.landing) < kind.minFromLanding) continue;
      if (placed.some((p) => distance(p.at, at) < PLACE_MIN_GAP)) continue;
      candidates.push(at);
    }
    if (candidates.length === 0) continue;
    // Object key order is not something to lean on; sort, then pick.
    candidates.sort((a, b) => key(a).localeCompare(key(b)));
    const at = rng.derive(kind.id).pick(candidates);
    placed.push({ id: `pl_${kind.id}`, kind: kind.id, at: { q: at.q, r: at.r } });
  }
  return placed;
}

export function placeById(state: GameState, id: string): Place | undefined {
  return state.world.places.find((p) => p.id === id);
}

/** The place the party is standing on, if any. */
export function placeHere(state: GameState): Place | undefined {
  return state.world.places.find((p) => key(p.at) === key(state.party.at));
}

export type PlaceBlock = 'gone' | 'away' | 'taken';

export function sackBlocker(state: GameState, id: string): PlaceBlock | null {
  const place = placeById(state, id);
  if (!place) return 'gone';
  if (key(place.at) !== key(state.party.at)) return 'away';
  if (place.sackedOn !== undefined) return 'taken';
  return null;
}

export const PLACE_REASON: Record<PlaceBlock, string> = {
  gone: 'There is nothing of the kind here.',
  away: 'It is not under your feet.',
  taken: 'It has already been picked clean.',
};

/**
 * The settling-up when a place falls — after the fight, if it took one.
 * Loot into the packs, a lesson if one was there to take, the place marked
 * taken for good, and the coast's opinion moved where anyone owns it.
 */
export function settlePlace(state: GameState, id: string): void {
  const place = placeById(state, id);
  if (!place || place.sackedOn !== undefined) return;
  const def = placeKind(place.kind);

  state.party.food += def.loot.food;
  state.party.firewood += def.loot.firewood;
  state.party.morale = Math.min(100, Math.max(0, state.party.morale + def.loot.morale));
  place.sackedOn = state.day;
  note(state, 'sackings');

  if (def.teaches && !knows(state, def.teaches.lore)) {
    const roll = stream(state.seed, 'events').derive(`place:${id}`).next();
    if (roll < def.teaches.odds) learn(state, def.teaches.lore);
  }

  if (def.infamy !== 0) {
    // Word starts where the smoke is seen: the nearest neighbour learns what
    // an armed band did here, and thinks accordingly.
    const nearest = [...state.neighbours].sort(
      (a, b) => distance(a.at, place.at) - distance(b.at, place.at),
    )[0];
    if (nearest) shiftStanding(state, nearest.id, def.infamy);
  }

  chronicle(state, def.sackLine, def.garrison !== null ? 'grim' : 'good');
}
