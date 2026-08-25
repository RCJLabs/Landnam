// What the travel map SHOWS, decided once and drawn by whoever is drawing.
//
// `render/travel.ts` used to do both jobs in one pass: work out that a hex
// has surf on three of its edges AND emit the path for it, work out that a
// crossing has rock in it AND pick the dash pattern. That is fine while there
// is one renderer and impossible to check while there is one renderer, because
// every claim about what the map says can only be tested by reading SVG
// attributes out of a document.
//
// So the decision lives here, as plain data in WORLD coordinates, and the
// backend turns it into nodes. Three things fall out of that:
//
//   - it is pure, so what the map says is unit-testable without a browser;
//   - a second backend (a painted one, a canvas one) consumes the same
//     description rather than reimplementing the rules and drifting from them;
//   - the repaint discipline survives intact. `describeHex` is deliberately
//     per-hex rather than whole-map, so the build-once path in travel.ts still
//     calls it only for the hexes `repaintWork` says are new or relit. A
//     `describeCountry(state)` returning every hex would have been tidier to
//     write and would have put the cost-grows-with-the-run bug straight back.
//
// Marks are ordered, and the order is the draw order. Nothing here knows what
// a colour is.

import { corners, fromKey, fromPixel, key, neighbors, toPixel, type Hex } from '../hex';
import type { GameState, Neighbour, Place, Season, Terrain } from '../state/types';
import { atSea, deepOcean, moveOptions } from '../sim/road';
import { rivalSettled } from '../sim/rival';
import { charted, crossed } from '../sim/skerry';
import { knownGrounds } from '../sim/fishery';
import { landmarkAt } from '../sim/landmark';
import { seasonOf } from '../sim/calendar';
import { makeRng } from '../rng';
import type { Lit } from './repaint';

/** The lattice the world map is drawn on. Scene coordinates are in these units. */
export const HEX_SIZE = 26;

/**
 * The half of a hex that NEVER CHANGES.
 *
 * sim/worldgen.ts writes the terrain and nothing else ever touches it, so
 * everything here is settled the first time a hex is charted and is never
 * asked again. That is not an optimisation — it is the invariant the whole
 * build-once repaint path rests on, and keeping it in the type is how the
 * next renderer inherits it instead of rediscovering it.
 */
export interface HexGround {
  terrain: Terrain;
  /** Open water, far from any coast — the sim's own predicate, not a guess. */
  deep: boolean;
  river: boolean;
  /** Which of the six edges face land, by corner index. Empty unless shallow sea. */
  foam: number[];
  landmark: string | null;
}

/** Everything the overlay draws, in draw order. World coordinates throughout. */
export type Mark =
  | { kind: 'move'; at: Hex; overRock: boolean }
  | { kind: 'way'; at: Hex }
  | { kind: 'skerry'; at: Hex }
  | { kind: 'fishing'; at: Hex }
  | { kind: 'neighbour'; at: Hex; neighbour: Neighbour }
  | { kind: 'place'; at: Hex; place: Place }
  | { kind: 'landfall'; at: Hex }
  | { kind: 'steading'; at: Hex }
  | { kind: 'claim'; at: Hex }
  | { kind: 'rivalHall'; at: Hex }
  | { kind: 'camp'; at: Hex }
  | { kind: 'birds'; at: Hex };

/** Where the band is and what it is riding in. */
export interface TokenPaint {
  at: Hex;
  afloat: boolean;
}

/**
 * The surf line: which of this hex's edges face land.
 *
 * Read off the STATIC tiles, so a hex's foam never changes once drawn and it
 * can ride the build-once path untouched. A foam edge can face land the fog
 * has not lifted from, which is technically a whisper about the coastline —
 * accepted, because sight always reaches further than one hex, so by the time
 * a player can SEE the foam they can see the shore it breaks on.
 */
function foamEdges(state: GameState, at: Hex): number[] {
  const p = toPixel(at, HEX_SIZE);
  const ring = corners(p.x, p.y, HEX_SIZE - 1.5);
  const out: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 6]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The hex on the far side of this edge, found by stepping through it —
    // no corner-to-direction table to get quietly wrong.
    const across = fromPixel(p.x + (mid.x - p.x) * 2, p.y + (mid.y - p.y) * 2, HEX_SIZE);
    const there = state.world.tiles[key(across)];
    if (!there || there.terrain === 'ocean') continue;
    out.push(i);
  }
  return out;
}

/**
 * One hex of country, or null if there is nothing there to draw.
 *
 * Called ONLY for the hexes a repaint says are new — never for the whole
 * chart, and never again for a hex that is only changing light. Ask
 * `describeLight` for that.
 */
export function describeGround(state: GameState, k: string): HexGround | null {
  const tile = state.world.tiles[k];
  if (!tile || state.world.seen[k] === undefined) return null;
  const at = fromKey(k);
  const deep = deepOcean(state, at);
  return {
    terrain: tile.terrain,
    deep,
    river: tile.river,
    foam: tile.terrain === 'ocean' && !deep ? foamEdges(state, at) : [],
    landmark: landmarkAt(state.world, state.seed, at),
  };
}

/**
 * Lit now, or only remembered. The one thing about a charted hex that can
 * move, and therefore the only question a relight has to ask.
 *
 * Returns null for a hex that is not on the chart at all, which a caller
 * holding a stale key can get.
 */
export function describeLight(state: GameState, k: string): boolean | null {
  const now = (state.world.seen as Record<string, Lit>)[k];
  return now === undefined ? null : now === 'visible';
}

/**
 * What the map offers as a next step — the sim's own list, not a second one
 * kept here, and each one carrying whether the band knows there is rock in
 * the way. A three-hex row passes over water the player is not looking at,
 * so the marker itself has to say it: seeing the skerry on the map is no use
 * if the route to somewhere else runs over it.
 */
function moveMarks(state: GameState): Mark[] {
  if (state.event || state.end) return [];
  return moveOptions(state).map((at) => ({
    kind: 'move' as const,
    at,
    overRock: crossed(state.party.at, at).some(
      (h) => state.world.seen[key(h)] !== undefined && charted(state, h),
    ),
  }));
}

/**
 * Some days there are birds over the water. Seeded from the day, so a replay
 * has the same sky; near the band, so they are actually seen.
 */
function birdMark(state: GameState): Mark | null {
  const rng = makeRng(`landnam-birds:${state.seed}:${state.day}`);
  if (rng.next() >= 0.35) return null;
  const near = neighbors(state.party.at);
  const water = near
    .concat(near.flatMap((n) => neighbors(n)))
    .filter((h) => {
      const k = key(h);
      return state.world.seen[k] !== undefined && state.world.tiles[k]?.terrain === 'ocean';
    });
  if (water.length === 0) return null;
  return { kind: 'birds', at: rng.pick(water) };
}

/**
 * Everything over the country, in draw order.
 *
 * Rebuilt every repaint on purpose: it is a few dozen marks that change every
 * turn, and diffing something that small would cost more than remaking it.
 */
export function describeOverlay(state: GameState): Mark[] {
  const marks: Mark[] = [...moveMarks(state)];

  // Ways the band has cut. Ground is usually broken long after a hex was
  // first seen, so these cannot ride the build-once path — a track built with
  // its hex would never appear on the hex that most needs it.
  for (const k of Object.keys(state.world.made ?? {})) {
    if (state.world.seen[k] === undefined) continue;
    marks.push({ kind: 'way', at: fromKey(k) });
  }

  // Rocks the band has learnt about. Only charted ones: the sea keeps what
  // nobody has read yet, and a chart that showed rocks before they were found
  // would make the learning worthless.
  for (const k of state.world.charted ?? []) {
    if (state.world.seen[k] === undefined) continue;
    marks.push({ kind: 'skerry', at: fromKey(k) });
  }

  // Fishing grounds, once the band has laid eyes on the water. Derived from
  // the seed; the fog already remembers which water has been looked at.
  for (const at of knownGrounds(state)) marks.push({ kind: 'fishing', at });

  for (const n of state.neighbours) {
    if (!n.found) continue;
    marks.push({ kind: 'neighbour', at: n.at, neighbour: n });
  }

  for (const place of state.world.places) {
    if (state.world.seen[key(place.at)] === undefined) continue;
    marks.push({ kind: 'place', at: place.at, place });
  }

  // Where the keel first touched sand — the one fixed point on a coast you
  // are otherwise reading for the first time.
  if (state.world.seen[key(state.world.landing)] !== undefined) {
    marks.push({ kind: 'landfall', at: state.world.landing });
  }

  if (state.settlement) marks.push({ kind: 'steading', at: state.settlement.at });

  // The other landnam. Only what the band has actually laid eyes on: a fence
  // on ground nobody has walked is not something they could know.
  if (state.rival && rivalSettled(state)) {
    for (const k of state.rival.claims) {
      if (state.world.seen[k] === undefined) continue;
      marks.push({ kind: 'claim', at: fromKey(k) });
    }
    if (state.world.seen[key(state.rival.at)] !== undefined) {
      marks.push({ kind: 'rivalHall', at: state.rival.at });
    }
  }

  // A camped band has a fire going: the mark of a night's rest, gone the
  // moment they move on.
  if (state.party.hasCamped && !atSea(state)) {
    marks.push({ kind: 'camp', at: state.party.at });
  }

  const birds = birdMark(state);
  if (birds) marks.push(birds);

  return marks;
}

/** Where the band is, and whether it is walking or afloat. */
export function describeToken(state: GameState): TokenPaint {
  return { at: state.party.at, afloat: atSea(state) };
}

/** The light over the country, which only changes when the season turns. */
export function describeSeason(state: GameState): Season {
  return seasonOf(state.day);
}
