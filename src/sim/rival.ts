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
import { COAST_IS_A_LINE } from './flags';
import { ROUTE_STOPS, neighbourStops, stopAt } from './route';
import { standingAt } from './coast';
import { CLAN_COUNT, CLAN_ELBOW, CLAN_MAX_GAP } from '../data/clans';

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
 * How far his hand reaches from the hall, in STOPS.
 *
 * Not `CLAIM_REACH` read as stops, and the difference is the whole of this
 * conversion. On the hex map a reach of four covers 61 of 1139 hexes — five
 * per cent, which is what "a neighbour, not an empire" was calibrated
 * against. Four stops of 26 is thirty-five per cent, which is an empire.
 *
 * Three, so he holds seven stretches at full spread: about a quarter of the
 * coast, more than one of the older clans and less than the coast itself,
 * which is right for the one man on it who is doing exactly what you are
 * doing.
 */
export const CLAIM_REACH_STOPS = 3;

/**
 * Days between one claim and the next, on a line.
 *
 * The number that had to move, and the measurement says why. What makes the
 * rival a CLOCK rather than a fact is that on the hex map he never finishes:
 * 61 hexes at one every eleven days is 680, longer than any saga, so the hand
 * is still closing at the last day the band plays. On a line the same eleven
 * days fills his whole reach by day 75 and he is scenery for the rest of the
 * run.
 *
 * Preserving the property by widening the reach would take the whole coast.
 * So the interval gives instead, which is the honest lever: on a line one
 * claim is worth 1/26 of the country against the hex map's 1/1139, and a
 * thing worth forty times more should not come forty times as often.
 *
 * Measured over 150 coasts with the flag on, which is the only way to
 * measure it — the first probe read `claimStops` while the hex path was
 * filling `claims` and reported him completely inert, which he is not. He
 * ends up holding a median of six stretches of a possible seven, never
 * fewer than three, and his last claim lands on a median of day 309. He is
 * still taking ground past day 200 on 135 coasts of 150, and past day 300 on
 * 90 of them — the hand still closing when a long saga ends, which is the
 * whole point of him.
 */
export const CLAIM_EVERY_STOPS = 60;

/**
 * How many stretches of coast lie between his hall and ours.
 *
 * `RIVAL_APART` is seven, and it means "far enough that we do not start in
 * their yard". Read as DAYS on a line that is a median of two stops, and
 * measured over 200 coasts his elbow alone covers the landing on 24 of them
 * — the exact failure `neighbourStops` needed a floor to avoid. So it is
 * read as what it MEANT: far enough that neither his elbow nor his reach can
 * ever touch the sand we were put down on.
 */
export const RIVAL_APART_STOPS = RIVAL_ELBOW + CLAIM_REACH_STOPS + 1;

/**
 * How much room his FENCES keep from somebody else's stretch of coast.
 *
 * One, not `RIVAL_ELBOW`, and it is the third time this conversion has caught
 * a hex-scaled distance being over-read onto a coarser grid. Two hexes of
 * 1139 is a courtesy; two stops around each of four clans blocks twelve of
 * twenty-six, and measured across the sample it left him holding three
 * stretches of a possible seven — a hand that closes twice and jams.
 *
 * A fence is also not a hall. `RIVAL_ELBOW` still governs where POSTS may go
 * — ours and his — because that is a bigger commitment than a fence line,
 * and `CLAN_ELBOW` already answers the same question from the clans' side.
 * This is only "do not build right on top of somebody", which on a line is
 * their own stretch and no further.
 *
 * It leaves the older clans CONTAINING him, which is the better game and was
 * not designed: he spreads from what he holds, so a stretch he may not fence
 * is a wall his block cannot grow past. That containment is why he holds a
 * median of six stretches rather than the full seven, and why the worst
 * coast leaves him three.
 */
export const CLAIM_CLEAR_STOPS = 1;

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

/**
 * Where he comes ashore on a coast that is a line.
 *
 * The same taste as the hex version — he wants the good ground, which is
 * what makes him a rival rather than scenery — read off the country rather
 * than a `siteReport`, because a report is a thing you build from
 * neighbouring hexes and a stretch of coast has none. Nearer wins ties: he
 * came ashore the same spring in the same kind of boat, not after a season
 * of prospecting.
 *
 * He also keeps out of the older clans' yards. On 1872 hexes two systems
 * placing independently never collided; on 26 stops they would collide
 * constantly, and a hall inside a native camp is not a rival, it is a bug.
 */
export function rivalStopFor(seed: string): number | null {
  const clans = neighbourStops(seed, CLAN_COUNT, CLAN_MAX_GAP, CLAN_ELBOW);
  let best: { stop: number; score: number } | null = null;
  for (let s = RIVAL_APART_STOPS; s < ROUTE_STOPS; s += 1) {
    if (clans.some((c) => Math.abs(c - s) < CLAN_ELBOW)) continue;
    const score = terrainDef(stopAt(seed, s).country).forage * 100 - s;
    if (!best || score > best.score) best = { stop: s, score };
  }
  return best ? best.stop : null;
}

/** The band that is not ours, made at the start of a run. */
export function makeRival(seed: string, world: World): Rival | null {
  const stop = COAST_IS_A_LINE ? rivalStopFor(seed) : null;
  // A placeholder on a line, as it is for places, neighbours and landmarks;
  // `stop` is the address. The hex path is untouched.
  const at = COAST_IS_A_LINE
    ? (stop === null ? null : { q: 0, r: 0 })
    : rivalSite(world, world.landing);
  if (!at) return null;
  const rng = stream(seed, 'worldgen').derive('rival');
  // Every draw below happens in the same order in both worlds, so his name
  // and his hall are the same man's whichever coordinate system he stands in.
  const report = COAST_IS_A_LINE ? null : siteReport(world, at);
  const suffix = report
    ? rng.pick(NAME_SUFFIX[strongestOf(report)])
    : rng.pick(NAME_SUFFIX.soil);
  return {
    leader: `${rng.pick(MEN)} ${rng.pick(BYNAMES)}`,
    hall: `${rng.pick(NAME_ROOTS)}${suffix}`,
    at,
    claims: [key(at)],
    ...(stop === null ? {} : { stop, claimStops: [stop] }),
    lastClaim: RIVAL_SETTLES,
    met: false,
    told: false,
  };
}

/** Every stretch of coast he holds. */
export function rivalStops(state: GameState): number[] {
  return state.rival?.claimStops ?? [];
}

/** True once their posts are in — before that they are a boat somewhere. */
export function rivalSettled(state: GameState): boolean {
  return !!state.rival && state.day >= RIVAL_SETTLES;
}

/** Ground they have taken. */
export function rivalHolds(state: GameState, at: Hex): boolean {
  if (!rivalSettled(state)) return false;
  if (COAST_IS_A_LINE) return rivalStops(state).includes(standingAt(state));
  return state.rival!.claims.includes(key(at));
}

/**
 * Ground we cannot put posts in because of them — their claims and the elbow
 * room around their hall, the same courtesy the older clans get.
 */
export function rivalBlocks(state: GameState, at: Hex): boolean {
  if (!rivalSettled(state)) return false;
  const rival = state.rival!;
  if (COAST_IS_A_LINE) {
    if (rival.stop === undefined) return false;
    const here = standingAt(state);
    if (Math.abs(rival.stop - here) < RIVAL_ELBOW) return true;
    return (rival.claimStops ?? []).includes(here);
  }
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
  if (COAST_IS_A_LINE) return null;   // see `nextClaimStop`
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
 * The next stretch of coast his hand closes on.
 *
 * The hex rule, unchanged in every respect that survives: the best ground he
 * can reach that nobody holds, touching what he already holds so the claim
 * is a block of coast rather than scattered flags, and never on ours or an
 * older clan's. "Best" is the country's forage, because a stretch of coast
 * has no neighbouring hexes to build a site report out of.
 */
export function nextClaimStop(state: GameState): number | null {
  const rival = state.rival;
  if (!rival || rival.stop === undefined) return null;
  const held = rival.claimStops ?? [];
  const home = state.settlement?.stop;
  let best: { stop: number; score: number } | null = null;
  for (let s = Math.max(0, rival.stop - CLAIM_REACH_STOPS);
       s <= Math.min(ROUTE_STOPS - 1, rival.stop + CLAIM_REACH_STOPS);
       s += 1) {
    if (held.includes(s)) continue;
    if (home !== undefined && Math.abs(home - s) < CLAIM_CLEAR_STOPS) continue;
    if (state.neighbours.some(
      (n) => n.stop !== undefined && Math.abs(n.stop - s) < CLAIM_CLEAR_STOPS,
    )) {
      continue;
    }
    if (!held.includes(s - 1) && !held.includes(s + 1)) continue;
    const score = terrainDef(stopAt(state.seed, s).country).forage * 100
      - Math.abs(rival.stop - s);
    if (!best || score > best.score) best = { stop: s, score };
  }
  return best ? best.stop : null;
}

/**
 * One day of somebody else's ambition. Called from `passDay`, so it happens
 * on every day the band spends however it spends it — which is the point: the
 * cost of a slow week is that the map is smaller at the end of it.
 */
export function rivalDay(state: GameState): void {
  const rival = state.rival;
  if (!rival || !rivalSettled(state)) return;
  const line = COAST_IS_A_LINE;

  // Their landing, told once, when it is first true.
  if (!rival.told) {
    rival.told = true;
    chronicle(
      state,
      `Word came that ${rival.leader} had put his posts in at ${rival.hall}, `
        + (line
          ? 'a few days up the coast from us. We were not the only boat that spring.'
          : 'a hard day north of us. We were not the only boat that spring.'),
      'grim',
    );
  }

  if (state.day - rival.lastClaim < (line ? CLAIM_EVERY_STOPS : CLAIM_EVERY)) return;
  if (line) {
    const stop = nextClaimStop(state);
    if (stop === null) return;
    (rival.claimStops ??= []).push(stop);
    rival.claimStops.sort((a, b) => a - b);
    rival.lastClaim = state.day;
    if (rival.met) {
      chronicle(
        state,
        `${rival.leader}'s people had put up a fence on ground we had walked. `
          + `${rival.hall} is getting bigger.`,
        'grim',
      );
    }
    return;
  }
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
  if (COAST_IS_A_LINE) {
    if (rival.stop === undefined) return;
    // The stretch he lives on or either side of it. Wider than a neighbour's
    // yard on purpose and for a reason the fiction already gives: he has
    // "smoke going up and his fences already out around it", which is the
    // one thing on this coast you see from the next headland.
    if (Math.abs(rival.stop - standingAt(state)) > 1) return;
  } else if (!state.world.seen[key(rival.at)]) return;
  rival.met = true;
  chronicle(
    state,
    `We came in sight of ${rival.hall}. ${rival.leader}'s hall, smoke going up, `
      + 'and his fences already out around it. This island has two landnams on it.',
    'grim',
  );
}
