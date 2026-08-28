// Reading the ground. Given a hex and what surrounds it, how good a place is
// this to spend the rest of your life?
//
// Every measure reads the hex AND its ring, because a steading is not one hex
// — it is the walk to the river, the walk to the woodpile, and the ways in
// that you cannot watch at once.

import { distance, key, neighbors, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import {
  MEASURE_MAX,
  NAME_ROOTS,
  NAME_SUFFIX,
  COAST_VERDICTS,
  SCORE_WORDS,
  VERDICTS,
  WATER_FLOOR,
  type Measure,
  type Verdict,
} from '../data/sites';
import { CLAN_ELBOW } from '../data/clans';
import { COAST_IS_A_LINE } from './flags';
import { ROUTE_STOPS, daysBetween, pickCountry, stopAt } from './route';
import { makeRng } from '../rng';
import { knowsStop, standingAt } from './coast';
import { rivalBlocks } from './rival';
import { stream } from '../rng';
import type { GameState, Neighbour, SiteReport, Terrain, World } from '../state/types';
import { chronicle } from './saga';
import { makePlots } from './colony';
import { bestAt } from './people';

function clamp(value: number): number {
  return Math.max(0, Math.min(MEASURE_MAX, Math.round(value)));
}

interface Surrounds {
  terrain: Terrain;
  river: boolean;
  ring: { terrain: Terrain; river: boolean }[];
}

function surrounds(world: World, at: Hex): Surrounds | null {
  const here = world.tiles[key(at)];
  if (!here) return null;
  const ring = neighbors(at)
    .map((h) => world.tiles[key(h)])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({ terrain: t.terrain, river: t.river }));
  return { terrain: here.terrain, river: here.river, ring };
}

// --- The five measures ---

/** Fresh water, and only fresh: the sea is no use for drinking or barley. */
function water(s: Surrounds): number {
  let score = s.river ? 3 : 0;
  score += Math.min(2, s.ring.filter((t) => t.river).length);
  // Streams come off high ground whether the map draws them or not, so a site
  // under the fells has a spring even when no river runs through it.
  if (s.ring.some((t) => t.terrain === 'hills' || t.terrain === 'mountains')) score += 1;
  // Standing water in a bog is water you can drink if you must, and no more.
  if (s.terrain === 'bog' || s.ring.some((t) => t.terrain === 'bog')) score += 1;
  return clamp(score);
}

/**
 * Exported because the C++ port generates its tables from this file rather
 * than retyping them — see scripts/party-tables.ts. Content lives in exactly
 * one place, and a soil value that drifted between the two would move where
 * every steading in the Unreal build wants to stand.
 */
export const SOIL: Record<Terrain, number> = {
  valley: 4,
  meadow: 3,
  shore: 1,
  forest: 1,
  hills: 1,
  bog: 0,
  mountains: 0,
  ocean: 0,
};

/** Ground that will take barley and keep cattle — the hex, then the fields. */
function soil(s: Surrounds): number {
  const fields = s.ring.filter((t) => t.terrain === 'valley' || t.terrain === 'meadow').length;
  // A river bottom is worth working even where the hex itself is poor.
  const silt = s.river && SOIL[s.terrain] > 0 ? 1 : 0;
  return clamp(SOIL[s.terrain] + Math.min(2, fields * 0.5) + silt);
}

/** Wood within a day of the door: walls, roof beams, and a winter of fire. */
function timber(s: Surrounds): number {
  const total =
    terrainDef(s.terrain).wood + s.ring.reduce((sum, t) => sum + terrainDef(t.terrain).wood, 0);
  // Seven hexes of pure forest is 28 and the only perfect score there is.
  return clamp((total / 28) * MEASURE_MAX);
}

/**
 * Sheltered water. A bay — sea on two or three sides — beaches a knarr; a spit
 * with sea all round it is somewhere your ship gets broken up in a gale.
 */
function harbour(s: Surrounds): number {
  const sea = s.ring.filter((t) => t.terrain === 'ocean').length;
  if (sea === 0) {
    // A river mouth inland still floats a boat, barely.
    return s.river ? 1 : 0;
  }
  const beachable = s.terrain === 'shore' || s.terrain === 'meadow' || s.terrain === 'bog';
  let score = beachable ? 3 : 1;
  if (sea >= 2 && sea <= 3) score += 2; // a bay
  else if (sea === 4) score += 1;
  else if (sea >= 5) score -= 1; // exposed on every side
  return clamp(score);
}

/**
 * How many ways in there are. Water cannot be walked and mountains barely can,
 * so a site's defence is really a count of the doors you have to watch.
 */
function defence(s: Surrounds): number {
  let doors = 0;
  for (const t of s.ring) {
    const cost = terrainDef(t.terrain).cost;
    if (!Number.isFinite(cost)) continue; // the sea is not a door
    // Hard ground is half a door: passable, but not at speed and not in force.
    doors += cost >= 3 ? 0.5 : 1;
  }
  // Six open approaches is a field; nothing at your back is a fortress.
  let score = MEASURE_MAX - doors * 0.7;
  if (s.terrain === 'hills') score += 1;
  if (s.terrain === 'mountains') score += 1.5;
  return clamp(score);
}

/**
 * The five measures, asked of a stretch of coast instead of a hex.
 *
 * Not five new measures — the SAME five, handed a coast-shaped `Surrounds`.
 * That is the whole trick and it is why this conversion is cheap: `water`,
 * `soil`, `timber`, `harbour` and `defence` are already written against a
 * terrain and a ring of six, and every one of them says something true about
 * a stretch of shore. Rewriting them for a line would mean recalibrating
 * five scores that `VERDICTS`, `nameFor` and the whole settling floor are
 * measured against.
 *
 * So the ring is BUILT rather than read, and its shape is the argument:
 *
 *   - two of ocean, because a coast has the sea down one side of it, always;
 *   - the stretch before and the stretch after, because those are the ground
 *     a steading's people would actually walk to;
 *   - two of its own country, standing for the land behind the shore, which
 *     the route does not map and which is the same country as the strand.
 *
 * Six, so the measures see what they were calibrated on. A river is derived
 * from the seed like everything else on this coast — some stretches have a
 * beck coming down to the sea and most do not.
 */
/**
 * How much of a stretch's ring is open sea: a bight, or a head.
 *
 * The first cut said two, always, and what that cost only showed when the
 * whole report was compared against the map's. Two ocean in a ring of six is
 * EXACTLY `harbour`'s textbook bay (+2 for two or three sides of sea) and
 * exactly two tiles `defence` does not count as doors — so every stretch of
 * every coast took the bay bonus and the sheltered flank, every time, and
 * neither measure separated one stretch from another.
 *
 * Measured off the map this is the side view of: 132 foundable coastal hex
 * sites across twelve worlds have ONE ocean neighbour 58% of the time, two
 * 24%, three 17%, four 2% — a mean of 1.62, not 2.
 */
function seaAtStop(seed: string, stop: number): number {
  const roll = makeRng(`landnam-route:${seed}:${stop}:sea`).next();
  if (roll < 0.58) return 1;
  if (roll < 0.82) return 2;
  return 3;
}

/**
 * Share of the land behind a stretch that is the same country as the strand.
 *
 * Not one, which is what the first cut effectively used: it filled both
 * hinterland slots with `here`, so the stretch's own country appeared THREE
 * times in a ring of six and a valley counted itself over and over into
 * `soil`. Not zero either — the land behind a bog usually is boggy, and a
 * coast whose every stretch read as six unrelated tiles would stop feeling
 * like a place.
 */
export const HINTERLAND_SAME = 0.5;

/** The country behind the strand, which the route does not map. */
function hinterlandAt(seed: string, stop: number, slot: number): Terrain {
  const rng = makeRng(`landnam-route:${seed}:${stop}:behind:${slot}`);
  if (rng.next() < HINTERLAND_SAME) return stopAt(seed, stop).country;
  return pickCountry(rng.next());
}

function stopSurrounds(seed: string, stop: number): Surrounds {
  const here = stopAt(seed, stop).country;
  const before = stop > 0 ? stop - 1 : stop;
  const after = stop < ROUTE_STOPS - 1 ? stop + 1 : stop;
  const ring: { terrain: Terrain; river: boolean }[] = [];
  for (let i = 0; i < seaAtStop(seed, stop); i += 1) {
    ring.push({ terrain: 'ocean', river: false });
  }
  // The neighbouring stretches carry their OWN becks, which is not a detail:
  // `water` counts adjacent rivers up to two, and the first draft threw that
  // information away and left a shore scoring nought however many becks ran
  // down to the sea on either side of it.
  ring.push({ terrain: stopAt(seed, before).country, river: hasBeck(seed, before) });
  ring.push({ terrain: stopAt(seed, after).country, river: hasBeck(seed, after) });
  // AND THE STRETCH'S OWN BECK GOES IN THE RING, not on `terrain.river`.
  //
  // `Surrounds.river` means a river runs THROUGH the site, and `water` pays
  // it 3 outright for that. A beck does not run through a steading; it runs
  // down ACROSS the strand to the sea, which is an adjacent water and worth
  // one of the ring's two. The difference is not cosmetic: passing it as
  // `terrain.river` put a settled coast band's `water` at 4.80 against the
  // map's 1.80, and the healer reads `water` — a winter hall measured care
  // 1.68 against the map's 0.85, so twelve tended days took a whole winter
  // illness off where the map takes 6.6 of 14.
  ring.push({ terrain: here, river: hasBeck(seed, stop) });
  // Whatever is left of the six is the land behind the strand — so a head
  // with three sides of sea has one field behind it and a bight has two.
  while (ring.length < 6) {
    ring.push({ terrain: hinterlandAt(seed, stop, ring.length), river: false });
  }
  return { terrain: here, river: false, ring };
}

/**
 * Wood a woodcutter can actually reach from this stretch, scored 0..MEASURE_MAX.
 *
 * THE ONE MEASURE THAT IS NOT THE HEX MAP'S, and it had to stop being it.
 * `timber` counts the wood in a ring of seven and divides by 28 — seven tiles
 * of pure forest — which is a ring a coast cannot have, because one to three
 * of its six are ocean and carry none. A coast was scored against a ceiling
 * it structurally could not reach: 1.45 against the map's 2.13, so the
 * woodcutter cut a third less and a band that heeded the winter mark still
 * froze, 50% living against a bar wanting 60%.
 *
 * The scale was only half of it. On the map a band that wants wood WALKS
 * INLAND and settles in a forest. On a line there is no inland — so the
 * answer is not to score the ground differently, it is that the woodcutters
 * GO OUT to the wood and the walk is what it costs. The nearest forest at the
 * door is a full measure; the same forest a week up the coast is worth a
 * fraction of it, because most of the day went into getting there and back.
 *
 * That makes "how far are the trees" a thing a player reads off the site
 * panel and weighs against fresh water and a field, which is the decision
 * this whole phase is built on.
 */
export function timberWithin(seed: string, stop: number): number {
  let best = 0;
  for (let s = 0; s < ROUTE_STOPS; s += 1) {
    const wood = terrainDef(stopAt(seed, s).country).wood;
    if (wood === 0) continue;
    // A day's haul out and a day back is a day not spent cutting, so what a
    // stand is worth falls off with the walk rather than stopping at a range.
    const reach = wood / (1 + daysBetween(seed, stop, s) / HAUL_HALVES);
    if (reach > best) best = reach;
  }
  // Four is a stand of pure forest, which is the top of `data/terrain`'s wood.
  return clamp((best / 4) * MEASURE_MAX);
}

/**
 * Days of walking at which a stand of wood is worth half what it is at the
 * door.
 *
 * Chosen against the measure it replaces rather than from the fiction: a
 * coast's forest is about a fifth of it, so the nearest stand is a median two
 * to three stretches off — six to nine days — and this puts a median coast
 * steading's timber where a hex steading's sits.
 */
export const HAUL_HALVES = 6;

/** Does a beck come down to the sea on this stretch? Derived, like everything. */
export function hasBeck(seed: string, stop: number): boolean {
  return makeRng(`landnam-route:${seed}:${stop}:beck`).next() < BECK_SHARE;
}

/**
 * Share of stretches with a beck running down to the sea.
 *
 * Fresh water is the one measure a coast cannot supply out of its own
 * country — `water` reads rivers and high ground, and a shore has neither by
 * default — so this number alone decides whether a coast can be settled.
 * Measured over 300 coasts with the clans' elbows and the other boat's
 * fences all counted, against `WATER_FLOOR`:
 *
 *   share  foundable stretches   coasts with NOWHERE   dry landing
 *   0.33   0-6-13                1 of 300             178 of 300
 *   0.40   0-7-13                1 of 300             153 of 300
 *   0.50   2-8-13                0 of 300             125 of 300
 *   0.60   2-9-13                0 of 300              99 of 300
 *
 * A half, because that is where "no coast is unplayable" stops being nearly
 * true and starts being true — a third leaves one seed in three hundred with
 * nowhere at all to put the posts, which is a game that cannot be played.
 * Not higher: at 0.6 most of the coast has running water and the measure
 * stops separating one site from another, which is the whole of its job.
 *
 * The landing itself is still dry about two times in five, and that is left
 * alone deliberately. A band that has to walk a stretch or two before it can
 * raise a hall is a band making this phase's decision on its first day
 * instead of settling where it happens to be standing.
 */
export const BECK_SHARE = 0.5;

/** The reading for a stretch of coast. */
export function stopReport(seed: string, stop: number): SiteReport {
  const s = stopSurrounds(seed, stop);
  const report = {
    water: water(s),
    soil: soil(s),
    // Not `timber(s)`: on a line what wood is worth is how far the cutters
    // have to walk for it, which no ring of six can say. See `timberWithin`.
    timber: timberWithin(seed, stop),
    harbour: harbour(s),
    defence: defence(s),
  };
  return {
    ...report,
    total: report.water + report.soil + report.timber + report.harbour + report.defence,
  };
}

// --- The whole reading ---

export function siteReport(world: World, at: Hex): SiteReport | null {
  const s = surrounds(world, at);
  if (!s) return null;
  const report = {
    water: water(s),
    soil: soil(s),
    // The map keeps the ring measure: inland ground CAN be seven tiles of
    // forest, so the scale means what it says here, and a band that wants
    // wood can walk in and settle in it.
    timber: timber(s),
    harbour: harbour(s),
    defence: defence(s),
  };
  return {
    ...report,
    total: report.water + report.soil + report.timber + report.harbour + report.defence,
  };
}

export function scoreWord(score: number): string {
  return SCORE_WORDS[Math.max(0, Math.min(SCORE_WORDS.length - 1, score))]!;
}

export function verdictFor(total: number): Verdict {
  // Which scale this world reads on — see COAST_VERDICTS for the measurement.
  // A coast totals roughly twice a hex site, so the hex bands called 95% of
  // every coast "Good ground" or better and the word said nothing.
  const bands = COAST_IS_A_LINE ? COAST_VERDICTS : VERDICTS;
  let found = bands[0]!;
  for (const verdict of bands) if (total >= verdict.from) found = verdict;
  return found;
}

/** The measure this place is best at — what it will be remembered for. */
export function strongestOf(report: SiteReport): Measure {
  const pairs: [Measure, number][] = [
    ['water', report.water],
    ['soil', report.soil],
    ['timber', report.timber],
    ['harbour', report.harbour],
    ['defence', report.defence],
  ];
  return pairs.reduce((best, pair) => (pair[1] > best[1] ? pair : best))[0];
}

// --- Taking the land ---

export type FoundBlock = 'settled' | 'unknown' | 'sea' | 'rock' | 'dry' | 'ended' | 'taken';

/**
 * Why you cannot found here, or null if you can. Returns the reason rather
 * than a bare false, because the whole point of the milestone is that the
 * player understands the choice they are being offered.
 */
export function foundBlocker(state: GameState, at: Hex): FoundBlock | null {
  if (state.end) return 'ended';
  if (state.settlement) return 'settled';
  // On a coast the posts go into the stretch the band is standing on, and
  // the questions the hex map asks about a tile are asked of that stretch
  // instead. Two of them stop existing: a route has no ocean and no
  // mountains on it — `route.COUNTRY` is shore and not summit — so 'sea' and
  // 'rock' are answers to questions a line cannot pose.
  if (COAST_IS_A_LINE) {
    const here = standingAt(state);
    if (!knowsStop(state, here)) return 'unknown';
    // FRESH WATER IS THE ONE THING A STRETCH CANNOT DO WITHOUT, and on a
    // line it is a beck or it is nothing.
    //
    // `WATER_FLOOR` is 1, and on the hex map a 1 can come from a bog in the
    // ring or a fell behind — standing water you can drink if you must. That
    // is a fair reading of an inland site with a spring somewhere in it. It
    // is not a fair reading of a strand: the sea is down one whole side, and
    // "some bog nearby" is how a coast band ends up with a hall it cannot
    // drink at. So the line asks the narrow question. A beck comes down to
    // the sea here, or the posts do not go in.
    //
    // It is also what makes the opening walk a decision rather than a
    // formality — `BECK_SHARE` of the coast will have you, and the rest will
    // not, so the first thing a band does with this country is look for
    // running water.
    if (!hasBeck(state.seed, here)) return 'dry';
    if (stopReport(state.seed, here).water < WATER_FLOOR) return 'dry';
    if (state.neighbours.some((n) => insideElbow(state, n, at))) return 'taken';
    if (rivalBlocks(state, at)) return 'taken';
    return null;
  }
  const tile = state.world.tiles[key(at)];
  if (!tile || !state.world.seen[key(at)]) return 'unknown';
  if (tile.terrain === 'ocean') return 'sea';
  if (tile.terrain === 'mountains') return 'rock';
  const report = siteReport(state.world, at);
  if (!report || report.water < WATER_FLOOR) return 'dry';
  // Neighbours are placed on a coast a band can WALK now rather than
  // anywhere at all, which put some of them within sight of the landing —
  // so the ground they live on has to say so. Otherwise the posts go in a
  // native camp's home field, and "four neighbours share this coast"
  // becomes "one of them is in the yard".
  if (state.neighbours.some((n) => insideElbow(state, n, at))) return 'taken';
  // And the other landnamsmadr, who is doing exactly what we are doing and
  // started the same spring. Ground he has fenced is ground we cannot have —
  // which is the whole cost of a slow week.
  if (rivalBlocks(state, at)) return 'taken';
  return null;
}

/**
 * Is `at` inside somebody's home field?
 *
 * On a line the elbow is measured in STOPS rather than hexes, and it is the
 * one place in the conversion where the number keeps its meaning exactly:
 * `CLAN_ELBOW` was never a length, it was "how many steps of room somebody
 * keeps", and a step is a step in either world. Note the ceiling this puts on
 * the line — two stops of room on a coast 26 long is a real bite, where two
 * hexes on 1872 was not, and `neighbourStops` is why that is survivable: the
 * four of them are spread a quarter of the coast apart, so their elbows do
 * not overlap and there is always a stop between any two.
 */
function insideElbow(state: GameState, n: Neighbour, at: Hex): boolean {
  if (COAST_IS_A_LINE) {
    if (n.stop === undefined) return false;
    return Math.abs(n.stop - standingAt(state)) < CLAN_ELBOW;
  }
  return distance(n.at, at) < CLAN_ELBOW;
}

export function canFound(state: GameState, at: Hex): boolean {
  return foundBlocker(state, at) === null;
}

export const BLOCK_REASON: Record<FoundBlock, string> = {
  settled: 'The posts are already in the ground elsewhere.',
  unknown: 'We have not stood on that ground.',
  sea: 'You cannot raise a hall on open water.',
  rock: 'Nothing grows on bare rock and nothing keeps there.',
  dry: 'No fresh water. A steading here would die of thirst before winter.',
  ended: 'The saga is finished.',
  taken: 'That ground is already somebody\u2019s. They were here first.',
};

/** A name built from the ground: the suffix says what the place is good for. */
export function nameFor(state: GameState, at: Hex, report: SiteReport): string {
  // Named after the ground it stands on, whichever coordinate system that
  // ground is measured in. A hall on stretch nine keeps its name across a
  // reload because the stretch is what the stream is derived from.
  const rng = stream(state.seed, 'worldgen').derive(
    COAST_IS_A_LINE ? `steading:s${standingAt(state)}` : `steading:${key(at)}`,
  );
  const suffix = rng.pick(NAME_SUFFIX[strongestOf(report)]);
  return `${rng.pick(NAME_ROOTS)}${suffix}`;
}

/**
 * Founds the settlement. Mutates the state clone.
 *
 * This said "one way: there is no unfound, no second steading, and no moving
 * it" until 2026-08-20, and that had quietly become a lie the winter panel
 * was telling: `readiness()` advises a band that cannot reach spring to walk
 * out and winter elsewhere, and there was no verb for it. There is now — see
 * src/sim/retreat.ts — and it is still not free, and still not a way to move
 * a steading. It is a way to give one up.
 */
export function foundSettlement(state: GameState): boolean {
  const at = state.party.at;
  if (!canFound(state, at)) return false;
  const report = COAST_IS_A_LINE
    ? stopReport(state.seed, standingAt(state))
    : siteReport(state.world, at)!;
  const name = nameFor(state, at, report);
  const rng = stream(state.seed, 'colony').derive(
    COAST_IS_A_LINE ? `found:s${standingAt(state)}` : `found:${key(at)}`,
  );

  state.settlement = {
    at: { q: at.q, r: at.r },
    // Written only on a line, because on the hex map it would be a lie —
    // `standingAt` answers 0 for a band that has never walked a route, and a
    // hall stamped "stop 0" is a hall the coast would think it knew where to
    // find. See src/state/types.ts.
    ...(COAST_IS_A_LINE ? { stop: standingAt(state) } : {}),
    name,
    foundedOn: state.day,
    report,
    plots: makePlots(report, { q: at.q, r: at.r }, rng.derive('plots')),
    shelter: 0,
    watch: 0,
    built: [],
    queue: [],
    works: 0,
    // Anyone born under the old roof comes in under this one. `bairns` is
    // empty for every band that has not walked out on a steading, which is
    // almost all of them — see src/sim/retreat.ts.
    children: [...(state.bairns ?? [])],
  };
  delete state.bairns;
  // The land-taking is the moment the run stops being a walk, so it is
  // written in saga voice rather than as another day's line.
  const eldest = bestAt(state.party.people, 'spirit');
  chronicle(
    state,
    `${eldest ? `${eldest.name} set the first post` : 'We set the first post'} and we called the place ${name}. ` +
      `${verdictFor(report.total).line} Whatever came after, we would meet it here.`,
    'saga',
  );
  state.party.morale = Math.min(100, state.party.morale + 8);
  return true;
}

/** True when the party is standing on its own hearth. */
export function atHome(state: GameState): boolean {
  const home = state.settlement;
  if (!home) return false;
  // On a coast, home is a stretch — and the hex comparison below does not
  // merely go wrong here, it goes wrong in the generous direction, which is
  // why it would never have been noticed. `WALK` moves `party.stop` and
  // never touches `party.at`, so on a line the band's hex is frozen at the
  // landing forever and `settlement.at` was copied from that same frozen
  // hex. The old test therefore answered TRUE from everywhere on the coast:
  // a band twelve stretches out could walk into its own hall.
  if (COAST_IS_A_LINE) return home.stop !== undefined && home.stop === standingAt(state);
  return home.at.q === state.party.at.q && home.at.r === state.party.at.r;
}
