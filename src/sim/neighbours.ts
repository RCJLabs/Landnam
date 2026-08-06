// The people already on this coast, and what they think of you.
//
// The point of the milestone is memory. A raid is not a card that resolves and
// clears — it is a thing a named place will still be holding against you forty
// days later, in the price they give you and in how many of them come over the
// ridge. Standing is therefore stored, drifts only slowly, and is read by both
// the trade rate and the raid maths.

import { distance, fromKey, key, type Hex } from '../hex';
import type { Rng } from '../rng';
import { stream } from '../rng';
import {
  BARTER_FOOD,
  CLAN_COUNT,
  CLAN_MIN_GAP,
  CLAN_NAMES,
  NATIVE_NAMES,
  REP_DRIFT,
  REP_RAIDED,
  REP_TRADED,
  TRADE_FLOOR,
  clanKind,
  standingFor,
  type Standing,
} from '../data/clans';
import type { GameState, Neighbour, World } from '../state/types';
import { fieldCrew, purposeDef } from './expedition';
import { effectiveStat } from './people';
import { chronicle } from './saga';

/** Anger past this stops adding to the pressure — a coast has limits. */
export const PRESSURE_MAX = 3;

/** How much each point of standing below zero adds to what comes for you. */
export const PRESSURE_PER_ANGER = 0.035;

/** How much anger stirs the country up around a steading. */
export const PRESSURE_STIR = 0.3;

// --- Placement ---

/**
 * Seeds the coast with neighbours. Kinds alternate rather than rolling, so
 * every coast has both somebody who was here first and somebody who came the
 * year before you — the two halves of the milestone.
 */
export function placeNeighbours(world: World, rng: Rng): Neighbour[] {
  const candidates: Hex[] = [];
  for (const [k, tile] of Object.entries(world.tiles)) {
    if (tile.terrain === 'ocean' || tile.terrain === 'mountains') continue;
    const at = fromKey(k);
    if (distance(at, world.landing) < CLAN_MIN_GAP) continue;
    candidates.push(at);
  }
  // Object key order is not something to lean on; sort, then shuffle.
  candidates.sort((a, b) => key(a).localeCompare(key(b)));
  const pool = rng.shuffle(candidates);

  const chosen: Hex[] = [];
  // Spread them out first; if the landmass is too cramped for that, take what
  // it will hold rather than shipping a coast with one neighbour on it.
  for (const gap of [CLAN_MIN_GAP, 3]) {
    for (const at of pool) {
      if (chosen.length >= CLAN_COUNT) break;
      if (chosen.some((c) => distance(c, at) < gap)) continue;
      chosen.push(at);
    }
  }

  const names = {
    clan: rng.shuffle([...CLAN_NAMES]),
    native: rng.shuffle([...NATIVE_NAMES]),
  };
  return chosen.map((at, i) => {
    const kind = i % 2 === 0 ? 'native' : 'clan';
    const def = clanKind(kind);
    return {
      id: `nb_${i + 1}`,
      kind,
      name: names[kind][Math.floor(i / 2)] ?? `${def.noun} ${i + 1}`,
      at: { q: at.q, r: at.r },
      standing: def.opening + rng.int(-6, 6),
      might: rng.int(0, 3),
      raidsSent: 0,
    };
  });
}

// --- Lookups ---

export function neighbourById(state: GameState, id: string): Neighbour | undefined {
  return state.neighbours.find((n) => n.id === id);
}

export function neighbourAt(state: GameState, at: Hex): Neighbour | undefined {
  return state.neighbours.find((n) => n.at.q === at.q && n.at.r === at.r);
}

/** The one the party is standing in. */
export function neighbourHere(state: GameState): Neighbour | undefined {
  return neighbourAt(state, state.party.at);
}

export function standingOf(n: Neighbour): Standing {
  return standingFor(n.standing);
}

/** Whoever likes you least. They are the ones who come. */
export function angriest(state: GameState): Neighbour | undefined {
  if (state.neighbours.length === 0) return undefined;
  return state.neighbours.reduce((worst, n) => (n.standing < worst.standing ? n : worst));
}

/** Whoever likes you most. They are the ones who bring things. */
export function friendliest(state: GameState): Neighbour | undefined {
  if (state.neighbours.length === 0) return undefined;
  return state.neighbours.reduce((best, n) => (n.standing > best.standing ? n : best));
}

/** How badly the worst of them wants a word with you, 0..100. */
export function angerLevel(state: GameState): number {
  return Math.max(0, -(angriest(state)?.standing ?? 0));
}

/** How well the best of them thinks of you, 0..100. */
export function goodwillLevel(state: GameState): number {
  return Math.max(0, friendliest(state)?.standing ?? 0);
}

// --- Memory ---

export function shiftStanding(state: GameState, id: string, delta: number): void {
  const n = neighbourById(state, id);
  if (!n) return;
  n.standing = Math.max(-100, Math.min(100, n.standing + delta));
}

/**
 * Standing creeps back toward indifference. Deliberately slow: at REP_DRIFT a
 * sacking takes most of a year to forget, which is the whole point — if it
 * washed out in a fortnight the milestone would not exist.
 */
export function driftStandings(state: GameState): void {
  for (const n of state.neighbours) {
    if (n.standing > 0) n.standing = Math.max(0, n.standing - REP_DRIFT);
    else if (n.standing < 0) n.standing = Math.min(0, n.standing + REP_DRIFT);
  }
}

/** Marks the places somebody has actually laid eyes on. */
export function seeNeighbours(state: GameState): void {
  for (const n of state.neighbours) {
    if (n.found) continue;
    if (state.world.seen[key(n.at)] === undefined) continue;
    n.found = true;
    const def = clanKind(n.kind);
    chronicle(
      state,
      `We came in sight of ${n.name}. A ${def.noun}, lived in, and not ours.`,
      'plain',
    );
  }
}

// --- Bartering ---

export type BargainBlock = 'nobody' | 'standing' | 'stores';

export const BARGAIN_REASON: Record<BargainBlock, string> = {
  nobody: 'There is nobody here to deal with.',
  standing: 'They will not trade with us. Not after what has passed.',
  stores: `We have nothing like ${BARTER_FOOD} to carry in.`,
};

export function bargainBlocker(state: GameState, id: string): BargainBlock | null {
  const n = neighbourById(state, id);
  if (!n || n.at.q !== state.party.at.q || n.at.r !== state.party.at.r) return 'nobody';
  if (n.standing < TRADE_FLOOR) return 'standing';
  if (state.party.food < BARTER_FOOD) return 'stores';
  return null;
}

/**
 * What a unit of food is worth in their goods. Rises across the whole standing
 * range, so the difference between cold and sworn is visible in the numbers
 * rather than only in the flavour text.
 */
export function tradeRate(standing: number): number {
  const clamped = Math.max(-100, Math.min(100, standing));
  return 0.6 + ((clamped + 100) / 200) * 1.4;
}

export interface Bargain {
  food: number;
  firewood: number;
}

/** Carries food in and goods out. Mutates; callers hold a clone. */
export function bargain(state: GameState, id: string): Bargain | null {
  if (bargainBlocker(state, id) !== null) return null;
  const n = neighbourById(state, id)!;
  const crew = fieldCrew(state);
  const sharp = crew.reduce<number>((best, p) => Math.max(best, effectiveStat(p, 'wits')), 1);
  // A party that went out to barter is carrying things worth bartering.
  const purpose = state.expedition ? purposeDef(state.expedition.purpose) : undefined;
  const errand = purpose?.id === 'trade' ? 1.25 : 1;

  const rng = stream(state.seed, 'events').derive(`barter:${n.id}:${state.day}`);
  const firewood = Math.max(
    1,
    Math.round(BARTER_FOOD * tradeRate(n.standing) * (0.8 + sharp * 0.08) * errand * rng.float(0.9, 1.1)),
  );

  state.party.food -= BARTER_FOOD;
  state.party.firewood += firewood;
  state.party.morale = Math.min(100, state.party.morale + 3);
  shiftStanding(state, n.id, REP_TRADED);
  n.lastDealt = state.day;

  chronicle(
    state,
    `We carried ${BARTER_FOOD} into ${n.name} and came out with ${firewood} of timber and goods. ` +
      `${standingOf(n).line}`,
    'good',
  );
  return { food: -BARTER_FOOD, firewood };
}

// --- Falling on them ---

export function canFallOn(state: GameState, id: string): boolean {
  const n = neighbourById(state, id);
  if (!n || state.end || state.event || state.battle) return false;
  return n.at.q === state.party.at.q && n.at.r === state.party.at.r;
}

/**
 * Draws steel on a neighbour. Returns the difficulty the fight should be run
 * at, or null if there is nothing to fall on — starting the battle is left to
 * the caller, so this module never has to know about the mode stack.
 *
 * Standing is docked the moment the decision is made, not on the way home:
 * they saw who came over the wall whether or not it went well for you.
 */
export function fallOn(state: GameState, id: string): number | null {
  if (!canFallOn(state, id)) return null;
  const n = neighbourById(state, id)!;
  shiftStanding(state, n.id, REP_RAIDED);
  n.lastDealt = state.day;
  chronicle(state, `We went into ${n.name} under arms, and they knew our faces.`, 'grim');
  return n.might;
}

// --- What it costs you ---

/**
 * How much the coast's ill-will adds to a raid. Read off the angriest of them
 * and their kind's strength, because raids come from somebody in particular.
 */
export function raidPressure(state: GameState): number {
  const worst = angriest(state);
  if (!worst) return 0;
  const anger = Math.max(0, -worst.standing);
  return Math.min(PRESSURE_MAX, anger * PRESSURE_PER_ANGER * clanKind(worst.kind).strength);
}

/** Who is coming, if anyone is. */
export function raidSource(state: GameState): Neighbour | undefined {
  const worst = angriest(state);
  return worst && worst.standing < 0 ? worst : undefined;
}

/** Multiplier on how often the country stirs around a steading. */
export function stirFactor(state: GameState): number {
  return 1 + raidPressure(state) * PRESSURE_STIR;
}

/** Counts a raid against whoever sent it, for the saga and the chart. */
export function noteRaidSent(state: GameState): void {
  const source = raidSource(state);
  if (source) source.raidsSent += 1;
}

/** A short line for the panel when the party is standing in somebody's yard. */
export function neighbourLine(n: Neighbour): string {
  const def = clanKind(n.kind);
  return `${n.name} — a ${def.noun} · ${standingOf(n).label}`;
}
