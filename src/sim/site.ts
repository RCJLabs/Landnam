// Reading the ground. Given a hex and what surrounds it, how good a place is
// this to spend the rest of your life?
//
// Every measure reads the hex AND its ring, because a steading is not one hex
// — it is the walk to the river, the walk to the woodpile, and the ways in
// that you cannot watch at once.

import { key, neighbors, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import {
  MEASURE_MAX,
  NAME_ROOTS,
  NAME_SUFFIX,
  SCORE_WORDS,
  VERDICTS,
  WATER_FLOOR,
  type Measure,
  type Verdict,
} from '../data/sites';
import { stream } from '../rng';
import type { GameState, SiteReport, Terrain, World } from '../state/types';
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

const SOIL: Record<Terrain, number> = {
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

// --- The whole reading ---

export function siteReport(world: World, at: Hex): SiteReport | null {
  const s = surrounds(world, at);
  if (!s) return null;
  const report = {
    water: water(s),
    soil: soil(s),
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
  let found = VERDICTS[0]!;
  for (const verdict of VERDICTS) if (total >= verdict.from) found = verdict;
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

export type FoundBlock = 'settled' | 'unknown' | 'sea' | 'rock' | 'dry' | 'ended';

/**
 * Why you cannot found here, or null if you can. Returns the reason rather
 * than a bare false, because the whole point of the milestone is that the
 * player understands the choice they are being offered.
 */
export function foundBlocker(state: GameState, at: Hex): FoundBlock | null {
  if (state.end) return 'ended';
  if (state.settlement) return 'settled';
  const tile = state.world.tiles[key(at)];
  if (!tile || !state.world.seen[key(at)]) return 'unknown';
  if (tile.terrain === 'ocean') return 'sea';
  if (tile.terrain === 'mountains') return 'rock';
  const report = siteReport(state.world, at);
  if (!report || report.water < WATER_FLOOR) return 'dry';
  return null;
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
};

/** A name built from the ground: the suffix says what the place is good for. */
export function nameFor(state: GameState, at: Hex, report: SiteReport): string {
  const rng = stream(state.seed, 'worldgen').derive(`steading:${key(at)}`);
  const suffix = rng.pick(NAME_SUFFIX[strongestOf(report)]);
  return `${rng.pick(NAME_ROOTS)}${suffix}`;
}

/**
 * Founds the settlement. One way: there is no unfound, no second steading,
 * and no moving it. Mutates the state clone.
 */
export function foundSettlement(state: GameState): boolean {
  const at = state.party.at;
  if (!canFound(state, at)) return false;
  const report = siteReport(state.world, at)!;
  const name = nameFor(state, at, report);
  const rng = stream(state.seed, 'colony').derive(`found:${key(at)}`);

  state.settlement = {
    at: { q: at.q, r: at.r },
    name,
    foundedOn: state.day,
    report,
    plots: makePlots(report, { q: at.q, r: at.r }, rng.derive('plots')),
    shelter: 0,
    watch: 0,
  };
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
  return home.at.q === state.party.at.q && home.at.r === state.party.at.r;
}
