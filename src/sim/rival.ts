// Somebody else wants this island.
//
// Every clock in the game was the weather's: winter came, stores ran down,
// and the land itself waited politely while the band decided what to do with
// it. Nothing in the world had an ambition of its own. So a second
// landnámsmaðr comes ashore the same spring you do, with the same six posts
// in the same kind of boat, and takes ground on a schedule that does not
// care whether you are ready.
//
// The whole mechanism is deliberately small and deterministic: they settle on
// a known day, and from then on they claim one hex at a time, always the best
// unclaimed ground nearest their hall. No hidden simulation, no second colony
// to balance — just a hand closing on the map, which is enough to make a
// dawdling band pay for dawdling.

import { distance, fromKey, key, neighbors, range, type Hex } from '../hex';
import { stream } from '../rng';
import { MEN, BYNAMES } from '../data/names';
import { NAME_ROOTS, NAME_SUFFIX } from '../data/sites';
import { terrainDef } from '../data/terrain';
import type { GameState, Rival, World } from '../state/types';
import { siteReport, strongestOf } from './site';
import { chronicle } from './saga';

/** How far from our landing theirs is. Far enough that we do not start in their yard. */
export const RIVAL_APART = 7;

/** The day their posts go in. Ours can go in sooner; theirs never slips. */
export const RIVAL_SETTLES = 9;

/** Days between one claim and the next. */
export const CLAIM_EVERY = 11;

/** How far their hand can reach from the hall. A neighbour, not an empire. */
export const CLAIM_REACH = 4;

/** Ground nobody may put posts in because they are standing on it. */
export const RIVAL_ELBOW = 2;

/**
 * Where they came ashore, chosen once from the world and never re-rolled.
 *
 * Deliberately NOT part of `generateWorld`: the port's worldgen hash is a
 * contract with the C++ side, and a rival is a rule about people, not a fact
 * about terrain. It reads the finished world instead.
 */
export function rivalSite(world: World, landing: Hex): Hex | null {
  let best: { at: Hex; score: number } | null = null;
  for (const [k, tile] of Object.entries(world.tiles)) {
    if (tile.terrain === 'ocean' || tile.terrain === 'mountains') continue;
    const at = fromKey(k);
    if (distance(at, landing) < RIVAL_APART) continue;
    const report = siteReport(world, at);
    if (!report) continue;
    // Their taste is the same as ours — they are doing the same thing we
    // are — so they want the good ground, which is what makes them a rival
    // rather than scenery.
    const score = report.total * 100 - distance(at, landing);
    if (!best || score > best.score) best = { at, score };
  }
  return best ? best.at : null;
}

/** The band that is not ours, made at the start of a run. */
export function makeRival(seed: string, world: World): Rival | null {
  const at = rivalSite(world, world.landing);
  if (!at) return null;
  const rng = stream(seed, 'worldgen').derive('rival');
  const report = siteReport(world, at);
  const suffix = report
    ? rng.pick(NAME_SUFFIX[strongestOf(report)])
    : rng.pick(NAME_SUFFIX.soil);
  return {
    leader: `${rng.pick(MEN)} ${rng.pick(BYNAMES)}`,
    hall: `${rng.pick(NAME_ROOTS)}${suffix}`,
    at,
    claims: [key(at)],
    lastClaim: RIVAL_SETTLES,
    met: false,
    told: false,
  };
}

/** True once their posts are in — before that they are a boat somewhere. */
export function rivalSettled(state: GameState): boolean {
  return !!state.rival && state.day >= RIVAL_SETTLES;
}

/** Ground they have taken. */
export function rivalHolds(state: GameState, at: Hex): boolean {
  if (!rivalSettled(state)) return false;
  return state.rival!.claims.includes(key(at));
}

/**
 * Ground we cannot put posts in because of them — their claims and the elbow
 * room around their hall, the same courtesy the older clans get.
 */
export function rivalBlocks(state: GameState, at: Hex): boolean {
  if (!rivalSettled(state)) return false;
  const rival = state.rival!;
  if (distance(rival.at, at) < RIVAL_ELBOW) return true;
  return rival.claims.includes(key(at));
}

/**
 * The next hex their hand closes on: the best ground within reach of the hall
 * that nobody holds. Ours is off limits to them — a claim is a claim on empty
 * land, not a way to take a steading that is already standing.
 */
export function nextClaim(state: GameState): Hex | null {
  const rival = state.rival;
  if (!rival) return null;
  let best: { at: Hex; score: number } | null = null;
  for (const at of range(rival.at, CLAIM_REACH)) {
    const k = key(at);
    const tile = state.world.tiles[k];
    if (!tile || tile.terrain === 'ocean' || tile.terrain === 'mountains') continue;
    if (rival.claims.includes(k)) continue;
    if (state.settlement && distance(state.settlement.at, at) < RIVAL_ELBOW) continue;
    if (state.neighbours.some((n) => distance(n.at, at) < RIVAL_ELBOW)) continue;
    // They spread from what they hold, so the claim is a blot on the map
    // rather than scattered flags.
    if (!neighbors(at).some((n) => rival.claims.includes(key(n)))) continue;
    const report = siteReport(state.world, at);
    const worth = report ? report.total : terrainDef(tile.terrain).forage;
    const score = worth * 100 - distance(rival.at, at);
    if (!best || score > best.score) best = { at, score };
  }
  return best ? best.at : null;
}

/**
 * One day of somebody else's ambition. Called from `passDay`, so it happens
 * on every day the band spends however it spends it — which is the point: the
 * cost of a slow week is that the map is smaller at the end of it.
 */
export function rivalDay(state: GameState): void {
  const rival = state.rival;
  if (!rival || !rivalSettled(state)) return;

  // Their landing, told once, when it is first true.
  if (!rival.told) {
    rival.told = true;
    chronicle(
      state,
      `Word came that ${rival.leader} had put his posts in at ${rival.hall}, `
        + 'a hard day north of us. We were not the only boat that spring.',
      'grim',
    );
  }

  if (state.day - rival.lastClaim < CLAIM_EVERY) return;
  const at = nextClaim(state);
  if (!at) return;
  rival.claims.push(key(at));
  rival.lastClaim = state.day;
  // Only chronicled once we know who they are — a claim on ground we have
  // never seen is not news the band could have had.
  if (rival.met) {
    chronicle(
      state,
      `${rival.leader}'s people had put up a fence on ground we had walked. `
        + `${rival.hall} is getting bigger.`,
      'grim',
    );
  }
}

/** Called when sight falls on their hall: the first time we know for certain. */
export function meetRival(state: GameState): void {
  const rival = state.rival;
  if (!rival || rival.met) return;
  if (!state.world.seen[key(rival.at)]) return;
  rival.met = true;
  chronicle(
    state,
    `We came in sight of ${rival.hall}. ${rival.leader}'s hall, smoke going up, `
      + 'and his fences already out around it. This island has two landnams on it.',
    'grim',
  );
}
