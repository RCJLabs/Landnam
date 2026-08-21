// Somebody else's dead steading, standing on your coast.
//
// The whole of the asynchronous-multiplayer idea, and the whole of what it
// costs: no server, no network, no account. A challenge code is a line of
// text that survives being pasted into a chat and retyped with a thumb, and
// this is that line carrying one more thing — where a band before you put
// their posts in, what they called the place, and what finished them.
//
// Two rules it is built on:
//
//   1. A HAUNTED COAST IS NOT AN EASIER COAST. The ruin's loot is mostly
//      timber and it is small. If a challenge handed out a windfall, the code
//      would be worth more than the seed it was cut from and every shared run
//      would be a softer run than the one being bragged about.
//   2. IT NEVER FAILS LOUDLY. A ghost naming ground this world put under the
//      sea — a mangled code, a different build's worldgen — settles for the
//      nearest ground that will hold it, and if there is none it is simply
//      not there. Losing a ruin must never cost somebody the coast.

import type { GameState, Ghost, Place } from '../state/types';
import type { Hex } from '../hex';
import { distance, fromKey, key } from '../hex';
import { placeKind } from '../data/places';
import { chronicle } from './saga';

/** How far from the named hex a ruin will settle for ground that holds it. */
export const HAUNT_REACH = 6;

/**
 * Ground a ruin can stand on: what the kind allows, not already spoken for.
 *
 * `PLACE_MIN_GAP` is deliberately NOT applied. A ruin is not competing with
 * the country's own places for room — it is a fact about where somebody died,
 * and moving it to respect a spacing rule would be moving the one thing the
 * ghost is actually saying.
 */
function holds(state: GameState, at: Hex): boolean {
  const tile = state.world.tiles[key(at)];
  if (!tile) return false;
  if (!placeKind('ruin').ground.includes(tile.terrain)) return false;
  if (state.world.places.some((p) => p.at.q === at.q && p.at.r === at.r)) return false;
  // Not on top of the landing either: the first thing a player sees should be
  // their own beach, not somebody else's grave.
  return distance(at, state.world.landing) > 0;
}

/** The hex the ruin actually ends up on, or nothing if this world has none. */
export function hauntedHex(state: GameState, ghost: Ghost): Hex | undefined {
  if (holds(state, ghost.at)) return ghost.at;
  // Nearest ground that will hold it, ties broken by key so the choice is the
  // same on every machine and in the C++ port.
  const near = Object.keys(state.world.tiles)
    .map(fromKey)
    .filter((at) => distance(at, ghost.at) <= HAUNT_REACH && holds(state, at))
    .sort((a, b) => distance(a, ghost.at) - distance(b, ghost.at) || key(a).localeCompare(key(b)));
  return near[0];
}

/**
 * Puts the ruin in the world. Returns whether anything was placed.
 *
 * Called once, when a run is started from a code that carries a ghost.
 */
export function haunt(state: GameState, ghost: Ghost): boolean {
  const at = hauntedHex(state, ghost);
  if (!at) return false;
  const place: Place = { id: GHOST_RUIN_ID, kind: 'ruin', at: { q: at.q, r: at.r } };
  state.world.places.push(place);
  state.ghost = ghost;
  chronicle(
    state,
    `We had been told that others tried this coast before us, and that they called their steading ${ghost.name}. Nobody said where it was.`,
    'saga',
  );
  return true;
}

/**
 * The id the ghost's ruin is placed under.
 *
 * It matters that this is checked by ID and not by KIND. `abandonSteading`
 * also leaves a `ruin` behind — the band's own hall, under `ruin:<hex>` — and
 * a ghost is not whoever walked out of that. Keying the name off the kind put
 * a stranger's name on the band's own posts, and nothing caught it because
 * the balance bot never walks out (`retreats: false` on all three policies).
 */
export const GHOST_RUIN_ID = 'pl_ruin';

/** Whether this place is the one a challenge code's ghost stood in. */
export function isGhostRuin(place: Place): boolean {
  return place.id === GHOST_RUIN_ID;
}

/** The ghost's ruin standing in this world, if one is. */
export function theRuin(state: GameState): Place | undefined {
  return state.world.places.find(isGhostRuin);
}

/**
 * What the ruin says when the band is standing in it.
 *
 * The kind's own blurb is what a ruin looks like; this is whose it was, which
 * the data table cannot know because it is different every time.
 */
export function ghostLine(state: GameState): string | undefined {
  const ghost = state.ghost;
  if (!ghost) return undefined;
  return `${ghost.name} stood here. ${theirEnd(ghost)}`;
}

/**
 * What finished them, as one sentence.
 *
 * Shared by the panel and the saga deliberately: they are two surfaces onto
 * the same fact, and two copies of a sentence are two sentences that can
 * disagree once somebody edits one of them.
 */
function theirEnd(ghost: Ghost): string {
  return `They ${endedAs(ghost.cause)} on day ${ghost.day}.`;
}

/**
 * What the saga says when the band takes the dead steading apart.
 *
 * Audit #8, and the premise was measured before it was built. The fear was
 * that a band never reaches the ruin at all — the place economy has taught
 * this repo that lesson twice. It is false: across 30 haunted settler sagas
 * the bot found the ruin and TOOK it 17 times, and stood in it 78.
 *
 * What it never did once, in 17 takings, was write down whose it was. The
 * name reached the permanent log exactly once, on day one, in a rumour
 * written before anyone had seen the place — and the taking closed that loop
 * anonymously. The panel knew while you stood there; the saga, which is what
 * a player reads back and what a run is remembered by, did not.
 */
export function ghostTakenLine(state: GameState): string | undefined {
  const ghost = state.ghost;
  if (!ghost) return undefined;
  return `So this was ${ghost.name}, that we had been told of. ${theirEnd(ghost)}`;
}

/** A run-end cause as something a person would say about strangers. */
function endedAs(cause: string): string {
  switch (cause) {
    case 'starved': return 'ran out of food';
    case 'frozen': return 'froze';
    case 'slain': return 'were killed';
    case 'despair': return 'gave up and scattered';
    case 'survived': return 'saw their last spring here and went home';
    case 'jarl': return 'held this coast as jarl';
    default: return 'ended';
  }
}
