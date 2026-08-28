// The people already on this coast, and what they think of you.
//
// The point of the milestone is memory. A raid is not a card that resolves and
// clears — it is a thing a named place will still be holding against you forty
// days later, in the price they give you and in how many of them come over the
// ridge. Standing is therefore stored, drifts only slowly, and is read by both
// the trade rate and the raid maths.

import { worldBeat } from './beats';
import type { Rng } from '../rng';
import { stream } from '../rng';
import {
  BARTER_FOOD,
  CLAN_CALLS_EVERY,
  CLAN_COUNT,
  CLAN_ELBOW,
  CLAN_MAX_GAP,
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
import type { GameState, Neighbour } from '../state/types';
import { daysBetween, neighbourStops } from './route';
import { standingAt } from './coast';
import { fieldCrew, purposeDef } from './expedition';
import { effectiveStat } from './people';
import { chronicle } from './saga';
import { note } from './tally';

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
export function placeNeighbours(rng: Rng, seed: string): Neighbour[] {
  // The addresses are already decided — `route.neighbourStops` derives them
  // from the seed, so there is no ground to search and no shuffle to do.
  // Everything BELOW the address comes out of the same rng in the same order:
  // names, opening standing, might. That is deliberate — the conversion moved
  // where people live, not who they are.
  const stops = neighbourStops(seed, CLAN_COUNT, CLAN_MAX_GAP, CLAN_ELBOW);
  const names = {
    clan: rng.shuffle([...CLAN_NAMES]),
    native: rng.shuffle([...NATIVE_NAMES]),
  };
  return stops.map((stop, i) => {
    const kind = i % 2 === 0 ? 'native' : 'clan';
    const def = clanKind(kind);
    return {
      id: `nb_${i + 1}`,
      kind,
      name: names[kind][Math.floor(i / 2)] ?? `${def.noun} ${i + 1}`,
      stop,
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

/**
 * Is the band standing in this one's yard?
 *
 * The seam. Three verbs asked this in three copies of the same expression —
 * `neighbourHere`, `bargainBlocker` and `canFallOn` — and every one of them
 * was a coordinate comparison against a coordinate system being replaced.
 */
export function standingIn(state: GameState, n: Neighbour): boolean {
  return n.stop !== undefined && n.stop === standingAt(state);
}

/** The one the party is standing in. */
export function neighbourHere(state: GameState): Neighbour | undefined {
  return state.neighbours.find((n) => standingIn(state, n));
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
  // A jarl is not forgotten while he is still jarl. Goodwill stops draining
  // once the Thing has carried — ill-will still cools, because a grudge
  // against the man who rules the coast is a harder thing to keep up than
  // a liking for him.
  //
  // Without this the endgame's own reward could not exist: tribute is paid
  // out of standing, and standing bled 0.12 a day into indifference, so the
  // one band in sixty that ruled for a hundred and eighty days was owed
  // nothing by anybody by the second season. Measured at zero food and zero
  // wood across a whole jarldom.
  const ruling = !!state.jarl;
  for (const n of state.neighbours) {
    if (n.standing > 0) {
      if (!ruling) n.standing = Math.max(0, n.standing - REP_DRIFT);
    } else if (n.standing < 0) n.standing = Math.min(0, n.standing + REP_DRIFT);
  }
}

/**
 * Puts a neighbour on the map for good, however you came to know of them.
 *
 * Marking their hex seen is the load-bearing half: `found` alone gets them a
 * marker the fog then hides, and a name you cannot walk to is not knowledge.
 */
export function revealNeighbour(state: GameState, n: Neighbour, line: string): void {
  if (n.found) return;
  n.found = true;
  // On a line there is no fog to lift and no hex to mark: `found` IS the
  // knowledge, and marking (0,0) seen would quietly write the landing into
  // the seen map of a world that has no hexes in it.
  worldBeat(state, { kind: 'met', id: n.id, name: n.name });
  chronicle(state, line, 'plain');
}

/** Marks the places somebody has actually laid eyes on. */
export function seeNeighbours(state: GameState): void {
  for (const n of state.neighbours) {
    if (n.found) continue;
    // The hex map's rule is "somebody has laid eyes on that ground", which
    // the fog answers. A line has no fog, and the honest answer there is the
    // narrow one: you have come to where they live. Everything else about
    // meeting people on a coast runs through `neighboursCallOn`, which is
    // the direction the fiction always ran in anyway.
    if (!standingIn(state, n)) continue;
    const def = clanKind(n.kind);
    revealNeighbour(state, n, `We came in sight of ${n.name}. A ${def.noun}, lived in, and not ours.`);
  }
}

/**
 * Neighbours come and look at the new steading, nearest first, one every
 * CLAN_CALLS_EVERY days after the posts go in.
 *
 * Walking onto somebody's exact hex was the ONLY way to learn they existed,
 * and the harness measured what that was worth: nought of thirty-two clans
 * met across eight five-hundred-day sagas. This is the other direction, and
 * it is the direction the fiction always ran in — a hall going up on an empty
 * strand is the most interesting news on that coast, and the people who
 * already live there do not need to be found to hear it.
 */
export function neighboursCallOn(state: GameState): void {
  const home = state.settlement;
  if (!home || state.end) return;
  const due = Math.floor((state.day - home.foundedOn) / CLAN_CALLS_EVERY);
  const met = state.neighbours.filter((n) => n.found).length;
  if (met >= due) return;

  const next = state.neighbours
    .filter((n) => !n.found)
    .reduce<Neighbour | undefined>(
      (best, n) => (!best || fromHome(state, n) < fromHome(state, best) ? n : best),
      undefined,
    );
  if (!next) return;

  const def = clanKind(next.kind);
  const which = bearing(state, next);
  const how = stream(state.seed, 'events')
    .derive(`callson:${next.id}:${state.day}`)
    .pick([
      `Two came up the strand to look at ${home.name}, and would not come in. They were of ${next.name} — a ${def.noun}, and we know now where it stands.`,
      `A man of ${next.name} walked our fence line, counted us, and went away again. A ${def.noun}, off ${which}, and no friend of ours yet.`,
      `Word had gone round that there were posts in the ground here. ${next.name} sent somebody to see it for themselves — a ${def.noun}, and near enough to matter.`,
    ]);
  revealNeighbour(state, next, how);
}

/**
 * How far the hall is from this one, in whatever the world counts distance in.
 *
 * Days on a line rather than stops, because the stops are not evenly spaced —
 * two stops of four-day legs is further to walk than three of two, and
 * "nearest first" has to mean nearest to WALK or the order is a lie.
 */
function fromHome(state: GameState, n: Neighbour): number {
  const home = state.settlement;
  if (!home) return 0;
  return daysBetween(state.seed, home.stop ?? 0, n.stop ?? 0);
}

/** Rough word for which way they lie. Nothing reads a bearing off a number. */
function bearing(state: GameState, n: Neighbour): string {
  const home = state.settlement;
  if (!home) return 'somewhere';
  // A coast has two directions and the saga should say so plainly. "North"
  // on a line would be a compass word invented for a world with no compass
  // in it.
  return (n.stop ?? 0) >= (home.stop ?? 0) ? 'up the coast' : 'back toward the landing';
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
  if (!n || !standingIn(state, n)) return 'nobody';
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
  worldBeat(state, {
    kind: 'bargained',
    id: n.id,
    gave: BARTER_FOOD,
    got: firewood,
    standing: n.standing,
  });
  note(state, 'bargains');
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
  return standingIn(state, n);
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
  note(state, 'sackings');
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

/**
 * Counts a raid against whoever sent it, for the saga and the chart — and
 * puts them on the map, because men who came over the ridge came FROM
 * somewhere and a band that has just been robbed goes and looks.
 */
export function noteRaidSent(state: GameState): void {
  const source = raidSource(state);
  if (!source) return;
  source.raidsSent += 1;
  revealNeighbour(
    state,
    source,
    `The tracks went back the way we thought they would. It was ${source.name} who sent them.`,
  );
}

/** A short line for the panel when the party is standing in somebody's yard. */
export function neighbourLine(n: Neighbour): string {
  const def = clanKind(n.kind);
  return `${n.name} — a ${def.noun} · ${standingOf(n).label}`;
}
