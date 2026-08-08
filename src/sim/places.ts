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
import { PLACE_KINDS, PLACE_MAX_FROM_LANDING, placeKind } from '../data/places';
import { chronicle } from './saga';
import { STRAND_HAUL, STRAND_INFAMY } from './sea';
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
    const distant: Hex[] = [];
    for (const [k, tile] of Object.entries(world.tiles)) {
      if (!kind.ground.includes(tile.terrain)) continue;
      const at = fromKey(k);
      const from = distance(at, world.landing);
      if (from < kind.minFromLanding) continue;
      if (placed.some((p) => distance(p.at, at) < PLACE_MIN_GAP)) continue;
      (from <= PLACE_MAX_FROM_LANDING ? candidates : distant).push(at);
    }
    // Ground within reach first; the rest of the landmass only if this world
    // has none, so an odd coast still gets its wreck rather than none at all.
    if (candidates.length === 0) candidates.push(...distant);
    if (candidates.length === 0) continue;
    // Object key order is not something to lean on; sort, then pick.
    candidates.sort((a, b) => key(a).localeCompare(key(b)));
    const at = rng.derive(kind.id).pick(candidates);
    placed.push({ id: `pl_${kind.id}`, kind: kind.id, at: { q: at.q, r: at.r } });
  }
  return placed;
}

/**
 * How far a neighbour's own knowledge of the coast reaches. They know their
 * stretch of it, not the whole island.
 */
export const TOLD_RANGE = 12;

/**
 * What a trader tells you while the goods are being weighed.
 *
 * A ceiling on placement puts the fixed places within reach; this is how a
 * band LEARNS of them, and it is the half that matters. Clans could be made
 * to come and look at a new steading — a monastery cannot walk over. But
 * word of one travels, and the game already has the machine for it: people
 * who deal with you talk. So a bargain now pays twice, in timber and in
 * knowing what is on this coast, and the plunder economy finally has a
 * road into it that is not "walk two hundred hexes and hope".
 *
 * One place per bargain, nearest to the teller first, and only what they
 * could plausibly know. Returns what was named, or nothing.
 */
export function tellOfPlace(state: GameState, from: Hex, teller: string): Place | undefined {
  let told: Place | undefined;
  let bestD = TOLD_RANGE + 1;
  for (const p of state.world.places) {
    if (state.world.seen[key(p.at)] !== undefined) continue;
    const d = distance(p.at, from);
    if (d < bestD) { bestD = d; told = p; }
  }
  if (!told) return undefined;
  state.world.seen[key(told.at)] = 'seen';
  const def = placeKind(told.kind);
  chronicle(
    state,
    `They talked while the goods were weighed. There is ${def.name} off that way, ` +
      `and ${teller} were content that we should know it.`,
    'plain',
  );
  return told;
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
export function settlePlace(state: GameState, id: string, fromSea = false): void {
  const place = placeById(state, id);
  if (!place || place.sackedOn !== undefined) return;
  const def = placeKind(place.kind);

  // A hold takes more than backs can carry, and the coast remembers a sail
  // far longer than it remembers men on the road. See sim/sea.ts.
  const haul = fromSea ? STRAND_HAUL : 1;
  state.party.food += Math.round(def.loot.food * haul);
  state.party.firewood += Math.round(def.loot.firewood * haul);
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
    if (nearest) {
      shiftStanding(state, nearest.id, Math.round(def.infamy * (fromSea ? STRAND_INFAMY : 1)));
    }
  }

  chronicle(state, def.sackLine, def.garrison !== null ? 'grim' : 'good');
  if (fromSea) {
    chronicle(state, 'We loaded the knarr to the thwarts and were gone on the tide.', 'good');
  }
}
